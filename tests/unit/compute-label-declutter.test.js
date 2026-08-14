/**
 * Auto-declutter behaviour for crowded direct-legend labels.
 *
 * The Israel religious-composition chart packs five of seven series into the
 * bottom ~13px of the plot, which is the worst case for the label layout.
 */
import { computeLabelDeclutter } from '../../../prc-scripts/includes/scripts/src/@prc/charting-utilities/labelLayout/computeLabelDeclutter';

const FONT_SIZE = 12;
const INNER_HEIGHT = 290;
const INNER_WIDTH = 350;
const PADDING = 4;

// Mid-chart (≈2045) percentages for Israel against a 0–90 dependent domain.
const ISRAEL_MIDPOINT_PERCENTS = {
	Jews: 76.5,
	Muslims: 16,
	'Religiously unaffiliated': 4.05,
	Christians: 1.7,
	'Other religions': 1.55,
	Hindus: 0.2,
	Buddhists: 0.058,
};

function dependentScale(value) {
	return INNER_HEIGHT * (1 - value / 90);
}

function buildDirectLegendInputs() {
	return Object.entries(ISRAEL_MIDPOINT_PERCENTS).map(([category, percent], index) => ({
		id: `direct-series::${index}::${category}`,
		x: INNER_WIDTH / 2,
		y: dependentScale(percent),
		text: category,
		fontSize: FONT_SIZE,
		textAnchor: 'middle',
		dominantBaseline: 'middle',
		// Series names, not values, so crowding may drop them.
		omittable: true,
	}));
}

function toRects(inputs, offsets) {
	return inputs.map((input) => {
		const offset = offsets.get(input.id) ?? { dx: 0, dy: 0 };
		// jsdom has no canvas text metrics, so measureLabelBBox falls back to
		// the same character-width estimate used here.
		const width = input.text.length * FONT_SIZE * 0.55;
		const height = FONT_SIZE;
		const x = input.x + offset.dx - width / 2;
		const y = input.y + offset.dy - height / 2;
		return { id: input.id, x1: x, y1: y, x2: x + width, y2: y + height };
	});
}

function findOverlaps(rects) {
	const overlaps = [];
	for (let i = 0; i < rects.length; i++) {
		for (let j = i + 1; j < rects.length; j++) {
			const a = rects[i];
			const b = rects[j];
			const overlapX = Math.min(a.x2, b.x2) - Math.max(a.x1, b.x1);
			const overlapY = Math.min(a.y2, b.y2) - Math.max(a.y1, b.y1);
			if (overlapX > 0 && overlapY > 0) {
				overlaps.push({ a: a.id, b: b.id, overlapY });
			}
		}
	}
	return overlaps;
}

describe('computeLabelDeclutter', () => {
	beforeAll(() => {
		// jsdom throws on getContext; returning null routes measureLabelBBox to
		// its character-width fallback, which `toRects` mirrors.
		HTMLCanvasElement.prototype.getContext = () => null;
	});

	it('separates direct-legend labels crowded at the bottom of the plot', () => {
		const inputs = buildDirectLegendInputs();
		const offsets = computeLabelDeclutter(inputs, {
			padding: PADDING,
			lockX: true,
			iterations: 160,
			anchorStrengthY: 0.5,
			innerWidth: INNER_WIDTH,
			innerHeight: INNER_HEIGHT,
		});

		expect(findOverlaps(toRects(inputs, offsets))).toEqual([]);
	});

	it('does not lift a floor-anchored label above its line', () => {
		const inputs = buildDirectLegendInputs();
		const buddhists = inputs.find((input) => input.id.includes('Buddhists'));
		const offsets = computeLabelDeclutter(inputs, {
			padding: PADDING,
			lockX: true,
			iterations: 160,
			anchorStrengthY: 0.5,
			innerWidth: INNER_WIDTH,
			innerHeight: INNER_HEIGHT,
		});

		// Boundary carve-out: a label whose natural anchor is already past the
		// floor may hang below the plot, but must not be pulled inward.
		expect(offsets.get(buddhists.id).dy).toBeGreaterThanOrEqual(0);
	});

	it('omits labels whose anchors sit too close together', () => {
		const inputs = buildDirectLegendInputs();
		const offsets = computeLabelDeclutter(inputs, {
			padding: PADDING,
			lockX: true,
			iterations: 160,
			anchorStrengthY: 0.5,
			innerWidth: INNER_WIDTH,
			innerHeight: INNER_HEIGHT,
			omitWithin: FONT_SIZE + PADDING * 2,
		});

		const visible = inputs.filter((input) => !offsets.get(input.id)?.hidden);
		const hidden = inputs.filter((input) => offsets.get(input.id)?.hidden);

		expect(visible.map((input) => input.id.split('::')[2])).toEqual([
			'Jews',
			'Muslims',
			'Religiously unaffiliated',
		]);
		expect(hidden.length).toBeGreaterThan(0);
		expect(findOverlaps(toRects(visible, offsets))).toEqual([]);
		for (const input of visible) {
			expect(Math.abs(offsets.get(input.id).dy)).toBeLessThan(FONT_SIZE);
		}
	});

	it('omits the survivor when a crowded cluster hugs the plot edge', () => {
		const inputs = [
			{
				id: 'Buddhists',
				x: INNER_WIDTH / 2,
				y: INNER_HEIGHT - 3,
				text: 'Buddhists',
				fontSize: FONT_SIZE,
				omittable: true,
			},
			{
				id: 'Hindus',
				x: INNER_WIDTH / 2,
				y: INNER_HEIGHT - 2,
				text: 'Hindus',
				fontSize: FONT_SIZE,
				omittable: true,
			},
			{
				id: 'Other religions',
				x: INNER_WIDTH / 2,
				y: INNER_HEIGHT - 1,
				text: 'Other religions',
				fontSize: FONT_SIZE,
				omittable: true,
			},
		];

		const offsets = computeLabelDeclutter(inputs, {
			padding: PADDING,
			lockX: true,
			innerWidth: INNER_WIDTH,
			innerHeight: INNER_HEIGHT,
			omitWithin: 20,
			omitEdgeWithin: 8,
		});

		expect(inputs.every((input) => offsets.get(input.id)?.hidden)).toBe(true);
	});

	it('keeps the crowded stack in series order and leaves clear labels put', () => {
		const inputs = buildDirectLegendInputs();
		const offsets = computeLabelDeclutter(inputs, {
			padding: PADDING,
			lockX: true,
			iterations: 160,
			anchorStrengthY: 0.5,
			innerWidth: INNER_WIDTH,
			innerHeight: INNER_HEIGHT,
		});

		const rects = toRects(inputs, offsets);
		const orderedTopDown = [...rects].sort((a, b) => a.y1 - b.y1).map((rect) => rect.id.split('::')[2]);

		expect(orderedTopDown).toEqual([
			'Jews',
			'Muslims',
			'Religiously unaffiliated',
			'Christians',
			'Other religions',
			'Hindus',
			'Buddhists',
		]);
		expect(offsets.get('direct-series::0::Jews')).toEqual({ dx: 0, dy: 0 });
	});

	it('leaves labels alone when they only share a row', () => {
		const inputs = [
			{
				id: 'left',
				x: 40,
				y: 150,
				text: '2020',
				fontSize: FONT_SIZE,
				textAnchor: 'middle',
				dominantBaseline: 'middle',
			},
			{
				id: 'right',
				x: 300,
				y: 150,
				text: '2070',
				fontSize: FONT_SIZE,
				textAnchor: 'middle',
				dominantBaseline: 'middle',
			},
		];

		const offsets = computeLabelDeclutter(inputs, {
			padding: PADDING,
			innerWidth: INNER_WIDTH,
			innerHeight: INNER_HEIGHT,
		});

		expect(offsets.get('left')).toEqual({ dx: 0, dy: 0 });
		expect(offsets.get('right')).toEqual({ dx: 0, dy: 0 });
	});

	it('routes a label around an author-placed one without moving it', () => {
		const inputs = [
			{
				id: 'author',
				x: 175,
				y: 150,
				text: 'Muslims',
				fontSize: FONT_SIZE,
				textAnchor: 'middle',
				dominantBaseline: 'middle',
				locked: true,
			},
			{
				id: 'auto',
				x: 175,
				y: 152,
				text: 'Christians',
				fontSize: FONT_SIZE,
				textAnchor: 'middle',
				dominantBaseline: 'middle',
			},
		];

		const offsets = computeLabelDeclutter(inputs, {
			padding: PADDING,
			lockX: true,
			innerWidth: INNER_WIDTH,
			innerHeight: INNER_HEIGHT,
		});

		expect(offsets.get('author')).toEqual({ dx: 0, dy: 0 });
		expect(findOverlaps(toRects(inputs, offsets))).toEqual([]);
	});
});
