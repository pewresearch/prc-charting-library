import type { DataRender, Tooltip as BaseTooltipType, UnifiedColumn } from '@prc/charting-utilities';
import { getTooltipFormat, tooltipFormatPoint } from '@prc/charting-utilities';

type UnifiedTooltipRowsProps = {
	column: UnifiedColumn;
	tooltip: BaseTooltipType;
	dataRender: DataRender;
};

// The unified tooltip's body: the chart's `format` template evaluated once per
// series plotted at the snapped x, in the column's descending value order.
//
// Per-point `customTooltips` are ignored here. They are authored as complete
// tooltip bodies and cannot render as one row.
export const UnifiedTooltipRows = ({ column, tooltip, dataRender }: UnifiedTooltipRowsProps) => {
	return (
		<div className="prc-chart-tooltip__rows" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
			{column.entries.map((entry) => (
				<div
					key={entry.category}
					className="prc-chart-tooltip__row"
					// The same injection point mode uses. `getTooltipFormat`
					// already escapes the `<` a `minDisplayValue` floor produces,
					// so it must not be escaped again here.
					dangerouslySetInnerHTML={{
						__html: getTooltipFormat(
							tooltipFormatPoint(
								{
									x: column.xValue,
									y: entry.value,
									category: entry.category,
									color: entry.color,
								},
								entry.sourceRow
							),
							tooltip,
							dataRender
						),
					}}
				/>
			))}
		</div>
	);
};
