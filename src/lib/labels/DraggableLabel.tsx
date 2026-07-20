import type { BaseConfig, FlatData, TableData } from '@prc/charting-utilities';
import {
	DataContext,
	getCustomLabelStyle,
	getLabelOutlineStroke,
	isLabelVisible,
	resolveTextOutlineMode,
	DEFAULT_FONT_FAMILY,
} from '@prc/charting-utilities';
import { Group } from '@visx/group';
import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { DraggableData, DraggableEvent } from 'react-draggable';
import { DraggableCore } from 'react-draggable';

import type { MeasureLabelBBoxOptions } from '@prc/charting-utilities';
import { wordWrap } from '@prc/charting-utilities';
import { LabelLeaderLineRegistrar } from './leader-line/LabelLeaderLineRegistrar';

export { wordWrap };

export interface DraggableLabelLeaderLineOptions {
	enabled: boolean;
	/** Data-point anchor in chart coordinates (defaults to `x` / `y`). */
	anchorX?: number;
	anchorY?: number;
	anchorRadius?: number;
	stroke?: string;
	strokeWidth?: number;
	threshold?: number;
}

type DraggableLabelProps = {
	x: number;
	y: number;
	dataPoint: FlatData;
	category: string;
	defaultDx?: number;
	defaultDy?: number;
	chartInnerWidth?: number; // Actual rendered inner width for scaling
	chartInnerHeight?: number; // Actual rendered inner height for scaling
	defaultLabel?: string; // The programmatically generated label value (for popover)
	/** Max pixel width before text wraps. Falls back to customStyle.maxWidth if set per-datum. */
	maxWidth?: number;
	leaderLine?: DraggableLabelLeaderLineOptions;
	/**
	 * Explicit leader-line store key. When provided, overrides the default
	 * `label-${x}-${category}` derivation. Required for chart types (e.g.
	 * scatter) where multiple points can share the same x + category values —
	 * without it, they collide in the leader-line registry and only the last
	 * writer's connector is drawn correctly.
	 */
	labelId?: string;
	children: React.ReactNode;
	[key: string]: any; // For spreading other props like fill, fontSize, etc.
};

export const DraggableLabel = ({
	x,
	y,
	dataPoint,
	category,
	defaultDx = 0,
	defaultDy = 0,
	chartInnerWidth,
	chartInnerHeight,
	defaultLabel = '',
	maxWidth: maxWidthProp,
	leaderLine,
	labelId: labelIdProp,
	children,
	...textProps
}: DraggableLabelProps) => {
	const context = useContext(
		DataContext as React.Context<{
			data: any;
			config: BaseConfig;
			tableData: TableData;
			wpEditorFunctions?: any;
		}>
	);
	const wpEditorFunctions = context?.wpEditorFunctions;
	const config = context?.config;

	// Derive group value for unique key generation when groupBreaksActive
	const groupValue = useMemo(() => {
		const dataRender = config?.dataRender;
		if (
			dataRender?.groupBreaksActive &&
			dataRender?.groupBreaksCategory &&
			dataPoint[dataRender.groupBreaksCategory]
		) {
			return String(dataPoint[dataRender.groupBreaksCategory]);
		}
		return null;
	}, [config?.dataRender, dataPoint]);

	// Generate stable label ID for registration (includes group for uniqueness).
	// When the caller provides an explicit labelId (e.g. scatter, which encodes
	// a point index to avoid collisions among points sharing the same x +
	// category), use that instead of the default derivation.
	const labelId = useRef(
		labelIdProp ??
			(groupValue ? `label-${dataPoint.x}-${category}-${groupValue}` : `label-${dataPoint.x}-${category}`)
	).current;
	// Ref for the text element to use as popover anchor
	const textRef = useRef<SVGTextElement>(null);
	// react-draggable needs an explicit nodeRef under React 19 (findDOMNode was removed).
	// Must point at the underlying <g>, so it's passed to <Group> via innerRef.
	const dragRef = useRef<SVGGElement>(null);

	// Check visibility - if hidden and not in editor, don't render
	const visible = isLabelVisible(dataPoint, category);
	const isInEditor = !!wpEditorFunctions?.labels;

	// If label is hidden and we're not in editor mode, don't render
	if (!visible && !isInEditor) {
		return null;
	}

	// Get custom style overrides
	const customStyle = getCustomLabelStyle(dataPoint, category);

	// Calculate scale factors for responsive label positioning
	// Reference dimensions are the inner chart area from the config
	const referenceInnerWidth = config
		? config.layout.width - config.layout.padding.left - config.layout.padding.right
		: chartInnerWidth || 0;
	const referenceInnerHeight = config
		? config.layout.height - config.layout.padding.top - config.layout.padding.bottom
		: chartInnerHeight || 0;

	const scaleX = chartInnerWidth && referenceInnerWidth ? chartInnerWidth / referenceInnerWidth : 1;
	const scaleY = chartInnerHeight && referenceInnerHeight ? chartInnerHeight / referenceInnerHeight : 1;

	// Get custom position from data or use defaults
	const customPos = dataPoint.__labelPositions?.[category];
	// Apply scale factors to stored positions (which are at reference dimensions)
	const initialDx = customPos?.dx ? customPos.dx * scaleX : defaultDx;
	const initialDy = customPos?.dy ? customPos.dy * scaleY : defaultDy;

	// Track position during drag
	const [position, setPosition] = useState({ dx: initialDx, dy: initialDy });
	const [isDragging, setIsDragging] = useState(false);
	// Use a ref to track dragging state without triggering effect re-runs
	const isDraggingRef = useRef(false);

	// Update position when dataPoint changes or scale changes
	// BUT skip if currently dragging (to prevent snap-back from re-renders)
	useEffect(() => {
		// Don't reset position while actively dragging
		if (isDraggingRef.current) return;

		const newCustomPos = dataPoint.__labelPositions?.[category];
		// Apply scale factors to stored positions
		const newDx = newCustomPos?.dx ? newCustomPos.dx * scaleX : defaultDx;
		const newDy = newCustomPos?.dy ? newCustomPos.dy * scaleY : defaultDy;
		setPosition({ dx: newDx, dy: newDy });
	}, [dataPoint, category, defaultDx, defaultDy, scaleX, scaleY]);

	// Register label position for alignment detection
	// Include dx/dy from textProps (labelPositionDX/DY from config)
	useEffect(() => {
		if (wpEditorFunctions?.labels?.registerPosition) {
			const labelPropsDx = (textProps.dx as number) || 0;
			const labelPropsDy = (textProps.dy as number) || 0;
			const absoluteX = x + position.dx + labelPropsDx;
			const absoluteY = y + position.dy + labelPropsDy;
			wpEditorFunctions.labels.registerPosition(labelId, absoluteX, absoluteY, category);
		}

		return () => {
			if (wpEditorFunctions?.labels?.unregisterPosition) {
				wpEditorFunctions.labels.unregisterPosition(labelId);
			}
		};
	}, [x, y, position.dx, position.dy, category, labelId, wpEditorFunctions, textProps.dx, textProps.dy]);

	const isDraggable = !!wpEditorFunctions?.labels?.onDrag;

	// Handle drag events
	const handleDrag = (e: DraggableEvent, data: DraggableData) => {
		// Only set the flag on actual movement, not on mousedown (onStart).
		// This lets plain clicks through while still suppressing post-drag clicks.
		isDraggingRef.current = true;

		const newDx = position.dx + data.deltaX;
		const newDy = position.dy + data.deltaY;

		setPosition({ dx: newDx, dy: newDy });

		if (wpEditorFunctions?.labels?.onDrag) {
			// Pass absolute coordinates for alignment detection
			// Include dx/dy from textProps (labelPositionDX/DY from config)
			const labelPropsDx = (textProps.dx as number) || 0;
			const labelPropsDy = (textProps.dy as number) || 0;
			const absoluteX = x + newDx + labelPropsDx;
			const absoluteY = y + newDy + labelPropsDy;
			wpEditorFunctions.labels.onDrag(
				dataPoint.x,
				category,
				newDx,
				newDy,
				true,
				absoluteX,
				absoluteY,
				groupValue
			);
		}
	};

	const handleDragStart = () => {
		// Reset the ref so a fresh click after a previous drag isn't suppressed.
		isDraggingRef.current = false;
		setIsDragging(true);
		if (wpEditorFunctions?.labels?.onDragStart) {
			wpEditorFunctions.labels.onDragStart(dataPoint.x, category, groupValue);
		}
	};

	const handleDragStop = () => {
		isDraggingRef.current = false;
		setIsDragging(false);
		if (wpEditorFunctions?.labels?.onDragEnd) {
			// Store positions at reference scale (unscaled) for responsive behavior
			// Divide by scale factors to get back to reference dimensions
			const referenceDx = position.dx / scaleX;
			const referenceDy = position.dy / scaleY;
			// Pass the category's y-value as a 6th arg so the save path can use it
			// as a scatter-specific discriminator when x values are not unique.
			const categoryValue = dataPoint[category];
			wpEditorFunctions.labels.onDragEnd(
				dataPoint.x,
				category,
				referenceDx,
				referenceDy,
				groupValue,
				categoryValue !== undefined && categoryValue !== null ? String(categoryValue) : undefined
			);
		}
	};

	// Remove pointerEvents from textProps if draggable (it's set to 'none' by default)
	// Also extract style object since labelProps puts fontWeight/fontFamily/fontSize inside style
	const { pointerEvents: _, style: textPropsStyle, ...safeTextProps } = textProps;

	// Get base font properties - check both direct props and style object
	const baseFontWeight = safeTextProps.fontWeight || textPropsStyle?.fontWeight || 'normal';
	const baseFontFamily = safeTextProps.fontFamily || textPropsStyle?.fontFamily;
	const baseFontSize = safeTextProps.fontSize || textPropsStyle?.fontSize;

	// Handle click on label to open customization popover.
	// Uses isDraggingRef (not state) so it reads the value synchronously at
	// click time, after React has already flushed the drag-stop state update.
	const handleClick = useCallback(
		(e: React.MouseEvent<SVGTextElement>) => {
			if (isDraggingRef.current) {
				// Suppress the post-drag click and reset the ref for the next interaction.
				isDraggingRef.current = false;
				return;
			}
			if (wpEditorFunctions?.labels?.onClick) {
				e.stopPropagation();
				wpEditorFunctions.labels.onClick(
					dataPoint,
					category,
					defaultLabel || String(children),
					textRef.current,
					groupValue
				);
			}
		},
		[wpEditorFunctions, dataPoint, category, defaultLabel, children, groupValue]
	);

	// Determine the fill color - custom style overrides default
	const getFillColor = () => {
		if (isDragging) return '#4A90E2';
		if (customStyle?.color) return customStyle.color;
		return safeTextProps.fill;
	};

	// Determine opacity - hidden labels show at reduced opacity in editor
	const getOpacity = () => {
		if (!visible && isInEditor) return 0.3;
		return 1;
	};

	// Get font style and decoration
	const getFontStyle = () => {
		if (customStyle?.fontStyle === 'italic') return 'italic';
		return safeTextProps.fontStyle || textPropsStyle?.fontStyle || 'normal';
	};

	const getTextDecoration = () => {
		if (customStyle?.fontStyle === 'underline') return 'underline';
		if (customStyle?.fontStyle === 'strikethrough') return 'line-through';
		return safeTextProps.textDecoration || textPropsStyle?.textDecoration || 'none';
	};

	// Get maxWidth for text wrapping — per-datum customStyle overrides caller-provided default
	const maxWidth = customStyle?.maxWidth || maxWidthProp || 0;
	const effectiveFontSize = customStyle?.fontSize || baseFontSize || 12;
	const effectiveFontFamily = customStyle?.fontFamily || baseFontFamily || DEFAULT_FONT_FAMILY;

	// Calculate wrapped lines if maxWidth is set
	const textLines = useMemo(() => {
		const textContent = String(children);
		if (!maxWidth || maxWidth <= 0) return [textContent];
		return wordWrap(textContent, maxWidth, effectiveFontSize, effectiveFontFamily);
	}, [children, maxWidth, effectiveFontSize, effectiveFontFamily]);

	const lineHeight = effectiveFontSize * 1.2;

	const resolvedFill = getFillColor();
	// Per-label override wins when explicitly set (true OR false); otherwise
	// inherit the chart-level labels.textOutline toggle.
	const textOutline = customStyle?.textOutline ?? !!config?.labels?.textOutline;
	const outlineMode = resolveTextOutlineMode(config?.labels ?? {}, config?.layout?.type);
	const outlineStroke = textOutline ? getLabelOutlineStroke(String(resolvedFill), outlineMode) : undefined;

	const labelPropsDx = (textProps.dx as number) || 0;
	const labelPropsDy = (textProps.dy as number) || 0;
	const labelCenterX = x + position.dx + labelPropsDx;
	const labelCenterY = y + position.dy + labelPropsDy;
	const leaderAnchorX = leaderLine?.anchorX ?? x;
	const leaderAnchorY = leaderLine?.anchorY ?? y;

	const textElement = (
		<text
			ref={textRef}
			x={0}
			y={0}
			{...safeTextProps}
			fill={resolvedFill}
			fontWeight={customStyle?.fontWeight || baseFontWeight}
			fontSize={effectiveFontSize}
			fontFamily={effectiveFontFamily}
			fontStyle={getFontStyle()}
			textDecoration={getTextDecoration()}
			opacity={getOpacity()}
			{...(textOutline && {
				stroke: outlineStroke,
				strokeWidth: 2,
				paintOrder: 'stroke',
			})}
			onClick={handleClick}
			style={{
				cursor: isDraggable ? (isDragging ? 'grabbing' : 'grab') : 'default',
				userSelect: 'none',
				pointerEvents: isDraggable ? 'all' : 'none',
			}}
		>
			{textLines.length === 1
				? children
				: textLines.map((line, index) => (
						<tspan key={index} x={0} dy={index === 0 ? 0 : lineHeight}>
							{line}
						</tspan>
					))}
		</text>
	);

	const draggableGroup = (
		<Group innerRef={dragRef} transform={`translate(${x + position.dx}, ${y + position.dy})`}>
			{textElement}
			{isDragging && (
				<foreignObject x={10} y={-30} width={70} height={40}>
					<div
						style={{
							background: 'rgba(255, 255, 255, 0.95)',
							border: '1px solid #4A90E2',
							borderRadius: '4px',
							padding: '3px 6px',
							fontSize: '10px',
							fontFamily: DEFAULT_FONT_FAMILY,
							fontWeight: 400,
							lineHeight: '1.3',
							boxShadow: '0 1px 4px rgba(0,0,0,0.15)',
							pointerEvents: 'none',
							color: '#333',
						}}
					>
						<div>
							<strong style={{ fontWeight: 600 }}>X:</strong> {(x + position.dx).toFixed(1)}
						</div>
						<div>
							<strong style={{ fontWeight: 600 }}>Y:</strong> {(y + position.dy).toFixed(1)}
						</div>
					</div>
				</foreignObject>
			)}
		</Group>
	);

	const leaderLineRegistrar = leaderLine?.enabled ? (
		<LabelLeaderLineRegistrar
			id={labelId}
			anchorX={leaderAnchorX}
			anchorY={leaderAnchorY}
			labelCenterX={labelCenterX}
			labelCenterY={labelCenterY}
			text={String(children)}
			fontSize={effectiveFontSize}
			fontFamily={effectiveFontFamily}
			fontWeight={customStyle?.fontWeight || baseFontWeight}
			maxWidth={maxWidth || undefined}
			textAnchor={(safeTextProps.textAnchor as MeasureLabelBBoxOptions['textAnchor']) ?? 'middle'}
			dominantBaseline={
				(safeTextProps.dominantBaseline as MeasureLabelBBoxOptions['dominantBaseline']) ?? 'middle'
			}
			anchorRadius={leaderLine.anchorRadius}
			stroke={leaderLine.stroke}
			strokeWidth={leaderLine.strokeWidth}
			threshold={leaderLine.threshold}
		/>
	) : null;

	// DraggableCore requires a single element child matching nodeRef — never wrap it in a Fragment.
	if (isDraggable) {
		return (
			<>
				{leaderLineRegistrar}
				<DraggableCore
					nodeRef={dragRef as unknown as React.RefObject<HTMLElement>}
					onDrag={handleDrag}
					onStart={handleDragStart}
					onStop={handleDragStop}
				>
					{draggableGroup}
				</DraggableCore>
			</>
		);
	}

	return (
		<>
			{leaderLineRegistrar}
			{draggableGroup}
		</>
	);
};
