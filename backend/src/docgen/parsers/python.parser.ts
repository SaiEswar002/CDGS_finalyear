import type { UCMEntity, UCMRoute, UCMParameter } from '../ucm.types'

/**
 * Source-aware Python Parser.
 * Extracts classes, functions, methods, docstrings, type annotations,
 * FastAPI/Flask/Django routes, and parameter schemas.
 */
export function parsePythonFile(
  filePath: string,
  content: string,
): { entities: UCMEntity[]; routes: UCMRoute[] } {
  const entities: UCMEntity[] = []
  const routes: UCMRoute[] = []

  const lines = content.split('\n')
  let currentClass: UCMEntity | null = null

  // Helper to extract docstrings after a definition
  function extractDocstring(startIndex: number): string | undefined {
    let doc: string[] = []
    let inDoc = false
    let quoteType = ''

    for (let i = startIndex; i < Math.min(startIndex + 15, lines.length); i++) {
      const line = lines[i].trim()

      if (!inDoc) {
        if (line.startsWith('"""') || line.startsWith("'''")) {
          quoteType = line.substring(0, 3)
          const rest = line.substring(3)
          if (rest.endsWith(quoteType) && rest.length > 3) {
            return rest.substring(0, rest.length - 3).trim()
          }
          inDoc = true
          if (rest) doc.push(rest)
        }
      } else {
        if (line.endsWith(quoteType) || line.includes(quoteType)) {
          const clean = line.replace(quoteType, '').trim()
          if (clean) doc.push(clean)
          return doc.join(' ').trim()
        } else {
          doc.push(line)
        }
      }
    }
    return doc.length > 0 ? doc.join(' ').trim() : undefined
  }

  // 1. Extract FastAPI / Flask / Django Routes
  const pyRouteRegex = /@(?:app|router|api)\.(get|post|put|delete|patch|options|head)\s*\(\s*["']([^"']+)["']/gi
  let routeMatch: RegExpExecArray | null

  while ((routeMatch = pyRouteRegex.exec(content)) !== null) {
    const method = routeMatch[1].toUpperCase() as UCMRoute['method']
    const pathUrl = routeMatch[2]

    // Find handler function name following decorator
    const afterDecoratorIndex = content.indexOf('\n', routeMatch.index)
    let handlerName = 'unknown_handler'
    let startLine = 1

    if (afterDecoratorIndex !== -1) {
      const remainingCode = content.substring(afterDecoratorIndex)
      const fnMatch = /def\s+([A-Za-z0-9_]+)\s*\(([^)]*)\)/.exec(remainingCode)
      if (fnMatch) {
        handlerName = fnMatch[1]
      }
      startLine = content.substring(0, routeMatch.index).split('\n').length
    }

    // Format OpenAPI path cleanly
    const formattedPath = pathUrl.replace(/<([^>]+)>/g, '{$1}') // Flask format <id> -> {id}

    routes.push({
      id: `route-py-${filePath}-${method}-${pathUrl}`,
      method,
      path: formattedPath,
      originalPath: pathUrl,
      handlerName,
      filePath,
      startLine,
      summary: `Python API Endpoint: ${method} ${formattedPath}`,
      description: `Endpoint handled by function \`${handlerName}()\` in \`${filePath}\`.`,
    })
  }

  // 2. Line by line parsing for Classes and Functions
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const lineNum = i + 1

    // Class definition
    const classMatch = /^class\s+([A-Za-z0-9_]+)(?:\(([^)]*)\))?:/.exec(line.trim())
    if (classMatch) {
      const className = classMatch[1]
      const inherits = classMatch[2] ? classMatch[2].split(',').map((s) => s.trim()) : []
      const docstring = extractDocstring(i + 1)

      const isModel = inherits.some((h) => ['BaseModel', 'Model', 'dataclass', 'Base'].includes(h)) ||
        /BaseModel|Model|Schema/i.test(className)

      currentClass = {
        id: `entity-py-class-${filePath}-${className}`,
        name: className,
        kind: isModel ? 'model' : 'class',
        language: 'python',
        filePath,
        startLine: lineNum,
        description: docstring || `Python ${isModel ? 'Data Model' : 'Class'} \`${className}\`.`,
        descriptionSource: docstring ? 'docstring' : 'signature',
        annotations: inherits,
        fields: [],
        childIds: [],
      }

      entities.push(currentClass)
      continue
    }

    // Check for class fields/attributes (Pydantic / dataclass)
    if (currentClass) {
      const fieldMatch = /^\s+([a-zA-Z0-9_]+)\s*:\s*([^=\n#]+)(?:=\s*([^\n#]+))?/.exec(line)
      if (fieldMatch && !line.trim().startsWith('def ')) {
        const fieldName = fieldMatch[1]
        const fieldType = fieldMatch[2].trim()
        const defaultValue = fieldMatch[3] ? fieldMatch[3].trim() : undefined

        if (!currentClass.fields) currentClass.fields = []
        currentClass.fields.push({
          name: fieldName,
          type: fieldType,
          defaultValue,
        })
      }
    }

    // Function/Method definition
    const fnMatch = /^(?:\s*)def\s+([A-Za-z0-9_]+)\s*\(([^)]*)\)(?:\s*->\s*([^:]+))?:/.exec(line)
    if (fnMatch) {
      const fnName = fnMatch[1]
      const rawParams = fnMatch[2]
      const returnType = fnMatch[3] ? fnMatch[3].trim() : 'Any'
      const docstring = extractDocstring(i + 1)
      const isMethod = line.startsWith('    ') || line.startsWith('\t')

      // Parse parameters
      const parameters: UCMParameter[] = []
      if (rawParams.trim()) {
        const paramSplits = rawParams.split(',')
        for (const p of paramSplits) {
          const cleanP = p.trim()
          if (!cleanP || cleanP === 'self' || cleanP === 'cls') continue
          const [pNameType, pDefault] = cleanP.split('=')
          const [pName, pType] = pNameType.split(':')
          parameters.push({
            name: pName ? pName.trim() : 'param',
            type: pType ? pType.trim() : 'Any',
            defaultValue: pDefault ? pDefault.trim() : undefined,
          })
        }
      }

      const entityId = `entity-py-${isMethod ? 'method' : 'fn'}-${filePath}-${fnName}`
      const fnEntity: UCMEntity = {
        id: entityId,
        name: fnName,
        kind: isMethod ? 'method' : 'function',
        language: 'python',
        filePath,
        startLine: lineNum,
        description: docstring || `Python ${isMethod ? 'method' : 'function'} \`${fnName}()\`.`,
        descriptionSource: docstring ? 'docstring' : 'signature',
        parameters,
        returnType,
        parentId: isMethod && currentClass ? currentClass.id : undefined,
      }

      if (isMethod && currentClass && currentClass.childIds) {
        currentClass.childIds.push(entityId)
      }

      entities.push(fnEntity)
    }
  }

  return { entities, routes }
}
