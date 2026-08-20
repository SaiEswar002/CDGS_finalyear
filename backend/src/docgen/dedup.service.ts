import { logger } from '../logger'

export interface DeduplicationDiagnostics {
  totalFilesScanned: number
  uniqueCanonicalFiles: number
  duplicateFilesIgnored: number
  ignoredPaths: string[]
  detectedRepoRoot: string
}

/**
 * Repository Root Detection & Path Canonicalization Engine.
 * Resolves nested repository duplicate paths (e.g., Q-Shield_DevTrails-main/Q-shield/backend/app.py vs backend/app.py)
 * and produces one canonical path for every physical source file.
 */
export function deduplicateWorkspaceFiles(
  files: string[],
): { canonicalFiles: string[]; diagnostics: DeduplicationDiagnostics } {
  const fileSet = new Set<string>()
  const ignoredPaths: string[] = []

  // 1. Detect common nested root prefix if files are nested (e.g. "Q-Shield_DevTrails-main/Q-shield/...")
  let detectedRepoRoot = ''

  // Look for duplicated path segments or top-level wrapper folders
  const samplePaths = files.map((f) => f.replace(/\\/g, '/'))
  const firstPath = samplePaths[0] || ''
  const parts = firstPath.split('/')

  if (parts.length > 2) {
    const wrapper = parts[0]
    // Check if wrapper folder contains an inner duplicate directory with similar name
    if (samplePaths.every((p) => p.startsWith(wrapper + '/'))) {
      const secondPart = parts[1]
      if (wrapper.toLowerCase().includes(secondPart.toLowerCase()) || secondPart.toLowerCase().includes(wrapper.toLowerCase())) {
        detectedRepoRoot = `${wrapper}/${secondPart}`
      }
    }
  }

  // 2. Canonicalize path for each file and filter duplicates
  for (const rawFile of files) {
    let normalized = rawFile.replace(/\\/g, '/')

    // Strip detected nested wrapper root prefix if present
    if (detectedRepoRoot && normalized.startsWith(detectedRepoRoot + '/')) {
      normalized = normalized.substring(detectedRepoRoot.length + 1)
    }

    // Strip top-level redundant directory if duplicated in path
    const pathParts = normalized.split('/')
    if (pathParts.length > 2 && pathParts[0].toLowerCase() === pathParts[1].toLowerCase()) {
      normalized = pathParts.slice(1).join('/')
    }

    if (fileSet.has(normalized)) {
      ignoredPaths.push(rawFile)
    } else {
      fileSet.add(normalized)
    }
  }

  const canonicalFiles = Array.from(fileSet)

  const diagnostics: DeduplicationDiagnostics = {
    totalFilesScanned: files.length,
    uniqueCanonicalFiles: canonicalFiles.length,
    duplicateFilesIgnored: ignoredPaths.length,
    ignoredPaths,
    detectedRepoRoot: detectedRepoRoot || 'workspace root',
  }

  if (ignoredPaths.length > 0) {
    logger.info(
      {
        totalScanned: files.length,
        uniqueCanonical: canonicalFiles.length,
        duplicateFilesIgnored: ignoredPaths.length,
        sampleIgnored: ignoredPaths.slice(0, 3),
      },
      'Deduplication Engine eliminated duplicate file paths',
    )
  }

  return { canonicalFiles, diagnostics }
}
