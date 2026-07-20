/**
 * Shared animation-config plumbing for the `animation/` primitives.
 *
 * Every Animated* primitive needs to:
 *   1. Read `config.animation` from `DataContext`, with defaults for
 *      charts whose config predates the animation rollout.
 *   2. Resolve the per-section (`initial` / `update`) settings via the
 *      documented hierarchy: section value ?? top-level value ?? hard
 *      default (see `types/animation.ts`).
 *   3. Map the curated `AnimationEasing` name to the corresponding
 *      `@react-spring/web` `easings[name]` function, so components never
 *      import easing fns directly.
 *   4. Honor the OS-level `prefers-reduced-motion: reduce` preference by
 *      collapsing the spring to instant updates (`immediate: true`).
 *   5. Suppress animation in the block editor. Authors are dragging
 *      handles, clicking shapes, and tweaking inspector controls —
 *      mid-flight spring values cause the rect's visual position to lag
 *      the data-model position, so click/drag interactions hit "stale"
 *      geometry and feel wonky. The editor signal is the presence of
 *      `wpEditorFunctions` in `DataContext`; the frontend
 *      `ChartBuilderRenderer` never sets it.
 *   6. Track first-mount vs. update so the consumer can apply the
 *      entrance (`initial`) timing on mount and the data-change
 *      (`update`) timing thereafter.
 *
 * Centralizing this here keeps each primitive focused on its own visx
 * prop surface and the specific values it springs, and guarantees the
 * rollout-wide behavior (resolution hierarchy, reduced-motion handling,
 * editor opt-out, defaults) is defined exactly once.
 *
 * `prefers-reduced-motion` is read once per mount via `useMemo([])`.
 * Toggling the OS preference mid-session is rare; a `matchMedia`
 * listener across hundreds of chart primitives would outweigh the
 * benefit. Re-mounting (e.g. navigating between pages) re-evaluates
 * naturally.
 */
import { useContext, useEffect, useMemo, useRef } from 'react';
import { easings } from '@react-spring/web';
import {
	DataContext,
	BaseConfig,
	TableData,
	Animation,
	AnimationEntranceType,
	AnimationEasing,
} from '@prc/charting-utilities';

type EasingFunction = (t: number) => number;

/** Entrance types after `'auto'` has been resolved against the family. */
export type ResolvedEntranceType = Exclude<AnimationEntranceType, 'auto'>;

/** Chart families that consume the animation config. */
export type AnimationFamily = 'bar' | 'circle' | 'line' | 'area' | 'pie';

const DEFAULT_DURATION = 400;
const DEFAULT_EASING: AnimationEasing = 'easeInOutCubic';
const DEFAULT_DELAY = 0;

/**
 * `'auto'` entrance resolution per family. Lines and areas both "draw"
 * on; bars "grow", circles "pop", pie slices "sweep".
 */
const FAMILY_ENTRANCE: Record<AnimationFamily, ResolvedEntranceType> = {
	bar: 'grow',
	circle: 'pop',
	line: 'draw',
	area: 'draw',
	pie: 'sweep',
};

/**
 * Resolved timing for a "follow" (secondary) element that plays after the
 * primary entrance completes — line/area markers, the dot-plot connector,
 * and any future dependent mark. The host forwards `delay`/`duration` to its
 * dependent primitive's generic `entranceDelay`/`entranceDuration` props.
 */
export interface ResolvedFollow {
	/** Whether the secondary runs its sequenced (after-primary) entrance. */
	enabled: boolean;
	/** How long the secondary entrance runs (ms). */
	duration: number;
	/**
	 * Absolute delay (ms) the secondary should wait before starting, already
	 * including the primary's full runtime: `section.delay + section.duration
	 * + follow.delay-offset`. Meaningful on `initial`; on `update` it is `0`
	 * (the secondary glides with the primary on data changes).
	 */
	delay: number;
}

export interface ResolvedAnimationSection {
	/** Whether this section animates (before reduced-motion/editor override). */
	enabled: boolean;
	/** Resolved entrance shape. Meaningful for `initial`; `'none'` for `update`. */
	type: ResolvedEntranceType;
	/** Spring duration in ms. */
	duration: number;
	/** Resolved easing function for `useSpring`'s `config.easing`. */
	easing: EasingFunction;
	/** Delay (ms) before the spring starts. */
	delay: number;
	/**
	 * Resolved timing for the dependent "follow" element that plays after
	 * this section's primary entrance (line/area markers, dot-plot connector,
	 * etc.). The sequencing math lives here so hosts never recompute
	 * `delay + duration`; they just forward `follow.delay`/`follow.duration`.
	 * On `update` the secondary glides with the primary (`follow.delay === 0`).
	 */
	follow: ResolvedFollow;
	/**
	 * When true, react-spring jumps to the target instantly. True when the
	 * section is disabled, animation is globally off, the OS prefers
	 * reduced motion, the entrance `type` is `'none'`, or we're in the
	 * editor.
	 */
	immediate: boolean;
}

export interface UseAnimationConfigResult {
	/** Master switch resolved from `config.animation.enabled`. */
	enabled: boolean;
	/** True only on the component's very first render (mount). */
	isFirstRender: boolean;
	/** Entrance (first-mount) timing. */
	initial: ResolvedAnimationSection;
	/** Data-change (update) timing. */
	update: ResolvedAnimationSection;
}

function getPrefersReducedMotion(): boolean {
	if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
		return false;
	}
	try {
		return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	} catch {
		return false;
	}
}

function resolveEasing(name?: AnimationEasing): EasingFunction {
	const key = name ?? DEFAULT_EASING;
	return easings[key] ?? easings[DEFAULT_EASING];
}

/**
 * Resolve the animation config for a chart family into ready-to-spring
 * `initial` and `update` sections.
 *
 * @param family Chart family used to resolve `'auto'` entrance types.
 * @return Resolved sections plus first-render and master-enabled flags.
 */
export function useAnimationConfig(family: AnimationFamily = 'bar'): UseAnimationConfigResult {
	const { config, wpEditorFunctions, animationPreview } = useContext(
		DataContext as React.Context<{
			data: unknown;
			config: BaseConfig;
			tableData?: TableData;
			wpEditorFunctions?: unknown;
			animationPreview?: boolean;
		}>
	);

	const prefersReducedMotion = useMemo(() => getPrefersReducedMotion(), []);
	// The editor forces instant updates so authors aren't fighting in-flight
	// spring values while dragging/clicking. The preview button (PRC-17)
	// temporarily lifts that one source of `immediate` by setting
	// `animationPreview` in context, letting the configured entrance play
	// once. Reduced motion is never bypassed — accessibility wins over both.
	const isEditor = wpEditorFunctions !== undefined;
	const forceImmediate = prefersReducedMotion || (isEditor && !animationPreview);

	// First-render tracking. Each primitive owns its own hook instance, so
	// this ref flips after that primitive's own mount — exactly what we
	// want for "entrance on mount, update timing afterwards".
	const firstRenderRef = useRef(true);
	const isFirstRender = firstRenderRef.current;
	useEffect(() => {
		firstRenderRef.current = false;
	}, []);

	return useMemo<UseAnimationConfigResult>(() => {
		const animation = (config?.animation ?? {}) as Partial<Animation>;
		const enabled = animation.enabled ?? false;

		const sharedDuration = animation.duration ?? DEFAULT_DURATION;
		const sharedEasing = animation.easing;
		const sharedDelay = animation.delay ?? DEFAULT_DELAY;

		const initialSection = animation.initial ?? {};
		const updateSection = animation.update ?? {};

		const initialType: ResolvedEntranceType =
			!initialSection.type || initialSection.type === 'auto' ? FAMILY_ENTRANCE[family] : initialSection.type;

		const initialEnabled = enabled && (initialSection.enabled ?? true) && initialType !== 'none';
		const updateEnabled = enabled && (updateSection.enabled ?? true);

		const initialDuration = initialSection.duration ?? sharedDuration;
		const updateDuration = updateSection.duration ?? sharedDuration;
		const initialDelay = initialSection.delay ?? sharedDelay;
		const updateDelay = updateSection.delay ?? sharedDelay;

		const followCfg = initialSection.follow ?? {};
		const followDuration = followCfg.duration ?? initialDuration;

		const initial: ResolvedAnimationSection = {
			enabled: initialEnabled,
			type: initialType,
			duration: initialDuration,
			easing: resolveEasing(initialSection.easing ?? sharedEasing),
			delay: initialDelay,
			follow: {
				enabled: followCfg.enabled ?? true,
				duration: followDuration,
				// Absolute: wait out the primary (delay + duration), then the
				// optional follow offset. Hosts forward this verbatim.
				delay: initialDelay + initialDuration + (followCfg.delay ?? 0),
			},
			immediate: !initialEnabled || forceImmediate,
		};

		const update: ResolvedAnimationSection = {
			enabled: updateEnabled,
			type: 'none',
			duration: updateDuration,
			easing: resolveEasing(updateSection.easing ?? sharedEasing),
			delay: updateDelay,
			// On data changes the secondary glides with the primary — no wait.
			follow: { enabled: updateEnabled, duration: updateDuration, delay: 0 },
			immediate: !updateEnabled || forceImmediate,
		};

		return { enabled, isFirstRender, initial, update };
	}, [config?.animation, family, forceImmediate, isFirstRender]);
}

export default useAnimationConfig;
