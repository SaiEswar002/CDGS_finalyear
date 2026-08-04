import pino from 'pino'
import { config } from '../config'

/**
 * Shared pino logger instance.
 *
 * In development, uses pino-pretty for human-readable output.
 * In production, outputs NDJSON for log aggregation (Datadog, Loki, etc.).
 *
 * Level is controlled by the LOG_LEVEL environment variable.
 */
export const logger = pino({
  level: config.logLevel,
  ...(config.isProduction
    ? {
        // Production: raw NDJSON — fast and aggregator-friendly
        formatters: {
          level: (label: string) => ({ level: label }),
        },
        timestamp: pino.stdTimeFunctions.isoTime,
      }
    : {
        // Development: pretty-printed output via pino-pretty transport
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:HH:MM:ss',
            ignore: 'pid,hostname',
          },
        },
      }),
})
