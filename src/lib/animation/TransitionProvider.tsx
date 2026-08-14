/**
 * Chart-level coordinator for the label transition choreography
 * (PRC-17 slice 3e-v onward).
 *
 * On a data change, React commits new label coordinates and text in the
 * same frame the geometry starts springing — so without coordination the
 * reader sees the *final* annotation pinned to a *partial* shape for the
 * whole tween. This provider runs a small phase machine that lets labels
 * fade out their OLD content first, hold while geometry travels, then fade
 * in the NEW content once it lands:
 *
 *   visible → exiting → animating → entering → visible
 *
 *   - `exiting`   — labels render their snapshot (old coords/text) and fade
 *                   out. Geometry receives new targets but its springs are
 *                   delayed (`geometryDelay` folds in `LABEL_FADE_MS`).
 *   - `animating` — epoch bumps; labels now receive new target props but
 *                   stay at opacity 0 while geometry tweens.
 *   - `entering`  — geometry has landed; labels fade in at the new position.
 *   - `visible`   — idle steady state.
 *
 * The data change is detected *during render* (the React "store previous
 * props" derived-state pattern) so the phase is already `exiting` on the
 * first frame the new data appears — otherwise labels would flash their
 * new content for one frame before the machine could react.
 *
 * Phase progression is `setTimeout`-driven off the single schedule from
 * `useTransitionTiming`, matching react-spring's duration model (no
 * physics) so the provider clock and the geometry/label springs stay in
 * sync. Timers are cleared on unmount and on rapid successive `setData`.
 *
 * When the active schedule is `immediate` (animation disabled, reduced
 * motion, or the editor without an active preview) the machine is skipped
 * entirely: phase stays `visible` and everything renders statically.
 *
 * Family-agnostic: the phase machine is identical for bars, lines,
 * circles, etc. Pass `family` so the timing matches the geometry primitive
 * inside (`AnimatedBar` reads `useTransitionTiming('bar')`, etc.). The
 * provider is context-only (no DOM), so it can wrap a whole chart
 * component's returned tree — including charts that emit multiple `<svg>`
 * fragments for group breaks — with a single instance.
 */
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { AnimationFamily } from './useAnimationConfig';
import { useTransitionTiming, PhaseTiming } from './useTransitionTiming';

export type TransitionPhase = 'visible' | 'exiting' | 'animating' | 'entering';

export interface TransitionContextValue {
	/** Current choreography phase. */
	phase: TransitionPhase;
	/**
	 * Bumps once per committed data transition (on `exiting → animating`).
	 * Labels watch this to know when their snapshot is stale.
	 */
	epoch: number;
	/** When true, consumers render statically (no choreography). */
	immediate: boolean;
	/** Active schedule for the current transition kind. */
	timing: PhaseTiming;
}

/**
 * Neutral, always-visible schedule used as the default context value so a
 * stray animated label rendered outside a provider degrades to a plain
 * static label instead of throwing.
 */
const STATIC_TIMING: PhaseTiming = {
	immediate: true,
	labelExitDuration: 0,
	geometryDelay: 0,
	geometryDuration: 0,
	labelEnterDelay: 0,
	labelEnterDuration: 0,
	easing: (t) => t,
};

const STATIC_VALUE: TransitionContextValue = {
	phase: 'visible',
	epoch: 0,
	immediate: true,
	timing: STATIC_TIMING,
};

export const TransitionContext = createContext<TransitionContextValue>(STATIC_VALUE);

/** Read the current transition phase/epoch/timing for animated elements. */
export const useChartTransition = (): TransitionContextValue => useContext(TransitionContext);

interface ProviderState {
	phase: TransitionPhase;
	/** Which schedule drives this transition. */
	kind: 'initial' | 'update';
	epoch: number;
	/** Reference of the `data` prop that produced the current phase. */
	data: unknown;
}

export interface TransitionProviderProps {
	/**
	 * The chart `data` reference. `setData` replaces this array, so a plain
	 * identity compare is enough to detect a real data change; unrelated
	 * re-renders (tooltip hover, resize) keep the same reference and are
	 * ignored.
	 */
	data: unknown;
	/** Chart family, so the schedule matches the geometry primitive inside. */
	family?: AnimationFamily;
	children: React.ReactNode;
}

export function TransitionProvider({ data, family = 'bar', children }: TransitionProviderProps) {
	const { initial, update } = useTransitionTiming(family);

	const [state, setState] = useState<ProviderState>(() => ({
		phase: initial.immediate ? 'visible' : 'animating',
		kind: 'initial',
		epoch: 0,
		data,
	}));

	// Detect a data change during render. `setState` alone does NOT update
	// `state` for this pass — under Preact (view bundle) that intermediate
	// render can commit, so labels would flash the NEW text at `visible`
	// before `exiting` lands. Derive the outgoing phase synchronously and
	// publish it through context on this same render.
	const dataChanged = data !== state.data;
	if (dataChanged) {
		setState((prev) => ({
			phase: update.immediate ? 'visible' : 'exiting',
			kind: 'update',
			epoch: prev.epoch,
			data,
		}));
	}

	const kind: ProviderState['kind'] = dataChanged ? 'update' : state.kind;
	const phase: TransitionPhase = dataChanged ? (update.immediate ? 'visible' : 'exiting') : state.phase;
	const epoch = state.epoch;
	const activeTiming = kind === 'initial' ? initial : update;

	// Phase progression. Each non-idle phase schedules the next; cleanup
	// cancels in-flight timers on unmount or when a fresh data change resets
	// the machine mid-flight.
	useEffect(() => {
		if (activeTiming.immediate || phase === 'visible') {
			return;
		}

		let timer: ReturnType<typeof setTimeout>;
		if (phase === 'exiting') {
			timer = setTimeout(() => {
				setState((prev) => ({ ...prev, phase: 'animating', epoch: prev.epoch + 1 }));
			}, activeTiming.labelExitDuration);
		} else if (phase === 'animating') {
			// Time from the start of the geometry tween until it lands. The exit
			// window is already spent, so subtract it from the enter delay.
			const animatingMs = Math.max(0, activeTiming.labelEnterDelay - activeTiming.labelExitDuration);
			timer = setTimeout(() => {
				setState((prev) => ({ ...prev, phase: 'entering' }));
			}, animatingMs);
		} else {
			timer = setTimeout(() => {
				setState((prev) => ({ ...prev, phase: 'visible' }));
			}, activeTiming.labelEnterDuration);
		}

		return () => clearTimeout(timer);
	}, [phase, epoch, activeTiming]);

	const value = useMemo<TransitionContextValue>(
		() => ({ phase, epoch, immediate: activeTiming.immediate, timing: activeTiming }),
		[phase, epoch, activeTiming]
	);

	return <TransitionContext.Provider value={value}>{children}</TransitionContext.Provider>;
}

export default TransitionProvider;
