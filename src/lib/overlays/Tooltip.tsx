import { useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Tooltip as BaseTooltipType } from '@prc/charting-utilities';

type TooltipProps = {
	tooltip: BaseTooltipType;
	top: number;
	left: number;
	children: string | React.ReactNode | null;
	cursorX?: number;
	cursorY?: number;
	/**
	 * Pins the box horizontally while `cursorY` still drives the vertical, for
	 * the unified tooltip's snapped column. Same SVG-relative space as
	 * `cursorX`: the caller adds the plot's left padding.
	 */
	anchorX?: number;
	containerRef?: React.RefObject<HTMLDivElement | SVGSVGElement | null>;
	isMobile?: boolean; // Mobile flips within the chart's visible bounds; desktop within the viewport
};

type BoxSize = { width: number; height: number };

// Mobile placement in viewport coordinates. The box sits right of and below
// the anchor, flips left when it would pass the chart's visible right edge,
// and flips up only when it would pass the bottom of the viewport, so a tall
// box can extend past the chart vertically.
const positionWithinChart = (
	anchorX: number,
	anchorY: number,
	size: BoxSize,
	chartRect: DOMRect,
	offsetX: number,
	offsetY: number
) => {
	const minLeft = Math.max(chartRect.left, 0);
	const maxRight = Math.min(chartRect.right, window.innerWidth);

	let left = anchorX + offsetX;
	if (left + size.width > maxRight) {
		left = anchorX - offsetX - size.width;
	}
	left = Math.max(left, minLeft);

	let top = anchorY + offsetY;
	if (top + size.height > window.innerHeight) {
		top = anchorY - offsetY - size.height;
	}
	top = Math.max(top, 0);

	return { top, left };
};

// Calculate optimal tooltip position relative to cursor.
//
// Pre-existing and deliberately left alone (see the unified tooltip phase 3
// notes): the flip below tests a hard-coded 200×20 estimate rather than the
// measured box, and against the viewport rather than the plot; and the
// left-edge guard assigns `left` back to `cursorX`, the value it already had.
const calculateTooltipPosition = (
	cursorX: number,
	cursorY: number,
	tooltipWidth: number,
	tooltipHeight: number,
	containerWidth: number,
	containerHeight: number
) => {
	const padding = 10; // Minimum distance from edges

	// Determine horizontal position
	let left = cursorX;

	// Check if tooltip would overflow right edge
	if (left + tooltipWidth + padding > containerWidth) {
		left = cursorX - tooltipWidth;
	}

	// Check if tooltip would overflow left edge
	if (left < padding) {
		left = cursorX;
	}

	// Determine vertical position
	let top = cursorY;

	// Check if tooltip would overflow bottom edge
	if (top + tooltipHeight + padding > containerHeight) {
		top = cursorY - tooltipHeight;
	}

	// Check if tooltip would overflow top edge
	if (top < padding) {
		top = cursorY;
	}

	return { top, left };
};

export const StyledTooltip = ({
	tooltip,
	top,
	left,
	children,
	cursorX,
	cursorY,
	anchorX,
	containerRef,
	isMobile = false,
}: TooltipProps) => {
	const {
		minWidth,
		maxWidth,
		maxHeight,
		minHeight,
		width,
		background,
		border,
		padding,
		borderRadius,
		fontFamily,
		fontSize,
		color,
	} = tooltip.style;

	const tooltipRef = useRef<HTMLDivElement>(null);
	const [measuredSize, setMeasuredSize] = useState<BoxSize | null>(null);

	useLayoutEffect(() => {
		const node = tooltipRef.current;
		if (!node) {
			return;
		}
		const { offsetWidth, offsetHeight } = node;
		setMeasuredSize((prev) =>
			prev?.width === offsetWidth && prev?.height === offsetHeight
				? prev
				: { width: offsetWidth, height: offsetHeight }
		);
	}, [children, isMobile]);

	const sharedStyle = {
		pointerEvents: 'none' as const,
		width,
		minWidth,
		maxWidth,
		maxHeight,
		minHeight,
		overflow: 'auto' as const,
		background,
		border,
		padding,
		borderRadius,
		fontFamily,
		fontSize,
		color,
		lineHeight: '1.2em',
		boxShadow: '0px 0px 2px 0px #63646480',
		zIndex: 9999,
	};

	// A pinned anchor replaces only the horizontal input, so the edge flip still
	// applies to it and `cursorY` still drives the vertical.
	const horizontalX = anchorX !== undefined ? anchorX : cursorX;

	// Portaled like desktop so the chart wrapper's overflow (clip or scroll)
	// cannot cut a tall box off, but flipped within the chart's bounds.
	if (isMobile) {
		const chartRect = containerRef?.current?.getBoundingClientRect();
		const size = measuredSize ?? {
			width: typeof width === 'number' ? width : 200,
			height: typeof minHeight === 'number' ? minHeight : 50,
		};
		const mobilePosition = chartRect
			? positionWithinChart(
					(horizontalX ?? left) + chartRect.left,
					(cursorY ?? top) + chartRect.top,
					size,
					chartRect,
					tooltip.offsetX,
					tooltip.offsetY
				)
			: { top, left };

		return createPortal(
			<div
				ref={tooltipRef}
				className="tooltip in-portal mobile"
				style={{
					...sharedStyle,
					position: 'fixed',
					top: `${mobilePosition.top}px`,
					left: `${mobilePosition.left}px`,
				}}
			>
				{children}
			</div>,
			document.body
		);
	}

	// On desktop, use portal for better positioning in constrained containers
	// Portal needs viewport coordinates, so convert SVG-relative to viewport
	const getDesktopPosition = () => {
		if (horizontalX !== undefined && cursorY !== undefined) {
			// Convert SVG-relative cursor coordinates to viewport coordinates
			if (!containerRef?.current) {
				return { top: cursorY, left: horizontalX }; // Fallback
			}
			const rect = containerRef.current.getBoundingClientRect();
			const viewportX = horizontalX + rect.left;
			const viewportY = cursorY + rect.top;
			return calculateTooltipPosition(
				viewportX,
				viewportY,
				typeof width === 'number' ? width : 200,
				typeof minHeight === 'number' ? minHeight : 50,
				window.innerWidth,
				window.innerHeight
			);
		}
		if (containerRef?.current) {
			// Convert SVG-relative coordinates to viewport coordinates.
			//
			// Pre-existing and deliberately left alone: this branch
			// never adds the plot padding, so a data-anchored caller
			// such as StackedArea is offset by it. `Line` masks it by
			// always sending cursor coordinates.
			const rect = containerRef.current.getBoundingClientRect();
			return {
				top: top + rect.top,
				left: left + rect.left,
			};
		}
		// Fallback: use coordinates as-is
		return { top, left };
	};
	const finalPosition = getDesktopPosition();

	const tooltipElement = (
		<div
			className="tooltip in-portal desktop"
			style={{
				...sharedStyle,
				position: 'fixed', // Use fixed positioning for portal
				top: `${finalPosition.top + (tooltip.offsetY || 0)}px`,
				left: `${finalPosition.left + (tooltip.offsetX || 0)}px`,
			}}
		>
			{children}
		</div>
	);

	// Render tooltip in a portal at document body level
	return createPortal(tooltipElement, document.body);
};
