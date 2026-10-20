import {
	isHatchingPattern,
	legendPatternId,
	type LegendItemCustomization,
	type Pattern,
} from '@prc/charting-utilities';
import { useId, type CSSProperties, type ReactElement } from 'react';
import { PatternDef } from './PatternDef';

const OUTLINE_STROKE_WIDTH = 2;
const FALLBACK_COLOR = 'light-dark(#565656, #a0a0a0)';

function isInvisibleColor(color: string | undefined): boolean {
	if (color === undefined) {
		return true;
	}
	const normalized = color.trim().toLowerCase();
	return normalized === '' || normalized === 'transparent' || normalized === 'none';
}

export function legendSwatchSeriesColor(
	scaleColor: string,
	customEntry: LegendItemCustomization | undefined,
	markerFill: 'solid' | 'outline'
): string {
	const customColor = customEntry?.color && !isInvisibleColor(customEntry.color) ? customEntry.color : undefined;

	if (markerFill === 'outline') {
		return customColor ?? (isInvisibleColor(scaleColor) ? FALLBACK_COLOR : scaleColor);
	}

	if (customColor && isInvisibleColor(scaleColor)) {
		return customColor;
	}

	return isInvisibleColor(scaleColor) ? FALLBACK_COLOR : scaleColor;
}

export function LegendSwatch({
	shape,
	width,
	height,
	margin,
	seriesColor,
	markerFill = 'solid',
	shapeStyle,
	pattern,
	patternKey,
}: {
	shape: 'rect' | 'circle' | 'line';
	width: number;
	height: number;
	margin?: string;
	seriesColor: string;
	markerFill?: 'solid' | 'outline';
	shapeStyle?: CSSProperties;
	pattern?: Pattern;
	patternKey?: string;
}) {
	const patternInstanceId = useId().replace(/:/g, '');

	if (width <= 0 || height <= 0) {
		return <span style={{ display: 'inline-block', width, height, margin }} />;
	}

	const isOutline = markerFill === 'outline';
	const swatchColor = isInvisibleColor(seriesColor) ? FALLBACK_COLOR : seriesColor;
	const hatch = !isOutline && shape !== 'line' && isHatchingPattern(pattern) ? pattern : undefined;
	const hatchId = hatch && patternKey ? `${legendPatternId(patternKey)}-${patternInstanceId}` : undefined;
	const solidFill = hatchId ? `url(#${hatchId})` : 'currentColor';

	let element: ReactElement;
	if (shape === 'circle') {
		const radius = isOutline
			? Math.max(0, Math.min(width, height) / 2 - OUTLINE_STROKE_WIDTH / 2)
			: Math.min(width, height) / 2;
		element = (
			<circle
				cx={width / 2}
				cy={height / 2}
				r={radius}
				fill={isOutline ? 'none' : solidFill}
				stroke={isOutline ? 'currentColor' : 'none'}
				strokeWidth={isOutline ? OUTLINE_STROKE_WIDTH : 0}
				style={shapeStyle}
			/>
		);
	} else if (shape === 'line') {
		element = (
			<line
				x1={0}
				x2={width}
				y1={height / 2}
				y2={height / 2}
				stroke="currentColor"
				strokeWidth={OUTLINE_STROKE_WIDTH}
				strokeLinecap="round"
				style={shapeStyle}
			/>
		);
	} else {
		const inset = isOutline ? OUTLINE_STROKE_WIDTH / 2 : 0;
		element = (
			<rect
				x={inset}
				y={inset}
				width={Math.max(0, width - inset * 2)}
				height={Math.max(0, height - inset * 2)}
				fill={isOutline ? 'none' : solidFill}
				stroke={isOutline ? 'currentColor' : 'none'}
				strokeWidth={isOutline ? OUTLINE_STROKE_WIDTH : 0}
				style={shapeStyle}
			/>
		);
	}

	return (
		<span
			style={{
				display: 'inline-flex',
				width,
				height,
				margin,
				flexShrink: 0,
				color: swatchColor,
			}}
		>
			<svg width={width} height={height} style={{ display: 'block' }}>
				{hatch && hatchId && <PatternDef id={hatchId} pattern={hatch} fill={swatchColor} />}
				{element}
			</svg>
		</span>
	);
}
