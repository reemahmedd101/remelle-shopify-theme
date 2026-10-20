import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { Liquid, Tag } from 'liquidjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const themeRoot = path.resolve(here, '../Remelle')
const snippetsRoot = path.join(themeRoot, 'snippets')
const sectionsRoot = path.join(themeRoot, 'sections')
const port = Number(process.env.PORT || 4173)

const translations = JSON.parse(fs.readFileSync(path.join(themeRoot, 'locales/en.default.json'), 'utf8'))

function readJson(file) {
  const raw = fs.readFileSync(file, 'utf8').replace(/^\uFEFF?\/\*[\s\S]*?\*\//, '')
  return JSON.parse(raw)
}

function themeConfig() {
  const groups = JSON.parse(fs.readFileSync(path.join(themeRoot, 'config/settings_schema.json'), 'utf8'))
  const settings = {}
  for (const group of groups) {
    for (const setting of group.settings || []) {
      if (setting.id != null && Object.hasOwn(setting, 'default')) settings[setting.id] = setting.default
    }
  }
  const current = readJson(path.join(themeRoot, 'config/settings_data.json')).current || {}
  for (const [key, value] of Object.entries(current)) {
    if (key !== 'sections') settings[key] = value
  }
  return { settings, staticSections: current.sections || {} }
}

const { settings, staticSections } = themeConfig()

function preprocess(source) {
  let schema = null
  let liquid = source.replace(/\{%-?\s*doc\s*-?%\}[\s\S]*?\{%-?\s*enddoc\s*-?%\}/g, '')
  liquid = liquid.replace(/\{%-?\s*#[\s\S]*?-?%\}/g, '')
  liquid = liquid.replace(/\{%-?\s*schema\s*-?%\}([\s\S]*?)\{%-?\s*endschema\s*-?%\}/, (_, json) => {
    schema = JSON.parse(json)
    return ''
  })
  liquid = liquid.replace(/\{%-?\s*stylesheet\s*-?%\}([\s\S]*?)\{%-?\s*endstylesheet\s*-?%\}/g, (_, css) => `<style>${css}</style>`)
  liquid = liquid.replace(/\{%-?\s*javascript\s*-?%\}([\s\S]*?)\{%-?\s*endjavascript\s*-?%\}/g, (_, js) => `<script>${js}</script>`)
  liquid = liquid.replace(/\{%-?\s*style\s*-?%\}/g, '<style>').replace(/\{%-?\s*endstyle\s*-?%\}/g, '</style>')
  liquid = liquid.replace(/posted_successfully\?/g, 'posted_successfully')
  liquid = liquid.replace(/alt:\s*[^,\n|]+?\s*\|\s*default:\s*/g, 'alt: ')
  return { liquid, schema }
}

const schemas = new Map()
function schemaFor(type) {
  if (!schemas.has(type)) {
    const raw = fs.readFileSync(path.join(sectionsRoot, `${type}.liquid`), 'utf8')
    schemas.set(type, preprocess(raw).schema || { settings: [] })
  }
  return schemas.get(type)
}

function settingDefaults(list = []) {
  const values = {}
  for (const setting of list) {
    if (setting.id != null && Object.hasOwn(setting, 'default')) values[setting.id] = setting.default
  }
  return values
}

function sectionDrop(type, instance = {}, index = 1) {
  const schema = schemaFor(type)
  const blockDefaults = {}
  for (const block of schema.blocks || []) blockDefaults[block.type] = settingDefaults(block.settings)
  const blocks = []
  for (const id of instance.block_order || Object.keys(instance.blocks || {})) {
    const block = instance.blocks[id]
    blocks.push({
      id,
      type: block.type,
      settings: { ...(blockDefaults[block.type] || {}), ...(block.settings || {}) },
      shopify_attributes: '',
    })
  }
  return {
    id: instance.id || type,
    index,
    index0: Math.max(0, index - 1),
    settings: { ...settingDefaults(schema.settings), ...(instance.settings || {}) },
    blocks,
  }
}

function argsToHash(args) {
  const hash = {}
  for (const arg of args) {
    if (Array.isArray(arg) && arg.length === 2 && typeof arg[0] === 'string') hash[arg[0]] = arg[1]
  }
  return hash
}

function lookupTranslation(key) {
  return key.split('.').reduce((node, part) => (node && node[part] != null ? node[part] : null), translations)
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[char])
}

const previewGlobals = {
  settings,
  nil: null,
  current_page: 1,
  page_title: 'Remelle',
  page_description: '',
  canonical_url: '',
  all_country_option_tags: '<option value="Egypt" selected>Egypt</option><option value="United Arab Emirates">United Arab Emirates</option><option value="United States">United States</option>',
}

const engine = new Liquid({
  root: [snippetsRoot],
  extname: '.liquid',
  relativeReference: false,
  strictFilters: false,
  cache: false,
  globals: previewGlobals,
  fs: {
    sep: path.sep,
    dirname: (file) => path.dirname(file),
    resolve(root, file, ext) {
      return path.resolve(root, path.extname(file) ? file : file + ext)
    },
    exists: async (file) => fs.existsSync(file),
    existsSync: (file) => fs.existsSync(file),
    readFile: async (file) => preprocess(fs.readFileSync(file, 'utf8')).liquid,
    readFileSync: (file) => preprocess(fs.readFileSync(file, 'utf8')).liquid,
  },
})

engine.registerFilter('asset_url', (file) => `/assets/${encodeURIComponent(file)}`)
engine.registerFilter('shopify_asset_url', () => '')
engine.registerFilter('stylesheet_tag', (href, ...args) => {
  const preload = argsToHash(args).preload ? `<link rel="preload" as="style" href="${href}">` : ''
  return `${preload}<link rel="stylesheet" href="${href}">`
})
engine.registerFilter('preload_tag', (href, ...args) => {
  const hash = argsToHash(args)
  const cross = hash.crossorigin ? ` crossorigin="${escapeHtml(hash.crossorigin)}"` : ''
  return `<link rel="preload" href="${href}" as="${escapeHtml(hash.as || 'fetch')}"${cross}>`
})
engine.registerFilter('image_url', (image) => (typeof image === 'string' ? image : image?.src || ''))
engine.registerFilter('image_tag', (image, ...args) => {
  const hash = argsToHash(args)
  const src = typeof image === 'string' ? image : image?.src || ''
  const alt = hash.alt ?? (typeof image === 'object' ? image?.alt : '') ?? ''
  const loading = hash.loading ? ` loading="${escapeHtml(hash.loading)}"` : ''
  const priority = hash.fetchpriority ? ` fetchpriority="${escapeHtml(hash.fetchpriority)}"` : ''
  const className = hash.class ? ` class="${escapeHtml(hash.class)}"` : ''
  return `<img src="${src}" alt="${escapeHtml(alt)}"${className}${loading}${priority}>`
})
engine.registerFilter('money', (cents) => {
  const amount = Number(cents) / 100
  if (!Number.isFinite(amount)) return ''
  return `LE ${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
})
engine.registerFilter('t', (key, ...args) => {
  const hash = argsToHash(args)
  const message = lookupTranslation(String(key))
  if (typeof message !== 'string') return String(key)
  return message.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, name) => (hash[name] == null ? '' : String(hash[name])))
})
engine.registerFilter('json', (value) => JSON.stringify(value ?? null))
engine.registerFilter('default_errors', () => '')
engine.registerFilter('format_address', (address) => {
  if (!address || typeof address !== 'object') return ''
  const cityLine = [address.city, address.province, address.zip].filter(Boolean).join(' ')
  return [address.name, address.first_name, address.address1, address.address2, cityLine, address.country, address.phone]
    .filter(Boolean)
    .map((line) => escapeHtml(line))
    .join('<br>')
})
engine.registerFilter('link_to', (text, url) => `<a href="${escapeHtml(url)}">${text}</a>`)

class SectionTag extends Tag {
  constructor(token, remainTokens, liquid) {
    super(token, remainTokens, liquid)
    this.sectionName = (token.args.match(/['"]([^'"]+)['"]/) || [])[1]
  }

  *render(ctx, emitter) {
    const file = path.join(sectionsRoot, `${this.sectionName}.liquid`)
    const source = preprocess(fs.readFileSync(file, 'utf8')).liquid
    const templates = this.liquid.parse(source, file)
    ctx.push({ section: sectionDrop(this.sectionName, staticSections[this.sectionName] || { type: this.sectionName }) })
    emitter.write(yield this.liquid.renderer.renderTemplates(templates, ctx))
    ctx.pop()
  }
}

class FormTag extends Tag {
  constructor(token, remainTokens, liquid) {
    super(token, remainTokens, liquid)
    this.args = token.args
    this.templates = []
    const stream = liquid.parser.parseStream(remainTokens)
    stream
      .on('tag:endform', () => stream.stop())
      .on('template', (template) => this.templates.push(template))
      .on('end', () => {
        throw new Error(`Missing endform for ${token.args}`)
      })
      .start()
  }

  *render(ctx, emitter) {
    const className = (this.args.match(/class:\s*'([^']*)'/) || [])[1] || ''
    const id = (this.args.match(/id:\s*'([^']*)'/) || [])[1] || ''
    ctx.push({
      form: {
        password_needed: true,
        posted_successfully: false,
        errors: null,
        email: '',
        set_as_default_checkbox: '<input type="checkbox" name="address[default]">',
      },
    })
    const html = yield this.liquid.renderer.renderTemplates(this.templates, ctx)
    ctx.pop()
    const classAttr = className ? ` class="${escapeHtml(className)}"` : ''
    const idAttr = id ? ` id="${escapeHtml(id)}"` : ''
    emitter.write(`<form method="post" action="#"${idAttr}${classAttr}>${html}</form>`)
  }
}

class PaginateTag extends Tag {
  constructor(token, remainTokens, liquid) {
    super(token, remainTokens, liquid)
    this.templates = []
    const stream = liquid.parser.parseStream(remainTokens)
    stream
      .on('tag:endpaginate', () => stream.stop())
      .on('template', (template) => this.templates.push(template))
      .on('end', () => {
        throw new Error('Missing endpaginate')
      })
      .start()
  }

  *render(ctx, emitter) {
    ctx.push({ paginate: { pages: 1, current_page: 1, previous: null, next: null } })
    emitter.write(yield this.liquid.renderer.renderTemplates(this.templates, ctx))
    ctx.pop()
  }
}

engine.registerTag('section', SectionTag)
engine.registerTag('form', FormTag)
engine.registerTag('paginate', PaginateTag)

const coatImage = {
  src: '/assets/in%20action.png',
  alt: 'Coat',
  width: 1440,
  height: 800,
}
const coat = {
  id: 15421204889787,
  title: 'Coat',
  handle: 'coat',
  url: '/products/coat',
  description: '',
  price: 285000,
  tags: [],
  has_only_default_variant: false,
  featured_image: coatImage,
  images: [coatImage],
  options_with_values: [
    {
      name: 'Size',
      position: 1,
      selected_value: 'S/M',
      values: [
        { name: 'S/M', selected: true, swatch: { color: null } },
        { name: 'L/XL', selected: false, swatch: { color: null } },
      ],
    },
    {
      name: 'Color',
      position: 2,
      selected_value: 'Brown',
      values: [
        { name: 'Brown', selected: true, swatch: { color: null } },
        { name: 'Cream white', selected: false, swatch: { color: null } },
      ],
    },
  ],
  variants: [
    { id: 67694773502139, title: 'S/M / Brown', options: ['S/M', 'Brown'], available: true, price: 285000, featured_image: coatImage },
    { id: 67695077097659, title: 'S/M / Cream white', options: ['S/M', 'Cream white'], available: true, price: 285000, featured_image: coatImage },
    { id: 67694773534907, title: 'L/XL / Brown', options: ['L/XL', 'Brown'], available: true, price: 285000, featured_image: coatImage },
    { id: 67695077130427, title: 'L/XL / Cream white', options: ['L/XL', 'Cream white'], available: true, price: 285000, featured_image: coatImage },
  ],
}
coat.selected_or_first_available_variant = coat.variants[0]

const collection = {
  id: 1,
  title: 'Shop',
  handle: 'all',
  url: '/collections/all',
  products: [coat],
  products_count: 1,
  sort_by: 'manual',
  sort_options: [
    { name: 'Featured', value: 'manual' },
    { name: 'Best selling', value: 'best-selling' },
    { name: 'Alphabetically, A-Z', value: 'title-ascending' },
    { name: 'Price, low to high', value: 'price-ascending' },
    { name: 'Price, high to low', value: 'price-descending' },
    { name: 'Date, new to old', value: 'created-descending' },
  ],
}

const pages = {
  about: { title: 'About', handle: 'about', url: '/pages/about', content: '' },
  contact: { title: 'Contact', handle: 'contact', url: '/pages/contact', content: '<p>Write to Remelle.</p>' },
  returns: { title: 'Return & Exchange', handle: 'returns', url: '/pages/returns', content: '<p>Unworn items can be returned or exchanged.</p>' },
}

const routes = {
  root_url: '/',
  account_url: '/account',
  account_login_url: '/account/login',
  account_register_url: '/account/register',
  account_logout_url: '/account/logout',
  account_addresses_url: '/account/addresses',
  all_products_collection_url: '/collections/all',
  cart_url: '/cart',
}

const shop = { name: 'Remelle', description: '' }
const cart = { item_count: 0, items: [], currency: { iso_code: 'EGP' } }

function templateFile(name) {
  const jsonFile = path.join(themeRoot, 'templates', `${name}.json`)
  const liquidFile = path.join(themeRoot, 'templates', `${name}.liquid`)
  if (fs.existsSync(jsonFile)) return { kind: 'json', file: jsonFile }
  if (fs.existsSync(liquidFile)) return { kind: 'liquid', file: liquidFile }
  return null
}

async function renderTemplate(name, scope) {
  const template = templateFile(name)
  if (!template) return null
  if (template.kind === 'liquid') {
    const source = preprocess(fs.readFileSync(template.file, 'utf8')).liquid
    return engine.parseAndRender(source, scope)
  }
  const data = JSON.parse(fs.readFileSync(template.file, 'utf8'))
  const parts = []
  let index = 1
  for (const id of data.order || []) {
    const instance = data.sections[id]
    const file = path.join(sectionsRoot, `${instance.type}.liquid`)
    const source = preprocess(fs.readFileSync(file, 'utf8')).liquid
    parts.push(await engine.parseAndRender(source, { ...scope, section: sectionDrop(instance.type, { ...instance, id }, index) }))
    index += 1
  }
  return parts.join('\n')
}

async function renderPage({ template, title, path: pagePath, pageType, product, collection: pageCollection, customer: pageCustomer, page, order: pageOrder }) {
  previewGlobals.page_title = title
  previewGlobals.page_description = shop.description
  previewGlobals.canonical_url = `http://127.0.0.1:${port}${pagePath}`
  const scope = {
    shop,
    routes,
    pages,
    collections: { all: collection },
    cart,
    request: {
      locale: { iso_code: 'en' },
      page_type: pageType,
      origin: `http://127.0.0.1:${port}`,
      design_mode: false,
    },
    product: product || null,
    collection: pageCollection || null,
    customer: pageCustomer || null,
    page: page || null,
    order: pageOrder || null,
    template: { name: template },
    page_title: title,
    page_description: shop.description,
    canonical_url: `http://127.0.0.1:${port}${pagePath}`,
    content_for_header: '',
  }
  const body = await renderTemplate(template, scope)
  if (body == null) return null
  const layout = preprocess(fs.readFileSync(path.join(themeRoot, 'layout/theme.liquid'), 'utf8')).liquid
  return engine.parseAndRender(layout, { ...scope, content_for_layout: body })
}

const types = {
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
}

function send(response, status, body, type) {
  response.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store' })
  response.end(body)
}

const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url, `http://127.0.0.1:${port}`)
    if (url.pathname.startsWith('/assets/')) {
      const fileName = decodeURIComponent(url.pathname.slice('/assets/'.length))
      const file = path.resolve(themeRoot, 'assets', fileName)
      if (!file.startsWith(path.join(themeRoot, 'assets') + path.sep) || !fs.existsSync(file)) {
        send(response, 404, 'Not found', 'text/plain; charset=utf-8')
        return
      }
      const extension = path.extname(file).toLowerCase()
      send(response, 200, fs.readFileSync(file), types[extension] || 'application/octet-stream')
      return
    }

    const routesByPath = [
      ['/', { template: 'index', title: 'Remelle', pageType: 'index' }],
      ['/collections/all', { template: 'collection', title: 'Shop', pageType: 'collection', collection }],
      ['/products/coat', { template: 'product', title: 'Coat', pageType: 'product', product: coat, collection }],
      ['/pages/about', { template: 'page.about', title: 'About', pageType: 'page', page: pages.about }],
      ['/pages/about-us', { template: 'page.about', title: 'About', pageType: 'page', page: pages.about }],
      ['/pages/contact', { template: 'page', title: 'Contact', pageType: 'page', page: pages.contact }],
      ['/pages/returns', { template: 'page', title: 'Return & Exchange', pageType: 'page', page: pages.returns }],
      ['/cart', { template: 'cart', title: 'Cart', pageType: 'cart' }],
    ]
    const match = routesByPath.find(([pathname]) => pathname === url.pathname)
    const html = match
      ? await renderPage({ ...match[1], path: url.pathname })
      : await renderPage({ template: '404', title: '404', path: url.pathname, pageType: '404' })
    if (!html) {
      send(response, 404, 'Not found', 'text/plain; charset=utf-8')
      return
    }
    send(response, match ? 200 : 404, html, 'text/html; charset=utf-8')
  } catch (error) {
    console.error(error)
    send(response, 500, `<pre>${escapeHtml(error.stack || error.message)}</pre>`, 'text/html; charset=utf-8')
  }
})

server.listen(port, '127.0.0.1', () => {
  console.log(`Local preview: http://127.0.0.1:${port}`)
})
