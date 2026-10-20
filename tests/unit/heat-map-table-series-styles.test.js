import { describe, expect, test } from '@jest/globals';
import { createElement } from 'react';
import { render } from '@testing-library/react';
import { baseConfig, DataProvider } from '@prc/charting-utilities';
import HeatMapTable from '../../src/lib/charts/HeatMapTable';

// jsdom has no canvas; text measuring only needs a width.
window.HTMLCanvasElement.prototype.getContext = () => ({ measureText: () => ({ width: 0 }) });

const DATA = [
	[
		{ x: 'Alpha', Share: 5 },
		{ x: 'Beta', Share: 25 },
	],
];

function renderHeatMap({
	seriesStyles = {},
	dataRender = {},
	colors = ['#aaaaaa', '#bbbbbb', '#cccccc'],
	labelsActive = false,
	data = DATA,
} = {}) {
	const config = {
		...baseConfig,
		layout: { ...baseConfig.layout, type: 'heat-map-table', width: 400, height: 200 },
		colors,
		dataRender: {
			...baseConfig.dataRender,
			categories: ['Share'],
			mapScale: 'threshold',
			mapScaleDomain: [10, 20],
			...dataRender,
		},
		legend: { ...baseConfig.legend, active: true },
		labels: { ...baseConfig.labels, active: labelsActive },
		seriesStyles,
	};
	return render(createElement(DataProvider, { value: { data, config, tableData: {} } }, createElement(HeatMapTable)));
}

const cells = (container) => [...container.querySelectorAll('rect.visx-bar')];

describe('heat map table series styles', () => {
	test('a threshold bin series fill paints its cells', () => {
		const { container } = renderHeatMap({ seriesStyles: { 'Less than 10': { fill: '#123456' } } });

		expect(cells(container).map((cell) => cell.getAttribute('fill'))).toEqual(['#123456', '#cccccc']);
	});

	test('a hatched bin paints its cells through a pattern def', () => {
		const { container } = renderHeatMap({ seriesStyles: { 'Less than 10': { pattern: 'striped' } } });
		const [hatched] = cells(container);
		const id = hatched.getAttribute('fill').match(/^url\(#(.+)\)$/)?.[1];

		expect(id).toBeTruthy();
		expect(container.querySelector(`[id="${id}"]`)).not.toBeNull();
	});

	test('the legend lists one item per bin, like a map', () => {
		const { container } = renderHeatMap();

		expect(container.textContent).toContain('Less than 10');
		expect(container.textContent).toContain('More than 20');
	});

	test('value labels take the label style of their bin', () => {
		const { container } = renderHeatMap({
			labelsActive: true,
			seriesStyles: { 'Less than 10': { label: { fontWeight: 700 } } },
		});
		const weights = [...container.querySelectorAll('text')]
			.filter((node) => ['5', '25'].includes(node.textContent))
			.map((node) => `${node.textContent}:${node.getAttribute('font-weight')}`);

		expect(weights).toContain('5:700');
		expect(weights).not.toContain('25:700');
	});

	test('the shared labels toggle shows and hides cell values', () => {
		const valueText = (container) =>
			[...container.querySelectorAll('text')].map((node) => node.textContent).filter((text) => text === '5');

		expect(valueText(renderHeatMap({ labelsActive: false }).container)).toEqual([]);
		expect(valueText(renderHeatMap({ labelsActive: true }).container)).toEqual(['5']);
	});

	test('ordinal text cells paint by category and label with their text', () => {
		const { container } = renderHeatMap({
			labelsActive: true,
			colors: ['#0000ff', '#ff0000'],
			dataRender: { categories: ['Party'], mapScale: 'ordinal', mapScaleDomain: ['Democrat', 'Republican'] },
			data: [
				[
					{ x: 'Ohio', Party: 'Republican' },
					{ x: 'Oregon', Party: 'Democrat' },
				],
			],
		});
		const labels = [...container.querySelectorAll('text')].map((node) => node.textContent);

		expect(cells(container).map((cell) => cell.getAttribute('fill'))).toEqual(['#ff0000', '#0000ff']);
		expect(labels).toEqual(expect.arrayContaining(['Republican', 'Democrat']));
	});

	test('two bins that share a color keep separate legend items', () => {
		const { container } = renderHeatMap({ colors: ['#aaaaaa', '#aaaaaa', '#cccccc'] });

		expect(container.textContent).toContain('Less than 10');
		expect(container.textContent).toContain('10 to 20');
	});
});
