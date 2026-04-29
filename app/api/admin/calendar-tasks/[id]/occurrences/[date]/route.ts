import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase'
import type { CalendarTask } from '@/types'

type Params = { params: Promise<{ id: string; date: string }> }

export async function PATCH(request: NextRequest, { params }: Params) {
  const serverClient = await createServerSupabaseClient()
  const { data: { user }, error: authError } = await serverClient.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id, date } = await params

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const supabase = createServiceRoleClient()

  const upsertData: Record<string, unknown> = {
    task_id: id,
    occurrence_date: date,
    is_deleted: false,
  }
  if ('status' in body) upsertData.status = body.status
  if ('title' in body) upsertData.title = body.title
  if ('color' in body) upsertData.color = body.color
  if ('description' in body) upsertData.description = body.description

  const { data: exception, error: excError } = await supabase
    .from('task_exceptions')
    .upsert(upsertData, { onConflict: 'task_id,occurrence_date' })
    .select()
    .single()

  if (excError) {
    return NextResponse.json({ error: excError.message }, { status: 500 })
  }

  const { data: baseTask, error: taskError } = await supabase
    .from('calendar_tasks')
    .select('*')
    .eq('id', id)
    .single()

  if (taskError) {
    return NextResponse.json({ error: taskError.message }, { status: 500 })
  }

  const task: CalendarTask = {
    ...baseTask,
    due_date: date,
    occurrence_date: date,
    is_recurring: true,
    status: (exception.status ?? baseTask.status) as 'pending' | 'complete',
    title: exception.title ?? baseTask.title,
    color: exception.color ?? baseTask.color,
    description: exception.description ?? baseTask.description,
  }

  return NextResponse.json({ task })
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const serverClient = await createServerSupabaseClient()
  const { data: { user }, error: authError } = await serverClient.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id, date } = await params

  const supabase = createServiceRoleClient()

  const { error } = await supabase
    .from('task_exceptions')
    .upsert(
      { task_id: id, occurrence_date: date, is_deleted: true },
      { onConflict: 'task_id,occurrence_date' },
    )
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return new NextResponse(null, { status: 204 })
}
