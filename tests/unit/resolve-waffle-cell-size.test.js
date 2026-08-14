import {
	fitWaffleCellSize,
	resolveWaffleCellSize,
	waffleSpanFactor,
} from '../../../prc-scripts/includes/scripts/src/@prc/charting-utilities/waffle/resolveWaffleCellSize';

describe('resolveWaffleCellSize', () => {
	it('computes span factor from columns and gap', () => {
		expect(waffleSpanFactor(10, 0.1)).toBeCloseTo(10.9);
		expect(waffleSpanFactor(1, 0.1)).toBe(1);
	});

	it('fits to the smaller of width and height constraints', () => {
		const size = fitWaffleCellSize({
			columns: 10,
			rows: 10,
			cellGap: 0,
			availableWidth: 200,
			availableHeight: 100,
		});
		expect(size).toBe(10);
	});

	it('fixed mode always returns the preferred size', () => {
		expect(
			resolveWaffleCellSize({
				mode: 'fixed',
				cellSize: 14,
				columns: 10,
				rows: 10,
				cellGap: 0,
				availableWidth: 50,
				availableHeight: 50,
			})
		).toBe(14);
	});

	it('auto mode always returns the fitted size', () => {
		expect(
			resolveWaffleCellSize({
				mode: 'auto',
				cellSize: 14,
				columns: 10,
				rows: 10,
				cellGap: 0,
				availableWidth: 200,
				availableHeight: 200,
			})
		).toBe(20);
	});

	it('clamp mode keeps preferred size when it fits', () => {
		expect(
			resolveWaffleCellSize({
				mode: 'clamp',
				cellSize: 14,
				columns: 10,
				rows: 10,
				cellGap: 0,
				availableWidth: 200,
				availableHeight: 200,
			})
		).toBe(14);
	});

	it('clamp mode scales down when preferred size overflows', () => {
		expect(
			resolveWaffleCellSize({
				mode: 'clamp',
				cellSize: 14,
				columns: 10,
				rows: 10,
				cellGap: 0,
				availableWidth: 100,
				availableHeight: 100,
			})
		).toBe(10);
	});
});
