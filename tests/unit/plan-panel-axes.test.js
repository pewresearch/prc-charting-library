import { planPanelAxes } from '../../../prc-scripts/includes/scripts/src/@prc/charting-utilities/smallMultiples/planPanelAxes';

describe('planPanelAxes', () => {
	const base = {
		columns: 3,
		rowCount: 2,
		dependentAxisActive: true,
		independentAxisActive: true,
		leftInset: 32,
		bottomInset: 20,
	};

	describe('minimal treatment', () => {
		it('shows y-axis ticks only on the first panel of each row', () => {
			const left = planPanelAxes({
				...base,
				axisTreatment: 'minimal',
				col: 0,
				row: 0,
			});
			const middle = planPanelAxes({
				...base,
				axisTreatment: 'minimal',
				col: 1,
				row: 0,
			});

			expect(left.showDependentAxis).toBe(true);
			expect(middle.showDependentAxis).toBe(false);
		});

		it('reserves the same left inset on every panel so plot fields align', () => {
			const left = planPanelAxes({
				...base,
				axisTreatment: 'minimal',
				col: 0,
				row: 0,
			});
			const middle = planPanelAxes({
				...base,
				axisTreatment: 'minimal',
				col: 1,
				row: 0,
			});

			expect(left.leftInset).toBe(32);
			expect(middle.leftInset).toBe(32);
		});

		it('shows x-axis tick labels on every panel', () => {
			const top = planPanelAxes({
				...base,
				axisTreatment: 'minimal',
				col: 0,
				row: 0,
			});
			const bottom = planPanelAxes({
				...base,
				axisTreatment: 'minimal',
				col: 1,
				row: 1,
			});

			expect(top.showIndependentAxis).toBe(true);
			expect(top.bottomInset).toBe(20);
			expect(bottom.showIndependentAxis).toBe(true);
			expect(bottom.bottomInset).toBe(20);
		});

		it('still shows dependent grid on every panel when y-axis is active', () => {
			const middle = planPanelAxes({
				...base,
				axisTreatment: 'minimal',
				col: 2,
				row: 0,
			});
			expect(middle.showDependentGrid).toBe(true);
			expect(middle.showIndependentGrid).toBe(false);
		});
	});

	describe('full treatment', () => {
		it('shows both axes on every panel when active', () => {
			const plan = planPanelAxes({
				...base,
				axisTreatment: 'full',
				col: 1,
				row: 0,
			});
			expect(plan.showDependentAxis).toBe(true);
			expect(plan.showIndependentAxis).toBe(true);
			expect(plan.leftInset).toBe(32);
			expect(plan.bottomInset).toBe(20);
			expect(plan.showDependentGrid).toBe(true);
			expect(plan.showIndependentGrid).toBe(true);
		});
	});

	it('respects axis active flags', () => {
		const plan = planPanelAxes({
			...base,
			axisTreatment: 'full',
			col: 0,
			row: 1,
			dependentAxisActive: false,
			independentAxisActive: false,
		});
		expect(plan.showDependentAxis).toBe(false);
		expect(plan.showIndependentAxis).toBe(false);
		expect(plan.showDependentGrid).toBe(false);
		expect(plan.showIndependentGrid).toBe(false);
		expect(plan.leftInset).toBe(0);
		expect(plan.bottomInset).toBe(0);
	});

	describe('horizontal (bar) treatment', () => {
		it('shows category ticks only on the first column; value ticks on every panel', () => {
			const left = planPanelAxes({
				...base,
				axisTreatment: 'minimal',
				orientation: 'horizontal',
				col: 0,
			});
			const middle = planPanelAxes({
				...base,
				axisTreatment: 'minimal',
				orientation: 'horizontal',
				col: 1,
			});

			// Independent = categories on left; dependent = values on bottom
			expect(left.showIndependentAxis).toBe(true);
			expect(middle.showIndependentAxis).toBe(false);
			expect(left.showDependentAxis).toBe(true);
			expect(middle.showDependentAxis).toBe(true);
		});

		it('reserves left inset from the category axis on every panel', () => {
			const middle = planPanelAxes({
				...base,
				axisTreatment: 'minimal',
				orientation: 'horizontal',
				col: 1,
			});
			expect(middle.leftInset).toBe(32);
			expect(middle.bottomInset).toBe(20);
		});
	});
});
