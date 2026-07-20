# Draggable Labels: Alignment Guides & Snapping

## Overview

This document outlines the design and implementation plan for adding visual
alignment guides and optional snapping functionality to draggable chart labels.

## Current Implementation ✅

### Drag Position Tooltip (Completed)

- Shows real-time X/Y coordinates while dragging
- Minimal, compact design
- Non-intrusive tooltip positioned above label
- Displays absolute coordinates (not just offsets) for easy comparison

## Proposed Features

### 1. Visual Alignment Guides

Show visual guides (lines) when a label being dragged aligns horizontally or
vertically with other labels on the chart.

**Example Use Case:**

- User drags a label and wants to align it with another label
- When Y coordinates match (within threshold), a horizontal dashed line appears
- When X coordinates match (within threshold), a vertical dashed line appears
- User can see alignment in real-time and position labels precisely

### 2. Snap-to-Align (Optional)

Optionally "snap" the dragging label to alignment positions for precise
placement.

---

## Architectural Decisions

### Decision 1: Where to Store Label Positions?

**Option A: Context-based Registry**

```typescript
// New LabelRegistryContext
const LabelRegistryContext = createContext({
  labelPositions: Map<string, {x: number, y: number, category: string}>
  registerLabel: (id, x, y) => void
  unregisterLabel: (id) => void
})
```

- ✅ Centralized, easy to query all labels
- ✅ Single source of truth
- ❌ Requires new context provider wrapper
- ❌ All charts need to opt-in
- ❌ Additional complexity for context management

**Option B: Chart-level State**

```typescript
// Each chart component maintains its own registry
const [labelRegistry, setLabelRegistry] = useState([])

// Pass to labels via prop drilling or local context
<DraggableLabel
  labelRegistry={labelRegistry}
  onRegister={(id, x, y) => setLabelRegistry(...)}
/>
```

- ✅ Self-contained, no new global context
- ✅ Chart-specific, no cross-chart contamination
- ❌ Each chart type needs implementation
- ❌ More boilerplate code per chart

**Option C: Event-based System (via wpEditorFunctions) ⭐ RECOMMENDED**

```typescript
// Leverage existing WordPress editor infrastructure
wpEditorFunctions?.labels?.registerPosition?.(id, x, y, category)
wpEditorFunctions?.labels?.unregisterPosition?.(id)
wpEditorFunctions?.labels?.getPositions?.()
```

- ✅ Works with existing editor infrastructure
- ✅ Flexible, easy to extend
- ✅ Minimal changes to chart components
- ✅ Editor already manages chart state
- ❌ Only works in editor context (but that's the only place we need it)
- ❌ Relies on WordPress editor being present

### Decision 2: Alignment Detection Logic

```typescript
const ALIGNMENT_THRESHOLD = 3 // pixels - adjustable

const findAlignments = (
  currentX: number,
  currentY: number,
  currentLabelId: string,
  allLabels: LabelPosition[],
) => {
  const alignments = {
    vertical: [], // Array of {x, labelId}
    horizontal: [], // Array of {y, labelId}
  }

  allLabels
    .filter(label => label.id !== currentLabelId)
    .forEach(label => {
      // Check vertical alignment (same X)
      if (Math.abs(currentX - label.x) < ALIGNMENT_THRESHOLD) {
        alignments.vertical.push({ x: label.x, id: label.id })
      }
      // Check horizontal alignment (same Y)
      if (Math.abs(currentY - label.y) < ALIGNMENT_THRESHOLD) {
        alignments.horizontal.push({ y: label.y, id: label.id })
      }
    })

  return alignments
}
```

**Optimization Strategies:**

1. **Throttle checks**: Only check every 16ms (60fps) using
   `requestAnimationFrame`
2. **Spatial indexing**: Only check labels within reasonable distance (e.g.,
   200px radius)
3. **Debounce rendering**: Only re-render guides when alignment changes
4. **Memoization**: Cache distance calculations

### Decision 3: Visual Guide Rendering

**Where to render guides:**

```typescript
// Option A: In chart component (recommended)
<svg>
  <Group>{/* Chart content */}</Group>

  {/* Alignment guides layer */}
  <Group className="alignment-guides" style={{ pointerEvents: 'none' }}>
    {alignments.vertical.map(guide => (
      <line
        key={`v-${guide.id}`}
        x1={guide.x}
        y1={0}
        x2={guide.x}
        y2={chartHeight}
        stroke="#4A90E2"
        strokeWidth={1}
        strokeDasharray="4 4"
        opacity={0.6}
      />
    ))}
    {alignments.horizontal.map(guide => (
      <line
        key={`h-${guide.id}`}
        x1={0}
        y1={guide.y}
        x2={chartWidth}
        y2={guide.y}
        stroke="#4A90E2"
        strokeWidth={1}
        strokeDasharray="4 4"
        opacity={0.6}
      />
    ))}
  </Group>
</svg>
```

**Styling options:**

- Dashed lines for subtlety
- Blue color (#4A90E2) to match tooltip
- 60% opacity to not overwhelm
- Always on top of chart content but below labels

### Decision 4: Snap Behavior

**Three modes:**

1. **No Snap (Default)** - Visual guides only
2. **Soft Snap** - Small magnetic effect within threshold
3. **Hard Snap** - Locks to alignment position

```typescript
type SnapMode = 'none' | 'soft' | 'hard'

const applySnap = (currentPos: number, alignPos: number, mode: SnapMode) => {
  if (mode === 'none') return currentPos

  const distance = Math.abs(currentPos - alignPos)

  if (mode === 'hard' && distance < ALIGNMENT_THRESHOLD) {
    return alignPos // Lock to position
  }

  if (mode === 'soft' && distance < ALIGNMENT_THRESHOLD) {
    // Magnetic effect - ease toward alignment
    const pull = 0.3 // 30% pull strength
    return currentPos + (alignPos - currentPos) * pull
  }

  return currentPos
}
```

---

## Implementation Plan

### Phase 1: MVP (Visual Guides Only) 🎯

**Goal:** Show alignment guides without snapping

**Changes needed:**

1. **Update `wpEditorFunctions` interface** (in chart builder)

   ```typescript
   wpEditorFunctions.labels = {
     // Existing
     onDrag: (x, category, dx, dy, isDragging) => void
     onDragStart: (x, category) => void
     onDragEnd: (x, category, dx, dy) => void

     // New
     registerPosition: (id, x, y, category) => void
     unregisterPosition: (id) => void
     getPositions: () => LabelPosition[]
   }
   ```

2. **Update `DraggableLabel.tsx`**

   ```typescript
   // On mount/position change
   useEffect(() => {
     const absoluteX = x + position.dx
     const absoluteY = y + position.dy
     wpEditorFunctions?.labels?.registerPosition?.(
       labelId,
       absoluteX,
       absoluteY,
       category,
     )

     return () => {
       wpEditorFunctions?.labels?.unregisterPosition?.(labelId)
     }
   }, [x, y, position])

   // During drag
   const handleDrag = (e, data) => {
     // ... existing code

     // Check for alignments
     const allPositions = wpEditorFunctions?.labels?.getPositions?.() || []
     const alignments = findAlignments(
       x + newDx,
       y + newDy,
       labelId,
       allPositions,
     )

     // Emit alignment event
     wpEditorFunctions?.labels?.onAlignment?.(alignments)
   }
   ```

3. **Update chart components** (BarHorizontal, BarVertical, etc.)

   ```typescript
   const [alignmentGuides, setAlignmentGuides] = useState({ vertical: [], horizontal: [] })

   // In wpEditorFunctions
   const editorFunctions = useMemo(() => ({
     labels: {
       // ... existing handlers
       onAlignment: (alignments) => {
         setAlignmentGuides(alignments)
       }
     }
   }), [])

   // Render guides
   return (
     <svg>
       {/* Chart content */}

       {/* Alignment guides */}
       <Group style={{ pointerEvents: 'none' }}>
         {alignmentGuides.vertical.map(guide => (
           <line {...} />
         ))}
         {alignmentGuides.horizontal.map(guide => (
           <line {...} />
         ))}
       </Group>
     </svg>
   )
   ```

**Estimated effort:** 6-8 hours

- DraggableLabel updates: 2 hours
- Chart component updates: 3-4 hours (across 7 components)
- Testing & refinement: 2 hours

### Phase 2: Enhanced Features 🚀

**Goal:** Add snapping, keyboard modifiers, and visual improvements

**Additional features:**

1. **Snap toggle** in label controls panel
2. **Keyboard modifier** (hold Shift to temporarily disable snap)
3. **Alignment target indicator** (show which label you're aligning to)
4. **Multi-label alignment** (align to multiple labels at once)
5. **Configurable threshold** in label controls

**Changes needed:**

1. Add snap mode to label controls
2. Track keyboard state in DraggableLabel
3. Add visual indicators for alignment targets
4. Store user preference for snap behavior

**Estimated effort:** 8-10 hours

---

## Performance Considerations

### For Small Charts (< 50 labels)

- No special optimization needed
- Check all labels on every drag event

### For Large Charts (50-200 labels)

- **Spatial indexing**: Divide chart into grid, only check nearby cells
- **Throttle**: Check alignments every 16ms instead of every event
- **Limit guides**: Show max 3 vertical + 3 horizontal guides

### For Very Large Charts (200+ labels)

- **Quadtree spatial index**: O(log n) nearest neighbor search
- **Virtual rendering**: Only check visible labels
- **Worker thread**: Offload alignment calculations to web worker

**Recommended thresholds:**

```typescript
const getCheckStrategy = (labelCount: number) => {
  if (labelCount < 50) return 'all'
  if (labelCount < 200) return 'spatial'
  return 'quadtree'
}
```

---

## UX Considerations

### When to Show Guides?

- ✅ Only during active drag
- ✅ Only in editor mode
- ❌ Not on hover
- ❌ Not in published charts

### Alignment Scope

**Options:**

1. **All labels on chart** - Most flexible but can be noisy
2. **Same category only** - Clean but less useful
3. **Same group only** (for group breaks) - Moderate flexibility

**Recommendation:** Start with "all labels", add category filter as option later

### Visual Feedback

- **Guide appearance**: Dashed line, blue, 60% opacity
- **Snap feedback**: Brief pulse/highlight when snapping
- **Tooltip update**: Show "Aligned" indicator in drag tooltip
- **Audio**: Optional subtle click sound when snapping (accessibility)

### Keyboard Shortcuts (Future)

- **Shift + Drag**: Disable snap temporarily
- **Ctrl + Drag**: Constrain to horizontal/vertical only
- **Arrow keys**: Fine-tune position by 1px
- **Shift + Arrow**: Fine-tune by 10px

---

## Open Questions

1. **Cross-category alignment**: Should labels from different categories align
   with each other?
   - **Recommendation:** Yes, but with visual distinction (different line color)

2. **Performance threshold**: At what label count do we need optimization?
   - **Recommendation:** Start measuring at 100+ labels, optimize at 200+

3. **Alignment scope toggle**: Should users be able to filter what they align
   to?
   - **Recommendation:** Phase 2 feature

4. **Persist snap preference**: Should snap mode persist across sessions?
   - **Recommendation:** Yes, store in user meta or localStorage

5. **Guide style customization**: Should guide color/style be configurable?
   - **Recommendation:** No, keep consistent with design system

---

## Testing Strategy

### Manual Testing

- [ ] Test with 5 labels - verify guides appear
- [ ] Test with 50 labels - verify performance
- [ ] Test with 200 labels - verify no lag
- [ ] Test cross-group alignment
- [ ] Test with group breaks
- [ ] Test edge cases (labels at chart boundaries)

### Automated Testing

```typescript
describe('Alignment Detection', () => {
  it('should detect vertical alignment within threshold', () => {
    const labels = [
      { id: '1', x: 100, y: 50 },
      { id: '2', x: 102, y: 100 }, // Within 3px threshold
    ]
    const alignments = findAlignments(101, 75, '3', labels)
    expect(alignments.vertical).toHaveLength(2)
  })

  it('should not detect alignment beyond threshold', () => {
    const labels = [
      { id: '1', x: 100, y: 50 },
      { id: '2', x: 110, y: 100 }, // Beyond 3px threshold
    ]
    const alignments = findAlignments(101, 75, '3', labels)
    expect(alignments.vertical).toHaveLength(1)
  })
})
```

---

## Future Enhancements

1. **Smart alignment suggestions**: ML-based prediction of intended alignment
2. **Batch alignment**: Align multiple labels at once
3. **Alignment templates**: Save and reuse common alignment patterns
4. **Grid snap**: Snap to invisible grid (e.g., every 10px)
5. **Ruler tool**: Temporary ruler overlay for precise measurement
6. **Alignment history**: Undo/redo for label positioning

---

## Resources

### Similar Implementations

- **Figma**: Soft snap with visual guides
- **Sketch**: Hard snap with distance indicators
- **Adobe XD**: Smart guides with multiple alignment options
- **PowerPoint**: Snap with distribution guides

### Libraries to Consider

- [react-grid-layout](https://github.com/react-grid-layout/react-grid-layout) -
  Grid snapping patterns
- [interact.js](https://interactjs.io/) - Snap and alignment examples
- [d3-quadtree](https://github.com/d3/d3-quadtree) - Spatial indexing for
  performance

---

## Implementation Checklist

### Phase 1: MVP

- [ ] Design wpEditorFunctions interface extensions
- [ ] Implement label position registry
- [ ] Add alignment detection in DraggableLabel
- [ ] Create alignment guide renderer
- [ ] Update all bar chart components
- [ ] Test with various label counts
- [ ] Document usage for developers

### Phase 2: Enhanced

- [ ] Add snap mode toggle to label controls
- [ ] Implement keyboard modifiers
- [ ] Add alignment target indicators
- [ ] Create user preference persistence
- [ ] Performance testing and optimization
- [ ] User testing and feedback
- [ ] Update documentation

---

## Contact & Questions

For questions or suggestions about this feature, contact the development team or
open a GitHub issue.

**Last Updated:** 2025-01-07 **Status:** Planning / Design Phase **Priority:**
Medium
