# `primitives/`

**What lives here:** Low-level SVG/React building blocks — `SvgText` (styled SVG `<text>` primitive) and `PatternDef` (visx hatch for `url(#id)` fills). Kinds: component, types.

**Layer + dependency rule:** Layer 0 (lowest). May import `@prc/charting-utilities`. Must **not** import `store/`, `animation/`, `labels/`, `overlays/`, `charts/`, or `controller/`.

**Admission test:** Is it a reusable primitive with no chart-domain knowledge? If yes, here. Chart-specific text (titles, source notes) belongs in `overlays/Text`.
