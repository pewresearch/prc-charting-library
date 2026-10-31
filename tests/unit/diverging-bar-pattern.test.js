import { createElement } from 'react';
import { render } from '@testing-library/react';
import { DataProvider, baseConfig } from '../../../prc-shared/includes/scripts/src/@prc/charting-utilities';
import DivergingBarHorizontal from '../../src/lib/charts/DivergingBarHorizontal';
import DivergingBarVertical from '../../src/lib/charts/DivergingBarVertical';

beforeAll(() => {
	jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
		measureText: () => ({ width: 0 }),
	});
});

function renderDiverging(Component, orientation, seriesStyles, secondary, divergingBarExtras, configExtras = {}) {
	const config = {
		...baseConfig,
		...configExtras,
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
	test('grouped horizontal chart places the dependent axis below all groups', () => {
		const padding = { top: 20, right: 20, bottom: 30, left: 40 };
		const config = {
			...baseConfig,
			layout: {
				...baseConfig.layout,
				type: 'diverging-bar',
				orientation: 'horizontal',
				height: 240,
				padding,
			},
			dependentAxis: {
				...baseConfig.dependentAxis,
				active: true,
			},
			dataRender: {
				...baseConfig.dataRender,
				categories: ['Dems', 'Reps'],
				groupBreaksActive: true,
				groupBreaksCategory: 'Party',
				groupBreaksCategoryValues: ['Group A', 'Group B'],
				groupBreaks: {
					breakStyles: {
						height: 40,
					},
				},
				sortOrder: 'none',
			},
			divergingBar: {
				...baseConfig.divergingBar,
				negativeCategories: ['Dems'],
				positiveCategories: ['Reps'],
			},
		};

		const { container } = render(
			createElement(
				DataProvider,
				{
					value: {
						data: [
							{
								x: 'Adults',
								Party: 'Group A',
								Dems: 40,
								Reps: 60,
							},
							{
								x: 'Voters',
								Party: 'Group B',
								Dems: 45,
								Reps: 55,
							},
						],
						config,
						tableData: { header: [], rows: [] },
					},
				},
				createElement(DivergingBarHorizontal)
			)
		);

		const svg = container.querySelector('svg');
		const dependentAxis = container.querySelector('.visx-axis-bottom');
		const contentHeight = Number(svg.getAttribute('height')) - padding.top - padding.bottom;
		const axisTop = Number(dependentAxis.getAttribute('transform').match(/^translate\(0, ([^)]+)\)$/)?.[1]);

		expect(axisTop).toBeCloseTo(contentHeight);
	});

	test('horizontal neutral column does not repeat the dependent axis', () => {
		const markup = renderDiverging(
			DivergingBarHorizontal,
			'horizontal',
			undefined,
			undefined,
			{
				neutralBar: {
					...baseConfig.divergingBar.neutralBar,
					active: true,
					category: 'Neutral',
				},
			},
			{
				dependentAxis: {
					...baseConfig.dependentAxis,
					active: true,
				},
			}
		);
		const container = document.createElement('div');
		container.innerHTML = markup;

		expect(container.querySelectorAll('.visx-axis-bottom')).toHaveLength(1);
	});

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

	test('horizontal neutral bars stay visible when the diff column is active', () => {
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
			},
			{
				diffColumn: {
					...baseConfig.diffColumn,
					active: true,
					category: 'Reps',
					columnHeader: 'NET',
				},
			}
		);

		expect(markup).toContain('fill="url(#series-pattern-neutral)"');
		expect(markup).toContain('NET');
	});
});
