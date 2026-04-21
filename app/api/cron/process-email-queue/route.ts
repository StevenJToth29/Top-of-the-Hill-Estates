import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase'
import { sendEmail } from '@/lib/email'
import { resolveVariables } from '@/lib/email-variables'

async function handler(request: NextRequest) {
  if (request.headers.get('Authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceRoleClient()

  const [{ data: rows, error }, { data: emailSettings }] = await Promise.all([
    supabase
      .from('email_queue')
      .select('*, template:email_templates(subject, body)')
      .eq('status', 'pending')
      .lte('send_at', new Date().toISOString())
      .order('send_at')
      .limit(50),
    supabase.from('email_settings').select('from_name, from_email').maybeSingle(),
  ])

  if (error) {
    console.error('process-email-queue: failed to fetch rows:', error)
    return NextResponse.json({ error: 'Failed to fetch queue' }, { status: 500 })
  }

  const fromName = (emailSettings as { from_name?: string } | null)?.from_name ?? undefined
  const fromEmail = (emailSettings as { from_email?: string } | null)?.from_email ?? undefined
  const sentAt = new Date().toISOString()

  const results = await Promise.all(
    (rows ?? []).map(async (row) => {
      const template = row.template as { subject: string; body: string } | null

      if (!template) {
        await supabase
          .from('email_queue')
          .update({ status: 'failed', error: 'Template not found', attempts: (row.attempts ?? 0) + 1 })
          .eq('id', row.id)
        return false
      }

      const variables = (row.resolved_variables ?? {}) as Record<string, string>
      const subject = resolveVariables(template.subject, variables)
      const html = resolveVariables(template.body, variables)

      let ok = false
      try {
        ok = !!(await sendEmail({ to: row.recipient_email as string, subject, html, fromName, fromEmail }))
      } catch (sendErr) {
        console.error(`process-email-queue: exception sending row ${row.id}:`, sendErr)
      }

      if (ok) {
        await supabase.from('email_queue').update({ status: 'sent', sent_at: sentAt }).eq('id', row.id)
      } else {
        const attempts = (row.attempts ?? 0) + 1
        await supabase
          .from('email_queue')
          .update({ attempts, status: attempts >= 3 ? 'failed' : 'pending', error: 'Send failed' })
          .eq('id', row.id)
      }
      return ok
    }),
  )

  const processed = results.filter(Boolean).length
  const failed = results.filter((r) => !r).length
  return NextResponse.json({ processed, failed })
}

export const GET = handler
export const POST = handler
