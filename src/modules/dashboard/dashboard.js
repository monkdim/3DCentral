// Dashboard Module — Central hub for PrintHQ
// Manages printer status display, print logging, queue timers, and history browsing.

(function () {
  'use strict';

  // ---- State ----
  let prints = [];
  let filaments = [];
  let queue = [];            // { id, name, printer, totalSeconds, remainingSeconds, intervalId }
  let logRatingWidget = null;
  let expandedRows = new Set();
  let printerStatuses = { bambu_a1: 'idle', kobra_s1: 'idle' };

  // ---- Initialization ----

  async function init() {
    prints = await window.storage.getPrints() || [];
    filaments = await window.storage.getFilaments() || [];

    computePrinterStats();
    populateMaterialChips();
    populateMaterialFilter();
    renderQueue();
    renderHistory();
    bindEvents();

    // Initialize the rating widget inside the Log Print form
    const ratingContainer = document.getElementById('log-rating');
    if (ratingContainer) {
      logRatingWidget = initRating(ratingContainer);
    }
  }

  // ---- Printer Stats ----

  function computePrinterStats() {
    const printers = ['bambu_a1', 'kobra_s1'];
    printers.forEach(pid => {
      const printerPrints = prints.filter(p => p.printer === pid);
      const total = printerPrints.length;
      const successes = printerPrints.filter(p => p.status === 'success').length;
      const rate = total > 0 ? Math.round((successes / total) * 100) : 0;
      const totalMinutes = printerPrints.reduce((sum, p) => sum + (p.printTime_min || 0), 0);
      const hours = Math.round(totalMinutes / 60);

      const elTotal = document.getElementById(`stat-total-${pid}`);
      const elRate = document.getElementById(`stat-rate-${pid}`);
      const elHours = document.getElementById(`stat-hours-${pid}`);

      if (elTotal) elTotal.textContent = total;
      if (elRate) elRate.textContent = rate + '%';
      if (elHours) elHours.textContent = hours + 'h';
    });
  }

  // ---- Printer Status Toggle ----

  function updatePrinterStatusDisplay(printerId, status) {
    printerStatuses[printerId] = status;
    const dot = document.getElementById(`status-dot-${printerId}`);
    const card = document.getElementById(`printer-card-${printerId}`);

    if (dot) {
      dot.className = 'status-dot';
      if (status === 'idle') dot.classList.add('status-idle');
      else if (status === 'printing') dot.classList.add('status-printing');
      else if (status === 'error') dot.classList.add('status-error');
    }

    if (card) {
      card.removeAttribute('data-status');
      if (status !== 'idle') card.setAttribute('data-status', status);
    }
  }

  // ---- Material Chips for Log Form ----

  function populateMaterialChips() {
    const container = document.getElementById('log-material-container');
    if (!container) return;
    container.innerHTML = '';

    // Build unique material names from filament inventory
    const materialNames = [];
    filaments.forEach(f => {
      const label = f.material ? `${f.material} ${f.color || ''}`.trim() : (f.name || 'Unknown');
      if (!materialNames.find(m => m.label === label)) {
        materialNames.push({ label, id: f.id });
      }
    });

    // If no filaments, show common materials from materialDB
    if (materialNames.length === 0) {
      const dbMats = Object.keys(window.materialDB || {});
      dbMats.forEach(m => {
        materialNames.push({ label: m, id: null });
      });
    }

    materialNames.forEach(m => {
      const chip = document.createElement('span');
      chip.className = 'material-chip';
      chip.textContent = m.label;
      chip.dataset.label = m.label;
      if (m.id) chip.dataset.filamentId = m.id;
      chip.addEventListener('click', () => {
        chip.classList.toggle('selected');
      });
      container.appendChild(chip);
    });
  }

  function getSelectedMaterials() {
    const container = document.getElementById('log-material-container');
    if (!container) return [];
    const chips = container.querySelectorAll('.material-chip.selected');
    return Array.from(chips).map(c => ({
      label: c.dataset.label,
      filamentId: c.dataset.filamentId || null
    }));
  }

  // ---- Material Filter for History ----

  function populateMaterialFilter() {
    const select = document.getElementById('filter-material');
    if (!select) return;

    // Collect unique material names from print history
    const seen = new Set();
    prints.forEach(p => {
      (p.material || []).forEach(m => seen.add(m));
    });

    // Preserve existing "All Materials" option
    select.innerHTML = '<option value="">All Materials</option>';
    Array.from(seen).sort().forEach(m => {
      const opt = document.createElement('option');
      opt.value = m;
      opt.textContent = m;
      select.appendChild(opt);
    });
  }

  // ---- Event Binding ----

  function bindEvents() {
    // Quick actions
    const btnLogPrint = document.getElementById('btn-log-print');
    if (btnLogPrint) btnLogPrint.addEventListener('click', () => openModal('modal-log-print'));

    const btnStartTimer = document.getElementById('btn-start-timer');
    if (btnStartTimer) btnStartTimer.addEventListener('click', () => openModal('modal-start-timer'));

    const btnAddFilament = document.getElementById('btn-add-filament');
    if (btnAddFilament) {
      btnAddFilament.addEventListener('click', () => {
        // Navigate to the filament module
        if (typeof switchModule === 'function') switchModule('filament');
      });
    }

    // Modal close buttons
    document.querySelectorAll('[data-close]').forEach(btn => {
      btn.addEventListener('click', () => closeModal(btn.dataset.close));
    });

    // Close modals on overlay click
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closeModal(overlay.id);
      });
    });

    // Printer status selects
    document.querySelectorAll('.printer-status-select').forEach(select => {
      select.addEventListener('change', () => {
        updatePrinterStatusDisplay(select.dataset.printer, select.value);
      });
    });

    // Status field toggling failure reason visibility
    const logStatus = document.getElementById('log-status');
    if (logStatus) {
      logStatus.addEventListener('change', () => {
        const failGroup = document.getElementById('failure-reason-group');
        if (failGroup) failGroup.style.display = logStatus.value === 'failed' ? '' : 'none';
      });
    }

    // Settings section toggle
    const toggleSettings = document.getElementById('toggle-settings');
    if (toggleSettings) {
      toggleSettings.addEventListener('click', () => {
        const section = document.getElementById('settings-section');
        const arrow = document.getElementById('settings-arrow');
        if (section) {
          const open = section.style.display !== 'none';
          section.style.display = open ? 'none' : '';
          if (arrow) arrow.classList.toggle('open', !open);
        }
      });
    }

    // Log print form
    const formLogPrint = document.getElementById('form-log-print');
    if (formLogPrint) formLogPrint.addEventListener('submit', handleLogPrint);

    // Start timer form
    const formStartTimer = document.getElementById('form-start-timer');
    if (formStartTimer) formStartTimer.addEventListener('submit', handleStartTimer);

    // History search
    const searchInput = document.getElementById('history-search');
    if (searchInput) searchInput.addEventListener('input', renderHistory);

    // Filters
    const filterIds = ['filter-printer', 'filter-material', 'filter-status', 'filter-date-from', 'filter-date-to', 'filter-tags', 'filter-rating'];
    filterIds.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('change', renderHistory);
    });

    // The tags filter also fires on input (for typing)
    const filterTags = document.getElementById('filter-tags');
    if (filterTags) filterTags.addEventListener('input', renderHistory);

    // Clear filters
    const btnClear = document.getElementById('btn-clear-filters');
    if (btnClear) btnClear.addEventListener('click', clearFilters);
  }

  // ---- Log Print Handler ----

  async function handleLogPrint(e) {
    e.preventDefault();

    const name = document.getElementById('log-name').value.trim();
    const printer = document.getElementById('log-printer').value;
    const status = document.getElementById('log-status').value;
    const filamentUsed = parseFloat(document.getElementById('log-filament-used').value) || 0;
    const hours = parseInt(document.getElementById('log-print-hours').value, 10) || 0;
    const minutes = parseInt(document.getElementById('log-print-minutes').value, 10) || 0;
    const printTime = hours * 60 + minutes;

    const selectedMaterials = getSelectedMaterials();

    // Validation
    if (!name) return alertField('log-name', 'Print name is required.');
    if (!printer) return alertField('log-printer', 'Select a printer.');
    if (selectedMaterials.length === 0) return alertField('log-material-container', 'Select at least one material.');
    if (filamentUsed <= 0) return alertField('log-filament-used', 'Enter the filament weight used.');

    let failureReason = null;
    if (status === 'failed') {
      failureReason = document.getElementById('log-failure-reason').value || null;
    }

    // Gather settings
    const settings = {
      layerHeight: parseFloat(document.getElementById('log-layer-height').value) || 0.2,
      infill: parseInt(document.getElementById('log-infill').value, 10) || 20,
      infillPattern: document.getElementById('log-infill-pattern').value || 'grid',
      wallCount: parseInt(document.getElementById('log-wall-count').value, 10) || 3,
      topLayers: parseInt(document.getElementById('log-top-layers').value, 10) || 4,
      bottomLayers: parseInt(document.getElementById('log-bottom-layers').value, 10) || 4,
      supportType: document.getElementById('log-support-type').value || 'none',
      bedTemp: parseInt(document.getElementById('log-bed-temp').value, 10) || 60,
      nozzleTemp: parseInt(document.getElementById('log-nozzle-temp').value, 10) || 210,
      speed: parseInt(document.getElementById('log-speed').value, 10) || 250
    };

    const rating = logRatingWidget ? logRatingWidget.getValue() : 0;
    const tagsRaw = document.getElementById('log-tags').value.trim();
    const tags = tagsRaw ? tagsRaw.split(',').map(t => t.trim()).filter(Boolean) : [];
    const notes = document.getElementById('log-notes').value.trim();

    const record = {
      id: generateId(),
      name,
      printer,
      date: new Date().toISOString(),
      status,
      material: selectedMaterials.map(m => m.label),
      filamentUsed_g: filamentUsed,
      printTime_min: printTime,
      settings,
      notes,
      rating,
      tags,
      failureReason
    };

    // Save to storage
    await window.storage.addPrint(record);
    prints.unshift(record);

    // Auto-deduct filament from first selected spool that has a filamentId
    for (const mat of selectedMaterials) {
      if (mat.filamentId) {
        await window.storage.deductFilament(mat.filamentId, filamentUsed);
        break; // Deduct from first matched spool
      }
    }

    // Refresh data
    filaments = await window.storage.getFilaments() || [];

    // Update UI
    computePrinterStats();
    populateMaterialFilter();
    renderHistory();
    resetLogForm();
    closeModal('modal-log-print');
  }

  function alertField(fieldId, message) {
    const el = document.getElementById(fieldId);
    if (el) {
      el.focus();
      el.style.borderColor = 'var(--danger)';
      setTimeout(() => { el.style.borderColor = ''; }, 2000);
    }
    // Simple inline notification — could be replaced with a toast system
    console.warn('Validation:', message);
  }

  function resetLogForm() {
    const form = document.getElementById('form-log-print');
    if (form) form.reset();

    // Reset material chips
    document.querySelectorAll('#log-material-container .material-chip').forEach(c => c.classList.remove('selected'));

    // Reset rating
    if (logRatingWidget) logRatingWidget.setValue(0);

    // Hide failure reason
    const failGroup = document.getElementById('failure-reason-group');
    if (failGroup) failGroup.style.display = 'none';

    // Collapse settings
    const section = document.getElementById('settings-section');
    const arrow = document.getElementById('settings-arrow');
    if (section) section.style.display = 'none';
    if (arrow) arrow.classList.remove('open');
  }

  // ---- Print Queue & Timer ----

  function handleStartTimer(e) {
    e.preventDefault();

    const name = document.getElementById('timer-name').value.trim();
    const printer = document.getElementById('timer-printer').value;
    const hours = parseInt(document.getElementById('timer-hours').value, 10) || 0;
    const minutes = parseInt(document.getElementById('timer-minutes').value, 10) || 0;
    const totalSeconds = (hours * 60 + minutes) * 60;

    if (!name) return;
    if (totalSeconds <= 0) return;

    const item = {
      id: generateId(),
      name,
      printer,
      totalSeconds,
      remainingSeconds: totalSeconds,
      intervalId: null
    };

    queue.push(item);
    startCountdown(item);
    renderQueue();
    closeModal('modal-start-timer');

    // Reset form
    const form = document.getElementById('form-start-timer');
    if (form) form.reset();
    document.getElementById('timer-minutes').value = '30';
  }

  function startCountdown(item) {
    item.intervalId = setInterval(() => {
      item.remainingSeconds--;

      if (item.remainingSeconds <= 0) {
        item.remainingSeconds = 0;
        clearInterval(item.intervalId);
        item.intervalId = null;

        // Send desktop notification
        if (window.notifications && window.notifications.timerComplete) {
          window.notifications.timerComplete(item.name);
        }
      }

      renderQueue();
    }, 1000);
  }

  function removeQueueItem(id) {
    const idx = queue.findIndex(q => q.id === id);
    if (idx === -1) return;
    if (queue[idx].intervalId) clearInterval(queue[idx].intervalId);
    queue.splice(idx, 1);
    renderQueue();
  }

  function renderQueue() {
    const list = document.getElementById('queue-list');
    const emptyEl = document.getElementById('queue-empty');
    const countBadge = document.getElementById('queue-count');
    if (!list) return;

    if (countBadge) countBadge.textContent = queue.length;

    if (queue.length === 0) {
      // Show empty state only
      list.innerHTML = '';
      if (emptyEl) {
        emptyEl.classList.remove('hidden');
        list.appendChild(emptyEl);
      }
      return;
    }

    list.innerHTML = '';
    if (emptyEl) emptyEl.classList.add('hidden');

    queue.forEach(item => {
      const profileName = window.printerProfiles[item.printer]
        ? window.printerProfiles[item.printer].shortName
        : item.printer;

      const pct = item.totalSeconds > 0
        ? ((item.totalSeconds - item.remainingSeconds) / item.totalSeconds) * 100
        : 100;

      const timerText = formatCountdown(item.remainingSeconds);
      const isExpired = item.remainingSeconds <= 0;
      const isWarning = !isExpired && item.remainingSeconds < 300; // < 5 min

      const el = document.createElement('div');
      el.className = 'queue-item';
      el.draggable = true;
      el.dataset.id = item.id;

      el.innerHTML = `
        <div class="queue-item-left">
          <span class="queue-drag-handle">&#x2630;</span>
          <div>
            <div class="queue-item-name">${escapeHtml(item.name)}</div>
            <div class="queue-item-printer">${escapeHtml(profileName)}</div>
          </div>
        </div>
        <div class="queue-item-right">
          <div>
            <div class="queue-timer ${isExpired ? 'expired' : ''} ${isWarning ? 'warning' : ''}">${timerText}</div>
            <div class="timer-progress">
              <div class="timer-progress-fill ${isExpired ? 'expired' : ''} ${isWarning ? 'warning' : ''}" style="width: ${pct}%"></div>
            </div>
          </div>
          <div class="queue-item-actions">
            <button class="btn-icon queue-remove-btn" data-id="${item.id}" title="Remove">&times;</button>
          </div>
        </div>
      `;

      // Remove button
      el.querySelector('.queue-remove-btn').addEventListener('click', (ev) => {
        ev.stopPropagation();
        removeQueueItem(item.id);
      });

      // Drag events
      el.addEventListener('dragstart', onDragStart);
      el.addEventListener('dragend', onDragEnd);
      el.addEventListener('dragover', onDragOver);
      el.addEventListener('drop', onDrop);
      el.addEventListener('dragleave', onDragLeave);

      list.appendChild(el);
    });
  }

  // Drag and drop reordering for queue
  let draggedItemId = null;

  function onDragStart(e) {
    draggedItemId = e.currentTarget.dataset.id;
    e.currentTarget.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
  }

  function onDragEnd(e) {
    e.currentTarget.classList.remove('dragging');
    // Clean up any drag-over highlights
    document.querySelectorAll('.queue-item.drag-over').forEach(el => el.classList.remove('drag-over'));
    draggedItemId = null;
  }

  function onDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const target = e.currentTarget;
    if (target.dataset.id !== draggedItemId) {
      target.classList.add('drag-over');
    }
  }

  function onDragLeave(e) {
    e.currentTarget.classList.remove('drag-over');
  }

  function onDrop(e) {
    e.preventDefault();
    const targetId = e.currentTarget.dataset.id;
    e.currentTarget.classList.remove('drag-over');

    if (!draggedItemId || draggedItemId === targetId) return;

    const fromIdx = queue.findIndex(q => q.id === draggedItemId);
    const toIdx = queue.findIndex(q => q.id === targetId);
    if (fromIdx === -1 || toIdx === -1) return;

    const [moved] = queue.splice(fromIdx, 1);
    queue.splice(toIdx, 0, moved);
    renderQueue();
  }

  function formatCountdown(seconds) {
    if (seconds <= 0) return '0:00';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    const mStr = h > 0 ? String(m).padStart(2, '0') : String(m);
    const sStr = String(s).padStart(2, '0');
    if (h > 0) return `${h}:${mStr}:${sStr}`;
    return `${mStr}:${sStr}`;
  }

  // ---- Print History ----

  function getFilteredPrints() {
    const searchVal = (document.getElementById('history-search')?.value || '').toLowerCase().trim();
    const filterPrinter = document.getElementById('filter-printer')?.value || '';
    const filterMaterial = document.getElementById('filter-material')?.value || '';
    const filterStatus = document.getElementById('filter-status')?.value || '';
    const filterDateFrom = document.getElementById('filter-date-from')?.value || '';
    const filterDateTo = document.getElementById('filter-date-to')?.value || '';
    const filterTagsVal = (document.getElementById('filter-tags')?.value || '').toLowerCase().trim();
    const filterRating = parseInt(document.getElementById('filter-rating')?.value, 10) || 0;

    return prints.filter(p => {
      // Search
      if (searchVal) {
        const haystack = [
          p.name,
          ...(p.material || []),
          ...(p.tags || []),
          p.notes || '',
          p.printer || ''
        ].join(' ').toLowerCase();
        if (!haystack.includes(searchVal)) return false;
      }

      // Printer
      if (filterPrinter && p.printer !== filterPrinter) return false;

      // Material
      if (filterMaterial && !(p.material || []).includes(filterMaterial)) return false;

      // Status
      if (filterStatus && p.status !== filterStatus) return false;

      // Date range
      if (filterDateFrom) {
        const from = new Date(filterDateFrom);
        const pDate = new Date(p.date);
        if (pDate < from) return false;
      }
      if (filterDateTo) {
        const to = new Date(filterDateTo);
        to.setHours(23, 59, 59, 999);
        const pDate = new Date(p.date);
        if (pDate > to) return false;
      }

      // Tags
      if (filterTagsVal) {
        const searchTags = filterTagsVal.split(',').map(t => t.trim()).filter(Boolean);
        const pTags = (p.tags || []).map(t => t.toLowerCase());
        if (!searchTags.some(st => pTags.includes(st))) return false;
      }

      // Rating
      if (filterRating > 0 && (p.rating || 0) < filterRating) return false;

      return true;
    });
  }

  function renderHistory() {
    const tbody = document.getElementById('history-tbody');
    const emptyEl = document.getElementById('history-empty');
    const table = document.getElementById('history-table');
    if (!tbody) return;

    const filtered = getFilteredPrints();

    if (filtered.length === 0) {
      tbody.innerHTML = '';
      if (table) table.classList.add('hidden');
      if (emptyEl) emptyEl.classList.remove('hidden');
      return;
    }

    if (table) table.classList.remove('hidden');
    if (emptyEl) emptyEl.classList.add('hidden');

    tbody.innerHTML = '';

    filtered.forEach(p => {
      const profileName = window.printerProfiles[p.printer]
        ? window.printerProfiles[p.printer].shortName
        : p.printer;

      // Status tag
      let statusTag = '';
      if (p.status === 'success') statusTag = '<span class="tag tag-success">Success</span>';
      else if (p.status === 'failed') statusTag = '<span class="tag tag-danger">Failed</span>';
      else if (p.status === 'cancelled') statusTag = '<span class="tag tag-warning">Cancelled</span>';

      // Rating display
      const ratingHtml = renderStars(p.rating || 0);

      // Materials
      const materialsText = (p.material || []).join(', ') || '-';

      const isExpanded = expandedRows.has(p.id);

      // Main row
      const tr = document.createElement('tr');
      tr.className = 'history-row';
      tr.dataset.id = p.id;
      tr.innerHTML = `
        <td><button class="history-expand-btn ${isExpanded ? 'expanded' : ''}">&#x25B6;</button></td>
        <td class="truncate" title="${escapeHtml(p.name)}">${escapeHtml(p.name)}</td>
        <td>${escapeHtml(profileName)}</td>
        <td class="truncate" title="${escapeHtml(materialsText)}">${escapeHtml(materialsText)}</td>
        <td>${formatDuration(p.printTime_min)}</td>
        <td>${statusTag}</td>
        <td>${ratingHtml}</td>
        <td>${formatDate(p.date)}</td>
      `;

      tr.addEventListener('click', () => toggleExpandRow(p.id));
      tbody.appendChild(tr);

      // Detail row (always present, hidden if not expanded)
      if (isExpanded) {
        const detailTr = createDetailRow(p);
        tbody.appendChild(detailTr);
      }
    });
  }

  function toggleExpandRow(id) {
    if (expandedRows.has(id)) {
      expandedRows.delete(id);
    } else {
      expandedRows.add(id);
    }
    renderHistory();
  }

  function createDetailRow(p) {
    const tr = document.createElement('tr');
    tr.className = 'history-detail-row';

    const s = p.settings || {};

    const failText = p.failureReason
      ? `<div class="detail-item"><span class="detail-label">Failure Reason</span><span class="detail-value text-danger">${escapeHtml(p.failureReason)}</span></div>`
      : '';

    const tagsHtml = (p.tags || []).length > 0
      ? `<div class="history-tags">${p.tags.map(t => `<span class="tag">${escapeHtml(t)}</span>`).join('')}</div>`
      : '';

    const notesHtml = p.notes
      ? `<div class="history-detail-notes">${escapeHtml(p.notes)}</div>`
      : '';

    tr.innerHTML = `
      <td colspan="8">
        <div class="history-detail-content">
          <div class="history-detail-grid">
            <div class="detail-item">
              <span class="detail-label">Filament Used</span>
              <span class="detail-value">${p.filamentUsed_g != null ? p.filamentUsed_g + 'g' : '-'}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">Layer Height</span>
              <span class="detail-value">${s.layerHeight != null ? s.layerHeight + 'mm' : '-'}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">Infill</span>
              <span class="detail-value">${s.infill != null ? s.infill + '% ' + (s.infillPattern || '') : '-'}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">Walls</span>
              <span class="detail-value">${s.wallCount != null ? s.wallCount : '-'}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">Top / Bottom Layers</span>
              <span class="detail-value">${s.topLayers != null ? s.topLayers + ' / ' + s.bottomLayers : '-'}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">Support</span>
              <span class="detail-value">${s.supportType || 'none'}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">Bed Temp</span>
              <span class="detail-value">${s.bedTemp != null ? s.bedTemp + '&deg;C' : '-'}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">Nozzle Temp</span>
              <span class="detail-value">${s.nozzleTemp != null ? s.nozzleTemp + '&deg;C' : '-'}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">Speed</span>
              <span class="detail-value">${s.speed != null ? s.speed + ' mm/s' : '-'}</span>
            </div>
            ${failText}
          </div>
          ${tagsHtml}
          ${notesHtml}
          <button class="btn btn-sm btn-danger history-delete-btn" data-id="${p.id}">Delete Print</button>
        </div>
      </td>
    `;

    // Delete button handler
    const deleteBtn = tr.querySelector('.history-delete-btn');
    if (deleteBtn) {
      deleteBtn.addEventListener('click', async (ev) => {
        ev.stopPropagation();
        if (!confirm(`Delete "${p.name}"? This cannot be undone.`)) return;
        await window.storage.deletePrint(p.id);
        prints = prints.filter(pr => pr.id !== p.id);
        expandedRows.delete(p.id);
        computePrinterStats();
        populateMaterialFilter();
        renderHistory();
      });
    }

    return tr;
  }

  function renderStars(rating) {
    let html = '<span class="history-rating-display">';
    for (let i = 1; i <= 5; i++) {
      html += `<span class="star ${i <= rating ? 'filled' : ''}">${i <= rating ? '\u2605' : '\u2606'}</span>`;
    }
    html += '</span>';
    return html;
  }

  function clearFilters() {
    const ids = ['filter-printer', 'filter-material', 'filter-status', 'filter-date-from', 'filter-date-to', 'filter-tags', 'filter-rating'];
    ids.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    const search = document.getElementById('history-search');
    if (search) search.value = '';
    renderHistory();
  }

  // ---- Utilities ----

  function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // ---- Boot ----
  init();

})();
