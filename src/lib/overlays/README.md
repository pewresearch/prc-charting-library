# `overlays/`

**What lives here:** Presentational chart chrome — legend, tooltip, axis ticks, plot bands, break lines, horizontal rules, alignment guides, drawings layer, annotation text (`Title`, `Subtitle`, etc.). Kinds: component.

**Layer + dependency rule:** Layer 3. May import `primitives/`, `animation/`, `labels/` (e.g. `DraggableLabel` on maps), `@prc/charting-utilities`. Must **not** import `charts/` or `controller/`.

**Admission test:** Presentational chrome that draws a thing without an engine-backed layout subsystem. Label layout compute → `@prc/charting-utilities/labelLayout/`, not here.
