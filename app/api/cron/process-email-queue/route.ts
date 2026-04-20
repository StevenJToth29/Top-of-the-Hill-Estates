import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase'
import { sendEmail, resolveVariables } from '@/lib/email'

export async function POST(request: NextRequest) {
  if (request.headers.get('Authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceRoleClient()

  const { data: rows, error } = await supabase
    .from('email_queue')
    .select('*, template:email_templates(subject, body)')
    .eq('status', 'pending')
    .lte('send_at', new Date().toISOString())
    .order('send_at')
    .limit(50)

  if (error) {
    console.error('process-email-queue: failed to fetch rows:', error)
    return NextResponse.json({ error: 'Failed to fetch queue' }, { status: 500 })
  }

  const { data: emailSettings } = await supabase
    .from('email_settings')
    .select('from_name, from_email')
    .maybeSingle()

  let processed = 0
  let failed = 0

  for (const row of rows ?? []) {
    const template = row.template as { subject: string; body: string } | null

    if (!template) {
      await supabase
        .from('email_queue')
        .update({ status: 'failed', error: 'Template not found', attempts: (row.attempts ?? 0) + 1 })
        .eq('id', row.id)
      failed++
      continue
    }

    const variables = (row.resolved_variables ?? {}) as Record<string, string>
    const subject = resolveVariables(template.subject, variables)
    const html = resolveVariables(template.body, variables)

    const result = await sendEmail({
      to: row.recipient_email as string,
      subject,
      html,
      fromName: (emailSettings as { from_name?: string } | null)?.from_name ?? undefined,
      fromEmail: (emailSettings as { from_email?: string } | null)?.from_email ?? undefined,
    })

    if (result) {
      await supabase
        .from('email_queue')
        .update({ status: 'sent', sent_at: new Date().toISOString() })
        .eq('id', row.id)
      processed++
    } else {
      const attempts = (row.attempts ?? 0) + 1
      await supabase
        .from('email_queue')
        .update({ attempts, status: attempts >= 3 ? 'failed' : 'pending', error: 'Send failed' })
        .eq('id', row.id)
      failed++
    }
  }

  return NextResponse.json({ processed, failed })
}
