import type { RefObject } from 'react';
import { useRef } from 'react';

const MIN_SIZE = 10;
const HANDLE_SIZE = 8;

type CornerId = 'nw' | 'ne' | 'sw' | 'se';

type Box = {
	x: number;
	y: number;
	width: number;
	height: number;
};

const cornersFor = (box: Box): { id: CornerId; x: number; y: number; cursor: string }[] => [
	{ id: 'nw', x: box.x, y: box.y, cursor: 'nwse-resize' },
	{ id: 'ne', x: box.x + box.width, y: box.y, cursor: 'nesw-resize' },
	{ id: 'sw', x: box.x, y: box.y + box.height, cursor: 'nesw-resize' },
	{ id: 'se', x: box.x + box.width, y: box.y + box.height, cursor: 'nwse-resize' },
];

const sizeFromCorner = (
	corner: CornerId,
	localX: number,
	localY: number,
	start: Box
): { width: number; height: number } => {
	let width = start.width;
	let height = start.height;
	switch (corner) {
		case 'se':
			width = localX - start.x;
			height = localY - start.y;
			break;
		case 'sw':
			width = start.x + start.width - localX;
			height = localY - start.y;
			break;
		case 'ne':
			width = localX - start.x;
			height = start.y + start.height - localY;
			break;
		case 'nw':
			width = start.x + start.width - localX;
			height = start.y + start.height - localY;
			break;
		default: {
			const _exhaustive: never = corner;
			return { width: _exhaustive, height: _exhaustive };
		}
	}
	width = Math.max(MIN_SIZE, Math.round(width));
	height = Math.max(MIN_SIZE, Math.round(height));
	return { width, height };
};

const withAspectRatio = (
	size: { width: number; height: number },
	start: Box,
	keepAspectRatio: boolean
): { width: number; height: number } => {
	if (!keepAspectRatio || start.width <= 0 || start.height <= 0) {
		return size;
	}
	const ratio = start.height / start.width;
	return {
		width: size.width,
		height: Math.max(MIN_SIZE, Math.round(size.width * ratio)),
	};
};

/**
 * Pointer capture retargets the click that ends a resize to the <svg>, which
 * the editor reads as a background click and closes the annotation popover.
 */
const swallowTrailingClick = (svg: SVGSVGElement) => {
	const swallow = (event: Event) => event.stopPropagation();
	svg.addEventListener('click', swallow, { capture: true, once: true });
	setTimeout(() => svg.removeEventListener('click', swallow, { capture: true }), 0);
};

/**
 * Editor-only resize handles for a selected image annotation. Shown inside the
 * annotation's translated group (layout px, same box as the <image>).
 */
export function ImageAnnotationResizeHandles({
	box,
	keepAspectRatio = true,
	groupRef,
	onResizeStart,
	onResize,
	onResizeEnd,
	onResizeCancel,
}: {
	box: Box;
	keepAspectRatio?: boolean;
	/** Annotation `<g>` — pointer coords are mapped into this group's space. */
	groupRef: RefObject<SVGGElement | null>;
	onResizeStart?: () => void;
	onResize: (size: { width: number; height: number }) => void;
	onResizeEnd?: (size: { width: number; height: number }) => void;
	/** The drag ended without a size to save (e.g. pointercancel). */
	onResizeCancel?: () => void;
}) {
	const dragRef = useRef<{
		corner: CornerId;
		startBox: Box;
	} | null>(null);
	const onPointerDown = (corner: CornerId) => (event: React.PointerEvent) => {
		event.stopPropagation();
		event.preventDefault();
		const svg = (event.currentTarget as SVGElement).ownerSVGElement;
		if (!svg) return;
		onResizeStart?.();
		dragRef.current = { corner, startBox: { ...box } };
		svg.setPointerCapture(event.pointerId);

		const sizeAt = (pointerEvent: PointerEvent) => {
			const state = dragRef.current;
			if (!state) return null;
			// No `instanceof SVGGElement`: the editor canvas is an iframe, so the
			// group belongs to another realm than this bundle's globals.
			const matrix = (groupRef.current ?? svg).getScreenCTM()?.inverse();
			if (!matrix) return null;
			const point = svg.createSVGPoint();
			point.x = pointerEvent.clientX;
			point.y = pointerEvent.clientY;
			const local = point.matrixTransform(matrix);
			return withAspectRatio(
				sizeFromCorner(state.corner, local.x, local.y, state.startBox),
				state.startBox,
				keepAspectRatio
			);
		};

		const onMove = (moveEvent: PointerEvent) => {
			const next = sizeAt(moveEvent);
			if (next) onResize(next);
		};

		const stop = (pointerId: number) => {
			dragRef.current = null;
			if (svg.hasPointerCapture?.(pointerId)) {
				svg.releasePointerCapture(pointerId);
			}
			svg.removeEventListener('pointermove', onMove);
			svg.removeEventListener('pointerup', onUp);
			svg.removeEventListener('pointercancel', onCancel);
		};

		const onUp = (upEvent: PointerEvent) => {
			const next = sizeAt(upEvent);
			stop(upEvent.pointerId);
			swallowTrailingClick(svg);
			if (next) {
				onResizeEnd?.(next);
			} else {
				onResizeCancel?.();
			}
		};

		const onCancel = (cancelEvent: PointerEvent) => {
			stop(cancelEvent.pointerId);
			onResizeCancel?.();
		};

		svg.addEventListener('pointermove', onMove);
		svg.addEventListener('pointerup', onUp);
		svg.addEventListener('pointercancel', onCancel);
	};

	return (
		<g className="cb__annotation-image-resize-handles" pointerEvents="none">
			<rect
				x={box.x - 2}
				y={box.y - 2}
				width={box.width + 4}
				height={box.height + 4}
				fill="none"
				stroke="#0073aa"
				strokeWidth={1}
				strokeDasharray="4 2"
				pointerEvents="none"
			/>
			{cornersFor(box).map((corner) => (
				<rect
					key={corner.id}
					className="cb__annotation-image-resize-handle"
					x={corner.x - HANDLE_SIZE / 2}
					y={corner.y - HANDLE_SIZE / 2}
					width={HANDLE_SIZE}
					height={HANDLE_SIZE}
					fill="#0073aa"
					stroke="#fff"
					strokeWidth={1}
					style={{ cursor: corner.cursor, pointerEvents: 'all' }}
					onPointerDown={onPointerDown(corner.id)}
				/>
			))}
		</g>
	);
}
