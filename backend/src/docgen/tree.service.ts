/**
 * Visual Repository Folder Tree Generator.
 * Constructs a clean ASCII tree representation of workspace source files.
 */
export function generateRepositoryTree(files: string[], maxFiles: number = 60): string {
  if (!files || files.length === 0) return 'project/'

  // Build directory hierarchy
  const root: Record<string, any> = {}

  for (const file of files.slice(0, maxFiles)) {
    const parts = file.split(/[/\\]/)
    let current = root
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]
      if (i === parts.length - 1) {
        current[part] = null // Leaf file
      } else {
        if (!current[part]) current[part] = {}
        current = current[part]
      }
    }
  }

  const lines: string[] = ['project/']

  function buildSubTree(node: Record<string, any>, prefix: string = '') {
    const keys = Object.keys(node)
    keys.forEach((key, index) => {
      const isLast = index === keys.length - 1
      const connector = isLast ? '└── ' : '├── '
      const childPrefix = isLast ? '    ' : '│   '

      if (node[key] === null) {
        lines.push(`${prefix}${connector}${key}`)
      } else {
        lines.push(`${prefix}${connector}${key}/`)
        buildSubTree(node[key], `${prefix}${childPrefix}`)
      }
    })
  }

  buildSubTree(root)

  if (files.length > maxFiles) {
    lines.push(`└── ... (${files.length - maxFiles} additional files)`)
  }

  return lines.join('\n')
}
