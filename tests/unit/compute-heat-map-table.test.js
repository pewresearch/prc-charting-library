import { computeHeatMapTableLayout } from '../../../prc-scripts/includes/scripts/src/@prc/charting-utilities/heatMapTable/computeHeatMapTableLayout';
import { computeHeatMapTableCells } from '../../../prc-scripts/includes/scripts/src/@prc/charting-utilities/heatMapTable/computeHeatMapTableCells';
import { createValueColorScale } from '../../../prc-scripts/includes/scripts/src/@prc/charting-utilities/heatMapTable/createValueColorScale';

describe('computeHeatMapTableLayout', () => {
	it('reserves row label and column header chrome', () => {
		const layout = computeHeatMapTableLayout({
			columnCount: 3,
			availableWidth: 420,
			contentHeight: 160,
			rowLabelWidth: 120,
			columnHeaderHeight: 40,
			minCellWidth: 40,
		});

		expect(layout.rowLabelWidth).toBe(120);
		expect(layout.columnHeaderHeight).toBe(40);
		expect(layout.cellPosition(0, 40)).toEqual({ x: 120, y: 40 });
		expect(layout.totalWidth).toBeGreaterThan(layout.gridWidth);
		expect(layout.totalHeight).toBe(200);
	});

	it('can hide the dependent axis band', () => {
		const layout = computeHeatMapTableLayout({
			columnCount: 1,
			availableWidth: 200,
			contentHeight: 100,
			columnHeaderHeight: 0,
		});

		expect(layout.columnHeaderHeight).toBe(0);
		expect(layout.cellPosition(0, 0)).toEqual({ x: 0, y: 0 });
		expect(layout.totalHeight).toBe(100);
	});
});

describe('computeHeatMapTableCells', () => {
	it('flattens rows × columns into cell descriptors', () => {
		const result = computeHeatMapTableCells({
			rows: [
				{ x: 'Total', YouTube: 95, TikTok: 67 },
				{ x: 'Boys', YouTube: 97, TikTok: 60 },
			],
			columns: ['YouTube', 'TikTok'],
		});

		expect(result.rowKeys).toEqual(['Total', 'Boys']);
		expect(result.columns).toEqual(['YouTube', 'TikTok']);
		expect(result.cells).toHaveLength(4);
		expect(result.cells[0]).toMatchObject({
			rowKey: 'Total',
			columnKey: 'YouTube',
			value: 95,
		});
		expect(result.cells[0].dataPoint.category).toBe('YouTube');
		expect(result.cells[0].dataPoint.y).toBe(95);
	});

	it('treats empty cells as null values', () => {
		const result = computeHeatMapTableCells({
			rows: [{ x: 'A', Col: '' }],
			columns: ['Col'],
		});
		expect(result.cells[0].value).toBeNull();
	});
});

describe('createValueColorScale', () => {
	it('maps linear values across the color range', () => {
		const scale = createValueColorScale({
			mode: 'linear',
			domain: [0, 100],
			colors: ['#ffffff', '#000000'],
		});

		expect(scale.getFill(0)).toMatch(/rgb\(255,\s*255,\s*255\)|#ffffff/i);
		expect(scale.getFill(100)).toMatch(/rgb\(0,\s*0,\s*0\)|#000000/i);
		expect(scale.getFill(null)).toBe('#F5F5F5');
	});

	it('uses threshold breakpoints', () => {
		const scale = createValueColorScale({
			mode: 'threshold',
			domain: [50],
			colors: ['#aad4e8', '#00334d'],
			emptyFill: '#eee',
		});

		expect(scale.getFill(10)).toBe('#aad4e8');
		expect(scale.getFill(80)).toBe('#00334d');
		expect(scale.getFill(undefined)).toBe('#eee');
	});
});
