import { resolveSliceDomain } from '../../../prc-scripts/includes/scripts/src/@prc/charting-utilities/smallMultiples/resolveSliceDomain';

describe('resolveSliceDomain', () => {
	it('collects unique slice categories (x) across all panel series', () => {
		const domain = resolveSliceDomain([
			{
				key: 'Q1',
				series: [
					{
						key: 'Q1',
						rows: [
							{ x: 'Approve', y: 40 },
							{ x: 'Disapprove', y: 60 },
						],
					},
				],
			},
			{
				key: 'Q2',
				series: [
					{
						key: 'Q2',
						rows: [
							{ x: 'Disapprove', y: 55 },
							{ x: 'Unsure', y: 10 },
							{ x: 'Approve', y: 35 },
						],
					},
				],
			},
		]);
		expect(domain).toEqual(['Approve', 'Disapprove', 'Unsure']);
	});

	it('returns empty for empty panels', () => {
		expect(resolveSliceDomain([])).toEqual([]);
		expect(resolveSliceDomain(null)).toEqual([]);
	});

	it('prefers an explicit legend category order when provided', () => {
		const domain = resolveSliceDomain(
			[
				{
					key: 'Q1',
					series: [
						{
							key: 'Q1',
							rows: [
								{ x: 'Approve', y: 40 },
								{ x: 'Disapprove', y: 60 },
							],
						},
					],
				},
			],
			['Disapprove', 'Approve', 'Missing']
		);
		// Explicit order for known keys; unknowns from data keep first-seen after.
		expect(domain).toEqual(['Disapprove', 'Approve']);
	});
});
