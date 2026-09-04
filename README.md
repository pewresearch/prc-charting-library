# @prc/charting-library

A comprehensive, production-ready charting library for Pew Research Center,
built on [Airbnb's visx](https://airbnb.io/visx/) (formerly vx) and d3.js. The **editor**
uses React; the **frontend** uses a Preact Script Module that bridges to the
WordPress Interactivity API. This library provides 22 customizable chart types
optimized for data journalism and research publication.

**Author**: Pew Research Center **Contributors**: Benjamin Wormald **License**:
MIT **Copyright**: 2023-2026 Pew Research Center

> Chart type counts below are the `layout.type` values routed by
> `src/lib/controller/ChartBuilder.tsx`, which is the authoritative list. Some
> types resolve to two renderers depending on `layout.orientation` (a `bar` is
> either `BarHorizontal` or `BarVertical`), so there are 22 types and 25
> renderers.

## Overview

The PRC Charting Library is designed specifically for the PRC Platform and
WordPress VIP environment, providing:

- **22 chart types** including bar charts, line charts, maps, and more
- **Responsive design** with mobile-first approach
- **Accessibility** with ARIA labels and keyboard navigation
- **Interactive tooltips** with smart positioning
- **Customizable styling** via comprehensive configuration
- **TypeScript support** for type safety
- **WordPress integration** for seamless block editor usage

## Chart Types

### Bar Charts (7 types)

- **`BarHorizontal`** - Standard horizontal bar chart
- **`BarVertical`** - Standard vertical (column) chart
- **`StackedBarHorizontal`** - Stacked horizontal bars for multi-series data
- **`StackedBarVertical`** - Stacked vertical bars for multi-series data
- **`DivergingBarHorizontal`** - Horizontal diverging bars (e.g., agree/disagree
  scales)
- **`DivergingBarVertical`** - Vertical diverging bars
- **`ExplodedBar`** - Bar chart with categorical breakdown and value comparison

### Line & Area Charts (2 types)

- **`Line`** - Line chart with support for multiple series, symbols, and
  regression lines
- **`StackedArea`** - Stacked area chart for cumulative data visualization

### Point Charts (3 types)

- **`Scatter`** (`scatter`) - Scatter plot for correlation and distribution
  analysis
- **`DotPlot`** (`dot-plot`) - Cleveland dot plot for precise value comparison
- **`BeeSwarm`** (`bee-swarm`) - Force-dodged distribution plot, one dot per
  observation. The first table column is the row label and the plotted value
  lives in a named category column — see the "Data model" note below.

### Part-to-Whole & Hierarchical (4 types)

- **`Pie`** (`pie`) - Pie/donut chart for part-to-whole relationships
- **`Treemap`** (`treemap`) - Nested-rectangle hierarchy
- **`Waffle`** (`waffle`) - Unit/square-grid proportions
- **`SankeyChart`** (`sankey`) - Flow diagram between node stages

### Comparison & Composite (3 types)

- **`Radar`** (`radar`) - Radar/spider chart across shared axes
- **`DiffColumn`** - Before/after difference columns (rendered as part of a
  chart, not a top-level `layout.type`)
- **`SmallMultiples`** (`small-multiples`) - Grid of repeated small charts
  faceted by category

### Map Charts (7 types)

- **`World`** (`map-world`) - World map with customizable projections (Mercator,
  Robinson, Natural Earth, etc.)
- **`WorldOrthographic`** (`map-world-orthographic`) - Globe/orthographic
  projection
- **`AlbersUSA`** (`map-usa`) - US map with Alaska and Hawaii insets using Albers
  USA projection
- **`AlbersUSACounties`** (`map-usa-counties`) - US county-level choropleth map
- **`AlbersUSACBSA`** (`map-usa-cbsa`) - US metro-area (CBSA) map
- **`BlockUSA`** (`map-usa-block`) - Block cartogram US state map (equal-sized
  states)
- **`HexUSA`** (`map-usa-hex`) - Hex-tile cartogram US state map

Bubble overlays for the bubble-capable maps come from `MapBubbleLayer` /
`MapBubbleLegend`.

**Geo-points overlay** (`dataRender.mapStyle === 'geo-points'`) places bubbles at
explicit lat/lon coordinates from chart data while country polygons remain a gray
background. Configure column bindings on `map.geoPoints`:

```typescript
dataRender: {
  mapStyle: 'geo-points',
},
map: {
  geoPoints: {
    latitudeColumn: 'lat',
    longitudeColumn: 'lon',
    labelColumn: 'region',
    sizeCategory: 'population', // optional; falls back to map category
    fixedRadius: 12, // optional; skips size scaling when set
    fill: '#4E79A7',
  },
},
```

Implemented by `MapGeoPointLayer` on `World` and `WorldOrthographic` maps. Pass `animatePosition={false}` on the layer when bubbles should snap to coordinates (the orthographic globe preset uses this).

## Shared Utilities

The library depends on `@prc/charting-utilities`, a shared package containing:

### Compute (`/compute`)

Framework-agnostic compute helpers (this folder was previously named `hooks/`):

- **`aria.ts`** - ARIA labels and accessibility attributes
- **`axes.ts`** - Axis configuration and tick formatting
- **`beeswarmForce.ts`** - Force simulation for beeswarm dot packing
- **`data.ts`** - Data transformation and aggregation utilities
- **`grid.ts`** - Grid line configuration
- **`labels.ts`** - Data label positioning and formatting
- **`legend.ts`** - Legend configuration and rendering
- **`line.ts`** - Line chart-specific utilities (symbols, curves)
- **`nodes.ts`** - Node shape color resolution for point-based charts
- **`scatter.ts`** - Scatter plot utilities
- **`size.ts`** - Responsive sizing and dimension calculations
- **`text.ts`** - Text wrapping and positioning
- **`tooltips.ts`** - Tooltip content formatting
- **`voronoi.ts`** - Voronoi diagram for hover detection

Label layout compute lives in `/labelLayout`, and React hooks (including
`useSize`) live in `/hooks`.

### Types (`/types`)

Complete TypeScript definitions for all chart configurations including:

- `BaseConfig` - Core configuration interface
- `Layout`, `DataRender`, `Tooltip`, `Legend`, `Labels` - Component
  configurations
- Chart-specific types for bars, lines, maps, etc.

### Utilities (`/utilities`)

- **`baseConfig.ts`** - Default configuration generator
- **`colorPalettes.ts`** - PRC color palettes and themes
- **`DataContext.ts`** - React context for chart data and config
- **`getPointRadiusScale.ts`** - Variable point sizing (`sqrt` / `linear` / `log`)
- **`dodge.ts`** - Collision-avoidance placement used by dot-based charts
- **`resolveCategoryColor.ts`** - Category-to-color resolution
- **`loadTopology.ts`** / **`mapRegionPresets.ts`** - Map topology loading and
  region presets
- **`regression.ts`** - Regression fits (`computeRegressionStats`,
  `getRegressionFn`)
- **`helpers.ts`** - Shared helper functions, including `generateElementKey` for
  per-element custom styles

`useSize` is a React hook and lives in `/hooks/useSize.ts`, not here.

## Installation & Setup

This library is part of the PRC Platform monorepo and uses npm workspaces.

### Development

```bash
# Start development with hot reload
npm run start

# or
npm run dev
```

### Building

```bash
# Build both editor (React) and frontend (Preact Script Module) outputs
npm run build

# From repo root (cache-aware via Turbo)
npx turbo build --filter=@prc/charting-library

# Type checking only
npm run type-check
```

### Dual build (React editor / Preact frontend)

`webpack.config.js` exports **two** configs from the same source tree:

| Build    | Output            | WordPress registration                | Runtime                    | Interactivity store               |
| -------- | ----------------- | ------------------------------------- | -------------------------- | --------------------------------- |
| Editor   | `build/editor.js` | Classic script `prc-charting-library` | React 18                   | none — `useChartStore` is a no-op |
| Frontend | `build/view.js`   | Script Module `@prc/charting-library` | Preact via `preact/compat` | `prc-chart-builder/chart` store   |

The Preact bundle also exposes `window.prcChartingLibrary` as a compat shim for
`prc-custom-charts` (not yet on the dual-build path).

**Author-facing docs:**

- [Chart Builder docs](../../docs/plugins/prc-chart-builder/index.md) — plugin documentation landing page
- [reactive store](../../docs/plugins/prc-chart-builder/reactive-store.md) — per-chart store, `setChart` / `setData` actions, consumer-block recipes
- [console helpers](../../docs/plugins/prc-chart-builder/console-helpers.md) — `window.prcChartBuilder.debug.*` devtools handles

### Code Quality

```bash
# Lint code
npm run lint

# Fix linting issues
npm run lint:fix

# Format code with Prettier
npm run format

# Clean build artifacts
npm run clean
```

## Usage

### Basic Example

The package's public entry point exports the `ChartBuilder*` controllers rather
than the individual chart renderers. `ChartBuilderWrapper` reads `layout.type` and
routes to the right renderer, so you do not import `BarHorizontal` directly:

```tsx
import { ChartBuilderWrapper } from '@prc/charting-library';

function MyChart() {
	const data = [
		{ x: 'A', value: 30 },
		{ x: 'B', value: 50 },
		{ x: 'C', value: 20 },
	];

	const config = {
		layout: {
			type: 'bar',
			orientation: 'horizontal',
			width: 600,
			height: 400,
			padding: { top: 20, right: 20, bottom: 40, left: 60 },
		},
		dataRender: {
			x: 'x',
			categories: ['value'],
		},
		// ... other configuration
	};

	return <ChartBuilderWrapper data={data} config={config} />;
}
```

The full export surface is `ChartBuilderWrapper`, `ChartBuilderTextWrapper`,
`ChartBuilderRenderer`, and `useChartStore` — see
[`src/lib/index.ts`](src/lib/index.ts).

## Key Features

### Responsive Tooltips

Tooltips automatically adapt based on viewport size, using `layout.mobileBreakpoint`
(default `480`):

- **Desktop (window width ≥ `mobileBreakpoint`)**: Portal-rendered tooltips that
  escape container boundaries
- **Mobile (window width < `mobileBreakpoint`)**: Bounded tooltips
  (`TooltipWithBounds`) that stay within the viewport

This prevents clipping in narrow containers while maintaining mobile UX.

### Unified tooltip mode

Line and stacked-area charts support an alternate tooltip mode for multi-series
time series. Set `tooltip.mode` to `'unified'` (default is `'point'`):

```typescript
tooltip: {
  active: true,
  mode: 'unified',
  format: '{{row}}: {{value}}',
},
```

| Mode | Behavior |
| ---- | -------- |
| `point` | Voronoi hit-testing resolves one data point per hover (existing behavior). |
| `unified` | Pointer x snaps to the nearest column with data; the tooltip lists every series at that x. A vertical crosshair spans the plotted values. |

Unified mode bypasses Voronoi so the tooltip stays live anywhere in the column,
including empty plot space above the lines. Column assembly lives in
`@prc/charting-utilities/unifiedTooltip/` (`buildUnifiedTooltipColumns`,
`findNearestColumn`); rendering uses `useUnifiedTooltip`, `Crosshair`, and
`UnifiedTooltipRows` in `src/lib/overlays/`.

`tooltip.minDisplayValue` applies in both modes — values below the floor render
as `<0.1` or `<10K` rather than rounding to zero.

### Group Breaks

Bar charts and dot plots support visual grouping with configurable break lines:

```typescript
dataRender: {
  groupBreaksActive: true,
  groupBreaksCategory: 'category',
  groupBreaks: {
    breakStyles: {
      variation: 'dashed',
      stroke: '#999',
      strokeWidth: 1,
      height: 20
    },
    labelStyles: {
      fill: '#000',
      fontStyle: 'normal'
    }
  }
}
```

### Diff Columns

Horizontal bar charts can display a "difference" column for comparative
analysis:

```typescript
diffColumn: {
  active: true,
  category: 'difference',
  columnHeader: 'Diff',
  dx: 0,
  dy: 0,
  style: {
    fill: '#000',
    // ... rect + text styling
  }
}
```

Per-cell text and styling overrides go in `diffColumn.customLabels`, keyed by
row. There is no `width` field — the column sizes itself from its content.

### Interactive Features

- **Zoom & Pan** - Available on maps and select chart types
- **Tooltips** - Hover and focus-based tooltips with custom formatting
- **Clickable Elements** - Configurable click handlers via `events.click`
- **Draggable Labels** - In WordPress editor for precise positioning

### Accessibility

All charts include:

- ARIA labels and roles
- Keyboard navigation support
- Screen reader descriptions
- Semantic HTML structure

## Configuration

For complete configuration documentation, see the
[Chart Builder Config Notion page](https://www.notion.so/Chart-Builder-Config-4731c3ecd6fb4e6494d569fe36184ebd).

### Common Configuration Sections

`BaseConfig` is a large object type — the authoritative definition is in
`@prc/charting-utilities/types/configTypes.ts`. The most commonly used groups:

```typescript
type BaseConfig = {
	layout: Layout; // Size, padding, theme, type, orientation, mobileBreakpoint
	dataRender: DataRender; // Data mapping, categories, sorting, group breaks
	dependentAxis: dependentAxis; // Y-axis (vertical) or X-axis (horizontal)
	independentAxis: independentAxis; // X-axis (vertical) or Y-axis (horizontal)
	colors: Colors; // Palette config object (not a bare string[])
	tooltip: Tooltip; // Tooltip configuration
	legend: Legend; // Legend configuration
	labels: Labels; // Data label configuration
	annotations: AnnotationsConfig; // Text/line annotations
	shapes: Shapes; // Per-element custom styles
	nodes: Nodes; // Point sizing + fill/stroke for point charts
	// ... plus per-chart-type groups: bar, beeSwarm, pie, treemap, map, etc.
};
```

## Architecture

### Component Structure

`src/lib/` is organized by **dependency layer**, so a folder's location encodes
what it is allowed to import. Each folder has its own README with the precise
admission rules; [`src/lib/README.md`](src/lib/README.md) is the index.

```
src/lib/
├── primitives/   # 0 — Low-level SVG/React primitives
├── store/        # 1 — Chart reactive store (useChartStore)
├── animation/    # 2 — Transition engine + Animated* components
├── labels/       # 2 — Label components + leader-line cluster
├── overlays/     # 3 — Chrome: Legend, Tooltip, axes, BreakLine,
│                 #     PlotBands, AlignmentGuides, annotations
├── charts/       # 4 — One renderer per chart type
│   ├── maps/     #     AlbersUSA, AlbersUSACBSA, HexUSA, World, ...
│   ├── waffle/
│   └── small-multiples/
├── controller/   # 5 — ChartBuilder* orchestration + type routing
├── presets/      # —   Example chart configs (dev/examples only)
└── data/maps/    # —   GeoJSON/topology data + generation scripts
```

Framework-agnostic compute (scales, label layout, force simulation, tooltip
formatting) lives outside this tree in `@prc/charting-utilities`.

### Data Flow

1. **Data & Config** provided via `DataContext`
2. **Size Calculation** using `useSize` hook (container + window dimensions)
3. **Scale Generation** using visx scales (linear, band, time, etc.)
4. **Rendering** using visx primitives (shapes, axes, grids)
5. **Interaction** using visx events and tooltips

## Dependencies

### Core Dependencies

- **React 18.3+** — editor build UI framework
- **Preact 10+** (`preact/compat`) — frontend Script Module runtime
- **@wordpress/interactivity** — frontend chart store bridge (Script Module consumers)
- **visx 3.12+** — Low-level visualization primitives
- **d3** (select modules) — Data manipulation and projections
- **TypeScript 5.8+** — Type safety

### Build Tools

- **@wordpress/scripts** - WordPress-optimized webpack configuration
- **Babel 7** - JavaScript transpilation
- **Sass** - CSS preprocessing

## Browser Support

- Modern browsers (Chrome, Firefox, Safari, Edge)
- IE11 not supported
- Mobile browsers (iOS Safari, Chrome Android)

## Testing

```bash
# Run unit tests
npm run test

# Run unit tests in watch mode
npm run test:watch
```

Playwright E2E specs are centralized at the repo root under `tests/<plugin-slug>/`
and run with `npm test` from the root against the VIP dev-env.

## Contributing

This library is maintained by the Pew Research Center. For bug reports or
feature requests, please open an issue in the
[prc-platform repository](https://github.com/pewresearch/prc-platform).

### Development Workflow

1. Make changes in the appropriate `src/lib/` layer folder (see Architecture above)
2. Update shared utilities in `@prc/charting-utilities` if needed
3. Run `npm run type-check` to verify TypeScript
4. Run `npx turbo build --filter=@prc/charting-library` from the repo root to compile
5. Test in WordPress environment via playground:
    ```bash
    cd /path/to/prc-platform
    npm run vip:start
    ```

## Related Packages

- **[@prc/charting-utilities](../prc-scripts/includes/scripts/src/@prc/charting-utilities/)** -
  Shared utilities, types, and hooks
- **@prc/block-library** - WordPress blocks that use these charts
- **@prc/platform-core** - Core PRC Platform functionality

## License

MIT

Copyright © 2023-2026 Pew Research Center

## Resources

- [visx Documentation](https://airbnb.io/visx/)
- [D3 Documentation](https://d3js.org/)
- [PRC Platform Documentation](../../README.md)
- [Chart Configuration Guide](https://www.notion.so/Chart-Builder-Config-4731c3ecd6fb4e6494d569fe36184ebd)
