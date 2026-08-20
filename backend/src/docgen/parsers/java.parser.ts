import type { UCMEntity, UCMRoute, UCMParameter } from '../ucm.types'

/**
 * Java Source-Aware Parser.
 * Extracts Java classes, interfaces, Spring Boot REST controllers & annotations,
 * Javadoc comments, methods, parameters, and JPA entities.
 */
export function parseJavaFile(
  filePath: string,
  content: string,
): { entities: UCMEntity[]; routes: UCMRoute[] } {
  const entities: UCMEntity[] = []
  const routes: UCMRoute[] = []

  const lines = content.split('\n')
  let currentClass: UCMEntity | null = null

  // Extract Javadoc comments preceding a line index
  function extractJavadoc(lineIdx: number): string | undefined {
    const docLines: string[] = []
    let foundEnd = false

    for (let i = lineIdx - 1; i >= Math.max(0, lineIdx - 20); i--) {
      const line = lines[i].trim()
      if (!foundEnd) {
        if (line.endsWith('*/')) {
          foundEnd = true;
          const contentPart = line.replace('*/', '').replace('/**', '').replace(/^\*+\s?/, '')
          if (contentPart) docLines.unshift(contentPart)
        }
      } else {
        if (line.startsWith('/**')) {
          const contentPart = line.replace('/**', '').replace(/^\*+\s?/, '')
          if (contentPart) docLines.unshift(contentPart)
          break
        } else {
          const cleanLine = line.replace(/^\*+\s?/, '')
          if (cleanLine) docLines.unshift(cleanLine)
        }
      }
    }
    return docLines.length > 0 ? docLines.join(' ').trim() : undefined
  }

  // 1. Detect Class-level Spring Base Path: @RequestMapping("/api/v1")
  let classBasePath = ''
  const classReqMapping = /@RequestMapping\s*\(\s*(?:value\s*=\s*|path\s*=\s*)?["']([^"']+)["']/i.exec(content)
  if (classReqMapping) {
    classBasePath = classReqMapping[1].endsWith('/') ? classReqMapping[1].slice(0, -1) : classReqMapping[1]
  }

  // 2. Parse Spring Boot REST Endpoints (method-level mappings)
  const springRouteRegex = /@(GetMapping|PostMapping|PutMapping|DeleteMapping|PatchMapping)\s*\(\s*(?:value\s*=\s*|path\s*=\s*)?["']([^"']+)["']/gi
  let routeMatch: RegExpExecArray | null

  while ((routeMatch = springRouteRegex.exec(content)) !== null) {
    const mappingType = routeMatch[1]
    const routeSubPath = routeMatch[2]
    const method = mappingType === 'RequestMapping' ? 'GET' : (mappingType.replace('Mapping', '').toUpperCase() as UCMRoute['method'])

    const fullPath = classBasePath
      ? `${classBasePath}${routeSubPath.startsWith('/') ? '' : '/'}${routeSubPath}`
      : routeSubPath

    const afterIndex = content.indexOf('\n', routeMatch.index)
    let handlerName = 'springHandler'
    let startLine = 1

    if (afterIndex !== -1) {
      const lineNum = content.substring(0, routeMatch.index).split('\n').length
      startLine = lineNum
      const slice = content.substring(afterIndex)
      const methodMatch = /(?:public|protected|private|static|\s)+[\w<>\[\]\?]+\s+([A-Za-z0-9_]+)\s*\(([^)]*)\)/.exec(slice)
      if (methodMatch) handlerName = methodMatch[1]
    }

    // Path parameters check: {id}
    const pathParams: UCMRoute['parameters'] = []
    const paramMatches = fullPath.match(/\{([^}]+)\}/g)
    if (paramMatches) {
      paramMatches.forEach((pm) => {
        const pName = pm.replace(/[\{\}]/g, '')
        pathParams.push({
          name: pName,
          in: 'path',
          type: 'string',
          required: true,
          description: `Spring path parameter \`${pName}\`.`,
        })
      })
    }

    routes.push({
      id: `route-java-${filePath}-${method}-${fullPath}`,
      method,
      path: fullPath,
      originalPath: fullPath,
      handlerName,
      filePath,
      startLine,
      summary: `Spring Boot Endpoint: ${method} ${fullPath}`,
      description: `Handled by Spring Controller method \`${handlerName}()\` in \`${filePath}\`.`,
      parameters: pathParams,
    })
  }

  // 3. Line by Line Parsing for Classes, Interfaces, Annotations, Methods
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const lineNum = i + 1

    // Class / Interface / Enum
    const classMatch = /(?:public|protected|private)?\s*(?:static\s+)?(?:final\s+|abstract\s+)?(class|interface|enum)\s+([A-Za-z0-9_]+)/.exec(line)
    if (classMatch) {
      const kind = classMatch[1] === 'interface' ? 'interface' : classMatch[1] === 'enum' ? 'enum' : 'class'
      const className = classMatch[2]
      const javadoc = extractJavadoc(i)

      const isController = content.includes('@RestController') || content.includes('@Controller')
      const isService = content.includes('@Service')
      const isRepository = content.includes('@Repository')
      const isEntity = content.includes('@Entity')

      currentClass = {
        id: `entity-java-${className}`,
        name: className,
        kind: isController ? 'controller' : isService ? 'service' : isRepository ? 'repository' : isEntity ? 'entity' : kind,
        language: 'java',
        filePath,
        startLine: lineNum,
        description: javadoc || `Java ${kind} \`${className}\`.`,
        descriptionSource: javadoc ? 'docstring' : 'signature',
        childIds: [],
      }

      entities.push(currentClass)
      continue
    }

    // Java Method
    const methodMatch = /(?:public|protected|private|static|\s)+([\w<>\[\]\?]+)\s+([A-Za-z0-9_]+)\s*\(([^)]*)\)\s*(?:throws\s+[\w\s,]+)?\s*\{/.exec(line)
    if (methodMatch) {
      const returnType = methodMatch[1]
      const methodName = methodMatch[2]
      const rawParams = methodMatch[3]

      if (['if', 'for', 'while', 'switch', 'catch', 'return'].includes(methodName)) continue

      const javadoc = extractJavadoc(i)
      const parameters: UCMParameter[] = []

      if (rawParams.trim()) {
        const paramSplits = rawParams.split(',')
        for (const p of paramSplits) {
          const parts = p.trim().split(/\s+/)
          if (parts.length >= 2) {
            parameters.push({
              name: parts[parts.length - 1],
              type: parts[parts.length - 2],
            })
          }
        }
      }

      const entityId = `entity-java-method-${filePath}-${methodName}`
      const methodEntity: UCMEntity = {
        id: entityId,
        name: methodName,
        kind: 'method',
        language: 'java',
        filePath,
        startLine: lineNum,
        description: javadoc || `Java method \`${methodName}()\`.`,
        descriptionSource: javadoc ? 'docstring' : 'signature',
        parameters,
        returnType,
        parentId: currentClass ? currentClass.id : undefined,
      }

      if (currentClass && currentClass.childIds) {
        currentClass.childIds.push(entityId)
      }

      entities.push(methodEntity)
    }
  }

  return { entities, routes }
}
