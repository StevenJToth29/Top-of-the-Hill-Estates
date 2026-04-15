import { NextResponse } from 'next/server'
import { createServiceRoleClient, createServerSupabaseClient } from '@/lib/supabase'

async function getAuthedUser() {
  const serverClient = await createServerSupabaseClient()
  const { data: { user }, error } = await serverClient.auth.getUser()
  return { user: error ? null : user }
}

export async function POST(request: Request) {
  const { user } = await getAuthedUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceRoleClient()
  const body = await request.json()

  const { data, error } = await supabase
    .from('rooms')
    .insert({
      property_id: body.property_id,
      name: body.name,
      slug: body.slug,
      short_description: body.short_description ?? '',
      description: body.description ?? '',
      guest_capacity: Number(body.guest_capacity),
      bedrooms: Number(body.bedrooms),
      bathrooms: Number(body.bathrooms),
      nightly_rate: Number(body.nightly_rate),
      monthly_rate: Number(body.monthly_rate),
      show_nightly_rate: Boolean(body.show_nightly_rate),
      show_monthly_rate: Boolean(body.show_monthly_rate),
      minimum_nights_short_term: Number(body.minimum_nights_short_term),
      minimum_nights_long_term: Number(body.minimum_nights_long_term),
      is_active: Boolean(body.is_active),
      amenities: body.amenities ?? [],
      images: body.images ?? [],
    })
    .select('id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ id: data.id })
}

export async function PATCH(request: Request) {
  const { user } = await getAuthedUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceRoleClient()
  const body = await request.json()
  const { id, ...fields } = body

  if (!id) return NextResponse.json({ error: 'Missing room id' }, { status: 400 })

  const { error } = await supabase
    .from('rooms')
    .update({
      name: fields.name,
      slug: fields.slug,
      short_description: fields.short_description,
      description: fields.description,
      guest_capacity: Number(fields.guest_capacity),
      bedrooms: Number(fields.bedrooms),
      bathrooms: Number(fields.bathrooms),
      nightly_rate: Number(fields.nightly_rate),
      monthly_rate: Number(fields.monthly_rate),
      show_nightly_rate: Boolean(fields.show_nightly_rate),
      show_monthly_rate: Boolean(fields.show_monthly_rate),
      minimum_nights_short_term: Number(fields.minimum_nights_short_term),
      minimum_nights_long_term: Number(fields.minimum_nights_long_term),
      is_active: Boolean(fields.is_active),
      amenities: fields.amenities,
      images: fields.images,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
