import type { CSSProperties, MouseEvent } from 'react';

import type { FlatData, ShapePaint, WaffleCell, WaffleCellShape, WaffleLayout } from '@prc/charting-utilities';
import { generateElementKey, getGroupValue, resolveShapePaint } from '@prc/charting-utilities';

type WaffleMarksProps = {
	cells: WaffleCell[];
	layout: WaffleLayout;
	cellShape: WaffleCellShape;
	cellRadius: number;
	emptyFill: string;
	colorScale: (categoryKey: string) => string;
	/** Series/value column key passed to shapes.onClick (same as line/pie). */
	categoryKey: string;
	dataByCategory: Map<string, FlatData>;
	dataRender?: {
		groupBreaksActive?: boolean;
		groupBreaksCategory?: string;
	};
	customStyles?: Record<string, ShapePaint>;
	wpEditorFunctions?: {
		shapes?: {
			onClick: (
				dataPoint: FlatData,
				category: string,
				defaultColor: string,
				target: EventTarget | null,
				groupValue?: string | null
			) => void;
		};
	};
	tooltipActive?: boolean;
	onCellMouseMove?: (event: MouseEvent<Element>, dataPoint: FlatData, category: string) => void;
	onCellMouseLeave?: () => void;
	siblingMarkOpacity?: (categoryKey: string) => number;
};

const WaffleMarks = ({
	cells,
	layout,
	cellShape,
	cellRadius,
	emptyFill,
	colorScale,
	categoryKey,
	dataByCategory,
	dataRender,
	customStyles,
	wpEditorFunctions,
	tooltipActive = false,
	onCellMouseMove,
	onCellMouseLeave,
	siblingMarkOpacity,
}: WaffleMarksProps) => {
	const { cellSize, position } = layout;
	const half = cellSize / 2;
	const shapesEditable = !!wpEditorFunctions?.shapes?.onClick;
	const editorPointerStyle: CSSProperties = {
		cursor: shapesEditable ? 'pointer' : 'default',
		pointerEvents: shapesEditable ? 'all' : undefined,
	};

	return (
		<>
			{cells.map((cell, index) => {
				const isFilled = cell.categoryIndex >= 0 && cell.categoryKey;
				const rowKey = isFilled ? cell.categoryKey! : '';
				const dataPoint =
					(isFilled && dataByCategory.get(rowKey)) || ({ x: rowKey, [categoryKey]: 0 } as FlatData);
				const defaultColor = isFilled ? colorScale(rowKey) : emptyFill;
				const groupValue = dataRender ? getGroupValue(dataPoint, dataRender) : null;
				const shapeStyleKey = isFilled
					? generateElementKey(dataPoint.x, categoryKey, groupValue)
					: `empty::${cell.col}-${cell.row}`;
				const paint = resolveShapePaint(customStyles?.[shapeStyleKey], {
					fill: defaultColor,
					opacity: 1,
				});
				const opacity =
					(paint.opacity ?? 1) * (isFilled && siblingMarkOpacity ? siblingMarkOpacity(rowKey) : 1);
				const { x, y } = position(cell.col, cell.row);
				const cellKey = `waffle-cell-${cell.col}-${cell.row}`;

				const sharedHandlers = {
					className: cellShape === 'circle' ? 'visx-circle' : 'visx-bar',
					style: editorPointerStyle,
					fill: paint.fill,
					opacity,
					onMouseLeave: tooltipActive ? onCellMouseLeave : undefined,
					onMouseMove: tooltipActive
						? (event: MouseEvent<Element>) => onCellMouseMove?.(event, dataPoint, categoryKey)
						: undefined,
					onClick: shapesEditable
						? (event: MouseEvent<Element>) => {
								if (!isFilled) {
									return;
								}
								wpEditorFunctions!.shapes!.onClick(
									dataPoint,
									categoryKey,
									defaultColor,
									event.currentTarget,
									groupValue
								);
							}
						: undefined,
				};

				if (cellShape === 'circle') {
					return <circle key={cellKey} cx={x + half} cy={y + half} r={half} {...sharedHandlers} />;
				}

				return (
					<rect
						key={cellKey}
						x={x}
						y={y}
						width={cellSize}
						height={cellSize}
						rx={cellRadius}
						ry={cellRadius}
						{...sharedHandlers}
					/>
				);
			})}
		</>
	);
};

export default WaffleMarks;
