/**
 * DrawingsLayer Component
 *
 * Renders user-drawn SVG shapes on top of charts.
 * Supports lines, arrows, lollipops, circles, rectangles, and freehand paths.
 * Uses the same responsive scaling approach as AnnotationsLayer.
 */

import type {
  Layout,
  Drawing,
  DrawingsConfig,
  LineDrawing,
  ArrowDrawing,
  LollipopDrawing,
  CircleDrawing,
  RectDrawing,
  PathDrawing,
  Breakpoint,
} from '@prc/charting-utilities'

// Re-export types for consumers
export type {
  Drawing,
  DrawingsConfig,
  LineDrawing,
  ArrowDrawing,
  LollipopDrawing,
  CircleDrawing,
  RectDrawing,
  PathDrawing,
}

// Props for individual drawing components
interface DrawingProps {
  drawing: Drawing
  width: number
  height: number
  layout: Layout
}

/**
 * Scale a coordinate from reference layout dimensions to current dimensions
 */
function scaleX(value: number, width: number, layoutWidth: number): number {
  return (value * width) / layoutWidth
}

function scaleY(value: number, height: number, layoutHeight: number): number {
  return (value * height) / layoutHeight
}

/**
 * Arrow marker component using SVG <marker> element.
 * See: https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Element/marker
 */
function ArrowMarker({ id, color }: { id: string; color: string }) {
  return (
    <marker
      id={id}
      viewBox="0 0 10 10"
      refX="9"
      refY="5"
      markerWidth="6"
      markerHeight="6"
      orient="auto-start-reverse"
    >
      <path d="M 0 0 L 10 5 L 0 10 z" fill={color} />
    </marker>
  )
}

/**
 * Lollipop marker component (circle at end of line)
 */
function LollipopMarker({
  id,
  color,
  radius,
}: {
  id: string
  color: string
  radius: number
}) {
  return (
    <marker
      id={id}
      viewBox="-10 -10 20 20"
      refX="0"
      refY="0"
      markerWidth={radius * 2}
      markerHeight={radius * 2}
      orient="auto"
    >
      <circle cx="0" cy="0" r="6" fill={color} />
    </marker>
  )
}

/**
 * Build a path string for a line with optional curve or breakpoints.
 */
function buildLinePath(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  options: {
    lineMode?: string
    bendX?: number
    bendY?: number
    breakpoints?: Array<{ x: number; y: number }>
    scaleXFn: (v: number) => number
    scaleYFn: (v: number) => number
  },
): string {
  const { lineMode, bendX, bendY, breakpoints, scaleXFn, scaleYFn } = options

  // Angled mode with breakpoints
  if (lineMode === 'angled' && breakpoints && breakpoints.length > 0) {
    const scaledBreakpoints = breakpoints.map(bp => ({
      x: scaleXFn(bp.x),
      y: scaleYFn(bp.y),
    }))
    let path = `M ${x1} ${y1}`
    for (const bp of scaledBreakpoints) {
      path += ` L ${bp.x} ${bp.y}`
    }
    path += ` L ${x2} ${y2}`
    return path
  }

  // Curved mode with bend point
  if (lineMode === 'curved' && bendX !== undefined && bendY !== undefined) {
    const scaledBendX = scaleXFn(bendX)
    const scaledBendY = scaleYFn(bendY)
    return `M ${x1} ${y1} Q ${scaledBendX} ${scaledBendY} ${x2} ${y2}`
  }

  // Default: straight line
  return `M ${x1} ${y1} L ${x2} ${y2}`
}

/**
 * Scale path data (d attribute) from reference to current dimensions
 */
function scalePath(
  d: string,
  width: number,
  height: number,
  layoutWidth: number,
  layoutHeight: number,
): string {
  return d.replace(
    /([ML])\s*([\d.-]+)\s+([\d.-]+)/gi,
    (match, command, x, y) => {
      const scaledX = scaleX(parseFloat(x), width, layoutWidth)
      const scaledY = scaleY(parseFloat(y), height, layoutHeight)
      return `${command} ${scaledX} ${scaledY}`
    },
  )
}

/**
 * Render a single drawing element
 */
const DrawingElement = ({ drawing, width, height, layout }: DrawingProps) => {
  const {
    stroke,
    strokeWidth,
    strokeDasharray,
    fill = 'none',
    opacity = 1,
    fillOpacity,
  } = drawing

  const commonProps = {
    stroke,
    strokeWidth,
    strokeDasharray,
    strokeLinecap: 'round' as const,
    fill,
    opacity,
    fillOpacity,
    pointerEvents: 'none' as const,
  }

  const scaleXFn = (v: number) => scaleX(v, width, layout.width)
  const scaleYFn = (v: number) => scaleY(v, height, layout.height)

  switch (drawing.type) {
    case 'line': {
      const x1 = scaleXFn(drawing.x1)
      const y1 = scaleYFn(drawing.y1)
      const x2 = scaleXFn(drawing.x2)
      const y2 = scaleYFn(drawing.y2)

      const linePath = buildLinePath(x1, y1, x2, y2, {
        lineMode: drawing.lineMode,
        bendX: drawing.bendX,
        bendY: drawing.bendY,
        breakpoints: drawing.breakpoints,
        scaleXFn,
        scaleYFn,
      })

      return <path d={linePath} {...commonProps} />
    }

    case 'arrow': {
      const x1 = scaleXFn(drawing.x1)
      const y1 = scaleYFn(drawing.y1)
      const x2 = scaleXFn(drawing.x2)
      const y2 = scaleYFn(drawing.y2)
      const markerId = `arrow-marker-${drawing.id}`

      const linePath = buildLinePath(x1, y1, x2, y2, {
        lineMode: drawing.lineMode,
        bendX: drawing.bendX,
        bendY: drawing.bendY,
        breakpoints: drawing.breakpoints,
        scaleXFn,
        scaleYFn,
      })

      return (
        <>
          <defs>
            <ArrowMarker id={markerId} color={stroke} />
          </defs>
          <path
            d={linePath}
            stroke={stroke}
            strokeWidth={strokeWidth}
            strokeDasharray={strokeDasharray}
            strokeLinecap="round"
            fill="none"
            opacity={opacity}
            markerEnd={`url(#${markerId})`}
            pointerEvents="none"
          />
        </>
      )
    }

    case 'lollipop': {
      const x1 = scaleXFn(drawing.x1)
      const y1 = scaleYFn(drawing.y1)
      const x2 = scaleXFn(drawing.x2)
      const y2 = scaleYFn(drawing.y2)
      const markerId = `lollipop-marker-${drawing.id}`
      const dotRadius = drawing.dotRadius || 6

      const linePath = buildLinePath(x1, y1, x2, y2, {
        lineMode: drawing.lineMode,
        bendX: drawing.bendX,
        bendY: drawing.bendY,
        breakpoints: drawing.breakpoints,
        scaleXFn,
        scaleYFn,
      })

      return (
        <>
          <defs>
            <LollipopMarker id={markerId} color={stroke} radius={dotRadius} />
          </defs>
          <path
            d={linePath}
            stroke={stroke}
            strokeWidth={strokeWidth}
            strokeDasharray={strokeDasharray}
            strokeLinecap="round"
            fill="none"
            opacity={opacity}
            markerEnd={`url(#${markerId})`}
            pointerEvents="none"
          />
        </>
      )
    }

    case 'circle': {
      const cx = scaleXFn(drawing.cx)
      const cy = scaleYFn(drawing.cy)
      const scaleFactorX = width / layout.width
      const scaleFactorY = height / layout.height
      const avgScale = (scaleFactorX + scaleFactorY) / 2
      const r = drawing.r * avgScale

      return <circle cx={cx} cy={cy} r={r} {...commonProps} />
    }

    case 'rect': {
      const x = scaleXFn(drawing.x)
      const y = scaleYFn(drawing.y)
      const rectWidth = scaleXFn(drawing.width)
      const rectHeight = scaleYFn(drawing.height)
      const rx = drawing.rx || 0

      return (
        <rect
          x={x}
          y={y}
          width={rectWidth}
          height={rectHeight}
          rx={rx}
          {...commonProps}
        />
      )
    }

    case 'path': {
      const scaledD = scalePath(
        drawing.d,
        width,
        height,
        layout.width,
        layout.height,
      )

      return <path d={scaledD} {...commonProps} />
    }

    default:
      return null
  }
}

/**
 * DrawingsLayer Component
 *
 * Renders all drawings with proper responsive scaling.
 * Follows the same pattern as AnnotationsLayer.
 */
export const DrawingsLayer = ({
  config,
  width,
  height,
  layout,
  chartWidth,
}: {
  config: DrawingsConfig
  width: number
  height: number
  layout: Layout
  chartWidth: number
}) => {
  if (!config?.active || !config?.items || config.items.length === 0) {
    return null
  }

  const horizPadding = layout.padding.left + layout.padding.right
  const vertPadding = layout.padding.top + layout.padding.bottom
  const innerWidth = chartWidth - horizPadding
  const innerHeight = height - vertPadding

  const adjustedLayout = {
    ...layout,
    width: layout.width - horizPadding,
    height: layout.height - vertPadding,
  }

  const defaultPositioningContext = 'inner'
  const drawingsWithContext = config.items.map(drawing => ({
    ...drawing,
    positioningContext: drawing.positioningContext || defaultPositioningContext,
  }))

  const chartContextDrawings = drawingsWithContext.filter(
    drawing => drawing.positioningContext === 'chart',
  )
  const innerContextDrawings = drawingsWithContext.filter(
    drawing => drawing.positioningContext === 'inner',
  )

  return (
    <g className="cb__drawings-layer">
      {chartContextDrawings.map(drawing => (
        <DrawingElement
          key={drawing.id}
          drawing={drawing}
          width={chartWidth}
          height={height}
          layout={layout}
        />
      ))}

      <g transform={`translate(${layout.padding.left}, ${layout.padding.top})`}>
        {innerContextDrawings.map(drawing => (
          <DrawingElement
            key={drawing.id}
            drawing={drawing}
            width={innerWidth}
            height={innerHeight}
            layout={adjustedLayout}
          />
        ))}
      </g>
    </g>
  )
}

export default DrawingsLayer
