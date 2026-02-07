// PrintHQ — Main Renderer Process Entry
// Loads modules, handles navigation, manages app state

const MODULE_NAMES = {
  dashboard: 'Dashboard',
  filament: 'Filament Manager',
  router: 'Print Router',
  gcode: 'G-code Toolkit',
  optimizer: 'Strength Optimizer',
  multicolor: 'Multi-Color Planner',
  workshop: 'Design Workshop',
  analytics: 'Analytics'
};

const MODULE_FILES = [
  'dashboard', 'filament', 'router', 'gcode', 'optimizer', 'multicolor', 'workshop', 'analytics'
];

let currentModule = 'dashboard';
let modulesLoaded = {};

// Generate a UUID (browser-compatible)
function generateId() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

// ---- Navigation ----

function initNavigation() {
  document.querySelectorAll('.nav-item[data-module]').forEach(item => {
    item.addEventListener('click', () => {
      const moduleName = item.dataset.module;
      switchModule(moduleName);
    });
  });

  // Sidebar collapse
  document.getElementById('toggle-sidebar').addEventListener('click', () => {
    const sidebar = document.getElementById('sidebar');
    sidebar.classList.toggle('collapsed');
    const icon = document.querySelector('#toggle-sidebar .nav-icon');
    icon.textContent = sidebar.classList.contains('collapsed') ? '\u2B9E' : '\u2B9C';
  });

  // Theme toggle
  document.getElementById('toggle-theme').addEventListener('click', () => {
    const html = document.documentElement;
    const current = html.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    html.setAttribute('data-theme', next);
    const icon = document.querySelector('#toggle-theme .nav-icon');
    icon.textContent = next === 'dark' ? '\uD83C\uDF19' : '\u2600';
    window.storage.saveSetting('theme', next);
  });
}

async function switchModule(moduleName) {
  if (!MODULE_NAMES[moduleName]) return;

  // Update nav
  document.querySelectorAll('.nav-item[data-module]').forEach(item => {
    item.classList.toggle('active', item.dataset.module === moduleName);
  });

  // Update topbar
  document.getElementById('topbar-title').textContent = MODULE_NAMES[moduleName];

  // Load module if not already loaded
  if (!modulesLoaded[moduleName]) {
    await loadModule(moduleName);
  }

  // Show/hide views
  document.querySelectorAll('.module-view').forEach(v => {
    v.classList.toggle('active', v.id === `module-${moduleName}`);
  });

  currentModule = moduleName;
}

async function loadModule(moduleName) {
  try {
    // Load HTML
    const response = await fetch(`modules/${moduleName}/${moduleName}.html`);
    const html = await response.text();

    const container = document.createElement('div');
    container.id = `module-${moduleName}`;
    container.className = 'module-view';
    container.innerHTML = html;
    document.getElementById('content').appendChild(container);

    // Load CSS
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = `modules/${moduleName}/${moduleName}.css`;
    document.head.appendChild(link);

    // Load JS
    const script = document.createElement('script');
    script.src = `modules/${moduleName}/${moduleName}.js`;
    document.body.appendChild(script);

    modulesLoaded[moduleName] = true;
  } catch (err) {
    console.error(`Failed to load module: ${moduleName}`, err);
  }
}

// ---- Tab helpers (used by modules) ----

function initTabs(containerSelector) {
  const container = document.querySelector(containerSelector);
  if (!container) return;

  container.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.tab;
      container.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b === btn));
      container.querySelectorAll('.tab-panel').forEach(p => p.classList.toggle('active', p.id === target));
    });
  });
}

// ---- Modal helpers ----

function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.add('active');
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.remove('active');
}

// ---- Rating stars helper ----

function initRating(container, onChange) {
  const stars = container.querySelectorAll('.star');
  let value = 0;

  stars.forEach((star, idx) => {
    star.addEventListener('click', () => {
      value = idx + 1;
      updateStars();
      if (onChange) onChange(value);
    });
    star.addEventListener('mouseenter', () => {
      stars.forEach((s, i) => {
        s.textContent = i <= idx ? '\u2605' : '\u2606';
      });
    });
  });

  container.addEventListener('mouseleave', () => {
    updateStars();
  });

  function updateStars() {
    stars.forEach((s, i) => {
      s.textContent = i < value ? '\u2605' : '\u2606';
      s.classList.toggle('filled', i < value);
    });
  }

  return {
    getValue: () => value,
    setValue: (v) => { value = v; updateStars(); }
  };
}

// ---- Time formatting ----

function formatDuration(minutes) {
  if (!minutes) return '0m';
  const hrs = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  if (hrs > 0) return `${hrs}h ${mins}m`;
  return `${mins}m`;
}

function formatDate(isoString) {
  if (!isoString) return '';
  const d = new Date(isoString);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatDateTime(isoString) {
  if (!isoString) return '';
  const d = new Date(isoString);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

// ---- App Init ----

async function initApp() {
  // Load settings
  const settings = await window.storage.getSettings();
  if (settings.theme) {
    document.documentElement.setAttribute('data-theme', settings.theme);
  }

  initNavigation();

  // Load dashboard by default
  await switchModule('dashboard');
}

document.addEventListener('DOMContentLoaded', initApp);
