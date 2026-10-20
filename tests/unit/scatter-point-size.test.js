import { createElement } from 'react';
import { render } from '@testing-library/react';
import { DataProvider, baseConfig } from '../../../prc-scripts/includes/scripts/src/@prc/charting-utilities';
import Scatter from '../../src/lib/charts/Scatter';

beforeAll(() => {
	jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
		measureText: () => ({ width: 0 }),
	});
});

function renderScatter(seriesStyles) {
	const config = {
		...baseConfig,
		layout: {
			...baseConfig.layout,
			type: 'scatter',
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
			groupBreaksActive: false,
			groupBreaksCategory: null,
		},
	};

	const { container } = render(
		createElement(
			DataProvider,
			{
				value: {
					data: [
						{ x: 2020, Dems: 40, Reps: 60 },
						{ x: 2021, Dems: 45, Reps: 55 },
					],
					config,
					tableData: { header: [], rows: [] },
				},
			},
			createElement(Scatter)
		)
	);

	return container.innerHTML;
}

describe('scatter series point size', () => {
	test('a series point size overrides the chart default radius', () => {
		const markup = renderScatter({ Dems: { pointSize: 9 } });

		expect(markup).toContain('r="9"');
	});
});
