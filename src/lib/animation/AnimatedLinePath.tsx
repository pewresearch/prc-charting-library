/**
 * AnimatedLinePath — animated drop-in for visx's `<LinePath>` that owns the
 * shared point-array spring for the line/area family (PRC-17 slice 3f).
 *
 * This is the host in the "glide together" coordination model (Option A,
 * locked for slice 3f): the line path AND the markers that sit on it are
 * driven by ONE spring (`usePointGlide`), so they cannot desync. The path
 * `d` is rebuilt every frame from the lerped points using the *same*
 * `@visx/shape` curve generator the static chart uses (obtained from
 * `<LinePath>`'s render-prop), and the markers read their `cx`/`cy` off the
 * identical lerped points via the `children` render-prop. A marker therefore
 * holds the exact relationship to the curve it has statically, at every
 * frame of the tween — even on `cardinal`/`basis` curves where control
 * points move nonlinearly.
 *
 * Entrance (first mount), resolved from the line/area family entrance type
 * (`'auto'` → `'draw'`):
 *   - `draw` (default, solid lines): SVG `pathLength="1"` + animate
 *     `stroke-dashoffset` 1 → 0 so the stroke reveals itself without any DOM
 *     measuring. Markers `pop`/`fade` in over the same window (their own
 *     `AnimatedCircle` entrance) so they never appear ahead of the line.
 *   - `fade`: animate path `opacity` 0 → 1. Also used as the draw fallback
 *     when the line is itself dashed (`strokeDasharray`), since the
 *     dashoffset technique would fight an author's dash pattern.
 *   - `none`: the hook returns `immediate`, so the path renders at target.
 *
 * On a data change the path `d` springs via `usePointGlide`; on a
 * changed-length data change (where a continuous glide is undefined) the
 * geometry snaps and the entrance re-runs as a redraw — the Option B-style
 * fallback the slice plan calls for.
 *
 * Cross-runtime: imports from `@react-spring/web` (which `import`s `react`,
 * aliased to `preact/compat` in the view bundle). No build-tier code here.
 */
import { ReactNode, SVGProps, useLayoutEffect, useRef } from 'react';
import { LinePath } from '@visx/shape';
import { animated, useSpring } from '@react-spring/web';

import usePointGlide, { GlidePoint, GlideValue } from './usePointGlide';
import { AnimationFamily } from './useAnimationConfig';

/** What the `children` render-prop receives to glue markers to the path. */
export interface AnimatedLinePathChildApi {
	/** Animated `cx`/`cy` for the marker at `index`, glued to the path spring. */
	pointAt: (index: number) => { cx: GlideValue; cy: GlideValue };
	/** Whether marker entrances should be suppressed (reduced motion / editor). */
	immediate: boolean;
	/**
	 * Delay (ms) markers should hold their entrance so they pop/fade in only
	 * AFTER the path has finished drawing on. Zero unless this is the first
	 * render with a "draw" entrance. Pass straight to `AnimatedCircle`'s
	 * `entranceDelay`.
	 */
	entranceDelay: number;
	/**
	 * Duration (ms) the markers should use for their entrance pop, resolved
	 * from `animation.initial.follow.duration` (falling back to the entrance
	 * duration). Lets a slow line draw be topped with a snappy marker pop.
	 * Pass straight to `AnimatedCircle`'s `entranceDuration`.
	 */
	entranceDuration: number;
}

export interface AnimatedLinePathProps extends Omit<SVGProps<SVGPathElement>, 'd' | 'ref' | 'points' | 'children'> {
	/** Series points in pixel space (already scaled). */
	points: GlidePoint[];
	/**
	 * The `@visx/curve` factory the static chart uses for this series.
	 * Omit for a straight line (d3 defaults to `curveLinear`).
	 */
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	curve?: any;
	/** Animation family (`'line'` or `'area'`). Defaults to `'line'`. */
	family?: AnimationFamily;
	/** Render-prop for markers, glued to the shared spring. */
	children?: (api: AnimatedLinePathChildApi) => ReactNode;
	/**
	 * Extra delay (ms) folded into this path's OWN entrance, used when the
	 * path is itself a "follow" (secondary) element waiting on another
	 * primary — e.g. the dot-plot connector waiting for its dots to pop in.
	 * The host passes the resolved `initial.follow.delay` here. Latched on
	 * mount; ignored on data-change updates. Defaults to 0 (path is a primary).
	 */
	entranceDelay?: number;
	/**
	 * Duration (ms) override for this path's OWN entrance, paired with
	 * `entranceDelay` when the path acts as a follow element. Falls back to
	 * the resolved entrance duration. Ignored on data-change updates.
	 */
	entranceDuration?: number;
}

const accessX = (p: GlidePoint) => p.x;
const accessY = (p: GlidePoint) => p.y;

const AnimatedLinePath = ({
	points,
	curve,
	family = 'line',
	children,
	strokeDasharray,
	entranceDelay = 0,
	entranceDuration,
	// visx `<LinePath>` parity: lines default to no fill and round caps.
	fill = 'none',
	strokeLinecap = 'round',
	...rest
}: AnimatedLinePathProps) => {
	const glide = usePointGlide<GlidePoint>(points, family);
	const { isFirstRender, initial } = glide;

	const hasDash = strokeDasharray !== undefined && strokeDasharray !== null && strokeDasharray !== '';
	// Draw decoration only for solid lines whose entrance is "draw"; dashed
	// lines fall back to a fade so we don't fight the author's dash pattern.
	const drawDecor = initial.type === 'draw' && !hasDash;

	const entranceAnimating = isFirstRender && !initial.immediate;

	// When the path is itself a follow (secondary) element — e.g. the
	// dot-plot connector waiting for its dots — the host passes an absolute
	// `entranceDelay` (the dots' full pop window) and an optional duration.
	// Latch both on mount so a re-render landing inside the wait window can't
	// drop them (mirrors AnimatedCircle). A primary line passes neither.
	const ownEntranceDelayRef = useRef(entranceDelay);
	const ownEntranceDurationRef = useRef(entranceDuration);
	const ownEntranceDelay = initial.delay + ownEntranceDelayRef.current;
	const ownEntranceDuration = ownEntranceDurationRef.current ?? initial.duration;

	const [entrance, entranceApi] = useSpring(() => ({
		dashoffset: entranceAnimating && drawDecor ? 1 : 0,
		opacity: entranceAnimating && !drawDecor ? 0 : 1,
	}));

	// Mount entrance (runs once).
	useLayoutEffect(() => {
		if (!entranceAnimating) {
			entranceApi.set({ dashoffset: 0, opacity: 1 });
			return;
		}
		entranceApi.start({
			from: { dashoffset: drawDecor ? 1 : 0, opacity: drawDecor ? 1 : 0 },
			to: { dashoffset: 0, opacity: 1 },
			config: { duration: ownEntranceDuration, easing: initial.easing },
			delay: ownEntranceDelay,
		});
		// Mount-only.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	// Changed-length redraw: a glide is undefined across different lengths, so
	// the geometry snaps (handled in usePointGlide) and the entrance replays.
	const prevLenRef = useRef(points.length);
	useLayoutEffect(() => {
		if (prevLenRef.current === points.length) {
			return;
		}
		prevLenRef.current = points.length;
		if (glide.update.immediate) {
			return;
		}
		const config = { duration: glide.update.duration, easing: glide.update.easing };
		if (drawDecor) {
			entranceApi.start({ from: { dashoffset: 1 }, to: { dashoffset: 0 }, config });
		} else {
			entranceApi.start({ from: { opacity: 0 }, to: { opacity: 1 }, config });
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [points.length]);

	// Markers (the path's follow/secondary element) wait for the draw to
	// finish before entering. The absolute delay is resolved once in the hook
	// (`initial.follow.delay` = primary delay + duration + offset). Only
	// meaningful on the first render with a "draw" entrance; otherwise there
	// is nothing to wait for (fade/none, or a data-change update where markers
	// glide), and a disabled follow lets them enter with the line (delay 0).
	const markerEntranceDelay = entranceAnimating && drawDecor && initial.follow.enabled ? initial.follow.delay : 0;

	const childApi: AnimatedLinePathChildApi = {
		pointAt: (index: number) => ({
			cx: glide.valueAt(index, 'x'),
			cy: glide.valueAt(index, 'y'),
		}),
		immediate: glide.immediate,
		entranceDelay: markerEntranceDelay,
		entranceDuration: initial.follow.duration,
	};

	const drawProps = drawDecor
		? { pathLength: 1, strokeDasharray: '1', strokeDashoffset: entrance.dashoffset }
		: { strokeDasharray };

	return (
		<>
			<LinePath data={points} x={accessX} y={accessY} curve={curve}>
				{({ path }) => (
					<animated.path
						{...rest}
						fill={fill}
						strokeLinecap={strokeLinecap}
						{...drawProps}
						opacity={entrance.opacity}
						d={glide.toPath((pts) => path(pts))}
					/>
				)}
			</LinePath>
			{children?.(childApi)}
		</>
	);
};

AnimatedLinePath.displayName = 'AnimatedLinePath';

export default AnimatedLinePath;
