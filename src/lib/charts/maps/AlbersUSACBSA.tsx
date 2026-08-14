import { useContext, useMemo, useRef, CSSProperties, RefObject } from 'react';

import * as topojson from 'topojson-client';

// TYPES & UTILITIES
import {
	DataContext,
	useSize,
	generateElementKey,
	Size,
	getChartDimensions,
	getTooltipHeaderFormat,
	getTooltipFormat,
	getLocalPoint,
	getSharedProps,
	createTopologyLoader,
	getTooltipMapDeemphasisProps,
	FeatureShape,
	BaseConfig,
	TableData,
	FlatData,
	getCustomTooltip,
	getCustomLabel,
	getCustomLabelText,
	getLabelFill,
} from '@prc/charting-utilities';
import { StyledTooltip, StyledLegend, AnnotationsLayer, DrawingsLayer, ClickableLegend } from '../../overlays';
import { DraggableLabel } from '../../labels';

// Visx
import { AlbersUsa } from '@visx/geo';
import { geoCentroid } from '@visx/vendor/d3-geo';
import { scaleLinear, scaleOrdinal, scaleSqrt, scaleThreshold } from '@visx/scale';
import { useTooltip } from '@visx/tooltip';
import { EventType } from '@visx/event/lib/types';
import { Group } from '@visx/group';
import { LegendLinear, LegendOrdinal, LegendThreshold } from '@visx/legend';

// STYLED COMPONENTS
import styled from '@emotion/styled';
import MapBubbleLayer from './MapBubbleLayer';
import MapBubbleLegend from './MapBubbleLegend';

const loadCbsaTopology = createTopologyLoader(() => import('../../data/maps/usa-cbsa/topology.json'));
const loadUsaTopology = createTopologyLoader(() => import('../../data/maps/usa/topology.json'));

const MapFeature = styled.path`
	-webkit-tap-highlight-color: transparent;
	-webkit-touch-callout: none;
	-webkit-user-select: none;
	-khtml-user-select: none;
	-moz-user-select: none;
	-ms-user-select: none;
	user-select: none;
	&:focus {
		outline: none;
	}
`;

const AlbersUSACBSA = () => {
	const { data, config, tableData, wpEditorFunctions } = useContext(
		DataContext as React.Context<{
			data: any;
			config: BaseConfig;
			tableData: TableData;
			wpEditorFunctions?: any;
		}>
	);

	const cbsaTopology = loadCbsaTopology();
	const usaTopology = loadUsaTopology();

	const { features: usCBSAs } = useMemo(
		() =>
			topojson.feature(cbsaTopology.default, cbsaTopology.default.objects.cbsas) as unknown as {
				type: 'FeatureCollection';
				features: FeatureShape[];
			},
		[cbsaTopology]
	);

	const { features: usStates } = useMemo(
		() =>
			topojson.feature(usaTopology.default, usaTopology.default.objects.states) as unknown as {
				type: 'FeatureCollection';
				features: FeatureShape[];
			},
		[usaTopology]
	);

	// Fit projection to US states so the full country is always in frame.
	const statesGeojson = useMemo(
		() => topojson.feature(usaTopology.default as any, usaTopology.default.objects.states as any),
		[usaTopology]
	);

	const { layout, colors, dataRender, map, labels, legend, tooltip, shapes, annotations, drawings } = config;
	const { padding, parentClass, width, height } = layout;
	const svgRef = useRef<SVGSVGElement>(null);
	const size: Size = useSize(parentClass, svgRef as RefObject<SVGSVGElement>);

	const { chartWidth, chartHeight, innerWidth, innerHeight, overflow } = getChartDimensions(size, layout);
	const isMobileTooltip = size.windowWidth ? size.windowWidth < layout.mobileBreakpoint : false;

	const flattenedData = useMemo(
		() =>
			data.reduce((acc: string | any[], curr: any) => {
				return acc.concat(curr);
			}, []),
		[data]
	);

	// Merge data rows into CBSA features.
	// Accepts: d.CBSA, d.cbsa, d.GEOID, d.geoid, or d.x (the independent-variable column).
	const mergedData = useMemo(() => {
		return usCBSAs.map((cbsa) => {
			const cbsaId = cbsa.id?.toString();
			const cbsaData = flattenedData.find((d: any) => {
				const candidates = [d.CBSA, d.cbsa, d.GEOID, d.geoid, d.x];
				return candidates.some((v) => v?.toString() === cbsaId);
			});
			return {
				...cbsa,
				properties: {
					...cbsa.properties,
					...cbsaData,
				},
			};
		});
	}, [usCBSAs, flattenedData]);

	const thresholdScale = scaleThreshold<number, string>({
		domain: dataRender.mapScaleDomain as number[],
		range: colors,
	});

	const ordinalScale = scaleOrdinal({
		domain: dataRender.mapScaleDomain as string[],
		range: colors,
	});

	const linearScale = scaleLinear({
		domain: dataRender.mapScaleDomain as number[],
		range: colors.map((c: string) => {
			const m = c.match(/^light-dark\(([^,]+),/);
			return m ? m[1].trim() : c;
		}),
	});

	const getFill = (id: number | string, featureData: any, category: string) => {
		if (!id) return 'transparent';
		if (!featureData?.[category]) return map.pathBackgroundFill;
		if (dataRender.mapScale === 'linear') {
			return linearScale(featureData?.[category]);
		}
		if (dataRender.mapScale === 'ordinal') {
			return ordinalScale(featureData?.[category]);
		}
		return thresholdScale(featureData?.[category]);
	};

	const centerX = innerWidth / 2 + padding.left;
	const centerY = innerHeight / 2 + padding.top;

	const isBubbleMode = dataRender.mapStyle === 'bubble';
	const category = dataRender.categories[0];

	const maxDataValue = useMemo(() => {
		if (!isBubbleMode) return 0;
		return Math.max(
			0,
			...flattenedData.map((d: FlatData) => {
				const v = d[category];
				const n = typeof v === 'number' ? v : parseFloat(v as string);
				return isNaN(n) ? 0 : Math.abs(n);
			})
		);
	}, [isBubbleMode, flattenedData, category]);

	const bubbleRadiusScale = useMemo(
		() =>
			scaleSqrt({ domain: [0, maxDataValue], range: [map.bubble?.minRadius ?? 4, map.bubble?.maxRadius ?? 24] }),
		[maxDataValue, map.bubble?.minRadius, map.bubble?.maxRadius]
	);

	const { ariaProps, legendProps, tooltipVisible, annotationsVisible, labelProps } = useMemo(
		() =>
			getSharedProps({
				chartType: 'A map of the United States Core-Based Statistical Areas',
				config,
				data: flattenedData,
				size,
				tableData,
			}),
		[config, flattenedData, size, tableData]
	);

	const {
		tooltipData,
		tooltipLeft = 0,
		tooltipTop = 0,
		tooltipOpen,
		showTooltip,
		hideTooltip,
	} = useTooltip<FlatData>();
	const tooltipTimeoutRef = useRef<number>(0);

	return (
		<div
			style={{
				position: 'relative',
				overflowX: overflow as CSSProperties['overflowX'],
			}}
		>
			<svg
				width={chartWidth}
				height={chartHeight}
				ref={svgRef}
				{...ariaProps}
				style={{
					width: '100%',
					height: '100%',
					pointerEvents: tooltip.active ? 'auto' : 'none',
				}}
				viewBox={`0 0 ${chartWidth} ${chartHeight}`}
				preserveAspectRatio="xMidYMid meet"
			>
				<Group role="presentation" top={padding.top} left={padding.left}>
					{/* State outlines — provides the full US context since CBSAs don't cover rural areas */}
					<AlbersUsa<FeatureShape>
						data={usStates}
						fitSize={[[innerWidth, innerHeight], statesGeojson]}
						translate={[centerX, centerY]}
					>
						{({ features }) =>
							features.map(({ feature, path }, i) => {
								if (!feature.id) return null;
								return (
									<path
										key={`cbsa-state-${i}`}
										d={path || ''}
										fill={map.pathBackgroundFill}
										stroke={map.pathStroke}
										strokeWidth={1}
									/>
								);
							})
						}
					</AlbersUsa>

					{/* CBSA pass: featureMeta → polygonLayer → MapBubbleLayer → labelLayer */}
					<AlbersUsa<FeatureShape>
						data={mergedData}
						fitSize={[[innerWidth, innerHeight], statesGeojson]}
						translate={[centerX, centerY]}
					>
						{({ features }) => {
							// Shared per-feature calculations reused by polygon + label layers.
							const featureMeta = features.map(({ feature, path, projection }, i) => {
								const coords: [number, number] | null = projection(geoCentroid(feature));
								const { id, properties } = feature;
								if (!coords || !id) return null;
								const hasData = Boolean(properties?.[category]);
								const fill = isBubbleMode ? map.pathBackgroundFill : getFill(id, properties, category);
								const shapeIdentifier = properties.x || properties.name || id;
								const shapeKey = generateElementKey(shapeIdentifier, category, null);
								const customShapeStyles =
									isBubbleMode || !hasData ? {} : shapes?.customStyles?.[shapeKey] || {};
								const shapeFill = customShapeStyles.fill || fill;
								return {
									feature,
									path,
									coords,
									id,
									properties,
									hasData,
									fill,
									shapeFill,
									customShapeStyles,
									i,
								};
							});

							// ── Polygon layer ────────────────────────────────────────────────
							// In bubble mode all polygons are inert background context.
							// In heat mode, no-data CBSAs render as inert background paths
							// and data-bearing CBSAs become the interactive choropleth.
							const polygonLayer = featureMeta.map((meta) => {
								if (!meta) return null;
								const { path, id, properties, hasData, fill, shapeFill, customShapeStyles, i } = meta;

								if (isBubbleMode || !hasData) {
									return (
										<path
											key={`cbsa-bg-${i}`}
											d={path || ''}
											fill={fill}
											stroke={map.pathStroke}
											strokeWidth={0.5}
											style={{ pointerEvents: 'none' }}
										/>
									);
								}

								const onMouseMove = (event: EventType) => {
									if (tooltipTimeoutRef.current) clearTimeout(tooltipTimeoutRef.current);
									if (!svgRef.current) return;
									const eventSvgCoords = getLocalPoint(svgRef.current, event) || {
										x: 0,
										y: 0,
									};
									const { body: _tip, header: _hdr } = getCustomTooltip(properties, category);
									showTooltip({
										tooltipData: {
											x: properties.name,
											id,
											y: properties[category],
											fill,
											category,
											customTooltip: _tip,
											customHeader: _hdr,
										},
										tooltipTop: eventSvgCoords.y,
										tooltipLeft: eventSvgCoords.x,
									});
								};
								const onMouseLeave = () => {
									tooltipTimeoutRef.current = window.setTimeout(() => hideTooltip(), 300);
								};
								const { opacity, stroke, strokeWidth } = getTooltipMapDeemphasisProps(
									tooltip,
									map,
									id,
									tooltipData as FlatData
								);
								return (
									<MapFeature
										key={`cbsa-feature-${i}`}
										d={path || ''}
										fill={shapeFill}
										stroke={customShapeStyles.stroke || stroke}
										opacity={customShapeStyles.opacity ?? opacity}
										strokeWidth={customShapeStyles.strokeWidth ?? strokeWidth}
										tabIndex={0}
										style={{
											cursor: wpEditorFunctions?.shapes ? 'pointer' : undefined,
											pointerEvents: wpEditorFunctions?.shapes ? 'all' : undefined,
										}}
										onClick={(event: React.MouseEvent) => {
											if (wpEditorFunctions?.shapes?.onClick) {
												wpEditorFunctions.shapes.onClick(
													{
														...properties,
														x: properties.x || properties.name || id,
													},
													category,
													fill,
													event.currentTarget,
													null
												);
											}
										}}
										onMouseMove={onMouseMove}
										onMouseLeave={onMouseLeave}
										onFocus={onMouseMove}
										onBlur={onMouseLeave}
									/>
								);
							});

							// ── Label layer ──────────────────────────────────────────────────
							// Rendered after polygons and bubbles so labels always sit on top.
							// Only label data-bearing CBSAs to keep the canvas legible.
							const labelLayer = labels.active
								? featureMeta.map((meta) => {
										if (!meta || !meta.hasData) return null;
										const { coords, properties, shapeFill, id } = meta;
										const customLabelText = getCustomLabelText(properties, category);
										const customLabel = customLabelText || getCustomLabel(properties, category);
										const defaultLabel = properties.name || '';
										const labelText = customLabel || defaultLabel;
										if (!labelText) return null;
										const dataPoint = {
											...properties,
											x: properties.x || properties.name || id,
										};
										const contrastSrc = isBubbleMode ? colors[0] : shapeFill;
										return (
											<DraggableLabel
												key={`cbsa-label-${id}`}
												x={coords[0]}
												y={coords[1]}
												dataPoint={dataPoint}
												category={category}
												defaultDx={labels.labelPositionDX}
												defaultDy={labels.labelPositionDY}
												chartInnerWidth={innerWidth}
												chartInnerHeight={innerHeight}
												defaultLabel={defaultLabel}
												fill={getLabelFill({
													labelColor: labels.color as
														| 'contrast'
														| 'black'
														| 'white'
														| 'inherit',
													seriesColor: contrastSrc,
													backgroundHex: contrastSrc,
												})}
												{...labelProps}
											>
												{labelText}
											</DraggableLabel>
										);
									})
								: null;

							return (
								<>
									{polygonLayer}
									{isBubbleMode && (
										<MapBubbleLayer
											features={features}
											category={category}
											bubbleRadiusScale={bubbleRadiusScale}
											fill={colors[0]}
											bubbleConfig={map.bubble}
											svgRef={svgRef}
											showTooltip={showTooltip}
											hideTooltip={hideTooltip}
											tooltipTimeoutRef={tooltipTimeoutRef}
											getName={(feature) => feature.properties?.name}
										/>
									)}
									{labelLayer}
								</>
							);
						}}
					</AlbersUsa>
				</Group>
				{annotationsVisible && (
					<AnnotationsLayer
						config={annotations}
						width={chartWidth}
						height={chartHeight}
						layout={layout}
						chartWidth={chartWidth}
					/>
				)}
				{drawings?.active && !wpEditorFunctions && (
					<DrawingsLayer
						config={drawings}
						width={chartWidth}
						height={chartHeight}
						layout={layout}
						chartWidth={chartWidth}
					/>
				)}
			</svg>
			{legend.active && !isBubbleMode && (
				<StyledLegend
					legend={legend}
					layoutWidth={width}
					layoutHeight={height}
					chartWidth={chartWidth}
					chartHeight={chartHeight}
				>
					{dataRender.mapScale === 'threshold' && (
						<LegendThreshold
							{...legendProps}
							scale={thresholdScale}
							labelLower={legend.labelLower}
							labelUpper={legend.labelUpper}
							labelDelimiter={legend.labelDelimiter}
						>
							{(legendLabels: any) => (
								<ClickableLegend
									labels={legendLabels}
									shape={legend.markerStyle}
									fill={(label) => label.value}
									shapeStyle={legendProps.shapeStyle}
									direction={legend.orientation}
									legendLabelProps={legendProps.legendLabelProps}
								/>
							)}
						</LegendThreshold>
					)}
					{dataRender.mapScale === 'ordinal' && (
						<LegendOrdinal
							{...legendProps}
							scale={ordinalScale}
							domain={legend.categories.length > 0 ? legend.categories : ordinalScale.domain()}
						>
							{(legendLabels: any) => (
								<ClickableLegend
									labels={legendLabels}
									shape={legend.markerStyle}
									fill={(label) => ordinalScale(label.datum)}
									shapeStyle={legendProps.shapeStyle}
									direction={legend.orientation}
									legendLabelProps={legendProps.legendLabelProps}
								/>
							)}
						</LegendOrdinal>
					)}
					{dataRender.mapScale === 'linear' && (
						<LegendLinear {...legendProps} scale={linearScale}>
							{(legendLabels: any) => (
								<ClickableLegend
									labels={legendLabels}
									shape={legend.markerStyle}
									fill={(label) => label.value}
									shapeStyle={legendProps.shapeStyle}
									direction={legend.orientation}
									legendLabelProps={legendProps.legendLabelProps}
								/>
							)}
						</LegendLinear>
					)}
				</StyledLegend>
			)}
			{legend.active && isBubbleMode && (
				<StyledLegend
					legend={legend}
					layoutWidth={width}
					layoutHeight={height}
					chartWidth={chartWidth}
					chartHeight={chartHeight}
				>
					<MapBubbleLegend
						bubbleRadiusScale={bubbleRadiusScale}
						maxDataValue={maxDataValue}
						fill={colors[0]}
						stroke={map.bubble?.stroke}
						strokeWidth={map.bubble?.strokeWidth}
						opacity={map.bubble?.opacity}
						refValues={legend.bubbleLegend?.refValues}
						fillMode={legend.bubbleLegend?.fill}
						layout={legend.bubbleLegend?.layout}
						fontSize={legend.fontSize}
					/>
				</StyledLegend>
			)}
			{tooltipOpen && tooltipData && tooltipVisible && (
				<StyledTooltip
					top={tooltipTop}
					left={tooltipLeft}
					tooltip={tooltip}
					containerRef={svgRef}
					isMobile={isMobileTooltip}
				>
					<>
						{tooltip.headerActive && (
							<div style={{ marginBottom: '10px' }}>
								<strong>
									{tooltipData.customHeader
										? tooltipData.customHeader
										: getTooltipHeaderFormat(
												{
													x: tooltipData.x,
													category: tooltipData.category,
												},
												tooltip
											)}
								</strong>
							</div>
						)}
					</>
					<div
						dangerouslySetInnerHTML={{
							__html: tooltipData.customTooltip
								? tooltipData.customTooltip
								: getTooltipFormat({
											x: tooltipData.x,
											y: tooltipData.y,
											category: tooltipData.category,
											color: tooltipData.fill,
										data: tooltipData,},
										tooltip,
										dataRender
									),
						}}
					/>
				</StyledTooltip>
			)}
		</div>
	);
};

export default AlbersUSACBSA;
