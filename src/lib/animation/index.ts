/**
 * Animated chart primitives (PRC-17 slice 3b+).
 *
 * Drop-in replacements for visx primitives that spring their geometry
 * props between renders. Each Animated* component reads
 * `config.animation` via `useAnimationConfig` so authors get a single
 * lever to disable animation globally and the OS-level
 * `prefers-reduced-motion` preference is honored automatically.
 *
 * Current rollout:
 *   - slice 3e — AnimatedBar (orientation/baseline-aware) across the whole
 *     bar family: BarVertical, BarHorizontal, StackedBarVertical/Horizontal,
 *     DivergingBarVertical/Horizontal (incl. ghost + neutral overlays),
 *     and ExplodedBar.
 *   - slice 3f — AnimatedLinePath + AnimatedArea (line/area family:
 *     Line, StackedArea, Scatter regression line). These own the shared
 *     point-array spring (`usePointGlide`) that glides the host path and its
 *     markers together (Option A — markers cannot drift off the curve).
 *     Line/area markers reuse AnimatedCircle, fed each marker's `cx`/`cy`
 *     from that shared spring via the `AnimatedLinePath` render-prop.
 *   - slice 3g — AnimatedCircle on standalone point marks: Scatter points,
 *     DotPlot dots; DotPlot `connectPoints` connector uses AnimatedLinePath
 *     (segment spring from 3f) so endpoints glide with the dots. The
 *     connector is also a "follow" (secondary) element: it waits for the
 *     dots to finish popping in (via `initial.follow`) before drawing on.
 *   - slice 3g-v / 3e-v — AnimatedLabel + TransitionProvider choreograph
 *     labels (fade out old → geometry travels → fade in new) across the bar,
 *     circle/point, line/area, and pie families. Geometry primitives read
 *     `useTransitionTiming(family)` so their update spring waits out the
 *     label fade (`geometryDelay` folds in `LABEL_FADE_MS`).
 *   - slice 3h — AnimatedArc on pie slices: springs `startAngle`/`endAngle`
 *     and rebuilds the slice `d` via the host's arc generator each frame
 *     (angles interpolate; the path string never does). Entrance `sweep`
 *     (per-slice fan-out) or `clockwise` (shared wipe via PieRevealProvider).
 *     Group separator arcs use `AnimatedPieGroupSeparatorArc` with the label
 *     transition clock (hidden during slice geometry, fade in after).
 *
 * Follow (secondary) animations: a generic, family-agnostic `initial.follow`
 * config (resolved to an absolute delay in `useAnimationConfig`) drives any
 * element that must wait for its primary to finish — line/area markers
 * (wait for the path to draw), the dot-plot connector (waits for the dots).
 * Hosts forward the resolved `follow.delay`/`follow.duration` to the
 * dependent primitive's generic `entranceDelay`/`entranceDuration` props, so
 * new dependent animations never need a new schema key.
 *
 * Enter/exit lifecycle note: newly added rows grow in (per-bar mount
 * entrance) and surviving rows spring to their new geometry. Removed rows
 * unmount immediately — that's intentional. Row removal is an explicit
 * editorial action; a graceful collapse-to-baseline would fight the
 * rendering model (visx owns the bar layout via render-props, so a removed
 * row is already absent from the next render and can't be kept alive
 * without a parallel ghost-bookkeeping layer), and a lingering ghost bar /
 * orphaned axis label is more confusing than a clean disappearance.
 *
 * Deliberately deferred follow-ups:
 *   - AnimatedLine, AnimatedPath, AnimatedCircle, etc. as we extend
 *     animation to the other ~11 chart types.
 *   - AnimatedAxis / AnimatedGrid via `@visx/react-spring`.
 */
export { default as AnimatedBar } from './AnimatedBar';
export type { AnimatedBarProps } from './AnimatedBar';
export { default as AnimatedCircle } from './AnimatedCircle';
export type { AnimatedCircleProps } from './AnimatedCircle';
export { default as AnimatedLinePath } from './AnimatedLinePath';
export type { AnimatedLinePathProps, AnimatedLinePathChildApi } from './AnimatedLinePath';
export { default as AnimatedArea } from './AnimatedArea';
export type { AnimatedAreaProps } from './AnimatedArea';
export { default as AnimatedArc } from './AnimatedArc';
export type { AnimatedArcProps } from './AnimatedArc';
export { default as AnimatedPieGroupSeparatorArc, buildSeparatorArcPath } from './AnimatedPieGroupSeparatorArc';
export type { AnimatedPieGroupSeparatorArcProps } from './AnimatedPieGroupSeparatorArc';
export { PieRevealProvider, usePieReveal, PIE_FULL_TURN } from './PieRevealProvider';
export type { PieRevealProviderProps, PieRevealContextValue } from './PieRevealProvider';
export { default as usePointGlide } from './usePointGlide';
export type { GlidePoint, GlideValue, UsePointGlideResult } from './usePointGlide';
export { default as useAnimationConfig } from './useAnimationConfig';
export type {
	AnimationFamily,
	ResolvedEntranceType,
	ResolvedAnimationSection,
	UseAnimationConfigResult,
} from './useAnimationConfig';
export { default as useTransitionTiming, LABEL_FADE_MS } from './useTransitionTiming';
export type { PhaseTiming, UseTransitionTimingResult } from './useTransitionTiming';
export { TransitionProvider, TransitionContext, useChartTransition } from './TransitionProvider';
export type { TransitionPhase, TransitionContextValue, TransitionProviderProps } from './TransitionProvider';
export { default as useLabelOpacity } from './useLabelOpacity';
export { AnimatedBarLabel } from './AnimatedBarLabel';
export type { AnimatedBarLabelProps } from './AnimatedBarLabel';
export { AnimatedLabel } from './AnimatedLabel';
export type { AnimatedLabelProps } from './AnimatedLabel';
