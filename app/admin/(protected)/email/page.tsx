import { redirect } from 'next/navigation'

export default function EmailAdminRoot() {
  redirect('/admin/email/settings')
}
