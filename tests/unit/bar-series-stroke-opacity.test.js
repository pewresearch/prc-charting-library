/* eslint-env jest, browser */
import { createElement } from 'react';
import { render } from '@testing-library/react';
import { DataProvider, baseConfig } from '../../../prc-shared/includes/scripts/src/@prc/charting-utilities';
import BarVertical from '../../src/lib/charts/BarVertical';

beforeAll(() => {
	jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
		measureText: () => ({ width: 0 }),
	});
});

function renderBar(seriesStyles) {
	const config = {
		...baseConfig,
		layout: {
			...baseConfig.layout,
			type: 'bar',
			orientation: 'vertical',
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
			groupBreaksActive: false,
			groupBreaksCategory: null,
		},
	};

	return render(
		createElement(
			DataProvider,
			{
				value: {
					data: [{ x: 'Adults', Dems: 40, Reps: 60 }],
					config,
					tableData: { header: [], rows: [] },
				},
			},
			createElement(BarVertical)
		)
	);
}

describe('bar series stroke opacity', () => {
	test('series stroke opacity paints the bar stroke', () => {
		const { container } = renderBar({
			Dems: { stroke: '#111111', strokeWidth: 2, strokeOpacity: 0.4 },
		});
		const bar = [...container.querySelectorAll('rect')].find((rect) => rect.getAttribute('stroke') === '#111111');

		expect(bar.getAttribute('stroke-opacity')).toBe('0.4');
	});
});
