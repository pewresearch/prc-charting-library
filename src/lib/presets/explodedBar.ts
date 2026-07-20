import { baseConfig } from '@prc/charting-utilities';
import { BaseConfig as BaseConfigType } from '@prc/charting-utilities';
import * as palettes from '@prc/charting-utilities';

const explodedBarConfig: BaseConfigType = {
	...baseConfig,
	layout: {
		...baseConfig.layout,
		type: 'exploded-bar',
		orientation: 'horizontal',
		height: 450,
		width: 600,
		padding: { top: 50, bottom: 30, left: 85, right: 20 },
		horizontalRules: true,
	},
	metadata: {
		...baseConfig.metadata,
		active: true,
		title: 'Exploded bar chart',
		subtitle: 'Here is a subtitle',
		note: "Note: Hi here is my note. Hope you're well",
		source: '<p>Source: <a href="#">Spring 2018 Global Attitudes Survey</a>.</p><p>New line</p>',
	},
	colors: [...palettes.general],
	dataRender: {
		...baseConfig.dataRender,
		x: 'x',
		y: 'y1',
		categories: ['y', 'y1', 'y2'],
		sortKey: 'y',
		sortOrder: 'descending',
	},
	tooltip: {
		...baseConfig.tooltip,
		active: true,
		headerActive: false,
		caretPosition: 'left',
		format: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. %1$s: %2$s',
	},
	labels: {
		...baseConfig.labels,
		active: true,
		labelPositionDX: 0,
		labelPositionDY: 3,
		labelCutoff: 2,
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
		offsetX: 0,
		offsetY: 40,
	},
	dependentAxis: {
		...baseConfig.dependentAxis,
		label: '',
		active: true,
		domain: [0, 10],
		domainPadding: 0,
		tickCount: 4,
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
		tickLabels: {
			...baseConfig.dependentAxis.tickLabels,
			textAnchor: 'middle',
			verticalAnchor: 'middle',
		},
		axisLabel: {
			...baseConfig.dependentAxis.axisLabel,
			padding: 20,
		},
	},
	independentAxis: {
		...baseConfig.independentAxis,
		label: '',
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
			textAnchor: 'end',
			verticalAnchor: 'middle',
			dx: -10,
			dy: 0,
		},
		axisLabel: {
			...baseConfig.independentAxis.axisLabel,
			padding: 100,
		},
		grid: {
			...baseConfig.independentAxis.grid,
			strokeWidth: 1,
			strokeOpacity: 0,
			strokeDasharray: '5,2',
		},
		axis: {
			...baseConfig.independentAxis.axis,
			strokeWidth: 0,
		},
	},
	voronoi: {
		...baseConfig.voronoi,
		active: false,
	},
};

export default explodedBarConfig;
