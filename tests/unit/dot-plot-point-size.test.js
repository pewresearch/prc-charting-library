import { createElement } from 'react';
import { render } from '@testing-library/react';
import { DataProvider, baseConfig } from '../../../prc-scripts/includes/scripts/src/@prc/charting-utilities';
import DotPlot from '../../src/lib/charts/DotPlot';

beforeAll(() => {
	jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
		measureText: () => ({ width: 0 }),
	});
});

function renderDotPlot(seriesStyles) {
	const config = {
		...baseConfig,
		layout: {
			...baseConfig.layout,
			type: 'dot-plot',
			orientation: 'horizontal',
		},
		colors: ['#456A83', '#BF3B27'],
		nodes: {
			...baseConfig.nodes,
			pointSize: 4,
		},
		seriesStyles,
		labels: {
			...baseConfig.labels,
			active: false,
		},
		dataRender: {
			...baseConfig.dataRender,
			categories: ['Dems', 'Reps'],
			sortOrder: 'none',
		},
	};

	const { container } = render(
		createElement(
			DataProvider,
			{
				value: {
					data: [{ x: 'Adults', Dems: 40, Reps: 60 }],
					config,
					tableData: { header: [], rows: [] },
				},
			},
			createElement(DotPlot)
		)
	);

	return container.innerHTML;
}

describe('dot plot series point size', () => {
	test('a series point size overrides the chart default radius', () => {
		const markup = renderDotPlot({ Dems: { pointSize: 9 } });

		expect(markup).toContain('r="9"');
		expect(console).toHaveErrored();
	});
});
