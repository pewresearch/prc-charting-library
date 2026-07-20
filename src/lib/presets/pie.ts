import { baseConfig } from '@prc/charting-utilities'
import { BaseConfig as BaseConfigType } from '@prc/charting-utilities'

const pieConfig: BaseConfigType = {
  ...baseConfig,
  layout: {
    ...baseConfig.layout,
    type: 'pie',
    width: 640,
    height: 520,
    padding: { top: 10, bottom: 125, left: 50, right: 0 },
    orientation: 'vertical',
  },
  dataRender: {
    ...baseConfig.dataRender,
    categories: ['y'],
    xScale: 'linear',
    xFormat: 'MM/YYYY',
  },
  animate: {
    active: false,
    duration: 500,
  },
  colors: ['#756a7e', '#ea9e2c', '#bc7b2b', '#436983', '#bf3927'],
  line: {
    ...baseConfig.line,
    showPoints: true,
    showArea: false,
    strokeWidth: 5,
  },
  nodes: {
    ...baseConfig.nodes,
  },
  dependentAxis: {
    ...baseConfig.dependentAxis,
    active: false,
    padding: 50,
    domain: [0, 100],
    domainPadding: 0,
    tickValues: undefined,
    tickCount: 5,
    showZero: true,
  },
  independentAxis: {
    ...baseConfig.independentAxis,
    scale: 'linear',
    active: true,
    domain: [0, 100],
    padding: 50,
    tickValues: undefined,
  },
  plotBands: {
    ...baseConfig.plotBands,
    active: false,
  },
  labels: {
    ...baseConfig.labels,
    active: true,
    color: 'white',
    fontWeight: 400,
    fontSize: 12,
    labelUnit: '%',
    labelPositionDX: 1,
    labelPositionDY: -15,
    toFixedDecimal: 0,
  },
  tooltip: {
    ...baseConfig.tooltip,
    active: true,
    format: '%1$s: %2$s',
  },
  legend: {
    ...baseConfig.legend,
    active: true,
    offsetX: 200,
    offsetY: -10,
    orientation: 'row',
    markerStyle: 'circle',
  },
}

export default pieConfig
