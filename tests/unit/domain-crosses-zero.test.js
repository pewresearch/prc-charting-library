import { domainCrossesZero } from '../../../prc-scripts/includes/scripts/src/@prc/charting-utilities/compute/domainCrossesZero';

describe('domainCrossesZero', () => {
	it('is true when the domain has values on both sides of zero', () => {
		expect(domainCrossesZero([-20, 100])).toBe(true);
		expect(domainCrossesZero([100, -20])).toBe(true);
	});

	it('is false when zero is an endpoint', () => {
		expect(domainCrossesZero([0, 100])).toBe(false);
		expect(domainCrossesZero([-100, 0])).toBe(false);
	});

	it('is false when the domain sits entirely above or below zero', () => {
		expect(domainCrossesZero([10, 100])).toBe(false);
		expect(domainCrossesZero([-100, -10])).toBe(false);
	});
});
