import { Group } from '@visx/group'

type AlignmentGuide = {
  id: string
  x?: number // For vertical guides
  y?: number // For horizontal guides
}

type Alignments = {
  vertical: AlignmentGuide[]
  horizontal: AlignmentGuide[]
}

interface AlignmentGuidesProps {
  alignments: Alignments
  chartWidth: number
  chartHeight: number
}

/**
 * Renders alignment guide lines when labels align
 *
 * Simple presentational component that just renders dashed lines
 * based on the alignments object it receives.
 */
export function AlignmentGuides({
  alignments,
  chartWidth,
  chartHeight,
}: AlignmentGuidesProps) {
  if (!alignments) {
    return null
  }

  return (
    <Group className='alignment-guides' style={{ pointerEvents: 'none' }}>
      {/* Vertical alignment guides (same X coordinate) */}
      {alignments.vertical?.map(guide => (
        <line
          key={`v-${guide.id}`}
          x1={guide.x}
          y1={0}
          x2={guide.x}
          y2={chartHeight}
          stroke='#4A90E2'
          strokeWidth={1}
          strokeDasharray='4 4'
          opacity={0.6}
        />
      ))}

      {/* Horizontal alignment guides (same Y coordinate) */}
      {alignments.horizontal?.map(guide => (
        <line
          key={`h-${guide.id}`}
          x1={0}
          y1={guide.y}
          x2={chartWidth}
          y2={guide.y}
          stroke='#4A90E2'
          strokeWidth={1}
          strokeDasharray='4 4'
          opacity={0.6}
        />
      ))}
    </Group>
  )
}
