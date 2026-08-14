import { generateSegmentKey, resolveSegmentPaint } from '../../../prc-scripts/includes/scripts/src/@prc/charting-utilities/smallMultiples/resolveSegmentPaint';

describe('generateSegmentKey', () => {
	it('joins start, end, and category with Date ISO strings', () => {
		expect(generateSegmentKey(new Date('2020-01-01T00:00:00.000Z'), '2021', 'Chrome')).toBe(
			'2020-01-01T00:00:00.000Z::2021::Chrome'
		);
	});
});

describe('resolveSegmentPaint', () => {
	it('uses series defaults when the segment has no custom style', () => {
		expect(
			resolveSegmentPaint(undefined, {
				stroke: '#456A83',
				strokeWidth: 2,
				opacity: 1,
				strokeDasharray: '2,2',
			})
		).toEqual({
			stroke: '#456A83',
			strokeWidth: 2,
			opacity: 1,
			strokeDasharray: '2,2',
		});
	});

	it('applies segmentStyles overrides', () => {
		expect(
			resolveSegmentPaint(
				{ stroke: '#f00', strokeWidth: 4, opacity: 0.25, strokeDasharray: '4,4' },
				{ stroke: '#456A83', strokeWidth: 2, opacity: 1 }
			)
		).toEqual({
			stroke: '#f00',
			strokeWidth: 4,
			opacity: 0.25,
			strokeDasharray: '4,4',
		});
	});
});
