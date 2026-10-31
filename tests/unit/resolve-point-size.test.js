import { resolvePointSize } from '../../../prc-shared/includes/scripts/src/@prc/charting-utilities/utilities/resolvePointSize';
import { resolveLinePathPaint } from '../../../prc-shared/includes/scripts/src/@prc/charting-utilities/utilities/resolvePaint';
import {
	createPointRadiusScale,
	resolvePointRadius,
} from '../../../prc-shared/includes/scripts/src/@prc/charting-utilities/utilities/getPointRadiusScale';

describe('resolvePointSize', () => {
	it('prefers the series point size over the chart default', () => {
		expect(resolvePointSize({ pointSize: 4 }, { pointSize: 9 })).toBe(9);
	});
});

describe('resolveLinePathPaint', () => {
	it('ignores the series point size', () => {
		expect(resolveLinePathPaint({ strokeWidth: 2 }, '#456A83', { pointSize: 9 })).not.toHaveProperty('pointSize');
	});
});

describe('resolvePointRadius', () => {
	it('keeps a series point size off the size scale', () => {
		const radiusScale = createPointRadiusScale({
			maxValue: 100,
			minValue: 1,
			minRadius: 4,
			maxRadius: 24,
			scaleType: 'sqrt',
		});

		expect(
			resolvePointRadius({
				d: { Size: 100 },
				sizeCategory: 'Size',
				pointSize: resolvePointSize({ pointSize: 4 }, { pointSize: 9 }),
				radiusScale,
			})
		).toBe(24);
	});
});
