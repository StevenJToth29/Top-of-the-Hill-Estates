import { Resend } from 'resend'
import sanitizeHtml from 'sanitize-html'

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

  const safeHtml = sanitizeHtml(params.html, {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat([
      'img', 'h1', 'h2', 'h3', 'table', 'thead', 'tbody', 'tr', 'th', 'td',
      'font', 'center', 'div', 'span', 'p', 'a', 'br', 'strong', 'em', 'ul', 'ol', 'li',
    ]),
    allowedAttributes: {
      ...sanitizeHtml.defaults.allowedAttributes,
      '*': ['style', 'class'],
      'a': ['href', 'target', 'rel'],
      'img': ['src', 'alt', 'width', 'height', 'style'],
      'td': ['colspan', 'rowspan', 'align', 'valign', 'bgcolor', 'width'],
      'table': ['cellpadding', 'cellspacing', 'border', 'width', 'bgcolor', 'align'],
    },
    allowedSchemes: ['http', 'https', 'mailto'],
  })

  try {
    const { data, error } = await getClient().emails.send({
      from: `${fromName} <${fromEmail}>`,
      to: Array.isArray(params.to) ? params.to : [params.to],
      subject: params.subject,
      html: safeHtml,
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

