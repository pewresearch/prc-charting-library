# @prc/charting-library

A comprehensive, production-ready charting library for Pew Research Center,
built on [Airbnb's visx](https://airbnb.io/visx/) (formerly vx). The **editor**
uses React; the **frontend** uses a Preact Script Module that bridges to the
WordPress Interactivity API. This library provides 17 customizable chart types
optimized for data journalism and research publication.

**Version**: 3.12.0 **Author**: Benjamin Wormald **License**: GPL-2.0-or-later

## Overview

The PRC Charting Library is designed specifically for the PRC Platform and
WordPress VIP environment, providing:

- **17 chart types** including bar charts, line charts, maps, and more
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

### Point Charts (2 types)

- **`Scatter`** - Scatter plot for correlation and distribution analysis
- **`DotPlot`** - Cleveland dot plot for precise value comparison

### Other Charts (2 types)

- **`Pie`** - Pie/donut chart for part-to-whole relationships

### Map Charts (4 types)

- **`World`** - World map with customizable projections (Mercator, Robinson,
  Natural Earth, etc.)
- **`AlbersUSA`** - US map with Alaska and Hawaii insets using Albers USA
  projection
- **`AlbersUSACounties`** - US county-level choropleth map
- **`BlockUSA`** - Block cartogram US state map (equal-sized states)

## Shared Utilities

The library depends on `@prc/charting-utilities`, a shared package containing:

### Hooks (`/hooks`)

- **`aria.ts`** - ARIA labels and accessibility attributes
- **`axes.ts`** - Axis configuration and tick formatting
- **`data.ts`** - Data transformation and aggregation utilities
- **`grid.ts`** - Grid line configuration
- **`labels.ts`** - Data label positioning and formatting
- **`legend.ts`** - Legend configuration and rendering
- **`line.ts`** - Line chart-specific utilities (symbols, curves)
- **`scatter.ts`** - Scatter plot utilities
- **`size.ts`** - Responsive sizing and dimension calculations
- **`text.ts`** - Text wrapping and positioning
- **`tooltips.ts`** - Tooltip content formatting
- **`voronoi.ts`** - Voronoi diagram for hover detection

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
- **`useSize.ts`** - Responsive sizing hook (returns container and window
  dimensions)
- **`helpers.ts`** - Shared helper functions

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

| Build | Output | WordPress registration | Runtime | Interactivity store |
| --- | --- | --- | --- | --- |
| Editor | `build/editor.js` | Classic script `prc-charting-library` | React 18 | none — `useChartStore` is a no-op |
| Frontend | `build/view.js` | Script Module `@prc/charting-library` | Preact via `preact/compat` | `prc-chart-builder/chart` store |

The Preact bundle also exposes `window.prcChartingLibrary` as a compat shim for
`prc-custom-charts` (not yet on the dual-build path).

**Author-facing docs:**

- [prc-chart-builder/docs/reactive-store.md](../prc-chart-builder/docs/reactive-store.md) — per-chart store, `setChart` / `setData` actions, consumer-block recipes
- [prc-chart-builder/docs/console-helpers.md](../prc-chart-builder/docs/console-helpers.md) — `window.prcChartingLibrary.debug.*` devtools handles

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

```tsx
import { BarHorizontal } from '@prc/charting-library';
import { DataContext } from '@prc/charting-utilities';

function MyChart() {
	const data = [
		{ category: 'A', value: 30 },
		{ category: 'B', value: 50 },
		{ category: 'C', value: 20 },
	];

	const config = {
		layout: {
			width: 600,
			height: 400,
			padding: { top: 20, right: 20, bottom: 40, left: 60 },
		},
		dataRender: {
			x: 'category',
			categories: ['value'],
		},
		// ... other configuration
	};

	return (
		<DataContext.Provider value={{ data, config }}>
			<BarHorizontal />
		</DataContext.Provider>
	);
}
```

## Key Features

### Responsive Tooltips

Tooltips automatically adapt based on viewport size:

- **Desktop (≥768px)**: Portal-rendered tooltips that escape container
  boundaries
- **Mobile (<768px)**: Bounded tooltips that stay within viewport

This prevents clipping in narrow containers while maintaining mobile UX.

### Group Breaks

Bar charts and dot plots support visual grouping with configurable break lines:

```typescript
dataRender: {
  groupBreaksActive: true,
  groupBreaksKey: 'category',
  groupBreaks: {
    breakHeight: 20,
    breakStyles: {
      variation: 'dashed',
      stroke: '#999',
      strokeWidth: 1
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
  width: 100,
  // ... styling options
}
```

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

```typescript
interface BaseConfig {
	layout: Layout; // Size, padding, theme, responsive behavior
	dataRender: DataRender; // Data mapping, categories, sorting
	dependentAxis: Axis; // Y-axis (vertical) or X-axis (horizontal)
	independentAxis: Axis; // X-axis (vertical) or Y-axis (horizontal)
	colors: string[]; // Color palette
	tooltip: Tooltip; // Tooltip configuration
	legend: Legend; // Legend configuration
	labels: Labels; // Data label configuration
	annotations: Annotation[]; // Text/line annotations
	// ... chart-specific config
}
```

## Architecture

### Component Structure

```
Components/
├── BarHorizontal.tsx          # Horizontal bar chart
├── BarVertical.tsx            # Vertical bar chart
├── Line.tsx                   # Line chart
├── Scatter.tsx                # Scatter plot
├── Pie.tsx                    # Pie chart
├── DotPlot.tsx                # Dot plot
├── StackedArea.tsx            # Stacked area
├── ExplodedBar.tsx            # Exploded bar
├── StackedBarHorizontal.tsx   # Stacked horizontal bars
├── StackedBarVertical.tsx     # Stacked vertical bars
├── DivergingBarHorizontal.tsx # Diverging horizontal bars
├── DivergingBarVertical.tsx   # Diverging vertical bars
├── maps/
│   ├── World.tsx              # World map
│   ├── AlbersUSA.tsx          # US map (Albers)
│   ├── AlbersUSACounties.tsx  # US counties map
│   └── BlockUSA.tsx           # US block cartogram
├── Tooltip.tsx                # Responsive tooltip component
├── Legend.tsx                 # Legend component
├── DraggableLabel.tsx         # Draggable label component
├── DiffColumn.tsx             # Difference column component
├── BreakLine.tsx              # Group break line
├── PlotBands.tsx              # Background bands
├── AlignmentGuides.tsx        # Editor alignment guides
└── index.ts                   # Component exports
```

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
# Run tests (when available)
npm run test

# Run tests with coverage
npm run test:coverage
```

## Contributing

This library is maintained by the Pew Research Center. For bug reports or
feature requests, please open an issue in the
[prc-platform repository](https://github.com/pewresearch/prc-platform).

### Development Workflow

1. Make changes to components in `src/lib/Components/`
2. Update shared utilities in `@prc/charting-utilities` if needed
3. Run `npm run type-check` to verify TypeScript
4. Run `npm run build` to compile
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

GPL-2.0-or-later

Copyright © Pew Research Center

## Resources

- [visx Documentation](https://airbnb.io/visx/)
- [D3 Documentation](https://d3js.org/)
- [PRC Platform Documentation](../../README.md)
- [Chart Configuration Guide](https://www.notion.so/Chart-Builder-Config-4731c3ecd6fb4e6494d569fe36184ebd)
