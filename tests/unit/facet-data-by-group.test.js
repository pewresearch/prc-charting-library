import { facetDataByGroup } from '../../../prc-scripts/includes/scripts/src/@prc/charting-utilities/smallMultiples/facetDataByGroup';

const demoRows = [
	{ x: 2022, Reliable: 83, 'Not Reliable': 31, Country: 'Sweden' },
	{ x: 2026, Reliable: 16, 'Not Reliable': 69, Country: 'Sweden' },
	{ x: 2022, Reliable: 83, 'Not Reliable': 35, Country: 'Canada' },
	{ x: 2026, Reliable: 16, 'Not Reliable': 65, Country: 'Canada' },
];

describe('facetDataByGroup', () => {
	it('facets one panel per group value in first-seen order', () => {
		const panels = facetDataByGroup(demoRows, 'Country');
		expect(panels.map((p) => p.key)).toEqual(['Sweden', 'Canada']);
	});

	it('creates one series per data column, excluding the group column', () => {
		const panels = facetDataByGroup(demoRows, 'Country');
		const sweden = panels[0];
		expect(sweden.series.map((s) => s.key)).toEqual(['Reliable', 'Not Reliable']);
		expect(sweden.series[0].rows).toEqual([
			{ x: 2022, y: 83, Reliable: 83 },
			{ x: 2026, y: 16, Reliable: 16 },
		]);
		expect(sweden.series[1].rows).toEqual([
			{ x: 2022, y: 31, 'Not Reliable': 31 },
			{ x: 2026, y: 69, 'Not Reliable': 69 },
		]);
	});

	it('respects explicit categories and filters out the group key', () => {
		const panels = facetDataByGroup(demoRows, 'Country', ['Reliable', 'Country']);
		expect(panels[0].series.map((s) => s.key)).toEqual(['Reliable']);
	});

	it('drops empty cells from a group series the same way line charts do', () => {
		const data = [
			{ x: 2022, Reliable: 83, Country: 'Sweden' },
			{ x: 2024, Reliable: '', Country: 'Sweden' },
			{ x: 2026, Reliable: 16, Country: 'Sweden' },
		];
		const panels = facetDataByGroup(data, 'Country');
		expect(panels[0].series[0].rows.map((row) => row.x)).toEqual([2022, 2026]);
		expect(panels[0].series[0].rows.map((row) => row.y)).toEqual([83, 16]);
	});

	it('returns empty for empty or missing data', () => {
		expect(facetDataByGroup([], 'Country')).toEqual([]);
		expect(facetDataByGroup(null, 'Country')).toEqual([]);
	});

	it('returns empty when the group key is missing from rows', () => {
		expect(facetDataByGroup([{ x: 1, A: 2 }], 'Country')).toEqual([]);
	});

	it('orders panels by groupOrder when provided, appending unknowns', () => {
		const panels = facetDataByGroup(demoRows, 'Country', null, ['Canada']);
		expect(panels.map((p) => p.key)).toEqual(['Canada', 'Sweden']);
	});
});
