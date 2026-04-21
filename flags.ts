import { flag } from 'flags/next'
import { vercelAdapter } from '@flags-sdk/vercel'

export const hospitableBookingFlag = flag<boolean>({
  key: 'hospitable-booking',
  adapter: vercelAdapter(),
  description: 'Show Hospitable booking widget on room detail pages',
  defaultValue: false,
  options: [
    { value: false, label: 'Off' },
    { value: true, label: 'On' },
  ],
})
