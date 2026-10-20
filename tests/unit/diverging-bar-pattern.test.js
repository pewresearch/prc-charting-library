import { createElement } from 'react';
import { render } from '@testing-library/react';
import { DataProvider, baseConfig } from '../../../prc-scripts/includes/scripts/src/@prc/charting-utilities';
import DivergingBarHorizontal from '../../src/lib/charts/DivergingBarHorizontal';
import DivergingBarVertical from '../../src/lib/charts/DivergingBarVertical';

beforeAll(() => {
	jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
		measureText: () => ({ width: 0 }),
	});
});

function renderDiverging(Component, orientation, seriesStyles, secondary, divergingBarExtras) {
	const config = {
		...baseConfig,
		layout: {
			...baseConfig.layout,
			type: 'diverging-bar',
			orientation,
		},
		colors: ['#456A83', '#BF3B27', '#888888'],
		seriesStyles,
		labels: {
			...baseConfig.labels,
			active: false,
		},
		dataRender: {
			...baseConfig.dataRender,
			categories: ['Dems', 'Reps', 'Neutral'],
			sortOrder: 'none',
		},
		divergingBar: {
			...baseConfig.divergingBar,
			negativeCategories: ['Dems'],
			positiveCategories: ['Reps'],
			...(secondary ? { secondary } : {}),
			...divergingBarExtras,
		},
	};

	const { container } = render(
		createElement(
			DataProvider,
			{
				value: {
					data: [{ x: 'Adults', Dems: 40, Reps: 60, DemsGhost: 25, RepsGhost: 35, Neutral: 15 }],
					config,
					tableData: { header: [], rows: [] },
				},
			},
			createElement(Component)
		)
	);

	return container.innerHTML;
}

describe('diverging bar series patterns', () => {
	test('horizontal primary bars render and reference the series pattern', () => {
		const markup = renderDiverging(DivergingBarHorizontal, 'horizontal', {
			Dems: {
				pattern: 'striped',
			},
		});

		expect(markup).toContain('id="series-pattern-dems"');
		expect(markup).toContain('fill="url(#series-pattern-dems)"');
	});

	test('a ghost overlay with no authored stroke follows the color scheme', () => {
		const markup = renderDiverging(DivergingBarHorizontal, 'horizontal', undefined, {
			active: true,
			negativeCategories: ['DemsGhost'],
			positiveCategories: ['RepsGhost'],
		});

		expect(markup).toContain('stroke="light-dark(#000000, #ffffff)"');
	});

	test('vertical primary bars render and reference the series pattern', () => {
		const markup = renderDiverging(DivergingBarVertical, 'vertical', {
			Dems: {
				pattern: 'striped',
			},
		});

		expect(markup).toContain('id="series-pattern-dems"');
		expect(markup).toContain('fill="url(#series-pattern-dems)"');
	});

	test('horizontal neutral bars render and reference the series pattern', () => {
		const markup = renderDiverging(
			DivergingBarHorizontal,
			'horizontal',
			{
				Neutral: {
					pattern: 'striped',
				},
			},
			undefined,
			{
				neutralBar: {
					...baseConfig.divergingBar.neutralBar,
					active: true,
					category: 'Neutral',
				},
			}
		);

		expect(markup).toContain('id="series-pattern-neutral"');
		expect(markup).toContain('fill="url(#series-pattern-neutral)"');
	});
});
