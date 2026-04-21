import { Resend } from 'resend'

let _client: Resend | null = null

function getClient(): Resend {
  if (!_client) _client = new Resend(process.env.RESEND_API_KEY ?? '')
  return _client
}

export async function sendEmail(params: {
  to: string | string[]
  subject: string
  html: string
  fromName?: string
  fromEmail?: string
}): Promise<string | null> {
  const fromEmail = params.fromEmail ?? process.env.EMAIL_FROM_ADDRESS ?? ''
  if (!fromEmail) {
    console.warn('sendEmail: no from address configured — skipping')
    return null
  }

  const fromName = params.fromName ?? 'Top of the Hill Estates'

  try {
    const { data, error } = await getClient().emails.send({
      from: `${fromName} <${fromEmail}>`,
      to: Array.isArray(params.to) ? params.to : [params.to],
      subject: params.subject,
      html: params.html,
    })

    if (error) {
      console.error('Resend send error:', error)
      return null
    }

    return data?.id ?? null
  } catch (err) {
    console.error('sendEmail error:', err)
    return null
  }
}

