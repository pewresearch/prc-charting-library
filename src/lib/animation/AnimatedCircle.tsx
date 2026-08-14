/**
 * AnimatedCircle — drop-in replacement for visx's <Circle> that springs
 * `cx`/`cy`/`r`/`fill`/`opacity`/`fillOpacity` between renders (PRC-17
 * slice 3f — circle/point family fan-out).
 *
 * visx's <Circle> is `<circle ref={innerRef} className={cx('visx-circle',
 * className)} {...rest}>` (see `node_modules/@visx/shape/lib/shapes/Circle.js`).
 * To stay a true drop-in we mirror that contract: rest-spread every
 * unrecognized prop onto the underlying `animated.circle`, forward a `ref`,
 * and compose the `visx-circle` class. The only props we intercept are the
 * six we spring (geometry + fill/opacity). A stray `stroke`, `tabIndex`,
 * `data-*`, `onClick`, `style`, etc. therefore lands on the circle untouched.
 *
 * This is the circle-family analogue of `AnimatedBar`. It reuses the shared
 * `useAnimationConfig('circle')` resolver so the rollout-wide behavior
 * (resolution hierarchy, reduced-motion handling, editor opt-out, defaults)
 * stays defined in one place. Each marker owns its own hook instance, so
 * `isFirstRender` flips per-circle — entrance timing on mount, update timing
 * thereafter.
 *
 * Entrance (first mount), resolved per the curated entrance type for the
 * circle family (`'auto'` → `'pop'`):
 *   - `pop`  (default): seed `r: 0` and grow the radius out to its target —
 *     legible "a point appeared here" without an opacity flicker.
 *   - `fade`: seed `opacity: 0` and fade in at full radius.
 *   - `none`: the hook returns `immediate: true`, so the circle simply
 *     renders at its target with no transition.
 * On update the radius/opacity are already at target, so only `cx`/`cy`
 * (and any fill/opacity change) interpolate — points glide to their new
 * positions on `debug.setData`.
 *
 * Host-driven positions (PRC-17 slice 3f): when `cx`/`cy` are passed as
 * react-spring animated values (a `SpringValue`/`Interpolation`) instead of
 * plain numbers, this primitive does NOT spring the position itself — it
 * passes those values straight through and springs only the entrance/fill
 * channels (`r`/`opacity`/`fill`). That is how line/area markers stay glued
 * to their host path: `AnimatedLinePath` owns one shared point-array spring
 * and hands each marker its glued `cx`/`cy` via the render-prop, so the two
 * cannot drift. With plain-number `cx`/`cy` (standalone scatter/dot plot,
 * slice 3g) the position is sprung here as usual.
 *
 * Standalone points (scatter/dot plot) use `useTransitionTiming('circle')` on
 * the update path so geometry waits for the label fade-out (slice 3g-v).
 * Host-driven markers (line/area) do not add that delay here — the host path
 * spring in `usePointGlide` owns it so path + markers + labels share one clock.
 *
 * Enter/exit lifecycle: newly added points pop/fade in via their own mount
 * entrance; removed points unmount immediately. This mirrors the deliberate
 * bar-family decision (see `animation/index.ts`) — a graceful collapse would
 * require a parallel collection-level `useTransition` layer that owns the
 * point list, which the per-element drop-in contract intentionally avoids.
 *
 * Cross-runtime: imports from `@react-spring/web`, which `import`s from
 * `react`. The Preact view bundle's webpack alias (`react -> preact/compat`)
 * routes that to preact transparently; the React editor build uses the
 * package natively. No build-tier-specific code lives here.
 */
import { SVGProps, forwardRef, useRef } from 'react';
import { useSpring, animated } from '@react-spring/web';
import type { Interpolation, SpringValue } from '@react-spring/web';

import useAnimationConfig from './useAnimationConfig';
import useTransitionTiming from './useTransitionTiming';

/** A position channel that may be a plain number or a react-spring value. */
type MaybeAnimated = number | SpringValue<number> | Interpolation<number, number>;

export interface AnimatedCircleProps extends Omit<SVGProps<SVGCircleElement>, 'cx' | 'cy' | 'r' | 'ref'> {
	cx: MaybeAnimated;
	cy: MaybeAnimated;
	r: number;
	/**
	 * Extra delay (ms) folded into the *entrance* (first-render) spring only.
	 * Used by line/area markers so they pop/fade in AFTER their host path has
	 * finished drawing on (set to the path's draw duration via the
	 * `AnimatedLinePath` render-prop). Ignored on data-change updates.
	 */
	entranceDelay?: number;
	/**
	 * Duration (ms) override for the *entrance* (first-render) spring only.
	 * Lets line/area markers pop in at their own pace (e.g. a snappy 100ms)
	 * on top of a slower line draw, set from `animation.initial.follow.
	 * duration` via the `AnimatedLinePath` render-prop. Ignored on
	 * data-change updates, where markers glide with the host path.
	 */
	entranceDuration?: number;
}

const AnimatedCircle = forwardRef<SVGCircleElement, AnimatedCircleProps>(
	({ cx, cy, r, fill, opacity, fillOpacity, className, entranceDelay = 0, entranceDuration, ...rest }, ref) => {
		// Entrance type (pop/fade) still comes from the raw config; phased
		// delays/durations for label choreography come from `useTransitionTiming`.
		const { initial: entranceSection, update: updateSection } = useAnimationConfig('circle');
		const { isFirstRender, initial, update } = useTransitionTiming('circle');

		// Latch the entrance into a ref rather than reading the live
		// `isFirstRender`. `isFirstRender` flips to false on this marker's
		// first post-mount re-render, and those happen *inside* the entrance
		// window as a matter of course — `useSize` fires a `ResizeObserver`
		// callback (and a `setTimeout(0)`) on first paint, tooltip/hover state
		// updates, parent re-renders, etc. If the entrance read the live flag,
		// that re-render would swap the spring from `initial` + entrance delay
		// to `update` with no delay mid-flight, so the marker would pop in
		// immediately instead of waiting for the host line to finish drawing.
		// We hold the decision until the entrance spring actually settles
		// (`onRest`), keeping the "wait for the draw" sequencing intact.
		const enteringRef = useRef(isFirstRender);
		const isEntering = enteringRef.current;
		const phaseTiming = isEntering ? initial : update;
		const isFade = entranceSection.type === 'fade';

		// The host `AnimatedLinePath` only forwards a non-zero `entranceDelay`
		// while ITS OWN isFirstRender is true, so it too collapses to 0 on the
		// first re-render. Capture it once, on this marker's first render, so
		// the "wait for the line to draw" delay survives those re-renders.
		const entranceDelayRef = useRef(entranceDelay);
		// Likewise latch the marker-specific entrance duration so a re-render
		// during the entrance can't drop it. Falls back to the resolved
		// section duration when the host doesn't supply one (standalone points).
		const entranceDurationRef = useRef(entranceDuration);

		const { easing, immediate } = phaseTiming;

		// When the host drives the position (line/area markers, slice 3f), `cx`/
		// `cy` arrive as react-spring values — the marker is glued to its host
		// path's shared spring, so we must NOT spring the position here (a
		// second spring is exactly the desync the shared-spring model exists to
		// prevent). We still spring the entrance/fill channels. With plain
		// numbers (standalone points), the position is sprung as usual.
		const positionControlled = typeof cx !== 'number' || typeof cy !== 'number';

		// Hold the entrance until the host line/area has drawn on, then pop.
		// Standalone points fold `geometryDelay` on update so labels fade out
		// before the dot glides; host-driven markers rely on `usePointGlide`.
		let effectiveDelay: number;
		if (immediate) {
			effectiveDelay = 0;
		} else if (isEntering) {
			effectiveDelay = phaseTiming.geometryDelay + entranceDelayRef.current;
		} else if (positionControlled) {
			effectiveDelay = updateSection.delay;
		} else {
			effectiveDelay = phaseTiming.geometryDelay;
		}

		let effectiveDuration: number;
		if (isEntering && entranceDurationRef.current !== undefined) {
			effectiveDuration = entranceDurationRef.current;
		} else if (positionControlled) {
			effectiveDuration = updateSection.duration;
		} else {
			effectiveDuration = phaseTiming.geometryDuration;
		}

		// Stable numeric seeds for the position keys. When the host controls
		// the position these are unused (we render the passed values directly),
		// but keeping them in the spring keeps its shape — and react-spring's
		// inferred return type — stable across the controlled/standalone split.
		const numericCx = typeof cx === 'number' ? cx : 0;
		const numericCy = typeof cy === 'number' ? cy : 0;

		// IMPORTANT: `from` must be a stable, mount-only snapshot. The
		// declarative `useSpring` treats a changing `from` between renders as
		// "reset the spring to this new start", which makes `from === to` and
		// the spring settle instantly — no animation arc. Capture the entrance
		// seed once: `pop` collapses the radius to 0, `fade` collapses opacity
		// to 0; everything else starts at its target.
		const initialFromRef = useRef(
			isFade
				? { cx: numericCx, cy: numericCy, r, fill, opacity: 0, fillOpacity }
				: { cx: numericCx, cy: numericCy, r: 0, fill, opacity, fillOpacity }
		);

		const springs = useSpring({
			to: { cx: numericCx, cy: numericCy, r, fill, opacity, fillOpacity },
			from: initialFromRef.current,
			config: { duration: effectiveDuration, easing },
			delay: effectiveDelay,
			immediate,
			onRest: () => {
				// Entrance finished — release the latch so subsequent data
				// changes use the `update` section timing, not the held
				// entrance delay.
				enteringRef.current = false;
			},
		});

		const composedClassName = className ? `visx-circle ${className}` : 'visx-circle';
		// In the editor (and under reduced motion) springs run with
		// `immediate: true`. react-spring can fail to push live inspector
		// changes for fill/opacity through the animated channel, so bind
		// paint props directly whenever we are not actually tweening.
		const useDirectPaint = immediate;

		return (
			<animated.circle
				ref={ref}
				{...rest}
				className={composedClassName}
				cx={positionControlled ? cx : useDirectPaint ? numericCx : springs.cx}
				cy={positionControlled ? cy : useDirectPaint ? numericCy : springs.cy}
				r={useDirectPaint ? r : springs.r}
				fill={useDirectPaint ? fill : springs.fill}
				opacity={useDirectPaint ? opacity : springs.opacity}
				fillOpacity={useDirectPaint ? (fillOpacity ?? 1) : springs.fillOpacity}
			/>
		);
	}
);

AnimatedCircle.displayName = 'AnimatedCircle';

export default AnimatedCircle;
