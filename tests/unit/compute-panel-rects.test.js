import {
	computePanelRects,
	computeGridHeight,
	resolveEffectiveColumns,
} from '../../../prc-scripts/includes/scripts/src/@prc/charting-utilities/smallMultiples/computePanelRects';

describe('resolveEffectiveColumns', () => {
	it('returns the requested columns when the chart is wide enough', () => {
		expect(
			resolveEffectiveColumns({
				columns: 3,
				chartWidth: 640,
				minPanelWidth: 120,
				gapX: 24,
			})
		).toBe(3);
	});

	it('collapses columns when the chart is too narrow for the request', () => {
		// 200px cannot fit 3 panels at min 120 + gaps
		expect(
			resolveEffectiveColumns({
				columns: 3,
				chartWidth: 200,
				minPanelWidth: 120,
				gapX: 24,
			})
		).toBe(1);
	});

	it('never returns less than 1', () => {
		expect(
			resolveEffectiveColumns({
				columns: 0,
				chartWidth: 640,
				minPanelWidth: 120,
				gapX: 24,
			})
		).toBe(1);
	});
});

describe('computeGridHeight', () => {
	it('derives total height from locked panel height and row count', () => {
		// 2 rows × 184 + 1 gap × 32 = 400
		expect(
			computeGridHeight({
				rowCount: 2,
				panelHeight: 184,
				gapY: 32,
			})
		).toBe(400);
	});

	it('grows when restack increases rows', () => {
		expect(
			computeGridHeight({
				rowCount: 6,
				panelHeight: 184,
				gapY: 32,
			})
		).toBe(184 * 6 + 32 * 5);
	});

	it('returns 0 for zero rows', () => {
		expect(
			computeGridHeight({
				rowCount: 0,
				panelHeight: 184,
				gapY: 32,
			})
		).toBe(0);
	});
});

describe('computePanelRects', () => {
	it('lays out a 3-column grid of 6 panels with locked panel height', () => {
		const { rects, columns, rowCount, totalHeight } = computePanelRects({
			width: 630,
			panelHeight: 180,
			panelCount: 6,
			columns: 3,
			gapX: 30,
			gapY: 40,
			titlePad: 20,
		});

		expect(columns).toBe(3);
		expect(rowCount).toBe(2);
		expect(totalHeight).toBe(180 * 2 + 40);
		expect(rects).toHaveLength(6);

		// cellWidth = (630 - 30*2) / 3 = 190
		expect(rects[0]).toMatchObject({
			index: 0,
			col: 0,
			row: 0,
			x: 0,
			y: 0,
			width: 190,
			height: 180,
			titlePad: 20,
			plotWidth: 190,
			plotHeight: 160,
		});
		expect(rects[1]).toMatchObject({
			index: 1,
			col: 1,
			row: 0,
			x: 220,
			y: 0,
		});
		expect(rects[3]).toMatchObject({
			index: 3,
			col: 0,
			row: 1,
			x: 0,
			y: 220,
		});
	});

	it('keeps panel height stable when columns restack to 1', () => {
		const desktop = computePanelRects({
			width: 630,
			panelHeight: 184,
			panelCount: 6,
			columns: 3,
			gapX: 30,
			gapY: 32,
			titlePad: 20,
		});
		const mobile = computePanelRects({
			width: 300,
			panelHeight: 184,
			panelCount: 6,
			columns: 1,
			gapX: 30,
			gapY: 32,
			titlePad: 20,
		});

		expect(desktop.rects[0].height).toBe(184);
		expect(mobile.rects[0].height).toBe(184);
		expect(mobile.rowCount).toBe(6);
		expect(mobile.totalHeight).toBeGreaterThan(desktop.totalHeight);
		expect(mobile.rects[1].y).toBe(184 + 32);
	});

	it('restacks to one column when columns is 1', () => {
		const { rects, columns, rowCount, totalHeight } = computePanelRects({
			width: 300,
			panelHeight: 200,
			panelCount: 3,
			columns: 1,
			gapX: 24,
			gapY: 20,
			titlePad: 0,
		});

		expect(columns).toBe(1);
		expect(rowCount).toBe(3);
		expect(totalHeight).toBe(200 * 3 + 20 * 2);
		expect(rects.map((r) => r.col)).toEqual([0, 0, 0]);
		expect(rects.map((r) => r.row)).toEqual([0, 1, 2]);
		expect(rects[0].width).toBe(300);
		expect(rects[1].y).toBe(rects[0].height + 20);
	});

	it('returns empty rects for zero panels', () => {
		const result = computePanelRects({
			width: 640,
			panelHeight: 184,
			panelCount: 0,
			columns: 3,
			gapX: 24,
			gapY: 32,
			titlePad: 8,
		});
		expect(result.rects).toEqual([]);
		expect(result.rowCount).toBe(0);
		expect(result.totalHeight).toBe(0);
	});
});
