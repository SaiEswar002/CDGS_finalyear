import path from 'path'
import fs from 'fs/promises'
import type { UCMEnvVar } from './ucm.types'
import { generateRepositoryTree } from './tree.service'
import { logger } from '../logger'

export interface DetectionResult {
  languages: Record<string, number> // language -> file count
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

const EXTENSION_MAP: Record<string, string> = {
  '.py': 'python',
  '.java': 'java',
  '.js': 'javascript',
  '.jsx': 'javascript',
  '.ts': 'typescript',
  '.tsx': 'typescript',
  '.mjs': 'javascript',
  '.cjs': 'javascript',
  '.cpp': 'cpp',
  '.cc': 'cpp',
  '.cxx': 'cpp',
  '.hpp': 'cpp',
  '.h': 'c',
  '.c': 'c',
  '.go': 'go',
  '.rs': 'rust',
  '.cs': 'csharp',
  '.php': 'php',
  '.rb': 'ruby',
  '.sql': 'sql',
  '.sh': 'bash',
  '.bash': 'bash',
  '.kt': 'kotlin',
  '.swift': 'swift',
  '.scala': 'scala',
  '.r': 'r',
  '.dart': 'dart',
}

const CONFIG_FILES = new Set([
  'package.json',
  'pom.xml',
  'build.gradle',
  'requirements.txt',
  'pyproject.toml',
  'pipfile',
  'go.mod',
  'cargo.toml',
  'composer.json',
  'gemfile',
  'dockerfile',
  'docker-compose.yml',
  'docker-compose.yaml',
  'makefile',
  'workspace',
  '.env',
  '.env.example',
  'application.properties',
  'application.yml',
])

export function detectLanguageFromExtension(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase()
  return EXTENSION_MAP[ext] || 'other'
}

export async function detectRepositoryTechStack(
  workspaceDir: string,
  files: string[],
): Promise<DetectionResult> {
  const languages: Record<string, number> = {}
  const configFilesFound: string[] = []
  const frameworksSet = new Set<string>()
  const envVars: UCMEnvVar[] = []
  const runCommands: string[] = []

  let hasTests = false
  let testFramework: string | undefined = undefined
  let hasDocker = false
  let hasAuth = false

  // 1. Extension-based language counts & config file discovery
  for (const relPath of files) {
    const baseName = path.basename(relPath).toLowerCase()
    if (CONFIG_FILES.has(baseName) || baseName.endsWith('.csproj') || baseName.startsWith('.env')) {
      configFilesFound.push(relPath)
    }

    if (baseName.includes('test') || baseName.includes('spec') || relPath.includes('/tests/') || relPath.includes('/test/')) {
      hasTests = true
    }

    if (baseName === 'dockerfile' || baseName.startsWith('docker-compose')) {
      hasDocker = true
    }

    const lang = detectLanguageFromExtension(relPath)
    if (lang !== 'other') {
      languages[lang] = (languages[lang] || 0) + 1
    }
  }

  // Determine primary language
  let primaryLanguage = 'other'
  let maxCount = 0
  for (const [lang, count] of Object.entries(languages)) {
    if (count > maxCount) {
      maxCount = count
      primaryLanguage = lang
    }
  }

  // 2. Inspect Manifests & Config Files
  for (const configFile of configFilesFound) {
    const fullPath = path.join(workspaceDir, configFile)
    try {
      const content = await fs.readFile(fullPath, 'utf8')
      const fileName = path.basename(configFile).toLowerCase()

      if (fileName === 'package.json') {
        if (content.includes('"express"')) frameworksSet.add('Express')
        if (content.includes('"@nestjs/core"')) frameworksSet.add('NestJS')
        if (content.includes('"react"')) frameworksSet.add('React')
        if (content.includes('"@angular/core"')) frameworksSet.add('Angular')
        if (content.includes('"vue"')) frameworksSet.add('Vue')
        if (content.includes('"next"')) frameworksSet.add('Next.js')
        if (content.includes('"vitest"')) { hasTests = true; testFramework = 'Vitest' }
        if (content.includes('"jest"')) { hasTests = true; testFramework = 'Jest' }

        if (content.includes('"dev"')) runCommands.push('npm run dev')
        if (content.includes('"start"')) runCommands.push('npm start')
        if (content.includes('"test"')) runCommands.push('npm test')
        if (content.includes('"build"')) runCommands.push('npm run build')
      } else if (fileName === 'requirements.txt' || fileName === 'pyproject.toml') {
        if (/fastapi/i.test(content)) frameworksSet.add('FastAPI')
        if (/flask/i.test(content)) frameworksSet.add('Flask')
        if (/django/i.test(content)) frameworksSet.add('Django')
        if (/pytest/i.test(content)) { hasTests = true; testFramework = 'PyTest' }
        if (/torch|tensorflow|scikit-learn|pandas|numpy/i.test(content)) {
          frameworksSet.add('PyTorch/TensorFlow Data-Science')
        }
        runCommands.push('pip install -r requirements.txt')
        runCommands.push('python app.py')
      } else if (fileName === 'pom.xml' || fileName === 'build.gradle') {
        if (content.includes('spring-boot')) frameworksSet.add('Spring Boot')
        else if (content.includes('springframework')) frameworksSet.add('Spring Framework')
        if (content.includes('junit')) { hasTests = true; testFramework = 'JUnit' }
        runCommands.push(fileName === 'pom.xml' ? 'mvn spring-boot:run' : './gradlew bootRun')
      } else if (fileName === 'go.mod') {
        if (content.includes('github.com/gin-gonic/gin')) frameworksSet.add('Gin')
        if (content.includes('github.com/gofiber/fiber')) frameworksSet.add('Fiber')
        runCommands.push('go run main.go')
      } else if (fileName.startsWith('.env')) {
        // Parse Environment Variables safely & mask secrets
        const envLines = content.split('\n')
        for (const line of envLines) {
          const trimmed = line.trim()
          if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
            const [varName] = trimmed.split('=')
            const cleanName = varName.trim()
            if (cleanName) {
              const isSecret = /SECRET|KEY|PASSWORD|TOKEN|AUTH|CREDENTIAL|PRIVATE/i.test(cleanName)
              envVars.push({
                name: cleanName,
                isSecret,
                sampleValue: isSecret ? '***MASKED***' : 'configured_value',
              })
              if (isSecret || /AUTH|JWT|OAUTH/i.test(cleanName)) {
                hasAuth = true
              }
            }
          }
        }
      }
    } catch (err) {
      logger.debug({ err, configFile }, 'Could not inspect config file for framework detection')
    }
  }

  // Default run command fallback if empty
  if (runCommands.length === 0) {
    if (primaryLanguage === 'python') runCommands.push('python main.py')
    else if (primaryLanguage === 'typescript' || primaryLanguage === 'javascript') runCommands.push('npm start')
    else if (primaryLanguage === 'java') runCommands.push('mvn compile')
    else if (primaryLanguage === 'go') runCommands.push('go run main.go')
  }

  const frameworks = Array.from(frameworksSet)

  // 3. Project Type Detection
  let projectType = 'General Application'
  const hasFrontend = frameworks.some((f) => ['React', 'Angular', 'Vue', 'Next.js'].includes(f)) ||
    Boolean(languages['javascript'] || languages['typescript'])
  const hasBackend = frameworks.some((f) => ['Express', 'NestJS', 'FastAPI', 'Flask', 'Django', 'Spring Boot', 'Gin', 'Fiber', 'Laravel', '.NET Framework / Core'].includes(f))

  if (hasFrontend && hasBackend) {
    projectType = 'Full Stack Web Application'
  } else if (hasBackend) {
    projectType = 'REST API / Backend Service'
  } else if (hasFrontend && (languages['javascript'] || languages['typescript'])) {
    projectType = 'Frontend Web Application'
  } else if (frameworks.includes('PyTorch/TensorFlow Data-Science')) {
    projectType = 'Machine Learning / Data Science System'
  } else if (languages['python']) {
    projectType = 'Python Application / Library'
  } else if (languages['java']) {
    projectType = 'Java Enterprise Application'
  } else if (languages['go']) {
    projectType = 'Go Microservice / Application'
  } else if (languages['csharp'] || languages['cpp'] || languages['c']) {
    projectType = 'Systems / Desktop Application'
  } else if (languages['sql']) {
    projectType = 'Database / Data Infrastructure'
  }

  // 4. Generate Visual Folder Tree
  const repositoryTree = generateRepositoryTree(files)

  return {
    languages,
    primaryLanguage,
    frameworks,
    projectType,
    configFiles: configFilesFound,
    totalFiles: files.length,
    hasTests,
    testFramework: testFramework || (hasTests ? 'Unit Testing' : undefined),
    hasDocker,
    hasAuth,
    envVars,
    runCommands,
    repositoryTree,
  }
}
