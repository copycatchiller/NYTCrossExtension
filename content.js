'use strict';

const DEFAULTS = { pencilColor: '#FF69B4', pencilKey: '.', rebusKey: 'Alt' };
const MODIFIER_KEYS = new Set(['Alt', 'Shift', 'Control', 'Meta']);

let settings = { ...DEFAULTS };
let rebusActivatedByUs = false;
let styleEl = null;

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------

function init() {
  chrome.storage.sync.get(DEFAULTS, (stored) => {
    settings = { ...DEFAULTS, ...stored };
    updatePencilColor(settings.pencilColor);
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'sync') return;
    if (changes.pencilColor) { settings.pencilColor = changes.pencilColor.newValue; updatePencilColor(settings.pencilColor); }
    if (changes.pencilKey)   settings.pencilKey = changes.pencilKey.newValue;
    if (changes.rebusKey)    settings.rebusKey  = changes.rebusKey.newValue;
  });

  setupKeyListeners();
  waitForGrid();
}

// ---------------------------------------------------------------------------
// Pencil color – CSS injection + direct-DOM fallback
// ---------------------------------------------------------------------------

function updatePencilColor(color) {
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = 'nyt-xwd-enhancer';
    (document.head || document.documentElement).appendChild(styleEl);
  }

  // Pencil cells have xwd__cell--penciled on the <rect>; the visible letter
  // is in the sibling <text data-testid="cell-text">.
  styleEl.textContent = `
    rect.xwd__cell--penciled ~ text[data-testid="cell-text"] {
      fill: ${color} !important;
    }
  `;
}

// Direct-DOM pass: belt-and-suspenders alongside the CSS rule
function applyColorDirectly(color) {
  for (const rect of document.querySelectorAll('rect.xwd__cell--penciled')) {
    const text = rect.parentElement?.querySelector('text[data-testid="cell-text"]');
    if (text) text.style.fill = color;
  }
}

// Wait for the SVG grid to appear, then watch it for new pencil letters
function waitForGrid() {
  function attach() {
    const svg = document.querySelector('svg');
    if (!svg) return false;

    new MutationObserver(() => applyColorDirectly(settings.pencilColor))
      .observe(svg, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'data-testid'] });

    return true;
  }

  if (!attach()) {
    const obs = new MutationObserver(() => { if (attach()) obs.disconnect(); });
    obs.observe(document.body, { childList: true, subtree: true });
  }
}

// ---------------------------------------------------------------------------
// Button helpers
// ---------------------------------------------------------------------------

function findCrosswordButton(keyword) {
  const lower = keyword.toLowerCase();

  // 1. Child element whose class contains the keyword (e.g. xwd__toolbar_icon--pencil)
  const byChild = document.querySelector(
    `button [class*="${lower}"], [role="button"] [class*="${lower}"]`
  );
  if (byChild) return byChild.closest('button') ?? byChild.closest('[role="button"]');

  // 2. aria-label / title / data-testid / text on the button itself
  for (const el of document.querySelectorAll('button, [role="button"]')) {
    const label = [
      el.getAttribute('aria-label') || '',
      el.getAttribute('title') || '',
      el.getAttribute('data-testid') || '',
    ].join(' ').toLowerCase();
    if (label.includes(lower)) return el;
    if ((el.textContent || '').trim().toLowerCase() === lower) return el;
  }

  return null;
}

function isButtonActive(btn) {
  if (!btn) return false;
  return (
    btn.getAttribute('aria-pressed') === 'true' ||
    btn.getAttribute('aria-checked') === 'true' ||
    btn.classList.contains('active') ||
    btn.classList.contains('selected') ||
    btn.classList.contains('is-active')
  );
}

// ---------------------------------------------------------------------------
// Keyboard handling
// ---------------------------------------------------------------------------

function setupKeyListeners() {
  document.addEventListener('keydown', onKeyDown, true);
  document.addEventListener('keyup', onKeyUp, true);
}

function onKeyDown(e) {
  // Only act when the crossword SVG grid is present
  if (!document.querySelector('svg')) return;

  // ── While rebus is active, prevent modifier+letter from producing special
  //    characters (e.g. ⌥S → ß on Mac). Extract the plain letter from e.code
  //    and insert it directly so the rebus input gets the right character.
  if (rebusActivatedByUs && e.code.startsWith('Key') && !MODIFIER_KEYS.has(e.key)) {
    e.preventDefault();
    document.execCommand('insertText', false, e.code.slice(3)); // 'KeyS' → 'S'
    return;
  }

  // Leave standard text fields alone for everything else
  const tag = (e.target.tagName || '').toUpperCase();
  if (tag === 'INPUT' || tag === 'TEXTAREA') return;

  // ── Pencil toggle ────────────────────────────────────────────────────────
  if (e.key === settings.pencilKey) {
    const btn = findCrosswordButton('pencil');
    if (btn) {
      e.preventDefault();
      e.stopPropagation();
      btn.click();
    }
    return;
  }

  // ── Rebus activate ───────────────────────────────────────────────────────
  if (e.key === settings.rebusKey && !rebusActivatedByUs) {
    e.preventDefault();
    const btn = findCrosswordButton('rebus');
    if (btn) {
      btn.click();
      rebusActivatedByUs = true;
    }
  }
}

function onKeyUp(e) {
  // ── Rebus deactivate ─────────────────────────────────────────────────────
  if (e.key === settings.rebusKey && rebusActivatedByUs) {
    rebusActivatedByUs = false;
    const btn = findCrosswordButton('rebus');
    if (btn) btn.click();
  }
}

// ---------------------------------------------------------------------------
init();
