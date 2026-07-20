/**
 * AnimatedArc — animated drop-in for a visx `<Pie>` slice `<path>` that
 * springs its `startAngle`/`endAngle` between renders (PRC-17 slice 3h —
 * pie/arc family).
 *
 * A pie slice's `d` is produced by the d3 arc generator visx hands back
 * from `<Pie>`'s render-prop (`pie.path`). To animate the slice we can't
 * tween the `d` string directly (arc commands aren't linearly
 * interpolable); instead we spring the *angles* and rebuild `d` every frame
 * by calling the generator with the interpolated angles. The host passes a
 * `buildArc(startAngle, endAngle)` closure that does exactly that
 * (`pie.path({ ...arc, startAngle, endAngle })`), keeping this primitive
 * decoupled from visx's arc-datum typing while still using the *same*
 * generator the static chart uses — so radius, padAngle, and corner config
 * are honored automatically.
 *
 * This is the pie-family analogue of `AnimatedBar`. It reuses
 * `useTransitionTiming('pie')` so the geometry waits out the label
 * fade-out (`geometryDelay` folds in `LABEL_FADE_MS`) and stays in lockstep
 * with `TransitionProvider`'s phase machine — labels on arcs choreograph
 * exactly like bars, lines, and points.
 *
 * Entrance (first mount), resolved from the pie entrance type
 * (`'auto'` → `'sweep'`):
 *   - `sweep`: each slice grows from its leading edge (`endAngle:
 *     startAngle → endAngle`). Slices expand in parallel, which reads as a
 *     simultaneous fan-out around the ring.
 *   - `clockwise`: one shared wipe via `PieRevealProvider` — the reveal
 *     angle advances from the pie's start to end; each slice is clipped to
 *     `[startAngle, min(endAngle, revealAngle)]` so the ring fills
 *     clockwise (0° → 360° on a full pie).
 * On update the angles are already at target on mount, so only data-change
 * transitions interpolate old → new angles — slices grow/shrink to their
 * new share.
 *
 * Enter/exit lifecycle: newly added slices sweep in via their own mount
 * entrance; removed slices unmount immediately. This mirrors the deliberate
 * bar/circle decision (see `animation/index.ts`) — a graceful collapse would
 * require a parallel collection-level `useTransition` layer that owns the
 * slice list, which the per-element drop-in contract intentionally avoids.
 *
 * `fillOpacity`/`opacity` (tooltip deemphasis, custom styles) pass through
 * untouched so hover behavior is byte-for-byte the previous static path.
 * Only `d` is animated.
 *
 * Cross-runtime: imports from `@react-spring/web`, which `import`s from
 * `react`. The Preact view bundle's webpack alias (`react -> preact/compat`)
 * routes that to preact transparently; the React editor build uses the
 * package natively. No build-tier-specific code lives here.
 */
import { SVGProps, forwardRef, useLayoutEffect, useRef } from 'react';
import { useSpring, animated, to as interpolateTo } from '@react-spring/web';

import useAnimationConfig from './useAnimationConfig';
import useTransitionTiming from './useTransitionTiming';
import { usePieReveal } from './PieRevealProvider';

export interface AnimatedArcProps extends Omit<SVGProps<SVGPathElement>, 'd' | 'ref'> {
	/** Target start angle (radians) of this slice. */
	startAngle: number;
	/** Target end angle (radians) of this slice. */
	endAngle: number;
	/**
	 * Rebuilds the slice path `d` for a given pair of angles, using the host
	 * chart's own arc generator — e.g.
	 * `(s, e) => pie.path({ ...arc, startAngle: s, endAngle: e }) ?? ''`.
	 */
	buildArc: (startAngle: number, endAngle: number) => string;
}

const AnimatedArc = forwardRef<SVGPathElement, AnimatedArcProps>(({ startAngle, endAngle, buildArc, ...rest }, ref) => {
	const { initial: entranceSection } = useAnimationConfig('pie');
	const { isFirstRender, initial, update } = useTransitionTiming('pie');
	const pieReveal = usePieReveal();

	const usedClockwiseEntranceRef = useRef(!initial.immediate && entranceSection.type === 'clockwise');
	const showClockwiseWipe = Boolean(pieReveal?.active);

	// Hold entrance timing until the wipe finishes (clockwise) or the
	// per-slice sweep spring settles (sweep). Mirrors `AnimatedCircle`'s
	// `enteringRef` — live `isFirstRender` flips false too early.
	const entranceLatchRef = useRef(usedClockwiseEntranceRef.current || isFirstRender);
	const isEntrancePhase = entranceLatchRef.current;
	const phaseTiming = isEntrancePhase ? initial : update;
	const { geometryDuration: duration, easing, geometryDelay: delay, immediate } = phaseTiming;

	const initialFromRef = useRef({ startAngle, endAngle: startAngle });

	// After the shared wipe, snap per-slice springs to full arcs so we do not
	// replay sweep when `active` goes false (springs were seeded collapsed).
	useLayoutEffect(() => {
		if (!usedClockwiseEntranceRef.current || showClockwiseWipe || !entranceLatchRef.current) {
			return;
		}
		initialFromRef.current = { startAngle, endAngle };
		entranceLatchRef.current = false;
	}, [showClockwiseWipe, startAngle, endAngle]);

	const suppressSweepEntrance = usedClockwiseEntranceRef.current && entranceLatchRef.current;

	const springs = useSpring({
		to: { startAngle, endAngle },
		from: initialFromRef.current,
		config: { duration, easing },
		delay,
		immediate: immediate || showClockwiseWipe || suppressSweepEntrance,
		onRest: () => {
			if (!usedClockwiseEntranceRef.current) {
				entranceLatchRef.current = false;
			}
		},
	});

	const sweepD = interpolateTo([springs.startAngle, springs.endAngle], (s: number, e: number) => buildArc(s, e));

	const clockwiseD =
		showClockwiseWipe && pieReveal
			? pieReveal.revealAngle.to((revealed: number) => {
					const visibleEnd = Math.min(endAngle, revealed);
					if (visibleEnd <= startAngle) {
						return '';
					}
					return buildArc(startAngle, visibleEnd);
				})
			: sweepD;

	return <animated.path ref={ref} {...rest} d={clockwiseD} />;
});

AnimatedArc.displayName = 'AnimatedArc';

export default AnimatedArc;
