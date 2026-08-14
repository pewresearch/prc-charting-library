/**
 * Label values against a display floor.
 */
import { getLabelFormat } from '../../../prc-scripts/includes/scripts/src/@prc/charting-utilities/compute/labels';

const PERCENT_LABEL = {
	absoluteValue: false,
	truncateDecimal: true,
	toFixedDecimal: 1,
	toLocaleString: true,
	abbreviateValue: false,
	labelUnit: '%',
	labelUnitPosition: 'end',
	minDisplayValue: 0.1,
};

describe('getLabelFormat with a display floor', () => {
	it('keeps the unit on a floored value', () => {
		expect(getLabelFormat(0.04, 'Buddhists', PERCENT_LABEL, null)).toBe('<0.1%');
	});
});
