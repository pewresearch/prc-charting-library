import { describe, expect, test } from '@jest/globals';
import { createElement } from 'react';
import { render } from '@testing-library/react';
import { baseConfig, DataProvider } from '@prc/charting-utilities';
import Treemap from '../../src/lib/charts/Treemap';

// jsdom has no canvas; text measuring only needs a width.
window.HTMLCanvasElement.prototype.getContext = () => ({ measureText: () => ({ width: 0 }) });

const ROWS = [
	{ x: 'Ohio', Votes: 40, Party: 'Rep' },
	{ x: 'Iowa', Votes: 30, Party: 'Rep' },
	{ x: 'Maine', Votes: 20, Party: 'Dem' },
];

function renderTreemap(seriesStyles, { grouped = true } = {}) {
	const config = {
		...baseConfig,
		layout: { ...baseConfig.layout, type: 'treemap', width: 400, height: 300 },
		colors: ['#111111', '#222222', '#333333'],
		labels: { ...baseConfig.labels, active: true },
		treemap: { ...baseConfig.treemap, labelMinArea: 0, showValues: false },
		dataRender: {
			...baseConfig.dataRender,
			x: 'x',
			categories: ['Votes'],
			sortOrder: 'none',
			groupBreaksActive: grouped,
			groupBreaksCategory: grouped ? 'Party' : null,
			groupBreaksCategoryValues: grouped ? ['Rep', 'Dem'] : [],
		},
		seriesStyles,
	};
	return render(
		createElement(DataProvider, { value: { data: ROWS, config, tableData: {} } }, createElement(Treemap))
	);
}

const leaf = (container, name) => container.querySelector(`rect[aria-label^="${name}:"]`);

describe('treemap series styles', () => {
	test('a group row paints stroke and hatch on every leaf in that group only', () => {
		const { container } = renderTreemap({ Rep: { stroke: '#abcdef', strokeWidth: 3, pattern: 'striped' } });
		const ohio = leaf(container, 'Ohio');
		const id = ohio.getAttribute('fill').match(/^url\(#(.+)\)$/)?.[1];

		expect(ohio.getAttribute('stroke')).toBe('#abcdef');
		expect(leaf(container, 'Iowa').getAttribute('stroke')).toBe('#abcdef');
		expect(container.querySelector(`[id="${id}"] [fill="#111111"]`)).not.toBeNull();
		expect(leaf(container, 'Maine').getAttribute('fill')).toBe('#222222');
	});

	test('without a group column, each leaf takes its own row', () => {
		const { container } = renderTreemap({ Iowa: { stroke: '#abcdef' } }, { grouped: false });

		expect(leaf(container, 'Iowa').getAttribute('stroke')).toBe('#abcdef');
		expect(leaf(container, 'Ohio').getAttribute('stroke')).toBe(baseConfig.treemap.rectStroke);
	});

	const labelWeights = (container) =>
		Object.fromEntries(
			[...container.querySelectorAll('text')].map((node) => [node.textContent, node.getAttribute('font-weight')])
		);

	test('a group row label style applies to that group labels', () => {
		const weights = labelWeights(renderTreemap({ Dem: { label: { fontWeight: 700 } } }).container);

		expect(weights.Maine).toBe('700');
		expect(weights.Ohio).not.toBe('700');
	});

	test('without a group column, a leaf row label style applies to that leaf label', () => {
		const weights = labelWeights(
			renderTreemap({ Maine: { label: { fontWeight: 700 } } }, { grouped: false }).container
		);

		expect(weights.Maine).toBe('700');
		expect(weights.Ohio).not.toBe('700');
	});
});
