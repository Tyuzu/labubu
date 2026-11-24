import { existsSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import { sharedLayoutPlugin } from './site/shared-layout'

const projectDir = fileURLToPath(new URL('.', import.meta.url))
const siteRoot = resolve(projectDir, 'site')

function htmlInputs(directory: string, relative = ''): Record<string, string> {
  const inputs: Record<string, string> = {}
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const name = relative ? `${relative}/${entry.name}` : entry.name
    const indexFile = resolve(directory, entry.name, 'index.html')
    if (existsSync(indexFile)) inputs[name] = indexFile
  }
  const rootIndex = resolve(directory, 'index.html')
  if (existsSync(rootIndex)) inputs.main = rootIndex
  return inputs
}

export default defineConfig({
  root: siteRoot,
  publicDir: 'static',
  plugins: [sharedLayoutPlugin()],
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    rollupOptions: {
      input: htmlInputs(siteRoot),
    },
  },
  server: {
    port: 5173,
  },
})
