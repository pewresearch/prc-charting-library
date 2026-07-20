import { createContext, useContext, useState, useEffect, useRef, useMemo } from 'react';
import { DraggableCore } from 'react-draggable';
import type { DraggableData, DraggableEvent } from 'react-draggable';
import {
	BaseConfig,
	TableData,
	Legend,
	decodeHtmlEntities,
	DataContext,
	DEFAULT_FONT_FAMILY,
} from '@prc/charting-utilities';

export type LegendPositioningContext = 'chart' | 'inner';

export type LegendScaleContextValue = {
	widthRatio: number;
	heightRatio: number;
	layoutWidth: number;
	layoutHeight: number;
	chartWidth: number;
	chartHeight: number;
	innerWidthRatio: number;
	innerHeightRatio: number;
	innerLayoutWidth: number;
	innerLayoutHeight: number;
	paddingLeft: number;
	paddingTop: number;
};

export type LegendPositioningScale = {
	widthRatio: number;
	heightRatio: number;
	originX: number;
	originY: number;
};

export const LegendScaleContext = createContext<LegendScaleContextValue>({
	widthRatio: 1,
	heightRatio: 1,
	layoutWidth: 1,
	layoutHeight: 1,
	chartWidth: 1,
	chartHeight: 1,
	innerWidthRatio: 1,
	innerHeightRatio: 1,
	innerLayoutWidth: 1,
	innerLayoutHeight: 1,
	paddingLeft: 0,
	paddingTop: 0,
});

/** Resolve the scale + origin for a detached legend item's positioning context. */
export function getLegendPositioningScale(
	context: LegendPositioningContext,
	legendScale: LegendScaleContextValue
): LegendPositioningScale {
	if (context === 'inner') {
		return {
			widthRatio: legendScale.innerWidthRatio,
			heightRatio: legendScale.innerHeightRatio,
			originX: legendScale.paddingLeft,
			originY: legendScale.paddingTop,
		};
	}

	return {
		widthRatio: legendScale.widthRatio,
		heightRatio: legendScale.heightRatio,
		originX: 0,
		originY: 0,
	};
}

/** Convert layout-space legend coordinates to display pixels (matches annotation scaling). */
export function scaleLegendPositionToDisplay(
	x: number,
	y: number,
	scale: LegendPositioningScale
): { x: number; y: number } {
	return {
		x: scale.originX + x * scale.widthRatio,
		y: scale.originY + y * scale.heightRatio,
	};
}

/** Convert display pixels back to layout-space legend coordinates for persistence. */
export function scaleLegendPositionToLayout(
	x: number,
	y: number,
	scale: LegendPositioningScale
): { x: number; y: number } {
	return {
		x: scale.widthRatio > 0 ? (x - scale.originX) / scale.widthRatio : x - scale.originX,
		y: scale.heightRatio > 0 ? (y - scale.originY) / scale.heightRatio : y - scale.originY,
	};
}

type LegendProps = {
	children: React.ReactNode;
	legend: Legend;
	layoutWidth?: number;
	layoutHeight?: number;
	chartWidth?: number;
	chartHeight?: number;
};

export const StyledLegend = ({ children, legend, chartWidth, chartHeight, layoutWidth, layoutHeight }: LegendProps) => {
	const { offsetX, offsetY, title, alignment, fontSize, fontWeight, variation } = legend;

	const context = useContext(
		DataContext as React.Context<{
			data: any;
			config: BaseConfig;
			tableData: TableData;
			wpEditorFunctions?: any;
		}>
	);
	const wpEditorFunctions = context?.wpEditorFunctions;
	const layout = context?.config?.layout;
	const legendFontFamily = legend.fontFamily?.trim() || DEFAULT_FONT_FAMILY;

	const resolvedLayoutWidth = layoutWidth ?? layout?.width ?? 1;
	const resolvedLayoutHeight = layoutHeight ?? layout?.height ?? 1;
	const resolvedChartWidth = chartWidth ?? resolvedLayoutWidth;
	const resolvedChartHeight = chartHeight ?? resolvedLayoutHeight;

	// Calculate ratios directly from props (parent handles responsiveness via useSize).
	const widthRatio = resolvedLayoutWidth > 0 ? resolvedChartWidth / resolvedLayoutWidth : 1;
	const heightRatio = resolvedLayoutHeight > 0 ? resolvedChartHeight / resolvedLayoutHeight : 1;

	const paddingLeft = layout?.padding?.left ?? 0;
	const paddingTop = layout?.padding?.top ?? 0;
	const paddingRight = layout?.padding?.right ?? 0;
	const paddingBottom = layout?.padding?.bottom ?? 0;
	const horizPadding = paddingLeft + paddingRight;
	const vertPadding = paddingTop + paddingBottom;
	const innerLayoutWidth = Math.max(0, resolvedLayoutWidth - horizPadding);
	const innerLayoutHeight = Math.max(0, resolvedLayoutHeight - vertPadding);
	const innerChartWidth = Math.max(0, resolvedChartWidth - horizPadding);
	const innerChartHeight = Math.max(0, resolvedChartHeight - vertPadding);
	const innerWidthRatio = innerLayoutWidth > 0 ? innerChartWidth / innerLayoutWidth : 1;
	const innerHeightRatio = innerLayoutHeight > 0 ? innerChartHeight / innerLayoutHeight : 1;

	const legendScale = useMemo(
		() => ({
			widthRatio,
			heightRatio,
			layoutWidth: resolvedLayoutWidth,
			layoutHeight: resolvedLayoutHeight,
			chartWidth: resolvedChartWidth,
			chartHeight: resolvedChartHeight,
			innerWidthRatio,
			innerHeightRatio,
			innerLayoutWidth,
			innerLayoutHeight,
			paddingLeft,
			paddingTop,
		}),
		[
			widthRatio,
			heightRatio,
			resolvedLayoutWidth,
			resolvedLayoutHeight,
			resolvedChartWidth,
			resolvedChartHeight,
			innerWidthRatio,
			innerHeightRatio,
			innerLayoutWidth,
			innerLayoutHeight,
			paddingLeft,
			paddingTop,
		]
	);

	// Track position during drag (grouped mode only; harmless in detached mode).
	const [position, setPosition] = useState({ x: offsetX, y: offsetY });
	const [isDragging, setIsDragging] = useState(false);
	// react-draggable needs an explicit nodeRef under React 19 (findDOMNode was removed).
	const dragRef = useRef<HTMLDivElement>(null);

	// Update position when legend config changes
	useEffect(() => {
		setPosition({ x: offsetX, y: offsetY });
	}, [offsetX, offsetY]);

	// Detached variation: skip all chrome and whole-legend drag. Render as a transparent
	// full-chart overlay so detached items have a predictable positioning context (the
	// chart's outer wrapper, which is already position: relative). Per-item drag is
	// handled inside <ClickableLegend> via wpEditorFunctions.legendItems.onItemDrag*.
	if (variation === 'detached') {
		return (
			<LegendScaleContext.Provider value={legendScale}>
				<div
					style={{
						position: 'absolute',
						inset: 0,
						width: '100%',
						height: '100%',
						pointerEvents: 'none',
						fontSize: `${fontSize}px`,
						fontWeight: fontWeight || undefined,
						fontFamily: legendFontFamily,
					}}
				>
					{children}
				</div>
			</LegendScaleContext.Provider>
		);
	}

	// Determine if draggable
	const isDraggable = !!wpEditorFunctions?.legend;

	// Handle drag events
	const handleDrag = (e: DraggableEvent, data: DraggableData) => {
		const newX = position.x + data.deltaX;
		const newY = position.y + data.deltaY;

		setPosition({ x: newX, y: newY });

		if (wpEditorFunctions?.legend?.onDrag) {
			wpEditorFunctions.legend.onDrag(newX, newY, true);
		}
	};

	const handleDragStart = () => {
		setIsDragging(true);
		if (wpEditorFunctions?.legend?.onDragStart) {
			wpEditorFunctions.legend.onDragStart();
		}
	};

	const handleDragStop = () => {
		setIsDragging(false);
		if (wpEditorFunctions?.legend?.onDragEnd) {
			wpEditorFunctions.legend.onDragEnd(position.x, position.y);
		}
	};

	// Use current drag position or original position
	const currentX = position.x;
	const currentY = position.y;

	const legendContent = (
		<div
			ref={dragRef}
			style={{
				position: 'absolute',
				top: currentY / 2 - 10,
				left: currentX * widthRatio,
				width: alignment === 'none' ? 'auto' : '100%',
				display: alignment === 'none' ? 'block' : 'flex',
				justifyContent: alignment,
				fontSize: `${fontSize}px`,
				fontWeight: fontWeight || undefined,
				fontFamily: legendFontFamily,
				pointerEvents: 'none',
			}}
		>
			<div
				className="cb__legend__inner"
				style={{
					display: 'flex',
					flexDirection: 'column',
					alignItems: 'center',
					backgroundColor: legend.fill || 'transparent',
					border: legend.borderStroke ? `1px solid ${legend.borderStroke || 'transparent'}` : 'none',
					padding: '10px',
					pointerEvents: 'auto',
					cursor: isDraggable ? (isDragging ? 'grabbing' : 'grab') : 'default',
					boxShadow: isDragging ? '0 4px 12px rgba(0,0,0,0.3)' : 'none',
					userSelect: 'none',
				}}
			>
				{title && (
					<div
						className="cb__legend__title"
						style={{
							fontSize: `${fontSize}px`,
							fontWeight: 400,
							marginBottom: '10px',
						}}
					>
						{decodeHtmlEntities(title)}
					</div>
				)}
				{children}
				{isDragging && (
					<div
						style={{
							marginTop: '8px',
							fontSize: '9px',
							color: '#666',
							textAlign: 'center',
							fontFamily: legendFontFamily,
						}}
					>
						X: {currentX.toFixed(0)} | Y: {currentY.toFixed(0)}
					</div>
				)}
			</div>
		</div>
	);

	// Wrap with DraggableCore if in editor.
	// `cancel` prevents drag initiation on legend items so their onClick fires normally.
	if (isDraggable) {
		return (
			<DraggableCore
				nodeRef={dragRef}
				onDrag={handleDrag}
				onStart={handleDragStart}
				onStop={handleDragStop}
				cancel=".visx-legend-item"
			>
				{legendContent}
			</DraggableCore>
		);
	}

	return legendContent;
};
