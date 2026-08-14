import { computeWaffleLayout } from '../../../prc-scripts/includes/scripts/src/@prc/charting-utilities/waffle/computeWaffleLayout';

describe('computeWaffleLayout', () => {
	it('keeps cell size fixed when columns change', () => {
		const tenWide = computeWaffleLayout({
			columns: 10,
			rows: 10,
			cellSize: 14,
			cellGap: 0.1,
		});
		const sixWide = computeWaffleLayout({
			columns: 6,
			rows: 10,
			cellSize: 14,
			cellGap: 0.1,
		});

		expect(tenWide.cellSize).toBe(14);
		expect(sixWide.cellSize).toBe(14);
		expect(sixWide.width).toBeLessThan(tenWide.width);
		expect(sixWide.height).toBe(tenWide.height);
	});

	it('positions cells on a fixed step grid', () => {
		const layout = computeWaffleLayout({
			columns: 3,
			rows: 2,
			cellSize: 10,
			cellGap: 0.2,
		});
		expect(layout.position(0, 0)).toEqual({ x: 0, y: 0 });
		expect(layout.position(1, 0)).toEqual({ x: 12, y: 0 });
		expect(layout.position(0, 1)).toEqual({ x: 0, y: 12 });
	});
});
