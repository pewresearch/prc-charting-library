# Charting Library Examples

This directory contains examples of various chart types using the PRC Charting
Library.

## Dot Plot with Error Bars Demo

The `dotPlotConfig.ts` file contains a demo configuration for a dot plot with
error bars enabled. This example shows:

### Features:

- **Error Bars**: Enabled with custom styling for each political party category
- **Multiple Categories**: Democrats, Independents, and Republicans
- **Custom Styling**: Each category has its own color scheme
- **Labels**: Data points are labeled with percentage values
- **Tooltips**: Interactive tooltips showing detailed information

### Configuration Details:

- **Chart Type**: `dot-plot`
- **Error Bars**: Enabled with custom stroke colors and widths
- **Data Structure**: Includes low/high values for error bar ranges
- **Styling**: Uses Pew Research Center color palette

### Sample Data:

The demo includes sample data showing public opinion on climate change by
political party:

- Democrats: 85% (82-88% range)
- Independents: 65% (62-68% range)
- Republicans: 35% (32-38% range)

### Usage:

```typescript
import dotPlotWithErrorBarsConfig, { dotPlotData } from './dotPlotConfig';

<ChartBuilderWrapper
  config={dotPlotWithErrorBarsConfig}
  data={[dotPlotData]}
/>
```

### Error Bar Configuration:

The error bars are configured with:

- **Default Styles**: Gray stroke, 2px width
- **Category-Specific Styles**:
  - Democrats: Blue (#436983)
  - Independents: Purple (#756a7e)
  - Republicans: Red (#bf3927)

This demonstrates how to create sophisticated dot plots with statistical error
bars for data visualization.
