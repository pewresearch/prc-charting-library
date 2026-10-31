import { resolveDivergingSecondaryPaint } from '../../../prc-shared/includes/scripts/src/@prc/charting-utilities/utilities/resolveShapePaint';

describe('resolveDivergingSecondaryPaint', () => {
	test('keeps legacy category styles while seriesStyles takes priority per field', () => {
		expect(
			resolveDivergingSecondaryPaint(
				{
					fill: '#dddddd',
					stroke: '#222222',
					strokeWidth: 0.5,
					opacity: 0.4,
				},
				{
					fill: '#bbbbbb',
					stroke: '#555555',
					strokeWidth: 2,
				},
				{
					fill: '#456A83',
					opacity: 0.6,
				}
			)
		).toEqual({
			fill: '#456A83',
			stroke: '#555555',
			strokeWidth: 2,
			opacity: 0.6,
		});
	});
});
