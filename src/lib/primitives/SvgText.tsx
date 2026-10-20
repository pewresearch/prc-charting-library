/**
 * Text — SVG text primitive with wrapping, verticalAnchor, and event support.
 *
 * Drop-in replacement for @visx/text's Text component. Attaches event handlers
 * (onClick, onMouseEnter, etc.) to the <svg> wrapper so the hit-test surface
 * matches the visual rendering — @visx/text's inner <text> lives in an unsized
 * <svg> with a 0×0 viewport, so clicks often don't register.
 *
 * Based on @visx/text (MIT licence). Wrapping, verticalAnchor, scaleToFit,
 * and angle logic preserved from upstream.
 */

import type { RichTextRun } from '@prc/charting-utilities';
import { layoutRichTextLines, parseRichText } from '@prc/charting-utilities';
import { CSSProperties, Ref, SVGAttributes, useMemo } from 'react';
import { RichTextSpans } from './RichText';

// ---------------------------------------------------------------------------
// Minimal getStringWidth — same approach as @visx/text's util
// ---------------------------------------------------------------------------
let _ctx: CanvasRenderingContext2D | null = null;
function getCtx(): CanvasRenderingContext2D | null {
	if (typeof document === 'undefined') return null;
	if (!_ctx) {
		const canvas = document.createElement('canvas');
		_ctx = canvas.getContext('2d');
	}
	return _ctx;
}

function getStringWidth(str: string, style?: CSSProperties): number {
	try {
		const ctx = getCtx();
		if (!ctx) return 0;
		const { fontSize, fontFamily, fontWeight, fontStyle } = style || {};
		ctx.font = [fontStyle, fontWeight, `${fontSize ?? 14}px`, fontFamily].filter(Boolean).join(' ');
		return ctx.measureText(str).width;
	} catch {
		return 0;
	}
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type SVGTSpanProps = SVGAttributes<SVGTSpanElement>;
type SVGTextProps = SVGAttributes<SVGTextElement>;
type SVGSvgProps = SVGAttributes<SVGSVGElement>;

type OwnProps = {
	className?: string;
	scaleToFit?: boolean | 'shrink-only';
	angle?: number;
	textAnchor?: 'start' | 'middle' | 'end' | 'inherit';
	verticalAnchor?: 'start' | 'middle' | 'end';
	style?: CSSProperties;
	innerRef?: Ref<SVGSVGElement>;
	innerTextRef?: Ref<SVGTextElement>;
	x?: string | number;
	y?: string | number;
	dx?: string | number;
	dy?: string | number;
	lineHeight?: SVGTSpanProps['dy'];
	capHeight?: SVGTSpanProps['capHeight'];
	fontSize?: string | number;
	fontFamily?: string;
	fill?: string;
	width?: number;
	children?: string | number;
	onClick?: SVGSvgProps['onClick'];
	onMouseEnter?: SVGSvgProps['onMouseEnter'];
	onMouseLeave?: SVGSvgProps['onMouseLeave'];
};

export type TextProps = OwnProps & Omit<SVGTextProps, keyof OwnProps>;

// ---------------------------------------------------------------------------
// useText hook (ported from @visx/text's useText)
// ---------------------------------------------------------------------------
function isNumber(val: unknown): val is number {
	return typeof val === 'number';
}
function isXOrYValid(xOrY: unknown): boolean {
	return (typeof xOrY === 'number' && Number.isFinite(xOrY)) || typeof xOrY === 'string';
}

function useText(props: TextProps) {
	const {
		verticalAnchor = 'end',
		scaleToFit = false,
		angle,
		width,
		lineHeight = '1em',
		capHeight = '0.71em',
		children,
		style,
		x = 0,
		y = 0,
	} = props;

	const isXOrYNotValid = !isXOrYValid(x) || !isXOrYValid(y);

	const wordsByLines = useMemo(() => {
		if (isXOrYNotValid) return [];
		const runs = children === null || children === undefined ? [] : parseRichText(String(children));
		const measure = (run: RichTextRun) =>
			getStringWidth(run.text, {
				...style,
				fontWeight: run.fontWeight ?? style?.fontWeight,
				fontStyle: run.fontStyle ?? style?.fontStyle,
			}) || 0;
		const lines = layoutRichTextLines(runs, scaleToFit ? 0 : (width ?? 0), measure).map((lineRuns) => ({
			runs: lineRuns,
			width: lineRuns.reduce((total, run) => total + measure(run), 0),
		}));
		return lines.length ? lines : [{ runs: [] as RichTextRun[], width: 0 }];
	}, [isXOrYNotValid, width, scaleToFit, children, style]);

	const startDy = useMemo(() => {
		if (isXOrYNotValid) return '';
		const parseEm = (v: SVGTSpanProps['dy']): number => {
			if (typeof v === 'number') return v;
			if (typeof v === 'string') {
				const n = parseFloat(v);
				return Number.isFinite(n) ? n : 0;
			}
			return 0;
		};
		const cap = parseEm(capHeight);
		if (verticalAnchor === 'start') return `${cap}em`;

		const lh = parseEm(lineHeight);
		const n = wordsByLines.length - 1;
		if (verticalAnchor === 'middle') return `${(-n / 2) * lh + cap / 2}em`;
		return `${-n * lh}em`;
	}, [isXOrYNotValid, verticalAnchor, capHeight, wordsByLines.length, lineHeight]);

	const transform = useMemo(() => {
		const transforms: string[] = [];
		if (isXOrYNotValid) return '';
		if (isNumber(x) && isNumber(y) && isNumber(width) && scaleToFit && wordsByLines.length > 0) {
			const lineWidth = wordsByLines[0].width || 1;
			const sx = scaleToFit === 'shrink-only' ? Math.min(width / lineWidth, 1) : width / lineWidth;
			transforms.push(`matrix(${sx}, 0, 0, ${sx}, ${x - sx * x}, ${y - sx * y})`);
		}
		if (angle) transforms.push(`rotate(${angle}, ${x}, ${y})`);
		return transforms.join(' ');
	}, [isXOrYNotValid, x, y, width, scaleToFit, wordsByLines, angle]);

	return { wordsByLines, startDy, transform };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
const SVG_STYLE: CSSProperties = { overflow: 'visible' };

export function Text(props: TextProps) {
	const {
		dx = 0,
		dy = 0,
		textAnchor = 'start',
		innerRef,
		innerTextRef,
		verticalAnchor: _verticalAnchor,
		angle: _angle,
		lineHeight: _lineHeight,
		scaleToFit: _scaleToFit,
		capHeight: _capHeight,
		width: _width,
		onClick,
		onMouseEnter,
		onMouseLeave,
		...textProps
	} = props;

	const { wordsByLines, startDy, transform } = useText(props);
	const { x, fontSize } = textProps;

	return (
		<svg
			ref={innerRef}
			x={dx}
			y={dy}
			fontSize={fontSize}
			style={SVG_STYLE}
			onClick={onClick}
			onMouseEnter={onMouseEnter}
			onMouseLeave={onMouseLeave}
		>
			{wordsByLines.length > 0 ? (
				<text ref={innerTextRef} transform={transform} {...textProps} textAnchor={textAnchor}>
					{wordsByLines.map((line, index) => (
						<tspan key={index} x={x} dy={index === 0 ? startDy : (_lineHeight ?? '1em')}>
							<RichTextSpans runs={line.runs} />
						</tspan>
					))}
				</text>
			) : null}
		</svg>
	);
}

export default Text;
