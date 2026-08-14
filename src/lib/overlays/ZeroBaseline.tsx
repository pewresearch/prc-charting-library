import { Line } from '@visx/shape';
import { domainCrossesZero } from '@prc/charting-utilities';

type LinearScale = {
	(value: number): number | undefined;
	domain: () => number[];
};

type ZeroBaselineProps = {
	scale: LinearScale;
	stroke: string;
	strokeWidth: number;
	along: 'x' | 'y';
	length: number;
};

const ZeroBaseline = ({ scale, stroke, strokeWidth, along, length }: ZeroBaselineProps) => {
	if (!domainCrossesZero(scale.domain())) {
		return null;
	}
	const at = scale(0);
	if (at == null) {
		return null;
	}
	switch (along) {
		case 'x':
			return (
				<Line
					from={{ x: 0, y: at }}
					to={{ x: length, y: at }}
					stroke={stroke}
					strokeWidth={strokeWidth}
					pointerEvents="none"
				/>
			);
		case 'y':
			return (
				<Line
					from={{ x: at, y: 0 }}
					to={{ x: at, y: length }}
					stroke={stroke}
					strokeWidth={strokeWidth}
					pointerEvents="none"
				/>
			);
		default: {
			const _exhaustive: never = along;
			return _exhaustive;
		}
	}
};

export { ZeroBaseline };
