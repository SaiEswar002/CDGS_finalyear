import type { UCMEntity, UCMDatabaseTable, UCMColumn, UCMRelationship } from '../ucm.types'

/**
 * Database & Schema Parser.
 * Extracts database tables, columns, primary/foreign keys, and relationships
 * from SQL DDL scripts, Prisma schemas, and Mongoose model files.
 */
export function parseDatabaseFile(
  filePath: string,
  content: string,
): { entities: UCMEntity[]; databaseTables: UCMDatabaseTable[] } {
  const entities: UCMEntity[] = []
  const databaseTables: UCMDatabaseTable[] = []

  const isSql = filePath.endsWith('.sql')
  const isPrisma = filePath.endsWith('.prisma')

  if (isSql) {
    // 1. SQL DDL Table Extraction: CREATE TABLE table_name ( ... )
    const tableRegex = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([A-Za-z0-9_"\.]+)\s*\(([\s\S]*?)\);/gi
    let match: RegExpExecArray | null

    while ((match = tableRegex.exec(content)) !== null) {
      const rawTableName = match[1].replace(/["`]/g, '')
      const tableBody = match[2]
      const columns: UCMColumn[] = []
      const relationships: UCMRelationship[] = []

      const bodyLines = tableBody.split('\n')
      for (const line of bodyLines) {
        const trimmed = line.trim().replace(/,$/, '')
        if (!trimmed || trimmed.toUpperCase().startsWith('CONSTRAINT') || trimmed.toUpperCase().startsWith('PRIMARY KEY (')) {
          // Primary Key constraint line check
          if (trimmed.toUpperCase().startsWith('PRIMARY KEY (')) {
            const pkColMatch = /\(([^)]+)\)/.exec(trimmed)
            if (pkColMatch) {
              const pkColName = pkColMatch[1].replace(/["`]/g, '').trim()
              const targetCol = columns.find((c) => c.name === pkColName)
              if (targetCol) targetCol.isPrimaryKey = true
            }
          }
          continue
        }

        // Column line: column_name TYPE [NOT NULL] [PRIMARY KEY] [REFERENCES target(col)]
        const colMatch = /^([A-Za-z0-9_]+)\s+([A-Za-z0-9_\(\)]+)(.*)/i.exec(trimmed)
        if (colMatch) {
          const colName = colMatch[1]
          const colType = colMatch[2]
          const rest = colMatch[3]

          const isPrimaryKey = /PRIMARY\s+KEY/i.test(rest)
          const isNullable = !/NOT\s+NULL/i.test(rest)

          let isForeignKey = false
          let refObj: UCMColumn['references'] = undefined

          const fkMatch = /REFERENCES\s+([A-Za-z0-9_"]+)\s*\(([^)]+)\)/i.exec(rest)
          if (fkMatch) {
            isForeignKey = true
            const targetTable = fkMatch[1].replace(/["`]/g, '')
            const targetCol = fkMatch[2].replace(/["`]/g, '')
            refObj = { table: targetTable, column: targetCol }

            relationships.push({
              targetTable,
              type: 'one-to-many',
              foreignKeyColumn: colName,
            })
          }

          columns.push({
            name: colName,
            type: colType,
            isPrimaryKey,
            isNullable,
            isForeignKey,
            references: refObj,
          })
        }
      }

      databaseTables.push({
        tableName: rawTableName,
        filePath,
        columns,
        relationships,
      })

      entities.push({
        id: `entity-db-table-${filePath}-${rawTableName}`,
        name: rawTableName,
        kind: 'database_table',
        language: 'sql',
        filePath,
        description: `SQL Database Table \`${rawTableName}\` with ${columns.length} columns.`,
        descriptionSource: 'docstring',
        fields: columns.map((c) => ({
          name: c.name,
          type: c.type,
          isPrimaryKey: c.isPrimaryKey,
          isNullable: c.isNullable,
        })),
      })
    }
  } else if (isPrisma) {
    // 2. Prisma Schema Model Extraction: model User { ... }
    const modelRegex = /model\s+([A-Za-z0-9_]+)\s*\{([\s\S]*?)\}/g
    let match: RegExpExecArray | null

    while ((match = modelRegex.exec(content)) !== null) {
      const modelName = match[1]
      const modelBody = match[2]
      const columns: UCMColumn[] = []

      const lines = modelBody.split('\n')
      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('@@')) continue

        const parts = trimmed.split(/\s+/)
        if (parts.length >= 2) {
          const fieldName = parts[0]
          const fieldType = parts[1]
          const isPrimaryKey = trimmed.includes('@id')

          columns.push({
            name: fieldName,
            type: fieldType,
            isPrimaryKey,
            isNullable: fieldType.endsWith('?'),
          })
        }
      }

      databaseTables.push({
        tableName: modelName,
        filePath,
        columns,
      })

      entities.push({
        id: `entity-prisma-${filePath}-${modelName}`,
        name: modelName,
        kind: 'schema',
        language: 'prisma',
        filePath,
        description: `Prisma Data Model \`${modelName}\`.`,
        descriptionSource: 'docstring',
        fields: columns.map((c) => ({ name: c.name, type: c.type, isPrimaryKey: c.isPrimaryKey })),
      })
    }
  }

  return { entities, databaseTables }
}
