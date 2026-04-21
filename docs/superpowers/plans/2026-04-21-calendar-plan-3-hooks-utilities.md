# Enhanced Admin Calendar — Plan 3: Hooks & Utility Components

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the `useDateOverrides` hook for optimistic price/block state management, plus four lightweight display components: `OccupancyBar`, `CalendarLegend`, `SelectionBar`, and `CalendarTaskRow`.

**Architecture:** All components are pure client-side (`'use client'`). The hook owns the local mutations so the calendar page never needs a full reload after a price change or block. Components use Tailwind CSS semantic tokens and the teal (`#2DD4BF`) accent palette from the site theme.

**Tech Stack:** React 18, TypeScript, Tailwind CSS, date-fns

**Dependency:** Plan 1 (Foundation) must be complete — `DateOverride`, `CalendarTask`, `Room` types must exist in `types/index.ts`.

---

### Task 1: useDateOverrides hook

**Files:**
- Create: `hooks/useDateOverrides.ts`

- [ ] **Step 1: Create the hook**

```typescript
// hooks/useDateOverrides.ts
'use client'

import { useState, useCallback } from 'react'
import type { DateOverride } from '@/types'

export type OverrideMap = Record<string, Record<string, DateOverride>>

function buildMap(overrides: DateOverride[]): OverrideMap {
  const map: OverrideMap = {}
  for (const o of overrides) {
    if (!map[o.room_id]) map[o.room_id] = {}
    map[o.room_id][o.date] = o
  }
  return map
}

export function useDateOverrides(initial: DateOverride[]) {
  const [overrides, setOverrides] = useState<DateOverride[]>(initial)

  const overrideMap = buildMap(overrides)

  const getOverride = useCallback(
    (roomId: string, date: string): DateOverride | undefined =>
      overrideMap[roomId]?.[date],
    [overrideMap],
  )

  const applyOverrides = useCallback(
    (newRows: DateOverride[]) => {
      setOverrides((prev) => {
        const updated = [...prev]
        for (const row of newRows) {
          const idx = updated.findIndex(
            (o) => o.room_id === row.room_id && o.date === row.date,
          )
          if (idx >= 0) {
            updated[idx] = row
          } else {
            updated.push(row)
          }
        }
        return updated
      })
    },
    [],
  )

  const removeBlock = useCallback(
    (roomId: string, date: string) => {
      setOverrides((prev) =>
        prev.map((o) =>
          o.room_id === roomId && o.date === date
            ? { ...o, is_blocked: false, block_reason: null }
            : o,
        ),
      )
    },
    [],
  )

  return { overrides, overrideMap, getOverride, applyOverrides, removeBlock }
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add hooks/useDateOverrides.ts
git commit -m "feat: add useDateOverrides hook for optimistic calendar state"
```

---

### Task 2: OccupancyBar component

**Files:**
- Create: `components/admin/OccupancyBar.tsx`

- [ ] **Step 1: Create the component**

```tsx
// components/admin/OccupancyBar.tsx
'use client'

import { format } from 'date-fns'

interface OccupancyBarProps {
  days: Date[]
  roomCount: number
  occupancyByDate: Record<string, number>  // date string → occupied room count
  cellWidth: number  // px
  labelColWidth: number  // px
}

export function OccupancyBar({
  days,
  roomCount,
  occupancyByDate,
  cellWidth,
  labelColWidth,
}: OccupancyBarProps) {
  return (
    <div className="flex" style={{ marginLeft: labelColWidth }}>
      {days.map((day) => {
        const dateStr = format(day, 'yyyy-MM-dd')
        const occupied = occupancyByDate[dateStr] ?? 0
        const pct = roomCount > 0 ? occupied / roomCount : 0

        let bg = 'rgba(45,212,191,0.25)'
        if (pct >= 0.8) bg = '#EF4444'
        else if (pct >= 0.5) bg = '#F59E0B'

        const title = `${Math.round(pct * 100)}% occupied`

        return (
          <div
            key={dateStr}
            title={title}
            style={{ width: cellWidth, minWidth: cellWidth, backgroundColor: bg, height: 5 }}
            className="transition-colors"
          />
        )
      })}
    </div>
  )
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/admin/OccupancyBar.tsx
git commit -m "feat: add OccupancyBar heatmap component"
```

---

### Task 3: CalendarLegend component

**Files:**
- Create: `components/admin/CalendarLegend.tsx`

- [ ] **Step 1: Create the component**

```tsx
// components/admin/CalendarLegend.tsx

interface LegendItem {
  label: string
  className?: string
  style?: React.CSSProperties
}

const items: LegendItem[] = [
  { label: 'Available', style: { background: '#fff', border: '1px solid #E2E8F0' } },
  { label: 'Booked', style: { background: 'rgba(45,212,191,0.14)', borderTop: '2px solid #2DD4BF' } },
  { label: 'Blocked', style: { background: 'rgba(100,116,139,0.1)', borderTop: '2px solid #CBD5E1' } },
  { label: 'iCal Block', style: { background: 'rgba(45,212,191,0.07)' } },
  { label: 'Selected', style: { background: 'rgba(45,212,191,0.28)', border: '2px solid #2DD4BF' } },
]

export function CalendarLegend() {
  return (
    <div className="flex flex-wrap items-center gap-4 py-2 px-1 text-xs text-slate-500">
      {items.map(({ label, style }) => (
        <div key={label} className="flex items-center gap-1.5">
          <span
            className="inline-block w-4 h-4 rounded-sm"
            style={style}
          />
          <span>{label}</span>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/admin/CalendarLegend.tsx
git commit -m "feat: add CalendarLegend component"
```

---

### Task 4: SelectionBar component

**Files:**
- Create: `components/admin/SelectionBar.tsx`

- [ ] **Step 1: Create the component**

```tsx
// components/admin/SelectionBar.tsx
'use client'

interface SelectionBarProps {
  selectedCount: number
  roomName: string
  onBook: () => void
  onBlock: () => void
  onSetPrice: () => void
  onClear: () => void
}

export function SelectionBar({
  selectedCount,
  roomName,
  onBook,
  onBlock,
  onSetPrice,
  onClear,
}: SelectionBarProps) {
  if (selectedCount === 0) return null

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 rounded-full px-5 py-3 shadow-xl text-sm font-medium"
      style={{ background: '#0F172A', color: '#F8FAFC' }}
    >
      <span className="text-slate-300">
        {selectedCount} {selectedCount === 1 ? 'day' : 'days'} selected
        {roomName ? ` · ${roomName}` : ''}
      </span>

      <div className="w-px h-4 bg-slate-600" />

      <button
        onClick={onBook}
        className="rounded-full px-3 py-1 text-xs font-semibold transition-colors"
        style={{ background: '#2DD4BF', color: '#0F172A' }}
      >
        + Book
      </button>

      <button
        onClick={onBlock}
        className="rounded-full px-3 py-1 text-xs font-semibold bg-slate-700 hover:bg-slate-600 transition-colors"
      >
        🚫 Block
      </button>

      <button
        onClick={onSetPrice}
        className="rounded-full px-3 py-1 text-xs font-semibold bg-slate-700 hover:bg-slate-600 transition-colors"
      >
        $ Set Price
      </button>

      <button
        onClick={onClear}
        className="ml-1 rounded-full w-6 h-6 flex items-center justify-center bg-slate-700 hover:bg-slate-600 transition-colors text-slate-300 hover:text-white"
        aria-label="Clear selection"
      >
        ×
      </button>
    </div>
  )
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/admin/SelectionBar.tsx
git commit -m "feat: add SelectionBar action bar component"
```

---

### Task 5: CalendarTaskRow component

**Files:**
- Create: `components/admin/CalendarTaskRow.tsx`

- [ ] **Step 1: Create the component**

```tsx
// components/admin/CalendarTaskRow.tsx
'use client'

import { format, differenceInDays } from 'date-fns'
import type { CalendarTask } from '@/types'

interface CalendarTaskRowProps {
  label: string
  tasks: CalendarTask[]
  days: Date[]
  cellWidth: number
  labelColWidth: number
  onTaskClick: (task: CalendarTask) => void
  onAddClick: () => void
}

export function CalendarTaskRow({
  label,
  tasks,
  days,
  cellWidth,
  labelColWidth,
  onTaskClick,
  onAddClick,
}: CalendarTaskRowProps) {
  const firstDay = days[0]
  const lastDay = days[days.length - 1]

  return (
    <tr className="border-b border-slate-100">
      {/* Label cell */}
      <td
        className="sticky left-0 z-10 bg-slate-50 border-r border-slate-200 px-2 py-1"
        style={{ width: labelColWidth, minWidth: labelColWidth }}
      >
        <div className="flex items-center justify-between gap-1">
          <span className="text-xs text-slate-500 font-medium truncate">{label}</span>
          <button
            onClick={onAddClick}
            className="text-xs text-teal-500 hover:text-teal-700 font-semibold shrink-0"
            title="Add task"
          >
            + Add
          </button>
        </div>
      </td>

      {/* Task grid */}
      <td colSpan={days.length} className="relative p-0" style={{ height: 28 }}>
        <div className="relative w-full h-full">
          {tasks.map((task) => {
            const taskDate = new Date(task.due_date + 'T00:00:00')
            if (taskDate < firstDay || taskDate > lastDay) return null

            const offsetDays = differenceInDays(taskDate, firstDay)
            const left = offsetDays * cellWidth

            return (
              <button
                key={`${task.id}-${task.due_date}`}
                onClick={() => onTaskClick(task)}
                className="absolute top-1 h-5 rounded text-xs text-white font-medium px-1.5 truncate max-w-full hover:opacity-80 transition-opacity"
                style={{
                  left,
                  minWidth: cellWidth - 2,
                  background: task.color ?? '#6366F1',
                }}
                title={task.title}
              >
                {task.title}
              </button>
            )
          })}
        </div>
      </td>
    </tr>
  )
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/admin/CalendarTaskRow.tsx
git commit -m "feat: add CalendarTaskRow component for task sub-rows"
```

---

### Task 6: Final type-check for this plan

- [ ] **Step 1: Run type-check across all new files**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 2: Confirm all files exist**

```bash
ls hooks/useDateOverrides.ts \
   components/admin/OccupancyBar.tsx \
   components/admin/CalendarLegend.tsx \
   components/admin/SelectionBar.tsx \
   components/admin/CalendarTaskRow.tsx
```

Expected: all five paths print without `No such file`.
