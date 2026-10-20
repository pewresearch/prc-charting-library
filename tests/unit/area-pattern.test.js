import { createElement } from 'react';
import { render } from '@testing-library/react';
import { DataProvider, baseConfig } from '../../../prc-scripts/includes/scripts/src/@prc/charting-utilities';
import Line from '../../src/lib/charts/Line';

beforeAll(() => {
	jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
		measureText: () => ({ width: 0 }),
	});
});

function renderArea(seriesStyles) {
	const config = {
		...baseConfig,
		layout: {
			...baseConfig.layout,
			type: 'line',
		},
		colors: ['#456A83', '#BF3B27'],
		seriesStyles,
		labels: {
			...baseConfig.labels,
			active: false,
		},
		line: {
			...baseConfig.line,
			showArea: true,
			showPoints: false,
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
						{ x: 2010, Dems: 40, Reps: 60 },
						{ x: 2020, Dems: 45, Reps: 55 },
					],
					config,
					tableData: { header: [], rows: [] },
				},
			},
			createElement(Line)
		)
	);

	return container.innerHTML;
}

describe('area series patterns', () => {
	test('area fills render and reference the series pattern', () => {
		const markup = renderArea({
			Dems: {
				pattern: 'striped',
			},
		});

		expect(markup).toContain('id="series-pattern-dems"');
		expect(markup).toContain('fill="url(#series-pattern-dems)"');
	});
});
