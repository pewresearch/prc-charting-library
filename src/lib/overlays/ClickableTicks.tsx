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

type AxisKey = 'independent' | 'dependent';

type ClickableTicksProps = {
	axisKey: AxisKey;
	onTickClick?: (
		axisKey: AxisKey,
		tickValue: unknown,
		formattedValue: string | undefined,
		anchorEl: SVGElement
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
};

export function ClickableTicks({
	axisKey,
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
}: ClickableTicksProps) {
	// eslint-disable-next-line no-console
	return (
		<>
			{ticks.map((tick, index) => {
				const { value, from, to, formattedValue } = tick;
				const tickLabelProps = (allTickLabelProps[index] ?? {}) as Record<string, unknown>;
				const tickLabelFontSize = Math.max(
					10,
					typeof tickLabelProps.fontSize === 'number' ? tickLabelProps.fontSize : 0
				);
				const tickYCoord = to.y + (horizontal && orientation !== Orientation.top ? tickLabelFontSize : 0);

				const handleClick = (e: React.MouseEvent<SVGSVGElement>) => {
					// eslint-disable-next-line no-console

					if (onTickClick && e.currentTarget) {
						onTickClick(axisKey, value, formattedValue, e.currentTarget);
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
