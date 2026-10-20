import { describe, expect, test } from '@jest/globals';
import { createElement } from 'react';
import { render } from '@testing-library/react';
import { baseConfig, DataProvider } from '@prc/charting-utilities';
import SmallMultiples from '../../src/lib/charts/small-multiples/SmallMultiples';

// jsdom has no canvas; text measuring only needs a width.
window.HTMLCanvasElement.prototype.getContext = () => ({ measureText: () => ({ width: 0 }) });

const ROWS = [
	{ x: 'Alpha', Dems: 40, Reps: 60 },
	{ x: 'Beta', Dems: 55, Reps: 45 },
];

function chartHeight(panelType, panelHeight) {
	const config = {
		...baseConfig,
		layout: { ...baseConfig.layout, type: 'small-multiples', width: 600, height: 400 },
		dataRender: { ...baseConfig.dataRender, x: 'x', categories: ['Dems', 'Reps'] },
		smallMultiples: { ...baseConfig.smallMultiples, panelType, panelHeight, columns: 2 },
	};
	const { container } = render(
		createElement(DataProvider, { value: { data: ROWS, config, tableData: {} } }, createElement(SmallMultiples))
	);
	return Number(container.querySelector('svg.cb__small-multiples').getAttribute('height'));
}

describe('small multiples panel height', () => {
	test.each(['line', 'column', 'bar', 'pie', 'waffle'])('%s panels grow with the panel height', (panelType) => {
		expect(chartHeight(panelType, 300) - chartHeight(panelType, 200)).toBe(100);
	});
});
