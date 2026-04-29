import { createServiceRoleClient } from '@/lib/supabase'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { TaskAutomation, TaskTriggerEvent } from '@/types'

export function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d))
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

export async function resolveAutomations(
  supabase: SupabaseClient,
  roomId: string,
  propertyId: string,
  triggerEvent: TaskTriggerEvent,
): Promise<TaskAutomation[]> {
  const { data: roomRules } = await supabase
    .from('task_automations').select('*')
    .eq('scope_type', 'room').eq('room_id', roomId)
    .eq('trigger_event', triggerEvent).eq('is_active', true)
  if (roomRules && roomRules.length > 0) return roomRules as TaskAutomation[]

  const { data: propertyRules } = await supabase
    .from('task_automations').select('*')
    .eq('scope_type', 'property').eq('property_id', propertyId)
    .eq('trigger_event', triggerEvent).eq('is_active', true)
  if (propertyRules && propertyRules.length > 0) return propertyRules as TaskAutomation[]

  const { data: globalRules } = await supabase
    .from('task_automations').select('*')
    .eq('scope_type', 'global').eq('trigger_event', triggerEvent).eq('is_active', true)
  return (globalRules ?? []) as TaskAutomation[]
}

async function insertNewTasks(
  supabase: SupabaseClient,
  rules: TaskAutomation[],
  baseDate: string,
  roomId: string,
  sourceBookingId: string | null,
  sourceIcalBlockId: string | null,
): Promise<void> {
  const sourceCol = sourceBookingId ? 'source_booking_id' : 'source_ical_block_id'
  const sourceVal = (sourceBookingId ?? sourceIcalBlockId) as string

  const { data: existingWithDates } = await supabase
    .from('calendar_tasks').select('id, automation_id, due_date')
    .eq(sourceCol, sourceVal).not('automation_id', 'is', null)

  const existingMap = new Map(
    (existingWithDates ?? []).map((t: { id: string; automation_id: string; due_date: string }) => [t.automation_id, t])
  )

  const newTasks = rules
    .filter((rule) => !existingMap.has(rule.id))
    .map((rule) => ({
      title: rule.title,
      description: rule.description ?? null,
      due_date: addDays(baseDate, rule.day_offset),
      room_id: roomId,
      color: rule.color ?? null,
      assignee_id: rule.assignee_id ?? null,
      source_booking_id: sourceBookingId,
      source_ical_block_id: sourceIcalBlockId,
      automation_id: rule.id,
      status: 'pending',
    }))

  if (newTasks.length > 0) {
    const { error } = await supabase.from('calendar_tasks').insert(newTasks)
    if (error) console.error('[task-automation] insert error:', error)
  }

  // Update due_date for existing tasks if base date changed (handles booking date edits)
  for (const rule of rules) {
    const expectedDate = addDays(baseDate, rule.day_offset)
    const stored = existingMap.get(rule.id) as { id: string; due_date: string } | undefined
    if (stored && stored.due_date !== expectedDate) {
      const { error: updateErr } = await supabase.from('calendar_tasks').update({ due_date: expectedDate }).eq('id', stored.id)
      if (updateErr) console.error('[task-automation] due_date update error:', updateErr)
    }
  }
}

export async function generateTasksForBooking(
  bookingId: string,
  triggerEvent: 'booking_confirmed' | 'booking_cancelled',
): Promise<void> {
  const supabase = createServiceRoleClient()
  const { data: booking } = await supabase
    .from('bookings').select('id, check_in, check_out, room_id, room:rooms(property_id)')
    .eq('id', bookingId).single()
  if (!booking || !booking.room) return
  const propertyId = (booking.room as { property_id: string }).property_id
  const rules = await resolveAutomations(supabase, booking.room_id, propertyId, triggerEvent)
  if (rules.length === 0) return
  const today = new Date().toISOString().slice(0, 10)
  await insertNewTasks(supabase, rules, today, booking.room_id, bookingId, null)
}

export async function generateTasksForDateTrigger(
  sourceBookingId: string,
  triggerEvent: 'checkin_day' | 'checkout',
  checkIn: string,
  checkOut: string,
  roomId: string,
  propertyId: string,
): Promise<void> {
  const supabase = createServiceRoleClient()
  const rules = await resolveAutomations(supabase, roomId, propertyId, triggerEvent)
  if (rules.length === 0) return
  const baseDate = triggerEvent === 'checkin_day' ? checkIn : checkOut
  await insertNewTasks(supabase, rules, baseDate, roomId, sourceBookingId, null)
}

export async function generateTasksForICalBlock(
  icalBlockId: string,
  triggerEvent: 'checkin_day' | 'checkout',
  startDate: string,
  endDate: string,
  roomId: string,
  propertyId: string,
): Promise<void> {
  const supabase = createServiceRoleClient()
  const rules = await resolveAutomations(supabase, roomId, propertyId, triggerEvent)
  if (rules.length === 0) return
  const baseDate = triggerEvent === 'checkin_day' ? startDate : endDate
  await insertNewTasks(supabase, rules, baseDate, roomId, null, icalBlockId)
}

export async function cleanupTasksForCancelledBooking(bookingId: string): Promise<void> {
  const supabase = createServiceRoleClient()
  await supabase.from('calendar_tasks').delete()
    .eq('source_booking_id', bookingId).eq('status', 'pending').not('automation_id', 'is', null)
}
