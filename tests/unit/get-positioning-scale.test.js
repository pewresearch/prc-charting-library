import {
	getPositioningScale,
	scalePositionToDisplay,
	scalePositionToLayout,
} from '../../src/lib/overlays/getPositioningScale';

const layout = {
	width: 640,
	height: 400,
	padding: { top: 10, right: 20, bottom: 30, left: 40 },
};

const designPanelRects = [
	{
		index: 0,
		col: 0,
		row: 0,
		x: 0,
		y: 0,
		width: 180,
		height: 184,
		plotWidth: 180,
		plotHeight: 160,
		titlePad: 24,
	},
	{
		index: 1,
		col: 1,
		row: 0,
		x: 204,
		y: 0,
		width: 180,
		height: 184,
		plotWidth: 180,
		plotHeight: 160,
		titlePad: 24,
	},
];

describe('getPositioningScale', () => {
	it('chart context: origin at 0 and full chart ratios', () => {
		const scale = getPositioningScale({
			context: 'chart',
			layout,
			chartWidth: 320,
			chartHeight: 200,
		});
		expect(scale.originX).toBe(0);
		expect(scale.originY).toBe(0);
		expect(scale.widthRatio).toBeCloseTo(0.5);
		expect(scale.heightRatio).toBeCloseTo(0.5);
		expect(scalePositionToDisplay(100, 80, scale)).toEqual({ x: 50, y: 40 });
	});

	it('inner context: origin at padding and inner ratios', () => {
		const scale = getPositioningScale({
			context: 'inner',
			layout,
			chartWidth: 640,
			chartHeight: 400,
		});
		expect(scale.originX).toBe(40);
		expect(scale.originY).toBe(10);
		expect(scale.refWidth).toBe(580);
		expect(scale.refHeight).toBe(360);
		expect(scalePositionToDisplay(0, 0, scale)).toEqual({ x: 40, y: 10 });
	});

	it('panel context: origin at grid offset + rect; X scales vs design cell width', () => {
		const panels = [{ key: 'Chrome' }, { key: 'IE' }];
		const panelRects = [
			{ ...designPanelRects[0], width: 90, plotWidth: 90 },
			{ ...designPanelRects[1], x: 112, width: 90, plotWidth: 90 },
		];
		const scale = getPositioningScale({
			context: 'panel',
			panelKey: 'IE',
			layout,
			chartWidth: 320,
			chartHeight: 200,
			panels,
			panelRects,
			designPanelRects,
			gridOffset: { x: 40, y: 10 },
		});
		expect(scale.originX).toBe(40 + 112);
		expect(scale.originY).toBe(10);
		expect(scale.widthRatio).toBeCloseTo(0.5);
		expect(scale.heightRatio).toBe(1);
		expect(scalePositionToDisplay(20, 10, scale)).toEqual({
			x: 40 + 112 + 10,
			y: 10 + 10,
		});
	});

	it('panel-inner context: origin includes titlePad + leftInset; plot ratios', () => {
		const panels = [{ key: 'Safari' }];
		const panelRects = [
			{
				index: 0,
				col: 0,
				row: 0,
				x: 0,
				y: 0,
				width: 90,
				height: 184,
				plotWidth: 90,
				plotHeight: 160,
				titlePad: 24,
			},
		];
		const designRects = [
			{
				index: 0,
				col: 0,
				row: 0,
				x: 0,
				y: 0,
				width: 180,
				height: 184,
				plotWidth: 180,
				plotHeight: 160,
				titlePad: 24,
			},
		];
		const leftInset = 32;
		const bottomInset = 20;
		const scale = getPositioningScale({
			context: 'panel-inner',
			panelKey: 'Safari',
			layout,
			chartWidth: 320,
			chartHeight: 400,
			panels,
			panelRects,
			designPanelRects: designRects,
			gridOffset: { x: 40, y: 10 },
			titlePad: 24,
			leftInset,
			bottomInset,
		});
		expect(scale.originX).toBe(40 + 0 + leftInset);
		expect(scale.originY).toBe(10 + 0 + 24);
		const designPlotW = 180 - leftInset;
		const plotW = 90 - leftInset;
		expect(scale.widthRatio).toBeCloseTo(plotW / designPlotW);
		expect(scale.heightRatio).toBeCloseTo((160 - bottomInset) / (160 - bottomInset));
	});

	it('panel context falls back to chart when panelKey is missing', () => {
		const scale = getPositioningScale({
			context: 'panel',
			panelKey: 'missing',
			layout,
			chartWidth: 320,
			chartHeight: 200,
			panels: [{ key: 'Chrome' }],
			panelRects: [designPanelRects[0]],
			designPanelRects,
		});
		expect(scale.originX).toBe(0);
		expect(scale.originY).toBe(0);
	});

	it('round-trips display ↔ layout for panel offsets', () => {
		const panels = [{ key: 'A' }];
		const panelRects = [{ ...designPanelRects[0], width: 120, plotWidth: 120 }];
		const scale = getPositioningScale({
			context: 'panel',
			panelKey: 'A',
			layout,
			chartWidth: 320,
			chartHeight: 200,
			panels,
			panelRects,
			designPanelRects: [designPanelRects[0]],
			gridOffset: { x: 0, y: 0 },
		});
		const display = scalePositionToDisplay(40, 20, scale);
		expect(scalePositionToLayout(display.x, display.y, scale)).toEqual({ x: 40, y: 20 });
	});

	it('restack preserves fractional X position within the cell', () => {
		const panels = [{ key: 'Safari' }];
		const designRects = [
			{
				index: 0,
				col: 0,
				row: 0,
				x: 0,
				y: 0,
				width: 200,
				height: 184,
				plotWidth: 200,
				plotHeight: 160,
				titlePad: 24,
			},
		];
		const wideRect = [{ ...designRects[0], x: 224, width: 200, plotWidth: 200 }];
		const narrowRect = [{ ...designRects[0], x: 0, width: 100, plotWidth: 100 }];
		const layoutOffsetX = 50;
		const wide = getPositioningScale({
			context: 'panel',
			panelKey: 'Safari',
			layout,
			chartWidth: 640,
			chartHeight: 400,
			panels,
			panelRects: wideRect,
			designPanelRects: designRects,
			gridOffset: { x: 40, y: 10 },
		});
		const narrow = getPositioningScale({
			context: 'panel',
			panelKey: 'Safari',
			layout,
			chartWidth: 320,
			chartHeight: 800,
			panels,
			panelRects: narrowRect,
			designPanelRects: designRects,
			gridOffset: { x: 40, y: 10 },
		});
		const wideDisplay = scalePositionToDisplay(layoutOffsetX, 8, wide);
		const narrowDisplay = scalePositionToDisplay(layoutOffsetX, 8, narrow);
		// 50/200 of cell width → 25px at half width
		expect(wideDisplay.x - wide.originX).toBeCloseTo(50);
		expect(narrowDisplay.x - narrow.originX).toBeCloseTo(25);
		expect(wideDisplay.y - wide.originY).toBe(8);
		expect(narrowDisplay.y - narrow.originY).toBe(8);
	});
});
