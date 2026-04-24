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

export const iFrameFlag = flag<boolean>({
  key: 'iFrame',
  adapter: vercelAdapter(),
  description: 'Use iFrame settings if available. Must be ON for hApp to work. OFF = only show native booking platform.',
  defaultValue: false,
  options: [
    { value: false, label: 'Off — Only show native booking platform' },
    { value: true, label: 'On — Use iFrame settings if available' },
  ],
})

export const hAppFlag = flag<boolean>({
  key: 'hApp',
  adapter: vercelAdapter(),
  description: 'ON = only show iFrame booking when source=hApp. OFF = display based on iFrame flag settings. Requires iFrame to be ON.',
  defaultValue: false,
  options: [
    { value: false, label: 'Off — Display based on iFrame settings' },
    { value: true, label: 'On — Show iFrame only when source=hApp' },
  ],
})
