import { useSyncExternalStore } from 'react';

import { useLeaderLineStore } from './LeaderLineContext';
import { LeaderLine } from './LeaderLine';
import { computeLeaderLineEndpoints, measureLabelBBox } from '@prc/charting-utilities';

/**
 * Renders registered leader lines beneath chart nodes.
 * Labels register geometry via the chart-scoped store (see `useLeaderLineRegistration`).
 */
export function LeaderLineUnderlay() {
	const leaderLineStore = useLeaderLineStore();
	useSyncExternalStore(leaderLineStore.subscribe, leaderLineStore.getSnapshot);

	return (
		<g className="leader-line-underlay" pointerEvents="none">
			{Array.from(leaderLineStore.getLines(), (entry) => {
				const bbox = measureLabelBBox({
					text: entry.text,
					fontSize: entry.fontSize,
					fontFamily: entry.fontFamily,
					fontWeight: entry.fontWeight,
					maxWidth: entry.maxWidth,
					textAnchor: entry.textAnchor,
					dominantBaseline: entry.dominantBaseline,
				});

				const { x1, y1, x2, y2, distance } = computeLeaderLineEndpoints({
					anchorX: entry.anchorX,
					anchorY: entry.anchorY,
					labelCenterX: entry.labelCenterX,
					labelCenterY: entry.labelCenterY,
					bbox,
					anchorRadius: entry.anchorRadius,
				});

				return (
					<LeaderLine
						key={entry.id}
						x1={x1}
						y1={y1}
						x2={x2}
						y2={y2}
						distance={distance}
						stroke={entry.stroke}
						strokeWidth={entry.strokeWidth}
						threshold={entry.threshold}
					/>
				);
			})}
		</g>
	);
}
