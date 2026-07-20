/**
 * AnimatedLabel — choreographed drop-in for `DraggableLabel` on animated
 * charts (PRC-17 slice 3e-v bars, slice 3g-v point/line families).
 *
 * Reads the `TransitionProvider` phase and:
 *   - during `exiting`, renders a frozen snapshot of the previous
 *     `x`/`y`/text (still truthfully anchored to the mark the reader was
 *     looking at) while fading it out;
 *   - during `animating`/`entering`/`visible`, renders the live (new)
 *     props, fading in once geometry has landed.
 *
 * The snapshot is captured on every non-`exiting` render and frozen the
 * moment the phase flips to `exiting`. Because the provider surfaces
 * `exiting` in the same render the new data arrives, the snapshot still
 * holds the previous frame's props at that point — so the fade-out shows
 * the OLD value/position, not the new one.
 *
 * Animated opacity wraps the label in `animated.g`; the caller's
 * `fillOpacity` (tooltip deemphasis) is forwarded untouched so group
 * opacity and fill opacity compose. When the active schedule is
 * `immediate` (animation off / reduced motion / editor) we skip the
 * wrapper entirely and render a plain `DraggableLabel`, so editing and
 * accessibility paths are byte-for-byte the previous behavior.
 *
 * Cross-runtime: `animated.g` comes from `@react-spring/web`, which the
 * Preact view bundle aliases to `preact/compat` transparently (same as
 * `AnimatedBar`).
 */
import { useRef } from 'react';
import { animated } from '@react-spring/web';
import type { FlatData } from '@prc/charting-utilities';
import { DraggableLabel } from '../labels/DraggableLabel';
import { useChartTransition } from './TransitionProvider';
import { useLabelOpacity } from './useLabelOpacity';

export interface AnimatedLabelProps {
	x: number;
	y: number;
	/** The datum this label annotates (required by `DraggableLabel`). */
	dataPoint: FlatData;
	/** The series/category key this label annotates. */
	category: string;
	/** Caller opacity (e.g. tooltip deemphasis); composed with the fade. */
	fillOpacity?: number;
	children: React.ReactNode;
	/** Remaining `DraggableLabel` props (defaultDx, text props, …). */
	[key: string]: unknown;
}

interface LabelSnapshot {
	x: number;
	y: number;
	children: React.ReactNode;
}

export function AnimatedLabel({ x, y, dataPoint, category, fillOpacity = 1, children, ...rest }: AnimatedLabelProps) {
	const { phase, immediate, timing } = useChartTransition();

	// Freeze the previous frame's props during the exit fade; otherwise keep
	// the snapshot current so the next exit captures the right "old" content.
	const snapshotRef = useRef<LabelSnapshot>({ x, y, children });
	if (phase !== 'exiting') {
		snapshotRef.current = { x, y, children };
	}

	const opacity = useLabelOpacity({ phase, timing, immediate });

	if (immediate) {
		return (
			<DraggableLabel x={x} y={y} dataPoint={dataPoint} category={category} fillOpacity={fillOpacity} {...rest}>
				{children}
			</DraggableLabel>
		);
	}

	const rendered = phase === 'exiting' ? snapshotRef.current : { x, y, children };

	return (
		<animated.g style={{ opacity }}>
			<DraggableLabel
				x={rendered.x}
				y={rendered.y}
				dataPoint={dataPoint}
				category={category}
				fillOpacity={fillOpacity}
				{...rest}
			>
				{rendered.children}
			</DraggableLabel>
		</animated.g>
	);
}

export default AnimatedLabel;
