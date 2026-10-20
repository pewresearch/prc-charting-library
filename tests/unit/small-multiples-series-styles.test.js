import { describe, expect, test } from '@jest/globals';
import { createElement } from 'react';
import { render } from '@testing-library/react';
import { baseConfig, DataProvider, SMALL_MULTIPLES_SHARED_SERIES_KEY } from '@prc/charting-utilities';
import SmallMultiples from '../../src/lib/charts/small-multiples/SmallMultiples';

// jsdom has no canvas; text measuring only needs a width.
window.HTMLCanvasElement.prototype.getContext = () => ({ measureText: () => ({ width: 0 }) });

const GROUPED_ROWS = [
	{ x: '2024', Dems: 40, Reps: 60, Region: 'North' },
	{ x: '2024', Dems: 55, Reps: 45, Region: 'South' },
];

const GROUPED_LINE_ROWS = [
	{ x: 2020, Dems: 40, Reps: 60, Region: 'North' },
	{ x: 2024, Dems: 45, Reps: 55, Region: 'North' },
	{ x: 2020, Dems: 55, Reps: 45, Region: 'South' },
	{ x: 2024, Dems: 50, Reps: 50, Region: 'South' },
];

function renderSmallMultiples({
	seriesStyles = {},
	colors = ['#111111', '#222222'],
	data = GROUPED_ROWS,
	panelType = 'column',
	line = {},
	categories = ['Dems', 'Reps'],
	groupKey = 'Region',
	labelsActive = false,
	smallMultiples = {},
} = {}) {
	const config = {
		...baseConfig,
		layout: { ...baseConfig.layout, type: 'small-multiples', width: 600, height: 400 },
		colors,
		dataRender: {
			...baseConfig.dataRender,
			x: 'x',
			categories,
			groupBreaksActive: !!groupKey,
			groupBreaksCategory: groupKey,
		},
		smallMultiples: { ...baseConfig.smallMultiples, panelType, ...smallMultiples },
		line: { ...baseConfig.line, ...line },
		labels: { ...baseConfig.labels, active: labelsActive },
		seriesStyles,
	};
	return render(
		createElement(DataProvider, { value: { data, config, tableData: {} } }, createElement(SmallMultiples))
	);
}

const panelBars = (container, attribute) =>
	Object.fromEntries(
		[...container.querySelectorAll('g.cb__small-multiples__panel')].map((panel) => [
			panel.getAttribute('data-panel-key'),
			[...panel.querySelectorAll('rect.visx-bar')].map((bar) => bar.getAttribute(attribute)),
		])
	);

describe('small multiples series styles', () => {
	test('a grouped facet paints Dems from its series row in every panel', () => {
		const { container } = renderSmallMultiples({ seriesStyles: { Dems: { stroke: '#abcdef' } } });

		expect(panelBars(container, 'stroke')).toEqual({
			North: ['#abcdef', null],
			South: ['#abcdef', null],
		});
	});

	test('a hatched Dems row paints its bars through a pattern def in every panel', () => {
		const { container } = renderSmallMultiples({ seriesStyles: { Dems: { pattern: 'striped' } } });
		const fills = panelBars(container, 'fill');
		const [northDems] = fills.North;
		const id = northDems.match(/^url\(#(.+)\)$/)?.[1];

		expect(id).toBeTruthy();
		expect(container.querySelector(`[id="${id}"]`)).not.toBeNull();
		expect(fills.South).toEqual([northDems, '#222222']);
	});

	test('a grouped line panel draws Dems with its series row dash and width', () => {
		const { container } = renderSmallMultiples({
			panelType: 'line',
			data: GROUPED_LINE_ROWS,
			seriesStyles: { Dems: { strokeDasharray: '4 2', strokeWidth: 5 } },
		});
		const lines = (panelKey) =>
			[
				...container.querySelectorAll(
					`g.cb__small-multiples__panel[data-panel-key="${panelKey}"] path[stroke]`
				),
			].map(
				(path) =>
					`${path.getAttribute('stroke')}|${path.getAttribute('stroke-dasharray')}|${path.getAttribute('stroke-width')}`
			);

		['North', 'South'].forEach((panelKey) => {
			expect(lines(panelKey)).toEqual(
				expect.arrayContaining([
					'#111111|4 2|5',
					`#222222|${baseConfig.line.strokeDasharray}|${baseConfig.line.strokeWidth}`,
				])
			);
		});
	});

	test('a grouped line panel fills Dems points from its series row', () => {
		const { container } = renderSmallMultiples({
			panelType: 'line',
			data: GROUPED_LINE_ROWS,
			line: { showPoints: true },
			seriesStyles: { Dems: { pointFill: '#abcdef' } },
		});
		const pointFills = [
			...container.querySelectorAll('g.cb__small-multiples__panel[data-panel-key="South"] circle'),
		].map((circle) => circle.getAttribute('fill'));

		expect(pointFills.filter((fill) => fill === '#abcdef')).toHaveLength(2);
	});

	test('series take the palette slot of their own name; the grouping column takes none', () => {
		const { container } = renderSmallMultiples({
			categories: ['Region', 'Dems', 'Reps'],
			colors: ['#111111', '#222222'],
		});

		expect(panelBars(container, 'fill').North).toEqual(['#111111', '#222222']);
	});

	test('a column facet paints every panel from the shared row, not its own column row', () => {
		const { container } = renderSmallMultiples({
			groupKey: null,
			data: [{ x: '2024', Dems: 40, Reps: 60 }],
			seriesStyles: {
				[SMALL_MULTIPLES_SHARED_SERIES_KEY]: { stroke: '#abcdef' },
				Reps: { stroke: '#ff0000' },
			},
		});

		expect(panelBars(container, 'fill')).toEqual({ Dems: ['#111111'], Reps: ['#111111'] });
		expect(panelBars(container, 'stroke')).toEqual({ Dems: ['#abcdef'], Reps: ['#abcdef'] });
	});

	test('column facet labels take the shared row label style', () => {
		const { container } = renderSmallMultiples({
			groupKey: null,
			labelsActive: true,
			data: [{ x: '2024', Dems: 40, Reps: 60 }],
			seriesStyles: {
				[SMALL_MULTIPLES_SHARED_SERIES_KEY]: { label: { fontWeight: 700 } },
				Reps: { label: { fontWeight: 300 } },
			},
		});
		const weights = [...container.querySelectorAll('text')]
			.filter((node) => ['40', '60'].includes(node.textContent))
			.map((node) => `${node.textContent}:${node.getAttribute('font-weight')}`);

		expect(weights).toEqual(['40:700', '60:700']);
	});
});

const PARTY_ROWS = [{ x: '2024', Democrats: 40, Republicans: 60, Independents: 20 }];
const PARTY_PANEL_STYLES = {
	Democrats: { Democrats: { fill: '#0000ff' } },
	Republicans: { Republicans: { fill: '#ff0000' } },
	Independents: { Independents: { fill: '#888888' } },
};

describe('small multiples panel color mode', () => {
	test('column-facet panels each paint their own panel row fill', () => {
		const { container } = renderSmallMultiples({
			groupKey: null,
			data: PARTY_ROWS,
			categories: ['Democrats', 'Republicans', 'Independents'],
			smallMultiples: { colorMode: 'panel', panelStyles: PARTY_PANEL_STYLES },
		});

		expect(panelBars(container, 'fill')).toEqual({
			Democrats: ['#0000ff'],
			Republicans: ['#ff0000'],
			Independents: ['#888888'],
		});
	});

	test('shared mode ignores panel rows', () => {
		const { container } = renderSmallMultiples({
			groupKey: null,
			data: PARTY_ROWS,
			categories: ['Democrats', 'Republicans', 'Independents'],
			smallMultiples: { colorMode: 'shared', panelStyles: PARTY_PANEL_STYLES },
		});

		expect(panelBars(container, 'fill')).toEqual({
			Democrats: ['#111111'],
			Republicans: ['#111111'],
			Independents: ['#111111'],
		});
	});

	test('a panel fill recolors a hatch set on the shared row in that panel only', () => {
		const { container } = renderSmallMultiples({
			seriesStyles: { Reps: { pattern: 'striped' } },
			smallMultiples: {
				colorMode: 'panel',
				panelStyles: { North: { Reps: { fill: '#ff0000' } } },
			},
		});
		const fills = panelBars(container, 'fill');
		const hatchColors = (fill) => {
			const id = fill.match(/^url\(#(.+)\)$/)?.[1];
			return [...container.querySelectorAll(`[id="${id}"] [fill]`)].map((node) => node.getAttribute('fill'));
		};

		expect(fills.North[1]).not.toEqual(fills.South[1]);
		expect(hatchColors(fills.North[1])).toContain('#ff0000');
		expect(hatchColors(fills.South[1])).not.toContain('#ff0000');
	});

	test('a panel label style layers over the shared label style in that panel only', () => {
		const { container } = renderSmallMultiples({
			labelsActive: true,
			seriesStyles: { Dems: { label: { fontStyle: 'italic', fontWeight: 300 } } },
			smallMultiples: {
				colorMode: 'panel',
				panelStyles: { North: { Dems: { label: { fontWeight: 700 } } } },
			},
		});
		const label = (text) => {
			const node = [...container.querySelectorAll('text')].find((n) => n.textContent === text);
			return `${node.getAttribute('font-weight')} ${node.getAttribute('font-style')}`;
		};

		expect(label('40')).toBe('700 italic');
		expect(label('55')).toBe('300 italic');
	});

	test('a grouped panel row paints Dems red in that panel only', () => {
		const { container } = renderSmallMultiples({
			seriesStyles: { Dems: { stroke: '#abcdef' } },
			smallMultiples: {
				colorMode: 'panel',
				panelStyles: { North: { Dems: { fill: '#ff0000' } } },
			},
		});

		expect(panelBars(container, 'fill')).toEqual({
			North: ['#ff0000', '#222222'],
			South: ['#111111', '#222222'],
		});
		expect(panelBars(container, 'stroke')).toEqual({
			North: ['#abcdef', null],
			South: ['#abcdef', null],
		});
	});
});

describe('small multiples part-to-whole keys', () => {
	test('waffle panels color by panel name, not row label', () => {
		const { container } = renderSmallMultiples({
			groupKey: null,
			panelType: 'waffle',
			data: [{ x: 'Share', Dems: 40, Reps: 60 }],
		});

		const panelFill = (key) =>
			container
				.querySelector(`g.cb__small-multiples__panel[data-panel-key="${key}"] rect.visx-bar`)
				.getAttribute('fill');

		expect(panelFill('Dems')).toBe('#111111');
		expect(panelFill('Reps')).toBe('#222222');
	});

	test('pie panels paint each slice from its slice row in every panel', () => {
		const { container } = renderSmallMultiples({
			groupKey: null,
			panelType: 'pie',
			data: [
				{ x: 'Yes', Dems: 60, Reps: 30 },
				{ x: 'No', Dems: 40, Reps: 70 },
			],
			seriesStyles: { Yes: { stroke: '#abcdef', pattern: 'striped' } },
		});
		const slices = (key) =>
			[...container.querySelectorAll(`g.cb__small-multiples__panel[data-panel-key="${key}"] path[fill]`)].map(
				(node) => `${node.getAttribute('fill')} ${node.getAttribute('stroke')}`
			);
		const [demsYes] = slices('Dems');
		const id = demsYes.match(/^url\(#(.+)\)/)?.[1];

		expect(demsYes).toMatch(/ #abcdef$/);
		expect(slices('Reps')[0]).toBe(demsYes);
		expect(container.querySelector(`[id="${id}"] [fill="#111111"]`)).not.toBeNull();
	});

	test('waffle panels paint from the panel name row', () => {
		const { container } = renderSmallMultiples({
			groupKey: null,
			panelType: 'waffle',
			data: [{ x: 'Share', Dems: 40, Reps: 60 }],
			seriesStyles: { Dems: { stroke: '#abcdef', pattern: 'striped' } },
		});
		const cell = (key) =>
			container.querySelector(`g.cb__small-multiples__panel[data-panel-key="${key}"] rect.visx-bar`);
		const id = cell('Dems')
			.getAttribute('fill')
			.match(/^url\(#(.+)\)/)?.[1];

		expect(cell('Dems').getAttribute('stroke')).toBe('#abcdef');
		expect(container.querySelector(`[id="${id}"] [fill="#111111"]`)).not.toBeNull();
		expect(cell('Reps').getAttribute('fill')).toBe('#222222');
	});
});
