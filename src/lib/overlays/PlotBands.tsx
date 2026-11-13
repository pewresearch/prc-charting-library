import { useContext, useEffect, useId, useRef, useState } from 'react';
import type { PlotBands as PlotBandsType } from '@prc/charting-utilities';
import {
	DEFAULT_FONT_FAMILY,
	isHatchingPattern,
	DataContext,
	wrapRichText,
	contrastLabelFillForLightDark,
	readPlotBandLabelRotation,
} from '@prc/charting-utilities';
import type { DraggableData, DraggableEvent } from 'react-draggable';
import { DraggableCore } from 'react-draggable';
import { PatternDef } from '../primitives/PatternDef';
import { RichTextSpans } from '../primitives/RichText';

type PlotBandsProps = {
	plotBands: PlotBandsType;
	independentScale: any;
	innerHeight: number;
};

const dominantBaselineFromAnchor = (verticalAnchor?: string): 'middle' | 'hanging' | 'auto' => {
	if (verticalAnchor === 'middle') return 'middle';
	if (verticalAnchor === 'end') return 'hanging';
	return 'auto';
};

const roundOffset = (value: number) => Math.round(value * 10) / 10;

/** Saved dx/dy are numbers. Older presets stored some of them as strings. */
function readOffset(value: unknown): number {
	const n = typeof value === 'number' ? value : Number(value);
	return Number.isFinite(n) ? n : 0;
}

function labelRotateTransform(labelStyle: LabelStyle, textX: number, textY: number): string | undefined {
	const rotation = readPlotBandLabelRotation(labelStyle);
	if (rotation === 0) {
		return undefined;
	}
	return `rotate(${rotation}, ${textX}, ${textY})`;
}

type LabelStyle = PlotBandsType['bands'][number]['style']['label'];

/**
 * Plot band label. In the editor it drags like an annotation and a click
 * that did not move opens the label popover.
 */
function PlotBandLabel({
	index,
	label,
	labelStyle,
	baseX,
	innerHeight,
}: {
	index: number;
	label: string | null | undefined;
	labelStyle: LabelStyle;
	baseX: number;
	innerHeight: number;
}) {
	const context = useContext(DataContext);
	const labelApi = context?.wpEditorFunctions?.plotBandLabels;
	const labelDx = readOffset(labelStyle.dx);
	const labelDy = readOffset(labelStyle.dy);
	const textX = baseX + labelDx;
	const textY = labelStyle.align === 'top' ? labelDy : innerHeight - labelDy;
	const [offset, setOffset] = useState({ x: 0, y: 0 });
	const offsetRef = useRef(offset);
	const isDraggingRef = useRef(false);
	// Stays true through the click that follows mouseup, same as annotations.
	const hasDraggedRef = useRef(false);
	const dragRef = useRef<SVGGElement>(null);

	useEffect(() => {
		if (isDraggingRef.current) return;
		offsetRef.current = { x: 0, y: 0 };
		setOffset({ x: 0, y: 0 });
	}, [textX, textY]);

	const fontSize = labelStyle.fontSize ?? 10;
	const fontFamily = labelStyle.fontFamily?.trim() ? labelStyle.fontFamily : DEFAULT_FONT_FAMILY;
	const lines = wrapRichText(
		label ?? '',
		labelStyle.maxWidth ?? 0,
		fontSize,
		fontFamily,
		labelStyle.fontWeight ?? 'normal',
		labelStyle.fontStyle ?? 'normal'
	);
	const lineHeight = fontSize * 1.2;
	const isDraggable = Boolean(labelApi && label);
	const clickable = Boolean(labelApi?.onClick && label);

	const handleDrag = (_event: DraggableEvent, data: DraggableData) => {
		if (data.deltaX === 0 && data.deltaY === 0) {
			return;
		}
		if (!hasDraggedRef.current) {
			labelApi?.onDragActivate?.(String(index));
		}
		hasDraggedRef.current = true;
		const next = {
			x: offsetRef.current.x + data.deltaX,
			y: offsetRef.current.y + data.deltaY,
		};
		offsetRef.current = next;
		setOffset(next);
	};

	const handleDragStart = () => {
		hasDraggedRef.current = false;
		isDraggingRef.current = true;
		labelApi?.onDragStart?.(String(index));
	};

	const handleDragStop = () => {
		const { x: dragX, y: dragY } = offsetRef.current;
		isDraggingRef.current = false;
		// Drop the live translate in this same turn. The saved dx/dy already
		// include the delta, so leaving the translate on paints the move twice.
		offsetRef.current = { x: 0, y: 0 };
		setOffset({ x: 0, y: 0 });
		if (dragX === 0 && dragY === 0) {
			labelApi?.onDragCancel?.(String(index));
			return;
		}
		const dx = roundOffset(labelDx + dragX);
		const dy = roundOffset(labelStyle.align === 'top' ? labelDy + dragY : labelDy - dragY);
		labelApi?.onDragEnd?.(String(index), dx, dy);
	};

	let cursor: string | undefined;
	if (isDraggable) {
		cursor = 'grab';
	} else if (clickable) {
		cursor = 'pointer';
	}

	const text = (
		<g ref={dragRef} transform={`translate(${offset.x}, ${offset.y})`}>
			<text
				x={textX}
				y={textY}
				fill={labelStyle.fill}
				fontSize={fontSize}
				fontFamily={fontFamily}
				fontWeight={
					labelStyle.fontWeight && labelStyle.fontWeight !== 'normal' ? labelStyle.fontWeight : undefined
				}
				fontStyle={labelStyle.fontStyle === 'italic' ? 'italic' : undefined}
				textAnchor={labelStyle.textAnchor}
				dominantBaseline={
					labelStyle.verticalAnchor && labelStyle.verticalAnchor !== 'start'
						? dominantBaselineFromAnchor(labelStyle.verticalAnchor)
						: undefined
				}
				opacity={labelStyle.opacity !== undefined && labelStyle.opacity !== 1 ? labelStyle.opacity : undefined}
				{...(labelStyle.textOutline && {
					stroke: contrastLabelFillForLightDark(labelStyle.fill),
					strokeWidth: 1,
					paintOrder: 'stroke',
				})}
				transform={labelRotateTransform(labelStyle, textX, textY)}
				style={{
					cursor,
					userSelect: isDraggable || clickable ? 'none' : undefined,
					pointerEvents: isDraggable || clickable ? 'all' : undefined,
				}}
				onClick={(event) => {
					if (hasDraggedRef.current) {
						hasDraggedRef.current = false;
						return;
					}
					if (!labelApi?.onClick || !label) return;
					event.stopPropagation();
					labelApi.onClick(String(index), event.currentTarget);
				}}
			>
				{lines.map((lineRuns, lineIndex) => (
					<tspan key={lineIndex} x={textX} dy={lineIndex === 0 ? 0 : lineHeight}>
						<RichTextSpans runs={lineRuns} />
					</tspan>
				))}
			</text>
		</g>
	);

	if (!isDraggable) {
		return text;
	}

	return (
		<DraggableCore
			nodeRef={dragRef as unknown as React.RefObject<HTMLElement>}
			onDrag={handleDrag}
			onStart={handleDragStart}
			onStop={handleDragStop}
		>
			{text}
		</DraggableCore>
	);
}

export const PlotBands = ({ plotBands, independentScale, innerHeight }: PlotBandsProps) => {
	const instanceId = useId().replace(/:/g, '');

	return (
		<>
			{plotBands.bands.map((band, i: number) => {
				const { x, style, label } = band;
				const { band: bandStyle, label: labelStyle } = style;
				const hatch = isHatchingPattern(bandStyle.pattern) ? bandStyle.pattern : undefined;
				const hatchId = hatch ? `plot-band-pattern-${i}-${instanceId}` : undefined;
				const baseX = independentScale(new Date(x[0]));

				return (
					<g key={`plot-band-${i}`}>
						{hatch && hatchId && <PatternDef id={hatchId} pattern={hatch} fill={bandStyle.fill} />}
						<rect
							fill={hatchId ? `url(#${hatchId})` : bandStyle.fill}
							fillOpacity={bandStyle.fillOpacity}
							x={baseX}
							width={independentScale(new Date(x[1])) - baseX}
							height={innerHeight}
						/>
						<PlotBandLabel
							index={i}
							label={label}
							labelStyle={labelStyle}
							baseX={baseX}
							innerHeight={innerHeight}
						/>
					</g>
				);
			})}
		</>
	);
};
