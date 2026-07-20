import type { BaseConfig, Legend } from '@prc/charting-utilities';
import { resolveCategoryColor } from '@prc/charting-utilities';
import { Group } from '@visx/group';

import type { OnLineSeriesDeclutterInput, DeclutterOffset } from '@prc/charting-utilities';
import { OnLineSeriesLabel } from './OnLineSeriesLabel';
import { getDeclutterOffset } from './useLabelDeclutter';

interface DirectSeriesLegendLabelsProps {
	inputs: OnLineSeriesDeclutterInput[];
	offsets: Map<string, DeclutterOffset>;
	legend: Legend;
	colors: string[];
	dataRender: BaseConfig['dataRender'];
	padding: { left: number; top: number };
	chartInnerWidth: number;
	chartInnerHeight: number;
	labelScales: { scaleX: number; scaleY: number };
}

export function DirectSeriesLegendLabels({
	inputs,
	offsets,
	legend,
	colors,
	dataRender,
	padding,
	chartInnerWidth,
	chartInnerHeight,
	labelScales,
}: DirectSeriesLegendLabelsProps) {
	if (inputs.length === 0) {
		return null;
	}

	return (
		<Group top={padding.top} left={padding.left}>
			{inputs.map((seriesInput, seriesIndex) => {
				const { dx, dy } = getDeclutterOffset(offsets, seriesInput.id, 0, 0);
				const customEntry = legend.customLabels?.[seriesInput.category];
				const seriesColor = resolveCategoryColor({
					category: seriesInput.category,
					fallback: colors[seriesIndex],
					dataRender,
				});

				return (
					<OnLineSeriesLabel
						key={`direct-series-label-${seriesInput.category}`}
						anchorX={seriesInput.x}
						anchorY={seriesInput.y}
						category={seriesInput.category}
						displayText={seriesInput.text}
						defaultDx={dx}
						defaultDy={dy}
						customEntry={customEntry}
						seriesColor={seriesColor}
						fontSize={legend.fontSize}
						fontWeight={legend.fontWeight}
						paddingLeft={padding.left}
						paddingTop={padding.top}
						chartInnerWidth={chartInnerWidth}
						chartInnerHeight={chartInnerHeight}
						labelScales={labelScales}
						textOutline
					/>
				);
			})}
		</Group>
	);
}
