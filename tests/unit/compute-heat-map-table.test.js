import { describe, expect, it } from '@jest/globals';
import { computeHeatMapTableLayout } from '../../../prc-scripts/includes/scripts/src/@prc/charting-utilities/heatMapTable/computeHeatMapTableLayout';
import { computeHeatMapTableCells } from '../../../prc-scripts/includes/scripts/src/@prc/charting-utilities/heatMapTable/computeHeatMapTableCells';
import {
	createValueColorScale,
	resolveBinPaint,
} from '../../../prc-scripts/includes/scripts/src/@prc/charting-utilities/heatMapTable/createValueColorScale';

describe('computeHeatMapTableLayout', () => {
	it('fills the chart width from the axis line, leaving axis room to padding', () => {
		const layout = computeHeatMapTableLayout({
			columnCount: 3,
			availableWidth: 300,
			cellGap: 15,
			minCellWidth: 40,
		});

		expect(layout.cellWidth).toBe(90);
		expect(layout.cellPosition(0, 40)).toEqual({ x: 0, y: 40 });
		expect(layout.cellPosition(1, 0)).toEqual({ x: 105, y: 0 });
		expect(layout.gridWidth).toBe(300);
	});

	it('keeps the minimum cell width when columns overflow', () => {
		const layout = computeHeatMapTableLayout({
			columnCount: 4,
			availableWidth: 100,
			minCellWidth: 40,
		});

		expect(layout.cellWidth).toBe(40);
		expect(layout.gridWidth).toBe(160);
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

	it('threshold getFill prefers the named series fill keyed by bin language', () => {
		const scale = createValueColorScale({
			mode: 'threshold',
			domain: [50],
			colors: ['#aad4e8', '#00334d'],
			seriesStyles: {
				'Less than 50': { fill: '#123456' },
			},
		});

		expect(scale.getFill(10)).toBe('#123456');
		expect(scale.getFill(80)).toBe('#00334d');
	});

	it('ordinal getFill prefers the named series fill over the scale color', () => {
		const scale = createValueColorScale({
			mode: 'ordinal',
			domain: ['Democrat', 'Republican'],
			colors: ['#aaaaaa', '#bbbbbb'],
			seriesStyles: {
				Democrat: { fill: '#123456' },
			},
		});

		expect(scale.getFill('Democrat')).toBe('#123456');
		expect(scale.getFill('Republican')).toBe('#bbbbbb');
	});

	it('resolveBinPaint overlays named fill, hatch, stroke, and opacity', () => {
		const paint = resolveBinPaint(
			'#aaaaaa',
			'Democrat',
			{
				Democrat: {
					fill: '#123456',
					pattern: 'striped',
					stroke: '#000000',
					strokeWidth: 2,
					strokeOpacity: 0.5,
					opacity: 0.4,
				},
			},
			{ stroke: '#cccccc', strokeWidth: 1, opacity: 1 }
		);

		expect(paint.fill).toBe('url(#series-pattern-democrat)');
		expect(paint.stroke).toBe('#000000');
		expect(paint.strokeWidth).toBe(2);
		expect(paint.strokeOpacity).toBe(0.5);
		expect(paint.opacity).toBe(0.4);
	});
});
