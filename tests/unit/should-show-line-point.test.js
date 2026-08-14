import { shouldShowLinePoint } from '../../../prc-scripts/includes/scripts/src/@prc/charting-utilities/utilities/shouldShowLinePoint';

describe('shouldShowLinePoint', () => {
	const allPoints = [0, 1, 2, 3];

	it('shows every point when nodes are on and first/last-only is off', () => {
		expect(
			allPoints.map((index) =>
				shouldShowLinePoint({
					showPoints: true,
					showFirstLastPointsOnly: false,
					index,
					pointCount: 4,
				})
			)
		).toEqual([true, true, true, true]);
	});

	it('shows only the first and last plotted points when first/last-only is on', () => {
		expect(
			allPoints.map((index) =>
				shouldShowLinePoint({
					showPoints: true,
					showFirstLastPointsOnly: true,
					index,
					pointCount: 4,
				})
			)
		).toEqual([true, false, false, true]);
	});

	it('shows nothing when nodes are off, even if first/last-only is on', () => {
		expect(
			shouldShowLinePoint({
				showPoints: false,
				showFirstLastPointsOnly: true,
				index: 0,
				pointCount: 4,
			})
		).toBe(false);
	});

	it('shows the single node of a one-point series', () => {
		expect(
			shouldShowLinePoint({
				showPoints: true,
				showFirstLastPointsOnly: true,
				index: 0,
				pointCount: 1,
			})
		).toBe(true);
	});

	it('treats pointCount as the filtered series length, not the raw table row count', () => {
		expect(
			shouldShowLinePoint({
				showPoints: true,
				showFirstLastPointsOnly: true,
				index: 2,
				pointCount: 3,
			})
		).toBe(true);
	});
});
