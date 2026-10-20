/**
 * ClickableLegend — visx legend item renderer with a generic click controller.
 *
 * Pass as the `children` render prop of any visx Legend component
 * (LegendOrdinal, LegendThreshold, LegendLinear). Clicks call
 * `onClick(itemKey, displayText, el)`. The overlay does not decide what
 * a click means. Today the editor wires `wpEditorFunctions.legendItems.onClick`
 * (customize). Published charts may wire `context.legendItems.onClick`
 * (first frontend handler: session hide). Editor wins when both exist.
 *
 * Because visx skips its own flex container when `children` is provided,
 * this component renders the equivalent wrapper div itself.
 *
 * Layout modes are driven by `config.legend.variation`:
 * - `'grouped'` (default): all items render together in a single flex container.
 *   Whole-legend drag is handled by the enclosing <StyledLegend>.
 * - `'detached'`: each item is rendered as an absolutely-positioned standalone
 *   element using its own `customLabels[k].offsetX` / `offsetY` and optional
 *   per-item style overrides. Per-item drag wires to
 *   `wpEditorFunctions.legendItems.onItemDrag*`.
 */

import {
	contrastLabelFillForLightDark,
	DataContext,
	categoryKeyFromLegendDatum,
	parseRichText,
	stripRichText,
	type BaseConfig,
	type CategoryStyle,
	type LegendItemCustomization,
	type LegendItemsController,
	type Pattern,
	type RichTextRun,
	type TableData,
} from '@prc/charting-utilities';
import { LegendItem, LegendLabel } from '@visx/legend';
import React, { useContext, useEffect, useRef, useState } from 'react';
import type { DraggableData, DraggableEvent } from 'react-draggable';
import { DraggableCore } from 'react-draggable';
import { LegendSwatch, legendSwatchSeriesColor } from '../primitives/LegendSwatch';
import { RichTextHtml } from '../primitives/RichText';
import {
	LegendScaleContext,
	getLegendPositioningScale,
	scaleLegendPositionToDisplay,
	scaleLegendPositionToLayout,
	type LegendPositioningContext,
} from './Legend';

function getLegendParagraphStyles(customEntry?: LegendItemCustomization): React.CSSProperties {
	if (!customEntry) {
		return {};
	}

	const styles: React.CSSProperties = {};

	if (customEntry.lineHeight) {
		styles.lineHeight = customEntry.lineHeight;
	}
	if (customEntry.textAlign) {
		styles.textAlign = customEntry.textAlign;
	}
	if (customEntry.letterSpacing !== undefined && customEntry.letterSpacing !== null) {
		styles.letterSpacing = `${customEntry.letterSpacing}px`;
	}
	if (customEntry.maxWidth) {
		styles.whiteSpace = 'normal';
		styles.overflowWrap = 'break-word';
	}

	return styles;
}

type LabelDatum = {
	text: string;
	value?: any;
	datum: any;
	index: number;
	[key: string]: any;
};

function legendItemText(customEntry: LegendItemCustomization | undefined, label: LabelDatum): string {
	return customEntry?.text || label.text || '';
}

// Hidden scale placeholders (no marker, zero-width label) stay in the legend
// domain but are not controls.
function legendItemIsPlaceholder(displayText: string, hideMarker: boolean): boolean {
	return hideMarker && displayText.replace(/[\u200B\u200C\u200D\u2060\uFEFF]/g, '').trim() === '';
}

type ClickableLegendProps = {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	labels: any;
	/** Accepts 'none'/'label' from legend config; treated as 'rect' internally (visibility is controlled via context). */
	shape?: 'rect' | 'circle' | 'line' | 'none' | 'label';
	shapeWidth?: number;
	shapeHeight?: number;
	shapeMargin?: string;
	fill?: (label: LabelDatum) => string;
	shapeStyle?: (label: LabelDatum) => React.CSSProperties;
	itemDirection?: string;
	itemMargin?: string;
	labelMargin?: string;
	labelFlex?: string;
	labelAlign?: string;
	legendLabelProps?: Record<string, any>;
	direction?: string;
};

type LegendItemClickHandler = (key: string, text: string, el: EventTarget) => void;

function legendItemKey(label: LabelDatum, index: number): string {
	return label.datum !== undefined && label.datum !== null ? categoryKeyFromLegendDatum(label.datum) : String(index);
}

function resolveLegendMarker(
	customEntry: LegendItemCustomization | undefined,
	defaultShape: 'rect' | 'circle' | 'line',
	hideAllMarkers: boolean
): { shape: 'rect' | 'circle' | 'line'; hidden: boolean } {
	const markerStyle = customEntry?.markerStyle;
	return {
		shape: markerStyle && markerStyle !== 'none' ? markerStyle : defaultShape,
		hidden: markerStyle === 'none' || (markerStyle === undefined && hideAllMarkers),
	};
}

type ResolvedLegendItem = {
	itemKey: string;
	label: LabelDatum;
	customEntry: LegendItemCustomization | undefined;
	/** Plain text: editor callbacks, placeholder checks, series style lookup. */
	displayText: string;
	textRuns: RichTextRun[];
	marker: ReturnType<typeof resolveLegendMarker>;
	markerFill: 'solid' | 'outline';
	scaleColor: string;
	shapeStyle: React.CSSProperties | undefined;
	opacity: number;
	pattern: Pattern | undefined;
};

type LegendPresentation = {
	shapeWidth: number;
	shapeHeight: number;
	shapeMargin: string;
	itemDirection: string;
	labelMargin: string;
	labelFlex: string;
	labelAlign: string;
	legendLabelProps: Record<string, any>;
};

function legendItemActivationProps(input: {
	onLegendItemClick?: LegendItemClickHandler;
	itemKey: string;
	displayText: string;
	opacity: number;
	hideMarker: boolean;
	isToggle: boolean;
}): {
	role?: 'button';
	tabIndex?: number;
	'aria-pressed'?: boolean;
	'aria-hidden'?: boolean;
	onClick?: (e: React.MouseEvent<HTMLElement>) => void;
	onKeyDown?: (e: React.KeyboardEvent<HTMLElement>) => void;
	style: React.CSSProperties;
} {
	const placeholder = legendItemIsPlaceholder(input.displayText, input.hideMarker);
	const clickable = Boolean(input.onLegendItemClick) && !placeholder;
	return {
		role: clickable ? 'button' : undefined,
		tabIndex: clickable ? 0 : undefined,
		'aria-pressed': clickable && input.isToggle ? input.opacity < 1 : undefined,
		'aria-hidden': placeholder ? true : undefined,
		onClick: clickable
			? (e) => {
					input.onLegendItemClick?.(input.itemKey, input.displayText, e.currentTarget);
				}
			: undefined,
		onKeyDown: clickable
			? (e) => {
					if (e.key === 'Enter' || e.key === ' ') {
						e.preventDefault();
						input.onLegendItemClick?.(input.itemKey, input.displayText, e.currentTarget);
					}
				}
			: undefined,
		style: {
			opacity: input.opacity,
			cursor: clickable ? 'pointer' : undefined,
			pointerEvents: placeholder ? 'none' : undefined,
		},
	};
}

function LegendItemContent({
	item,
	presentation,
	labelStyle,
}: {
	item: ResolvedLegendItem;
	presentation: LegendPresentation;
	labelStyle?: React.CSSProperties;
}) {
	return (
		<>
			<LegendSwatch
				shape={item.marker.shape}
				width={item.marker.hidden ? 0 : presentation.shapeWidth}
				height={item.marker.hidden ? 0 : presentation.shapeHeight}
				margin={item.marker.hidden ? '0' : presentation.shapeMargin}
				seriesColor={legendSwatchSeriesColor(item.scaleColor, item.customEntry, item.markerFill)}
				markerFill={item.markerFill}
				shapeStyle={item.shapeStyle}
				pattern={item.pattern}
				patternKey={item.itemKey}
			/>
			<LegendLabel
				label={<RichTextHtml runs={item.textRuns} />}
				flex={presentation.labelFlex}
				margin={presentation.labelMargin}
				align={presentation.labelAlign}
				{...presentation.legendLabelProps}
				style={{
					...presentation.legendLabelProps?.style,
					...labelStyle,
				}}
			/>
		</>
	);
}

// Render a single absolute-positioned detached legend item, with optional
// per-item drag wired to `wpEditorFunctions.legendItems.onItemDrag*`.
function DetachedLegendItem({
	item,
	presentation,
	legendIsLabelMode,
	onLegendItemClick,
	itemClickIsToggle,
	legendItemHandlers,
}: {
	item: ResolvedLegendItem;
	presentation: LegendPresentation;
	legendIsLabelMode: boolean;
	onLegendItemClick?: (key: string, text: string, el: EventTarget) => void;
	itemClickIsToggle: boolean;
	legendItemHandlers?: {
		onItemDragStart?: (key: string) => void;
		onItemDrag?: (key: string, x: number, y: number) => void;
		onItemDragEnd?: (key: string, x: number, y: number) => void;
	};
}) {
	const { itemKey, customEntry, displayText, marker, opacity, scaleColor } = item;
	const legendScale = useContext(LegendScaleContext);
	const positioningContext: LegendPositioningContext = customEntry?.positioningContext ?? 'chart';
	const positioningScale = getLegendPositioningScale(positioningContext, legendScale);
	const layoutX = customEntry?.offsetX ?? 0;
	const layoutY = customEntry?.offsetY ?? 0;
	const hideMarker = marker.hidden;
	const placeholder = legendItemIsPlaceholder(displayText, hideMarker);
	const interactive = Boolean(onLegendItemClick) && !placeholder;

	const isDraggable = Boolean(legendItemHandlers?.onItemDragEnd) && !placeholder;
	const initialPosition = scaleLegendPositionToDisplay(layoutX, layoutY, positioningScale);
	const [position, setPosition] = useState(initialPosition);
	const [isDragging, setIsDragging] = useState(false);
	const positionRef = useRef(initialPosition);
	const dragActiveRef = useRef(false);
	const didDragRef = useRef(false);
	// react-draggable needs an explicit nodeRef under React 19 (findDOMNode was removed).
	const dragRef = useRef<HTMLDivElement>(null);

	// Sync local position back to the attribute value when it changes externally
	// (e.g. editor edits DX/DY in the popover), but ignore during an active drag.
	useEffect(() => {
		if (dragActiveRef.current) return;
		const scale = getLegendPositioningScale(positioningContext, legendScale);
		const next = scaleLegendPositionToDisplay(layoutX, layoutY, scale);
		positionRef.current = next;
		setPosition(next);
	}, [layoutX, layoutY, positioningContext, legendScale]);

	const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
		// Suppress the click that fires immediately after a drag.
		if (didDragRef.current) {
			didDragRef.current = false;
			return;
		}
		if (onLegendItemClick) {
			onLegendItemClick(itemKey, displayText, e.currentTarget);
		}
	};

	const handleKeyDown = onLegendItemClick
		? (e: React.KeyboardEvent<HTMLDivElement>) => {
				if (e.key === 'Enter' || e.key === ' ') {
					e.preventDefault();
					onLegendItemClick(itemKey, displayText, e.currentTarget);
				}
			}
		: undefined;

	const handleDragStart = () => {
		dragActiveRef.current = true;
		didDragRef.current = false;
		setIsDragging(true);
		legendItemHandlers?.onItemDragStart?.(itemKey);
	};

	const handleDrag = (_e: DraggableEvent, data: DraggableData) => {
		if (data.deltaX === 0 && data.deltaY === 0) {
			return;
		}
		didDragRef.current = true;
		setPosition((previous) => {
			const next = { x: previous.x + data.deltaX, y: previous.y + data.deltaY };
			positionRef.current = next;
			legendItemHandlers?.onItemDrag?.(itemKey, next.x, next.y);
			return next;
		});
	};

	const handleDragStop = () => {
		dragActiveRef.current = false;
		setIsDragging(false);
		const scale = getLegendPositioningScale(positioningContext, legendScale);
		const layoutPosition = scaleLegendPositionToLayout(positionRef.current.x, positionRef.current.y, scale);
		legendItemHandlers?.onItemDragEnd?.(itemKey, layoutPosition.x, layoutPosition.y);
	};

	let cursor: 'grabbing' | 'grab' | 'pointer' | 'default' = 'default';
	if (isDraggable) {
		cursor = isDragging ? 'grabbing' : 'grab';
	} else if (interactive) {
		cursor = 'pointer';
	}

	// Mirror DraggableLabel's stroke+paintOrder: use -webkit-text-stroke for HTML equivalent.
	const outlineColor = customEntry?.textOutline
		? contrastLabelFillForLightDark(customEntry.color || '#000000')
		: undefined;

	const itemStyle: React.CSSProperties = {
		position: 'absolute',
		left: position.x,
		top: position.y,
		display: 'flex',
		flexDirection: presentation.itemDirection as any,
		alignItems: 'center',
		fontSize: customEntry?.fontSize ? `${customEntry.fontSize}px` : undefined,
		// In label mode the text IS the legend visual — color it with the series color,
		// unless the editor has set an explicit per-item color override.
		color: customEntry?.color || (legendIsLabelMode ? scaleColor : undefined),
		fontWeight: customEntry?.fontWeight || undefined,
		fontStyle: customEntry?.fontStyle || undefined,
		fontFamily: customEntry?.fontFamily || undefined,
		maxWidth: customEntry?.maxWidth ? `${customEntry.maxWidth}px` : undefined,
		WebkitTextStroke: outlineColor ? `1px ${outlineColor}` : undefined,
		userSelect: 'none',
		pointerEvents: placeholder ? 'none' : 'auto',
		cursor,
		opacity,
	};

	const inner = (
		<div
			ref={dragRef}
			role={interactive ? 'button' : undefined}
			tabIndex={interactive ? 0 : undefined}
			aria-pressed={interactive && itemClickIsToggle ? opacity < 1 : undefined}
			aria-hidden={placeholder ? true : undefined}
			onClick={interactive ? handleClick : undefined}
			onKeyDown={interactive ? handleKeyDown : undefined}
			style={itemStyle}
		>
			<LegendItemContent
				item={item}
				presentation={presentation}
				labelStyle={getLegendParagraphStyles(customEntry)}
			/>
		</div>
	);

	if (!isDraggable) {
		return inner;
	}

	return (
		<DraggableCore nodeRef={dragRef} onStart={handleDragStart} onDrag={handleDrag} onStop={handleDragStop}>
			{inner}
		</DraggableCore>
	);
}

export function ClickableLegend({
	labels,
	shape = 'rect',
	shapeWidth = 12,
	shapeHeight = 12,
	shapeMargin = '0px 4px 2px 0',
	fill,
	shapeStyle,
	itemDirection = 'row',
	itemMargin = '0',
	labelMargin = '0 4px',
	labelFlex = '1',
	labelAlign = 'left',
	legendLabelProps = {},
	direction = 'column',
}: ClickableLegendProps) {
	const context = useContext(
		DataContext as React.Context<{
			data: any;
			config: BaseConfig;
			tableData: TableData;
			wpEditorFunctions?: any;
			legendItems?: LegendItemsController;
		}>
	);

	const wpEditorFunctions = context?.wpEditorFunctions;
	const editorLegendItemClick = wpEditorFunctions?.legendItems?.onClick;
	const frontendLegendItemClick = context?.legendItems?.onClick;
	const onLegendItemClick = editorLegendItemClick ?? frontendLegendItemClick;
	const itemClickIsToggle = !editorLegendItemClick && Boolean(frontendLegendItemClick);
	const getItemOpacity = context?.legendItems?.getItemOpacity ?? (() => 1);
	const legendItemHandlers = wpEditorFunctions?.legendItems;
	const customLabels: Record<string, LegendItemCustomization> = context?.config?.legend?.customLabels ?? {};
	const variation = context?.config?.legend?.variation ?? 'grouped';
	const seriesStyles: Record<string, CategoryStyle | undefined> = context?.config?.seriesStyles ?? {};

	const legendMargin = context?.config?.legend?.margin;
	const perItemMargin = legendMargin
		? `${legendMargin.top}px ${legendMargin.right}px ${legendMargin.bottom}px ${legendMargin.left}px`
		: itemMargin;

	// When the legend-level markerStyle is 'none' or 'label', hide all markers by default.
	// Read from context so chart components don't need to pass special values to visx's shape prop.
	// A per-item customEntry.markerStyle can still restore a visible shape (for 'none' mode).
	const legendMarkerStyle = context?.config?.legend?.markerStyle;
	const legendHideAllMarkers = legendMarkerStyle === 'none';
	const legendIsLabelMode = legendMarkerStyle === 'label';
	const legendMarkerFill = context?.config?.legend?.markerFill ?? 'solid';
	// Coerce 'none'/'label' → 'rect' for the swatch component (the swatch itself
	// is hidden when those modes are active via the hideMarker flag).
	const safeDefaultShape: 'rect' | 'circle' | 'line' =
		!shape || shape === 'none' || shape === 'label' ? 'rect' : shape;
	const presentation: LegendPresentation = {
		shapeWidth,
		shapeHeight,
		shapeMargin,
		itemDirection,
		labelMargin,
		labelFlex,
		labelAlign,
		legendLabelProps,
	};

	// Filter phantom labels produced by threshold scales when
	// the color palette has more entries than the scale needs.
	const visibleLabels = labels.filter(
		(label: LabelDatum) => label.text !== '' || (label.value !== null && label.value !== undefined)
	);
	const resolveItem = (label: LabelDatum, index: number): ResolvedLegendItem => {
		const itemKey = legendItemKey(label, index);
		const customEntry = customLabels[itemKey];
		const text = legendItemText(customEntry, label);
		const displayText = stripRichText(text);
		const seriesStyle = seriesStyles[itemKey] ?? seriesStyles[displayText];
		return {
			itemKey,
			label,
			customEntry,
			displayText,
			textRuns: parseRichText(text),
			marker: resolveLegendMarker(customEntry, safeDefaultShape, legendHideAllMarkers || legendIsLabelMode),
			markerFill: customEntry?.markerFill ?? legendMarkerFill,
			scaleColor: seriesStyle?.fill ?? (fill ? fill(label) : '#000'),
			shapeStyle: shapeStyle?.(label),
			opacity: getItemOpacity(itemKey),
			pattern: seriesStyle?.pattern,
		};
	};

	if (variation === 'detached') {
		return (
			<>
				{visibleLabels.map((label: LabelDatum, i: number) => {
					const item = resolveItem(label, i);

					return (
						<DetachedLegendItem
							key={`detached-legend-${item.itemKey}-${i}`}
							item={item}
							presentation={presentation}
							legendIsLabelMode={legendIsLabelMode}
							onLegendItemClick={onLegendItemClick}
							itemClickIsToggle={itemClickIsToggle}
							legendItemHandlers={legendItemHandlers}
						/>
					);
				})}
			</>
		);
	}

	// Grouped (default): existing flex container behavior, unchanged.
	return (
		<div style={{ display: 'flex', flexDirection: direction as any, flexWrap: 'wrap' }}>
			{visibleLabels.map((label: LabelDatum, i: number) => {
				const item = resolveItem(label, i);
				const { customEntry } = item;
				const activation = legendItemActivationProps({
					onLegendItemClick,
					itemKey: item.itemKey,
					displayText: item.displayText,
					opacity: item.opacity,
					hideMarker: item.marker.hidden,
					isToggle: itemClickIsToggle,
				});

				const groupedOutlineColor = customEntry?.textOutline
					? contrastLabelFillForLightDark(customEntry.color || '#000000')
					: undefined;

				const seriesColor = legendIsLabelMode ? item.scaleColor : undefined;

				const groupedItemStyle: React.CSSProperties | undefined =
					customEntry || legendIsLabelMode
						? {
								fontSize: customEntry?.fontSize ? `${customEntry.fontSize}px` : undefined,
								// Per-item color wins; otherwise inherit series color in label mode.
								color: customEntry?.color || seriesColor || undefined,
								fontWeight: customEntry?.fontWeight || undefined,
								fontStyle: customEntry?.fontStyle || undefined,
								fontFamily: customEntry?.fontFamily || undefined,
								maxWidth: customEntry?.maxWidth ? `${customEntry.maxWidth}px` : undefined,
								WebkitTextStroke: groupedOutlineColor ? `0.5px ${groupedOutlineColor}` : undefined,
								...getLegendParagraphStyles(customEntry),
							}
						: undefined;

				return (
					<div key={`legend-item-${item.itemKey}-${i}`} {...activation}>
						<LegendItem margin={perItemMargin} flexDirection={itemDirection as any} alignItems="center">
							<LegendItemContent item={item} presentation={presentation} labelStyle={groupedItemStyle} />
						</LegendItem>
					</div>
				);
			})}
		</div>
	);
}

export default ClickableLegend;
