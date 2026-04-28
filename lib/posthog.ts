import { PostHog } from 'posthog-node'

export const posthogServer = new PostHog(
  process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN!,
  { host: process.env.NEXT_PUBLIC_POSTHOG_HOST }
)
