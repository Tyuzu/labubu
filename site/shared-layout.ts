import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..', 'site')
const canonicalLayout = readFileSync(resolve(root, 'index.html'), 'utf8')

function findPageWrapper(html: string): [number, number] | null {
  const start = html.indexOf('<div class="page-content-wrapper')
  if (start === -1) return null
  const openingEnd = html.indexOf('>', start)
  if (openingEnd === -1) return null
  return [start, openingEnd + 1]
}

function findWrapperClose(html: string, openingEnd: number): [number, number] {
  const mainEnd = html.indexOf('</main>', openingEnd)
  if (mainEnd === -1) throw new Error('Page layout is missing </main>')
  const wrapperClose = html.lastIndexOf('</div>', mainEnd)
  if (wrapperClose === -1) throw new Error('Page layout is missing the wrapper closing tag')
  return [wrapperClose, mainEnd]
}

export function sharedLayoutPlugin() {
  const canonicalWrapper = findPageWrapper(canonicalLayout)
  if (!canonicalWrapper) throw new Error('Canonical layout is missing page-content-wrapper')

  const canonicalClose = findWrapperClose(canonicalLayout, canonicalWrapper[1])
  const bodyTagStart = canonicalLayout.indexOf('<body')
  const bodyTagEnd = canonicalLayout.indexOf('>', bodyTagStart) + 1
  const routeHead = canonicalLayout.slice(0, bodyTagEnd)
  const layoutPrefix = canonicalLayout.slice(bodyTagEnd, canonicalWrapper[1])
  const layoutSuffix = canonicalLayout.slice(canonicalClose[0], canonicalClose[1] + '</main>'.length)
    + canonicalLayout.slice(canonicalClose[1] + '</main>'.length)

  return {
    name: 'shared-layout',
    transformIndexHtml(html: string) {
      const routeWrapper = findPageWrapper(html)
      if (!routeWrapper) return html

      const routeClose = findWrapperClose(html, routeWrapper[1])
      const routeContent = html.slice(routeWrapper[1], routeClose[0]).trim()
      const routeBodyTagStart = html.indexOf('<body')
      const routeBodyTagEnd = html.indexOf('>', routeBodyTagStart) + 1
      const routeHead = html.slice(0, routeBodyTagEnd)

      return routeHead + layoutPrefix + '\n' + routeContent + '\n' + layoutSuffix
    },
  }
}
