# `charts/`

**What lives here:** D3 chart mark renderers — one component per chart type (`Bar*`, `Line`, `Scatter`, `Pie`, etc.) plus `DiffColumn`. Map marks live in [`maps/`](./maps/). Kinds: component.

**Layer + dependency rule:** Layer 4. May import `overlays/`, `labels/`, `animation/`, `primitives/`, `store/`, `@prc/charting-utilities`. Must **not** import `controller/`.

**Admission test:** Is it the primary data mark renderer for a chart type? If yes, here (or `charts/maps/` for geo marks).
