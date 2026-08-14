import { buildLineChartLabelInputs } from '../../../prc-scripts/includes/scripts/src/@prc/charting-utilities/labelLayout/buildLineChartLabels';
import { computeLabelDeclutter } from '../../../prc-scripts/includes/scripts/src/@prc/charting-utilities/labelLayout/computeLabelDeclutter';

const labels = {
	active: true,
	showFirstLastPointsOnly: true,
	firstLastLabelLayout: 'outside',
	fontSize: 12,
	fontFamily: 'Arial',
	fontWeight: 400,
	textAnchor: 'middle',
	labelPositionDX: 0,
	labelPositionDY: 0,
};

describe('buildLineChartLabelInputs', () => {
	beforeAll(() => {
		// jsdom has no canvas, so let measureLabelBBox take its estimate path.
		HTMLCanvasElement.prototype.getContext = () => null;
	});

	it('retains the category on each input so omissions do not renumber ids', () => {
		const rows = [
			{ x: '2020', Buddhists: 0.5, Christians: 56.2 },
			{ x: '2070', Buddhists: 0.4, Christians: 41.9 },
		];

		const inputs = buildLineChartLabelInputs({
			categories: ['Buddhists', 'Christians'],
			flattenedData: rows,
			labels,
			labelProps: {},
			independentScale: (value) => Number(value),
			dependentScale: (value) => Number(value),
			getIndependentValue: (row) => row.x,
		});
		const christianInputs = inputs.filter((input) => input.category === 'Christians');

		expect(christianInputs).toHaveLength(2);
		expect(christianInputs[0].id).toContain('line::1::Christians');
	});

	// Germany: Christians land on 41.9% and the unaffiliated on 40.2%, so the
	// two end-value labels sit ~4px apart. Crowding may never delete a number —
	// a reader cannot recover it from the colour key the way they can a name.
	it('separates converging end values instead of dropping one', () => {
		const innerWidth = 350;
		const innerHeight = 250;
		const rows = [
			{ x: '2020', Christians: 56.2, 'Religiously unaffiliated': 36.1 },
			{ x: '2070', Christians: 41.9, 'Religiously unaffiliated': 40.2 },
		];

		const inputs = buildLineChartLabelInputs({
			categories: ['Christians', 'Religiously unaffiliated'],
			flattenedData: rows,
			labels,
			labelProps: {},
			independentScale: (value) => ((Number(value) - 2020) / 50) * innerWidth,
			dependentScale: (value) => innerHeight * (1 - Number(value) / 100),
			getIndependentValue: (row) => row.x,
		});

		const offsets = computeLabelDeclutter(inputs, {
			padding: 4,
			lockX: false,
			iterations: 160,
			anchorStrengthX: 0.35,
			anchorStrengthY: 0.35,
			innerWidth,
			innerHeight,
			omitWithin: 20,
		});

		const endLabels = inputs.filter((input) => input.x >= innerWidth);
		expect(endLabels).toHaveLength(2);

		for (const label of endLabels) {
			expect(offsets.get(label.id)?.hidden).toBeFalsy();
		}

		const [a, b] = endLabels.map((label) => label.y + (offsets.get(label.id)?.dy ?? 0));
		expect(Math.abs(a - b)).toBeGreaterThanOrEqual(labels.fontSize);
	});

	// The projections composition tables omit a religion's key in years the
	// source reports nothing for it, rather than writing a zero. A gap year is
	// not a plotted point, so it can be neither the series' last point nor a
	// label anchored at a NaN coordinate.
	it('ignores years a series has no value for when picking its last point', () => {
		const rows = [
			{ x: '2020', Jews: 0.2, Christians: 56.2 },
			{ x: '2045', Jews: 0.3, Christians: 48.6 },
			{ x: '2070', Christians: 41.9 },
		];

		const inputs = buildLineChartLabelInputs({
			categories: ['Jews', 'Christians'],
			flattenedData: rows,
			labels,
			labelProps: {},
			independentScale: (value) => Number(value),
			dependentScale: (value) => Number(value),
			getIndependentValue: (row) => row.x,
		});
		const jewishInputs = inputs.filter((input) => input.category === 'Jews');

		expect(jewishInputs.map((input) => input.y)).toEqual([0.2, 0.3]);
	});
});
