# Recurring Calendar Tasks — Design Spec

**Date:** 2026-04-29  
**Status:** Approved

---

## Overview

Admin calendar tasks should support recurrence (daily, weekly, monthly, or custom RRULE). Each occurrence is fully independent: completing, editing, or deleting one occurrence does not affect any other. Deleting offers two choices: "delete this occurrence" or "delete the whole series."

The DB schema and TaskModal form already store `recurrence_rule` and `recurrence_end_date` on `calendar_tasks`. The gap is (a) expanding recurring tasks into per-date occurrences when rendering the calendar, and (b) per-occurrence state (completion, deletion, edits).

---

## Data Model

### `calendar_tasks` — one new column

```sql
ALTER TABLE calendar_tasks
  ADD COLUMN series_id uuid REFERENCES calendar_tasks(id) ON DELETE CASCADE;
```

For a recurring task the base row sets `series_id = id` (self-referential). All occurrences are virtual; no extra rows are created per occurrence.

### New table: `task_exceptions`

```sql
CREATE TABLE task_exceptions (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id        uuid NOT NULL REFERENCES calendar_tasks(id) ON DELETE CASCADE,
  occurrence_date date NOT NULL,
  is_deleted     boolean NOT NULL DEFAULT false,
  status         text,        -- overrides base task status for this occurrence only
  title          text,        -- overrides title
  color          text,        -- overrides color
  description    text,        -- overrides description
  created_at     timestamptz DEFAULT now(),
  UNIQUE(task_id, occurrence_date)
);
```

| Action | DB operation |
|---|---|
| Delete this occurrence | Upsert `task_exceptions` row: `is_deleted = true` |
| Complete this occurrence | Upsert `task_exceptions` row: `status = 'complete'` |
| Edit this occurrence | Upsert `task_exceptions` row with changed fields |
| Delete the whole series | `DELETE FROM calendar_tasks WHERE id = :id` (cascades to exceptions) |
| Edit the series (RRULE, end date, etc.) | `PATCH /api/admin/calendar-tasks/:id` (existing endpoint) |

---

## API Layer

### `GET /api/admin/calendar-data` — expansion logic

For each `calendar_tasks` row with a non-null `recurrence_rule`:

1. Use the `rrule` npm package to expand the RRULE into occurrence dates, bounded by the calendar window being fetched.
2. For each occurrence date, look up any matching `task_exceptions` row (same `task_id` + `occurrence_date`).
3. Skip the occurrence if `is_deleted = true`.
4. Apply any non-null overrides from the exception row (status, title, color, description).
5. Return the occurrence as a `CalendarTask`-shaped object with two extra fields:
   - `occurrence_date: string` — the virtual date of this occurrence
   - `is_recurring: true` — signals the UI to show recurrence controls

The base task's `due_date` is treated as the series anchor / first occurrence. Non-recurring tasks (no `recurrence_rule`) are returned as-is.

### New: `PATCH /api/admin/calendar-tasks/[id]/occurrences/[date]`

Upserts a `task_exceptions` row for `(task_id, occurrence_date)` with the provided fields (status, title, color, description). Returns the updated exception.

### New: `DELETE /api/admin/calendar-tasks/[id]/occurrences/[date]`

Upserts a `task_exceptions` row with `is_deleted = true`. Returns 204.

### Existing endpoints — unchanged

- `DELETE /api/admin/calendar-tasks/[id]` — deletes the base row (cascades to exceptions = "delete the whole series").
- `PATCH /api/admin/calendar-tasks/[id]` — edits series-level fields (RRULE, end date, title template, etc.). Per-occurrence exceptions are preserved; exception overrides always take precedence over the base row.

---

## UI / TaskModal

### Receiving an occurrence

`onTaskClick` already passes the full task object. The expanded occurrence has `occurrence_date` and `is_recurring` set. The TaskModal reads these to decide which controls to show.

### Recurring badge

A small "Recurring" badge appears next to the task title when `is_recurring` is true.

### Completion toggle

Calls `PATCH .../occurrences/[occurrence_date]` with `{ status: 'complete' }`. No other occurrences are affected.

### Deletion

Non-recurring tasks: single "Delete" button (existing behaviour).

Recurring task occurrences: two buttons:
- **Delete this occurrence** → `DELETE .../occurrences/[occurrence_date]`
- **Delete the whole series** → `DELETE .../calendar-tasks/[id]`

### Editing an occurrence

Saving the modal form on a recurring occurrence calls `PATCH .../occurrences/[occurrence_date]` with changed fields. The base task and all other occurrences are unaffected.

### Editing the series

A secondary "Edit series" link in the modal opens the base task for editing (same modal, but no `occurrence_date` context). Saving calls the existing `PATCH .../calendar-tasks/[id]`.

---

## Calendar Rendering

No changes to `CalendarTaskRow` or the task-dot logic in `CalendarGrid`. Expanded occurrences are returned by the API as plain `CalendarTask`-shaped objects, so the render layer needs no awareness of recurrence.

---

## Out of Scope

- Skip individual occurrences without deleting them (no UI for this)
- Reminders or notifications per occurrence
- Changing recurrence pattern mid-series (edit the whole series instead)
