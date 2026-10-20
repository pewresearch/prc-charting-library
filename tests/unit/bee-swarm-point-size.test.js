/* global HTMLCanvasElement */
import { beforeAll, describe, expect, jest, test } from '@jest/globals';
import { createElement } from 'react';
import { render } from '@testing-library/react';
import { DataProvider, baseConfig } from '../../../prc-scripts/includes/scripts/src/@prc/charting-utilities';
import BeeSwarm from '../../src/lib/charts/BeeSwarm';

beforeAll(() => {
	jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
		measureText: () => ({ width: 0 }),
	});
});

function renderBeeSwarm(seriesStyles, { grouped = true } = {}) {
	const config = {
		...baseConfig,
		layout: {
			...baseConfig.layout,
			type: 'bee-swarm',
		},
		colors: ['#456A83', '#BF3B27'],
		nodes: {
			...baseConfig.nodes,
			pointSize: 4,
			sizeCategory: null,
		},
		seriesStyles,
		labels: {
			...baseConfig.labels,
			active: false,
		},
		dataRender: {
			...baseConfig.dataRender,
			x: 'x',
			categories: ['Age'],
			sortOrder: 'none',
			groupBreaksActive: grouped,
			groupBreaksCategory: grouped ? 'Group' : null,
			groupBreaksCategoryValues: grouped ? ['Young', 'Old'] : [],
		},
		beeSwarm: {
			...baseConfig.beeSwarm,
			layoutMode: 'dodge',
			groupBy: null,
		},
	};

	const { container } = render(
		createElement(
			DataProvider,
			{
				value: {
					data: [
						{ x: 'R-001', Age: 35, Group: 'Young' },
						{ x: 'R-002', Age: 50, Group: 'Old' },
					],
					config,
					tableData: { header: [], rows: [] },
				},
			},
			createElement(BeeSwarm)
		)
	);

	return container.innerHTML;
}

describe('bee swarm series point size', () => {
	test('a series point size overrides the chart default radius', () => {
		const markup = renderBeeSwarm({ Young: { pointSize: 9 } });

		expect(markup).toContain('r="9"');
	});

	test('without a group column, the value column row styles every dot', () => {
		const markup = renderBeeSwarm({ Age: { pointSize: 9, stroke: '#00ff00' } }, { grouped: false });

		expect(markup.match(/r="9"/g)).toHaveLength(2);
		expect(markup).toContain('stroke="#00ff00"');
	});
});
