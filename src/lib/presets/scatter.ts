import {
  baseConfig,
  BaseConfig as BaseConfigType,
} from '@prc/charting-utilities'

const scatterConfig: BaseConfigType = {
  ...baseConfig,
  layout: {
    ...baseConfig.layout,
    type: 'scatter',
    width: 640,
    height: 520,
    padding: { top: 20, bottom: 100, left: 50, right: 50 },
    orientation: 'vertical',
  },
  colors: ['#733D47', '#BC7B86', '#9DC7E1', '#bc7b2b', '#eeece4'],
  dataRender: {
    ...baseConfig.dataRender,
    categories: ['Smartphones', 'Tablets'],
    xScale: 'time',
    xFormat: 'YYYY',
    x: 'x',
    y: 'y',
  },
  animate: {
    active: false,
    duration: 500,
  },
  line: {
    ...baseConfig.line,
    interpolation: 'curveCatmullRom',
    showPoints: true,
    showArea: false,
    strokeWidth: 1,
    strokeDasharray: '5,2',
  },
  nodes: {
    ...baseConfig.nodes,
    pointSize: 5,
  },
  dependentAxis: {
    ...baseConfig.dependentAxis,
    label: 'Howdy',
    active: true,
    padding: 50,
    domain: [0, 100],
    domainPadding: 0,
    tickCount: 10,
    tickUnit: '$',
    tickUnitPosition: 'start',
    showZero: true,
    abbreviateTicks: true,
    abbreviateTicksDecimals: 2,
    tickValues: undefined,
    grid: {
      ...baseConfig.dependentAxis.grid,
      strokeWidth: 1,
      strokeOpacity: 0,
      strokeDasharray: '5,2',
    },
    ticks: {
      ...baseConfig.dependentAxis.ticks,
      strokeWidth: 1,
    },
  },
  independentAxis: {
    ...baseConfig.independentAxis,
    label: 'Cool label for this chart. Love it.',
    scale: 'time',
    active: true,
    domain: [2000, 2020],
    padding: 50,
    showZero: true,
    tickValues: undefined,
    tickCount: 5,
    tickUnit: ' is the year', //'%', '$', '€', '£', '¥'
    tickUnitPosition: 'end',
    abbreviateTicks: false,
    abbreviateTicksDecimals: 2,
    ticks: {
      ...baseConfig.independentAxis.ticks,
      size: 8,
    },
    axisLabel: {
      ...baseConfig.independentAxis.axisLabel,
      padding: 50,
      maxWidth: 300,
      textAnchor: 'middle',
    },
    grid: {
      ...baseConfig.independentAxis.grid,
      strokeWidth: 1,
      strokeOpacity: 0,
      strokeDasharray: '5,2',
    },
  },
  labels: {
    ...baseConfig.labels,
    active: true,
    showFirstLastPointsOnly: false,
    color: 'inherit',
    fontWeight: 200,
    fontSize: 12,
    labelPositionDX: 13,
    labelPositionDY: -5,
    toFixedDecimal: 0,
    customLabelFormat: function (d: any) {
      return d > 1 ? `$${d.toLocaleString()}` : `<$1`
    },
  },
  tooltip: {
    ...baseConfig.tooltip,
    active: true,
    offsetX: 60,
    offsetY: 20,
    dateFormat: '%-m/%Y',
    format: '%1$s: %2$s',
    style: {
      ...baseConfig.tooltip.style,
    },
  },
  legend: {
    ...baseConfig.legend,
    active: true,
    title: '',
    offsetX: 0,
    offsetY: 0,
    orientation: 'row',
    markerStyle: 'circle',
  },
  metadata: {
    ...baseConfig.metadata,
    active: false,
    title:
      'A really long title that will be truncated and wrapped to fit the available space',
    subtitle: '',
    note: '',
    source: '',
    tag: 'PEW RESEARCH CENTER',
  },
  voronoi: {
    ...baseConfig.voronoi,
    active: true,
  },
  regression: {
    ...baseConfig.regression,
    active: true,
  },
}

export default scatterConfig
