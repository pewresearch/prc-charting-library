import type { LegendItemCustomization } from '@prc/charting-utilities';
import {
	DataContext,
	LABEL_OUTLINE_COLOR,
	DEFAULT_FONT_FAMILY,
	dominantBaselineFromVerticalAnchor,
	getDirectLabelOffsetFromCustom,
	hasAuthorDirectLabelOverride,
	resolveLegendTextAnchor,
	useDragGesture,
	wrapRichText,
} from '@prc/charting-utilities';
import { Group } from '@visx/group';
import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { DraggableData, DraggableEvent } from 'react-draggable';
import { DraggableCore } from 'react-draggable';
import { RichTextSpans } from '../primitives/RichText';

export interface OnLineSeriesLabelProps {
	anchorX: number;
	anchorY: number;
	category: string;
	displayText: string;
	defaultDx?: number;
	defaultDy?: number;
	customEntry?: LegendItemCustomization;
	seriesColor: string;
	fontSize?: number;
	fontWeight?: string;
	fontFamily?: string;
	fontStyle?: string;
	maxWidth?: number;
	paddingLeft: number;
	paddingTop: number;
	chartInnerWidth?: number;
	chartInnerHeight?: number;
	labelScales?: { scaleX?: number; scaleY?: number };
	/** When true, halo is rendered (direct mode defaults on). */
	textOutline?: boolean;
}

export function OnLineSeriesLabel({
	anchorX,
	anchorY,
	category,
	displayText,
	defaultDx = 0,
	defaultDy = 0,
	customEntry,
	seriesColor,
	fontSize = 12,
	fontWeight = 'normal',
	fontFamily = DEFAULT_FONT_FAMILY,
	fontStyle = 'normal',
	maxWidth = 0,
	paddingLeft,
	paddingTop,
	chartInnerWidth,
	chartInnerHeight,
	labelScales,
	textOutline = true,
}: OnLineSeriesLabelProps) {
	const context = useContext(DataContext);
	const wpEditorFunctions = context?.wpEditorFunctions;
	const config = context?.config;
	const legendItemHandlers = wpEditorFunctions?.legendItems;
	const isEditor = !!legendItemHandlers?.onItemDragEnd;

	const referenceInnerWidth = config
		? config.layout.width - config.layout.padding.left - config.layout.padding.right
		: chartInnerWidth || 0;
	const referenceInnerHeight = config
		? config.layout.height - config.layout.padding.top - config.layout.padding.bottom
		: chartInnerHeight || 0;

	const scaleX =
		labelScales?.scaleX ?? (chartInnerWidth && referenceInnerWidth ? chartInnerWidth / referenceInnerWidth : 1);
	const scaleY =
		labelScales?.scaleY ?? (chartInnerHeight && referenceInnerHeight ? chartInnerHeight / referenceInnerHeight : 1);
	const scales = useMemo(() => ({ scaleX, scaleY }), [scaleX, scaleY]);

	const dragRef = useRef<SVGGElement>(null);
	const textRef = useRef<SVGTextElement>(null);
	const gesture = useDragGesture();

	const authorOffset = useMemo(
		() =>
			getDirectLabelOffsetFromCustom(
				customEntry,
				anchorX,
				anchorY,
				{ left: paddingLeft, top: paddingTop },
				scales
			),
		[customEntry, anchorX, anchorY, paddingLeft, paddingTop, scales]
	);

	const resolvedDefaultDx = hasAuthorDirectLabelOverride(customEntry) ? authorOffset.dx : defaultDx;
	const resolvedDefaultDy = hasAuthorDirectLabelOverride(customEntry) ? authorOffset.dy : defaultDy;

	const [position, setPosition] = useState({ dx: resolvedDefaultDx, dy: resolvedDefaultDy });
	const [isDragging, setIsDragging] = useState(false);
	const positionRef = useRef({ dx: resolvedDefaultDx, dy: resolvedDefaultDy });

	useEffect(() => {
		if (gesture.isActive()) {
			return;
		}
		const next = { dx: resolvedDefaultDx, dy: resolvedDefaultDy };
		setPosition(next);
		positionRef.current = next;
	}, [gesture, resolvedDefaultDx, resolvedDefaultDy, scaleX, scaleY]);

	useEffect(() => {
		positionRef.current = position;
	}, [position]);

	const effectiveFontSize = customEntry?.fontSize ?? fontSize;
	const effectiveFontWeight = customEntry?.fontWeight ?? fontWeight;
	const effectiveFontFamily = customEntry?.fontFamily ?? fontFamily;
	const effectiveFontStyle = customEntry?.fontStyle ?? fontStyle;
	const effectiveMaxWidth = customEntry?.maxWidth ?? maxWidth;
	const fillColor = isDragging ? '#4A90E2' : (customEntry?.color ?? seriesColor);
	const showOutline = customEntry?.textOutline !== undefined ? customEntry.textOutline : textOutline;

	const textLines = useMemo(
		() =>
			wrapRichText(
				displayText,
				effectiveMaxWidth,
				effectiveFontSize,
				effectiveFontFamily,
				effectiveFontWeight,
				effectiveFontStyle
			),
		[
			displayText,
			effectiveMaxWidth,
			effectiveFontSize,
			effectiveFontFamily,
			effectiveFontWeight,
			effectiveFontStyle,
		]
	);

	const lineHeight = effectiveFontSize * (customEntry?.lineHeight || 1.2);
	const textAnchor = resolveLegendTextAnchor(customEntry) ?? 'middle';
	const dominantBaseline = customEntry?.verticalAnchor
		? dominantBaselineFromVerticalAnchor(customEntry.verticalAnchor)
		: 'middle';

	let cursor: 'default' | 'grab' | 'grabbing' = 'default';
	if (isEditor) {
		cursor = isDragging ? 'grabbing' : 'grab';
	}

	const handleClick = useCallback(
		(e: React.MouseEvent<SVGTextElement>) => {
			if (gesture.consumeClick()) {
				return;
			}
			if (legendItemHandlers?.onClick) {
				e.stopPropagation();
				legendItemHandlers.onClick(category, displayText, textRef.current);
			}
		},
		[gesture, legendItemHandlers, category, displayText]
	);

	const handleDragStart = () => {
		gesture.press();
		setIsDragging(true);
		legendItemHandlers?.onItemDragStart?.(category);
	};

	const handleDrag = (_e: DraggableEvent, data: DraggableData) => {
		if (gesture.move(data.deltaX, data.deltaY) === 'ignored') {
			return;
		}
		const next = {
			dx: positionRef.current.dx + data.deltaX,
			dy: positionRef.current.dy + data.deltaY,
		};
		positionRef.current = next;
		setPosition(next);
	};

	const handleDragStop = () => {
		gesture.release();
		setIsDragging(false);
		const { dx, dy } = positionRef.current;
		const containerX = paddingLeft + anchorX + dx;
		const containerY = paddingTop + anchorY + dy;
		const referenceContainerX = paddingLeft + (containerX - paddingLeft) / scaleX;
		const referenceContainerY = paddingTop + (containerY - paddingTop) / scaleY;
		legendItemHandlers?.onItemDragEnd?.(category, referenceContainerX, referenceContainerY);
	};

	const textElement = (
		<text
			ref={textRef}
			x={0}
			y={0}
			fill={fillColor}
			fontSize={effectiveFontSize}
			fontWeight={effectiveFontWeight}
			fontFamily={effectiveFontFamily}
			fontStyle={effectiveFontStyle}
			textAnchor={textAnchor}
			dominantBaseline={dominantBaseline}
			letterSpacing={customEntry?.letterSpacing}
			{...(showOutline && {
				stroke: LABEL_OUTLINE_COLOR,
				strokeWidth: 2,
				paintOrder: 'stroke',
			})}
			onClick={handleClick}
			style={{
				cursor,
				...(typeof customEntry?.opacity === 'number' ? { opacity: customEntry.opacity } : {}),
				userSelect: 'none',
				pointerEvents: isEditor ? 'all' : 'none',
			}}
		>
			{textLines.length === 1 ? (
				<RichTextSpans runs={textLines[0]} />
			) : (
				textLines.map((line, index) => (
					<tspan key={index} x={0} dy={index === 0 ? 0 : lineHeight}>
						<RichTextSpans runs={line} />
					</tspan>
				))
			)}
		</text>
	);

	const translation = `translate(${anchorX + position.dx}, ${anchorY + position.dy})`;
	const rotation = customEntry?.rotation ? ` rotate(${customEntry.rotation})` : '';
	const groupContent = (
		<Group innerRef={dragRef} transform={`${translation}${rotation}`}>
			{textElement}
		</Group>
	);

	if (!isEditor) {
		return groupContent;
	}

	return (
		<DraggableCore
			nodeRef={dragRef as unknown as React.RefObject<HTMLElement>}
			onStart={handleDragStart}
			onDrag={handleDrag}
			onStop={handleDragStop}
		>
			{groupContent}
		</DraggableCore>
	);
}
