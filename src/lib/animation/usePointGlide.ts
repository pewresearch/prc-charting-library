/**
 * usePointGlide — the shared point-array spring that powers Option A
 * ("glide together") for the line/area family (PRC-17 slice 3f).
 *
 * The locked coordination decision for slice 3f is that a line/area's host
 * geometry and the markers sitting on it must move as ONE unit on a data
 * change — they are physically incapable of drifting. Two independent
 * springs (one for the path `d`, one for each marker's `cx`/`cy`) *will*
 * desync, and the desync is worst on curved interpolations
 * (`cardinal`/`basis`) where control points move nonlinearly, so a linearly
 * interpolated marker floats off the curve mid-tween.
 *
 * This hook is the single shared clock. It springs a scalar `t` from 0 → 1
 * on each data change and interpolates the underlying *point values* (not
 * the path `d` string) between the previous and next frames. Both the path
 * (rebuilt from the lerped points via the same `@visx/shape` curve
 * generator the static chart uses) and the markers (read straight off the
 * same lerped points) derive from this one `t`, so they share a frame of
 * reference at every step. The marker keeps exactly the relationship to the
 * curve it has statically, at every `t`.
 *
 * Why a scalar `t` + manual value lerp instead of springing the flattened
 * coordinate array directly: letting react-spring interpolate the array (or
 * the `d` string) throws "The arity of each output value must be equal" the
 * moment the point count changes (see airbnb/visx#1317 — the same reason
 * `@visx/xychart` tweens 0 → 1 with `d3-interpolate-path`). Interpolating the
 * numbers ourselves never hits that, and — unlike `d3-interpolate-path` /
 * flubber, which interpolate the path *shape* and expose no per-data-point
 * coordinate mid-tween — it keeps the markers glued. Those path-shape
 * interpolators remain the documented fallback for a smooth *path-only*
 * morph across different-length series (deferred; they cannot carry glued
 * markers anyway).
 *
 * Changed-length updates: a continuous glide between series of different
 * lengths is undefined (which old point maps to which new one?), so we snap
 * the geometry to the new shape (`t` jumps to 1) and let the consuming
 * primitive re-run its entrance (draw / fade) — the Option B-style redraw
 * fallback the slice plan calls for.
 *
 * `prefers-reduced-motion`, the editor opt-out, the master `enabled` switch,
 * and the per-section `update.enabled` toggle are all already folded into
 * `update.immediate` by `useAnimationConfig`; this hook just adds the
 * changed-length case on top.
 */
import { useLayoutEffect, useMemo, useRef } from 'react';
import { useSpring, to as interpolateTo } from '@react-spring/web';
import type { Interpolation } from '@react-spring/web';

import useAnimationConfig, { AnimationFamily, ResolvedAnimationSection } from './useAnimationConfig';
import useTransitionTiming from './useTransitionTiming';

/** A point in pixel space with one or more numeric coordinate channels. */
export type GlidePoint = Record<string, number>;

/** An animated coordinate channel, or a plain number when not animating. */
export type GlideValue = Interpolation<number, number> | number;

export interface UsePointGlideResult<T extends GlidePoint> {
	/**
	 * Build an animated `d` string from a curve-aware path generator (e.g.
	 * the `path` handed back by `<LinePath>` / `<Area>`'s render-prop). The
	 * generator is called with the lerped points on every frame.
	 */
	toPath: (build: (points: T[]) => string | null | undefined) => Interpolation<number, string> | string;
	/**
	 * The animated value of one coordinate channel (`'x'`, `'y'`, `'y0'`, …)
	 * for the point at `index`, glued to the same `t` that drives `toPath`.
	 */
	valueAt: (index: number, key: keyof T) => GlideValue;
	/** True only on the consuming component's first render (mount). */
	isFirstRender: boolean;
	/** Resolved entrance (first-mount) section. */
	initial: ResolvedAnimationSection;
	/** Resolved data-change (update) section. */
	update: ResolvedAnimationSection;
	/**
	 * True when the current update should snap rather than glide: the update
	 * section is immediate (disabled / reduced-motion / editor) OR the point
	 * count changed so a continuous glide is undefined.
	 */
	immediate: boolean;
}

function lerp(from: number, target: number, t: number): number {
	return from + (target - from) * t;
}

/**
 * Share a single spring across a series' path and its markers so they glide
 * together on data changes (Option A).
 *
 * @param points Current points in pixel space (already scaled).
 * @param family Animation family used to resolve timing/easing.
 * @return Path/value accessors bound to the shared spring, plus timing flags.
 */
export function usePointGlide<T extends GlidePoint>(
	points: T[],
	family: AnimationFamily = 'line'
): UsePointGlideResult<T> {
	const { isFirstRender, initial, update } = useAnimationConfig(family);
	const { update: updateTiming } = useTransitionTiming(family);

	// Previous frame's points are the lerp origin. Seeded to the current
	// points so the first render is an identity lerp (static full shape — the
	// entrance is the primitive's job, not this hook's).
	const prevPointsRef = useRef<T[]>(points);
	const fromPoints = prevPointsRef.current;
	const toPoints = points;

	const sameLength = fromPoints.length === toPoints.length;
	const updateImmediate = update.immediate || !sameLength;

	// Identity key so the effect only fires when the geometry actually moves.
	const pointsKey = useMemo(
		() =>
			points
				.map((p) =>
					Object.keys(p)
						.map((k) => p[k])
						.join(',')
				)
				.join(';'),
		[points]
	);
	const mountedKeyRef = useRef<string | null>(null);

	const [{ t }, api] = useSpring(() => ({ t: 1 }));

	// useLayoutEffect (not useEffect) so the `t: 0` seed lands before the
	// browser paints — otherwise the path would flash the new shape for one
	// frame (react-spring reads `t = 1` at render time) before springing back
	// to the old shape and forward again.
	useLayoutEffect(() => {
		const isMountRun = mountedKeyRef.current === null;
		mountedKeyRef.current = pointsKey;
		prevPointsRef.current = points;
		if (isMountRun) {
			return;
		}
		if (updateImmediate) {
			api.set({ t: 1 });
			return;
		}
		// Pin `t` to the OLD shape SYNCHRONOUSLY, then start the (possibly
		// delayed) glide. A bare `api.start({ from: { t: 0 }, delay })` does
		// NOT hold the old shape during `geometryDelay`: react-spring only
		// applies `from` once the delayed animation actually begins, so the
		// path renders at the settled `t = 1` (the NEW shape) for the whole
		// delay window — a flash to the final position. Declarative springs
		// (AnimatedCircle dots) naturally hold their current value during the
		// delay, so without this `set` the connector and dots desync: the
		// connector flicks to its landing spot while the dots correctly wait.
		// Setting `t = 0` up front makes the path hold the old shape through
		// the label fade-out, matching the dots, then both glide together.
		api.set({ t: 0 });
		api.start({
			to: { t: 1 },
			config: { duration: updateTiming.geometryDuration, easing: updateTiming.easing },
			delay: updateTiming.geometryDelay,
		});
		// `points`/`api` are stable refs in practice; keying on the value
		// signature is what we actually want to react to.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [pointsKey]);

	const toPath = (build: (pts: T[]) => string | null | undefined) => {
		if (!sameLength) {
			return build(toPoints) || '';
		}
		const keys = toPoints.length ? Object.keys(toPoints[0]) : [];
		return t.to((tv: number) => {
			const lerped = toPoints.map((target, i) => {
				const origin = fromPoints[i];
				const next = {} as T;
				keys.forEach((k) => {
					(next as GlidePoint)[k] = lerp(origin[k], target[k], tv);
				});
				return next;
			});
			return build(lerped) || '';
		});
	};

	const valueAt = (index: number, key: keyof T): GlideValue => {
		const target = toPoints[index]?.[key] ?? 0;
		if (!sameLength) {
			return target;
		}
		const origin = fromPoints[index]?.[key] ?? target;
		return interpolateTo([t], (tv: number) => lerp(origin, target, tv));
	};

	return {
		toPath,
		valueAt,
		isFirstRender,
		initial,
		update,
		immediate: updateImmediate,
	};
}

export default usePointGlide;
