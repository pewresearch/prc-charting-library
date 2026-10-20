import { createElement } from 'react';
import { render } from '@testing-library/react';
import { DataProvider, baseConfig } from '../../../prc-scripts/includes/scripts/src/@prc/charting-utilities';
import StackedArea from '../../src/lib/charts/StackedArea';

beforeAll(() => {
	jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
		measureText: () => ({ width: 0 }),
	});
});

function renderStackedArea(seriesStyles) {
	const config = {
		...baseConfig,
		layout: {
			...baseConfig.layout,
			type: 'stacked-area',
			orientation: 'vertical',
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
		line: {
			...baseConfig.line,
			showPoints: true,
			showFirstLastPointsOnly: false,
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
					data: [
						{ x: '2010', Dems: 40, Reps: 60 },
						{ x: '2020', Dems: 45, Reps: 55 },
					],
					config,
					tableData: { header: [], rows: [] },
				},
			},
			createElement(StackedArea)
		)
	);

	return container.innerHTML;
}

describe('stacked area series point size', () => {
	test('a series point size overrides the chart default radius', () => {
		const markup = renderStackedArea({ Dems: { pointSize: 9 } });

		expect(markup).toContain('r="9"');
	});
});
