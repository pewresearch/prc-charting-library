import { resolvePatternSpec, type Pattern, type PatternSpec } from '@prc/charting-utilities';
import { PatternCircles, PatternHexagons, PatternLines, PatternPath, PatternWaves } from '@visx/pattern';

export type PatternDefProps = {
	id: string;
	pattern: Pattern;
	/** Mark fill. Becomes the tile background so the shape stays solid. */
	fill?: string;
};

const TILE = 8;

// Hatch marks sit on top of the mark's own fill, so they need to contrast
// with it. A spec that sets `stroke` or `fill` overrides this.
const HATCH_PAINT = "light-dark('#ffffff', '#000000')";

function lineOrientation(spec: Extract<PatternSpec, { type: 'lines' | 'striped' | 'crosshatch' }>) {
	if (spec.orientation) {
		return spec.orientation;
	}

	if (spec.type === 'crosshatch') {
		return ['diagonal', 'vertical'] as const;
	}

	if (spec.type === 'striped') {
		return ['diagonal'] as const;
	}

	return ['vertical'] as const;
}

/**
 * One SVG pattern def. visx wraps it in `<defs>` already.
 * @param root0
 * @param root0.id
 * @param root0.pattern
 * @param root0.fill
 */
export function PatternDef({ id, pattern, fill }: PatternDefProps) {
	const spec = resolvePatternSpec(pattern);

	if (!spec) {
		return null;
	}

	const background = spec.background ?? fill;

	switch (spec.type) {
		case 'striped':
		case 'crosshatch':
		case 'lines':
			return (
				<PatternLines
					id={id}
					width={spec.width ?? TILE}
					height={spec.height ?? TILE}
					stroke={spec.stroke ?? HATCH_PAINT}
					strokeWidth={spec.strokeWidth ?? 1}
					strokeDasharray={spec.strokeDasharray}
					strokeLinecap={spec.strokeLinecap}
					shapeRendering={spec.shapeRendering}
					orientation={[...lineOrientation(spec)]}
					background={background}
				/>
			);
		case 'dotted':
		case 'circles':
			return (
				<PatternCircles
					id={id}
					width={spec.width ?? TILE}
					height={spec.height ?? TILE}
					radius={spec.radius ?? 1.5}
					fill={spec.fill ?? HATCH_PAINT}
					stroke={spec.stroke}
					strokeWidth={spec.strokeWidth}
					strokeDasharray={spec.strokeDasharray}
					complement={spec.complement ?? spec.type === 'dotted'}
					background={background}
				/>
			);
		case 'waves':
			return (
				<PatternWaves
					id={id}
					width={spec.width ?? TILE}
					height={spec.height ?? TILE}
					fill={spec.fill}
					stroke={spec.stroke ?? HATCH_PAINT}
					strokeWidth={spec.strokeWidth ?? 1}
					strokeDasharray={spec.strokeDasharray}
					strokeLinecap={spec.strokeLinecap}
					shapeRendering={spec.shapeRendering}
					background={background}
				/>
			);
		case 'hexagons':
			return (
				<PatternHexagons
					id={id}
					height={spec.height ?? TILE}
					size={spec.size}
					fill={spec.fill ?? HATCH_PAINT}
					stroke={spec.stroke}
					strokeWidth={spec.strokeWidth}
					strokeDasharray={spec.strokeDasharray}
					strokeLinecap={spec.strokeLinecap}
					shapeRendering={spec.shapeRendering}
					background={background}
				/>
			);
		case 'path':
			return (
				<PatternPath
					id={id}
					width={spec.width ?? TILE}
					height={spec.height ?? TILE}
					path={spec.path}
					fill={spec.fill}
					stroke={spec.stroke ?? HATCH_PAINT}
					strokeWidth={spec.strokeWidth ?? 1}
					strokeDasharray={spec.strokeDasharray}
					strokeLinecap={spec.strokeLinecap}
					shapeRendering={spec.shapeRendering}
					background={background}
				/>
			);
		default: {
			const _exhaustive: never = spec;
			return _exhaustive;
		}
	}
}
