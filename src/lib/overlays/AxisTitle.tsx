/**
 * AxisTitle - Axis label drawn with SvgText so rich text formatting renders.
 * Placement matches @visx/axis's getLabelTransform.
 */

import { Orientation } from '@visx/axis';
import { Text, type TextProps } from '../primitives/SvgText';

export type AxisTitleSpec = {
	text: string;
	offset: number;
	tickLength: number;
	props: Record<string, unknown>;
};

type AxisTitleProps = AxisTitleSpec & {
	orientation?: string;
	range: unknown[];
	tickLabelFontSize: number;
};

const DEFAULT_TITLE_PROPS = {
	textAnchor: 'middle',
	fontFamily: 'Arial',
	fontSize: 10,
	fill: '#222',
} as const;

export function AxisTitle({
	text,
	offset,
	tickLength,
	props,
	orientation = Orientation.bottom,
	range,
	tickLabelFontSize,
}: AxisTitleProps) {
	const titleProps = { ...DEFAULT_TITLE_PROPS, ...props } as TextProps;
	const sign = orientation === Orientation.left || orientation === Orientation.top ? -1 : 1;
	const middle = (Number(range[0]) + Number(range[range.length - 1])) / 2;

	let x: number;
	let y: number;
	let transform: string | undefined;
	if (orientation === Orientation.top || orientation === Orientation.bottom) {
		const bottomOffset =
			orientation === Orientation.bottom && typeof titleProps.fontSize === 'number' ? titleProps.fontSize : 0;
		x = middle;
		y = sign * (tickLength + offset + tickLabelFontSize + bottomOffset);
	} else {
		x = sign * middle;
		y = -(tickLength + offset);
		transform = `rotate(${sign * 90})`;
	}

	return (
		<g className="visx-axis-label">
			<Text x={x} y={y} transform={transform} {...titleProps}>
				{text}
			</Text>
		</g>
	);
}
