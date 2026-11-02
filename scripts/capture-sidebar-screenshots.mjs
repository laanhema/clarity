#!/usr/bin/env node
import * as electron from 'electron'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import os from 'node:os'
import fs from 'node:fs'

const __filename = fileURLToPath(import.meta.url)
const isElectron = Boolean(process.versions.electron)

function parseArgs(args) {
  const options = {
    outPrefix: 'after',
    outDir: path.resolve('.lavish'),
    stylesFile: path.resolve('src/renderer/src/styles.css'),
  }
  const filtered = args.filter((a) => a !== '--')
  for (let i = 0; i < filtered.length; i++) {
    const arg = filtered[i]
    if (arg === '--out-prefix' && filtered[i + 1]) {
      options.outPrefix = filtered[++i]
    } else if (arg === '--out-dir' && filtered[i + 1]) {
      options.outDir = path.resolve(filtered[++i])
    } else if (arg === '--styles-file' && filtered[i + 1]) {
      options.stylesFile = path.resolve(filtered[++i])
    }
  }
  return options
}

if (!isElectron) {
  const electronBinary = electron.default || 'electron'
  const scratchConfig = path.join(os.tmpdir(), `clarity-electron-${Date.now()}`)
  fs.mkdirSync(scratchConfig, { recursive: true })

  const env = { ...process.env, XDG_CONFIG_HOME: scratchConfig }
  delete env.ELECTRON_RUN_AS_NODE

  const args = [
    '--ozone-platform=headless',
    '--ozone-override-screen-size=900,600',
    '--window-size=900,600',
    '--disable-gpu',
    __filename,
    '--',
    ...process.argv.slice(2),
  ]

  const child = spawn(electronBinary, args, {
    stdio: 'inherit',
    env,
  })

  child.on('exit', (code) => {
    try {
      fs.rmSync(scratchConfig, { recursive: true, force: true })
    } catch {
      // ignore scratch config cleanup errors
    }
    process.exit(code ?? 0)
  })
} else {
  const { app, BrowserWindow, nativeTheme } = electron

  const options = parseArgs(process.argv.slice(2))
  fs.mkdirSync(options.outDir, { recursive: true })

  let cssContent = ''
  if (fs.existsSync(options.stylesFile)) {
    cssContent = fs.readFileSync(options.stylesFile, 'utf8')
  } else {
    console.error(`Styles file not found: ${options.stylesFile}`)
    process.exit(1)
  }

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    ${cssContent}
  </style>
  <style>
    html, body {
      height: 100%;
      margin: 0;
      padding: 0;
      overflow: hidden;
    }
    .app {
      display: flex;
      flex-direction: column;
      height: 100vh;
    }
  </style>
</head>
<body>
  <div class="app">
    <div class="workspace" style="grid-template-columns: 260px 5px 1fr; height: 100vh;">
      <aside class="sidebar">
        <div class="sidebar-header">
          <span class="sidebar-title" title="/clarity">clarity</span>
        </div>
        <nav class="tree" aria-label="Project files">
          <ul class="tree-list">
            <li>
              <button type="button" class="tree-row tree-directory" aria-expanded="true">
                <span class="tree-chevron" aria-hidden="true">
                  <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <path d="M6 3.5 10.5 8 6 12.5"></path>
                  </svg>
                </span>
                <svg class="tree-icon" viewBox="0 0 16 16" aria-hidden="true">
                  <path fill="currentColor" opacity=".9" d="M1.5 3h4.2l1.4 1.5h6.4c.5 0 .9.4.9.9V6H4.3c-.5 0-.9.3-1.1.7L1.5 11V3.9c0-.5.4-.9.9-.9z"></path>
                  <path fill="currentColor" d="M3.6 7h11.2l-1.7 5.4c-.1.4-.5.6-.9.6H1.9z"></path>
                </svg>
                <span class="tree-directory-name">docs</span>
              </button>
              <ul class="tree-list">
                <li>
                  <div class="tree-row tree-file">
                    <svg class="tree-icon" viewBox="0 0 16 16" aria-hidden="true">
                      <rect x="1" y="3.5" width="14" height="9" rx="1.6" fill="none" stroke="currentColor" stroke-width="1.1"></rect>
                      <path d="M3.6 10.3V5.8l1.6 2 1.6-2v4.5M10.8 5.8v4.3m-1.5-1.5 1.5 1.6 1.5-1.6" fill="none" stroke="currentColor" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round"></path>
                    </svg>
                    <span class="tree-file-name">architecture.md</span>
                  </div>
                </li>
                <li>
                  <div class="tree-row tree-file">
                    <svg class="tree-icon" viewBox="0 0 16 16" aria-hidden="true">
                      <rect x="1" y="3.5" width="14" height="9" rx="1.6" fill="none" stroke="currentColor" stroke-width="1.1"></rect>
                      <path d="M3.6 10.3V5.8l1.6 2 1.6-2v4.5M10.8 5.8v4.3m-1.5-1.5 1.5 1.6 1.5-1.6" fill="none" stroke="currentColor" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round"></path>
                    </svg>
                    <span class="tree-file-name">guide.md</span>
                  </div>
                </li>
              </ul>
            </li>
            <li>
              <button type="button" class="tree-row tree-directory" aria-expanded="true">
                <span class="tree-chevron" aria-hidden="true">
                  <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <path d="M6 3.5 10.5 8 6 12.5"></path>
                  </svg>
                </span>
                <svg class="tree-icon" viewBox="0 0 16 16" aria-hidden="true">
                  <path fill="currentColor" opacity=".9" d="M1.5 3h4.2l1.4 1.5h6.4c.5 0 .9.4.9.9V6H4.3c-.5 0-.9.3-1.1.7L1.5 11V3.9c0-.5.4-.9.9-.9z"></path>
                  <path fill="currentColor" d="M3.6 7h11.2l-1.7 5.4c-.1.4-.5.6-.9.6H1.9z"></path>
                </svg>
                <span class="tree-directory-name">src</span>
              </button>
              <ul class="tree-list">
                <li>
                  <button type="button" class="tree-row tree-directory" aria-expanded="true">
                    <span class="tree-chevron" aria-hidden="true">
                      <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                        <path d="M6 3.5 10.5 8 6 12.5"></path>
                      </svg>
                    </span>
                    <svg class="tree-icon" viewBox="0 0 16 16" aria-hidden="true">
                      <path fill="currentColor" opacity=".9" d="M1.5 3h4.2l1.4 1.5h6.4c.5 0 .9.4.9.9V6H4.3c-.5 0-.9.3-1.1.7L1.5 11V3.9c0-.5.4-.9.9-.9z"></path>
                      <path fill="currentColor" d="M3.6 7h11.2l-1.7 5.4c-.1.4-.5.6-.9.6H1.9z"></path>
                    </svg>
                    <span class="tree-directory-name">components</span>
                  </button>
                  <ul class="tree-list">
                    <li>
                      <div class="tree-row tree-file">
                        <svg class="tree-icon" viewBox="0 0 16 16" aria-hidden="true">
                          <rect x="1" y="3.5" width="14" height="9" rx="1.6" fill="none" stroke="currentColor" stroke-width="1.1"></rect>
                          <path d="M3.6 10.3V5.8l1.6 2 1.6-2v4.5M10.8 5.8v4.3m-1.5-1.5 1.5 1.6 1.5-1.6" fill="none" stroke="currentColor" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round"></path>
                        </svg>
                        <span class="tree-file-name">Sidebar.tsx</span>
                      </div>
                    </li>
                  </ul>
                </li>
              </ul>
            </li>
            <li>
              <div class="tree-row tree-file" aria-current="page">
                <svg class="tree-icon" viewBox="0 0 16 16" aria-hidden="true">
                  <rect x="1" y="3.5" width="14" height="9" rx="1.6" fill="none" stroke="currentColor" stroke-width="1.1"></rect>
                  <path d="M3.6 10.3V5.8l1.6 2 1.6-2v4.5M10.8 5.8v4.3m-1.5-1.5 1.5 1.6 1.5-1.6" fill="none" stroke="currentColor" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round"></path>
                </svg>
                <span class="tree-file-name">README.md</span>
              </div>
            </li>
          </ul>
        </nav>
      </aside>
      <div class="splitter"></div>
      <main class="pane" style="padding: 24px; color: var(--fg); background: var(--bg);">
        <h1 style="color: var(--md-heading); margin-top: 0; font-size: 1.5rem; font-weight: 600;">Clarity Markdown Reader</h1>
        <p style="color: var(--fg-muted); line-height: 1.6;">Sidebar directory color verification document.</p>
        <p style="color: var(--fg); line-height: 1.6;">The sidebar on the left displays directories styled with <code>var(--dir)</code>.</p>
      </main>
    </div>
  </div>
</body>
</html>`

  const tempHtmlPath = path.join(os.tmpdir(), `sidebar-preview-${Date.now()}.html`)
  fs.writeFileSync(tempHtmlPath, html)

  const runCapture = async () => {
    const win = new BrowserWindow({
      width: 900,
      height: 600,
      show: false,
    })

    for (const theme of ['light', 'dark']) {
      nativeTheme.themeSource = theme
      await win.loadFile(tempHtmlPath)
      await new Promise((r) => setTimeout(r, 200))
      const image = await win.capturePage()
      const outPath = path.join(options.outDir, `sidebar-${theme}-${options.outPrefix}.png`)
      fs.writeFileSync(outPath, image.toPNG())
      console.log(`Saved screenshot: ${outPath}`)
    }

    try {
      fs.unlinkSync(tempHtmlPath)
    } catch {
      // ignore temporary html cleanup errors
    }

    app.exit(0)
  }

  if (app.isReady()) {
    void runCapture()
  } else {
    app.whenReady().then(runCapture)
  }
}
