import { computeSharedDomain } from '../../../prc-scripts/includes/scripts/src/@prc/charting-utilities/smallMultiples/computeSharedDomain';

describe('computeSharedDomain', () => {
	const panels = [
		{
			key: 'Chrome',
			rows: [
				{ x: '2009', y: 5 },
				{ x: '2023', y: 65 },
			],
		},
		{
			key: 'IE',
			rows: [
				{ x: '2009', y: 55 },
				{ x: '2023', y: 0 },
			],
		},
		{
			key: 'Edge',
			rows: [
				{ x: '2009', y: 0 },
				{ x: '2023', y: 5 },
			],
		},
	];

	it('returns the min/max y across all panels', () => {
		expect(computeSharedDomain(panels)).toEqual([0, 65]);
	});

	it('forces zero into the domain when showZero is true', () => {
		const positiveOnly = [
			{
				key: 'A',
				rows: [
					{ x: '1', y: 10 },
					{ x: '2', y: 20 },
				],
			},
		];
		expect(computeSharedDomain(positiveOnly, { showZero: true })).toEqual([0, 20]);
	});

	it('returns [0, 1] for empty panels', () => {
		expect(computeSharedDomain([])).toEqual([0, 1]);
		expect(computeSharedDomain(null)).toEqual([0, 1]);
	});

	it('ignores non-finite y values', () => {
		const messy = [
			{
				key: 'A',
				rows: [
					{ x: '1', y: NaN },
					{ x: '2', y: 12 },
					{ x: '3', y: undefined },
				],
			},
		];
		expect(computeSharedDomain(messy)).toEqual([12, 12]);
	});

	it('does not treat a missing y as 0', () => {
		const withBlanks = [
			{
				key: 'A',
				rows: [
					{ x: '1', y: 12 },
					{ x: '2', y: null },
					{ x: '3', y: '' },
				],
			},
		];
		expect(computeSharedDomain(withBlanks)).toEqual([12, 12]);
	});
});
