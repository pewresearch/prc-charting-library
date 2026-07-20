# `labels/`

**What lives here:** Label React components and hooks — draggable/data labels, direct-series legend labels, leader-line UI. Kinds: component, hook.

**Layer + dependency rule:** Layer 2 (coupled with `animation/`). May import `primitives/`, `animation/`, `leader-line/`, `@prc/charting-utilities` (including `labelLayout/`). Must **not** import `overlays/`, `charts/`, or `controller/`.

**Admission test:** Engine-backed label subsystem vs presentational chrome. Layout engine compute lives in `@prc/charting-utilities/labelLayout/` — not here.
