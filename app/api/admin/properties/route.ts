import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient, createServerSupabaseClient } from '@/lib/supabase'

async function requireAuth() {
  const server = await createServerSupabaseClient()
  const { data: { user }, error } = await server.auth.getUser()
  return error || !user ? null : user
}

export async function POST(request: NextRequest) {
  if (!(await requireAuth())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const body = await request.json()
    const supabase = createServiceRoleClient()
    const { data, error } = await supabase
      .from('properties')
      .insert({
        name: body.name,
        address: body.address,
        city: body.city,
        state: body.state,
        zip: body.zip ?? '',
        description: body.description ?? '',
        bedrooms: Number(body.bedrooms ?? 0),
        bathrooms: Number(body.bathrooms ?? 0),
        amenities: body.amenities ?? [],
        house_rules: body.house_rules ?? '',
        use_global_house_rules: body.use_global_house_rules ?? true,
        images: body.images ?? [],
        stripe_account_id: body.stripe_account_id ?? null,
        platform_fee_percent: Number(body.platform_fee_percent ?? 0),
        cancellation_policy: body.cancellation_policy ?? null,
        use_global_cancellation_policy: body.use_global_cancellation_policy ?? true,
      })
      .select('id')
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data, { status: 201 })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 },
    )
  }
}

export async function PATCH(request: NextRequest) {
  if (!(await requireAuth())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const body = await request.json()
    const { id, ...fields } = body
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

    const update = { ...fields }

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
    }

    const supabase = createServiceRoleClient()
    const { data, error } = await supabase
      .from('properties')
      .update(update)
      .eq('id', id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 },
    )
  }
}

export async function DELETE(request: NextRequest) {
  if (!(await requireAuth())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const { id } = await request.json()
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

    const supabase = createServiceRoleClient()

    const { count } = await supabase
      .from('rooms')
      .select('id', { count: 'exact', head: true })
      .eq('property_id', id)

    if (count && count > 0) {
      return NextResponse.json(
        { error: 'Remove all rooms from this property before deleting it.' },
        { status: 409 },
      )
    }

    const { error } = await supabase.from('properties').delete().eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 },
    )
  }
}
