/**
 * Map story — validates that the React.lazy map components and their bundled
 * topojson chunks load under Storybook's webpack. Maps are the only chart
 * family that code-splits (see ChartBuilder's `lazy(() => import('../charts/maps/...'))`
 * wrapped in Suspense), so this is intentionally scoped to a single choropleth.
 *
 * Uses the editor render path like charts.stories.tsx; no WordPress backend.
 */
import { ChartBuilderWrapper } from './controller';

import { baseConfig } from '@prc/charting-utilities';
import type { BaseConfig } from '@prc/charting-utilities';

import '../examples/styles.scss';

import type { Meta, StoryObj } from '@storybook/react-webpack5';

const PARENT_CLASS = 'wp-chart-builder-wrapper';

const mapUsaConfig: BaseConfig = {
	...baseConfig,
	layout: {
		...baseConfig.layout,
		type: 'map-usa',
		parentClass: PARENT_CLASS,
		width: 640,
		height: 420,
	},
	dataRender: {
		...baseConfig.dataRender,
		x: 'x',
		categories: ['y'],
		mapScale: 'threshold',
		mapScaleDomain: [10, 20, 30, 40, 50],
		mapStyle: 'choropleth',
	},
	colors: ['#C9DEEE', '#9DC7E1', '#71B2D6', '#0090C0', '#0073A5', '#00557E'],
	legend: { ...baseConfig.legend, active: true },
	metadata: {
		...baseConfig.metadata,
		active: true,
		title: 'Fixture value by U.S. state',
		subtitle: 'Choropleth demo (randomly generated values)',
		tag: 'PEW RESEARCH CENTER',
	},
};

// Rows join to states via `x` (two-letter abbreviation -> FIPS). Value lives
// under the category key (`y`). See useStateData.findStateDataRow.
const STATE_ABBRS = [
	'CA',
	'TX',
	'FL',
	'NY',
	'PA',
	'IL',
	'OH',
	'GA',
	'NC',
	'MI',
	'WA',
	'AZ',
	'TN',
	'IN',
	'MO',
	'WI',
	'CO',
	'MN',
	'OR',
	'AL',
	'KY',
	'OK',
	'NV',
	'IA',
	'AR',
	'KS',
	'NM',
	'NE',
	'WV',
	'ID',
];

const mapUsaData = [
	STATE_ABBRS.map((abbr) => ({
		x: abbr,
		y: Math.floor(Math.random() * 60) + 1,
	})),
];

function MapFrame({ config, data }: { config: BaseConfig; data: unknown }) {
	return (
		<div className={PARENT_CLASS} style={{ width: config.layout.width, maxWidth: '100%' }}>
			<ChartBuilderWrapper config={config} data={data} />
		</div>
	);
}

const meta: Meta<typeof MapFrame> = {
	title: 'Charting Library/Maps',
	component: MapFrame,
	parameters: { layout: 'padded' },
};

export default meta;

type Story = StoryObj<typeof MapFrame>;

export const UnitedStatesChoropleth: Story = {
	render: () => <MapFrame config={mapUsaConfig} data={mapUsaData} />,
};
