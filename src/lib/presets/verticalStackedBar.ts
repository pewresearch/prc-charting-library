import { baseConfig } from '@prc/charting-utilities'
import { BaseConfig as BaseConfigType } from '@prc/charting-utilities'
import * as palettes from '@prc/charting-utilities'
const verticalStackedBarConfig: BaseConfigType = {
  ...baseConfig,
  layout: {
    ...baseConfig.layout,
    type: 'stacked-bar',
    orientation: 'vertical',
    height: 400,
    width: 600,
    padding: { top: 50, bottom: 100, left: 50, right: 20 },
    horizontalRules: true,
  },
  metadata: {
    ...baseConfig.metadata,
    active: true,
    title: 'Stacked bars 💪Stacked bars 💪Stacked bars 💪',
    subtitle: 'Stonks',
    note: "Note: Hi here is my note. Hope you're well",
    source:
      '<p>Source: <a href="#">Spring 2018 Global Attitudes Survey</a>.</p><p>New line</p>',
  },
  colors: [...palettes.general],
  dataRender: {
    ...baseConfig.dataRender,
    x: 'x',
    y: 'y',
    categories: ['y', 'y1', 'y2'],
    sortKey: 'y',
    sortOrder: 'descending',
  },
  tooltip: {
    ...baseConfig.tooltip,
    active: true,
    headerActive: true,
    offsetX: 0,
    offsetY: 20,
    caretPosition: 'left',
    format: '%1$s: %2$s',
  },
  labels: {
    ...baseConfig.labels,
    active: true,
    labelPositionDX: 0,
    labelPositionDY: 0,
    labelCutoff: 3,
    labelUnit: '$',
    labelUnitPosition: 'start',
    abbreviateValue: true,
    toFixedDecimal: 0,
    labelPositionBar: 'center',
    // customLabelFormat: function (d) {
    //   return d.y > 1 ? `${d.y.toLocaleString()}%` : `<1%`;
    // },
  },
  legend: {
    ...baseConfig.legend,
    orientation: 'row',
    active: true,
    borderStroke: 'white',
    offsetX: 100,
    offsetY: 40,
  },
  dependentAxis: {
    ...baseConfig.dependentAxis,
    label: 'Howdy',
    active: true,
    domain: [0, 30],
    domainPadding: 0,
    tickCount: 5,
    tickUnit: '$',
    tickUnitPosition: 'start',
    showZero: true,
    abbreviateTicks: true,
    abbreviateTicksDecimals: 2,
    tickValues: undefined,
    grid: {
      ...baseConfig.dependentAxis.grid,
      strokeWidth: 1,
      strokeOpacity: 1,
      strokeDasharray: '5,2',
    },
    ticks: {
      ...baseConfig.dependentAxis.ticks,
      strokeWidth: 1,
    },
    axisLabel: {
      ...baseConfig.dependentAxis.axisLabel,
      padding: 30,
    },
  },
  independentAxis: {
    ...baseConfig.independentAxis,
    label: 'YOOOO',
    scale: 'linear',
    active: true,
    domain: undefined,

    showZero: true,
    tickValues: undefined,
    tickCount: 5,
    tickUnitPosition: 'end',
    abbreviateTicks: true,
    abbreviateTicksDecimals: 2,
    ticks: {
      ...baseConfig.independentAxis.ticks,
      size: 0,
    },
    tickLabels: {
      ...baseConfig.independentAxis.tickLabels,
      angle: 0,
      textAnchor: 'middle',
      verticalAnchor: 'middle',
      dx: 0,
      dy: 10,
    },
    axisLabel: {
      ...baseConfig.independentAxis.axisLabel,
      padding: 100,
    },
    grid: {
      ...baseConfig.independentAxis.grid,
      strokeWidth: 1,
      strokeOpacity: 1,
      strokeDasharray: '5,2',
    },
    axis: {
      ...baseConfig.independentAxis.axis,
      strokeWidth: 1,
    },
  },
  voronoi: {
    ...baseConfig.voronoi,
    active: false,
  },
}

export default verticalStackedBarConfig
