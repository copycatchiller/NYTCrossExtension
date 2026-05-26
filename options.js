'use strict';

const DEFAULTS = { pencilColor: '#FF69B4', pencilKey: '.', rebusKey: 'Alt' };
const MODIFIER_KEYS = new Set(['Alt', 'Shift', 'Control', 'Meta']);
const KEY_LABELS = { 'Alt': '⌥ Alt', 'Shift': '⇧ Shift', 'Control': '⌃ Ctrl', 'Meta': '⌘ Cmd', ' ': 'Space' };

const colorPicker  = document.getElementById('colorPicker');
const rInput       = document.getElementById('rInput');
const gInput       = document.getElementById('gInput');
const bInput       = document.getElementById('bInput');
const previewText  = document.getElementById('previewText');
const saveBtn      = document.getElementById('saveBtn');
const resetBtn     = document.getElementById('resetBtn');
const statusMsg    = document.getElementById('statusMsg');
const pencilKeyBtn = document.getElementById('pencilKeyBtn');
const rebusKeyBtn  = document.getElementById('rebusKeyBtn');

let settings = { ...DEFAULTS };
let pendingCapture = null; // { btn, settingKey, modifierOnly }

// ---------------------------------------------------------------------------
// Color helpers
// ---------------------------------------------------------------------------

function hexToRgb(hex) {
  return {
    r: parseInt(hex.slice(1, 3), 16),
    g: parseInt(hex.slice(3, 5), 16),
    b: parseInt(hex.slice(5, 7), 16),
  };
}

function rgbToHex(r, g, b) {
  return '#' + [r, g, b]
    .map(v => Math.max(0, Math.min(255, Math.round(Number(v) || 0))).toString(16).padStart(2, '0'))
    .join('');
}

function applyHex(hex) {
  const { r, g, b } = hexToRgb(hex);
  colorPicker.value = hex;
  rInput.value = r;
  gInput.value = g;
  bInput.value = b;
  previewText.style.color = hex;
}

function syncFromRgb() {
  const hex = rgbToHex(rInput.value, gInput.value, bInput.value);
  colorPicker.value = hex;
  previewText.style.color = hex;
}

// ---------------------------------------------------------------------------
// Key label
// ---------------------------------------------------------------------------

function getKeyLabel(key) {
  return KEY_LABELS[key] ?? key;
}

// ---------------------------------------------------------------------------
// Key capture
// ---------------------------------------------------------------------------

function startCapture(btn, settingKey, modifierOnly) {
  if (pendingCapture) {
    pendingCapture.btn.textContent = getKeyLabel(settings[pendingCapture.settingKey]);
    pendingCapture.btn.classList.remove('capturing');
  }
  pendingCapture = { btn, settingKey, modifierOnly };
  btn.textContent = 'Press a key…';
  btn.classList.add('capturing');
}

function cancelCapture() {
  if (!pendingCapture) return;
  pendingCapture.btn.textContent = getKeyLabel(settings[pendingCapture.settingKey]);
  pendingCapture.btn.classList.remove('capturing');
  pendingCapture = null;
}

pencilKeyBtn.addEventListener('click', () => startCapture(pencilKeyBtn, 'pencilKey', false));
rebusKeyBtn.addEventListener('click',  () => startCapture(rebusKeyBtn,  'rebusKey',  true));

document.addEventListener('keydown', (e) => {
  if (!pendingCapture) return;

  const isModifier = MODIFIER_KEYS.has(e.key);
  if (pendingCapture.modifierOnly && !isModifier) return; // rebus: modifiers only
  if (!pendingCapture.modifierOnly && isModifier) return;  // pencil: no modifiers

  e.preventDefault();
  e.stopPropagation();

  settings[pendingCapture.settingKey] = e.key;
  pendingCapture.btn.textContent = getKeyLabel(e.key);
  pendingCapture.btn.classList.remove('capturing');
  pendingCapture = null;
}, true);

// Clicking elsewhere cancels capture
document.addEventListener('click', (e) => {
  if (pendingCapture && e.target !== pendingCapture.btn) cancelCapture();
});

// ---------------------------------------------------------------------------
// Save / Reset
// ---------------------------------------------------------------------------

saveBtn.addEventListener('click', () => {
  chrome.storage.sync.set({
    pencilColor: colorPicker.value,
    pencilKey:   settings.pencilKey,
    rebusKey:    settings.rebusKey,
  }, () => {
    statusMsg.textContent = 'Saved!';
    setTimeout(() => { statusMsg.textContent = ''; }, 2000);
  });
});

resetBtn.addEventListener('click', () => {
  settings.pencilKey = DEFAULTS.pencilKey;
  settings.rebusKey  = DEFAULTS.rebusKey;
  pencilKeyBtn.textContent = getKeyLabel(DEFAULTS.pencilKey);
  rebusKeyBtn.textContent  = getKeyLabel(DEFAULTS.rebusKey);
  applyHex(DEFAULTS.pencilColor);
});

colorPicker.addEventListener('input', () => applyHex(colorPicker.value));
[rInput, gInput, bInput].forEach(el => el.addEventListener('input', syncFromRgb));

// ---------------------------------------------------------------------------
// Load saved settings on open
// ---------------------------------------------------------------------------

chrome.storage.sync.get(DEFAULTS, (stored) => {
  settings = { ...DEFAULTS, ...stored };
  applyHex(settings.pencilColor);
  pencilKeyBtn.textContent = getKeyLabel(settings.pencilKey);
  rebusKeyBtn.textContent  = getKeyLabel(settings.rebusKey);
});
