// The Karsus popup: start an encounter from scratch or from a preset, then open
// it on the site. It talks to the same API as the site, signed in with the site's
// own session cookie (Chrome sends it because of host_permissions).

const SITE = 'https://karsusinitiative.com'

const $ = (id) => document.getElementById(id)

async function api(path, options = {}) {
  const res = await fetch(`${SITE}/api/${path}`, {
    credentials: 'include',
    ...options,
    headers: options.body ? { 'content-type': 'application/json' } : undefined,
  })
  const body = res.status === 204 ? null : await res.json().catch(() => null)
  if (!res.ok) throw Object.assign(new Error(body?.error ?? `Karsus answered ${res.status}`), { status: res.status })
  return body
}

/** Opens a page of the site in a new tab and closes the popup. */
function openOnSite(path) {
  chrome.tabs.create({ url: SITE + path })
  window.close()
}

function show(state) {
  for (const id of ['loading', 'signed-out', 'offline', 'signed-in']) $(id).hidden = id !== state
}

function showError(message) {
  $('error').textContent = message
  $('error').hidden = !message
}

/** Signed out mid-way (the session expired): fall back to the sign-in state. */
function handle(error) {
  if (error.status === 401) return show('signed-out')
  showError(error.message)
}

// ─── Tabs ────────────────────────────────────────────────────────────────────

let presetsLoaded = false

function selectTab(which) {
  for (const name of ['new', 'preset']) {
    const on = name === which
    $(`tab-${name}`).setAttribute('aria-selected', String(on))
    $(`panel-${name}`).hidden = !on
  }
  showError('')
  if (which === 'new') $('title').focus()
  if (which === 'preset' && !presetsLoaded) loadPresets()
}

$('tab-new').addEventListener('click', () => selectTab('new'))
$('tab-preset').addEventListener('click', () => selectTab('preset'))
document.querySelector('.tabs').addEventListener('keydown', (e) => {
  if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
    const next = e.target.id === 'tab-new' ? 'preset' : 'new'
    selectTab(next)
    $(`tab-${next}`).focus()
  }
})

// ─── From scratch ────────────────────────────────────────────────────────────

$('panel-new').addEventListener('submit', async (e) => {
  e.preventDefault()
  const title = $('title').value.trim()
  if (!title) {
    showError('Give the encounter a title')
    $('title').focus()
    return
  }
  $('create').disabled = true
  $('create').textContent = 'Creating…'
  try {
    const description = $('description').value.trim() || null
    const { id } = await api('encounters', { method: 'POST', body: JSON.stringify({ title, description, background_url: null }) })
    openOnSite(`/encounters/${id}`)
  } catch (error) {
    handle(error)
    $('create').disabled = false
    $('create').textContent = 'Create Encounter'
  }
})

// ─── From a preset ───────────────────────────────────────────────────────────

async function loadPresets() {
  const list = $('presets')
  list.replaceChildren(Object.assign(document.createElement('li'), { className: 'muted', textContent: 'Loading presets…' }))
  try {
    const presets = await api('presets')
    presetsLoaded = true
    list.replaceChildren(...presets.map(presetItem))
    $('presets-empty').hidden = presets.length > 0
  } catch (error) {
    list.replaceChildren()
    handle(error)
  }
}

function presetItem(preset) {
  const li = document.createElement('li')
  li.className = 'preset'

  const text = document.createElement('div')
  text.className = 'preset-text'
  const name = Object.assign(document.createElement('p'), { className: 'preset-name', textContent: preset.name })
  const count = preset.creatures.length
  const meta = Object.assign(document.createElement('p'), {
    className: 'preset-meta',
    textContent: count ? `${count} creature${count === 1 ? '' : 's'}${preset.hidden ? ', hidden' : ''}` : 'No creatures yet',
  })
  text.append(name, meta)

  const launch = Object.assign(document.createElement('button'), { type: 'button', textContent: 'Launch', disabled: count === 0 })
  launch.setAttribute('aria-label', `Launch ${preset.name}`)
  launch.addEventListener('click', async () => {
    launch.disabled = true
    launch.textContent = '…'
    try {
      const { id } = await api(`presets/${preset.id}/launch`, { method: 'POST' })
      openOnSite(`/encounters/${id}`)
    } catch (error) {
      handle(error)
      launch.disabled = false
      launch.textContent = 'Launch'
    }
  })

  li.append(text, launch)
  return li
}

// ─── Start ───────────────────────────────────────────────────────────────────

for (const button of document.querySelectorAll('[data-open]')) {
  button.addEventListener('click', () => openOnSite(button.dataset.open))
}

async function start() {
  show('loading')
  try {
    const { user } = await api('auth/me')
    if (!user) return show('signed-out')
    $('username').textContent = user.username
    show('signed-in')
    selectTab('new')
  } catch {
    show('offline')
  }
}

$('retry').addEventListener('click', start)
start()
