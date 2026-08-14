import { resolvePanelRect } from '../../../prc-scripts/includes/scripts/src/@prc/charting-utilities/smallMultiples/resolvePanelRect';

const panels = [{ key: 'Chrome' }, { key: 'IE' }, { key: 'Firefox' }];
const rects = [
	{ index: 0, col: 0, row: 0, x: 0, y: 0, width: 200, height: 184, plotWidth: 200, plotHeight: 160, titlePad: 24 },
	{ index: 1, col: 1, row: 0, x: 224, y: 0, width: 200, height: 184, plotWidth: 200, plotHeight: 160, titlePad: 24 },
	{ index: 2, col: 0, row: 1, x: 0, y: 216, width: 200, height: 184, plotWidth: 200, plotHeight: 160, titlePad: 24 },
];

describe('resolvePanelRect', () => {
	it('returns the rect aligned with the matching panel key', () => {
		expect(resolvePanelRect({ panels, rects, panelKey: 'IE' })).toEqual(rects[1]);
		expect(resolvePanelRect({ panels, rects, panelKey: 'Firefox' })).toEqual(rects[2]);
	});

	it('returns null when the panel key is missing', () => {
		expect(resolvePanelRect({ panels, rects, panelKey: 'Safari' })).toBeNull();
		expect(resolvePanelRect({ panels, rects, panelKey: '' })).toBeNull();
	});

	it('returns null for empty panels or rects', () => {
		expect(resolvePanelRect({ panels: [], rects, panelKey: 'Chrome' })).toBeNull();
		expect(resolvePanelRect({ panels, rects: [], panelKey: 'Chrome' })).toBeNull();
	});

	it('still finds a key after restack changes rect positions', () => {
		const restacked = [
			{ ...rects[0], col: 0, row: 0, x: 0, y: 0 },
			{ ...rects[1], col: 0, row: 1, x: 0, y: 216 },
			{ ...rects[2], col: 0, row: 2, x: 0, y: 432 },
		];
		expect(resolvePanelRect({ panels, rects: restacked, panelKey: 'IE' })).toMatchObject({
			x: 0,
			y: 216,
			row: 1,
		});
	});
});
