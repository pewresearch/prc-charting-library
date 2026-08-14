import {
	computeWaffleCells,
	resolveWaffleMax,
} from '../../../prc-scripts/includes/scripts/src/@prc/charting-utilities/waffle/computeWaffleCells';

describe('computeWaffleCells', () => {
	it('allocates exactly 100 filled cells when whole max equals the sum', () => {
		const result = computeWaffleCells({
			mode: 'whole',
			categories: [
				{ key: 'A', value: 40 },
				{ key: 'B', value: 35 },
				{ key: 'C', value: 25 },
			],
		});

		expect(result.cells).toHaveLength(100);
		expect(result.max).toBe(100);
		const filled = result.cells.filter((cell) => cell.categoryIndex >= 0);
		expect(filled).toHaveLength(100);

		const counts = result.categories.map((category) => ({
			key: category.key,
			count: filled.filter((cell) => cell.categoryKey === category.key).length,
		}));

		expect(counts).toEqual([
			{ key: 'A', count: 40 },
			{ key: 'B', count: 35 },
			{ key: 'C', count: 25 },
		]);
	});

	it('leaves empty cells when whole max exceeds the sum of values', () => {
		const result = computeWaffleCells({
			mode: 'whole',
			categories: [
				{ key: 'A', value: 40 },
				{ key: 'B', value: 30 },
			],
			max: 100,
			columns: 10,
			rows: 10,
		});

		expect(result.cells).toHaveLength(100);
		expect(result.cells.filter((cell) => cell.categoryIndex >= 0)).toHaveLength(70);
		expect(result.cells.filter((cell) => cell.categoryIndex === -1)).toHaveLength(30);
	});

	it('fills portion mode from value/max against the grid', () => {
		const result = computeWaffleCells({
			mode: 'portion',
			categories: [{ key: 'Chrome', value: 37 }],
			max: 100,
		});

		expect(result.cells).toHaveLength(100);
		expect(result.categories[0].ratio).toBe(37);
		expect(result.cells.filter((cell) => cell.categoryIndex >= 0)).toHaveLength(37);
		expect(result.cells.filter((cell) => cell.categoryIndex === -1)).toHaveLength(63);
	});

	it('scales portion fill when max is not 100', () => {
		const result = computeWaffleCells({
			mode: 'portion',
			categories: [{ key: 'Company X', value: 40 }],
			max: 200,
			columns: 10,
			rows: 10,
		});

		expect(result.max).toBe(200);
		expect(result.cells.filter((cell) => cell.categoryIndex >= 0)).toHaveLength(20);
	});

	it('supports non-square grids', () => {
		const result = computeWaffleCells({
			mode: 'portion',
			categories: [{ key: 'A', value: 50 }],
			max: 100,
			columns: 6,
			rows: 10,
		});

		expect(result.cells).toHaveLength(60);
		expect(result.cells.filter((cell) => cell.categoryIndex >= 0)).toHaveLength(30);
	});
});

describe('resolveWaffleMax', () => {
	it('defaults portion to 100 and whole to the sum', () => {
		expect(resolveWaffleMax('portion', [{ key: 'A', value: 40 }], null)).toBe(100);
		expect(
			resolveWaffleMax(
				'whole',
				[
					{ key: 'A', value: 40 },
					{ key: 'B', value: 60 },
				],
				null
			)
		).toBe(100);
	});

	it('uses an explicit positive max', () => {
		expect(resolveWaffleMax('portion', [{ key: 'A', value: 40 }], 200)).toBe(200);
	});
});
