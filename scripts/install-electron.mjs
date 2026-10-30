// Runs as npm's postinstall. Electron 45 has no install script of its own: it
// downloads its binary only when `require('electron')` first runs. electron-vite
// reads node_modules/electron/path.txt directly, so `npm run dev` fails with
// "Electron uninstall" until something downloads the binary. This does that.
//
// Electron's installer exits at once when the right binary is already there.
// Set ELECTRON_SKIP_BINARY_DOWNLOAD=1 to skip the download.
import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'

if (process.env.ELECTRON_SKIP_BINARY_DOWNLOAD) {
  console.log('ELECTRON_SKIP_BINARY_DOWNLOAD is set, not downloading Electron.')
  process.exit(0)
}

const installer = createRequire(import.meta.url).resolve('electron/install.js')
const result = spawnSync(process.execPath, [installer], { stdio: 'inherit' })
process.exit(result.status ?? 1)
