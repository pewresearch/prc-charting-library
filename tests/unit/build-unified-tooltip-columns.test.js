/**
 * Columns for the unified tooltip.
 *
 * A column is one x-position with every series that has a value there. The
 * projections charts hover a year and read all seven religions at once.
 */
import { buildUnifiedTooltipColumns } from '../../../prc-scripts/includes/scripts/src/@prc/charting-utilities/unifiedTooltip/buildUnifiedTooltipColumns';

const ROWS = [
	{ x: 2020, Muslims: 25.1, Christians: 30.4 },
	{ x: 2030, Muslims: 26.8, Christians: 29.2 },
];

const OPTIONS = {
	rows: ROWS,
	categories: ['Muslims', 'Christians'],
	getX: (row) => row.x,
	toPixelX: (x) => (x - 2020) / 10,
	toPixelY: (value) => 100 - value,
	getColor: (category) => ('Muslims' === category ? '#949D48' : '#BF3B27'),
};

describe('buildUnifiedTooltipColumns', () => {
	it('builds one column per row, carrying each series value', () => {
		const columns = buildUnifiedTooltipColumns(OPTIONS);

		expect(columns).toHaveLength(2);
		expect(columns[0].xValue).toBe(2020);
		expect(columns[0].px).toBe(0);
		expect(columns[0].entries).toEqual([
			expect.objectContaining({ category: 'Christians', value: 30.4 }),
			expect.objectContaining({ category: 'Muslims', value: 25.1 }),
		]);
	});

	// `Line.tsx` builds its voronoi with `if (d[c])`, which drops zeros and
	// makes those points unhoverable. A religion rounding to 0.0% is exactly
	// the row a reader is hunting for here.
	it('omits a series with no value but keeps a zero', () => {
		const columns = buildUnifiedTooltipColumns({
			...OPTIONS,
			rows: [{ x: 2020, Muslims: 0, Christians: null, Jews: '' }],
			categories: ['Muslims', 'Christians', 'Jews'],
			getColor: () => '#000',
		});

		expect(columns[0].entries).toHaveLength(1);
		expect(columns[0].entries[0]).toMatchObject({
			category: 'Muslims',
			value: 0,
		});
	});

	// Without this the rule extent reduces over an empty array and Math.min
	// hands back Infinity.
	it('drops a column where no series has a value', () => {
		const columns = buildUnifiedTooltipColumns({
			...OPTIONS,
			rows: [
				{ x: 2020, Muslims: null, Christians: null },
				{ x: 2030, Muslims: 26.8, Christians: 29.2 },
			],
		});

		expect(columns).toHaveLength(1);
		expect(columns[0].xValue).toBe(2030);
	});

	it('sorts entries descending so the tooltip reads in plotted order', () => {
		const columns = buildUnifiedTooltipColumns({
			...OPTIONS,
			rows: [
				{
					x: 2020,
					Buddhists: 0.04,
					Muslims: 25.1,
					Jews: 0.2,
					Christians: 30.4,
				},
			],
			categories: ['Buddhists', 'Muslims', 'Jews', 'Christians'],
			getColor: () => '#000',
		});

		expect(columns[0].entries.map((entry) => entry.category)).toEqual([
			'Christians',
			'Muslims',
			'Jews',
			'Buddhists',
		]);
	});

	it('spans the rule from the topmost to the bottommost plotted point', () => {
		const columns = buildUnifiedTooltipColumns({
			...OPTIONS,
			rows: [{ x: 2020, Muslims: 25.1, Christians: 30.4 }],
		});

		expect(columns[0].ruleTop).toBeCloseTo(69.6);
		expect(columns[0].ruleBottom).toBeCloseTo(74.9);
	});

	// The chart reads this to skip drawing a rule with nowhere to span.
	it('collapses the rule when only one series is plotted', () => {
		const columns = buildUnifiedTooltipColumns({
			...OPTIONS,
			rows: [{ x: 2020, Muslims: 25.1, Christians: null }],
		});

		expect(columns[0].ruleTop).toBe(columns[0].ruleBottom);
	});

	// StackedArea reports raw values but draws nodes on cumulative tops. The
	// value and the pixel are independent, which is what lets one module serve
	// both charts.
	it('places nodes via the pixel mapping, not the reported value', () => {
		const columns = buildUnifiedTooltipColumns({
			...OPTIONS,
			rows: [{ x: 2020, Muslims: 25.1, Christians: 30.4 }],
			toPixelY: (value, row, category) => ('Christians' === category ? 100 - (row.Muslims + value) : 100 - value),
		});

		const christians = columns[0].entries.find((entry) => 'Christians' === entry.category);
		expect(christians.value).toBe(30.4);
		expect(christians.py).toBeCloseTo(44.5);
	});
});
