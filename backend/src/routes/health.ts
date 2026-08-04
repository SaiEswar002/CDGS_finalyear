import { Router, type Request, type Response } from 'express'

/**
 * Health check router.
 *
 * @route GET /api/v1/health
 * @tag Health
 * @summary Returns server health status
 *
 * @swagger
 * /health:
 *   get:
 *     summary: Health check
 *     tags: [Health]
 *     description: Returns the current health status of the API server.
 *     responses:
 *       200:
 *         description: Server is healthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     status:
 *                       type: string
 *                       example: ok
 *                     uptime:
 *                       type: number
 *                       example: 42.3
 *                     timestamp:
 *                       type: string
 *                       format: date-time
 */
export const healthRouter = Router()

healthRouter.get('/', (_req: Request, res: Response): void => {
  res.json({
    success: true,
    data: {
      status: 'ok',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    },
  })
})
