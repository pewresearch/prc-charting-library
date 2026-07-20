# `animation/`

**What lives here:** The transition/animation subsystem — `Animated*` components, `TransitionProvider`, `PieRevealProvider`, and animation hooks (`useAnimationConfig`, `useLabelOpacity`, `usePointGlide`, `useTransitionTiming`). Kinds: component, hook, provider.

**Layer + dependency rule:** Layer 2 (coupled with `labels/`). May import `primitives/`, `labels/` (e.g. `DraggableLabel` via `AnimatedLabel`), `@prc/charting-utilities`. Must **not** import `overlays/`, `charts/`, or `controller/`.

**Admission test:** Is it part of the transition engine or an animated rendering wrapper? Engine-backed subsystem — earns top-level sibling status alongside `labels/`, not a subfolder of `overlays/`.
