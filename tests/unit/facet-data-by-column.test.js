import { facetDataByColumn } from '../../../prc-scripts/includes/scripts/src/@prc/charting-utilities/smallMultiples/facetDataByColumn';

describe('facetDataByColumn', () => {
	const wideData = [
		{ x: '2009', Chrome: 1, IE: 60, Firefox: 30 },
		{ x: '2010', Chrome: 5, IE: 50, Firefox: 28 },
		{ x: '2011', Chrome: 12, IE: 40, Firefox: 25 },
	];

	it('facets each non-x column into its own panel series', () => {
		const panels = facetDataByColumn(wideData);

		expect(panels).toHaveLength(3);
		expect(panels.map((p) => p.key)).toEqual(['Chrome', 'IE', 'Firefox']);
		expect(panels[0].rows).toEqual([
			{ x: '2009', y: 1, Chrome: 1 },
			{ x: '2010', y: 5, Chrome: 5 },
			{ x: '2011', y: 12, Chrome: 12 },
		]);
		expect(panels[1].rows[0]).toEqual({ x: '2009', y: 60, IE: 60 });
	});

	it('respects an explicit categories list for panel order', () => {
		const panels = facetDataByColumn(wideData, ['Firefox', 'Chrome']);

		expect(panels.map((p) => p.key)).toEqual(['Firefox', 'Chrome']);
		expect(panels).toHaveLength(2);
	});

	it('returns an empty array for empty or missing data', () => {
		expect(facetDataByColumn([])).toEqual([]);
		expect(facetDataByColumn(null)).toEqual([]);
		expect(facetDataByColumn(undefined)).toEqual([]);
	});

	it('skips reserved meta keys when deriving categories', () => {
		const data = [
			{
				x: 'A',
				Chrome: 10,
				category: 'ignore-me',
				x__label: 'A label',
				y: 99,
				isHighlighted: true,
			},
		];
		const panels = facetDataByColumn(data);
		expect(panels.map((p) => p.key)).toEqual(['Chrome']);
	});
});
