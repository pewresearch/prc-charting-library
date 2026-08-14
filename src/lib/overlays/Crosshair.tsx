import { Circle } from '@visx/shape';
import { UnifiedColumn } from '@prc/charting-utilities';

type CrosshairProps = {
	column: UnifiedColumn;
	nodeRadius: number;
	stroke?: string;
};

// The unified tooltip's on-plot marker: a rule spanning the plotted values at
// the snapped x, and a highlight node on every series there. Coordinates are
// plot-space, so this renders inside the chart's padded `<Group>`.
export const Crosshair = ({ column, nodeRadius, stroke = 'light-dark(#818181, #9a9a9a)' }: CrosshairProps) => {
	const { px, entries, ruleTop, ruleBottom } = column;

	return (
		<g pointerEvents="none">
			{/* One series at this x leaves the rule nowhere to span, so only the
			    node renders. */}
			{ruleTop !== ruleBottom && (
				<line x1={px} x2={px} y1={ruleTop} y2={ruleBottom} stroke={stroke} strokeWidth={1} />
			)}
			{entries.map((entry) => (
				<g key={entry.category}>
					<Circle cx={px} cy={entry.py} r={nodeRadius + 1} fill={entry.color} />
					<Circle
						cx={px}
						cy={entry.py}
						r={nodeRadius + 1}
						fill="transparent"
						stroke="white"
						strokeWidth={2}
					/>
				</g>
			))}
		</g>
	);
};
