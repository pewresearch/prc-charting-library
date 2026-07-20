# `store/`

**What lives here:** The chart reactive store — `useChartStore` and `useChartStore.editor`. Kinds: hook, types.

**Layer + dependency rule:** Layer 1. May import `@prc/charting-utilities` and external deps. Must **not** import `animation/`, `labels/`, `overlays/`, `charts/`, or `controller/`.

**Admission test:** Is it global chart state consumed by the controller and chart marks? If yes, here.
