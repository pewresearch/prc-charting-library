import { createElement } from 'react';
import { render } from '@testing-library/react';
import { DataProvider, baseConfig } from '../../../prc-shared/includes/scripts/src/@prc/charting-utilities';
import ExplodedBar from '../../src/lib/charts/ExplodedBar';

beforeAll(() => {
	jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
		measureText: () => ({ width: 0 }),
	});
});

function renderExploded(seriesStyles) {
	const config = {
		...baseConfig,
		layout: {
			...baseConfig.layout,
			type: 'exploded-bar',
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
			createElement(ExplodedBar)
		)
	);

	return container.innerHTML;
}

describe('exploded bar series patterns', () => {
	test('exploded primary bars render and reference the series pattern', () => {
		const markup = renderExploded({
			Dems: {
				pattern: 'striped',
			},
		});

		expect(markup).toContain('id="series-pattern-dems"');
		expect(markup).toContain('fill="url(#series-pattern-dems)"');
	});
});
