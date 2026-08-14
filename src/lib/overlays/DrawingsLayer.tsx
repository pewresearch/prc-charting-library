/**
 * DrawingsLayer Component
 *
 * Renders user-drawn SVG shapes on top of charts.
 * Supports lines, arrows, lollipops, circles, rectangles, and freehand paths.
 * Uses the same responsive scaling approach as AnnotationsLayer.
 */

import type {
	Layout,
	Drawing,
	DrawingsConfig,
	LineDrawing,
	ArrowDrawing,
	LollipopDrawing,
	CircleDrawing,
	RectDrawing,
	PathDrawing,
	Breakpoint,
	PanelLike,
	PanelRect,
} from '@prc/charting-utilities';
import { DataContext, resolvePanelRect } from '@prc/charting-utilities';
import { useContext, useEffect, useRef, useState } from 'react';
import type { DraggableData, DraggableEvent } from 'react-draggable';
import { DraggableCore } from 'react-draggable';
import { DrawingSelectionHandles } from './DrawingSelectionHandles';
import { getPositioningScale, type PositioningScale } from './getPositioningScale';

// Re-export types for consumers
export type {
	Drawing,
	DrawingsConfig,
	LineDrawing,
	ArrowDrawing,
	LollipopDrawing,
	CircleDrawing,
	RectDrawing,
	PathDrawing,
};

// Props for individual drawing components
interface DrawingProps {
	drawing: Drawing;
	width: number;
	height: number;
	layout: Layout;
	/** When true, enable pointer hit-testing for editor drag. */
	interactive?: boolean;
}

/**
 * Scale a coordinate from reference layout dimensions to current dimensions
 */
function scaleX(value: number, width: number, layoutWidth: number): number {
	return (value * width) / layoutWidth;
}

function scaleY(value: number, height: number, layoutHeight: number): number {
	return (value * height) / layoutHeight;
}

/**
 * Arrow marker component using SVG <marker> element.
 * See: https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Element/marker
 */
function ArrowMarker({ id, color }: { id: string; color: string }) {
	return (
		<marker
			id={id}
			viewBox="0 0 10 10"
			refX="9"
			refY="5"
			markerWidth="6"
			markerHeight="6"
			orient="auto-start-reverse"
		>
			<path d="M 0 0 L 10 5 L 0 10 z" fill={color} />
		</marker>
	);
}

/**
 * Lollipop marker component (circle at end of line)
 */
function LollipopMarker({ id, color, radius }: { id: string; color: string; radius: number }) {
	return (
		<marker
			id={id}
			viewBox="-10 -10 20 20"
			refX="0"
			refY="0"
			markerWidth={radius * 2}
			markerHeight={radius * 2}
			orient="auto"
		>
			<circle cx="0" cy="0" r="6" fill={color} />
		</marker>
	);
}

/**
 * Build a path string for a line with optional curve or breakpoints.
 */
function buildLinePath(
	x1: number,
	y1: number,
	x2: number,
	y2: number,
	options: {
		lineMode?: string;
		bendX?: number;
		bendY?: number;
		breakpoints?: Array<{ x: number; y: number }>;
		scaleXFn: (v: number) => number;
		scaleYFn: (v: number) => number;
	}
): string {
	const { lineMode, bendX, bendY, breakpoints, scaleXFn, scaleYFn } = options;

	// Angled mode with breakpoints
	if (lineMode === 'angled' && breakpoints && breakpoints.length > 0) {
		const scaledBreakpoints = breakpoints.map((bp) => ({
			x: scaleXFn(bp.x),
			y: scaleYFn(bp.y),
		}));
		let path = `M ${x1} ${y1}`;
		for (const bp of scaledBreakpoints) {
			path += ` L ${bp.x} ${bp.y}`;
		}
		path += ` L ${x2} ${y2}`;
		return path;
	}

	// Curved mode with bend point
	if (lineMode === 'curved' && bendX !== undefined && bendY !== undefined) {
		const scaledBendX = scaleXFn(bendX);
		const scaledBendY = scaleYFn(bendY);
		return `M ${x1} ${y1} Q ${scaledBendX} ${scaledBendY} ${x2} ${y2}`;
	}

	// Default: straight line
	return `M ${x1} ${y1} L ${x2} ${y2}`;
}

/**
 * Scale path data (d attribute) from reference to current dimensions
 */
function scalePath(d: string, width: number, height: number, layoutWidth: number, layoutHeight: number): string {
	return d.replace(/([ML])\s*([\d.-]+)\s+([\d.-]+)/gi, (match, command, x, y) => {
		const scaledX = scaleX(parseFloat(x), width, layoutWidth);
		const scaledY = scaleY(parseFloat(y), height, layoutHeight);
		return `${command} ${scaledX} ${scaledY}`;
	});
}

/**
 * Render a single drawing element
 */
const DrawingElement = ({ drawing, width, height, layout, interactive = false }: DrawingProps) => {
	const { stroke, strokeWidth, strokeDasharray, fill = 'none', opacity = 1, fillOpacity } = drawing;
	const pointerEvents = interactive ? ('all' as const) : ('none' as const);

	const commonProps = {
		stroke,
		strokeWidth,
		strokeDasharray,
		strokeLinecap: 'round' as const,
		fill,
		opacity,
		fillOpacity,
		pointerEvents,
	};

	const scaleXFn = (v: number) => scaleX(v, width, layout.width);
	const scaleYFn = (v: number) => scaleY(v, height, layout.height);

	switch (drawing.type) {
		case 'line': {
			const x1 = scaleXFn(drawing.x1);
			const y1 = scaleYFn(drawing.y1);
			const x2 = scaleXFn(drawing.x2);
			const y2 = scaleYFn(drawing.y2);

			const linePath = buildLinePath(x1, y1, x2, y2, {
				lineMode: drawing.lineMode,
				bendX: drawing.bendX,
				bendY: drawing.bendY,
				breakpoints: drawing.breakpoints,
				scaleXFn,
				scaleYFn,
			});

			return (
				<>
					{interactive && (
						<path
							d={linePath}
							stroke="transparent"
							strokeWidth={Math.max(strokeWidth || 1, 12)}
							fill="none"
							pointerEvents="stroke"
						/>
					)}
					<path d={linePath} {...commonProps} />
				</>
			);
		}

		case 'arrow': {
			const x1 = scaleXFn(drawing.x1);
			const y1 = scaleYFn(drawing.y1);
			const x2 = scaleXFn(drawing.x2);
			const y2 = scaleYFn(drawing.y2);
			const markerId = `arrow-marker-${drawing.id}`;

			const linePath = buildLinePath(x1, y1, x2, y2, {
				lineMode: drawing.lineMode,
				bendX: drawing.bendX,
				bendY: drawing.bendY,
				breakpoints: drawing.breakpoints,
				scaleXFn,
				scaleYFn,
			});

			return (
				<>
					<defs>
						<ArrowMarker id={markerId} color={stroke} />
					</defs>
					{interactive && (
						<path
							d={linePath}
							stroke="transparent"
							strokeWidth={Math.max(strokeWidth || 1, 12)}
							fill="none"
							pointerEvents="stroke"
						/>
					)}
					<path
						d={linePath}
						stroke={stroke}
						strokeWidth={strokeWidth}
						strokeDasharray={strokeDasharray}
						strokeLinecap="round"
						fill="none"
						opacity={opacity}
						markerEnd={`url(#${markerId})`}
						pointerEvents={pointerEvents}
					/>
				</>
			);
		}

		case 'lollipop': {
			const x1 = scaleXFn(drawing.x1);
			const y1 = scaleYFn(drawing.y1);
			const x2 = scaleXFn(drawing.x2);
			const y2 = scaleYFn(drawing.y2);
			const markerId = `lollipop-marker-${drawing.id}`;
			const dotRadius = drawing.dotRadius || 6;

			const linePath = buildLinePath(x1, y1, x2, y2, {
				lineMode: drawing.lineMode,
				bendX: drawing.bendX,
				bendY: drawing.bendY,
				breakpoints: drawing.breakpoints,
				scaleXFn,
				scaleYFn,
			});

			return (
				<>
					<defs>
						<LollipopMarker id={markerId} color={stroke} radius={dotRadius} />
					</defs>
					{interactive && (
						<path
							d={linePath}
							stroke="transparent"
							strokeWidth={Math.max(strokeWidth || 1, 12)}
							fill="none"
							pointerEvents="stroke"
						/>
					)}
					<path
						d={linePath}
						stroke={stroke}
						strokeWidth={strokeWidth}
						strokeDasharray={strokeDasharray}
						strokeLinecap="round"
						fill="none"
						opacity={opacity}
						markerEnd={`url(#${markerId})`}
						pointerEvents={pointerEvents}
					/>
				</>
			);
		}

		case 'circle': {
			const cx = scaleXFn(drawing.cx);
			const cy = scaleYFn(drawing.cy);
			const scaleFactorX = width / layout.width;
			const scaleFactorY = height / layout.height;
			const avgScale = (scaleFactorX + scaleFactorY) / 2;
			const r = drawing.r * avgScale;

			return <circle cx={cx} cy={cy} r={r} {...commonProps} />;
		}

		case 'rect': {
			const x = scaleXFn(drawing.x);
			const y = scaleYFn(drawing.y);
			const rectWidth = scaleXFn(drawing.width);
			const rectHeight = scaleYFn(drawing.height);
			const rx = drawing.rx || 0;

			return <rect x={x} y={y} width={rectWidth} height={rectHeight} rx={rx} {...commonProps} />;
		}

		case 'path': {
			const scaledD = scalePath(drawing.d, width, height, layout.width, layout.height);

			return <path d={scaledD} {...commonProps} />;
		}

		default:
			return null;
	}
};

type DrawingsEditorApi = {
	selectedDrawingId?: string | null;
	useInChartSelectionHandles?: boolean;
	getDrawings?: () => Drawing[];
	onDrawingsChange?: (drawings: Drawing[]) => void;
	onDeleteDrawing?: (drawingId: string) => void;
	onDragStart?: (drawingId: string) => void;
	onDrag?: (drawingId: string, displayDx: number, displayDy: number) => void;
	onDragEnd?: (drawingId: string, layoutDx: number, layoutDy: number) => void;
	onSelectionDragEnd?: () => void;
	onClick?: (drawingId: string, anchorEl: Element) => void;
	manipulation?: Record<string, unknown>;
};

const DrawingWithHandles = ({
	drawing,
	width,
	height,
	layout,
	positioningScale,
}: DrawingProps & {
	positioningScale?: Pick<PositioningScale, 'widthRatio' | 'heightRatio'>;
}) => {
	const dataContext = useContext(DataContext) as {
		wpEditorFunctions?: { drawings?: DrawingsEditorApi };
	} | null;
	const drawingsApi = dataContext?.wpEditorFunctions?.drawings;
	const showHandles =
		Boolean(drawingsApi?.useInChartSelectionHandles) && drawingsApi?.selectedDrawingId === drawing.id;

	return (
		<g className="cb__drawing-with-handles" style={{ pointerEvents: 'all' }}>
			<InteractiveDrawing
				drawing={drawing}
				width={width}
				height={height}
				layout={layout}
				positioningScale={positioningScale}
			/>
			{showHandles && <DrawingSelectionHandles drawing={drawing} width={width} height={height} layout={layout} />}
		</g>
	);
};

/**
 * Editor-draggable wrapper (annotation pattern): translate in display space while
 * dragging, persist layout-space deltas via wpEditorFunctions.drawings.
 */
const InteractiveDrawing = ({
	drawing,
	width,
	height,
	layout,
	positioningScale,
}: DrawingProps & {
	positioningScale?: Pick<PositioningScale, 'widthRatio' | 'heightRatio'>;
}) => {
	const dataContext = useContext(DataContext) as {
		wpEditorFunctions?: { drawings?: DrawingsEditorApi };
	} | null;
	const drawingsApi = dataContext?.wpEditorFunctions?.drawings;
	const isSelected = drawingsApi?.selectedDrawingId === drawing.id;
	const isDraggable = !!drawingsApi?.onDragEnd && !isSelected;

	const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
	const dragOffsetRef = useRef(dragOffset);
	const isDraggingRef = useRef(false);
	const hasDraggedRef = useRef(false);
	const dragRef = useRef<SVGGElement>(null);

	useEffect(() => {
		if (isDraggingRef.current) {
			return;
		}
		dragOffsetRef.current = { x: 0, y: 0 };
		setDragOffset({ x: 0, y: 0 });
	}, [drawing]);

	const toLayoutDelta = (dx: number, dy: number) => {
		if (positioningScale) {
			return {
				x: positioningScale.widthRatio ? dx / positioningScale.widthRatio : dx,
				y: positioningScale.heightRatio ? dy / positioningScale.heightRatio : dy,
			};
		}
		return {
			x: width ? (dx * layout.width) / width : dx,
			y: height ? (dy * layout.height) / height : dy,
		};
	};

	if (!isDraggable) {
		return <DrawingElement drawing={drawing} width={width} height={height} layout={layout} />;
	}

	const handleDrag = (_event: DraggableEvent, data: DraggableData) => {
		hasDraggedRef.current = true;
		const next = {
			x: dragOffsetRef.current.x + data.deltaX,
			y: dragOffsetRef.current.y + data.deltaY,
		};
		dragOffsetRef.current = next;
		setDragOffset(next);
		drawingsApi?.onDrag?.(drawing.id, next.x, next.y);
	};

	const handleDragStart = () => {
		hasDraggedRef.current = false;
		isDraggingRef.current = true;
		drawingsApi?.onDragStart?.(drawing.id);
	};

	const handleDragStop = () => {
		const { x: displayDx, y: displayDy } = dragOffsetRef.current;
		const layoutDelta = toLayoutDelta(displayDx, displayDy);
		isDraggingRef.current = false;
		drawingsApi?.onDragEnd?.(drawing.id, layoutDelta.x, layoutDelta.y);
		// Visual offset resets when props update; clear immediately to avoid double-offset
		// if the attribute write is slow.
		dragOffsetRef.current = { x: 0, y: 0 };
		setDragOffset({ x: 0, y: 0 });
	};

	const group = (
		<g
			ref={dragRef}
			transform={`translate(${dragOffset.x}, ${dragOffset.y})`}
			style={{ cursor: 'grab', pointerEvents: 'all' }}
			onClick={(event) => {
				if (hasDraggedRef.current) {
					hasDraggedRef.current = false;
					return;
				}
				drawingsApi?.onClick?.(drawing.id, event.currentTarget);
			}}
		>
			<DrawingElement drawing={drawing} width={width} height={height} layout={layout} interactive />
		</g>
	);

	return (
		<DraggableCore
			nodeRef={dragRef as unknown as React.RefObject<HTMLElement>}
			onDrag={handleDrag}
			onStart={handleDragStart}
			onStop={handleDragStop}
		>
			{group}
		</DraggableCore>
	);
};

/**
 * DrawingsLayer Component
 *
 * Renders all drawings with proper responsive scaling.
 * Follows the same pattern as AnnotationsLayer.
 * In the editor, drawings are draggable via wpEditorFunctions.drawings (annotation pattern).
 */
export const DrawingsLayer = ({
	config,
	width,
	height,
	layout,
	chartWidth,
	panels,
	panelRects,
	designPanelRects,
	gridOffset,
	titlePad,
	leftInset,
	bottomInset,
}: {
	config: DrawingsConfig;
	width: number;
	height: number;
	layout: Layout;
	chartWidth: number;
	panels?: PanelLike[];
	panelRects?: PanelRect[];
	designPanelRects?: PanelRect[];
	gridOffset?: { x: number; y: number };
	titlePad?: number;
	leftInset?: number;
	bottomInset?: number;
}) => {
	if (!config?.active || !config?.items || config.items.length === 0) {
		return null;
	}

	const horizPadding = layout.padding.left + layout.padding.right;
	const vertPadding = layout.padding.top + layout.padding.bottom;
	const innerWidth = chartWidth - horizPadding;
	const innerHeight = height - vertPadding;

	const adjustedLayout = {
		...layout,
		width: layout.width - horizPadding,
		height: layout.height - vertPadding,
	};

	const defaultPositioningContext = 'inner';
	const drawingsWithContext = config.items.map((drawing) => ({
		...drawing,
		positioningContext: drawing.positioningContext || defaultPositioningContext,
	}));

	const chartContextDrawings = drawingsWithContext.filter((drawing) => drawing.positioningContext === 'chart');
	const innerContextDrawings = drawingsWithContext.filter((drawing) => drawing.positioningContext === 'inner');
	const panelAnchoredDrawings = drawingsWithContext.filter(
		(drawing) => drawing.positioningContext === 'panel' || drawing.positioningContext === 'panel-inner'
	);
	const panelKeys = Array.from(
		new Set(
			panelAnchoredDrawings
				.map((drawing) => drawing.panelKey)
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

	const chartScale: Pick<PositioningScale, 'widthRatio' | 'heightRatio'> = {
		widthRatio: layout.width ? chartWidth / layout.width : 1,
		heightRatio: layout.height ? height / layout.height : 1,
	};
	const innerScale: Pick<PositioningScale, 'widthRatio' | 'heightRatio'> = {
		widthRatio: adjustedLayout.width ? innerWidth / adjustedLayout.width : 1,
		heightRatio: adjustedLayout.height ? innerHeight / adjustedLayout.height : 1,
	};

	return (
		<g className="cb__drawings-layer">
			{chartContextDrawings.map((drawing) => (
				<DrawingWithHandles
					key={drawing.id}
					drawing={drawing}
					width={chartWidth}
					height={height}
					layout={layout}
					positioningScale={chartScale}
				/>
			))}

			<g transform={`translate(${layout.padding.left}, ${layout.padding.top})`}>
				{innerContextDrawings.map((drawing) => (
					<DrawingWithHandles
						key={drawing.id}
						drawing={drawing}
						width={innerWidth}
						height={innerHeight}
						layout={adjustedLayout}
						positioningScale={innerScale}
					/>
				))}
			</g>

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
					const items = panelAnchoredDrawings.filter(
						(drawing) => drawing.panelKey === panelKey && drawing.positioningContext === context
					);
					if (!items.length) {
						return [];
					}
					const scale = getPositioningScale({
						...panelScaleBase,
						context,
						panelKey,
					});
					const panelLayout = {
						...layout,
						width: scale.refWidth,
						height: scale.refHeight,
					};
					return (
						<g
							key={`panel-drawings-${panelKey}-${context}`}
							transform={`translate(${scale.originX}, ${scale.originY})`}
						>
							{items.map((drawing) => (
								<DrawingWithHandles
									key={drawing.id}
									drawing={drawing}
									width={scale.displayWidth}
									height={scale.displayHeight}
									layout={panelLayout}
									positioningScale={scale}
								/>
							))}
						</g>
					);
				});
			})}
		</g>
	);
};

export default DrawingsLayer;
