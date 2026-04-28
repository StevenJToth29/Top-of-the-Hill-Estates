import { SeverityNumber } from '@opentelemetry/api-logs'
import { loggerProvider } from '@/instrumentation'

const logger = loggerProvider.getLogger('top-of-the-hill-estates')

type LogAttributes = Record<string, string | number | boolean | undefined>

export const log = {
  info(message: string, attributes?: LogAttributes) {
    logger.emit({ body: message, severityNumber: SeverityNumber.INFO, attributes })
  },
  warn(message: string, attributes?: LogAttributes) {
    logger.emit({ body: message, severityNumber: SeverityNumber.WARN, attributes })
  },
  error(message: string, attributes?: LogAttributes) {
    logger.emit({ body: message, severityNumber: SeverityNumber.ERROR, attributes })
  },
}
