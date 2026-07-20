/**
 * AnimatedPieGroupSeparatorArc — dashed ring guide around a grouped pie segment.
 *
 * Separator arcs do not sweep or wipe with slices — that reads out of sync on
 * exploded groups. They follow the same `TransitionProvider` clock as
 * `AnimatedLabel`: hidden while slice geometry runs, fading in only after the
 * pie entrance/update tween finishes.
 *
 *   - First mount: opacity 0 during `animating`, then fades in with labels
 *     in `entering`.
 *   - Data change: fades out with labels in `exiting`, stays hidden during
 *     `animating`, fades back in in `entering`.
 */
import { SVGProps } from 'react';
import { animated } from '@react-spring/web';

import { useChartTransition } from './TransitionProvider';
import { useLabelOpacity } from './useLabelOpacity';

/**
 * Build an SVG elliptical-arc stroke path (0 = 12 o'clock, clockwise).
 *
 * @param startAngle Leading edge in radians.
 * @param endAngle   Trailing edge in radians.
 * @param arcRadius  Radius of the guide arc.
 */
export function buildSeparatorArcPath(startAngle: number, endAngle: number, arcRadius: number): string {
	if (endAngle <= startAngle) {
		return '';
	}

	const startX = Math.sin(startAngle) * arcRadius;
	const startY = -Math.cos(startAngle) * arcRadius;
	const endX = Math.sin(endAngle) * arcRadius;
	const endY = -Math.cos(endAngle) * arcRadius;
	const largeArcFlag = endAngle - startAngle > Math.PI ? 1 : 0;

	return `M ${startX} ${startY} A ${arcRadius} ${arcRadius} 0 ${largeArcFlag} 1 ${endX} ${endY}`;
}

export interface AnimatedPieGroupSeparatorArcProps extends Omit<SVGProps<SVGPathElement>, 'd' | 'ref'> {
	startAngle: number;
	endAngle: number;
	arcRadius: number;
}

const AnimatedPieGroupSeparatorArc = ({
	startAngle,
	endAngle,
	arcRadius,
	...rest
}: AnimatedPieGroupSeparatorArcProps) => {
	const { phase, immediate, timing } = useChartTransition();
	const opacity = useLabelOpacity({ phase, timing, immediate });
	const d = buildSeparatorArcPath(startAngle, endAngle, arcRadius);

	if (immediate) {
		return <path d={d} fill="none" {...rest} />;
	}

	return <animated.path d={d} fill="none" style={{ opacity }} {...rest} />;
};

AnimatedPieGroupSeparatorArc.displayName = 'AnimatedPieGroupSeparatorArc';

export default AnimatedPieGroupSeparatorArc;
