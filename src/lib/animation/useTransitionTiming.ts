/**
 * Shared timing source for the label transition choreography
 * (PRC-17 slice 3e-v onward).
 *
 * Animated geometry primitives (`AnimatedBar`, and later `AnimatedLine` /
 * `AnimatedCircle` / …) spring their geometry over `update.duration`, but
 * labels compute their *target* coordinates and text immediately on a data
 * change. To choreograph the two (old label fades out → geometry tweens →
 * new label fades in) both the `TransitionProvider` (setTimeout-driven
 * phase machine) and the per-element / per-label springs must derive their
 * delays and durations from one place, or the two clocks drift.
 *
 * This hook layers a small, deterministic schedule on top of the resolved
 * `initial` / `update` sections from `useAnimationConfig(family)`:
 *
 *   - `initial` (mount entrance): labels are hidden from frame 0 (no exit
 *     phase), geometry animates over `initial.duration`, then labels fade
 *     in.
 *   - `update` (data change): old labels fade out over `LABEL_FADE_MS`,
 *     then geometry tweens over `update.duration` after `update.delay`,
 *     then new labels fade in.
 *
 * `geometryDelay` folds `LABEL_FADE_MS` into the update delay so an
 * element's own spring waits for the label fade-out to finish before it
 * starts moving — the provider's phase machine and react-spring stay in
 * lockstep without the element needing to read the transition context.
 *
 * It is family-agnostic: the schedule math is identical for bars, lines,
 * circles, etc.; only the geometry primitive that consumes
 * `geometryDelay`/`geometryDuration` differs. All durations are in ms.
 * `LABEL_FADE_MS` is hardcoded for now; exposing it as a configurable
 * `animation.labelFade` is deferred.
 */
import { useMemo } from 'react';
import useAnimationConfig, { AnimationFamily } from './useAnimationConfig';

/** Fade-out / fade-in window for element labels, in ms. */
export const LABEL_FADE_MS = 150;

type EasingFunction = (t: number) => number;

export interface PhaseTiming {
	/** When true, callers should jump straight to the target (no choreography). */
	immediate: boolean;
	/** Duration of the label fade-out, in ms (`0` on the entrance). */
	labelExitDuration: number;
	/** Delay before an element's geometry spring starts, in ms. */
	geometryDelay: number;
	/** Duration of an element's geometry spring, in ms. */
	geometryDuration: number;
	/** Delay before labels begin fading in, measured from transition start. */
	labelEnterDelay: number;
	/** Duration of the label fade-in, in ms. */
	labelEnterDuration: number;
	/** Resolved easing function shared by geometry and labels for this phase. */
	easing: EasingFunction;
}

export interface UseTransitionTimingResult {
	/** True only on the component's very first render (mount). */
	isFirstRender: boolean;
	/** Entrance (first-mount) schedule. */
	initial: PhaseTiming;
	/** Data-change (update) schedule. */
	update: PhaseTiming;
}

/**
 * Resolve a chart family's animation config into entrance/update schedules
 * for the label transition choreography.
 *
 * @param family Chart family used to resolve timing (defaults to `'bar'`).
 * @return Memoized `initial` / `update` schedules plus first-render flag.
 */
export function useTransitionTiming(family: AnimationFamily = 'bar'): UseTransitionTimingResult {
	const { isFirstRender, initial, update } = useAnimationConfig(family);

	return useMemo<UseTransitionTimingResult>(
		() => ({
			isFirstRender,
			initial: {
				immediate: initial.immediate,
				labelExitDuration: 0,
				geometryDelay: initial.delay,
				geometryDuration: initial.duration,
				labelEnterDelay: initial.delay + initial.duration,
				labelEnterDuration: LABEL_FADE_MS,
				easing: initial.easing,
			},
			update: {
				immediate: update.immediate,
				labelExitDuration: LABEL_FADE_MS,
				geometryDelay: LABEL_FADE_MS + update.delay,
				geometryDuration: update.duration,
				labelEnterDelay: LABEL_FADE_MS + update.delay + update.duration,
				labelEnterDuration: LABEL_FADE_MS,
				easing: update.easing,
			},
		}),
		[isFirstRender, initial, update]
	);
}

export default useTransitionTiming;
