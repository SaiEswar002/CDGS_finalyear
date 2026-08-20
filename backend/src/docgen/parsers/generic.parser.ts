import type { UCMEntity, UCMRoute, UCMParameter } from '../ucm.types'

/**
 * Generic Fallback Parser for Go, Rust, C/C++, C#, PHP, Ruby, Shell, etc.
 * Extracts symbols cleanly without failing on syntax nuances.
 */
export function parseGenericFile(
  filePath: string,
  content: string,
  language: string,
): { entities: UCMEntity[]; routes: UCMRoute[] } {
  const entities: UCMEntity[] = []
  const routes: UCMRoute[] = []

  const lines = content.split('\n')

  if (language === 'go') {
    // Go Functions
    const goFuncRegex = /func\s+(?:\([^)]+\)\s+)?([A-Za-z0-9_]+)\s*\(([^)]*)\)(?:\s*([^{\n]+))?/g
    let match: RegExpExecArray | null
    while ((match = goFuncRegex.exec(content)) !== null) {
      const fnName = match[1]
      const rawParams = match[2]
      const returnType = match[3] ? match[3].trim() : 'void'

      const parameters: UCMParameter[] = rawParams.trim()
        ? rawParams.split(',').map((p) => {
            const parts = p.trim().split(/\s+/)
            return { name: parts[0] || 'param', type: parts[1] || 'interface{}' }
          })
        : []

      entities.push({
        id: `entity-go-fn-${filePath}-${fnName}`,
        name: fnName,
        kind: 'function',
        language: 'go',
        filePath,
        description: `Go function \`${fnName}()\`.`,
        descriptionSource: 'signature',
        parameters,
        returnType,
      })
    }

    // Go Structs & Interfaces
    const goTypeRegex = /type\s+([A-Za-z0-9_]+)\s+(struct|interface)/g
    while ((match = goTypeRegex.exec(content)) !== null) {
      const typeName = match[1]
      const typeKind = match[2] === 'interface' ? 'interface' : 'struct'

      entities.push({
        id: `entity-go-type-${filePath}-${typeName}`,
        name: typeName,
        kind: typeKind,
        language: 'go',
        filePath,
        description: `Go ${typeKind} \`${typeName}\`.`,
        descriptionSource: 'signature',
      })
    }
  } else if (language === 'csharp' || language === 'cpp' || language === 'c') {
    // C#/C++ Classes & Structs
    const classRegex = /(?:class|struct|interface)\s+([A-Za-z0-9_]+)/g
    let match: RegExpExecArray | null
    while ((match = classRegex.exec(content)) !== null) {
      entities.push({
        id: `entity-${language}-${filePath}-${match[1]}`,
        name: match[1],
        kind: 'class',
        language,
        filePath,
        description: `${language.toUpperCase()} Class/Struct \`${match[1]}\`.`,
        descriptionSource: 'signature',
      })
    }
  } else if (language === 'ruby' || language === 'php') {
    // Ruby / PHP Functions & Classes
    const fnRegex = /(?:def|function)\s+([A-Za-z0-9_]+)/g
    let match: RegExpExecArray | null
    while ((match = fnRegex.exec(content)) !== null) {
      entities.push({
        id: `entity-${language}-fn-${filePath}-${match[1]}`,
        name: match[1],
        kind: 'function',
        language,
        filePath,
        description: `${language.toUpperCase()} function \`${match[1]}()\`.`,
        descriptionSource: 'signature',
      })
    }
  } else {
    // Generic fallback: Scan top-level definitions or functions
    for (let i = 0; i < Math.min(lines.length, 500); i++) {
      const line = lines[i].trim()
      const fnMatch = /(?:function|def|fn|func|proc)\s+([A-Za-z0-9_]+)/i.exec(line)
      if (fnMatch) {
        entities.push({
          id: `entity-fallback-${filePath}-${fnMatch[1]}`,
          name: fnMatch[1],
          kind: 'function',
          language,
          filePath,
          startLine: i + 1,
          description: `Symbol \`${fnMatch[1]}\` in \`${filePath}\`.`,
          descriptionSource: 'fallback',
        })
      }
    }
  }

  return { entities, routes }
}
