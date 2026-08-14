/**
 * Values too small to print honestly at the configured precision.
 *
 * The religious-projections percentage charts use one decimal place, so a
 * Buddhist share of 0.04% rounds to "0.0%" — which reads as "none" and is
 * false. The floor makes it read "<0.1%" instead.
 */
import { formatMinDisplayValue } from '../../../prc-scripts/includes/scripts/src/@prc/charting-utilities/utilities/formatMinDisplayValue';

const PERCENT = {
	minDisplayValue: 0.1,
	toFixedDecimal: 1,
	truncateDecimal: true,
	toLocaleString: true,
	abbreviateValue: false,
};

describe('formatMinDisplayValue', () => {
	it('reports a value below the floor as less than the floor', () => {
		expect(formatMinDisplayValue(0.04, PERCENT)).toBe('<0.1');
	});

	it('leaves a value at or above the floor alone', () => {
		expect(formatMinDisplayValue(0.1, PERCENT)).toBeNull();
		expect(formatMinDisplayValue(2.7, PERCENT)).toBeNull();
	});

	// The floor is whatever the editor typed. The chart's own precision must not
	// round it away, or a floor of 0.1 reads "<0" and means nothing.
	it('shows the floor as typed on a chart that rounds to whole numbers', () => {
		expect(formatMinDisplayValue(0.04, { ...PERCENT, toFixedDecimal: 0 })).toBe('<0.1');
	});

	const COUNT = {
		minDisplayValue: 10000,
		toFixedDecimal: 1,
		truncateDecimal: true,
		toLocaleString: true,
		abbreviateValue: true,
	};

	it('abbreviates the floor when the chart abbreviates values', () => {
		expect(formatMinDisplayValue(4200, COUNT)).toBe('<10K');
	});

	it('floors a count just under the editorial floor', () => {
		expect(formatMinDisplayValue(9900, COUNT)).toBe('<10K');
	});

	it('leaves counts at or above the floor alone', () => {
		expect(formatMinDisplayValue(12300, COUNT)).toBeNull();
	});

	it('formats normally when no floor is configured', () => {
		expect(formatMinDisplayValue(0.04, { ...PERCENT, minDisplayValue: null })).toBeNull();
		expect(formatMinDisplayValue(0.04, { toFixedDecimal: 1 })).toBeNull();
	});

	it('never applies the floor to negative values', () => {
		expect(formatMinDisplayValue(-0.04, PERCENT)).toBeNull();
		expect(formatMinDisplayValue(-5, PERCENT)).toBeNull();
	});

	// The projections data has no true zeros, only rounded-to-zero smalls,
	// which is the case this exists for.
	it('treats zero as below the floor', () => {
		expect(formatMinDisplayValue(0, PERCENT)).toBe('<0.1');
	});
});
