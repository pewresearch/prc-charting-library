/* eslint-disable jsdoc/require-param */
import type { BaseConfig, FlatData, NetValueSide, NetValues, TableData } from '@prc/charting-utilities';
import {
	DataContext,
	NET_VALUE_CATEGORY_NEGATIVE,
	NET_VALUE_CATEGORY_POSITIVE,
	buildChartLabelId,
	getCustomLabel,
	getCustomLabelText,
	getLabelFormat,
	getLabelFill,
	hasAuthorLabelOverride,
} from '@prc/charting-utilities';
import { useContext, useMemo } from 'react';
import { AnimatedBarLabel } from '../animation';
import { getDeclutterOffset, useLabelDeclutter } from './useLabelDeclutter';

export type NetValueLabelItem = {
	dataPoint: FlatData;
	x: number;
	y: number;
	textAnchor: 'start' | 'end' | 'middle';
	dominantBaseline?: 'middle' | 'hanging' | 'auto' | 'central' | 'alphabetic';
};

export function formatNetValueLabel(d: FlatData, sideConfig: NetValueSide): string {
	if (!sideConfig?.category) {
		return '';
	}
	const raw = d[sideConfig.category];
	if (raw === undefined || raw === null || raw === '') {
		return '';
	}
	return getLabelFormat(raw, sideConfig.category, sideConfig, null);
}

function getNetValueLabelContent(d: FlatData, sideConfig: NetValueSide, categoryKey: string): string {
	return getCustomLabelText(d, categoryKey) || getCustomLabel(d, categoryKey) || formatNetValueLabel(d, sideConfig);
}

type NetValueLabelsProps = {
	items: NetValueLabelItem[];
	side: 'positive' | 'negative';
	netValues: NetValues;
	labelProps: Record<string, unknown>;
	innerWidth: number;
	innerHeight: number;
};

/**
 * Renders NET value labels as DraggableLabels (popover + drag in editor when wired).
 *
 * When `labels.autoDeclutter` is enabled, runs a synchronous d3-force pass to
 * separate overlapping net-value labels:
 *   - Vertical bars (textAnchor 'middle'): labels sit above bars → lock x, spread on y
 *   - Horizontal bars (textAnchor 'start'/'end'): labels sit beside bars → lock y, spread on x
 */
export function NetValueLabels({ items, side, netValues, labelProps, innerWidth, innerHeight }: NetValueLabelsProps) {
	const context = useContext(
		DataContext as React.Context<{
			data: any;
			config: BaseConfig;
			tableData: TableData;
			wpEditorFunctions?: any;
		}>
	);
	const labels = context?.config?.labels;

	const sideConfig = side === 'positive' ? netValues.positive : netValues.negative;
	const categoryKey = side === 'positive' ? NET_VALUE_CATEGORY_POSITIVE : NET_VALUE_CATEGORY_NEGATIVE;

	const isActive = !!netValues.active && !!sideConfig?.category && (side !== 'negative' || !!sideConfig.active);

	// Determine axis orientation from the first item's textAnchor:
	//   'middle' → vertical bar (labels above) → lock x so they only spread vertically
	//   'start'/'end' → horizontal bar (labels beside) → lock y so they only spread horizontally
	const isVertical = items.length > 0 && items[0].textAnchor === 'middle';

	// Build declutter inputs from the rendered item positions.
	const declutterInputs = useMemo(() => {
		if (!isActive || !labels?.autoDeclutter || items.length < 2 || !sideConfig) {
			return [];
		}
		return items
			.map((item, i) => {
				const label = getNetValueLabelContent(item.dataPoint, sideConfig, categoryKey);
				if (!label) {
					return null;
				}
				return {
					id: buildChartLabelId(['net-value', side, item.dataPoint.x, i]),
					x: item.x,
					y: item.y,
					text: label,
					fontSize: sideConfig.fontSize,
					fontFamily: sideConfig.fontFamily || undefined,
					fontWeight: sideConfig.fontWeight,
					textAnchor: item.textAnchor,
					dominantBaseline: item.dominantBaseline ?? 'middle',
					defaultDx: sideConfig.labelPositionDX,
					defaultDy: sideConfig.labelPositionDY,
					locked: hasAuthorLabelOverride(item.dataPoint, categoryKey),
				};
			})
			.filter(Boolean) as ReturnType<typeof buildChartLabelId extends never ? never : any>[];
	}, [isActive, labels?.autoDeclutter, items, sideConfig, side, categoryKey]);

	const declutterOffsets = useLabelDeclutter(
		declutterInputs,
		{
			padding: labels?.declutterPadding ?? 4,
			lockX: isVertical,
			lockY: !isVertical,
			iterations: 120,
			anchorStrengthX: isVertical ? undefined : 0.5,
			anchorStrengthY: isVertical ? 0.5 : undefined,
			innerWidth,
			innerHeight,
			omitWithin: labels?.declutterOmitWithin,
		},
		!!(isActive && labels?.autoDeclutter && items.length >= 2)
	);

	if (!isActive || !sideConfig) {
		return null;
	}

	return (
		<g role="presentation">
			{items.map((item, i) => {
				const label = getNetValueLabelContent(item.dataPoint, sideConfig, categoryKey);
				if (!label) {
					return null;
				}
				const defaultLabel = formatNetValueLabel(item.dataPoint, sideConfig);
				const labelId = buildChartLabelId(['net-value', side, item.dataPoint.x, i]);
				const { dx, dy, hidden } = getDeclutterOffset(
					declutterOffsets,
					labelId,
					sideConfig.labelPositionDX,
					sideConfig.labelPositionDY
				);
				if (hidden) {
					return null;
				}
				return (
					<AnimatedBarLabel
						key={`net-value-${side}-${item.dataPoint.x}-${i}`}
						x={item.x}
						y={item.y}
						dataPoint={item.dataPoint}
						category={categoryKey}
						defaultDx={dx}
						defaultDy={dy}
						defaultLabel={defaultLabel}
						chartInnerWidth={innerWidth}
						chartInnerHeight={innerHeight}
						textAnchor={item.textAnchor}
						dominantBaseline={item.dominantBaseline ?? 'middle'}
						fill={getLabelFill({ labelColor: sideConfig.color, seriesColor: sideConfig.color })}
						fontSize={sideConfig.fontSize}
						fontWeight={sideConfig.fontWeight}
						fontFamily={sideConfig.fontFamily || undefined}
						{...labelProps}
					>
						{label}
					</AnimatedBarLabel>
				);
			})}
		</g>
	);
}

/** Horizontal grouped bar: positive = right of max category bar, vertically centered */
export function buildNetValueItemsHorizontalGrouped({
	data,
	dataRender,
	dependentScale,
	groupScale,
	getIndependentValue,
	margin,
}: {
	data: FlatData[];
	dataRender: { categories: string[]; x: string };
	dependentScale: (n: number) => number;
	groupScale: { (d: string): number | undefined; bandwidth: () => number };
	getIndependentValue: (d: FlatData) => string;
	margin: number;
}): NetValueLabelItem[] {
	return data.map((d) => {
		const maxVal = Math.max(0, ...dataRender.categories.map((c) => Number(d[c]) || 0));
		const rightX = dependentScale(maxVal) + margin;
		const y = (groupScale(getIndependentValue(d)) ?? 0) + groupScale.bandwidth() / 2;
		return {
			dataPoint: d,
			x: rightX,
			y,
			textAnchor: 'start',
			dominantBaseline: 'middle',
		};
	});
}

/** Horizontal stacked bar: positive = right of total stack, vertically centered */
export function buildNetValueItemsHorizontalStacked({
	data,
	dataRender,
	dependentScale,
	groupScale,
	getIndependentValue,
	margin,
}: {
	data: FlatData[];
	dataRender: { categories: string[]; x: string };
	dependentScale: (n: number) => number;
	groupScale: { (d: string): number | undefined; bandwidth: () => number };
	getIndependentValue: (d: FlatData) => string;
	margin: number;
}): NetValueLabelItem[] {
	return data.map((d) => {
		const total = dataRender.categories.reduce((sum, c) => sum + (Number(d[c]) || 0), 0);
		const rightX = dependentScale(total) + margin;
		const y = (groupScale(getIndependentValue(d)) ?? 0) + groupScale.bandwidth() / 2;
		return {
			dataPoint: d,
			x: rightX,
			y,
			textAnchor: 'start',
			dominantBaseline: 'middle',
		};
	});
}

/** Diverging horizontal: data rows use signed values for negative categories, vertically centered */
export function buildNetValueItemsHorizontalDiverging({
	data,
	divergingBar,
	dependentScale,
	groupScale,
	getIndependentValue,
	margin,
	side,
}: {
	data: FlatData[];
	divergingBar: {
		positiveCategories: string[];
		negativeCategories: string[];
	};
	dependentScale: (n: number) => number;
	groupScale: { (d: string): number | undefined; bandwidth: () => number };
	getIndependentValue: (d: FlatData) => string;
	margin: number;
	side: 'positive' | 'negative';
}): NetValueLabelItem[] {
	return data.map((d) => {
		const y = (groupScale(getIndependentValue(d)) ?? 0) + groupScale.bandwidth() / 2;
		if (side === 'positive') {
			const posTotal = divergingBar.positiveCategories.reduce((sum, c) => sum + (Number(d[c]) || 0), 0);
			const rightX = dependentScale(posTotal) + margin;
			return {
				dataPoint: d,
				x: rightX,
				y,
				textAnchor: 'start' as const,
				dominantBaseline: 'middle' as const,
			};
		}
		const negTotal = divergingBar.negativeCategories.reduce((sum, c) => sum + (Number(d[c]) || 0), 0);
		const leftX = dependentScale(negTotal) - margin;
		return {
			dataPoint: d,
			x: leftX,
			y,
			textAnchor: 'end' as const,
			dominantBaseline: 'middle' as const,
		};
	});
}

/** Vertical grouped bar: positive = above top of tallest bar in column */
export function buildNetValueItemsVerticalGrouped({
	data,
	dataRender,
	dependentScale,
	groupScale,
	getIndependentValue,
	margin,
}: {
	data: FlatData[];
	dataRender: { categories: string[]; x: string };
	dependentScale: (n: number) => number;
	groupScale: { (d: string): number | undefined; bandwidth: () => number };
	getIndependentValue: (d: FlatData) => string | number;
	margin: number;
}): NetValueLabelItem[] {
	return data.map((d) => {
		const maxVal = Math.max(0, ...dataRender.categories.map((c) => Number(d[c]) || 0));
		const barTopY = dependentScale(maxVal);
		const labelY = barTopY - margin;
		const x = (groupScale(String(getIndependentValue(d))) ?? 0) + groupScale.bandwidth() / 2;
		return {
			dataPoint: d,
			x,
			y: labelY,
			textAnchor: 'middle',
			dominantBaseline: 'auto',
		};
	});
}

/** Vertical stacked: positive = above stack top */
export function buildNetValueItemsVerticalStacked({
	data,
	dataRender,
	dependentScale,
	groupScale,
	getIndependentValue,
	margin,
}: {
	data: FlatData[];
	dataRender: { categories: string[]; x: string };
	dependentScale: (n: number) => number;
	groupScale: { (d: string): number | undefined; bandwidth: () => number };
	getIndependentValue: (d: FlatData) => string | number;
	margin: number;
}): NetValueLabelItem[] {
	return data.map((d) => {
		const total = dataRender.categories.reduce((sum, c) => sum + (Number(d[c]) || 0), 0);
		const barTopY = dependentScale(total);
		const labelY = barTopY - margin;
		const x = (groupScale(String(getIndependentValue(d))) ?? 0) + groupScale.bandwidth() / 2;
		return {
			dataPoint: d,
			x,
			y: labelY,
			textAnchor: 'middle',
			dominantBaseline: 'auto',
		};
	});
}

/** Diverging vertical bar stack */
export function buildNetValueItemsVerticalDiverging({
	data,
	divergingBar,
	dependentScale,
	groupScale,
	getIndependentValue,
	margin,
	side,
}: {
	data: FlatData[];
	divergingBar: {
		positiveCategories: string[];
		negativeCategories: string[];
	};
	dependentScale: (n: number) => number;
	groupScale: { (d: string): number | undefined; bandwidth: () => number };
	getIndependentValue: (d: FlatData) => string | number;
	margin: number;
	side: 'positive' | 'negative';
}): NetValueLabelItem[] {
	return data.map((d) => {
		const x = (groupScale(String(getIndependentValue(d))) ?? 0) + groupScale.bandwidth() / 2;
		if (side === 'positive') {
			const posTotal = divergingBar.positiveCategories.reduce((sum, c) => sum + (Number(d[c]) || 0), 0);
			const barTopY = dependentScale(posTotal);
			return {
				dataPoint: d,
				x,
				y: barTopY - margin,
				textAnchor: 'middle' as const,
				dominantBaseline: 'auto' as const,
			};
		}
		const negTotal = divergingBar.negativeCategories.reduce((sum, c) => sum + (Number(d[c]) || 0), 0);
		const barBottomY = dependentScale(negTotal);
		return {
			dataPoint: d,
			x,
			y: barBottomY + margin,
			textAnchor: 'middle' as const,
			dominantBaseline: 'hanging' as const,
		};
	});
}
