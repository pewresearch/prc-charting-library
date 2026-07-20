# Charting Library Reorg — Layer-Based Structure

> **Scope:** `@prc/charting-library` `src/lib/` only. Internal refactor — **no public API change**.
> **Bump:** `patch` (behavior-preserving).

## TL;DR

`src/lib/Components/` has become a catch-all that mixes ~5 concerns (chart marks, chrome/overlays, hooks, providers, framework-agnostic engines/utils, and types). This proposal moves the library to a **layer-based** layout — top-level folders ordered by dependency direction, so that *location encodes the dependency layer* and the structure scales by addition rather than accretion.

This supersedes the earlier "feature-first" target. The audit, safety analysis, hotspots, and phased forwarding-seam mechanics below are unchanged; only the destination structure differs.

---

## The problem (audit findings)

### Smell 1 — `Components/` mixes ~5 concerns

| Bucket | Examples | Really a component? |
| --- | --- | --- |
| Chart marks (real d3 renderers) | `Bar*`, `DivergingBar*`, `StackedBar*`, `ExplodedBar`, `DiffColumn`, `Line`, `StackedArea`, `Scatter`, `DotPlot`, `Pie`, `Radar`, `Sankey`, `Treemap` | Yes |
| Chrome / overlays / interaction | `Legend`, `ClickableLegend`, `ClickableTicks`, `Tooltip`, `PlotBands`, `HorizontalRule`, `BreakLine`, `AlignmentGuides`, `DrawingsLayer`, `NetValueLabels`, `DraggableLabel` | Component, different kind |
| Text primitives | `Text` (Title/Subtitle/…), `SvgText` | Primitive |
| Hooks | `animated/use*` (4), `labelLayout/use*` (`useLabelDeclutter`, `useLeaderLineRegistration`, `useDirectSeriesLegend`) | No |
| Providers | `animated/TransitionProvider`, `animated/PieRevealProvider`, `labelLayout/LeaderLineContext` | No |
| Framework-agnostic engines/utils | `labelLayout/{computeLabelDeclutter,forceRectCollide,measureLabel,buildLineChartLabels,buildOnLineSeriesLabels,buildScatterLabels,leaderLineGeometry,leaderLineStore,helpers}`, `maps/getDisplayCentroid` | No |
| Types | `labelLayout/types` | No |

`labelLayout/` is the largest example: a ~19-file label + leader-line + direct-series-legend subsystem (components, hooks, a provider/context, a store factory, several engines, and types) living under `Components/`. `animated/` does the same (components + hooks + providers colocated). The codebase keeps reaching for colocation organically, just inconsistently and buried under `Components/`.

### Smell 2 — the component re-export file leaks utils

`Components/index.ts` re-exports non-components onto the component surface: `wordWrap` (actually defined in `labelLayout/measureLabel`), `formatNetValueLabel`, and the six `buildNetValueItems*` builders.

### Smell 3 — naming collisions

- **`maps/` means two things:** `lib/maps/` is geojson/topology **data + node scripts**, while `lib/Components/maps/` is the **map components**.
- **`Text` is defined twice:** `Text.tsx` exports `Title/Subtitle/SourceNote/…`; `SvgText.tsx` exports a component literally named `Text`.

### Dead code

- `Components/Zoom.tsx` is a stub (`<span>Zoom component tk</span>`) and is not exported. Real zoom is `@visx/zoom` in the map components.

---

## Why layer-based, not feature-first

An earlier draft proposed a "feature-first" layout (`features/{labels,animation,legend,tooltip,axes,annotations}`). The actual import graph contradicts its premise that these are independent features:

- `Components/NetValueLabels.tsx` (a label) imports `./animated`, and `animated/AnimatedLabel.tsx` imports `../DraggableLabel` (a label) — a real **labels↔animation cycle**. They move together; they are not independent features.
- Every chart mark imports the chrome surface as **one unit** via the barrel (`StyledTooltip, StyledLegend, AnnotationsLayer, DrawingsLayer, DraggableLabel, ClickableLegend`).

"Feature-first" is an application idiom (group by user-facing capability). This is a composition engine: chart renderers compose chrome + labels + animation + primitives in a clear dependency **layering**. The honest organizing axis is **rendering role / layer**, where the dependency direction *is* the structure.

---

## Target structure

```
src/lib/
├── primitives/     # SvgText (low-level text primitive)
├── store/          # useChartStore + useChartStore.editor
├── animation/      # Animated* + TransitionProvider/PieRevealProvider + use* hooks
├── labels/         # the label subsystem
│   ├── engine/       # framework-agnostic compute (extraction-ready — see Follow-ups):
│   │                 #   computeLabelDeclutter, forceRectCollide, measureLabel,
│   │                 #   buildLineChartLabels, buildOnLineSeriesLabels, buildScatterLabels,
│   │                 #   leaderLineGeometry, leaderLineStore, helpers, types
│   ├── leader-line/  # the leader-line React cluster (LeaderLine, LeaderLineUnderlay,
│   │                 #   LeaderLineContext, LabelLeaderLineRegistrar, useLeaderLineRegistration)
│   └── *.tsx         # DraggableLabel, NetValueLabels, OnLineSeriesLabel, DirectSeriesLegendLabels,
│                     #   useLabelDeclutter, useDirectSeriesLegend
├── overlays/       # ALL chrome: Legend, ClickableLegend, Tooltip, PlotBands,
│                   #   ClickableTicks, BreakLine, HorizontalRule, AlignmentGuides,
│                   #   DrawingsLayer, Text (titles/annotations)
├── charts/         # the d3 renderers, one per chart type (+ DiffColumn)
│   └── maps/       # map renderers + getDisplayCentroid + MapBubble*
├── controller/     # ChartBuilder* (was Controller/)
├── presets/        # config presets (was Templates/)
├── data/maps/      # geojson/topology + node scripts (was lib/maps/)
└── index.ts        # public API (UNCHANGED)
```

Layer ordering (low → high deps): `primitives` < `store` < `animation`/`labels` < `overlays` < `charts` < `controller`.

### Taxonomy principle: `overlays/` vs `labels/`

A data label is visually an overlay (it's drawn on top of the plot, and `DraggableLabel` is consumed in the same barrel line as `StyledTooltip`/`StyledLegend`). They are kept separate on a **substance** axis, not a visual one:

- **`overlays/` = presentational chrome.** ~10 self-contained components that draw a thing (legend, tooltip, axis ticks, plot bands, rules, annotations text, drawings layer).
- **`labels/` = an engine-backed subsystem.** ~19 files: components + hooks + a provider/context + a *layout engine* (`forceRectCollide`, `computeLabelDeclutter`, `leaderLineGeometry`, `leaderLineStore`, `measureLabel`) + types. Pure-compute files like `forceRectCollide` are not overlays in any sense.

The admission rule for a top-level sibling is therefore: **"is it a cohesive, engine-backed subsystem with its own internal API surface?"** `labels/` qualifies (it already has its own `labelLayout/index.ts` seam and a tested engine surface — the 5 external Jest tests). `animation/` qualifies for the same reason (transition engine + providers + hooks), even though it too is visually an overlay layer. Folding `labels/` into `overlays/` is explicitly rejected: it would bury a force-simulation engine among presentational chrome and recreate the `Components/` junk drawer one level down.

### Per-folder READMEs (the anti-drift mechanism)

Every top-level folder (and the engine-heavy nested ones — `labels/leader-line/`, `charts/maps/`, `data/maps/`) gets a short `README.md` so a reader can tell at a glance what belongs there. Keep each to a tight template (~5–8 lines):

- **What lives here** — one sentence + the kinds of files (component / hook / engine / provider / data).
- **Layer + dependency rule** — which layers it may import from and which it must **not** (e.g. `overlays/` may import `primitives/`, `animation/`, `labels/`; must not import `charts/` or `controller/`).
- **Admission test** — what earns a file a place here vs. a sibling (`labels/` vs `overlays/`: "engine-backed subsystem" vs "presentational chrome").

A top-level `src/lib/README.md` holds the map: the layer diagram, the low→high ordering, and the sibling-vs-nested admission rules. These READMEs are authored in Phase 0, folder by folder as each is scaffolded, so they exist before any file moves into them.

---

## Why it's safe to do mechanically

- **Public API is unaffected.** `src/index.js` does `export * from './lib'`, and `src/lib/index.ts` only re-exports the `ChartBuilder*` controller entry points, `useChartStore` (+ its `ChartStoreSlice` type), and a set of named utilities from `@prc/charting-utilities`. Chart components are internal.
- **External consumers** (`prc-chart-builder` `view.js` / `edit/index.jsx`) only use `ChartBuilderRenderer` / `useChartStore`.
- **The re-export files are a forwarding seam.** Two exist: `Components/index.ts` (the marks + chrome surface) and `labelLayout/index.ts` (the label subsystem's own surface). Keep both alive during the move and most files relocate with zero call-site edits. Keep re-exports **explicitly named** (not `export *`) to dodge the known `Text` and `wordWrap` symbol clashes.

---

## Migration plan (phased, each phase stays green)

Keep the forwarding re-export files alive through phases 1–6; remove/slim them in phase 7. Per phase: `git mv` files → fix the moved file's own relative imports → update re-export paths → update direct importers → run `tsc` + ESLint + Turbo build before continuing. Each phase is independently shippable.

### Phase 0 — Scaffold + doc
Create target dirs + per-folder re-export index files + a `README.md` in every top-level folder (and `labels/leader-line/`, `labels/engine/`, `charts/maps/`, `data/maps/`) plus the top-level `src/lib/README.md` map; commit this doc / a `.cursor/rules` entry capturing the taxonomy + admission test. Keep both forwarding seams alive. **No source files move yet** — Phase 0 only adds empty scaffolding + docs, so it ships green on its own.

> **macOS gotcha:** `Controller/` and `controller/` are the same directory on a case-insensitive FS. Phase 0 adds a `README.md` to the existing `Controller/` folder but **does not** replace `Controller/index.ts` with a stub — that happens in Phase 7 via a two-step `git mv`.

### Phase 1 — Free-win renames
Delete dead `Zoom.tsx`; `lib/maps/` → `data/maps/` (fix the ~35 dynamic json imports + `tsconfig` exclude + the `prc-block-tables/.../validation.ts` comment); `Templates/` → `presets/` (fix `examples/App.tsx` + `tsconfig` exclude + `DotPlot.tsx` comment); move `SvgText` primitive → `primitives/`.

### Phase 2 — store/
Move `useChartStore(.editor)` → `store/`; update `lib/index.ts` + `controller` (`ChartBuilderWrapper`) imports.

### Phase 3 — animation/
Move `animated/*` → `animation/`; update the `Components/index.ts` `export * from './animated'`, `NetValueLabels` import, and `AnimatedLabel`'s `../DraggableLabel` import.

### Phase 4 — labels/
Move `DraggableLabel`, `NetValueLabels`, and the whole `labelLayout/` subsystem. **Isolate the framework-agnostic engine into `labels/engine/`** (`computeLabelDeclutter`, `forceRectCollide`, `measureLabel`, `buildLineChartLabels`, `buildOnLineSeriesLabels`, `buildScatterLabels`, `leaderLineGeometry`, `leaderLineStore`, `helpers`, `types`) so it is extraction-ready for the follow-up; put the leader-line React cluster in `labels/leader-line/`; keep the remaining components/hooks flat in `labels/`. Update re-exports, `Line`/`Scatter`/`DotPlot`/`StackedArea`/`NetValueLabels` imports, `DraggableLabel`'s deep imports, **and the five external Jest tests** that deep-import into `labelLayout/` (see Hotspots) — point them at the new `labels/engine/` paths.

### Phase 5 — overlays/
Move `Legend, ClickableLegend, Tooltip, PlotBands, ClickableTicks, BreakLine, HorizontalRule, AlignmentGuides, DrawingsLayer, Text` → `overlays/`; update re-exports + the charts/maps that import chrome via the barrel.

### Phase 6 — charts/
Move all chart-type marks + `DiffColumn` + the `maps/` subdir → `charts/` (+ `charts/maps/`); update re-exports + `controller` imports.

### Phase 7 — Seam cleanup
Slim/remove the monolithic `Components/index.ts`; rewrite internal call sites to the new folder re-exports; case-safe rename `Controller` → `controller` (two-step `git mv` via temp name); update `lib/index.ts`.

### Phase 8 — Verify + changeset
See Verification below.

### Phase 9 — Update `charting-library-new-chart-type` skill
After Phases 1–7 land (paths are final), refresh [`.cursor/skills/charting-library-new-chart-type/SKILL.md`](../../../.cursor/skills/charting-library-new-chart-type/SKILL.md) and its companion [`architecture.md`](../../../.cursor/skills/charting-library-new-chart-type/architecture.md) so agents creating new chart types follow the layer-based layout — not the legacy `Components/` paths.

**Stale today (will be wrong post-reorg):**
- Key locations table: `Components/`, `Components/maps/`, `Controller/`
- Step 3: new chart file path (`Components/[YourChart].tsx` → `charts/[YourChart].tsx`; maps → `charts/maps/`)
- Step 4: export barrel (`Components/maps/index.ts` → `charts/maps/index.ts` + `charts/index.ts`)
- Step 5: `Controller/ChartBuilder.tsx` → `controller/ChartBuilder.tsx`
- Shared chrome imports: `StyledLegend`, `DraggableLabel`, etc. from `overlays/` + `labels/` (not monolithic `Components/index`)
- Map topology dynamic imports: `../../data/maps/...` (not `../../maps/...`)
- Label patterns: `DraggableLabel` lives in `labels/`; reference `src/lib/README.md` + per-folder READMEs for layer rules

**Deliverables:** updated skill + architecture doc; optional cross-link from [`src/lib/README.md`](../src/lib/README.md) to the skill. No runtime/code change — docs-only, ships with or immediately after the Phase 8 changeset.

---

## Hotspots to edit (do not miss)

- **~35 dynamic `import('../../maps/<...>.json')`** calls in the map components (`World.tsx` alone has 28; plus `AlbersUSA*`, `BlockUSA`, `HexUSA`, `WorldOrthographic`, `AlbersUSACBSA`) — webpack code-splitting depends on these paths. **TypeScript cannot verify these string paths**, so the map-render smoke test is a required gate, not a nicety.
- **`tsconfig.json` `exclude` globs name two dirs the reorg renames** (lines ~48–49): `./src/lib/maps/usa/node.js` and `./src/lib/Templates/**/*`. After `lib/maps/` → `data/maps/` and `Templates/` → `presets/`, update the excludes in the same commit as each rename, or the excluded node script + template config files get pulled into the TS program.
- **Stale path reference in a comment:** `prc-block-tables/src/table/utils/validation.ts:126` documents the `prc-charting-library/src/lib/maps/usa-cbsa/topology.json` path. Repoint when `lib/maps/` moves.
- **`src/examples/App.tsx`** — 13 `Templates/*` imports (+ a comment in `DotPlot.tsx`).
- **Five external tests** deep-import `.../Components/labelLayout/<file>` and must all be repointed to `.../labels/...`:
    - `tests/unit/label-declutter.test.js` → `computeLabelDeclutter`
    - `tests/unit/scatter-dotplot-declutter.test.js` → `computeLabelDeclutter`
    - `tests/unit/on-line-series-labels.test.js` → `computeLabelDeclutter`, `buildOnLineSeriesLabels`, `useDirectSeriesLegend`
    - `tests/unit/leader-line-store.test.js` → `leaderLineStore`
    - `tests/unit/leader-line-geometry.test.js` → `leaderLineGeometry`
- **Case-only renames** (`Components` → gone/split, `Controller` → `controller`) on case-insensitive macOS FS with `forceConsistentCasingInFileNames: true` — use a two-step `git mv` via a temp name so git records the rename.
- **Controller** imports `../Components` and `../hooks/useChartStore` → repoint to the relevant re-exports and `../store`.
- **Keep the new re-export files explicitly named — don't reach for `export *`.** The current `Components/index.ts` uses named re-exports to dodge two known symbol clashes: `Text` (defined in both `SvgText.tsx` and `Text.tsx`) and `wordWrap` (defined in `labelLayout/measureLabel`, also surfaced via `DraggableLabel`). A blanket `export *` throws an ambiguous-re-export `tsc` error.

---

## Verification

- `npx tsc --noEmit` and `npx eslint <changed> --ext .ts,.tsx` clean (respect the 500-line/file cap; add no new violations).
- `npx turbo build --filter=@prc/charting-library... --filter=@prc/chart-builder` green.
- Run **all five** label/leader-line unit tests (the regression anchor that proves the engine + leader-line files moved correctly):
  `npm test -w @prc/chart-builder -- tests/unit/label-declutter.test.js tests/unit/scatter-dotplot-declutter.test.js tests/unit/on-line-series-labels.test.js tests/unit/leader-line-store.test.js tests/unit/leader-line-geometry.test.js`
- Manual smoke in the VIP dev-env: line / bar / scatter / pie / **map** render; labels, leader lines, animation, tooltips intact. The map render specifically exercises the dynamic-import paths that `tsc` can't check.
- Add a `patch` changeset: "internal: layer-based source reorg, no public API change."

---

## Critical review / risks

The structure is sound; almost everything that could go wrong is mechanical and caught by each phase's `tsc` + build gate. The one thing those gates *don't* catch:

- **The ~35 dynamic map-data imports.** They are string literals, so `tsc` is blind to them — a wrong path compiles fine and only fails when that map renders. This is the single genuine risk; everything else in the Hotspots list fails loudly in-phase. Treat the map smoke test as a required gate.

Otherwise: the audit is accurate — `Components/` genuinely holds ~30 flat files plus nested grab-bags spanning marks, chrome, hooks, providers, engines, and types. A layer-based layout with per-folder READMEs and a disciplined sibling-vs-nested admission test (engine-backed subsystem vs presentational chrome) is a real, durable improvement, and the per-phase forwarding seam keeps each step green.

---

## Follow-ups (separate tickets, separate package)

This reorg is **Ticket A**. Two related follow-ups are deliberately kept out of scope (different package, different changeset, broader blast radius). They are planned in [`@prc/charting-utilities` → CHARTING-UTILITIES-REORG.md](../../prc-scripts/includes/scripts/src/@prc/charting-utilities/CHARTING-UTILITIES-REORG.md):

- **Ticket B — `@prc/charting-utilities` taxonomy cleanup.** Its `hooks/` folder is almost entirely non-hooks (`get*` prop/data builders); the real React hooks are split across `hooks/` + `utilities/`. Rename `hooks/` → `compute/`, consolidate the real hooks. `patch`, internal.
- **Ticket C — label-engine extraction.** Move `labels/engine/` (isolated in Phase 4 above) out of this plugin into the cleaned-up `@prc/charting-utilities`, aligning labels with the existing externalization convention. `minor` on charting-utilities + `patch` here. Repoints the 5 anchor tests across packages.

Phase 4's `labels/engine/` isolation exists specifically to make Ticket C a near-mechanical lift.

**Same ticket, late:** Phase 9 updates the [`charting-library-new-chart-type`](../../../.cursor/skills/charting-library-new-chart-type/SKILL.md) Cursor skill after Phase 7 — see Phase 9 above.
