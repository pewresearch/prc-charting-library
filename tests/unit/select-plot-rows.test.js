import {
	canonicalRowValue,
	selectPlotRows,
} from '../../../prc-scripts/includes/scripts/src/@prc/charting-utilities/compute/selectPlotRows';

describe('selectPlotRows', () => {
	const yearRows = [
		{ x: '2009', y: 1 },
		{ x: '2010', y: 5 },
		{ x: 'Difference', y: 4 },
	];

	it('returns the same rows when exclude is empty', () => {
		const result = selectPlotRows(yearRows, {
			x: 'x',
			rowFilter: { column: 'x', exclude: [] },
		});
		expect(result).toBe(yearRows);
	});

	it('drops a flat Difference row on column x and keeps years', () => {
		const result = selectPlotRows(yearRows, {
			x: 'x',
			rowFilter: { column: 'x', exclude: ['Difference'] },
		});
		expect(result).toEqual([
			{ x: '2009', y: 1 },
			{ x: '2010', y: 5 },
		]);
		expect(yearRows).toHaveLength(3);
	});

	it('drops the excluded row inside a nested [rows] array', () => {
		const nested = [yearRows];
		const result = selectPlotRows(nested, {
			x: 'x',
			rowFilter: { column: 'x', exclude: ['Difference'] },
		});
		expect(result).toHaveLength(1);
		expect(result[0]).toEqual([
			{ x: '2009', y: 1 },
			{ x: '2010', y: 5 },
		]);
		expect(nested[0]).toHaveLength(3);
	});

	it('defaults the column to x when rowFilter.column is omitted', () => {
		const result = selectPlotRows(yearRows, {
			x: 'x',
			rowFilter: { exclude: ['Difference'] },
		});
		expect(result).toEqual([
			{ x: '2009', y: 1 },
			{ x: '2010', y: 5 },
		]);
	});

	it('excludes rows by a custom column', () => {
		const rows = [
			{ x: '2009', Role: 'keep', y: 1 },
			{ x: '2010', Role: 'skip', y: 5 },
			{ x: '2011', Role: 'keep', y: 12 },
		];
		const result = selectPlotRows(rows, {
			x: 'x',
			rowFilter: { column: 'Role', exclude: ['skip'] },
		});
		expect(result).toEqual([
			{ x: '2009', Role: 'keep', y: 1 },
			{ x: '2011', Role: 'keep', y: 12 },
		]);
	});

	it('drops only rows whose canonical value matches when x is duplicated', () => {
		const rows = [
			{ x: '2010', y: 1 },
			{ x: '2010', y: 2 },
			{ x: 'Difference', y: 3 },
		];
		const result = selectPlotRows(rows, {
			x: 'x',
			rowFilter: { column: 'x', exclude: ['Difference'] },
		});
		expect(result).toEqual([
			{ x: '2010', y: 1 },
			{ x: '2010', y: 2 },
		]);
	});

	it('canonicalizes Date values to YYYY-MM-DD for matching', () => {
		const date = new Date(Date.UTC(2010, 0, 15));
		expect(canonicalRowValue(date)).toBe('2010-01-15');
		const rows = [
			{ x: date, y: 1 },
			{ x: 'Difference', y: 2 },
		];
		const result = selectPlotRows(rows, {
			x: 'x',
			rowFilter: { column: 'x', exclude: ['2010-01-15'] },
		});
		expect(result).toEqual([{ x: 'Difference', y: 2 }]);
	});

	it('returns null or undefined data unchanged', () => {
		const dataRender = {
			x: 'x',
			rowFilter: { column: 'x', exclude: ['Difference'] },
		};
		expect(selectPlotRows(null, dataRender)).toBe(null);
		expect(selectPlotRows(undefined, dataRender)).toBe(undefined);
	});
});
