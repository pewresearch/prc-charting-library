import { useContext, useEffect, useRef, useState } from 'react';
import { Group } from '@visx/group';
import type { DraggableData, DraggableEvent } from 'react-draggable';
import { DraggableCore } from 'react-draggable';
import type { BaseConfig, TableData } from '@prc/charting-utilities';
import {
	contrastLabelFillForLightDark,
	DataContext,
	decodeHtmlEntities,
	DEFAULT_FONT_FAMILY,
} from '@prc/charting-utilities';
import { wordWrap } from '../../labels';
import {
	scalePositionToDisplay,
	scalePositionToLayout,
	type PositioningScale,
} from '../../overlays/getPositioningScale';

export type PanelTitleCustomization = {
	text?: string;
	offsetX?: number;
	offsetY?: number;
	color?: string;
	fontSize?: number | string;
	fontWeight?: number | string;
	fontStyle?: string;
	fontFamily?: string;
	maxWidth?: number;
	lineHeight?: number | string;
	textAlign?: string;
	letterSpacing?: number | string;
	textOutline?: boolean;
};

type PanelTitleLabelProps = {
	panelKey: string;
	defaultLabel: string;
	/**
	 * Shared positioning scale for this panel cell.
	 * Caller should zero originX/Y when the label is already inside the panel Group.
	 */
	positioningScale: PositioningScale;
	fontSize: number;
	fontWeight: number | string;
	fontFamily: string;
	fill: string;
	textAlign?: string;
	customization?: PanelTitleCustomization;
};

function toPxFontSize(value: number | string | undefined, fallback: number): number {
	if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
		return value;
	}
	if (typeof value === 'string' && value.length > 0) {
		const n = Number(value);
		if (Number.isFinite(n) && n > 0) {
			return n;
		}
	}
	return fallback;
}

function textAnchorFromAlign(textAlign?: string): 'start' | 'middle' | 'end' {
	if (textAlign === 'center') {
		return 'middle';
	}
	if (textAlign === 'right') {
		return 'end';
	}
	return 'start';
}

function textXFromAlign(textAlign: string | undefined, panelWidth: number): number {
	if (textAlign === 'center') {
		return panelWidth / 2;
	}
	if (textAlign === 'right') {
		return panelWidth;
	}
	return 0;
}

function resolveTextAlign(customization: PanelTitleCustomization | undefined, textAlign?: string): string {
	if (customization?.textAlign !== undefined && customization.textAlign !== '') {
		return customization.textAlign;
	}
	return textAlign || 'center';
}

/**
 * Column/group name above a small-multiples panel.
 * SVG text + drag (annotation model), offsets via shared getPositioningScale.
 */
export function PanelTitleLabel({
	panelKey,
	defaultLabel,
	positioningScale,
	fontSize,
	fontWeight,
	fontFamily,
	fill,
	textAlign,
	customization,
}: PanelTitleLabelProps) {
	const { wpEditorFunctions } = useContext(
		DataContext as React.Context<{
			data: any;
			config: BaseConfig;
			tableData: TableData;
			wpEditorFunctions?: any;
		}>
	);

	const handlers = wpEditorFunctions?.panelTitles;
	const isDraggable = !!handlers?.onItemDragEnd;

	const layoutOffsetX = Number(customization?.offsetX) || 0;
	const layoutOffsetY = Number(customization?.offsetY) || 0;
	const display = scalePositionToDisplay(layoutOffsetX, layoutOffsetY, positioningScale);

	const [dragPosition, setDragPosition] = useState(display);
	const dragPositionRef = useRef(dragPosition);
	const isDraggingRef = useRef(false);
	const hasDraggedRef = useRef(false);
	const dragRef = useRef<SVGGElement>(null);

	useEffect(() => {
		if (isDraggingRef.current) return;
		dragPositionRef.current = display;
		setDragPosition(display);
	}, [display.x, display.y]);

	const displayText =
		typeof customization?.text === 'string' && customization.text.length > 0 ? customization.text : defaultLabel;

	const resolvedFontSize = toPxFontSize(customization?.fontSize, fontSize);
	const resolvedFontFamily =
		(typeof customization?.fontFamily === 'string' && customization.fontFamily.trim()
			? customization.fontFamily
			: null) ||
		fontFamily ||
		DEFAULT_FONT_FAMILY;
	const resolvedColor = customization?.color || fill;
	const resolvedFontWeight = customization?.fontWeight || fontWeight;
	const resolvedFontStyle =
		customization?.fontStyle === 'italic' || customization?.fontStyle === 'oblique'
			? customization.fontStyle
			: customization?.fontStyle === 'normal'
				? 'normal'
				: undefined;
	const textDecoration =
		customization?.fontStyle === 'underline'
			? 'underline'
			: customization?.fontStyle === 'strikethrough'
				? 'line-through'
				: undefined;

	const maxWidth =
		typeof customization?.maxWidth === 'number' && customization.maxWidth > 0 ? customization.maxWidth : 0;
	const lines = maxWidth ? wordWrap(displayText, maxWidth, resolvedFontSize, resolvedFontFamily) : [displayText];
	const lineHeightMultiplier =
		typeof customization?.lineHeight === 'number' && customization.lineHeight > 0
			? customization.lineHeight
			: typeof customization?.lineHeight === 'string' && customization.lineHeight !== ''
				? Number(customization.lineHeight) || 1.2
				: 1.2;
	const lineHeight = resolvedFontSize * lineHeightMultiplier;
	const resolvedTextAlign = resolveTextAlign(customization, textAlign);
	const textAnchor = textAnchorFromAlign(resolvedTextAlign);
	const textX = textXFromAlign(resolvedTextAlign, positioningScale.displayWidth);
	const letterSpacing =
		customization?.letterSpacing !== undefined &&
		customization?.letterSpacing !== null &&
		customization?.letterSpacing !== ''
			? Number(customization.letterSpacing)
			: undefined;

	const handleDrag = (_event: DraggableEvent, data: DraggableData) => {
		hasDraggedRef.current = true;
		const next = {
			x: dragPositionRef.current.x + data.deltaX,
			y: dragPositionRef.current.y + data.deltaY,
		};
		dragPositionRef.current = next;
		setDragPosition(next);
	};

	const handleDragStart = () => {
		hasDraggedRef.current = false;
		isDraggingRef.current = true;
		handlers?.onItemDragStart?.(panelKey);
	};

	const handleDragStop = () => {
		const layoutPos = scalePositionToLayout(dragPositionRef.current.x, dragPositionRef.current.y, positioningScale);
		isDraggingRef.current = false;
		handlers?.onItemDragEnd?.(panelKey, Math.round(layoutPos.x), Math.round(layoutPos.y));
	};

	const textElement = (
		<text
			x={textX}
			y={resolvedFontSize}
			fontSize={resolvedFontSize}
			fontFamily={resolvedFontFamily}
			fontWeight={resolvedFontWeight}
			fontStyle={resolvedFontStyle}
			textDecoration={textDecoration}
			letterSpacing={letterSpacing}
			fill={resolvedColor}
			textAnchor={textAnchor}
			{...(customization?.textOutline && {
				stroke: contrastLabelFillForLightDark(resolvedColor),
				strokeWidth: 1,
				paintOrder: 'stroke' as const,
			})}
			style={{
				cursor: isDraggable ? 'grab' : handlers?.onClick ? 'pointer' : 'default',
				userSelect: 'none',
				pointerEvents: 'all',
			}}
			onClick={(event: React.MouseEvent<SVGTextElement>) => {
				if (hasDraggedRef.current) {
					hasDraggedRef.current = false;
					return;
				}
				handlers?.onClick?.(panelKey, defaultLabel, event.currentTarget);
			}}
		>
			{lines.map((line, lineIndex) => (
				<tspan key={lineIndex} x={textX} dy={lineIndex === 0 ? 0 : lineHeight}>
					{decodeHtmlEntities(line)}
				</tspan>
			))}
		</text>
	);

	const groupContent = (
		<Group
			innerRef={dragRef}
			transform={`translate(${dragPosition.x}, ${dragPosition.y})`}
			className="cb__small-multiples__panel-title"
			data-panel-key={panelKey}
		>
			{textElement}
		</Group>
	);

	if (!isDraggable) {
		return groupContent;
	}

	return (
		<DraggableCore
			nodeRef={dragRef as unknown as React.RefObject<HTMLElement>}
			onDrag={handleDrag}
			onStart={handleDragStart}
			onStop={handleDragStop}
		>
			{groupContent}
		</DraggableCore>
	);
}
