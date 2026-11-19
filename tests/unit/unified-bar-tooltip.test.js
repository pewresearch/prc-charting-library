import { baseConfig } from '../../../prc-shared/includes/scripts/src/@prc/charting-utilities';
import { divergingRowTooltipGroups, isDivergingNegativeSide } from '../../src/lib/overlays/UnifiedBarTooltip';

const divergingBar = {
	...baseConfig.divergingBar,
	negativeCategories: ['Disagree'],
	positiveCategories: ['Agree'],
	secondary: {
		active: true,
		negativeCategories: ['DisagreeGhost'],
		positiveCategories: ['AgreeGhost'],
		fill: 'none',
		stroke: '#000000',
		strokeWidth: 0.5,
		opacity: 0.4,
	},
};

describe('unified bar tooltip', () => {
	test('row tooltip groups follow the side, and unified lists both', () => {
		expect(isDivergingNegativeSide('left')).toBe(true);
		expect(isDivergingNegativeSide('bottom')).toBe(true);
		expect(isDivergingNegativeSide('top')).toBe(false);

		expect(divergingRowTooltipGroups(divergingBar, true, 'bottom', false)).toEqual([['Disagree', 'DisagreeGhost']]);
		expect(divergingRowTooltipGroups(divergingBar, true, 'top', false)).toEqual([['Agree', 'AgreeGhost']]);
		expect(divergingRowTooltipGroups(divergingBar, true, 'left', true)).toEqual([
			['Disagree', 'DisagreeGhost'],
			['Agree', 'AgreeGhost'],
		]);
	});
});
