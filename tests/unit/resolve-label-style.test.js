import { resolveLabelStyle } from '../../../prc-scripts/includes/scripts/src/@prc/charting-utilities/utilities/resolveLabelStyle';
import { resolveLinePathPaint } from '../../../prc-scripts/includes/scripts/src/@prc/charting-utilities/utilities/resolvePaint';

describe('resolveLabelStyle', () => {
	it('prefers the series font weight over the chart default', () => {
		expect(
			resolveLabelStyle({
				defaults: { fontWeight: 200 },
				series: { fontWeight: 700 },
			}).fontWeight
		).toBe(700);
	});

	it('prefers the mark font weight over the series', () => {
		expect(
			resolveLabelStyle({
				defaults: { fontWeight: 200 },
				series: { fontWeight: 700 },
				custom: { fontWeight: 400 },
			}).fontWeight
		).toBe(400);
	});
});

describe('resolveLinePathPaint', () => {
	it('ignores the series label bag', () => {
		expect(
			resolveLinePathPaint({ strokeWidth: 2 }, '#456A83', {
				label: { fontWeight: 700 },
			})
		).not.toHaveProperty('label');
	});

	it('ignores series labelsVisible', () => {
		expect(
			resolveLinePathPaint({ strokeWidth: 2 }, '#456A83', {
				labelsVisible: false,
			})
		).not.toHaveProperty('labelsVisible');
	});
});
