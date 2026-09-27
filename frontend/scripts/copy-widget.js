/**
 * Copies the widget into the dashboard's public/ folder so Vercel serves both
 * from one deployment.
 *
 * widget/ stays the single source of truth — these copies are generated and
 * gitignored, so the widget is never maintained in two places.
 *
 *   public/salon/   the Karan's Salon demo site (index.html + its ./chat.js)
 *   public/widget/  chat.js on its own, as the canonical embed URL
 *
 * Runs from prestart and prebuild, so local dev and the Vercel build agree.
 */
const fs = require('fs')
const path = require('path')

const widgetDir = path.resolve(__dirname, '..', '..', 'widget')
const publicDir = path.resolve(__dirname, '..', 'public')

if (!fs.existsSync(widgetDir)) {
  console.error(`copy-widget: no widget directory at ${widgetDir}`)
  process.exit(1)
}

const copy = (from, to) => {
  fs.mkdirSync(path.dirname(to), { recursive: true })
  fs.copyFileSync(from, to)
  console.log(`copy-widget: ${path.relative(publicDir, to)}`)
}

const chatJs = path.join(widgetDir, 'chat.js')
const indexHtml = path.join(widgetDir, 'index.html')

for (const required of [chatJs, indexHtml]) {
  if (!fs.existsSync(required)) {
    console.error(`copy-widget: missing ${required}`)
    process.exit(1)
  }
}

// Demo site. index.html loads "./chat.js", so chat.js must sit beside it.
copy(indexHtml, path.join(publicDir, 'salon', 'index.html'))
copy(chatJs, path.join(publicDir, 'salon', 'chat.js'))

// Canonical embed URL, so the snippet a business pastes is not tied to the
// demo tenant's folder.
copy(chatJs, path.join(publicDir, 'widget', 'chat.js'))
