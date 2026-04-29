import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    const serverClient = await createServerSupabaseClient()
    const { data: { user }, error: authError } = await serverClient.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    let body: Record<string, unknown>
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }

    const { title, due_date, description, room_id, property_id, recurrence_rule, recurrence_end_date, status, color } = body

    if (!title || typeof title !== 'string') {
      return NextResponse.json({ error: 'Missing title' }, { status: 400 })
    }
    if (!due_date || typeof due_date !== 'string') {
      return NextResponse.json({ error: 'Missing due_date' }, { status: 400 })
    }

    const taskId = crypto.randomUUID()

    const supabase = createServiceRoleClient()
    const { data: task, error } = await supabase
      .from('calendar_tasks')
      .insert({
        id: taskId,
        title,
        due_date,
        description: description ?? null,
        room_id: room_id ?? null,
        property_id: property_id ?? null,
        recurrence_rule: recurrence_rule ?? null,
        recurrence_end_date: recurrence_end_date ?? null,
        status: status ?? 'pending',
        color: color ?? null,
        series_id: recurrence_rule ? taskId : null,
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ task }, { status: 201 })
  } catch (err) {
    console.error('[calendar-tasks POST]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
