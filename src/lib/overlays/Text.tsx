import type {
	AnnotationsConfig,
	BaseConfig,
	Layout,
	MetadataText,
	PanelLike,
	PanelRect,
	TableData,
	TextAnnotation,
} from '@prc/charting-utilities';
import {
	contrastLabelFillForLightDark,
	DataContext,
	DEFAULT_FONT_FAMILY,
	resolvePanelRect,
	wrapRichText,
} from '@prc/charting-utilities';
import { Group } from '@visx/group';
import { useContext, useEffect, useRef, useState } from 'react';
import type { DraggableData, DraggableEvent } from 'react-draggable';
import { DraggableCore } from 'react-draggable';
import { RichTextSpans } from '../primitives/RichText';
import {
	getPositioningScale,
	scalePositionToDisplay,
	scalePositionToLayout,
	type PositioningScale,
} from './getPositioningScale';

const dominantBaselineFromAnchor = (verticalAnchor?: string): 'middle' | 'hanging' | 'auto' => {
	if (verticalAnchor === 'middle') return 'middle';
	if (verticalAnchor === 'end') return 'hanging';
	return 'auto';
};

// SVG Annotation Component
export const Annotation = ({
	annotation,
	onClick,
	width,
	height,
	layout,
	/**
	 * When set (e.g. panel-anchored SM annotations), use shared scale helpers
	 * instead of width/layout.width. Origin should be 0 if a parent <g> already
	 * translated to the panel cell.
	 */
	positioningScale,
}: {
	annotation: TextAnnotation;
	onClick?: (id: string) => void;
	width: number;
	height: number;
	layout: Layout;
	chartWidth: number;
	positioningScale?: Pick<PositioningScale, 'widthRatio' | 'heightRatio' | 'originX' | 'originY'>;
}) => {
	const {
		id,
		x: originalX,
		y: originalY,
		text,
		fontSize = 14,
		fontWeight = 'normal',
		fontStyle = 'normal',
		fontFamily,
		fill = '#231F20',
		textAnchor = 'start',
		verticalAnchor = 'start',
		rotation = 0,
		link,
		opacity = 1,
		maxWidth = 200,
		textOutline = false,
	} = annotation;

	const context = useContext(
		DataContext as React.Context<{
			data: any;
			config: BaseConfig;
			tableData: TableData;
			wpEditorFunctions?: any;
		}>
	);
	const wpEditorFunctions = context?.wpEditorFunctions;
	const renderedFontFamily = fontFamily?.trim() ? fontFamily : DEFAULT_FONT_FAMILY;

	// Scale annotation coordinates: shared scale (panel) or classic width/layout ratio.
	const display = positioningScale
		? scalePositionToDisplay(originalX, originalY, positioningScale)
		: {
				x: (originalX * width) / layout.width,
				y: (originalY * height) / layout.height,
			};
	const displayX = display.x;
	const displayY = display.y;

	const toLayout = (dx: number, dy: number) => {
		if (positioningScale) {
			return scalePositionToLayout(dx, dy, positioningScale);
		}
		return {
			x: (dx * layout.width) / width,
			y: (dy * layout.height) / height,
		};
	};

	// Track position during drag (ref avoids stale deltas under rapid SM re-renders).
	const [dragPosition, setDragPosition] = useState({
		x: displayX,
		y: displayY,
	});
	const dragPositionRef = useRef(dragPosition);
	const isDraggingRef = useRef(false);
	// Ref to detect whether a drag occurred so we can suppress the post-drag click.
	// Not reset in handleDragStop — reset inside onClick so it's still true when
	// the click event fires after mouseup.
	const hasDraggedRef = useRef(false);
	// react-draggable needs an explicit nodeRef under React 19 (findDOMNode was removed).
	// Must point at the underlying <g>, so it's passed to <Group> via innerRef.
	const dragRef = useRef<SVGGElement>(null);

	// Sync from props when not dragging
	useEffect(() => {
		if (isDraggingRef.current) return;
		dragPositionRef.current = { x: displayX, y: displayY };
		setDragPosition({ x: displayX, y: displayY });
	}, [displayX, displayY]);

	// All hooks must be called before any conditional return (Rules of Hooks).

	// Handle drag events
	const handleDrag = (e: DraggableEvent, data: DraggableData) => {
		// Only set on actual pointer movement, not on mousedown, so plain clicks
		// are never flagged as drags.
		hasDraggedRef.current = true;

		const newDisplayX = dragPositionRef.current.x + data.deltaX;
		const newDisplayY = dragPositionRef.current.y + data.deltaY;
		const next = { x: newDisplayX, y: newDisplayY };
		dragPositionRef.current = next;
		setDragPosition(next);

		const layoutPos = toLayout(newDisplayX, newDisplayY);
		if (id && wpEditorFunctions?.annotations?.onDrag) {
			wpEditorFunctions.annotations.onDrag(id, layoutPos.x, layoutPos.y, true);
		}
	};

	const handleDragStart = () => {
		// Reset so a fresh click after a previous drag isn't suppressed.
		hasDraggedRef.current = false;
		isDraggingRef.current = true;
		if (id && wpEditorFunctions?.annotations?.onDragStart) {
			wpEditorFunctions.annotations.onDragStart(id);
		}
	};

	const handleDragStop = () => {
		const { x: finalDisplayX, y: finalDisplayY } = dragPositionRef.current;
		const layoutPos = toLayout(finalDisplayX, finalDisplayY);
		isDraggingRef.current = false;

		if (id && wpEditorFunctions?.annotations?.onDragEnd) {
			wpEditorFunctions.annotations.onDragEnd(id, layoutPos.x, layoutPos.y);
		}
	};

	const textLines = wrapRichText(text, maxWidth, fontSize, renderedFontFamily, fontWeight, fontStyle);
	const lineHeight = fontSize * 1.2;

	// Determine if draggable
	const isDraggable = !!wpEditorFunctions?.annotations && !link;

	// Use current drag position or original position
	const currentX = dragPosition.x;
	const currentY = dragPosition.y;

	let cursor = 'default';
	if (isDraggable) {
		cursor = 'grab';
	} else if (wpEditorFunctions?.annotations?.onClick || onClick || link) {
		cursor = 'pointer';
	}

	// Wrap in link if provided
	// Note: text is at 0,0 because Group is already translated
	const textElement = (
		<text
			x={0}
			y={0}
			fontSize={fontSize}
			fontFamily={renderedFontFamily}
			fontWeight={fontWeight}
			fontStyle={fontStyle}
			fill={fill}
			textAnchor={textAnchor}
			dominantBaseline={dominantBaselineFromAnchor(verticalAnchor)}
			{...(textOutline && {
				stroke: contrastLabelFillForLightDark(fill),
				strokeWidth: 1,
				paintOrder: 'stroke',
			})}
			style={{
				cursor,
				opacity,
				userSelect: 'none',
				pointerEvents: 'all',
			}}
			onClick={(event: React.MouseEvent<SVGTextElement>) => {
				if (hasDraggedRef.current) {
					hasDraggedRef.current = false;
					return;
				}
				if (wpEditorFunctions?.annotations?.onClick && id) {
					wpEditorFunctions.annotations.onClick(id, event.currentTarget);
					return;
				}
				if (onClick && id) onClick(id);
				if (link) window.open(link, '_blank');
			}}
		>
			{textLines.map((lineRuns, lineIndex) => (
				<tspan key={lineIndex} x={0} dy={lineIndex === 0 ? 0 : lineHeight}>
					<RichTextSpans runs={lineRuns} />
				</tspan>
			))}
		</text>
	);

	const groupContent = (
		<Group innerRef={dragRef} transform={`translate(${currentX}, ${currentY}) rotate(${rotation})`}>
			{textElement}
		</Group>
	);

	// Wrap with DraggableCore if in editor
	if (isDraggable) {
		return (
			<DraggableCore
				nodeRef={dragRef as unknown as React.RefObject<HTMLElement>}
				onDrag={handleDrag}
				onStart={handleDragStart}
				onStop={handleDragStop}
			>
				{groupContent}
			</DraggableCore>
		);
	}

	return groupContent;
};

// Annotations Layer Component
export const AnnotationsLayer = ({
	config,
	height,
	layout,
	chartWidth, // default to 640px
	onClick,
	panels,
	panelRects,
	designPanelRects,
	gridOffset,
	titlePad,
	leftInset,
	bottomInset,
}: {
	config: AnnotationsConfig;
	width: number;
	height: number;
	layout: Layout;
	chartWidth: number;
	onClick?: (id: string) => void;
	/** Small-multiples panels (for `panel` / `panel-inner`). */
	panels?: PanelLike[];
	panelRects?: PanelRect[];
	designPanelRects?: PanelRect[];
	gridOffset?: { x: number; y: number };
	titlePad?: number;
	leftInset?: number;
	bottomInset?: number;
}) => {
	if (!config.active || !config.items || config.items.length === 0) return null;

	// Calculate inner dimensions (accounting for padding)
	const horizPadding = layout.padding.left + layout.padding.right;
	const vertPadding = layout.padding.top + layout.padding.bottom;
	const innerWidth = chartWidth - horizPadding;
	const innerHeight = height - vertPadding;

	// Create adjusted layout with inner dimensions as reference
	const adjustedLayout = {
		...layout,
		width: layout.width - horizPadding,
		height: layout.height - vertPadding,
	};

	// First check if annotations have positioningContext set, if not, default to 'chart'
	const defaultPositioningContext = 'chart';
	const annotationsWithPositioningContext: TextAnnotation[] = config.items.map((annotation) => ({
		...annotation,
		positioningContext: annotation.positioningContext || defaultPositioningContext,
	}));

	// Split annotations into groups based on positioningContext
	const chartContextAnnotations = annotationsWithPositioningContext.filter(
		(annotation) => annotation.positioningContext === 'chart'
	);
	const innerContextAnnotations = annotationsWithPositioningContext.filter(
		(annotation) => annotation.positioningContext === 'inner'
	);
	const panelAnchoredAnnotations = annotationsWithPositioningContext.filter(
		(annotation) => annotation.positioningContext === 'panel' || annotation.positioningContext === 'panel-inner'
	);

	// Group panel-anchored items by panelKey for one translate origin per cell.
	const panelKeys = Array.from(
		new Set(
			panelAnchoredAnnotations
				.map((annotation) => annotation.panelKey)
				.filter((key): key is string => typeof key === 'string' && key.length > 0)
		)
	);

	const panelScaleBase = {
		layout,
		chartWidth,
		chartHeight: height,
		panels,
		panelRects,
		designPanelRects,
		gridOffset,
		titlePad,
		leftInset,
		bottomInset,
	};

	return (
		<g className="cb__annotations-layer">
			{/* Annotations positioned relative to full chart area */}
			{chartContextAnnotations.map((annotation) => (
				<Annotation
					key={annotation.id}
					annotation={annotation}
					onClick={onClick}
					width={chartWidth}
					height={height}
					layout={layout}
					chartWidth={chartWidth}
				/>
			))}

			{/* Annotations positioned relative to inner data area */}
			<g transform={`translate(${layout.padding.left}, ${layout.padding.top})`}>
				{innerContextAnnotations.map((annotation) => (
					<Annotation
						key={annotation.id}
						annotation={annotation}
						onClick={onClick}
						width={innerWidth}
						height={innerHeight}
						layout={adjustedLayout}
						chartWidth={chartWidth}
					/>
				))}
			</g>

			{/* Annotations positioned relative to a small-multiples panel cell or plot */}
			{panelKeys.flatMap((panelKey) => {
				if (
					!resolvePanelRect({
						panels,
						rects: panelRects,
						panelKey,
					})
				) {
					return [];
				}

				const contexts = ['panel', 'panel-inner'] as const;
				return contexts.flatMap((context) => {
					const items = panelAnchoredAnnotations.filter(
						(annotation) => annotation.panelKey === panelKey && annotation.positioningContext === context
					);
					if (!items.length) {
						return [];
					}
					const scale = getPositioningScale({
						...panelScaleBase,
						context,
						panelKey,
					});
					const localScale = { ...scale, originX: 0, originY: 0 };
					return (
						<g
							key={`panel-annotations-${panelKey}-${context}`}
							transform={`translate(${scale.originX}, ${scale.originY})`}
						>
							{items.map((annotation) => (
								<Annotation
									key={annotation.id}
									annotation={annotation}
									onClick={onClick}
									width={chartWidth}
									height={height}
									layout={layout}
									chartWidth={chartWidth}
									positioningScale={localScale}
								/>
							))}
						</g>
					);
				});
			})}
		</g>
	);
};

// Metadata Components (keeping backwards compatibility)
export const Title = (props: MetadataText) => {
	const { title } = props;
	if (!title) return <></>;
	return <div className="cb__title" dangerouslySetInnerHTML={{ __html: title }} />;
};

export const Subtitle = (props: MetadataText) => {
	const { subtitle } = props;
	if (!subtitle) return <></>;
	return <div className="cb__subtitle" dangerouslySetInnerHTML={{ __html: subtitle }} />;
};

export const SourceNote = (props: MetadataText) => {
	const { note } = props;
	if (!note) return <></>;
	return <div className="cb__note" dangerouslySetInnerHTML={{ __html: note }} />;
};

export const Tag = (props: MetadataText) => {
	const { tag } = props;
	if (!tag) return <></>;
	return <div className="cb__tag" dangerouslySetInnerHTML={{ __html: tag }} />;
};

export const getTextVisible = (layout: Layout, chartWidth: number, annotation: AnnotationsConfig) => {
	return annotation.active;
};
