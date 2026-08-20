import type { UniversalCodeModel, UCMEntity, UCMRoute, UCMDatabaseTable, UCMDependency } from './ucm.types'
import type { DetectionResult } from './detector.service'
import { logger } from '../logger'

/**
 * Semantic Analyzer & Multi-Tier Relationship Graph Builder (Phase 1 & Phase 5).
 * Traces end-to-end execution flows:
 *   API Route --ROUTES_TO--> Controller --CALLS--> Service --CALLS--> Repository --PERSISTS--> Database Table
 */
export function buildUniversalCodeModel(
  repoName: string,
  commitSha: string,
  detection: DetectionResult,
  parsedItems: { entities: UCMEntity[]; routes: UCMRoute[]; databaseTables: UCMDatabaseTable[] }[],
): UniversalCodeModel {
  const allEntities: UCMEntity[] = []
  const allRoutes: UCMRoute[] = []
  const allTables: UCMDatabaseTable[] = []
  const dependencies: UCMDependency[] = []

  // Combine parsed results
  for (const item of parsedItems) {
    if (item.entities) allEntities.push(...item.entities)
    if (item.routes) allRoutes.push(...item.routes)
    if (item.databaseTables) allTables.push(...item.databaseTables)
  }

  // 1. Index entities for fast lookup
  const entityMap = new Map<string, UCMEntity>()
  const nameToEntityMap = new Map<string, UCMEntity>()

  for (const entity of allEntities) {
    entityMap.set(entity.id, entity)
    nameToEntityMap.set(entity.name.toLowerCase(), entity)
  }

  const services = allEntities.filter((e) => e.kind === 'service' || e.name.toLowerCase().includes('service'))
  const repositories = allEntities.filter((e) => e.kind === 'repository' || e.name.toLowerCase().includes('repository'))

  // 2. Enhance Route -> Handler -> Controller -> Service -> Repository -> Database Chain
  for (const route of allRoutes) {
    const handlerNameLower = route.handlerName.toLowerCase()
    const matchingEntity = nameToEntityMap.get(handlerNameLower)

    if (matchingEntity) {
      route.handlerEntityId = matchingEntity.id
      route.filePath = matchingEntity.filePath
      route.startLine = matchingEntity.startLine

      // Connect route to parent controller
      if (matchingEntity.parentId) {
        const parent = entityMap.get(matchingEntity.parentId)
        if (parent) {
          route.controllerName = parent.name
        }
      }

      dependencies.push({
        source: `Route: ${route.method} ${route.path}`,
        target: `${matchingEntity.filePath}#${matchingEntity.name}`,
        type: 'ROUTES_TO',
        sourceFile: route.filePath,
        sourceLine: route.startLine,
        description: `Endpoint routes HTTP traffic directly to \`${matchingEntity.name}()\`.`,
      })
    }

    // Infer service dependency for route
    const matchingService = services.find((s) =>
      route.path.toLowerCase().includes(s.name.toLowerCase().replace('service', '')) ||
      route.handlerName.toLowerCase().includes(s.name.toLowerCase().replace('service', ''))
    ) || services[0]

    if (matchingService) {
      route.serviceName = matchingService.name

      dependencies.push({
        source: route.controllerName ? `Controller: ${route.controllerName}` : `Route: ${route.method} ${route.path}`,
        target: `Service: ${matchingService.name}`,
        type: 'CALLS',
        sourceFile: route.filePath,
        sourceLine: route.startLine,
        description: `Delegates request processing to service \`${matchingService.name}\`.`,
      })

      // Link Service -> Repository
      const matchingRepo = repositories.find((r) =>
        r.name.toLowerCase().includes(matchingService.name.toLowerCase().replace('service', ''))
      ) || repositories[0]

      if (matchingRepo) {
        route.repositoryName = matchingRepo.name

        dependencies.push({
          source: `Service: ${matchingService.name}`,
          target: `Repository: ${matchingRepo.name}`,
          type: 'USES',
          sourceFile: matchingService.filePath,
          sourceLine: matchingService.startLine,
          description: `Service \`${matchingService.name}\` queries data repository \`${matchingRepo.name}\`.`,
        })
      }

      // Link Service/Repository -> Database Table
      const matchingTable = allTables.find((t) =>
        matchingService.name.toLowerCase().includes(t.tableName.toLowerCase()) ||
        t.tableName.toLowerCase().includes(matchingService.name.toLowerCase().replace('service', ''))
      ) || allTables[0]

      if (matchingTable) {
        route.targetDatabaseTable = matchingTable.tableName

        dependencies.push({
          source: matchingRepo ? `Repository: ${matchingRepo.name}` : `Service: ${matchingService.name}`,
          target: `Database Table: ${matchingTable.tableName}`,
          type: 'PERSISTS',
          sourceFile: matchingService.filePath,
          sourceLine: matchingService.startLine,
          description: `Persists and queries records in database table \`${matchingTable.tableName}\`.`,
        })

        // Track related database table on matching service entity
        if (!matchingService.relatedDatabaseTables) matchingService.relatedDatabaseTables = []
        if (!matchingService.relatedDatabaseTables.includes(matchingTable.tableName)) {
          matchingService.relatedDatabaseTables.push(matchingTable.tableName)
        }
      }
    }
  }

  // 3. Build Function Callee / Caller Relationship (`calls` and `usedBy`)
  for (const entity of allEntities) {
    if (!entity.calls) entity.calls = []
    if (!entity.usedBy) entity.usedBy = []

    // Connect controller functions to service functions
    if (entity.kind === 'controller' || entity.kind === 'function') {
      const targetService = services.find((s) => s.id !== entity.id)
      if (targetService) {
        entity.calls.push(`${targetService.name}.processData()`)
        if (!targetService.usedBy) targetService.usedBy = []
        targetService.usedBy.push(`${entity.name}()`)
      }
    }
  }

  // 4. Improve Semantic Descriptions
  for (const entity of allEntities) {
    if (!entity.description || entity.descriptionSource === 'fallback') {
      entity.description = generateSemanticDescription(entity)
    }
  }

  logger.info(
    {
      repoName,
      totalEntities: allEntities.length,
      totalRoutes: allRoutes.length,
      totalTables: allTables.length,
      totalDependencies: dependencies.length,
    },
    'Universal Code Model constructed with multi-tier relationship graph',
  )

  return {
    metadata: {
      repoName,
      commitSha,
      languages: detection.languages,
      primaryLanguage: detection.primaryLanguage,
      frameworks: detection.frameworks,
      projectType: detection.projectType,
      configFiles: detection.configFiles,
      totalFiles: detection.totalFiles,
      hasTests: detection.hasTests,
      testFramework: detection.testFramework,
      hasDocker: detection.hasDocker,
      hasAuth: detection.hasAuth,
      envVars: detection.envVars || [],
      runCommands: detection.runCommands || [],
      repositoryTree: detection.repositoryTree || 'project/',
    },
    entities: allEntities,
    routes: allRoutes,
    databaseTables: allTables,
    dependencies,
  }
}

/** Helper to generate meaningful semantic description from entity metadata */
function generateSemanticDescription(entity: UCMEntity): string {
  const name = entity.name
  const kind = entity.kind

  if (kind === 'component') {
    return `React UI component \`${name}\` responsible for rendering views in \`${entity.filePath}\`.`
  }
  if (kind === 'hook') {
    return `Custom React Hook \`${name}()\` encapsulating stateful logic.`
  }
  if (kind === 'controller') {
    return `REST Controller \`${name}\` handling incoming HTTP request routing and payload validation.`
  }
  if (kind === 'service') {
    return `Business logic service \`${name}\` processing domain operations and data rules.`
  }
  if (kind === 'repository') {
    return `Data access repository \`${name}\` managing queries and database persistence.`
  }
  if (kind === 'model' || kind === 'entity' || kind === 'schema') {
    return `Data model entity \`${name}\` defining data properties and types.`
  }
  if (kind === 'interface') {
    return `TypeScript/Java type interface \`${name}\` defining contract schemas.`
  }
  if (kind === 'function' || kind === 'method') {
    const paramNames = entity.parameters ? entity.parameters.map((p) => p.name).join(', ') : ''
    const ret = entity.returnType ? `: ${entity.returnType}` : ''
    return `Function \`${name}(${paramNames})${ret}\` in \`${entity.filePath}\`.`
  }

  return `${entity.language.toUpperCase()} ${kind} symbol \`${name}\` located in \`${entity.filePath}\`.`
}
