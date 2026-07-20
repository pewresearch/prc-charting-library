/**
 * AnimatedArea — animated drop-in for visx's `<Area>` / `<AreaClosed>` for
 * the line/area family (PRC-17 slice 3f).
 *
 * Shares the same `usePointGlide` engine as `AnimatedLinePath`: the filled
 * area's `d` is rebuilt every frame from the lerped `{ x, y0, y1 }` points
 * using the *same* `@visx/shape` area generator the static chart uses
 * (obtained from `<Area>`'s render-prop). Because the area and its companion
 * line (`AnimatedLinePath`, rendered over it) read from springs with
 * identical timing/easing started on the same data change, they move in
 * lockstep. The line — not the area — is the marker host, so markers are
 * glued there; the area only needs to keep pace with the line, which a
 * matched spring guarantees.
 *
 * Entrance: areas are filled shapes, so a stroke-dashoffset "draw" reads
 * wrong. The family-native `draw` entrance is realized here as an `opacity`
 * 0 → 1 fade (the clip-path wipe alternative the plan mentions is deferred —
 * fade is robust and avoids per-instance clipPath id bookkeeping). On a data
 * change the area `d` springs; on a changed-length change it snaps and the
 * fade replays.
 *
 * Cross-runtime: imports from `@react-spring/web`; no build-tier code here.
 */
import { SVGProps, useLayoutEffect, useRef } from 'react';
import { Area } from '@visx/shape';
import { animated, useSpring } from '@react-spring/web';

import usePointGlide, { GlidePoint } from './usePointGlide';
import { AnimationFamily } from './useAnimationConfig';

export interface AnimatedAreaProps
	extends Omit<SVGProps<SVGPathElement>, 'd' | 'ref' | 'points'> {
	/** Area vertices in pixel space: `x` plus `y0` (baseline) and `y1` (top). */
	points: GlidePoint[];
	/** The `@visx/curve` factory the static chart uses for this series. */
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	curve: any;
	/** Animation family. Defaults to `'area'`. */
	family?: AnimationFamily;
}

const accessX = (p: GlidePoint) => p.x;
const accessY0 = (p: GlidePoint) => p.y0;
const accessY1 = (p: GlidePoint) => p.y1;

const AnimatedArea = ({ points, curve, family = 'area', ...rest }: AnimatedAreaProps) => {
	const glide = usePointGlide<GlidePoint>(points, family);
	const { isFirstRender, initial } = glide;

	const entranceAnimating = isFirstRender && !initial.immediate;

	const [entrance, entranceApi] = useSpring(() => ({
		opacity: entranceAnimating ? 0 : 1,
	}));

	// Mount entrance (fade in, once).
	useLayoutEffect(() => {
		if (!entranceAnimating) {
			entranceApi.set({ opacity: 1 });
			return;
		}
		entranceApi.start({
			from: { opacity: 0 },
			to: { opacity: 1 },
			config: { duration: initial.duration, easing: initial.easing },
			delay: initial.delay,
		});
		// Mount-only.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	// Changed-length redraw: geometry snaps (usePointGlide), fade replays.
	const prevLenRef = useRef(points.length);
	useLayoutEffect(() => {
		if (prevLenRef.current === points.length) {
			return;
		}
		prevLenRef.current = points.length;
		if (glide.update.immediate) {
			return;
		}
		entranceApi.start({
			from: { opacity: 0 },
			to: { opacity: 1 },
			config: { duration: glide.update.duration, easing: glide.update.easing },
		});
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [points.length]);

	return (
		<Area data={points} x={accessX} y0={accessY0} y1={accessY1} curve={curve}>
			{({ path }) => (
				<animated.path
					{...rest}
					opacity={entrance.opacity}
					d={glide.toPath((pts) => path(pts))}
				/>
			)}
		</Area>
	);
};

AnimatedArea.displayName = 'AnimatedArea';

export default AnimatedArea;
