/* eslint-disable jsdoc/require-param */
import type { MeasureLabelBBoxOptions, LeaderLineRegistration } from '@prc/charting-utilities';
import { useLeaderLineRegistration } from './useLeaderLineRegistration';

type LabelLeaderLineRegistrarProps = Omit<LeaderLineRegistration, 'id'> & {
	id: string;
	textAnchor?: MeasureLabelBBoxOptions['textAnchor'];
	dominantBaseline?: MeasureLabelBBoxOptions['dominantBaseline'];
};

/**
 * Registers leader-line geometry with the chart underlay. Renders nothing.
 */
export function LabelLeaderLineRegistrar({
	id,
	anchorX,
	anchorY,
	labelCenterX,
	labelCenterY,
	text,
	fontSize,
	fontFamily,
	fontWeight,
	maxWidth,
	textAnchor,
	dominantBaseline,
	anchorRadius,
	stroke,
	strokeWidth,
	threshold,
}: LabelLeaderLineRegistrarProps) {
	useLeaderLineRegistration(id, {
		anchorX,
		anchorY,
		labelCenterX,
		labelCenterY,
		text,
		fontSize,
		fontFamily,
		fontWeight,
		maxWidth,
		textAnchor,
		dominantBaseline,
		anchorRadius,
		stroke,
		strokeWidth,
		threshold,
	});

	return null;
}
