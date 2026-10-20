import { createElement } from 'react';
import { render } from '@testing-library/react';
import { DataProvider, baseConfig } from '../../../prc-scripts/includes/scripts/src/@prc/charting-utilities';
import Line from '../../src/lib/charts/Line';

beforeAll(() => {
	jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
		measureText: () => ({ width: 0 }),
	});
});

function renderLine(seriesStyles) {
	const config = {
		...baseConfig,
		layout: {
			...baseConfig.layout,
			type: 'line',
		},
		colors: ['#456A83', '#BF3B27'],
		nodes: {
			...baseConfig.nodes,
			pointFill: 'inherit',
		},
		line: {
			...baseConfig.line,
			showPoints: true,
			showFirstLastPointsOnly: false,
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
			createElement(Line)
		)
	);

	return container.innerHTML;
}

describe('line series point fill', () => {
	test('a series white node fill overrides inherited series color', () => {
		const markup = renderLine({ Dems: { pointFill: 'white' } });

		expect(markup).toContain('fill="#ffffff"');
	});
});
