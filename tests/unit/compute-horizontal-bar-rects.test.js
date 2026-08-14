import {
	computeHorizontalBarRects,
	computeBarPanelHeight,
} from '../../../prc-scripts/includes/scripts/src/@prc/charting-utilities/smallMultiples/computeHorizontalBarRects';

describe('computeBarPanelHeight', () => {
	it('derives cell height from band count and row height', () => {
		// titlePad 20 + 4*28 + bottomInset 20 = 152
		expect(
			computeBarPanelHeight({
				bandCount: 4,
				rowHeight: 28,
				titlePad: 20,
				bottomInset: 20,
			})
		).toBe(152);
	});

	it('grows when more categories are added', () => {
		const short = computeBarPanelHeight({
			bandCount: 2,
			rowHeight: 28,
			titlePad: 0,
			bottomInset: 0,
		});
		const tall = computeBarPanelHeight({
			bandCount: 6,
			rowHeight: 28,
			titlePad: 0,
			bottomInset: 0,
		});
		expect(tall).toBeGreaterThan(short);
		expect(tall).toBe(6 * 28);
	});

	it('honors a minimum plot height', () => {
		expect(
			computeBarPanelHeight({
				bandCount: 1,
				rowHeight: 10,
				titlePad: 0,
				bottomInset: 0,
				minPlotHeight: 40,
			})
		).toBe(40);
	});
});

describe('computeHorizontalBarRects', () => {
	const bandDomain = ['a', 'b', 'c'];

	it('places one horizontal bar per row within the band domain', () => {
		const bars = computeHorizontalBarRects({
			rows: [
				{ x: 'a', y: 50 },
				{ x: 'b', y: 100 },
				{ x: 'c', y: 0 },
			],
			bandDomain,
			xDomain: [0, 100],
			plotWidth: 200,
			plotHeight: 150,
			padding: 0,
		});

		expect(bars).toHaveLength(3);
		// With padding 0, each band is 50px tall
		expect(bars[0]).toMatchObject({
			key: 'a',
			y: 0,
			height: 50,
			x: 0,
			width: 100,
			value: 50,
		});
		expect(bars[1]).toMatchObject({
			key: 'b',
			y: 50,
			height: 50,
			x: 0,
			width: 200,
			value: 100,
		});
		expect(bars[2]).toMatchObject({
			key: 'c',
			y: 100,
			height: 50,
			width: 0,
			value: 0,
		});
	});

	it('skips rows whose x is not in the band domain', () => {
		const bars = computeHorizontalBarRects({
			rows: [
				{ x: 'a', y: 10 },
				{ x: 'missing', y: 99 },
			],
			bandDomain: ['a'],
			xDomain: [0, 100],
			plotWidth: 100,
			plotHeight: 50,
			padding: 0,
		});
		expect(bars).toHaveLength(1);
		expect(bars[0].key).toBe('a');
	});
});
