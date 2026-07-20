import { ChartBuilderWrapper, ChartBuilderTextWrapper, baseConfig } from '../lib';
import pieConfig from '../lib/presets/pie';
import lineConfig from '../lib/presets/line';
import scatterConfig from '../lib/presets/scatter';
import horizontalBarConfig from '../lib/presets/horizontalBar';
import verticalBarConfig from '../lib/presets/verticalBar';
import stackedBarConfig from '../lib/presets/stackedBar';
import verticalStackedBarConfig from '../lib/presets/verticalStackedBar';
import divergingBarConfig from '../lib/presets/divergingBar';
import divergingBarVerticalConfig from '../lib/presets/divergingBarVertical';
import dotPlotConfig from '../lib/presets/dotPlot';
import dotPlotWithErrorBarsConfig, { dotPlotData } from '../lib/presets/dotPlotErrors';
import explodedBarConfig from '../lib/presets/explodedBar';
import {
	// randomDataPoints,
	randomDataPointsCountries,
} from '@prc/charting-utilities';
import './styles.scss';

const Visx = () => {
	return (
		<>
			<ChartBuilderTextWrapper
				active={verticalBarConfig.metadata.active}
				width={verticalBarConfig.layout.width}
				horizontalRules={verticalBarConfig.layout.horizontalRules}
				title={verticalBarConfig.metadata.title}
				subtitle={verticalBarConfig.metadata.subtitle}
				note={verticalBarConfig.metadata.note}
				source={verticalBarConfig.metadata.source}
				tag={verticalBarConfig.metadata.tag}
			>
				<ChartBuilderWrapper
					config={verticalBarConfig}
					data={[
						{
							x: 'This is a super long x label hello!',
							y: 2,
							__isHighlighted: {
								y: false,
							},
						},
						{
							x: '1',
							y: 4,
							__isHighlighted: {
								y: false,
							},
						},
						{
							x: '2',
							y: 8,
							__isHighlighted: {
								y: false,
							},
						},
						{
							x: '3',
							y: 12,
							__isHighlighted: {
								y: false,
							},
						},
						{
							x: '4',
							y: 14,
							__isHighlighted: {
								y: false,
							},
						},
						{
							x: '5',
							y: 17,
							__isHighlighted: {
								y: false,
							},
						},
						{
							x: '6',
							y: 21,
							__isHighlighted: {
								y: false,
							},
						},
						{
							x: '7',
							y: 22,
							__isHighlighted: {
								y: false,
							},
						},
					]}
				/>
			</ChartBuilderTextWrapper>
			<ChartBuilderWrapper data={[randomDataPointsCountries(5, 1, 100)]} config={horizontalBarConfig} />
			<ChartBuilderTextWrapper
				active={explodedBarConfig.metadata.active}
				width={explodedBarConfig.layout.width}
				horizontalRules={explodedBarConfig.layout.horizontalRules}
				title={explodedBarConfig.metadata.title}
				subtitle={explodedBarConfig.metadata.subtitle}
				note={explodedBarConfig.metadata.note}
				source={explodedBarConfig.metadata.source}
				tag={explodedBarConfig.metadata.tag}
			>
				<ChartBuilderWrapper config={explodedBarConfig} data={[randomDataPointsCountries(10, 1, 10)]} />
			</ChartBuilderTextWrapper>
			<ChartBuilderTextWrapper
				active={dotPlotConfig.metadata.active}
				width={dotPlotConfig.layout.width}
				horizontalRules={dotPlotConfig.layout.horizontalRules}
				title={dotPlotConfig.metadata.title}
				subtitle={dotPlotConfig.metadata.subtitle}
				note={dotPlotConfig.metadata.note}
				source={dotPlotConfig.metadata.source}
				tag={dotPlotConfig.metadata.tag}
			>
				<ChartBuilderWrapper config={dotPlotConfig} data={[randomDataPointsCountries(8, 1, 10)]} />
			</ChartBuilderTextWrapper>

			{/* Dot Plot with Error Bars Demo */}
			<ChartBuilderTextWrapper
				active={dotPlotWithErrorBarsConfig.metadata.active}
				width={dotPlotWithErrorBarsConfig.layout.width}
				horizontalRules={dotPlotWithErrorBarsConfig.layout.horizontalRules}
				title={dotPlotWithErrorBarsConfig.metadata.title}
				subtitle={dotPlotWithErrorBarsConfig.metadata.subtitle}
				note={dotPlotWithErrorBarsConfig.metadata.note}
				source={dotPlotWithErrorBarsConfig.metadata.source}
				tag={dotPlotWithErrorBarsConfig.metadata.tag}
			>
				<ChartBuilderWrapper config={dotPlotWithErrorBarsConfig} data={[dotPlotData]} />
			</ChartBuilderTextWrapper>
			<ChartBuilderWrapper
				config={divergingBarVerticalConfig}
				data={[
					[
						{
							Agree: 1,
							'Strongly Agree': 4,
							Disagree: 5,
							Neither: 3,
							x: 'Sweden',
							__tooltips: {
								Agree: 'Hey Fella',
								Disagree: 'Boop',
							},
							__labels: {
								Agree: ':)',
								Disagree: 'Yooo',
								Neither: '🫠',
							},
						},
						{
							Agree: 1,
							'Strongly Agree': 8,
							Disagree: 4,
							Neither: 2,
							x: 'Vietnam',
							isHighlighted: false,
						},
						{
							Agree: 5,
							'Strongly Agree': 8,
							Disagree: 3,
							Neither: 4,
							x: 'Germany',
							isHighlighted: false,
						},
						{
							Agree: 8,
							'Strongly Agree': 9,
							Disagree: 4,
							Neither: 8,
							x: 'French West Indies',
							isHighlighted: true,
						},
						{
							Agree: 10,
							'Strongly Agree': 3,
							Disagree: 6,
							Neither: 2,
							x: 'Philippines',
							isHighlighted: false,
						},
					],
				]}
			/>
			<ChartBuilderTextWrapper
				active={divergingBarConfig.metadata.active}
				width={divergingBarConfig.layout.width}
				horizontalRules={divergingBarConfig.layout.horizontalRules}
				title={divergingBarConfig.metadata.title}
				subtitle={divergingBarConfig.metadata.subtitle}
				note={divergingBarConfig.metadata.note}
				source={divergingBarConfig.metadata.source}
				tag={divergingBarConfig.metadata.tag}
			>
				<ChartBuilderWrapper
					config={divergingBarConfig}
					data={[
						[
							{
								Agree: 1,
								'Strongly Agree': 4,
								Disagree: 5,
								Neither: 3,
								x: 'Sweden',
								__tooltips: {
									Agree: 'Hey Fella',
									Disagree: 'Boop',
								},
								__labels: {
									Agree: ':)',
									Disagree: 'Yooo',
									Neither: '🫠',
								},
							},
							{
								Agree: 1,
								'Strongly Agree': 8,
								Disagree: 4,
								Neither: 2,
								x: 'Vietnam',
							},
							{
								Agree: 5,
								'Strongly Agree': 8,
								Disagree: 3,
								Neither: 4,
								x: 'Germany',
							},
							{
								Agree: 8,
								'Strongly Agree': 9,
								Disagree: 4,
								Neither: 8,
								x: 'French West Indies',
								isHighlighted: true,
							},
							{
								Agree: 10,
								'Strongly Agree': 3,
								Disagree: 6,
								Neither: 2,
								x: 'Philippines',
							},
						],
					]}
				/>
			</ChartBuilderTextWrapper>
			<ChartBuilderTextWrapper
				active={stackedBarConfig.metadata.active}
				width={stackedBarConfig.layout.width}
				horizontalRules={stackedBarConfig.layout.horizontalRules}
				title={stackedBarConfig.metadata.title}
				subtitle={stackedBarConfig.metadata.subtitle}
				note={stackedBarConfig.metadata.note}
				source={stackedBarConfig.metadata.source}
				tag={stackedBarConfig.metadata.tag}
			>
				<ChartBuilderWrapper config={stackedBarConfig} data={[randomDataPointsCountries(5, 1, 10)]} />
			</ChartBuilderTextWrapper>
			<ChartBuilderWrapper
				config={verticalStackedBarConfig}
				data={[
					{
						y: 3,
						y1: 9,
						y2: 7,
						y3: 3,
						x: 'Lesotho',
					},
					{
						y: 5,
						y1: 0,
						y2: 8,
						y3: 3,
						x: 'Libya',
					},
					{
						y: 15,
						y1: 8,
						y2: 7,
						y3: 10,
						x: 'Guam',
					},
					{
						y: 10,
						y1: 8,
						y2: 12,
						y3: 8,
						x: 'Samoa',
					},
					{
						y: 10,
						y1: 10,
						y2: 0,
						y3: 7,
						x: 'Jersey',
					},
				]}
			/>
			<div className="wp-chart-builder-inner">
				<ChartBuilderTextWrapper
					active={lineConfig.metadata.active}
					width={lineConfig.layout.width}
					horizontalRules={lineConfig.layout.horizontalRules}
					title={lineConfig.metadata.title}
					subtitle={lineConfig.metadata.subtitle}
					note={lineConfig.metadata.note}
					source={lineConfig.metadata.source}
					tag={lineConfig.metadata.tag}
				>
					<ChartBuilderWrapper
						config={lineConfig}
						data={[
							[
								{
									x: '1/2000',
									Smartphones: '20',
									Tablets: '30',
									PCs: '90',
									__tooltips: {
										Smartphones: 'in 2000: 20',
										Tablets: 'in 2000: 30',
									},
									__labels: {
										Smartphones: '20%',
										Tablets: '30%',
									},
								},
								{
									x: '12/2010',
									Smartphones: '40',
									Tablets: '50',
									PCs: '55',
								},
								{
									x: '3/2015',
									Smartphones: '',
									Tablets: '50',
									PCs: '60',
								},
								{
									x: '2/2020',
									Smartphones: '70',
									Tablets: '30',
									PCs: '40',
								},
							],
						]}
					/>
				</ChartBuilderTextWrapper>
			</div>
			<ChartBuilderWrapper
				config={scatterConfig}
				data={[
					[
						{
							x: '2000',
							Smartphones: '20',
							Tablets: '30',
							__tooltips: {
								Smartphones: 'in 2000: 20',
								Tablets: 'in 2000: 30',
							},
							__labels: {
								Smartphones: '20%',
								Tablets: '30%',
							},
						},
						{
							x: '2010',
							Smartphones: '40',
							Tablets: '50',
						},
						{
							x: '2015',
							Smartphones: '',
							Tablets: '50',
						},
						{
							x: '2020',
							Smartphones: '70',
							Tablets: '30',
						},
					],
				]}
			/>

			{/* <ChartBuilderWrapper
        data={[
          [
            {
              x: 'Germany',
              y: 40,
              category: 'n1',
            },
            {
              x: 'Spain',
              y: 50,
              category: 'n1',
            },
            {
              x: 'France',
              y: 60,
              category: 'n1',
            },
          ],
          [
            {
              x: 'Germany',
              y: 60,
              category: 'n2',
            },
            {
              x: 'Spain',
              y: 50,
              category: 'n2',
            },
            {
              x: 'France',
              y: 40,
              category: 'n2',
            },
          ],
        ]}
        config={horizontalBarConfig}
      /> */}
			{/* <ChartBuilderWrapper
        data={[
          [
            {
              x: '2007',
              y: 35.66575,
              category: 'Christians',
              tooltip:
                'This is a special tooltip for this data point',
              yLabel: '36%',
            },
            {
              x: '2014',
              y: 30,
              category: 'Christians',
            },
          ],
          [
            { x: '2007', y: 24, category: 'Jews' },
            { x: '2014', y: 40, category: 'Jews' },
          ],
          [
            {
              x: '2007',
              y: 10,
              category: 'Muslims',
            },
            { x: '2014', y: 20, category: 'Muslims' },
          ],
          [
            {
              x: '2007',
              y: 31,
              category: 'Muslims',
            },
            { x: '2014', y: 10, category: 'Muslims' },
          ],
        ]}
        config={stackedBarConfig}
      /> */}
			<ChartBuilderWrapper data={[randomDataPointsCountries(4, 2, 100)]} config={pieConfig} />
			{/* <ChartBuilderWrapper
        ata={[randomDataPointsCountries(4, 2, 100)]}
        data={[
          [
            {
              x: 'Jews',
              y: 31,
              category: 'New Zealand',
            },
            {
              x: 'Christians',
              y: 25,
              category: 'New Zealand',
            },
            {
              x: 'Muslims',
              y: 14,
              category: 'New Zealand',
            },
          ],
          [
            // {
            //   x: 'Christians',
            //   y: 21,
            //   category: 'France',
            // },
            // {
            //   x: 'Muslims',
            //   y: 15,
            //   category: 'France',
            // },
            // {
            //   x: 'Other',
            //   y: 14,
            //   category: 'France',
            // },
            {
              x: 'Jews',
              y: 20,
              category: 'France',
            },
          ],
          [
            {
              x: 'Jews',
              y: 11,
              category: 'Spain',
            },
            // {
            //   x: 'Muslims',
            //   y: 15,
            //   category: 'Spain',
            // },
          ],
          [
            // {
            //   x: 'Muslims',
            //   y: 11,
            //   category: 'Canada',
            // },
            {
              x: 'Jews',
              y: 20,
              category: 'Canada',
            },
          ],
        ]}
        config={stackedBarConfig}
      /> */}
		</>
	);
};

export default Visx;
