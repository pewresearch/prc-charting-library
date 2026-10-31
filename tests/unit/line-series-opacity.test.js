/* eslint-env jest, browser */
import { createElement } from 'react';
import { render } from '@testing-library/react';
import { DataProvider, baseConfig } from '../../../prc-shared/includes/scripts/src/@prc/charting-utilities';
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
			pointFillOpacity: 1,
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

	return render(
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
}

describe('line series opacity', () => {
	test('series opacity paints the line, not the nodes', () => {
		const { container } = renderLine({ Dems: { opacity: 0.4 } });
		const linePath = [...container.querySelectorAll('path')].find(
			(path) => path.getAttribute('fill') === 'none' && path.getAttribute('stroke')
		);

		expect(linePath.getAttribute('opacity')).toBe('0.4');
		container.querySelectorAll('circle').forEach((circle) => {
			expect(circle.getAttribute('opacity')).not.toBe('0.4');
			expect(circle.getAttribute('fill-opacity')).not.toBe('0.4');
		});
	});

	test('series stroke opacity paints the line stroke', () => {
		const { container } = renderLine({ Dems: { strokeOpacity: 0.4 } });
		const linePath = [...container.querySelectorAll('path')].find(
			(path) => path.getAttribute('fill') === 'none' && path.getAttribute('stroke')
		);

		expect(linePath.getAttribute('stroke-opacity')).toBe('0.4');

		const demsMarkers = [...container.querySelectorAll('circle.visx-circle')].filter(
			(circle) => circle.getAttribute('stroke') === '#456A83'
		);
		expect(demsMarkers.length).toBeGreaterThan(0);
		demsMarkers.forEach((circle) => {
			expect(circle.getAttribute('stroke-opacity')).toBe('0.4');
		});
	});
});
