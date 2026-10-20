/**
 * ClickableTicks - Renders axis ticks with click handlers for editor customization.
 * Wraps the default visx Ticks behavior but adds onClick to each tick label when
 * wpEditorFunctions.tickLabels.onClick is present.
 *
 * Uses Text (from SvgText) for the clickable path so that onClick is attached
 * to the <svg> wrapper — giving it a real hit-test area — while preserving
 * full wrapping/verticalAnchor/scaleToFit support.
 */

import { Orientation } from '@visx/axis';
import { Group } from '@visx/group';
import { Line } from '@visx/shape';
import React from 'react';
import { Text, type TextProps } from '../primitives/SvgText';
import { AxisTitle, type AxisTitleSpec } from './AxisTitle';

type AxisKey = 'independent' | 'dependent';

type ClickableTicksProps = {
	axisKey: AxisKey;
	/** Small-multiples panel this axis belongs to, so edits stay in their panel. */
	panelKey?: string | null;
	onTickClick?: (
		axisKey: AxisKey,
		tickValue: unknown,
		formattedValue: string | undefined,
		anchorEl: SVGElement,
		panelKey?: string | null
	) => void;
	hideTicks?: boolean;
	horizontal?: boolean;
	orientation?: string;
	tickClassName?: string;
	tickLabelProps: Record<string, unknown>[];
	tickStroke?: string;
	tickTransform?: string;
	ticks: Array<{
		value: unknown;
		index: number;
		from: { x: number; y: number };
		to: { x: number; y: number };
		formattedValue: string | undefined;
	}>;
	strokeWidth?: number | string;
	tickLineProps?: Record<string, unknown>;
	scale?: { range: () => unknown[] };
	/** Axis label from getAxisProps; visx's own label is turned off. */
	axisTitle?: AxisTitleSpec | null;
};

export function ClickableTicks({
	axisKey,
	panelKey = null,
	onTickClick,
	hideTicks,
	horizontal,
	orientation,
	tickClassName,
	tickLabelProps: allTickLabelProps,
	tickStroke = '#222',
	tickTransform,
	ticks,
	strokeWidth = 1,
	tickLineProps,
	scale,
	axisTitle,
}: ClickableTicksProps) {
	const maxTickLabelFontSize = Math.max(
		10,
		...allTickLabelProps.map((props) => (typeof props?.fontSize === 'number' ? props.fontSize : 0))
	);

	return (
		<>
			{axisTitle && scale && (
				<AxisTitle
					{...axisTitle}
					orientation={orientation}
					range={scale.range()}
					tickLabelFontSize={maxTickLabelFontSize}
				/>
			)}
			{ticks.map((tick, index) => {
				const { value, from, to, formattedValue } = tick;
				const tickLabelProps = (allTickLabelProps[index] ?? {}) as Record<string, unknown>;
				const tickLabelFontSize = Math.max(
					10,
					typeof tickLabelProps.fontSize === 'number' ? tickLabelProps.fontSize : 0
				);
				const tickYCoord = to.y + (horizontal && orientation !== Orientation.top ? tickLabelFontSize : 0);

				const handleClick = (e: React.MouseEvent<SVGSVGElement>) => {
					if (onTickClick && e.currentTarget) {
						onTickClick(axisKey, value, formattedValue, e.currentTarget, panelKey);
					}
				};

				return (
					<Group
						key={`visx-tick-${String(value)}-${index}`}
						className={['visx-axis-tick', tickClassName].filter(Boolean).join(' ')}
						transform={tickTransform}
					>
						{!hideTicks && (
							<Line
								from={from}
								to={to}
								stroke={tickStroke}
								strokeWidth={strokeWidth}
								strokeLinecap="square"
								{...tickLineProps}
							/>
						)}
						<Text
							x={to.x}
							y={tickYCoord}
							{...(tickLabelProps as TextProps)}
							{...(onTickClick
								? {
										onClick: handleClick,
										style: {
											cursor: 'pointer',
											pointerEvents: 'all' as const,
										},
									}
								: {})}
						>
							{formattedValue}
						</Text>
					</Group>
				);
			})}
		</>
	);
}
