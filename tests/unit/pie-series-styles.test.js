import { describe, expect, test } from '@jest/globals';
import { createElement } from 'react';
import { render } from '@testing-library/react';
import { baseConfig, DataProvider } from '@prc/charting-utilities';
import Pie from '../../src/lib/charts/Pie';

// jsdom has no canvas; text measuring only needs a width.
window.HTMLCanvasElement.prototype.getContext = () => ({ measureText: () => ({ width: 0 }) });

const ROWS = [
	{ x: 'Yes', Share: 60 },
	{ x: 'No', Share: 40 },
];

function renderPie(seriesStyles) {
	const config = {
		...baseConfig,
		layout: { ...baseConfig.layout, type: 'pie', width: 400, height: 400 },
		colors: ['#111111', '#222222'],
		dataRender: { ...baseConfig.dataRender, x: 'x', categories: ['Share'] },
		labels: { ...baseConfig.labels, active: true },
		seriesStyles,
	};
	return render(createElement(DataProvider, { value: { data: ROWS, config, tableData: {} } }, createElement(Pie)));
}

const slices = (container) =>
	[...container.querySelectorAll('svg path[fill]')].filter((node) => !node.closest('pattern'));

describe('pie series styles', () => {
	test('a slice row paints stroke and hatch on that slice only', () => {
		const { container } = renderPie({ Yes: { stroke: '#abcdef', strokeWidth: 3, pattern: 'striped' } });
		const [yes, no] = slices(container);
		const id = yes.getAttribute('fill').match(/^url\(#(.+)\)$/)?.[1];

		expect(yes.getAttribute('stroke')).toBe('#abcdef');
		expect(container.querySelector(`[id="${id}"] [fill="#111111"]`)).not.toBeNull();
		expect(no.getAttribute('fill')).toBe('#222222');
		expect(no.getAttribute('stroke')).toBe(baseConfig.pie.pathStrokeColor);
	});

	test('a slice row label style applies to that slice label', () => {
		const { container } = renderPie({ No: { label: { fontWeight: 700 } } });
		const weights = [...container.querySelectorAll('text')]
			.filter((node) => /^(60|40)/.test(node.textContent))
			.map((node) => `${node.textContent}:${node.getAttribute('font-weight')}`);

		expect(weights).toEqual(['60:200', '40:700']);
	});
});
