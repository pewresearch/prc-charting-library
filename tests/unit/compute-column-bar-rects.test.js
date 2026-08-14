import { computeColumnBarRects, resolveBandDomain } from '../../../prc-scripts/includes/scripts/src/@prc/charting-utilities/smallMultiples/computeColumnBarRects';

describe('resolveBandDomain', () => {
	it('collects unique x values in first-seen order across panels', () => {
		const domain = resolveBandDomain([
			{
				key: 'A',
				rows: [
					{ x: 2010, y: 1 },
					{ x: 2015, y: 2 },
				],
			},
			{
				key: 'B',
				rows: [
					{ x: 2015, y: 3 },
					{ x: 2020, y: 4 },
				],
			},
		]);
		expect(domain).toEqual(['2010', '2015', '2020']);
	});

	it('returns empty for no panels', () => {
		expect(resolveBandDomain([])).toEqual([]);
	});
});

describe('computeColumnBarRects', () => {
	const bandDomain = ['a', 'b', 'c'];

	it('places one bar per row within the band domain', () => {
		const bars = computeColumnBarRects({
			rows: [
				{ x: 'a', y: 50 },
				{ x: 'b', y: 100 },
				{ x: 'c', y: 0 },
			],
			bandDomain,
			yDomain: [0, 100],
			plotWidth: 300,
			plotHeight: 100,
			padding: 0,
		});

		expect(bars).toHaveLength(3);
		// With padding 0, each band is 100px wide
		expect(bars[0]).toMatchObject({
			key: 'a',
			x: 0,
			width: 100,
			value: 50,
		});
		expect(bars[0].y).toBe(50);
		expect(bars[0].height).toBe(50);

		expect(bars[1]).toMatchObject({
			key: 'b',
			x: 100,
			width: 100,
			y: 0,
			height: 100,
			value: 100,
		});

		expect(bars[2]).toMatchObject({
			key: 'c',
			x: 200,
			width: 100,
			y: 100,
			height: 0,
			value: 0,
		});
	});

	it('skips rows whose x is not in the band domain', () => {
		const bars = computeColumnBarRects({
			rows: [
				{ x: 'a', y: 10 },
				{ x: 'missing', y: 99 },
			],
			bandDomain: ['a'],
			yDomain: [0, 100],
			plotWidth: 100,
			plotHeight: 100,
			padding: 0,
		});
		expect(bars).toHaveLength(1);
		expect(bars[0].key).toBe('a');
	});

	it('applies inner padding so bars are narrower than the step', () => {
		const bars = computeColumnBarRects({
			rows: [{ x: 'a', y: 100 }],
			bandDomain: ['a', 'b'],
			yDomain: [0, 100],
			plotWidth: 200,
			plotHeight: 100,
			padding: 0.5,
		});
		expect(bars[0].width).toBeLessThan(100);
		expect(bars[0].width).toBeGreaterThan(0);
	});
});
