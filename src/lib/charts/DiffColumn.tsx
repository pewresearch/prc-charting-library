import { useContext, type MouseEvent } from 'react';
import { Text } from '@visx/text';
import {
	contrastLabelFillForLightDark,
	DataContext,
	DiffColumn as DiffColumnType,
	DataRender,
	generateElementKey,
	Labels,
	Layout,
} from '@prc/charting-utilities';
import type { FlatData } from '@prc/charting-utilities';

function getTextOutlineProps(fill: string, enabled: boolean) {
	if (!enabled) {
		return {};
	}
	return {
		stroke: contrastLabelFillForLightDark(fill || '#000000'),
		strokeWidth: 1,
		paintOrder: 'stroke' as const,
	};
}

function resolveCellFontSize(customFontSize: number | null | undefined, columnFontSize: string | undefined) {
	if (customFontSize !== undefined && customFontSize !== null) {
		return customFontSize;
	}
	const parsed = parseInt(String(columnFontSize || '10'), 10);
	return Number.isFinite(parsed) ? parsed : 10;
}

function resolveRectFill(rectFill: string | undefined) {
	if (!rectFill || rectFill === 'none') {
		return 'none';
	}
	return rectFill;
}

type DiffColumnProps = {
	diffColumn: DiffColumnType;
	layout: Layout;
	dataRender: DataRender;
	flattenedData: FlatData[];
	labels: Labels;
	innerHeight: number;
	innerWidth: number;
	scale: any;
	showHeader?: boolean;
	groupValue?: string | null;
};

export const DiffColumn = ({
	diffColumn,
	innerHeight,
	innerWidth,
	flattenedData,
	scale,
	dataRender,
	labels,
	layout,
	showHeader = true,
	groupValue = null,
}: DiffColumnProps) => {
	const { wpEditorFunctions } = useContext(DataContext) as {
		wpEditorFunctions?: {
			diffColumn?: {
				onHeaderClick?: (anchorEl: SVGTextElement) => void;
				onClick?: (
					dataPoint: FlatData,
					category: string,
					defaultLabel: string,
					anchorEl: SVGTextElement,
					groupValue: string | null
				) => void;
			};
		};
	};
	const onHeaderClick = wpEditorFunctions?.diffColumn?.onHeaderClick;
	const onCellClick = wpEditorFunctions?.diffColumn?.onClick;

	return (
		<g x={innerWidth + diffColumn.style.marginLeft} y={0} width={diffColumn.style.width} height={innerHeight}>
			<rect
				x={innerWidth + diffColumn.style.marginLeft}
				y={-diffColumn.style.heightOffset}
				width={diffColumn.style.width}
				height={innerHeight + diffColumn.style.heightOffset}
				fill={resolveRectFill(diffColumn.style.rectFill)}
			/>
			{showHeader && (
				<Text
					width={diffColumn.style.width}
					x={innerWidth + diffColumn.style.marginLeft + diffColumn.style.width / 2}
					y={0}
					textAnchor="middle"
					fill={diffColumn.style.headerFill}
					{...getTextOutlineProps(diffColumn.style.headerFill, diffColumn.style.headerTextOutline)}
					{...(onHeaderClick
						? {
								onClick: (e: MouseEvent<SVGTextElement>) => {
									onHeaderClick(e.currentTarget);
								},
								style: {
									fontSize: diffColumn.style.headerFontSize,
									fontWeight: diffColumn.style.headerFontWeight ?? diffColumn.style.fontWeight,
									fontStyle: diffColumn.style.headerFontStyle ?? diffColumn.style.fontStyle,
									fontFamily: diffColumn.style.headerFontFamily ?? diffColumn.style.fontFamily,
									cursor: 'pointer',
									pointerEvents: 'all' as const,
								},
							}
						: {
								style: {
									fontSize: diffColumn.style.headerFontSize,
									fontWeight: diffColumn.style.headerFontWeight ?? diffColumn.style.fontWeight,
									fontStyle: diffColumn.style.headerFontStyle ?? diffColumn.style.fontStyle,
									fontFamily: diffColumn.style.headerFontFamily ?? diffColumn.style.fontFamily,
								},
							})}
				>
					{diffColumn.columnHeader}
				</Text>
			)}
			{flattenedData?.map((d: FlatData, i: number) => {
				const { dx, dy, style, category } = diffColumn;
				const rowKey = generateElementKey(d.x, category, groupValue);
				const customEntry = diffColumn.customLabels?.[rowKey];
				const cellFill = customEntry?.fill ?? style.fill;
				const cellFontWeight =
					customEntry?.fontWeight !== undefined && String(customEntry.fontWeight) !== ''
						? customEntry.fontWeight
						: style.fontWeight;
				const cellFontStyle =
					customEntry?.fontStyle !== undefined && String(customEntry.fontStyle) !== ''
						? customEntry.fontStyle
						: style.fontStyle;
				const cellFontSize = resolveCellFontSize(customEntry?.fontSize, style.fontSize);
				const cellTextOutline =
					customEntry?.textOutline !== undefined ? customEntry.textOutline : style.textOutline;
				const cellLabel = customEntry?.text ?? d[category];
				const y =
					layout.type === 'dot-plot'
						? scale(d[dataRender.x])
						: // TODO: fix this magic number
							(scale(d[dataRender.x]) ?? 0) + labels.labelPositionDY + 12;
				return (
					<text
						key={rowKey || i}
						fill={cellFill}
						{...getTextOutlineProps(cellFill, cellTextOutline)}
						{...(onCellClick
							? {
									onClick: (e: MouseEvent<SVGTextElement>) => {
										e.stopPropagation();
										onCellClick(
											d,
											category,
											String(d[category] ?? ''),
											e.currentTarget,
											groupValue
										);
									},
									style: {
										fontSize: cellFontSize,
										fontWeight: cellFontWeight,
										fontStyle: cellFontStyle,
										fontFamily: style.fontFamily,
										cursor: 'pointer',
										pointerEvents: 'all' as const,
									},
								}
							: {
									style: {
										fontSize: cellFontSize,
										fontWeight: cellFontWeight,
										fontStyle: cellFontStyle,
										fontFamily: style.fontFamily,
									},
								})}
						width={style.width}
						x={innerWidth + diffColumn.style.marginLeft + style.width / 2}
						y={y}
						dx={dx}
						dy={dy}
						dominantBaseline="middle"
						textAnchor="middle"
					>
						{cellLabel}
					</text>
				);
			})}
		</g>
	);
};
