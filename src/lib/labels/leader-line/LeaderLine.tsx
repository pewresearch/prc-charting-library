/* eslint-disable jsdoc/require-param */
export interface LeaderLineProps {
	x1: number;
	y1: number;
	x2: number;
	y2: number;
	distance: number;
	stroke?: string;
	strokeWidth?: number;
	threshold?: number;
}

/**
 * Short leader from the data anchor to a displaced label.
 */
export function LeaderLine({
	x1,
	y1,
	x2,
	y2,
	distance,
	stroke = '#756f6a',
	strokeWidth = 1,
	threshold = 6,
}: LeaderLineProps) {
	if (distance < threshold) {
		return null;
	}

	return <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={stroke} strokeWidth={strokeWidth} pointerEvents="none" />;
}
