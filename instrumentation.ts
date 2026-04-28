import { BatchLogRecordProcessor, LoggerProvider } from '@opentelemetry/sdk-logs'
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-http'
import { logs } from '@opentelemetry/api-logs'
import { resourceFromAttributes } from '@opentelemetry/resources'

export const loggerProvider = new LoggerProvider({
  resource: resourceFromAttributes({ 'service.name': 'top-of-the-hill-estates' }),
  processors: [
    new BatchLogRecordProcessor(
      new OTLPLogExporter({
        url: 'https://us.i.posthog.com/i/v1/logs',
        headers: {
          Authorization: `Bearer ${process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN}`,
          'Content-Type': 'application/json',
        },
      })
    ),
  ],
})

export function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    logs.setGlobalLoggerProvider(loggerProvider)
  }
}

export const onRequestError = async (
  err: { message: string; stack?: string },
  request: { headers: Record<string, string | string[] | undefined> },
) => {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { posthogServer } = await import('./lib/posthog')

    let distinctId: string | undefined
    const cookieHeader = request.headers['cookie']
    const cookieString = Array.isArray(cookieHeader) ? cookieHeader.join('; ') : (cookieHeader ?? '')
    const match = cookieString.match(/ph_phc_.*?_posthog=([^;]+)/)
    if (match?.[1]) {
      try {
        const parsed = JSON.parse(decodeURIComponent(match[1]))
        distinctId = parsed.distinct_id
      } catch {
        // cookie parse failed — proceed without distinct_id
      }
    }

    const error = err instanceof Error ? err : Object.assign(new Error(err.message), { stack: err.stack })
    await posthogServer.captureException(error, distinctId)
  }
}
