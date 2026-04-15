import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase'

export async function POST(request: NextRequest) {
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
        description: body.description ?? '',
        bedrooms: Number(body.bedrooms ?? 0),
        bathrooms: Number(body.bathrooms ?? 0),
        amenities: body.amenities ?? [],
        house_rules: body.house_rules ?? '',
        use_global_house_rules: body.use_global_house_rules ?? true,
        images: body.images ?? [],
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
  try {
    const body = await request.json()
    const { id, ...fields } = body
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

    const supabase = createServiceRoleClient()
    const { data, error } = await supabase
      .from('properties')
      .update({
        name: fields.name,
        address: fields.address,
        city: fields.city,
        state: fields.state,
        description: fields.description ?? '',
        bedrooms: Number(fields.bedrooms ?? 0),
        bathrooms: Number(fields.bathrooms ?? 0),
        amenities: fields.amenities ?? [],
        house_rules: fields.house_rules ?? '',
        use_global_house_rules: fields.use_global_house_rules ?? true,
        images: fields.images ?? [],
      })
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
