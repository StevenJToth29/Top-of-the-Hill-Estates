const GHL_BASE_URL = 'https://rest.gohighlevel.com/v1'

/**
 * Creates or updates a contact in GoHighLevel.
 * Returns the GHL contact ID on success, or null on failure.
 */
export async function createOrUpdateGHLContact(data: {
  firstName: string
  lastName: string
  email: string
  phone: string
  tags: string[]
  customFields: Record<string, string>
}): Promise<string | null> {
  const apiKey = process.env.GHL_API_KEY ?? ''
  if (!apiKey) {
    console.warn('GHL_API_KEY not set — skipping CRM sync')
    return null
  }

  try {
    const response = await fetch(`${GHL_BASE_URL}/contacts/`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        phone: data.phone,
        tags: data.tags,
        customField: data.customFields, // GHL API uses singular "customField"
      }),
    })

    if (!response.ok) {
      console.error('GHL contact creation failed:', response.status, await response.text())
      return null
    }

    const json = (await response.json()) as { contact?: { id?: string } }
    return json.contact?.id ?? null
  } catch (error) {
    console.error('GHL API error:', error)
    return null
  }
}

/**
 * Triggers a GoHighLevel automation workflow via webhook.
 */
export async function triggerGHLWorkflow(
  webhookUrl: string,
  payload: Record<string, unknown>,
): Promise<void> {
  if (!webhookUrl) {
    console.warn('GHL webhook URL not provided — skipping workflow trigger')
    return
  }

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      console.error('GHL workflow trigger failed:', response.status, await response.text())
    }
  } catch (error) {
    console.error('GHL workflow error:', error)
  }
}
