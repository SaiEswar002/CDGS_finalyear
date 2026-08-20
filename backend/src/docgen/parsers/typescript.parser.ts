import ts from 'typescript'
import type { UCMEntity, UCMRoute, UCMParameter, UCMField } from '../ucm.types'

/**
 * AST-Based JavaScript/TypeScript Parser using TypeScript Compiler API.
 * Extracts functions, arrow functions, classes, interfaces, type aliases,
 * React components/hooks, Express/NestJS routes, and JSDoc comments.
 */
export function parseTypeScriptFile(
  filePath: string,
  content: string,
): { entities: UCMEntity[]; routes: UCMRoute[] } {
  const entities: UCMEntity[] = []
  const routes: UCMRoute[] = []

  const isScript = filePath.endsWith('.js') || filePath.endsWith('.jsx')
  const scriptKind = filePath.endsWith('.tsx')
    ? ts.ScriptKind.TSX
    : filePath.endsWith('.jsx')
    ? ts.ScriptKind.JSX
    : filePath.endsWith('.js')
    ? ts.ScriptKind.JS
    : ts.ScriptKind.TS

  const sourceFile = ts.createSourceFile(filePath, content, ts.ScriptTarget.Latest, true, scriptKind)

  // Helper to extract JSDoc comment text
  function getJSDocComment(node: ts.Node): string | undefined {
    const jsDocNodes = (node as any).jsDoc
    if (jsDocNodes && Array.isArray(jsDocNodes) && jsDocNodes.length > 0) {
      const comment = jsDocNodes[0].comment
      if (typeof comment === 'string') return comment.trim()
      if (Array.isArray(comment)) return comment.map((c: any) => c.text).join('').trim()
    }
    return undefined
  }

  // Helper to convert Express route params /:id -> /{id}
  function normalizeExpressPath(pathUrl: string): string {
    return pathUrl.replace(/:([A-Za-z0-9_]+)/g, '{$1}')
  }

  function visitNode(node: ts.Node) {
    const { line: startLine } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile))

    // 1. Interfaces & Type Aliases
    if (ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node)) {
      const name = node.name.text
      const jsDoc = getJSDocComment(node)
      const fields: UCMField[] = []

      if (ts.isInterfaceDeclaration(node)) {
        node.members.forEach((member) => {
          if (ts.isPropertySignature(member) && member.name) {
            fields.push({
              name: member.name.getText(sourceFile),
              type: member.type ? member.type.getText(sourceFile) : 'any',
              isNullable: Boolean(member.questionToken),
            })
          }
        })
      }

      entities.push({
        id: `entity-ts-interface-${filePath}-${name}`,
        name,
        kind: 'interface',
        language: filePath.endsWith('.ts') || filePath.endsWith('.tsx') ? 'typescript' : 'javascript',
        filePath,
        startLine: startLine + 1,
        description: jsDoc || `Type interface definition \`${name}\`.`,
        descriptionSource: jsDoc ? 'docstring' : 'signature',
        fields,
      })
    }

    // 2. Class Declarations
    else if (ts.isClassDeclaration(node) && node.name) {
      const className = node.name.text
      const jsDoc = getJSDocComment(node)
      const fields: UCMField[] = []
      const childIds: string[] = []

      const isController = (node as any).modifiers?.some((m: any) => m.getText?.(sourceFile)?.includes('Controller'))
      const isService = (node as any).modifiers?.some((m: any) => m.getText?.(sourceFile)?.includes('Injectable'))

      node.members.forEach((member) => {
        if (ts.isPropertyDeclaration(member) && member.name) {
          fields.push({
            name: member.name.getText(sourceFile),
            type: member.type ? member.type.getText(sourceFile) : 'any',
          })
        }
      })

      const classEntity: UCMEntity = {
        id: `entity-ts-class-${filePath}-${className}`,
        name: className,
        kind: isController ? 'controller' : isService ? 'service' : 'class',
        language: filePath.endsWith('.ts') || filePath.endsWith('.tsx') ? 'typescript' : 'javascript',
        filePath,
        startLine: startLine + 1,
        description: jsDoc || `Class declaration \`${className}\`.`,
        descriptionSource: jsDoc ? 'docstring' : 'signature',
        fields,
        childIds,
      }

      entities.push(classEntity)
    }

    // 3. Function Declarations & Exported Arrow Functions
    else if (ts.isFunctionDeclaration(node) && node.name) {
      const fnName = node.name.text
      const jsDoc = getJSDocComment(node)

      const parameters: UCMParameter[] = node.parameters.map((p) => ({
        name: p.name.getText(sourceFile),
        type: p.type ? p.type.getText(sourceFile) : 'any',
        defaultValue: p.initializer ? p.initializer.getText(sourceFile) : undefined,
      }))

      const returnType = node.type ? node.type.getText(sourceFile) : 'void'
      const isReactComponent = /^[A-Z]/.test(fnName) && (filePath.endsWith('.tsx') || filePath.endsWith('.jsx'))
      const isHook = fnName.startsWith('use') && fnName.length > 3

      entities.push({
        id: `entity-ts-fn-${filePath}-${fnName}`,
        name: fnName,
        kind: isReactComponent ? 'component' : isHook ? 'hook' : 'function',
        language: isScript ? 'javascript' : 'typescript',
        filePath,
        startLine: startLine + 1,
        description: jsDoc || `${isReactComponent ? 'React Component' : isHook ? 'React Hook' : 'Function'} \`${fnName}()\`.`,
        descriptionSource: jsDoc ? 'docstring' : 'signature',
        parameters,
        returnType,
      })
    }

    // 4. Express Routes Detection (Phase 4 Handler Resolution)
    else if (ts.isCallExpression(node)) {
      const expressionText = node.expression.getText(sourceFile)
      if (/(?:app|router|apiRouter|server)\.(get|post|put|delete|patch|options|head)$/i.test(expressionText)) {
        const parts = expressionText.split('.')
        const method = parts[parts.length - 1].toUpperCase() as UCMRoute['method']

        const firstArg = node.arguments[0]
        if (firstArg && (ts.isStringLiteral(firstArg) || ts.isNoSubstitutionTemplateLiteral(firstArg))) {
          const rawPath = firstArg.text
          const formattedPath = normalizeExpressPath(rawPath)

          // Handler Resolution (Phase 4): Never output "anonymous_handler". Use source line reference if callback is arrow function
          let handlerName = `handler at ${filePath}:${startLine + 1}`
          const lastArg = node.arguments[node.arguments.length - 1]
          if (lastArg) {
            if (ts.isIdentifier(lastArg)) {
              handlerName = `${lastArg.text}()`
            } else if (ts.isPropertyAccessExpression(lastArg)) {
              handlerName = `${lastArg.getText(sourceFile)}()`
            } else if (ts.isArrowFunction(lastArg) || ts.isFunctionExpression(lastArg)) {
              handlerName = `Inline Handler (${filePath}:L${startLine + 1})`
            }
          }

          // Extract path parameters automatically
          const pathParams: UCMRoute['parameters'] = []
          const paramMatches = rawPath.match(/:([A-Za-z0-9_]+)/g)
          if (paramMatches) {
            paramMatches.forEach((pm) => {
              const pName = pm.replace(':', '')
              pathParams.push({
                name: pName,
                in: 'path',
                type: 'string',
                required: true,
                description: `URL path parameter \`${pName}\`.`,
              })
            })
          }

          routes.push({
            id: `route-ts-${filePath}-${method}-${rawPath}`,
            method,
            path: formattedPath,
            originalPath: rawPath,
            handlerName,
            filePath,
            startLine: startLine + 1,
            summary: `Express Route: ${method} ${formattedPath}`,
            description: `API endpoint handled by \`${handlerName}\` in \`${filePath}\`.`,
            parameters: pathParams,
          })
        }
      }
    }

    ts.forEachChild(node, visitNode)
  }

  visitNode(sourceFile)

  return { entities, routes }
}
