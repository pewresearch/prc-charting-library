import { createElement } from 'react';
import { render } from '@testing-library/react';
import { DataProvider, baseConfig } from '../../../prc-shared/includes/scripts/src/@prc/charting-utilities';
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

describe('dot plot series patterns', () => {
	test('dot plot markers render and reference the series pattern', () => {
		const markup = renderDotPlot({
			Dems: {
				pattern: 'striped',
			},
		});

		expect(markup).toContain('id="series-pattern-dems"');
		expect(markup).toContain('fill="url(#series-pattern-dems)"');
		expect(console).toHaveErrored();
	});
});
