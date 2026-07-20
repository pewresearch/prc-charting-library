/**
 * PieRevealProvider — one shared clockwise wipe for a `<Pie>` (PRC-17 slice 3h).
 *
 * Per-slice `sweep` grows each wedge from its own leading edge in parallel.
 * `clockwise` is different: a single reveal angle advances from the pie's
 * `pieStartAngle` to `pieEndAngle` (0 → 360° on a full ring, or the group's
 * angular span on grouped pies). Each `AnimatedArc` clamps its slice to
 * `[startAngle, min(endAngle, revealAngle)]`, so the ring reads as one
 * clockwise wipe (d3/visx default: 0 at 12 o'clock, angles increase
 * clockwise).
 *
 * Slice N does not need its own delay — it stays hidden until the shared
 * `revealAngle` passes its `startAngle`, then grows only to
 * `min(endAngle, revealAngle)`. That is the sequential wipe; it only works
 * when this provider stays active for the full entrance (latched below).
 *
 * Only active on first mount when `initial.type === 'clockwise'`. Data-change
 * updates still use per-slice angle springs on `AnimatedArc`. Wrap once per
 * `<VisxPie>` (data slices and, if desired, category-label rings with the
 * same angular bounds).
 */
import { createContext, useContext, useLayoutEffect, useMemo, useRef, useState, ReactNode } from 'react';
import { useSpring, SpringValue } from '@react-spring/web';

import useAnimationConfig from './useAnimationConfig';
import useTransitionTiming from './useTransitionTiming';

/** Full turn in radians — matches d3/visx default pie layout. */
export const PIE_FULL_TURN = Math.PI * 2;

export interface PieRevealContextValue {
	/** Leading edge of the wipe, in radians (animated on entrance). */
	revealAngle: SpringValue<number>;
	/** True while the clockwise entrance wipe is running. */
	active: boolean;
}

const PieRevealContext = createContext<PieRevealContextValue | null>(null);

/** Read the active pie wipe, if any. `null` outside a provider or when inactive. */
export function usePieReveal(): PieRevealContextValue | null {
	return useContext(PieRevealContext);
}

export interface PieRevealProviderProps {
	/** Angular start of this pie (grouped pies pass their segment bounds). */
	pieStartAngle?: number;
	/** Angular end of this pie. */
	pieEndAngle?: number;
	children: ReactNode;
}

export function PieRevealProvider({
	pieStartAngle = 0,
	pieEndAngle = PIE_FULL_TURN,
	children,
}: PieRevealProviderProps) {
	const { initial } = useTransitionTiming('pie');
	const { initial: entrance } = useAnimationConfig('pie');

	// Latch clockwise entrance at mount. `isFirstRender` from the hook flips
	// false on the very next re-render (resize, tooltip, parent state) — if we
	// keyed `active` off that live flag, the provider would drop context after
	// one frame and every `AnimatedArc` would fall back to per-slice sweep,
	// which looks identical to the sweep entrance. Hold the wipe until the
	// shared spring settles (mirrors `AnimatedCircle`'s entrance latch).
	const clockwiseAtMountRef = useRef(!initial.immediate && entrance.type === 'clockwise');
	const [wipeActive, setWipeActive] = useState(clockwiseAtMountRef.current);

	const [springs, api] = useSpring(() => ({
		revealAngle: wipeActive ? pieStartAngle : pieEndAngle,
	}));

	// Mount-only entrance for the shared wipe. Pin the start angle synchronously
	// (same lesson as `usePointGlide`'s `api.set({ t: 0 })` before a delayed
	// start) so frame 0 shows an empty pie, not the full ring.
	useLayoutEffect(() => {
		if (!clockwiseAtMountRef.current) {
			api.set({ revealAngle: pieEndAngle });
			return;
		}
		api.set({ revealAngle: pieStartAngle });
		api.start({
			to: { revealAngle: pieEndAngle },
			config: { duration: initial.geometryDuration, easing: initial.easing },
			delay: initial.geometryDelay,
			onRest: () => setWipeActive(false),
		});
		// Mount-only.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	const value = useMemo<PieRevealContextValue>(
		() => ({
			revealAngle: springs.revealAngle,
			active: wipeActive,
		}),
		[wipeActive, springs.revealAngle]
	);

	// Keep the provider mounted after the wipe so `AnimatedArc` can tell a
	// clockwise pie from a sweep pie (`pieReveal !== null`) and does not replay
	// per-slice sweep when `active` flips false.
	if (!clockwiseAtMountRef.current) {
		return <>{children}</>;
	}

	return <PieRevealContext.Provider value={value}>{children}</PieRevealContext.Provider>;
}

export default PieRevealProvider;
