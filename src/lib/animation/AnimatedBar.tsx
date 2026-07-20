/**
 * AnimatedBar — drop-in replacement for visx's <Bar> that springs
 * `x`/`y`/`width`/`height`/`fill`/`opacity`/`fillOpacity` between renders.
 *
 * visx's <Bar> is literally `<rect className="visx-bar" {...rest}>` (see
 * `node_modules/@visx/shape/lib/shapes/Bar.js`). To stay a true drop-in we
 * mirror that contract exactly: rest-spread every unrecognized prop onto the
 * underlying `animated.rect`, forward a `ref`, and compose the `visx-bar`
 * class. The only props we intercept are the seven we spring (geometry +
 * fill/opacity) plus the two animation hints (`orientation`/`baseline`). A
 * stray `rx`, `data-*`, or `aria-*` therefore lands on the rect untouched
 * instead of being silently dropped.
 *
 * Cross-runtime: imports from `@react-spring/web`, which `import`s from
 * `react`. The Preact view bundle's webpack alias (`react -> preact/compat`)
 * routes that to preact transparently; the React editor build uses the
 * package natively. No build-tier-specific code lives here.
 *
 * Spring config notes:
 *   - We use duration-based easing instead of spring physics
 *     (`tension`/`friction`). Editorial charts want predictable timing,
 *     not bouncy motion.
 *   - The default duration (400ms) is read from `config.animation.duration`
 *     via `DataContext` (see `useAnimationConfig`), so authors can
 *     globally retune via `setConfig`.
 *   - On mount, bars grow from a pinned baseline edge rather than fading in.
 *     This is more legible for editorial bar charts than an opacity fade
 *     because it telegraphs "this is a magnitude" from the first frame. The
 *     entrance is orientation- and baseline-aware (see below).
 *   - When `config.animation.enabled` is `false` OR the user has
 *     `prefers-reduced-motion: reduce` set at the OS level, we
 *     short-circuit by passing `immediate: true` to react-spring so
 *     updates render instantly with no transition. This keeps Playwright
 *     snapshot tests and accessibility users happy without introducing
 *     a separate static-rect branch.
 *
 * Orientation / baseline:
 *   SVG `<rect>` is anchored at its top-left corner `(x, y)`, so growing a
 *   bar out of a fixed edge means animating BOTH the position and the size
 *   of the axis the bar grows along. `orientation` picks the growth axis and
 *   `baseline` pins the edge the bar grows out of:
 *     - vertical (default): seed `y = baseline ?? (y + height)`, `height = 0`.
 *       Without a baseline this is the bar's own bottom edge — grow up from
 *       the x-axis (the historical BarVertical behavior). With a baseline
 *       (e.g. a diverging chart's zero line) positive bars grow up and
 *       negative bars grow down, both anchored to that line.
 *     - horizontal: seed `x = baseline ?? x`, `width = 0`. Without a baseline
 *       grow right from the left edge; with one, grow out from the zero line
 *       in both directions.
 */
import { SVGProps, forwardRef, useRef } from 'react';
import { useSpring, animated } from '@react-spring/web';

import useTransitionTiming from './useTransitionTiming';

export interface AnimatedBarProps extends Omit<SVGProps<SVGRectElement>, 'x' | 'y' | 'width' | 'height' | 'ref'> {
	x: number;
	y: number;
	width: number;
	height: number;
	/** Growth axis for the entrance. Defaults to `'vertical'`. */
	orientation?: 'vertical' | 'horizontal';
	/**
	 * Coordinate of the edge the bar grows out of on mount. For vertical bars
	 * this is a `y` (default: the bar's bottom edge); for horizontal bars an
	 * `x` (default: the bar's left edge). Pass a chart's zero line here for
	 * diverging charts so bars grow out of the axis in both directions.
	 */
	baseline?: number;
}

const AnimatedBar = forwardRef<SVGRectElement, AnimatedBarProps>(
	(
		{ x, y, width, height, fill, opacity, fillOpacity, orientation = 'vertical', baseline, className, ...rest },
		ref
	) => {
		// `initial` drives the entrance (grow-from-baseline) on first mount;
		// `update` drives data-change transitions thereafter. Each AnimatedBar
		// owns its own hook instance, so `isFirstRender` flips per-bar. Easing
		// and durations are resolved inside the timing hook; `immediate`
		// already folds in reduced-motion + editor + disabled state.
		//
		// On update, `geometryDelay` folds in `LABEL_FADE_MS` so the geometry
		// spring waits for the bar labels to finish fading out before it
		// starts moving — keeping the bar tween in lockstep with
		// `TransitionProvider`'s phase machine without reading its context.
		const { isFirstRender, initial, update } = useTransitionTiming('bar');
		const phaseTiming = isFirstRender ? initial : update;
		const { geometryDuration: duration, easing, geometryDelay: delay, immediate } = phaseTiming;

		// IMPORTANT: `from` must be a stable, mount-only snapshot. The
		// declarative form of `useSpring` treats a changing `from` between
		// renders as "reset the spring to this new starting position", so
		// passing the *current* prop values in `from` on every render makes
		// `from === to` and the spring settles instantly — no animation arc.
		// Capture the initial geometry/fill once in a ref so subsequent renders
		// only update `to`, which is what react-spring actually animates
		// between.
		//
		// The seeded edge depends on orientation/baseline (see the file
		// header): vertical bars collapse to a horizontal baseline (`height:
		// 0`), horizontal bars collapse to a vertical baseline (`width: 0`).
		const initialFromRef = useRef(
			orientation === 'horizontal'
				? {
						x: baseline ?? x,
						y,
						width: 0,
						height,
						fill,
						opacity,
						fillOpacity,
					}
				: {
						x,
						y: baseline ?? y + height,
						width,
						height: 0,
						fill,
						opacity,
						fillOpacity,
					}
		);

		// useSpring's typed return narrows to the union of `from` keys when
		// `from` is provided. Use the `to` form so the returned `springs`
		// object exposes all animated values — `from` then only seeds the
		// initial state for the keys we want to start somewhere other than
		// their target.
		const springs = useSpring({
			to: { x, y, width, height, fill, opacity, fillOpacity },
			from: initialFromRef.current,
			config: { duration, easing },
			delay,
			immediate,
		});

		const composedClassName = className ? `visx-bar ${className}` : 'visx-bar';

		return (
			<animated.rect
				ref={ref}
				{...rest}
				className={composedClassName}
				x={springs.x}
				y={springs.y}
				width={springs.width}
				height={springs.height}
				fill={springs.fill}
				opacity={springs.opacity}
				fillOpacity={springs.fillOpacity}
			/>
		);
	}
);

AnimatedBar.displayName = 'AnimatedBar';

export default AnimatedBar;
