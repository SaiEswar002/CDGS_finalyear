import puppeteer, { type Browser } from 'puppeteer'
import { logger } from '../logger'

export interface PDFDocItem {
  title: string
  docType: string
  filePath: string
  content: string
}

export interface PDFExportOptions {
  repoFullName: string
  commitSha: string
  versionNumber: number
  publishedAt: string
  documents: PDFDocItem[]
}

/**
 * Converts Markdown content to basic HTML for PDF rendering.
 */
function markdownToHtml(md: string): string {
  let html = md
    // Escape standard raw html tags slightly if needed
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

  // Handle Mermaid Code Blocks
  html = html.replace(
    /&lt;```mermaid([\s\S]*?)```&gt;/g,
    (_, diagram) => `<div class="mermaid-container"><div class="mermaid">${diagram.trim()}</div></div>`,
  )
  html = html.replace(
    /```mermaid([\s\S]*?)```/g,
    (_, diagram) => `<div class="mermaid-container"><div class="mermaid">${diagram.trim()}</div></div>`,
  )

  // Handle Syntax Highlighting Code Blocks
  html = html.replace(
    /```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g,
    (_, lang, code) => `<pre class="code-block"><code class="language-${lang}">${code.trim()}</code></pre>`,
  )

  // Blockquotes
  html = html.replace(/^&gt;\s?(.*$)/gim, '<blockquote>$1</blockquote>')

  // Headings
  html = html
    .replace(/^# (.*$)/gim, '<h1 class="section-title">$1</h1>')
    .replace(/^## (.*$)/gim, '<h2 class="section-heading">$1</h2>')
    .replace(/^### (.*$)/gim, '<h3 class="subsection-heading">$1</h3>')
    .replace(/^#### (.*$)/gim, '<h4 class="sub-subsection-heading">$1</h4>')

  // Inline formatting
  html = html
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>')

  // Tables
  html = html.replace(
    /((?:\|.*?\|\n)+)/g,
    (tableMatch) => {
      const rows = tableMatch.trim().split('\n')
      if (rows.length < 2) return tableMatch
      const isHeaderSep = (row: string) => /^\|(?:\s*:?-+:?\s*\|)+$/.test(row)
      let tableHtml = '<table class="doc-table">\n'
      let inBody = false

      rows.forEach((row, idx) => {
        if (isHeaderSep(row)) {
          tableHtml += '  </thead>\n  <tbody>\n'
          inBody = true
          return
        }
        const cells = row.split('|').slice(1, -1).map((c) => c.trim())
        if (idx === 0) {
          tableHtml += '  <thead>\n    <tr>\n' + cells.map((c) => `      <th>${c}</th>`).join('\n') + '\n    </tr>\n'
        } else {
          tableHtml += '    <tr>\n' + cells.map((c) => `      <td>${c}</td>`).join('\n') + '\n    </tr>\n'
        }
      })

      if (inBody) tableHtml += '  </tbody>\n'
      tableHtml += '</table>\n'
      return tableHtml
    },
  )

  // Unordered Lists
  html = html.replace(/^\-\s+(.*$)/gim, '<ul><li>$1</li></ul>')
  html = html.replace(/<\/ul>\n<ul>/g, '\n')

  // Line breaks & paragraphs
  html = html.replace(/\n\n/g, '<br/>')

  return html
}

/**
 * Generate high-quality professional PDF report buffer for CDGS documentation.
 */
export async function generateDocumentationPDF(opts: PDFExportOptions): Promise<Buffer> {
  const { repoFullName, commitSha, versionNumber, publishedAt, documents } = opts

  // Organize document order: Readme/Overview -> Architecture -> API -> Database -> Modules -> Components -> Getting Started -> Testing -> Deployment -> Quality
  const docTypePriority: Record<string, number> = {
    readme: 1,
    architecture: 2,
    api: 3,
    database: 4,
    module: 5,
    other: 6,
  }

  const sortedDocs = [...documents].sort((a, b) => {
    const pA = docTypePriority[a.docType] || 99
    const pB = docTypePriority[b.docType] || 99
    return pA - pB
  })

  // Table of Contents entries
  const tocItems = sortedDocs.map((doc, idx) => ({
    num: idx + 1,
    title: doc.title || doc.filePath,
    type: doc.docType.toUpperCase(),
    targetId: `section-${idx + 1}`,
  }))

  const bodySections = sortedDocs
    .map((doc, idx) => {
      const sectionHtml = markdownToHtml(doc.content)
      return `
      <div class="page-break"></div>
      <section id="section-${idx + 1}" class="doc-section">
        <div class="section-meta-badge">${doc.docType.toUpperCase()} — ${doc.filePath}</div>
        ${sectionHtml}
      </section>`
    })
    .join('\n')

  const fullHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${repoFullName} — CDGS Documentation Report</title>
  <script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script>
  <style>
    @page {
      size: A4;
      margin: 20mm 15mm 20mm 15mm;
    }
    * {
      box-sizing: border-box;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #1e293b;
      background: #ffffff;
      line-height: 1.6;
      font-size: 13px;
      margin: 0;
      padding: 0;
    }
    .cover-page {
      height: 100vh;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      text-align: center;
      padding: 40px;
      background: linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%);
      color: #ffffff;
    }
    .cover-badge {
      display: inline-block;
      padding: 6px 16px;
      background: rgba(99, 102, 241, 0.2);
      border: 1px solid rgba(129, 140, 248, 0.4);
      color: #a5b4fc;
      border-radius: 20px;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 1px;
      margin-bottom: 24px;
    }
    .cover-title {
      font-size: 32px;
      font-weight: 800;
      margin: 0 0 12px 0;
      color: #f8fafc;
      letter-spacing: -0.5px;
    }
    .cover-subtitle {
      font-size: 16px;
      color: #94a3b8;
      margin: 0 0 40px 0;
    }
    .cover-meta {
      width: 100%;
      max-width: 480px;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 12px;
      padding: 20px;
      margin-top: 20px;
    }
    .meta-row {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      font-size: 12px;
    }
    .meta-row:last-child {
      border-bottom: none;
    }
    .meta-label {
      color: #64748b;
      font-weight: 500;
    }
    .meta-value {
      color: #cbd5e1;
      font-family: monospace;
      font-weight: 600;
    }
    .toc-container {
      padding: 40px 20px;
    }
    .toc-title {
      font-size: 22px;
      font-weight: 800;
      color: #0f172a;
      border-bottom: 2px solid #6366f1;
      padding-bottom: 8px;
      margin-bottom: 24px;
    }
    .toc-list {
      list-style: none;
      padding: 0;
      margin: 0;
    }
    .toc-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 10px 0;
      border-bottom: 1px solid #e2e8f0;
    }
    .toc-item-title {
      font-weight: 600;
      color: #334155;
    }
    .toc-item-badge {
      font-size: 10px;
      font-weight: 700;
      padding: 2px 8px;
      border-radius: 4px;
      background: #e0e7ff;
      color: #4338ca;
    }
    .page-break {
      page-break-before: always;
    }
    .doc-section {
      padding: 20px 0;
    }
    .section-meta-badge {
      display: inline-block;
      font-size: 10px;
      font-weight: 700;
      font-family: monospace;
      color: #4f46e5;
      background: #eef2ff;
      padding: 3px 8px;
      border-radius: 4px;
      margin-bottom: 12px;
    }
    .section-title {
      font-size: 24px;
      font-weight: 800;
      color: #0f172a;
      margin-top: 0;
      margin-bottom: 16px;
      border-bottom: 2px solid #e2e8f0;
      padding-bottom: 8px;
    }
    .section-heading {
      font-size: 18px;
      font-weight: 700;
      color: #1e293b;
      margin-top: 24px;
      margin-bottom: 12px;
    }
    .subsection-heading {
      font-size: 15px;
      font-weight: 600;
      color: #334155;
      margin-top: 18px;
      margin-bottom: 8px;
    }
    p, ul, ol {
      margin-top: 0;
      margin-bottom: 12px;
    }
    .inline-code {
      font-family: SFMono-Regular, Consolas, "Liberation Mono", Menlo, monospace;
      font-size: 11px;
      background: #f1f5f9;
      color: #0f172a;
      padding: 2px 5px;
      border-radius: 4px;
      border: 1px solid #e2e8f0;
    }
    .code-block {
      background: #0f172a;
      color: #f8fafc;
      font-family: SFMono-Regular, Consolas, "Liberation Mono", Menlo, monospace;
      font-size: 11px;
      padding: 14px;
      border-radius: 8px;
      overflow-x: auto;
      margin: 12px 0;
      line-height: 1.45;
    }
    .code-block code {
      color: inherit;
    }
    .doc-table {
      width: 100%;
      border-collapse: collapse;
      margin: 16px 0;
      font-size: 12px;
    }
    .doc-table th, .doc-table td {
      padding: 8px 12px;
      text-align: left;
      border: 1px solid #cbd5e1;
    }
    .doc-table th {
      background: #f8fafc;
      font-weight: 700;
      color: #1e293b;
    }
    .doc-table tr:nth-child(even) {
      background: #f8fafc;
    }
    blockquote {
      margin: 12px 0;
      padding: 10px 16px;
      background: #f0fdf4;
      border-left: 4px solid #22c55e;
      color: #166534;
      border-radius: 0 6px 6px 0;
    }
    .mermaid-container {
      display: flex;
      justify-content: center;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 20px;
      margin: 16px 0;
    }
    .mermaid {
      font-family: sans-serif;
    }
  </style>
</head>
<body>

  <!-- Cover Page -->
  <div class="cover-page">
    <div class="cover-badge">CDGS AUTOMATED DOCUMENTATION REPORT</div>
    <h1 class="cover-title">${repoFullName}</h1>
    <p class="cover-subtitle">Industry-Level Software Engineering & System Architecture Documentation</p>
    
    <div class="cover-meta">
      <div class="meta-row">
        <span class="meta-label">Repository:</span>
        <span class="meta-value">${repoFullName}</span>
      </div>
      <div class="meta-row">
        <span class="meta-label">Documentation Version:</span>
        <span class="meta-value">v${versionNumber}</span>
      </div>
      <div class="meta-row">
        <span class="meta-label">Commit SHA:</span>
        <span class="meta-value">${commitSha.slice(0, 7)}</span>
      </div>
      <div class="meta-row">
        <span class="meta-label">Generated Date:</span>
        <span class="meta-value">${new Date(publishedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
      </div>
      <div class="meta-row">
        <span class="meta-label">Total Artifacts:</span>
        <span class="meta-value">${sortedDocs.length} Documents</span>
      </div>
    </div>
  </div>

  <!-- Table of Contents -->
  <div class="page-break"></div>
  <div class="toc-container">
    <h2 class="toc-title">TABLE OF CONTENTS</h2>
    <ul class="toc-list">
      ${tocItems
        .map(
          (item) => `
        <li class="toc-item">
          <span class="toc-item-title">${item.num}. ${item.title}</span>
          <span class="toc-item-badge">${item.type}</span>
        </li>`,
        )
        .join('\n')}
    </ul>
  </div>

  <!-- Documentation Content Sections -->
  ${bodySections}

  <script>
    window.addEventListener('DOMContentLoaded', () => {
      if (window.mermaid) {
        window.mermaid.initialize({ startOnLoad: true, theme: 'default' });
      }
    });
  </script>
</body>
</html>`

  let browser: Browser | null = null
  try {
    logger.info({ repoFullName, versionNumber }, 'Launching Puppeteer PDF renderer')
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--no-first-run',
        '--no-zygote',
      ],
    })

    const page = await browser.newPage()
    await page.setContent(fullHtml, { waitUntil: 'domcontentloaded', timeout: 15000 })

    // Wait a brief moment for Mermaid to complete client-side SVG rendering
    try {
      await page.evaluate(() => {
        return new Promise((resolve) => setTimeout(resolve, 800))
      })
    } catch {
      // Ignore evaluation timeout
    }

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: `
        <div style="font-size: 8px; font-family: sans-serif; color: #94a3b8; width: 100%; padding: 0 20px; display: flex; justify-content: space-between;">
          <span>CDGS Documentation Report — ${repoFullName}</span>
          <span>Version v${versionNumber}</span>
        </div>`,
      footerTemplate: `
        <div style="font-size: 8px; font-family: sans-serif; color: #94a3b8; width: 100%; padding: 0 20px; display: flex; justify-content: space-between;">
          <span>Commit SHA: ${commitSha.slice(0, 7)}</span>
          <span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>
        </div>`,
      margin: {
        top: '25mm',
        bottom: '20mm',
        left: '15mm',
        right: '15mm',
      },
    })

    logger.info({ repoFullName, sizeBytes: pdfBuffer.length }, 'Documentation PDF generated successfully')
    return Buffer.from(pdfBuffer)
  } catch (err) {
    logger.error({ err, repoFullName }, 'Failed to render PDF using Puppeteer')
    throw new Error(`PDF Generation failed: ${(err as Error).message}`)
  } finally {
    if (browser) {
      await browser.close()
    }
  }
}
