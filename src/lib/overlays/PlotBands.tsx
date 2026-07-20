import { PlotBands as PlotBandsType, DEFAULT_FONT_FAMILY } from '@prc/charting-utilities';

type PlotBandsProps = {
	plotBands: PlotBandsType;
	independentScale: any;
	innerHeight: number;
};

export const PlotBands = ({ plotBands, independentScale, innerHeight }: PlotBandsProps) => {
	return (
		<>
			{plotBands.bands.map((band, i: number) => {
				const { x, style, label } = band;
				const { band: bandStyle, label: labelStyle } = style;
				return (
					<g key={`plot-band-${i}`}>
						<rect
							fill={bandStyle.fill}
							fillOpacity={bandStyle.fillOpacity}
							x={independentScale(new Date(x[0]))}
							width={independentScale(new Date(x[1])) - independentScale(new Date(x[0]))}
							height={innerHeight}
						/>
						<text
							x={independentScale(new Date(x[0])) + labelStyle.dx}
							y={'top' === labelStyle.align ? labelStyle.dy : innerHeight - labelStyle.dy}
							fill={labelStyle.fill}
							fontSize={labelStyle.fontSize}
							fontFamily={labelStyle.fontFamily ?? DEFAULT_FONT_FAMILY}
							// rotate text 90 degrees but keep it centered
							transform={
								labelStyle.orientation === 'vertical'
									? `rotate(90, ${independentScale(new Date(x[0]))}, 30)`
									: ''
							}
						>
							{label}
						</text>
					</g>
				);
			})}
		</>
	);
};
