import swaggerJsdoc from 'swagger-jsdoc'
import swaggerUi from 'swagger-ui-express'
import { type Application } from 'express'
import { logger } from '../logger'

/**
 * OpenAPI / Swagger specification base config.
 * Route-level documentation is added via JSDoc @swagger comments
 * in each route file.
 */
const swaggerOptions: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.3',
    info: {
      title: 'DocOps API',
      version: '1.0.0',
      description:
        'Code Documentation Generation System — REST API reference.\n\n' +
        'This spec is populated progressively as phases are implemented.',
      contact: {
        name: 'DocOps Team',
        url: 'https://github.com/SaiEswar002/CDGS_finalyear',
      },
      license: {
        name: 'MIT',
      },
    },
    servers: [
      {
        url: '/api/v1',
        description: 'Current server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT token obtained from POST /api/v1/auth/token (Phase 2)',
        },
      },
      schemas: {
        SuccessResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            data: { type: 'object' },
          },
        },
        ErrorResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            error: {
              type: 'object',
              properties: {
                code: { type: 'string', example: 'NOT_FOUND' },
                message: { type: 'string', example: 'Resource not found' },
                details: { type: 'array', items: { type: 'object' } },
              },
            },
          },
        },
      },
    },
    tags: [
      { name: 'Health', description: 'Server health and diagnostics' },
      { name: 'Auth', description: 'Authentication (Phase 2)' },
      { name: 'Repositories', description: 'Repository management (Phase 2)' },
      { name: 'Runs', description: 'Documentation run management (Phase 3)' },
    ],
  },
  // Globs for route files containing @swagger JSDoc comments
  apis: ['./src/routes/**/*.ts'],
}

const swaggerSpec = swaggerJsdoc(swaggerOptions)

/**
 * Mounts the Swagger UI at /api/v1/docs.
 *
 * @param app - Express application instance
 */
export function mountSwagger(app: Application): void {
  app.use(
    '/api/v1/docs',
    swaggerUi.serve,
    swaggerUi.setup(swaggerSpec, {
      customSiteTitle: 'DocOps API Docs',
      swaggerOptions: {
        persistAuthorization: true,
      },
    }),
  )

  // Also expose the raw JSON spec for tooling
  app.get('/api/v1/docs.json', (_req, res) => {
    res.setHeader('Content-Type', 'application/json')
    res.send(swaggerSpec)
  })

  logger.info('Swagger UI mounted at /api/v1/docs')
}
