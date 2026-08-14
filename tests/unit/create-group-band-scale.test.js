import { scaleBand } from '@visx/scale';
import { createGroupBandScale } from '../../../prc-scripts/includes/scripts/src/@prc/charting-utilities/compute/data';

const PADDING = 0.2;
const PLOT_SIZE = 400;

const singletonDomain = ['s0'];
const largeDomain = Array.from({ length: 16 }, (_, i) => `g${i}`);
const parentDomain = [...singletonDomain, ...largeDomain];

const parent = scaleBand({
	domain: parentDomain,
	range: [0, PLOT_SIZE],
	padding: PADDING,
});

const singletonRange = [0, 1 * parent.step()];
const largeRange = [0, 16 * parent.step()];

describe('createGroupBandScale', () => {
	it('documents the visx padding shorthand bug: 1-item vs 16-item bandwidth ratio is ~0.844', () => {
		const singleton = scaleBand({
			domain: singletonDomain,
			range: singletonRange,
			padding: PADDING,
		});
		const large = scaleBand({
			domain: largeDomain,
			range: largeRange,
			padding: PADDING,
		});

		expect(singleton.bandwidth() / large.bandwidth()).toBeCloseTo(0.844, 3);
	});

	it('gives a singleton group the same bandwidth as a 16-item group', () => {
		const singleton = createGroupBandScale(singletonDomain, singletonRange, PADDING);
		const large = createGroupBandScale(largeDomain, largeRange, PADDING);

		expect(singleton.bandwidth()).toBeCloseTo(large.bandwidth());
	});

	it('matches parent.step() * (1 - padding) for horizontal slot allocation', () => {
		const expected = parent.step() * (1 - PADDING);
		const singleton = createGroupBandScale(singletonDomain, singletonRange, PADDING);
		const large = createGroupBandScale(largeDomain, largeRange, PADDING);

		expect(singleton.bandwidth()).toBeCloseTo(expected);
		expect(large.bandwidth()).toBeCloseTo(expected);
	});

	it('keeps equal bandwidth on reversed ranges', () => {
		const reversedParent = scaleBand({
			domain: parentDomain,
			range: [PLOT_SIZE, 0],
			padding: PADDING,
		});
		const step = reversedParent.step();
		const singleton = createGroupBandScale(singletonDomain, [1 * step, 0], PADDING);
		const large = createGroupBandScale(largeDomain, [16 * step, 0], PADDING);

		expect(singleton.bandwidth()).toBeCloseTo(large.bandwidth());
	});
});
