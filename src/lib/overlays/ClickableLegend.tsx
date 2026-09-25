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
	decodeHtmlEntities,
	categoryKeyFromLegendDatum,
	type BaseConfig,
	type LegendItemCustomization,
	type LegendItemsController,
	type TableData,
} from '@prc/charting-utilities';
import { LegendItem, LegendLabel } from '@visx/legend';
import React, { useContext, useEffect, useRef, useState } from 'react';
import type { DraggableData, DraggableEvent } from 'react-draggable';
import { DraggableCore } from 'react-draggable';
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

function legendItemDisplayText(customEntry: LegendItemCustomization | undefined, label: LabelDatum): string {
	return decodeHtmlEntities(customEntry?.text || label.text || '');
}

const INVISIBLE_LEGEND_CHARS = /[\u200B\u200C\u200D\u2060\uFEFF]/g;

function legendItemHasAccessibleName(displayText: string): boolean {
	return displayText.replace(INVISIBLE_LEGEND_CHARS, '').trim() !== '';
}

// Hidden scale placeholders (no marker, zero-width label) stay in the legend
// domain but are not controls.
function legendItemIsPlaceholder(displayText: string, hideMarker: boolean): boolean {
	return hideMarker && !legendItemHasAccessibleName(displayText);
}

function isInvisibleLegendColor(color: string | undefined): boolean {
	if (color === undefined) {
		return true;
	}
	const normalized = color.trim().toLowerCase();
	return normalized === '' || normalized === 'transparent' || normalized === 'none';
}

function legendSwatchSeriesColor(
	scaleColor: string,
	customEntry: LegendItemCustomization | undefined,
	markerFill: 'solid' | 'outline'
): string {
	const customColor =
		customEntry?.color && !isInvisibleLegendColor(customEntry.color) ? customEntry.color : undefined;

	if (markerFill === 'outline') {
		return customColor ?? (isInvisibleLegendColor(scaleColor) ? 'light-dark(#565656, #a0a0a0)' : scaleColor);
	}

	if (customColor && isInvisibleLegendColor(scaleColor)) {
		return customColor;
	}

	return isInvisibleLegendColor(scaleColor) ? 'light-dark(#565656, #a0a0a0)' : scaleColor;
}

const OUTLINE_STROKE_WIDTH = 2;

// Renders an inline SVG swatch (rect/circle/line) sized to the given
// width/height with the requested fill style. Replaces visx's <LegendShape> —
// visx's ShapeRect is an HTML <div> with `background: <fill>`, which can't be
// outlined. By rendering true SVG primitives we get a real outline mode for
// all three shapes and full control over stroke sizing.
function LegendSwatch({
	shape,
	width,
	height,
	margin,
	seriesColor,
	markerFill = 'solid',
}: {
	shape: 'rect' | 'circle' | 'line';
	width: number;
	height: number;
	margin?: string;
	seriesColor: string;
	markerFill?: 'solid' | 'outline';
}) {
	if (width <= 0 || height <= 0) {
		return <span style={{ display: 'inline-block', width, height, margin }} />;
	}
	const isOutline = markerFill === 'outline';
	// SVG presentation attributes do not resolve `light-dark()`; inherit via CSS `color`.
	const swatchColor = isInvisibleLegendColor(seriesColor) ? 'light-dark(#565656, #a0a0a0)' : seriesColor;

	let element: React.ReactElement;
	if (shape === 'circle') {
		const cx = width / 2;
		const cy = height / 2;
		const r = isOutline
			? Math.max(0, Math.min(width, height) / 2 - OUTLINE_STROKE_WIDTH / 2)
			: Math.min(width, height) / 2;
		element = (
			<circle
				cx={cx}
				cy={cy}
				r={r}
				fill={isOutline ? 'none' : 'currentColor'}
				stroke={isOutline ? 'currentColor' : 'none'}
				strokeWidth={isOutline ? OUTLINE_STROKE_WIDTH : 0}
			/>
		);
	} else if (shape === 'line') {
		element = (
			<line
				x1={0}
				x2={width}
				y1={height / 2}
				y2={height / 2}
				stroke="currentColor"
				strokeWidth={OUTLINE_STROKE_WIDTH}
				strokeLinecap="round"
			/>
		);
	} else {
		const inset = isOutline ? OUTLINE_STROKE_WIDTH / 2 : 0;
		element = (
			<rect
				x={inset}
				y={inset}
				width={Math.max(0, width - inset * 2)}
				height={Math.max(0, height - inset * 2)}
				fill={isOutline ? 'none' : 'currentColor'}
				stroke={isOutline ? 'currentColor' : 'none'}
				strokeWidth={isOutline ? OUTLINE_STROKE_WIDTH : 0}
			/>
		);
	}

	return (
		<span
			style={{
				display: 'inline-flex',
				width,
				height,
				margin,
				flexShrink: 0,
				color: swatchColor,
			}}
		>
			<svg width={width} height={height} style={{ display: 'block' }}>
				{element}
			</svg>
		</span>
	);
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
	size?: (label: LabelDatum) => string;
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

function legendItemActivationProps(input: {
	onLegendItemClick?: LegendItemClickHandler;
	itemKey: string;
	displayText: string;
	opacity: number;
	hideMarker: boolean;
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
		'aria-pressed': clickable ? input.opacity < 1 : undefined,
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

// Render a single absolute-positioned detached legend item, with optional
// per-item drag wired to `wpEditorFunctions.legendItems.onItemDrag*`.
function DetachedLegendItem({
	itemKey,
	label,
	customEntry,
	defaultShape,
	legendHideAllMarkers,
	legendIsLabelMode,
	legendMarkerFill,
	defaultShapeWidth,
	defaultShapeHeight,
	defaultShapeMargin,
	fill,
	itemDirection,
	labelMargin,
	labelFlex,
	labelAlign,
	legendLabelProps,
	displayText,
	onLegendItemClick,
	itemOpacity,
	legendItemHandlers,
}: {
	itemKey: string;
	label: LabelDatum;
	customEntry: LegendItemCustomization | undefined;
	defaultShape: 'rect' | 'circle' | 'line';
	legendHideAllMarkers: boolean;
	legendIsLabelMode: boolean;
	legendMarkerFill: 'solid' | 'outline';
	defaultShapeWidth: number;
	defaultShapeHeight: number;
	defaultShapeMargin: string;
	fill?: (label: LabelDatum) => string;
	itemDirection: string;
	labelMargin: string;
	labelFlex: string;
	labelAlign: string;
	legendLabelProps: Record<string, any>;
	displayText: string;
	onLegendItemClick?: (key: string, text: string, el: EventTarget) => void;
	itemOpacity: number;
	legendItemHandlers?: {
		onItemDragStart?: (key: string) => void;
		onItemDrag?: (key: string, x: number, y: number) => void;
		onItemDragEnd?: (key: string, x: number, y: number) => void;
	};
}) {
	const legendScale = useContext(LegendScaleContext);
	const positioningContext: LegendPositioningContext = customEntry?.positioningContext ?? 'chart';
	const positioningScale = getLegendPositioningScale(positioningContext, legendScale);
	const layoutX = customEntry?.offsetX ?? 0;
	const layoutY = customEntry?.offsetY ?? 0;

	const isDraggable = !!legendItemHandlers?.onItemDragEnd;
	const [position, setPosition] = useState(() => scaleLegendPositionToDisplay(layoutX, layoutY, positioningScale));
	const [isDragging, setIsDragging] = useState(false);
	const isDraggingRef = useRef(false);
	// react-draggable needs an explicit nodeRef under React 19 (findDOMNode was removed).
	const dragRef = useRef<HTMLDivElement>(null);

	// Sync local position back to the attribute value when it changes externally
	// (e.g. editor edits DX/DY in the popover), but ignore during an active drag.
	useEffect(() => {
		if (isDraggingRef.current) return;
		const scale = getLegendPositioningScale(positioningContext, legendScale);
		setPosition(scaleLegendPositionToDisplay(layoutX, layoutY, scale));
	}, [layoutX, layoutY, positioningContext, legendScale]);

	const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
		// Suppress the click that fires immediately after a drag.
		if (isDraggingRef.current) {
			isDraggingRef.current = false;
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
		isDraggingRef.current = false; // reset so plain-click after a previous drag isn't suppressed
		setIsDragging(true);
		legendItemHandlers?.onItemDragStart?.(itemKey);
	};

	const handleDrag = (_e: DraggableEvent, data: DraggableData) => {
		// Only flip the ref on actual movement, so plain clicks aren't suppressed.
		isDraggingRef.current = true;
		const next = { x: position.x + data.deltaX, y: position.y + data.deltaY };
		setPosition(next);
		legendItemHandlers?.onItemDrag?.(itemKey, next.x, next.y);
	};

	const handleDragStop = () => {
		setIsDragging(false);
		const scale = getLegendPositioningScale(positioningContext, legendScale);
		const layoutPosition = scaleLegendPositionToLayout(position.x, position.y, scale);
		legendItemHandlers?.onItemDragEnd?.(itemKey, layoutPosition.x, layoutPosition.y);
	};

	const rawMarker = customEntry?.markerStyle;
	// Per-item 'none' → always hide. A specific shape → always show (overrides legend-level 'none'/'label').
	// No per-item override → inherit the legend-level hide flag (none or label mode).
	const hideMarker = rawMarker === 'none' || (rawMarker === undefined && (legendHideAllMarkers || legendIsLabelMode));
	const placeholder = legendItemIsPlaceholder(displayText, hideMarker);
	const interactive = Boolean(onLegendItemClick) && !placeholder;
	const itemShape = (rawMarker !== undefined && rawMarker !== 'none' ? rawMarker : defaultShape) as
		| 'rect'
		| 'circle'
		| 'line';

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
		flexDirection: itemDirection as any,
		alignItems: 'center',
		fontSize: customEntry?.fontSize ? `${customEntry.fontSize}px` : undefined,
		// In label mode the text IS the legend visual — color it with the series color,
		// unless the editor has set an explicit per-item color override.
		color: customEntry?.color || (legendIsLabelMode && fill ? fill(label) : undefined),
		fontWeight: customEntry?.fontWeight || undefined,
		fontStyle: customEntry?.fontStyle || undefined,
		fontFamily: customEntry?.fontFamily || undefined,
		maxWidth: customEntry?.maxWidth ? `${customEntry.maxWidth}px` : undefined,
		WebkitTextStroke: outlineColor ? `1px ${outlineColor}` : undefined,
		userSelect: 'none',
		pointerEvents: placeholder && !isDraggable ? 'none' : 'auto',
		cursor,
		opacity: itemOpacity,
	};

	const inner = (
		<div
			ref={dragRef}
			role={interactive ? 'button' : undefined}
			tabIndex={interactive ? 0 : undefined}
			aria-pressed={interactive ? itemOpacity < 1 : undefined}
			aria-hidden={placeholder ? true : undefined}
			onClick={interactive ? handleClick : undefined}
			onKeyDown={interactive ? handleKeyDown : undefined}
			style={itemStyle}
		>
			<LegendSwatch
				shape={itemShape}
				width={hideMarker ? 0 : defaultShapeWidth}
				height={hideMarker ? 0 : defaultShapeHeight}
				margin={hideMarker ? '0' : defaultShapeMargin}
				seriesColor={legendSwatchSeriesColor(
					fill ? fill(label) : '#000',
					customEntry,
					customEntry?.markerFill ?? legendMarkerFill
				)}
				markerFill={customEntry?.markerFill ?? legendMarkerFill}
			/>
			<LegendLabel
				label={displayText}
				flex={labelFlex}
				margin={labelMargin}
				align={labelAlign}
				{...legendLabelProps}
				style={{
					...legendLabelProps?.style,
					...getLegendParagraphStyles(customEntry),
				}}
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
	const onLegendItemClick = wpEditorFunctions?.legendItems?.onClick ?? context?.legendItems?.onClick;
	const getItemOpacity = context?.legendItems?.getItemOpacity ?? (() => 1);
	const legendItemHandlers = wpEditorFunctions?.legendItems;
	const customLabels: Record<string, LegendItemCustomization> = context?.config?.legend?.customLabels ?? {};
	const variation = context?.config?.legend?.variation ?? 'grouped';

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

	// Filter phantom labels produced by threshold scales when
	// the color palette has more entries than the scale needs.
	const visibleLabels = labels.filter(
		(label: LabelDatum) => label.text !== '' || (label.value !== null && label.value !== undefined)
	);

	if (variation === 'detached') {
		return (
			<>
				{visibleLabels.map((label: LabelDatum, i: number) => {
					const itemKey = legendItemKey(label, i);
					const customEntry = customLabels[itemKey];
					const displayText = legendItemDisplayText(customEntry, label);

					return (
						<DetachedLegendItem
							key={`detached-legend-${itemKey}-${i}`}
							itemKey={itemKey}
							label={label}
							customEntry={customEntry}
							defaultShape={safeDefaultShape}
							legendHideAllMarkers={legendHideAllMarkers}
							legendIsLabelMode={legendIsLabelMode}
							legendMarkerFill={legendMarkerFill}
							defaultShapeWidth={shapeWidth}
							defaultShapeHeight={shapeHeight}
							defaultShapeMargin={shapeMargin}
							fill={fill}
							itemDirection={itemDirection}
							labelMargin={labelMargin}
							labelFlex={labelFlex}
							labelAlign={labelAlign}
							legendLabelProps={legendLabelProps}
							displayText={displayText}
							onLegendItemClick={onLegendItemClick}
							itemOpacity={getItemOpacity(itemKey)}
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
				const itemKey = legendItemKey(label, i);

				const customEntry = customLabels[itemKey];
				const displayText = legendItemDisplayText(customEntry, label);
				const hideMarker = legendHideAllMarkers || legendIsLabelMode || customEntry?.markerStyle === 'none';
				const activation = legendItemActivationProps({
					onLegendItemClick,
					itemKey,
					displayText,
					opacity: getItemOpacity(itemKey),
					hideMarker,
				});

				const groupedOutlineColor = customEntry?.textOutline
					? contrastLabelFillForLightDark(customEntry.color || '#000000')
					: undefined;

				const seriesColor = legendIsLabelMode && fill ? fill(label) : undefined;

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

				const effectiveFill: 'solid' | 'outline' = customEntry?.markerFill ?? legendMarkerFill;
				const scaleColor = fill ? fill(label) : '#000';

				return (
					<div key={`legend-item-${itemKey}-${i}`} {...activation}>
						<LegendItem margin={perItemMargin} flexDirection={itemDirection as any} alignItems="center">
							<LegendSwatch
								shape={safeDefaultShape}
								width={hideMarker ? 0 : shapeWidth}
								height={hideMarker ? 0 : shapeHeight}
								margin={hideMarker ? '0' : shapeMargin}
								seriesColor={legendSwatchSeriesColor(scaleColor, customEntry, effectiveFill)}
								markerFill={effectiveFill}
							/>
							<LegendLabel
								label={displayText}
								flex={labelFlex}
								margin={labelMargin}
								align={labelAlign}
								{...legendLabelProps}
								style={{
									...legendLabelProps?.style,
									...groupedItemStyle,
								}}
							/>
						</LegendItem>
					</div>
				);
			})}
		</div>
	);
}

export default ClickableLegend;
