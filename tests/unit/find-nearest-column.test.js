/**
 * Pointer x to column. Nearest wins, with no distance limit inside the plot,
 * so the tooltip is live anywhere in the column including empty space above
 * every line.
 */
import { findNearestColumn } from '../../../prc-scripts/includes/scripts/src/@prc/charting-utilities/unifiedTooltip/findNearestColumn';

const COLUMNS = [
	{ px: 0, xValue: 2020, entries: [], ruleTop: 0, ruleBottom: 0 },
	{ px: 50, xValue: 2030, entries: [], ruleTop: 0, ruleBottom: 0 },
	{ px: 100, xValue: 2040, entries: [], ruleTop: 0, ruleBottom: 0 },
];

describe('findNearestColumn', () => {
	it('snaps to the closest column', () => {
		expect(findNearestColumn(COLUMNS, 44).xValue).toBe(2030);
		expect(findNearestColumn(COLUMNS, 12).xValue).toBe(2020);
	});

	it('snaps from far outside the data, since the plot is the only bound', () => {
		expect(findNearestColumn(COLUMNS, 9000).xValue).toBe(2040);
		expect(findNearestColumn(COLUMNS, -9000).xValue).toBe(2020);
	});

	it('returns null when there is nothing to snap to', () => {
		expect(findNearestColumn([], 44)).toBeNull();
	});

	// Either answer is defensible when the pointer sits exactly between two
	// years; flickering between them on sub-pixel movement is not.
	it('keeps the earlier column on an exact tie', () => {
		expect(findNearestColumn(COLUMNS, 25).xValue).toBe(2020);
	});
});
