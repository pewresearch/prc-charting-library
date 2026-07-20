import { baseConfig } from '@prc/charting-utilities';
import { BaseConfig as BaseConfigType } from '@prc/charting-utilities';

const treemapConfig: BaseConfigType = {
	...baseConfig,
	layout: {
		...baseConfig.layout,
		type: 'treemap',
		width: 640,
		height: 400,
		padding: { top: 10, bottom: 10, left: 10, right: 10 },
		orientation: 'vertical',
	},
	dataRender: {
		...baseConfig.dataRender,
		categories: ['y'],
		sortKey: 'y',
		sortOrder: 'descending',
		groupBreaksActive: true,
		groupBreaksCategory: 'category',
	},
	colors: ['#436983', '#bf3927', '#756a7e', '#ea9e2c', '#bc7b2b', '#eeece4'],
	treemap: {
		tile: 'squarify',
		rectStroke: '#ffffff',
		rectStrokeWidth: 2,
		labelMinArea: 1600,
		paddingInner: 2,
		paddingOuter: 4,
		scaleOpacity: false,
		opacityRange: [0.4, 1],
		borderRadius: 0,
		showValues: false,
	},
	labels: {
		...baseConfig.labels,
		active: true,
		color: 'contrast',
		fontWeight: 400,
		fontSize: 12,
		labelUnit: '',
		toFixedDecimal: 0,
	},
	tooltip: {
		...baseConfig.tooltip,
		active: true,
		headerActive: true,
		headerValue: 'independentValue',
		format: '{{row}}: {{value}}',
	},
	legend: {
		...baseConfig.legend,
		active: true,
		orientation: 'row',
		alignment: 'center',
		offsetX: 0,
		offsetY: -10,
		markerStyle: 'rect',
	},
};

export default treemapConfig;
