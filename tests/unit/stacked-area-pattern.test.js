import { createElement } from 'react';
import { render } from '@testing-library/react';
import { DataProvider, baseConfig } from '../../../prc-shared/includes/scripts/src/@prc/charting-utilities';
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
		seriesStyles,
		labels: {
			...baseConfig.labels,
			active: false,
		},
		line: {
			...baseConfig.line,
			showPoints: false,
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

describe('stacked area series patterns', () => {
	test('stacked area fills render and reference the series pattern', () => {
		const markup = renderStackedArea({
			Dems: {
				pattern: 'striped',
			},
		});

		expect(markup).toContain('id="series-pattern-dems"');
		expect(markup).toContain('fill="url(#series-pattern-dems)"');
	});
});
