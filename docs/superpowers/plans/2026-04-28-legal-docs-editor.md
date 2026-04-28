# Legal Docs Editor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Privacy Policy and Terms of Service fully editable via a TipTap WYSIWYG editor in the admin Settings page, stored in the DB and rendered on the public pages.

**Architecture:** Two new `TEXT` columns (`privacy_policy_html`, `terms_of_service_html`) plus a `legal_last_updated TIMESTAMPTZ` column are added to `site_settings` and seeded with the current hardcoded content. A new `LegalDocEditor` component wraps TipTap with a formatting toolbar. A "Legal" tab is added to `SettingsForm`. The public pages (`/privacypolicy`, `/termsandconditions`) become thin server-component wrappers that fetch from the DB and render the stored HTML.

**Tech Stack:** Next.js 14 App Router, TipTap v3 (`@tiptap/react`, `@tiptap/starter-kit`, `@tiptap/extension-link`, `@tiptap/extension-underline` — all already installed), Supabase, Tailwind CSS

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `supabase/migrations/035_legal_docs.sql` | Add 3 columns to `site_settings`, seed with current content |
| Modify | `types/index.ts` | Add 3 fields to `SiteSettings` interface |
| Modify | `app/api/admin/settings/route.ts` | Allow the 3 new fields through the PATCH allowlist |
| Create | `components/admin/LegalDocEditor.tsx` | Reusable TipTap WYSIWYG editor with toolbar |
| Modify | `components/admin/SettingsForm.tsx` | Add "Legal" tab with two `LegalDocEditor` instances |
| Modify | `app/(public)/privacypolicy/page.tsx` | Fetch from DB, render stored HTML |
| Modify | `app/(public)/termsandconditions/page.tsx` | Fetch from DB, render stored HTML |

---

## Task 1: DB Migration

**Files:**
- Create: `supabase/migrations/035_legal_docs.sql`

- [ ] **Step 1: Write the migration file**

```sql
-- supabase/migrations/035_legal_docs.sql
ALTER TABLE site_settings
  ADD COLUMN IF NOT EXISTS privacy_policy_html  TEXT,
  ADD COLUMN IF NOT EXISTS terms_of_service_html TEXT,
  ADD COLUMN IF NOT EXISTS legal_last_updated    TIMESTAMPTZ;

UPDATE site_settings
SET
  privacy_policy_html = $PRIV$<h2>1. Information We Collect</h2><p>We collect the following categories of information:</p><ul><li><strong>Personal identifiers:</strong> Full name, email address, and phone number provided at booking.</li><li><strong>Payment information:</strong> Credit and debit card details processed securely by Stripe. We do not store full card numbers.</li><li><strong>Booking data:</strong> Check-in and check-out dates, room selections, stay duration, booking type, and transaction history.</li><li><strong>Communication preferences:</strong> SMS and marketing consent choices you make during the booking process.</li><li><strong>Usage data:</strong> Browser type, IP address, and pages visited, collected automatically when you use our website.</li></ul><h2>2. How We Use Your Information</h2><p>We use the information we collect to:</p><ul><li>Process and confirm your booking reservations.</li><li>Send transactional communications including booking confirmations, check-in instructions, and important updates via email and SMS.</li><li>Process payments and issue refunds through Stripe.</li><li>Maintain our customer relationship management (CRM) system via GoHighLevel.</li><li>Respond to your inquiries and provide customer support.</li><li>Send marketing communications about promotions and availability, only if you have provided explicit consent.</li><li>Comply with legal obligations.</li></ul><h2>3. Text Message Communications</h2><p>By providing your mobile phone number, you may receive text messages from Top of the Hill Estates, LLC. We operate under the A2P 10DLC (Application-to-Person) messaging framework.</p><p><strong>Non-marketing messages:</strong> If you provide a phone number during booking, you consent to receive transactional SMS messages related to your reservation (booking confirmation, check-in details, updates). These messages are necessary for your booking and are sent even without additional marketing consent.</p><p><strong>Marketing messages:</strong> Promotional messages — including special offers and availability updates — are sent only if you specifically opt in during the booking process.</p><p><strong>Opting out:</strong> You may opt out of text messages at any time by replying <strong>STOP</strong> to any message. After opting out, you will receive a single confirmation message and no further texts (except as required by law). To re-subscribe, reply <strong>START</strong>.</p><p>Message and data rates may apply. Message frequency varies.</p><h2>4. Information Sharing</h2><p>We do not sell your personal information. We share information only with trusted service providers necessary to operate our business:</p><ul><li><strong>Stripe:</strong> For secure payment processing.</li><li><strong>GoHighLevel:</strong> For CRM and communication management. Data is used solely to manage your relationship with us.</li><li><strong>Hosting and infrastructure providers</strong> who process data on our behalf under confidentiality agreements.</li></ul><p>We will not share your data with third-party marketing organizations without your explicit consent. We may disclose information if required by law or to protect the rights and safety of our guests and property.</p><h2>5. Data Security</h2><p>We take reasonable technical and organizational measures to protect your personal information from unauthorized access, disclosure, alteration, or destruction. Payment data is handled exclusively by Stripe, which maintains PCI DSS compliance. Our database is hosted on Supabase with encrypted connections and access controls.</p><p>Despite our efforts, no method of transmission over the internet or electronic storage is 100% secure. Please contact us immediately at <a href="mailto:info@tothrooms.com">info@tothrooms.com</a> if you suspect any unauthorized use of your account.</p><h2>6. Your Rights</h2><p>You have the following rights regarding your personal information:</p><ul><li><strong>Access:</strong> Request a copy of the personal data we hold about you.</li><li><strong>Correction:</strong> Request correction of inaccurate or incomplete data.</li><li><strong>Deletion:</strong> Request deletion of your personal data, subject to legal retention requirements.</li><li><strong>Opt-out of SMS:</strong> Reply STOP to any text message at any time.</li><li><strong>Opt-out of email marketing:</strong> Use the unsubscribe link in any marketing email.</li></ul><p>To exercise any of these rights, contact us at <a href="mailto:info@tothrooms.com">info@tothrooms.com</a>.</p><h2>7. Contact Information</h2><p>For privacy-related questions or to exercise your rights, contact Top of the Hill Estates, LLC:</p><p>Top of the Hill Estates, LLC<br>Mesa/Tempe, Arizona<br>Email: <a href="mailto:info@tothrooms.com">info@tothrooms.com</a></p><h2>8. Updates to This Policy</h2><p>We may update this Privacy Policy from time to time. When we do, we will revise the "Last updated" date at the top of this page. We encourage you to review this policy periodically. Continued use of our services after changes are posted constitutes your acceptance of the revised policy.</p>$PRIV$,
  terms_of_service_html = $TERMS$<p>Please read these Terms and Conditions carefully before booking a room with Top of the Hill Estates, LLC. By completing a booking, you agree to be bound by these Terms.</p><h2>1. Acceptance of Terms</h2><p>By accessing our website and making a reservation, you confirm that you are at least 18 years of age, have the legal capacity to enter into a binding agreement, and agree to these Terms in full. If you do not agree, please do not proceed with a booking.</p><h2>2. Booking and Reservation Policy</h2><p>All reservations are subject to availability. A booking is confirmed only after we receive full payment (or an approved deposit, for eligible long-term stays) and you receive a written confirmation with a booking reference number.</p><p>You are responsible for ensuring that all guest information provided at booking is accurate. Discrepancies may result in denied check-in. Reservations are non-transferable.</p><h2>3. Payment Terms</h2><p>All payments are processed securely through Stripe. By providing payment information, you authorize us to charge the applicable amount.</p><ul><li><strong>Short-term bookings:</strong> Full payment is due at the time of booking, unless otherwise stated.</li><li><strong>Long-term bookings:</strong> A deposit is required to confirm the reservation. The remaining balance is due at check-in per the terms disclosed at the time of booking.</li><li>All rates are quoted in U.S. dollars and are subject to applicable taxes and fees as disclosed during checkout.</li><li>We reserve the right to correct pricing errors. If an error is discovered after booking, we will notify you and offer a full refund or the corrected rate.</li></ul><h2>4. Cancellation Policy</h2><p><strong>Short-term Stays</strong></p><ul><li>Cancellation more than <strong>7 days</strong> before check-in: Full refund.</li><li>Cancellation more than <strong>72 hours</strong> but 7 days or less before check-in: 50% refund of the total booking amount.</li><li>Cancellation <strong>72 hours or less</strong> before check-in: No refund.</li></ul><p><strong>Long-term Stays</strong></p><ul><li>All deposits for long-term reservations are <strong>non-refundable</strong>.</li><li>Early termination of a long-term stay may result in forfeiture of remaining rent owed, as outlined in your rental agreement.</li></ul><p>Refunds, where applicable, are processed to the original payment method within 5–10 business days. We are not responsible for delays caused by your financial institution.</p><h2>5. Guest Responsibilities</h2><p>As a guest, you agree to:</p><ul><li>Comply with all posted house rules and community guidelines for your property.</li><li>Treat the room and common areas with reasonable care. You are financially responsible for any damages beyond normal wear and tear caused by you or your guests.</li><li>Not exceed the stated maximum occupancy for your room.</li><li>Maintain reasonable noise levels and respect other residents and neighbors.</li><li>Immediately report any maintenance issues, safety concerns, or property damage to management.</li></ul><h2>6. Check-in / Check-out Procedures</h2><p>Check-in time and check-out time will be communicated in your booking confirmation. Early check-in and late check-out are subject to availability and may incur additional charges. Failure to vacate by the stated check-out time may result in additional fees.</p><p>You must present a valid government-issued photo ID at check-in. We reserve the right to deny entry if identity cannot be verified.</p><h2>7. Prohibited Uses</h2><p>The following are strictly prohibited and may result in immediate removal without refund:</p><ul><li>Subletting or re-renting the room to another party.</li><li>Use of the premises for any illegal activities.</li><li>Unauthorized parties or gatherings exceeding the maximum occupancy.</li><li>Smoking inside any building. Designated smoking areas, if available, will be communicated at check-in.</li><li>Pets, unless explicitly authorized in writing by management.</li><li>Any behavior that endangers the safety of other residents or staff.</li></ul><h2>8. Liability Limitations</h2><p>To the maximum extent permitted by applicable law, Top of the Hill Estates, LLC is not liable for any indirect, incidental, special, or consequential damages arising from your stay or use of our services, including but not limited to loss of personal property, injury, or disruption of your stay due to circumstances beyond our reasonable control (including but not limited to natural disasters, utility outages, or force majeure events).</p><p>We are not responsible for the loss or theft of personal belongings. We recommend securing valuables and obtaining appropriate travel or renters' insurance.</p><p>Our total liability to you for any claim shall not exceed the amount you paid for the specific booking giving rise to the claim.</p><h2>9. Governing Law</h2><p>These Terms are governed by and construed in accordance with the laws of the State of Arizona, without regard to its conflict of law principles. Any disputes arising from these Terms or your use of our services shall be subject to the exclusive jurisdiction of the courts located in Maricopa County, Arizona.</p><h2>10. Contact Information</h2><p>If you have questions about these Terms, please contact us:</p><p>Top of the Hill Estates, LLC<br>Mesa/Tempe, Arizona<br>Email: <a href="mailto:info@tothrooms.com">info@tothrooms.com</a></p>$TERMS$,
  legal_last_updated = NOW()
WHERE privacy_policy_html IS NULL;
```

- [ ] **Step 2: Apply the migration via Supabase MCP**

Use the `mcp__supabase__apply_migration` tool with:
- `name`: `035_legal_docs`
- `query`: the full SQL content above

- [ ] **Step 3: Verify columns exist**

Run via `mcp__supabase__execute_sql`:
```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'site_settings'
  AND column_name IN ('privacy_policy_html','terms_of_service_html','legal_last_updated');
```

Expected: 3 rows returned.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/035_legal_docs.sql
git commit -m "feat: add privacy_policy_html, terms_of_service_html, legal_last_updated to site_settings"
```

---

## Task 2: Update Types and API

**Files:**
- Modify: `types/index.ts` — add 3 fields to `SiteSettings`
- Modify: `app/api/admin/settings/route.ts` — allow the 3 new fields

- [ ] **Step 1: Add fields to `SiteSettings` in `types/index.ts`**

Find the `SiteSettings` interface (around line 292) and add after `ai_prompts`:

```typescript
  privacy_policy_html?: string | null
  terms_of_service_html?: string | null
  legal_last_updated?: string | null
```

- [ ] **Step 2: Allow fields in the settings PATCH API**

In `app/api/admin/settings/route.ts`, after the `ai_prompts` line (around line 35), add:

```typescript
  if (body.privacy_policy_html !== undefined) fields.privacy_policy_html = body.privacy_policy_html
  if (body.terms_of_service_html !== undefined) fields.terms_of_service_html = body.terms_of_service_html
  if (body.privacy_policy_html !== undefined || body.terms_of_service_html !== undefined) {
    fields.legal_last_updated = new Date().toISOString()
  }
```

- [ ] **Step 3: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | grep "types/index.ts\|api/admin/settings"
```

Expected: no output (no errors in those files).

- [ ] **Step 4: Commit**

```bash
git add types/index.ts app/api/admin/settings/route.ts
git commit -m "feat: add legal doc fields to SiteSettings type and settings API"
```

---

## Task 3: LegalDocEditor Component

**Files:**
- Create: `components/admin/LegalDocEditor.tsx`

- [ ] **Step 1: Create the component**

```tsx
'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import Link from '@tiptap/extension-link'
import { useEffect, useCallback } from 'react'

interface Props {
  value: string
  onChange: (html: string) => void
  placeholder?: string
}

function ToolbarButton({
  onClick,
  active,
  title,
  children,
}: {
  onClick: () => void
  active?: boolean
  title: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`px-2 py-1 rounded text-sm font-medium transition-colors ${
        active
          ? 'bg-secondary/20 text-secondary'
          : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container'
      }`}
    >
      {children}
    </button>
  )
}

export default function LegalDocEditor({ value, onChange, placeholder }: Props) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Link.configure({ openOnClick: false, autolink: true }),
    ],
    content: value || '',
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML())
    },
  })

  // Sync external value changes (e.g. initial load after DB fetch)
  useEffect(() => {
    if (!editor) return
    if (editor.getHTML() !== value) {
      editor.commands.setContent(value || '', false)
    }
  }, [value, editor])

  const setLink = useCallback(() => {
    if (!editor) return
    const prev = editor.getAttributes('link').href as string | undefined
    const url = window.prompt('URL', prev ?? 'https://')
    if (url === null) return
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run()
      return
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
  }, [editor])

  if (!editor) return null

  return (
    <div className="rounded-xl border border-outline-variant overflow-hidden">
      {/* Toolbar */}
      <div className="flex flex-wrap gap-0.5 px-2 py-1.5 border-b border-outline-variant bg-surface-container/50">
        <ToolbarButton
          title="Bold"
          onClick={() => editor.chain().focus().toggleBold().run()}
          active={editor.isActive('bold')}
        >
          <strong>B</strong>
        </ToolbarButton>
        <ToolbarButton
          title="Italic"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          active={editor.isActive('italic')}
        >
          <em>I</em>
        </ToolbarButton>
        <ToolbarButton
          title="Underline"
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          active={editor.isActive('underline')}
        >
          <span className="underline">U</span>
        </ToolbarButton>
        <span className="w-px bg-outline-variant mx-1 self-stretch" />
        <ToolbarButton
          title="Heading 2"
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          active={editor.isActive('heading', { level: 2 })}
        >
          H2
        </ToolbarButton>
        <ToolbarButton
          title="Heading 3"
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          active={editor.isActive('heading', { level: 3 })}
        >
          H3
        </ToolbarButton>
        <span className="w-px bg-outline-variant mx-1 self-stretch" />
        <ToolbarButton
          title="Bullet list"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          active={editor.isActive('bulletList')}
        >
          &#8226; List
        </ToolbarButton>
        <ToolbarButton
          title="Ordered list"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          active={editor.isActive('orderedList')}
        >
          1. List
        </ToolbarButton>
        <span className="w-px bg-outline-variant mx-1 self-stretch" />
        <ToolbarButton
          title="Link"
          onClick={setLink}
          active={editor.isActive('link')}
        >
          Link
        </ToolbarButton>
      </div>

      {/* Editor area */}
      <EditorContent
        editor={editor}
        className="prose prose-sm prose-invert max-w-none min-h-[300px] px-4 py-3 bg-surface-highest/40 text-on-surface focus-within:outline-none [&_.ProseMirror]:outline-none [&_.ProseMirror]:min-h-[280px]"
        placeholder={placeholder}
      />
    </div>
  )
}
```

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | grep "LegalDocEditor"
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add components/admin/LegalDocEditor.tsx
git commit -m "feat: add LegalDocEditor TipTap WYSIWYG component"
```

---

## Task 4: Add Legal Tab to SettingsForm

**Files:**
- Modify: `components/admin/SettingsForm.tsx`

- [ ] **Step 1: Add import for LegalDocEditor**

At the top of `components/admin/SettingsForm.tsx`, after the existing imports, add:

```typescript
import dynamic from 'next/dynamic'

const LegalDocEditor = dynamic(() => import('./LegalDocEditor'), { ssr: false })
```

(Dynamic import is required because TipTap uses browser-only APIs.)

- [ ] **Step 2: Extend `SettingsTab` type**

Find line 55:
```typescript
type SettingsTab = 'general' | 'booking' | 'ai'
```
Change to:
```typescript
type SettingsTab = 'general' | 'booking' | 'ai' | 'legal'
```

- [ ] **Step 3: Add legal state to the form**

In `SettingsForm`, after the `const [tab, setTab]` line (around line 132), add:

```typescript
  const [privacyHtml, setPrivacyHtml] = useState(settings.privacy_policy_html ?? '')
  const [tosHtml, setTosHtml] = useState(settings.terms_of_service_html ?? '')
```

- [ ] **Step 4: Add "Legal" entry to `settingsTabs`**

Find the `settingsTabs` array (around line 333):
```typescript
  const settingsTabs = [
    { id: 'general', label: 'General', icon: '⚙' },
    { id: 'booking', label: 'Booking', icon: '📋' },
    { id: 'ai', label: 'AI Prompts', icon: '✨' },
  ]
```
Change to:
```typescript
  const settingsTabs = [
    { id: 'general', label: 'General', icon: '⚙' },
    { id: 'booking', label: 'Booking', icon: '📋' },
    { id: 'ai', label: 'AI Prompts', icon: '✨' },
    { id: 'legal', label: 'Legal', icon: '📄' },
  ]
```

- [ ] **Step 5: Add legal fields to `handleSubmit` payload**

In `handleSubmit` (around line 308), the `body` passed to `JSON.stringify` currently ends with `ai_prompts`. Add the two legal fields:

```typescript
        body: JSON.stringify({
          ...form,
          business_hours: JSON.stringify(hours),
          global_house_rules: form.global_house_rules,
          cancellation_policy: JSON.stringify(cancellationPolicy),
          ai_prompts: JSON.stringify(aiPrompts),
          privacy_policy_html: privacyHtml,
          terms_of_service_html: tosHtml,
        }),
```

- [ ] **Step 6: Add Legal tab render block**

In `SettingsForm`, after the closing `)}` of the AI Prompts tab block (around line 719) and before the Save button section, add:

```tsx
        {/* ── Tab: Legal ── */}
        {tab === 'legal' && (
          <div className="space-y-10">
            <section className="space-y-3">
              <div>
                <h2 className="font-display text-base font-semibold text-on-surface">Privacy Policy</h2>
                <p className="text-xs text-on-surface-variant/60 mt-0.5">
                  Displayed at <code className="text-secondary">/privacypolicy</code>. Use the toolbar to format headings, lists, bold, and links.
                </p>
              </div>
              <LegalDocEditor value={privacyHtml} onChange={setPrivacyHtml} />
            </section>

            <section className="space-y-3">
              <div>
                <h2 className="font-display text-base font-semibold text-on-surface">Terms &amp; Conditions</h2>
                <p className="text-xs text-on-surface-variant/60 mt-0.5">
                  Displayed at <code className="text-secondary">/termsandconditions</code>.
                </p>
              </div>
              <LegalDocEditor value={tosHtml} onChange={setTosHtml} />
            </section>
          </div>
        )}
```

- [ ] **Step 7: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | grep "SettingsForm"
```

Expected: no output.

- [ ] **Step 8: Commit**

```bash
git add components/admin/SettingsForm.tsx
git commit -m "feat: add Legal tab with TipTap editors to SettingsForm"
```

---

## Task 5: Update Public Pages

**Files:**
- Modify: `app/(public)/privacypolicy/page.tsx`
- Modify: `app/(public)/termsandconditions/page.tsx`

- [ ] **Step 1: Rewrite `privacypolicy/page.tsx`**

Replace the entire file content with:

```tsx
import type { Metadata } from 'next'
import { createServiceRoleClient } from '@/lib/supabase'
import { format } from 'date-fns'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Privacy Policy | Top of the Hill Rooms',
  description: 'Privacy Policy for Top of the Hill Rooms — Top of the Hill Estates, LLC',
}

export default async function PrivacyPolicyPage() {
  const supabase = createServiceRoleClient()
  const { data } = await supabase
    .from('site_settings')
    .select('privacy_policy_html, legal_last_updated')
    .single()

  const html = data?.privacy_policy_html ?? ''
  const lastUpdated = data?.legal_last_updated
    ? format(new Date(data.legal_last_updated), 'MMMM d, yyyy')
    : null

  return (
    <main className="min-h-screen bg-surface-low py-16 px-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="font-display text-4xl font-bold text-primary mb-2">Privacy Policy</h1>
        {lastUpdated && (
          <p className="font-body text-on-surface-variant mb-12">Last updated: {lastUpdated}</p>
        )}

        {html ? (
          <div
            className="space-y-6 font-body text-on-surface-variant leading-relaxed
              [&_h2]:font-display [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-primary [&_h2]:mt-8 [&_h2]:mb-3
              [&_h3]:font-display [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:text-on-surface [&_h3]:mt-6 [&_h3]:mb-2
              [&_p]:mb-3
              [&_ul]:list-disc [&_ul]:list-inside [&_ul]:space-y-2 [&_ul]:mt-3
              [&_ol]:list-decimal [&_ol]:list-inside [&_ol]:space-y-2 [&_ol]:mt-3
              [&_strong]:text-on-surface [&_strong]:font-semibold
              [&_a]:text-secondary [&_a]:hover:underline"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        ) : (
          <p className="font-body text-on-surface-variant">Privacy policy content coming soon.</p>
        )}
      </div>
    </main>
  )
}
```

- [ ] **Step 2: Rewrite `termsandconditions/page.tsx`**

Replace the entire file content with:

```tsx
import type { Metadata } from 'next'
import { createServiceRoleClient } from '@/lib/supabase'
import { format } from 'date-fns'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Terms and Conditions | Top of the Hill Rooms',
  description: 'Terms and Conditions for booking with Top of the Hill Rooms — Top of the Hill Estates, LLC',
}

export default async function TermsAndConditionsPage() {
  const supabase = createServiceRoleClient()
  const { data } = await supabase
    .from('site_settings')
    .select('terms_of_service_html, legal_last_updated')
    .single()

  const html = data?.terms_of_service_html ?? ''
  const lastUpdated = data?.legal_last_updated
    ? format(new Date(data.legal_last_updated), 'MMMM d, yyyy')
    : null

  return (
    <main className="min-h-screen bg-surface-low py-16 px-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="font-display text-4xl font-bold text-primary mb-2">Terms and Conditions</h1>
        {lastUpdated && (
          <p className="font-body text-on-surface-variant mb-12">Last updated: {lastUpdated}</p>
        )}

        {html ? (
          <div
            className="space-y-6 font-body text-on-surface-variant leading-relaxed
              [&_h2]:font-display [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-primary [&_h2]:mt-8 [&_h2]:mb-3
              [&_h3]:font-display [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:text-on-surface [&_h3]:mt-6 [&_h3]:mb-2
              [&_p]:mb-3
              [&_ul]:list-disc [&_ul]:list-inside [&_ul]:space-y-2 [&_ul]:mt-3
              [&_ol]:list-decimal [&_ol]:list-inside [&_ol]:space-y-2 [&_ol]:mt-3
              [&_strong]:text-on-surface [&_strong]:font-semibold
              [&_a]:text-secondary [&_a]:hover:underline"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        ) : (
          <p className="font-body text-on-surface-variant">Terms and conditions content coming soon.</p>
        )}
      </div>
    </main>
  )
}
```

- [ ] **Step 3: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | grep "privacypolicy\|termsandconditions"
```

Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add "app/(public)/privacypolicy/page.tsx" "app/(public)/termsandconditions/page.tsx"
git commit -m "feat: serve privacy policy and T&C from DB instead of hardcoded JSX"
```

---

## Task 6: Smoke Test

- [ ] **Step 1: Open the admin settings page**

Navigate to `http://localhost:3000/admin/settings`. Confirm the "Legal" tab appears in the tab bar.

- [ ] **Step 2: Verify editors load with seeded content**

Click the "Legal" tab. Both editors should show the seeded content (sections with headings and bullet lists visible in the editor).

- [ ] **Step 3: Make an edit and save**

Edit a word in the Privacy Policy editor. Click "Save Settings". Confirm the success toast/message appears.

- [ ] **Step 4: Verify public pages reflect the edit**

Navigate to `http://localhost:3000/privacypolicy`. The edit should be visible. The "Last updated" date should show today's date.

- [ ] **Step 5: Check `/termsandconditions`**

Navigate to `http://localhost:3000/termsandconditions`. Content should load correctly with proper heading/list styling.
