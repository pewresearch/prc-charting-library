import { Bar } from '@prc/charting-utilities'

type BreakLineProps = {
  x1: number
  x2: number
  y1: number
  y2: number
  stroke: string
  strokeWidth: number
  strokeDasharray: string
  variation: 'empty' | 'solid' | 'dotted' | 'dashed' | 'heartbeat'
}

export const BreakLine = ({
  x1,
  x2,
  y1,
  y2,
  stroke,
  strokeWidth,
  strokeDasharray,
  variation,
}: BreakLineProps) => {
  if (variation === 'empty') {
    return null
  }
  // if there is a variation set, use the default values
  if (variation === 'solid') {
    stroke = '#A4A4A4'
    strokeWidth = 1.4
    strokeDasharray = 'none'
  }
  if (variation === 'dotted') {
    stroke = '#A4A4A4'
    strokeWidth = 1.4
    strokeDasharray = '1, 1'
  }
  if (variation === 'dashed') {
    stroke = '#A4A4A4'
    strokeWidth = 1.4
    strokeDasharray = '5, 5'
  }
  if (variation === 'heartbeat') {
    stroke = '#A4A4A4'
    strokeWidth = 1.4
    strokeDasharray = '2, 2'
  }
  return (
    <line
      x1={x1}
      x2={x2}
      y1={y1}
      y2={y2}
      stroke={stroke}
      strokeWidth={strokeWidth}
      strokeDasharray={strokeDasharray}
    />
  )
}
