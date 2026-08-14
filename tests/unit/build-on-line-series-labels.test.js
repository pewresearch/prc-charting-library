/**
 * Direct-legend anchor placement.
 *
 * Every series name used to anchor at the exact midpoint of the plot, so two
 * lines that merely cross near the middle looked crowded even when they were
 * far apart everywhere else (Singapore: Hindus vs Other religions).
 */
import { buildOnLineSeriesLabels } from '../../../prc-scripts/includes/scripts/src/@prc/charting-utilities/labelLayout/buildOnLineSeriesLabels';
import { computeLabelDeclutter } from '../../../prc-scripts/includes/scripts/src/@prc/charting-utilities/labelLayout/computeLabelDeclutter';

const INNER_WIDTH = 700;
const INNER_HEIGHT = 500;

const legend = {
	fontSize: 12,
	fontWeight: 400,
	customLabels: {},
};

// Singapore counts: Muslims climb through the Christians line near mid-chart,
// then pull well clear of it by 2070.
const ROWS = [
	{ x: '2020', Christians: 480, Muslims: 180 },
	{ x: '2030', Christians: 520, Muslims: 330 },
	{ x: '2040', Christians: 545, Muslims: 500 },
	{ x: '2050', Christians: 555, Muslims: 600 },
	{ x: '2060', Christians: 550, Muslims: 660 },
	{ x: '2070', Christians: 545, Muslims: 700 },
];

// The omission pass treats anchors closer than this as one cluster.
const OMIT_WITHIN = 20;

const YEARS = ROWS.map((row) => Number(row.x));
const MIN_YEAR = Math.min(...YEARS);
const MAX_YEAR = Math.max(...YEARS);

function independentScale(value) {
	return ((Number(value) - MIN_YEAR) / (MAX_YEAR - MIN_YEAR)) * INNER_WIDTH;
}

function dependentScale(value) {
	return INNER_HEIGHT * (1 - Number(value) / 700);
}

function build(crowdRadius = OMIT_WITHIN) {
	return buildOnLineSeriesLabels({
		categories: ['Christians', 'Muslims'],
		flattenedData: ROWS,
		legend,
		innerWidth: INNER_WIDTH,
		independentScale,
		dependentScale,
		getIndependentValue: (row) => row.x,
		padding: { left: 0, top: 0 },
		crowdRadius,
	});
}

describe('buildOnLineSeriesLabels', () => {
	beforeAll(() => {
		// jsdom has no canvas, so let measureTextWidth take its estimate path.
		HTMLCanvasElement.prototype.getContext = () => null;
	});

	it('anchors crossing series where they have vertical clearance', () => {
		const inputs = build();
		const [christians, muslims] = inputs;

		// The two lines cross at the exact midpoint, where every direct label
		// used to anchor.
		expect(Math.abs(christians.y - muslims.y)).toBeGreaterThanOrEqual(OMIT_WITHIN);
	});

	it('keeps anchors inside the plot', () => {
		for (const input of build()) {
			expect(input.x).toBeGreaterThanOrEqual(0);
			expect(input.x).toBeLessThanOrEqual(INNER_WIDTH);
		}
	});

	// Spreading rides along with crowd handling, so charts that have not opted
	// in keep the centred column of names editors have hand-tuned around.
	it('keeps every name centred when spreading is off', () => {
		for (const input of build(0)) {
			expect(input.x).toBe(INNER_WIDTH / 2);
		}
	});
});

// Germany percentages: four minority series sit inside two points of the
// baseline, but the plot is wide and mostly empty.
const GERMANY_ROWS = [
	{
		x: '2020',
		Buddhists: 0.4,
		Christians: 56.2,
		Hindus: 1,
		Jews: 0.1,
		Muslims: 6.5,
		'Other religions': 0.6,
		'Religiously unaffiliated': 36.1,
	},
	{
		x: '2070',
		Buddhists: 0.5,
		Christians: 41.9,
		Hindus: 1.4,
		Jews: 0.1,
		Muslims: 14.3,
		'Other religions': 0.9,
		'Religiously unaffiliated': 40.2,
	},
];

const GERMANY_CATEGORIES = Object.keys(GERMANY_ROWS[0]).filter((key) => key !== 'x');

describe('crowded baseline series', () => {
	beforeAll(() => {
		HTMLCanvasElement.prototype.getContext = () => null;
	});

	function buildGermany() {
		return buildOnLineSeriesLabels({
			categories: GERMANY_CATEGORIES,
			flattenedData: GERMANY_ROWS,
			legend,
			innerWidth: INNER_WIDTH,
			independentScale,
			dependentScale: (value) => INNER_HEIGHT * (1 - Number(value) / 100),
			getIndependentValue: (row) => row.x,
			padding: { left: 0, top: 0 },
			crowdRadius: OMIT_WITHIN,
		});
	}

	it('leaves well-separated series centred', () => {
		const centred = buildGermany()
			.filter((input) => input.x === INNER_WIDTH / 2)
			.map((input) => input.category);

		expect(centred).toEqual(expect.arrayContaining(['Christians', 'Muslims', 'Religiously unaffiliated']));
	});

	// Sliding a name only helps if its line is legible somewhere. These four
	// stay within a point of each other for the whole span, so spreading just
	// scatters unreadable names across the plot floor — drop them instead.
	it('omits series that never separate from their neighbours', () => {
		const inputs = buildGermany();

		const offsets = computeLabelDeclutter(inputs, {
			padding: 4,
			lockX: true,
			innerWidth: INNER_WIDTH,
			innerHeight: INNER_HEIGHT,
			omitWithin: OMIT_WITHIN,
			omitEdgeWithin: 8,
		});

		const hidden = inputs.filter((input) => offsets.get(input.id)?.hidden).map((input) => input.category);

		expect(hidden).toEqual(['Buddhists', 'Hindus', 'Jews', 'Other religions']);
	});
});

// Japan percentages. Buddhists runs ~17px under Religiously unaffiliated at
// mid-chart and Christians ~17px over Muslims — comfortable room for a 12px
// name, but both used to be exiled to the right edge by a 20px requirement.
const JAPAN_ROWS = [
	{
		x: '2020',
		Buddhists: 19.2,
		Christians: 5.5,
		Muslims: 0.9,
		'Other religions': 51.7,
		'Religiously unaffiliated': 23.1,
	},
	{
		x: '2070',
		Buddhists: 21.4,
		Christians: 8.8,
		Muslims: 1.7,
		'Other religions': 38.7,
		'Religiously unaffiliated': 29.1,
	},
];

const JAPAN_HEIGHT = 290;

describe('crowd radius', () => {
	beforeAll(() => {
		HTMLCanvasElement.prototype.getContext = () => null;
	});

	function buildJapan(crowdRadius) {
		return buildOnLineSeriesLabels({
			categories: Object.keys(JAPAN_ROWS[0]).filter((key) => key !== 'x'),
			flattenedData: JAPAN_ROWS,
			legend,
			innerWidth: INNER_WIDTH,
			independentScale,
			dependentScale: (value) => JAPAN_HEIGHT * (1 - Number(value) / 100),
			getIndependentValue: (row) => row.x,
			padding: { left: 0, top: 0 },
			crowdRadius,
		});
	}

	function anchorFor(inputs, category) {
		return inputs.find((input) => input.category === category).x;
	}

	it('exiles a name whose gap falls short of the radius', () => {
		const inputs = buildJapan(20);

		expect(anchorFor(inputs, 'Buddhists')).not.toBe(INNER_WIDTH / 2);
		expect(anchorFor(inputs, 'Christians')).not.toBe(INNER_WIDTH / 2);
	});

	it('lets a name hold the midpoint once its gap clears the radius', () => {
		const inputs = buildJapan(16);

		expect(anchorFor(inputs, 'Buddhists')).toBe(INNER_WIDTH / 2);
		expect(anchorFor(inputs, 'Christians')).toBe(INNER_WIDTH / 2);
	});

	// The radius drives placement and omission together: a name allowed to hold
	// the midpoint must also survive the crowd sweep, or it just vanishes.
	it('keeps the names it allowed to stay centred', () => {
		const inputs = buildJapan(16);
		const offsets = computeLabelDeclutter(inputs, {
			padding: 4,
			lockX: true,
			innerWidth: INNER_WIDTH,
			innerHeight: JAPAN_HEIGHT,
			omitWithin: 16,
			omitEdgeWithin: 8,
		});

		for (const category of ['Buddhists', 'Christians']) {
			const input = inputs.find((entry) => entry.category === category);
			expect(offsets.get(input.id)?.hidden).toBeFalsy();
		}
	});
});
