/**
 * Renderers for rich text runs from `parseRichText`.
 *
 * Runs become React elements, never raw HTML, so label text cannot inject
 * markup. Links are styled but not clickable: labels sit inside draggable,
 * clickable chart elements.
 */
import type { CSSProperties } from 'react';
import type { RichTextRun } from '@prc/charting-utilities';

const LINK_COLOR = '#007cba';

function runFill(run: RichTextRun): string | undefined {
	return run.fill ?? (run.link ? LINK_COLOR : undefined);
}

function isPlain(run: RichTextRun): boolean {
	return !run.fontWeight && !run.fontStyle && !run.textDecoration && !runFill(run);
}

/** Runs as `<tspan>` children of an SVG `<text>` or `<tspan>`. */
export function RichTextSpans({ runs }: { runs: RichTextRun[] }) {
	return (
		<>
			{runs.map((run, index) => {
				if (isPlain(run)) {
					return run.text;
				}
				const fill = runFill(run);
				return (
					<tspan
						key={index}
						fontWeight={run.fontWeight}
						fontStyle={run.fontStyle}
						textDecoration={run.textDecoration}
						style={fill ? { fill } : undefined}
					>
						{run.text}
					</tspan>
				);
			})}
		</>
	);
}

/** Runs as `<span>` children of an HTML element. */
export function RichTextHtml({ runs }: { runs: RichTextRun[] }) {
	return (
		<>
			{runs.map((run, index) => {
				if (isPlain(run)) {
					return run.text;
				}
				const style: CSSProperties = {
					fontWeight: run.fontWeight,
					fontStyle: run.fontStyle,
					textDecoration: run.textDecoration,
					color: runFill(run),
				};
				return (
					<span key={index} style={style}>
						{run.text}
					</span>
				);
			})}
		</>
	);
}
