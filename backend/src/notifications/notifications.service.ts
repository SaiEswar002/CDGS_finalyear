import { getSupabaseClient } from '../db/supabaseClient'
import { logger } from '../logger'

export interface CreateNotificationInput {
  userId: string
  repositoryId?: string | null
  pipelineRunId?: string | null
  type: 'push_received' | 'pipeline_queued' | 'pipeline_success' | 'pipeline_failed' | 'docs_generated'
  title: string
  body: string
  commitSha?: string | null
  branch?: string | null
}

/**
 * Creates an in-app notification for a user.
 * Fire-and-forget — never throws, only logs on failure.
 */
export async function createNotification(input: CreateNotificationInput): Promise<void> {
  try {
    const supabase = getSupabaseClient()
    const { error } = await supabase.from('notifications').insert({
      user_id: input.userId,
      repository_id: input.repositoryId ?? null,
      pipeline_run_id: input.pipelineRunId ?? null,
      type: input.type,
      title: input.title,
      body: input.body,
      commit_sha: input.commitSha ?? null,
      branch: input.branch ?? null,
      is_read: false,
    })
    if (error) {
      logger.warn({ err: error, userId: input.userId, type: input.type }, 'Failed to insert notification')
    }
  } catch (err) {
    logger.warn({ err, userId: input.userId }, 'createNotification threw unexpectedly')
  }
}

/**
 * Lists notifications for a user, newest first.
 */
export async function listNotifications(
  userId: string,
  options: { unreadOnly?: boolean; limit?: number } = {},
): Promise<{ notifications: any[]; unreadCount: number }> {
  const supabase = getSupabaseClient()
  const limit = options.limit ?? 25

  let query = supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (options.unreadOnly) {
    query = query.eq('is_read', false)
  }

  const { data, error } = await query

  if (error) {
    logger.error({ err: error, userId }, 'Failed to fetch notifications')
    throw new Error('Failed to fetch notifications')
  }

  // Fetch unread count separately
  const { count } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('is_read', false)

  return {
    notifications: data ?? [],
    unreadCount: count ?? 0,
  }
}

/**
 * Marks one or all notifications as read for a user.
 */
export async function markNotificationsRead(
  userId: string,
  notificationId?: string,
): Promise<void> {
  const supabase = getSupabaseClient()

  let query = supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('user_id', userId)

  if (notificationId) {
    query = query.eq('id', notificationId)
  }

  const { error } = await query
  if (error) {
    logger.error({ err: error, userId, notificationId }, 'Failed to mark notifications as read')
    throw new Error('Failed to mark notifications as read')
  }
}
