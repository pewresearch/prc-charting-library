import { scaleLinear } from '@visx/scale';
import {
	linearBarSpan,
	linearBarBaseline,
} from '../../../prc-scripts/includes/scripts/src/@prc/charting-utilities/compute/linearBarSpan';

describe('linearBarSpan', () => {
	it('matches visx when the domain min is 0 (vertical)', () => {
		const scale = scaleLinear({
			domain: [0, 100],
			range: [200, 0],
		});
		const { start, size } = linearBarSpan(scale, 50);

		expect(start).toBe(Math.min(scale(0), scale(50)));
		expect(size).toBe(Math.abs(scale(50) - scale(0)));
		expect(start).toBe(scale(50));
		expect(size).toBe(200 - scale(50));
	});

	it('does not stretch a positive vertical bar to the plot bottom when min is below zero', () => {
		const scale = scaleLinear({
			domain: [-20, 100],
			range: [200, 0],
		});
		const { start, size } = linearBarSpan(scale, 50);

		expect(start).toBe(Math.min(scale(0), scale(50)));
		expect(size).toBe(Math.abs(scale(50) - scale(0)));
		expect(size).not.toBe(200 - scale(50));
	});

	it('grows a negative vertical bar from zero, not the plot bottom', () => {
		const scale = scaleLinear({
			domain: [-20, 100],
			range: [200, 0],
		});
		const { start, size } = linearBarSpan(scale, -10);

		expect(start).toBe(Math.min(scale(0), scale(-10)));
		expect(size).toBe(Math.abs(scale(-10) - scale(0)));
	});

	it('does not start a positive horizontal bar at x=0 when min is below zero', () => {
		const scale = scaleLinear({
			domain: [-20, 100],
			range: [0, 400],
		});
		const { start, size } = linearBarSpan(scale, 50);

		expect(start).toBe(Math.min(scale(0), scale(50)));
		expect(size).toBe(Math.abs(scale(50) - scale(0)));
		expect(start).not.toBe(0);
	});

	it('does not start a negative horizontal bar at x=0 when min is below zero', () => {
		const scale = scaleLinear({
			domain: [-20, 100],
			range: [0, 400],
		});
		const { start, size } = linearBarSpan(scale, -10);

		expect(start).toBe(Math.min(scale(0), scale(-10)));
		expect(size).toBe(Math.abs(scale(-10) - scale(0)));
		expect(start).not.toBe(0);
	});

	it('grows from the axis min when the domain is entirely above zero', () => {
		const scale = scaleLinear({
			domain: [10, 100],
			range: [200, 0],
		});
		const { start, size } = linearBarSpan(scale, 50);
		const floor = scale(10);

		expect(start).toBe(Math.min(floor, scale(50)));
		expect(size).toBe(Math.abs(scale(50) - floor));
		expect(start).toBeGreaterThanOrEqual(0);
		expect(start + size).toBeLessThanOrEqual(200);
		expect(size).not.toBe(Math.abs(scale(50) - scale(0)));
	});

	it('grows from the axis min when the domain is entirely below zero', () => {
		const scale = scaleLinear({
			domain: [-100, -10],
			range: [200, 0],
		});
		const { start, size, valueAtStart } = linearBarSpan(scale, -50);
		const floor = scale(-100);

		expect(start).toBe(Math.min(floor, scale(-50)));
		expect(size).toBe(Math.abs(scale(-50) - floor));
		expect(valueAtStart).toBe(true);
		expect(start).toBeGreaterThanOrEqual(0);
		expect(start + size).toBeLessThanOrEqual(200);
		expect(start).not.toBe(Math.min(scale(0), scale(-50)));
	});

	it('marks valueAtStart false when a negative bar grows down from zero', () => {
		const scale = scaleLinear({
			domain: [-20, 100],
			range: [200, 0],
		});
		const { valueAtStart } = linearBarSpan(scale, -10);

		expect(valueAtStart).toBe(false);
	});
});

describe('linearBarBaseline', () => {
	it('sits at zero when the domain includes zero', () => {
		const scale = scaleLinear({
			domain: [-20, 100],
			range: [200, 0],
		});

		expect(linearBarBaseline(scale)).toBe(scale(0));
		expect(linearBarBaseline(scale)).not.toBe(scale(-20));
	});

	it('sits at the axis min when zero is outside the domain', () => {
		const scale = scaleLinear({
			domain: [10, 100],
			range: [200, 0],
		});

		expect(linearBarBaseline(scale)).toBe(scale(10));
	});
});
