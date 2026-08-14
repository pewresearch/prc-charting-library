/**
 * Bar labels anchor to the value tip, not the baseline. Tip edge comes from
 * linearBarSpan geometry (`valueAtStart`), not value sign alone.
 */
import { positionBarLabel } from '../../../prc-scripts/includes/scripts/src/@prc/charting-utilities/compute/labels';

const OUTSIDE = {
	labelPositionDX: 0,
	labelPositionDY: 0,
	labelPositionBar: 'outside',
};

const INSIDE = {
	...OUTSIDE,
	labelPositionBar: 'inside',
};

const CENTER = {
	...OUTSIDE,
	labelPositionBar: 'center',
};

const POSITIVE = { x: 10, y: 40, width: 20, height: 80, value: 50, valueAtStart: true };
// Negative bar growing down from zero (domain crosses zero).
const NEGATIVE_FROM_ZERO = {
	x: 10,
	y: 100,
	width: 20,
	height: 60,
	value: -20,
	valueAtStart: false,
};
// Negative bar in an all-below-zero domain: tip at y, baseline at y + height.
const NEGATIVE_FROM_FLOOR = {
	x: 10,
	y: 40,
	width: 20,
	height: 80,
	value: -50,
	valueAtStart: true,
};

describe('positionBarLabel vertical', () => {
	it('places an outside label above a positive bar tip', () => {
		expect(positionBarLabel(POSITIVE, OUTSIDE, 0, 'vertical', 'single')).toEqual({
			x: 20,
			y: 35,
		});
	});

	it('places an outside label below a negative bar tip when it grows from zero', () => {
		expect(positionBarLabel(NEGATIVE_FROM_ZERO, OUTSIDE, 0, 'vertical', 'single')).toEqual({
			x: 20,
			y: 165,
		});
	});

	it('places an outside label above a negative bar tip when it grows from the axis min', () => {
		expect(positionBarLabel(NEGATIVE_FROM_FLOOR, OUTSIDE, 0, 'vertical', 'single')).toEqual({
			x: 20,
			y: 35,
		});
	});

	it('places an inside label below a positive bar tip', () => {
		expect(positionBarLabel(POSITIVE, INSIDE, 0, 'vertical', 'single')).toEqual({
			x: 20,
			y: 60,
		});
	});

	it('places an inside label above a negative bar tip when it grows from zero', () => {
		expect(positionBarLabel(NEGATIVE_FROM_ZERO, INSIDE, 0, 'vertical', 'single')).toEqual({
			x: 20,
			y: 140,
		});
	});

	it('places an inside label below a negative bar tip when it grows from the axis min', () => {
		expect(positionBarLabel(NEGATIVE_FROM_FLOOR, INSIDE, 0, 'vertical', 'single')).toEqual({
			x: 20,
			y: 60,
		});
	});

	it('keeps a center label at mid-height', () => {
		expect(positionBarLabel(NEGATIVE_FROM_ZERO, CENTER, 0, 'vertical', 'single')).toEqual({
			x: 20,
			y: 130,
		});
	});
});

describe('positionBarLabel horizontal', () => {
	it('places an outside label past the right tip for a positive bar', () => {
		expect(
			positionBarLabel(
				{ x: 20, y: 5, width: 80, height: 16, value: 50, valueAtStart: false },
				OUTSIDE,
				0,
				'horizontal',
				'single'
			)
		).toEqual({
			x: 105,
			y: 13,
		});
	});

	it('places an outside label past the left tip for a negative bar growing from zero', () => {
		expect(
			positionBarLabel(
				{ x: 20, y: 5, width: 60, height: 16, value: -20, valueAtStart: true },
				OUTSIDE,
				0,
				'horizontal',
				'single'
			)
		).toEqual({
			x: 15,
			y: 13,
		});
	});

	it('places an outside label past the right tip for a negative bar growing from the axis min', () => {
		expect(
			positionBarLabel(
				{ x: 0, y: 5, width: 80, height: 16, value: -50, valueAtStart: false },
				OUTSIDE,
				0,
				'horizontal',
				'single'
			)
		).toEqual({
			x: 85,
			y: 13,
		});
	});
});
