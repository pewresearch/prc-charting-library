import {
	type BaseConfig,
	type FlatData,
	getCustomTooltip,
	getTooltipFormat,
	getTooltipHeaderFormat,
	resolveCategoryColor,
	type SeriesMaskView,
} from '@prc/charting-utilities';

export type DivergingTooltipSide = 'left' | 'right' | 'top' | 'bottom';

type DivergingBarConfig = BaseConfig['divergingBar'];

export type DivergingTooltipDatum = FlatData & {
	tooltipMode?: string;
	tooltipSide?: DivergingTooltipSide;
	tooltipHeader?: string;
	tooltip?: string;
	category?: string;
};

/**
 * Whether a tooltip side reads the negative categories.
 * Horizontal charts use left. Vertical charts use bottom.
 *
 * @param side Side of the diverging axis under the pointer.
 */
export function isDivergingNegativeSide(side: DivergingTooltipSide | undefined): boolean {
	return side === 'left' || side === 'bottom';
}

/**
 * Category groups for a diverging row tooltip.
 * Unified tooltips list the negative group, then the positive group.
 *
 * @param divergingBar    Diverging bar config.
 * @param secondaryActive Whether the ghost overlay is on.
 * @param tooltipSide     Side of the axis under the pointer.
 * @param unified         Whether the tooltip lists both sides.
 */
export function divergingRowTooltipGroups(
	divergingBar: DivergingBarConfig,
	secondaryActive: boolean,
	tooltipSide: DivergingTooltipSide | undefined,
	unified: boolean
): string[][] {
	const secondary = divergingBar?.secondary;
	const extraPositive = secondaryActive && secondary ? secondary.positiveCategories : [];
	const extraNegative = secondaryActive && secondary ? secondary.negativeCategories : [];
	const positive = [...(divergingBar?.positiveCategories ?? []), ...extraPositive];
	const negative = [...(divergingBar?.negativeCategories ?? []), ...extraNegative];

	if (unified) {
		return [negative, positive].filter((group) => group.length > 0);
	}

	return [isDivergingNegativeSide(tooltipSide) ? negative : positive];
}

type UnifiedBarTooltipBodyProps = {
	tooltipData: DivergingTooltipDatum;
	tooltip: BaseConfig['tooltip'];
	divergingBar: BaseConfig['divergingBar'];
	secondaryActive: boolean;
	seriesMaskView: SeriesMaskView;
	secondaryLabelColor: (category: string) => string;
	colorScale: (category: string) => string;
	dataRender: BaseConfig['dataRender'];
};

/** Tooltip body for unified bar charts; diverging bars use it for row tooltips. */
export function UnifiedBarTooltipBody({
	tooltipData,
	tooltip,
	divergingBar,
	secondaryActive,
	seriesMaskView,
	secondaryLabelColor,
	colorScale,
	dataRender,
}: UnifiedBarTooltipBodyProps) {
	return (
		<>
			<>
				{tooltip.headerActive && (
					<div
						style={{
							marginBottom: '10px',
						}}
					>
						<strong>
							{tooltipData.tooltipHeader
								? tooltipData.tooltipHeader
								: getTooltipHeaderFormat(
										{
											x: tooltipData.x,
											category: tooltipData.category,
										},
										tooltip
									)}
						</strong>
					</div>
				)}
			</>
			{tooltipData.tooltipMode === 'row' ? (
				<div>
					{divergingRowTooltipGroups(
						divergingBar,
						secondaryActive,
						tooltipData.tooltipSide,
						tooltip.mode === 'unified'
					)
						.map((group) => group.filter((cat) => !seriesMaskView.isHidden(cat)))
						.filter((group) => group.length > 0)
						.map((group, groupIndex) => (
							<div key={`tooltip-group-${groupIndex}`}>
								{groupIndex > 0 && (
									<div
										style={{
											borderTop: '1px solid light-dark(#dadbdb, #3a3a3a)',
											margin: '8px 0',
										}}
									/>
								)}
								{group.map((cat: string) => {
									const raw = tooltipData[cat];
									if (raw === null || raw === undefined) return null;
									const val = typeof raw === 'number' ? Math.abs(raw) : raw;
									const { body: customBody } = getCustomTooltip(tooltipData, cat);
									const secondaryColor =
										secondaryActive &&
										(divergingBar.secondary!.positiveCategories.includes(cat) ||
											divergingBar.secondary!.negativeCategories.includes(cat))
											? secondaryLabelColor(cat)
											: undefined;
									const html = customBody
										? customBody
										: getTooltipFormat(
												{
													x: tooltipData.x,
													y: val,
													category: cat,
													color: resolveCategoryColor({
														category: cat,
														fallback: secondaryColor ?? colorScale(cat),
														dataRender,
													}),
													data: tooltipData,
												},
												tooltip,
												dataRender
											);
									return <div key={cat} dangerouslySetInnerHTML={{ __html: html }} />;
								})}
							</div>
						))}
				</div>
			) : (
				<div
					dangerouslySetInnerHTML={{
						__html: tooltipData.tooltip
							? tooltipData.tooltip
							: getTooltipFormat(
									{
										x: tooltipData.x,
										y: tooltipData.y,
										category: tooltipData.category,
										color: resolveCategoryColor({
											category: tooltipData.category || '',
											fallback: colorScale(tooltipData.category || ''),
											dataRender,
										}),
										data: tooltipData,
									},
									tooltip,
									dataRender
								),
					}}
				/>
			)}
		</>
	);
}
