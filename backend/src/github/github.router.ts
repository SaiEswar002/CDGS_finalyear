import { Router } from 'express'
import { authenticate } from '../middleware/authenticate'
import { getGitHubRepositories } from './github.controller'

export const githubRouter = Router()

githubRouter.use(authenticate)
githubRouter.get('/repos', getGitHubRepositories)
