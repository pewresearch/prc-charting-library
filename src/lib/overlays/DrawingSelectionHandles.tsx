import { useContext, useRef, useState } from 'react';
import type { Drawing, LineDrawing, ArrowDrawing, LollipopDrawing } from '@prc/charting-utilities';
import { DataContext } from '@prc/charting-utilities';

type LineLikeDrawing = LineDrawing | ArrowDrawing | LollipopDrawing;

function isLineLikeDrawing(drawing: Drawing): drawing is LineLikeDrawing {
	return drawing.type === 'line' || drawing.type === 'arrow' || drawing.type === 'lollipop';
}

type DrawingManipulation = {
	translateDrawing: (drawing: Drawing, dx: number, dy: number) => Drawing;
	moveLineEndpoint: (drawing: Drawing, endpoint: 'start' | 'end', x: number, y: number) => Drawing;
	moveBend: (drawing: Drawing, x: number, y: number) => Drawing;
	moveBreakpoint: (drawing: Drawing, idx: number, x: number, y: number) => Drawing;
	removeBreakpoint: (drawing: Drawing, idx: number) => Drawing;
	resizeDrawing: (drawing: Drawing, corner: string, x: number, y: number) => Drawing;
	isLineTypeDrawing: (drawing: Drawing) => boolean;
	getDrawingBounds: (drawing: Drawing) => {
		x: number;
		y: number;
		width: number;
		height: number;
	};
};

type DrawingsEditorApi = {
	selectedDrawingId?: string | null;
	useInChartSelectionHandles?: boolean;
	getDrawings?: () => Drawing[];
	onDrawingsChange?: (drawings: Drawing[]) => void;
	onDeleteDrawing?: (drawingId: string) => void;
	onDragStart?: (drawingId: string) => void;
	onSelectionDragEnd?: () => void;
	manipulation?: DrawingManipulation;
};

type DrawingSelectionHandlesProps = {
	drawing: Drawing;
	width: number;
	height: number;
	layout: { width: number; height: number };
};

function toDisplay(x: number, y: number, width: number, height: number, layout: { width: number; height: number }) {
	return {
		x: layout.width ? (x * width) / layout.width : x,
		y: layout.height ? (y * height) / layout.height : y,
	};
}

function toLayout(x: number, y: number, width: number, height: number, layout: { width: number; height: number }) {
	return {
		x: width ? (x * layout.width) / width : x,
		y: height ? (y * layout.height) / height : y,
	};
}

function getLocalPoint(event: React.PointerEvent, svg: SVGSVGElement | null, group: SVGGElement | null) {
	if (!svg || !group) {
		return null;
	}
	const point = svg.createSVGPoint();
	point.x = event.clientX;
	point.y = event.clientY;
	const matrix = group.getScreenCTM()?.inverse();
	if (!matrix) {
		return null;
	}
	const local = point.matrixTransform(matrix);
	return { x: local.x, y: local.y };
}

/**
 * In-chart selection handles for small multiples (and any chart using
 * useInChartSelectionHandles). Renders in the same coordinate space as
 * DrawingsLayer so handles align with panel-anchored drawings.
 */
export function DrawingSelectionHandles({ drawing, width, height, layout }: DrawingSelectionHandlesProps) {
	const dataContext = useContext(DataContext) as {
		wpEditorFunctions?: { drawings?: DrawingsEditorApi };
	} | null;
	const api = dataContext?.wpEditorFunctions?.drawings;
	const manipulation = api?.manipulation;
	const groupRef = useRef<SVGGElement>(null);
	const [dragState, setDragState] = useState<{
		type: string;
		endpoint?: 'start' | 'end';
		corner?: string;
		breakpointIdx?: number;
	} | null>(null);

	if (!api?.useInChartSelectionHandles || !manipulation || !api.onDrawingsChange) {
		return null;
	}

	const scalePoint = (x: number, y: number) => toDisplay(x, y, width, height, layout);

	const updateSelected = (updater: (current: Drawing) => Drawing) => {
		const items = api.getDrawings?.() || [];
		const current = items.find((item) => item.id === drawing.id) || drawing;
		const next = updater(current);
		api.onDrawingsChange?.(items.map((item) => (item.id === drawing.id ? next : item)));
	};

	const handlePointerDown =
		(type: string, extra: Record<string, unknown> = {}) =>
		(event: React.PointerEvent) => {
			event.stopPropagation();
			event.preventDefault();
			api.onDragStart?.(drawing.id);
			setDragState({ type, ...extra });
			(event.currentTarget as Element).setPointerCapture(event.pointerId);
		};

	const handlePointerMove = (event: React.PointerEvent) => {
		if (!dragState) {
			return;
		}
		const svg = groupRef.current?.ownerSVGElement || null;
		const local = getLocalPoint(event, svg, groupRef.current);
		if (!local) {
			return;
		}
		const layoutPoint = toLayout(local.x, local.y, width, height, layout);

		updateSelected((current) => {
			if (dragState.type === 'endpoint') {
				return manipulation.moveLineEndpoint(
					current,
					dragState.endpoint || 'start',
					layoutPoint.x,
					layoutPoint.y
				);
			}
			if (dragState.type === 'bend') {
				return manipulation.moveBend(current, layoutPoint.x, layoutPoint.y);
			}
			if (dragState.type === 'breakpoint') {
				return manipulation.moveBreakpoint(current, dragState.breakpointIdx ?? 0, layoutPoint.x, layoutPoint.y);
			}
			if (dragState.type === 'resize') {
				return manipulation.resizeDrawing(current, dragState.corner || 'se', layoutPoint.x, layoutPoint.y);
			}
			return current;
		});
	};

	const handlePointerUp = (event: React.PointerEvent) => {
		if (dragState) {
			(event.currentTarget as Element).releasePointerCapture(event.pointerId);
			setDragState(null);
			api.onSelectionDragEnd?.();
		}
	};

	const isLine = manipulation.isLineTypeDrawing(drawing);
	if (isLine && isLineLikeDrawing(drawing)) {
		const start = scalePoint(drawing.x1, drawing.y1);
		const end = scalePoint(drawing.x2, drawing.y2);
		const isAngled =
			drawing.lineMode === 'angled' && Array.isArray(drawing.breakpoints) && drawing.breakpoints.length > 0;
		const isCurved = drawing.lineMode === 'curved' || (drawing.bendX !== undefined && drawing.bendY !== undefined);
		const bendX = drawing.bendX !== undefined ? drawing.bendX : (drawing.x1 + drawing.x2) / 2;
		const bendY = drawing.bendY !== undefined ? drawing.bendY : (drawing.y1 + drawing.y2) / 2;
		const bend = isCurved ? scalePoint(bendX, bendY) : null;
		const breakpoints =
			isAngled && drawing.breakpoints ? drawing.breakpoints.map((bp) => scalePoint(bp.x, bp.y)) : [];

		return (
			<g
				ref={groupRef}
				className="cb__drawing-selection-handles"
				style={{ pointerEvents: 'all' }}
				onPointerMove={handlePointerMove}
				onPointerUp={handlePointerUp}
			>
				<circle
					cx={start.x}
					cy={start.y}
					r={5}
					fill="#0073aa"
					stroke="#fff"
					strokeWidth={2}
					style={{ cursor: 'move', pointerEvents: 'all' }}
					onPointerDown={handlePointerDown('endpoint', { endpoint: 'start' })}
				/>
				<circle
					cx={end.x}
					cy={end.y}
					r={5}
					fill="#0073aa"
					stroke="#fff"
					strokeWidth={2}
					style={{ cursor: 'move', pointerEvents: 'all' }}
					onPointerDown={handlePointerDown('endpoint', { endpoint: 'end' })}
				/>
				{isCurved && bend && (
					<circle
						cx={bend.x}
						cy={bend.y}
						r={5}
						fill="#10b981"
						stroke="#fff"
						strokeWidth={2}
						style={{ cursor: 'move', pointerEvents: 'all' }}
						onPointerDown={handlePointerDown('bend')}
					/>
				)}
				{isAngled &&
					breakpoints.map((bp, idx) => (
						<circle
							key={`bp-${idx}`}
							cx={bp.x}
							cy={bp.y}
							r={5}
							fill="#f59e0b"
							stroke="#fff"
							strokeWidth={2}
							style={{ cursor: 'move', pointerEvents: 'all' }}
							onPointerDown={handlePointerDown('breakpoint', {
								breakpointIdx: idx,
							})}
							onDoubleClick={(event) => {
								event.stopPropagation();
								updateSelected((current) => manipulation.removeBreakpoint(current, idx));
							}}
						/>
					))}
				<g
					transform={`translate(${(start.x + end.x) / 2 + 15}, ${(start.y + end.y) / 2 - 15})`}
					style={{ cursor: 'pointer', pointerEvents: 'all' }}
					onClick={(event) => {
						event.stopPropagation();
						api.onDeleteDrawing?.(drawing.id);
					}}
				>
					<circle cx={0} cy={0} r={10} fill="#d63638" />
					<text x={0} y={4} textAnchor="middle" fill="#fff" fontSize={14} fontWeight="bold">
						×
					</text>
				</g>
			</g>
		);
	}

	const bounds = manipulation.getDrawingBounds(drawing);
	const topLeft = scalePoint(bounds.x, bounds.y);
	const bottomRight = scalePoint(bounds.x + bounds.width, bounds.y + bounds.height);
	const outerBounds = {
		x: topLeft.x - 4,
		y: topLeft.y - 4,
		width: bottomRight.x - topLeft.x + 8,
		height: bottomRight.y - topLeft.y + 8,
	};
	const handleSize = 8;
	const corners = [
		{ id: 'nw', x: outerBounds.x, y: outerBounds.y, cursor: 'nwse-resize' },
		{
			id: 'ne',
			x: outerBounds.x + outerBounds.width,
			y: outerBounds.y,
			cursor: 'nesw-resize',
		},
		{
			id: 'sw',
			x: outerBounds.x,
			y: outerBounds.y + outerBounds.height,
			cursor: 'nesw-resize',
		},
		{
			id: 'se',
			x: outerBounds.x + outerBounds.width,
			y: outerBounds.y + outerBounds.height,
			cursor: 'nwse-resize',
		},
	];

	return (
		<g
			ref={groupRef}
			className="cb__drawing-selection-handles"
			style={{ pointerEvents: 'all' }}
			onPointerMove={handlePointerMove}
			onPointerUp={handlePointerUp}
		>
			<rect
				x={outerBounds.x}
				y={outerBounds.y}
				width={outerBounds.width}
				height={outerBounds.height}
				fill="none"
				stroke="#0073aa"
				strokeWidth={1}
				strokeDasharray="4 2"
				pointerEvents="none"
			/>
			{corners.map((corner) => (
				<rect
					key={corner.id}
					x={corner.x - handleSize / 2}
					y={corner.y - handleSize / 2}
					width={handleSize}
					height={handleSize}
					fill="#0073aa"
					stroke="#fff"
					strokeWidth={1}
					style={{ cursor: corner.cursor, pointerEvents: 'all' }}
					onPointerDown={handlePointerDown('resize', { corner: corner.id })}
				/>
			))}
			<g
				transform={`translate(${outerBounds.x + outerBounds.width + 12}, ${outerBounds.y - 8})`}
				style={{ cursor: 'pointer', pointerEvents: 'all' }}
				onClick={(event) => {
					event.stopPropagation();
					api.onDeleteDrawing?.(drawing.id);
				}}
			>
				<circle cx={0} cy={0} r={10} fill="#d63638" />
				<text x={0} y={4} textAnchor="middle" fill="#fff" fontSize={14} fontWeight="bold">
					×
				</text>
			</g>
		</g>
	);
}

export default DrawingSelectionHandles;
