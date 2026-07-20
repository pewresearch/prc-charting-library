import { baseConfig } from '@prc/charting-utilities';
import { BaseConfig as BaseConfigType } from '@prc/charting-utilities';
import * as palettes from '@prc/charting-utilities';
const horizontalBarConfig: BaseConfigType = {
	...baseConfig,
	layout: {
		...baseConfig.layout,
		type: 'bar',
		orientation: 'horizontal',
		height: 400,
		width: 600,
		padding: { top: 50, bottom: 100, left: 150, right: 20 },
		horizontalRules: true,
	},
	metadata: {
		...baseConfig.metadata,
		active: true,
		title: 'Stacked bars 💪Stacked bars 💪Stacked bars 💪',
		subtitle: 'Stonks',
		note: "Note: Hi here is my note. Hope you're well",
		source: '<p>Source: <a href="#">Spring 2018 Global Attitudes Survey</a>.</p><p>New line</p>',
	},
	colors: [...palettes.general],
	dataRender: {
		...baseConfig.dataRender,
		x: 'x',
		y: 'y',
		categories: ['y', 'y1'],
		sortKey: 'x',
		sortOrder: 'ascending',
	},
	tooltip: {
		...baseConfig.tooltip,
		active: true,
		deemphasizeSiblings: false,
		headerActive: true,
		caretPosition: 'left',
		format: null,
	},
	labels: {
		...baseConfig.labels,
		active: true,
		labelPositionDX: 0,
		labelPositionDY: 4,
		labelCutoff: 20,
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
		title: 'Legend',
	},
	dependentAxis: {
		...baseConfig.dependentAxis,
		label: 'Howdy',
		active: true,
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
			strokeOpacity: 1,
			strokeDasharray: '.3,6',
		},
		ticks: {
			...baseConfig.dependentAxis.ticks,
			strokeWidth: 1,
		},
		axisLabel: {
			...baseConfig.dependentAxis.axisLabel,
			padding: 20,
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
			dx: -30,
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
			strokeDasharray: '.3,6',
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
	annotations: {
		...baseConfig.annotations,
		active: true,
		items: [
			{
				id: '1',
				x: 200,
				y: 10,
				text: 'Hello <span style="color: green;">green</span>, <i>italic</i>, <em>emphasized</em>, <span style="color: purple;">purple</span>, <u>underline</u>, <s>strikethrough</s>',
				fontSize: 16,
				fill: 'red',
				borderRadius: 5,
				padding: 10,
			},
		],
	},
};

export default horizontalBarConfig;
