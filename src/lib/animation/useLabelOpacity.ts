/**
 * Opacity spring for animated chart labels, driven by the current
 * `TransitionProvider` phase (PRC-17 slice 3e-v onward).
 *
 * Phase → target opacity:
 *   - `visible`   → 1 (steady state)
 *   - `exiting`   → 0, eased over `labelExitDuration` (old label fades out)
 *   - `animating` → 0, instant (geometry is travelling; label stays hidden)
 *   - `entering`  → 1, eased over `labelEnterDuration` (new label fades in)
 *
 * `animating` jumps to 0 immediately so a label that mounts mid-transition
 * (e.g. a newly added row, which has no prior snapshot to fade out from)
 * starts hidden and simply fades in during `entering` rather than popping.
 *
 * Family-agnostic: any animated label primitive (bar, line, circle, …)
 * multiplies the returned `SpringValue` into its rendered group opacity;
 * the caller's own `fillOpacity` (tooltip deemphasis) is passed through
 * untouched so the two compose.
 */
import { useSpring, SpringValue } from '@react-spring/web';
import type { PhaseTiming } from './useTransitionTiming';
import type { TransitionPhase } from './TransitionProvider';

interface UseLabelOpacityArgs {
	phase: TransitionPhase;
	timing: PhaseTiming;
	immediate: boolean;
}

export function useLabelOpacity({ phase, timing, immediate }: UseLabelOpacityArgs): SpringValue<number> {
	const target = phase === 'visible' || phase === 'entering' ? 1 : 0;
	let duration = 0;
	if (phase === 'exiting') {
		duration = timing.labelExitDuration;
	} else if (phase === 'entering') {
		duration = timing.labelEnterDuration;
	}

	const { opacity } = useSpring({
		opacity: target,
		immediate: immediate || phase === 'animating',
		config: { duration, easing: timing.easing },
	});

	return opacity;
}

export default useLabelOpacity;
