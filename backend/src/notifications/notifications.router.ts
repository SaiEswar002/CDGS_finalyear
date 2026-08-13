import { Router } from 'express'
import { authenticate } from '../middleware/authenticate'
import { listNotifications, markNotificationsRead } from './notifications.service'
import type { Request, Response, NextFunction } from 'express'

export const notificationsRouter = Router()

notificationsRouter.use(authenticate)

/**
 * GET /api/v1/notifications
 * List notifications for the authenticated user.
 * Query: ?unread=true&limit=25
 */
notificationsRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const unreadOnly = req.query.unread === 'true'
    const limit = Math.min(Number(req.query.limit ?? 25), 50)
    const result = await listNotifications(req.user!.id, { unreadOnly, limit })
    res.json({ success: true, data: result })
  } catch (err) {
    next(err)
  }
})

/**
 * POST /api/v1/notifications/read
 * Mark notifications as read.
 * Body: { id?: string }  — omit id to mark all as read.
 */
notificationsRouter.post('/read', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.body?.id as string | undefined
    await markNotificationsRead(req.user!.id, id)
    res.json({ success: true, message: id ? 'Notification marked as read.' : 'All notifications marked as read.' })
  } catch (err) {
    next(err)
  }
})
