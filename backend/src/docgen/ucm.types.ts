/**
 * Universal Code Model (UCM) Specification for CDGS.
 * Language-Agnostic Intermediate Representation for code entities,
 * API routes, database schemas, and architectural dependencies.
 */

export type UCMEntityKind =
  | 'repository'
  | 'project'
  | 'module'
  | 'package'
  | 'file'
  | 'class'
  | 'interface'
  | 'enum'
  | 'struct'
  | 'function'
  | 'method'
  | 'variable'
  | 'constant'
  | 'component'
  | 'hook'
  | 'controller'
  | 'service'
  | 'repository'
  | 'model'
  | 'entity'
  | 'route'
  | 'middleware'
  | 'schema'
  | 'database_table'
  | 'configuration'
  | 'dependency'

export type UCMRelationshipType =
  | 'CALLS'
  | 'IMPORTS'
  | 'USES'
  | 'DEPENDS_ON'
  | 'ROUTES_TO'
  | 'READS_FROM'
  | 'WRITES_TO'
  | 'PERSISTS'
  | 'RENDERS'
  | 'USES_API'
  | 'internal'
  | 'external'
  | 'framework'
  | 'database'

export interface UCMParameter {
  name: string
  type?: string
  description?: string
  defaultValue?: string
}

export interface UCMField {
  name: string
  type?: string
  description?: string
  isPrimaryKey?: boolean
  isNullable?: boolean
  defaultValue?: string
}

export interface UCMEntity {
  id: string
  name: string
  kind: UCMEntityKind
  language: string
  filePath: string
  startLine?: number
  endLine?: number
  description?: string
  descriptionSource?: 'docstring' | 'comment' | 'signature' | 'ai' | 'fallback'
  visibility?: 'public' | 'private' | 'protected' | 'package'
  parameters?: UCMParameter[]
  returnType?: string
  fields?: UCMField[]
  annotations?: string[]
  imports?: string[]
  exports?: string[]
  dependencies?: string[]
  parentId?: string
  childIds?: string[]
  relatedIds?: string[]
  calls?: string[]
  usedBy?: string[]
  relatedDatabaseTables?: string[]
  sourceCodeSnippet?: string
}

export interface UCMRouteParameter {
  name: string
  in: 'path' | 'query' | 'header' | 'body'
  type: string
  required?: boolean
  description?: string
}

export interface UCMRouteResponse {
  statusCode: number
  description: string
  schemaName?: string
}

export interface UCMRoute {
  id: string
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'OPTIONS' | 'HEAD'
  path: string
  originalPath: string
  handlerName: string
  handlerEntityId?: string
  controllerName?: string
  serviceName?: string
  repositoryName?: string
  targetDatabaseTable?: string
  summary?: string
  description?: string
  filePath: string
  startLine?: number
  endLine?: number
  parameters?: UCMRouteParameter[]
  requestSchemaName?: string
  requestSchemaId?: string
  responseSchemaName?: string
  responseSchemaId?: string
  responses?: UCMRouteResponse[]
  authRequired?: boolean
  middleware?: string[]
}

export interface UCMColumn {
  name: string
  type: string
  isPrimaryKey?: boolean
  isForeignKey?: boolean
  references?: { table: string; column: string }
  isNullable?: boolean
  defaultValue?: string
  description?: string
}

export interface UCMRelationship {
  targetTable: string
  type: 'one-to-one' | 'one-to-many' | 'many-to-many'
  foreignKeyColumn?: string
}

export interface UCMDatabaseTable {
  tableName: string
  entityName?: string
  filePath: string
  columns: UCMColumn[]
  relationships?: UCMRelationship[]
}

export interface UCMDependency {
  source: string
  target: string
  type: UCMRelationshipType
  sourceFile?: string
  sourceLine?: number
  description?: string
}

export interface UCMEnvVar {
  name: string
  isSecret: boolean
  sampleValue?: string
}

export interface UniversalCodeModel {
  metadata: {
    repoName: string
    commitSha: string
    languages: Record<string, number>
    primaryLanguage: string
    frameworks: string[]
    projectType: string
    configFiles: string[]
    totalFiles: number
    hasTests: boolean
    testFramework?: string
    hasDocker: boolean
    hasAuth: boolean
    envVars: UCMEnvVar[]
    runCommands: string[]
    repositoryTree: string
  }
  entities: UCMEntity[]
  routes: UCMRoute[]
  databaseTables: UCMDatabaseTable[]
  dependencies: UCMDependency[]
}
