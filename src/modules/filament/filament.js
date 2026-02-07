// Filament Manager — Module JavaScript
// Manages filament spools across 3 AMS/Ace units (12 total slots)

(function () {
  'use strict';

  // ---- State ----
  let filaments = [];
  let wishlist = [];
  let lowThreshold = 100; // grams, overridden from settings
  let editingSpoolId = null;

  // AMS/Ace unit definitions — 3 units, 12 slots total
  const AMS_UNITS = [
    {
      id: 'ams_lite_1',
      name: 'Bambu AMS Lite',
      printer: 'bambu_a1',
      printerName: 'Bambu Lab A1 Combo',
      slots: 4
    },
    {
      id: 'ace_pro_1',
      name: 'Anycubic Ace Pro #1',
      printer: 'kobra_s1',
      printerName: 'Anycubic Kobra S1 Combo',
      slots: 4
    },
    {
      id: 'ace_pro_2',
      name: 'Anycubic Ace Pro #2',
      printer: 'kobra_s1',
      printerName: 'Anycubic Kobra S1 Combo',
      slots: 4
    }
  ];

  // ---- Initialization ----

  async function init() {
    // Load data
    filaments = await window.storage.getFilaments();
    const settings = await window.storage.getSettings();
    lowThreshold = (settings && settings.lowFilamentThreshold) || 100;
    wishlist = (settings && settings.filamentWishlist) || [];

    // Init tabs
    initTabs('#filament-module');

    // Bind events
    bindEvents();

    // Populate material filter dropdown from materialDB
    populateMaterialFilter();

    // Initial renders
    renderSlotMap();
    renderInventory();
    renderCosts();
    renderMaterials();
    renderWishlist();
  }

  // ---- Event Bindings ----

  function bindEvents() {
    // Add spool button
    document.getElementById('fil-btn-add-spool').addEventListener('click', () => openSpoolModal());

    // Modal close/cancel
    document.getElementById('fil-modal-close-x').addEventListener('click', () => closeModal('fil-spool-modal'));
    document.getElementById('fil-modal-cancel').addEventListener('click', () => closeModal('fil-spool-modal'));
    document.getElementById('fil-modal-save').addEventListener('click', saveSpool);
    document.getElementById('fil-modal-delete').addEventListener('click', deleteSpool);

    // Color picker live preview
    const colorPicker = document.getElementById('fil-form-colorhex');
    const colorText = document.getElementById('fil-form-colorhex-text');
    const colorSwatch = document.getElementById('fil-form-swatch');

    colorPicker.addEventListener('input', () => {
      colorText.value = colorPicker.value;
      colorSwatch.style.background = colorPicker.value;
    });

    colorText.addEventListener('input', () => {
      const hex = colorText.value;
      if (/^#[0-9a-fA-F]{6}$/.test(hex)) {
        colorPicker.value = hex;
        colorSwatch.style.background = hex;
      }
    });

    // Printer change cascades unit and slot options
    document.getElementById('fil-form-printer').addEventListener('change', updateUnitOptions);
    document.getElementById('fil-form-unit').addEventListener('change', updateSlotOptions);

    // Auto-fill temp ranges when material changes
    document.getElementById('fil-form-material').addEventListener('change', autoFillTemps);

    // Inventory search and filters
    document.getElementById('fil-inv-search').addEventListener('input', renderInventory);
    document.getElementById('fil-inv-filter-status').addEventListener('change', renderInventory);
    document.getElementById('fil-inv-filter-material').addEventListener('change', renderInventory);
    document.getElementById('fil-inv-sort').addEventListener('change', renderInventory);

    // Wishlist add
    document.getElementById('fil-wish-add-btn').addEventListener('click', addWishlistItem);

    // Close modal on overlay click
    document.getElementById('fil-spool-modal').addEventListener('click', (e) => {
      if (e.target === e.currentTarget) closeModal('fil-spool-modal');
    });
  }

  // ---- Slot Map Rendering ----

  function renderSlotMap() {
    const container = document.getElementById('fil-slotmap-container');
    container.innerHTML = '';

    AMS_UNITS.forEach(unit => {
      const card = document.createElement('div');
      card.className = 'fil-unit-card';

      // Header
      const header = document.createElement('div');
      header.className = 'fil-unit-header';
      header.innerHTML = `
        <div>
          <div class="fil-unit-name">${unit.name}</div>
          <div class="fil-unit-printer">${unit.printerName}</div>
        </div>
        <span class="tag">${unit.slots} slots</span>
      `;
      card.appendChild(header);

      // Slots grid
      const slotsGrid = document.createElement('div');
      slotsGrid.className = 'fil-unit-slots';

      for (let s = 1; s <= unit.slots; s++) {
        const spool = findSpoolInSlot(unit.printer, unit.id, s);
        const slotEl = document.createElement('div');
        slotEl.className = 'fil-slot';

        if (spool) {
          const pct = getPercentRemaining(spool);
          const pctClass = getProgressClass(pct);

          slotEl.innerHTML = `
            <span class="fil-slot-number">S${s}</span>
            <div class="fil-slot-top">
              <span class="fil-slot-swatch" style="background:${escapeHtml(spool.colorHex || '#888')};"></span>
              <div class="fil-slot-info">
                <div class="fil-slot-material">${escapeHtml(spool.material)} - ${escapeHtml(spool.color || '')}</div>
                <div class="fil-slot-brand">${escapeHtml(spool.brand || 'Unknown')}</div>
              </div>
            </div>
            <div class="fil-slot-remaining">
              <div class="fil-slot-pct">
                <span>${spool.weightRemaining_g}g / ${spool.weightTotal_g}g</span>
                <span>${pct}%</span>
              </div>
              <div class="progress-bar ${pctClass}">
                <div class="progress-fill" style="width:${pct}%;"></div>
              </div>
            </div>
          `;

          slotEl.addEventListener('click', () => openSpoolModal(spool.id));
        } else {
          slotEl.classList.add('fil-slot-empty');
          slotEl.innerHTML = `
            <span class="fil-slot-number">S${s}</span>
            <span class="fil-slot-empty-icon">&#x25CB;</span>
            <span class="fil-slot-empty-text">Empty</span>
          `;
          slotEl.addEventListener('click', () => openSpoolModalForSlot(unit.printer, unit.id, s));
        }

        slotsGrid.appendChild(slotEl);
      }

      card.appendChild(slotsGrid);
      container.appendChild(card);
    });
  }

  function findSpoolInSlot(printer, unit, slot) {
    return filaments.find(f =>
      f.location &&
      f.location.printer === printer &&
      f.location.unit === unit &&
      f.location.slot === slot
    );
  }

  // ---- Inventory Rendering ----

  function renderInventory() {
    const tbody = document.getElementById('fil-inv-tbody');
    const emptyState = document.getElementById('fil-inv-empty');
    const warningsDiv = document.getElementById('fil-low-warnings');
    const searchVal = document.getElementById('fil-inv-search').value.toLowerCase();
    const filterStatus = document.getElementById('fil-inv-filter-status').value;
    const filterMaterial = document.getElementById('fil-inv-filter-material').value;
    const sortBy = document.getElementById('fil-inv-sort').value;

    // Filter
    let filtered = filaments.filter(f => {
      // Search
      const haystack = `${f.brand} ${f.material} ${f.color} ${f.notes || ''}`.toLowerCase();
      if (searchVal && !haystack.includes(searchVal)) return false;

      // Status filter
      const status = getSpoolStatus(f);
      if (filterStatus !== 'all' && status !== filterStatus) return false;

      // Material filter
      if (filterMaterial !== 'all' && f.material !== filterMaterial) return false;

      return true;
    });

    // Sort
    filtered = sortSpools(filtered, sortBy);

    // Low filament warnings
    const lowSpools = filaments.filter(f => f.weightRemaining_g > 0 && f.weightRemaining_g <= lowThreshold);
    if (lowSpools.length > 0) {
      warningsDiv.style.display = 'block';
      warningsDiv.innerHTML = lowSpools.map(f => `
        <div class="fil-low-warning-banner">
          <span class="fil-warn-icon">&#x26A0;</span>
          <span class="fil-warn-text">
            <strong>${escapeHtml(f.brand)} ${escapeHtml(f.material)} (${escapeHtml(f.color || '')})</strong>
            is low: ${f.weightRemaining_g}g remaining
          </span>
        </div>
      `).join('');
    } else {
      warningsDiv.style.display = 'none';
      warningsDiv.innerHTML = '';
    }

    // Render table
    if (filtered.length === 0) {
      tbody.innerHTML = '';
      emptyState.style.display = 'block';
      return;
    }

    emptyState.style.display = 'none';
    tbody.innerHTML = filtered.map(f => {
      const pct = getPercentRemaining(f);
      const pctClass = getProgressClass(pct);
      const status = getSpoolStatus(f);
      const statusTag = getStatusTag(status);
      const locationStr = getLocationString(f);
      const costStr = f.costPerKg != null ? `$${Number(f.costPerKg).toFixed(2)}` : '-';

      return `
        <tr>
          <td>
            <div class="fil-inv-color-cell">
              <span class="color-swatch" style="background:${escapeHtml(f.colorHex || '#888')};"></span>
              <span>${escapeHtml(f.color || '-')}</span>
            </div>
          </td>
          <td><strong>${escapeHtml(f.brand || '-')}</strong></td>
          <td><span class="tag">${escapeHtml(f.material)}</span></td>
          <td>${statusTag}</td>
          <td class="fil-inv-remaining-cell">
            <div class="fil-inv-remaining-bar">
              <div class="progress-bar ${pctClass}" style="flex:1;">
                <div class="progress-fill" style="width:${pct}%;"></div>
              </div>
              <span class="fil-inv-pct">${pct}%</span>
            </div>
            <div class="text-sm text-muted" style="margin-top:2px;">${f.weightRemaining_g}g / ${f.weightTotal_g}g</div>
          </td>
          <td>${costStr}</td>
          <td class="text-sm text-muted">${escapeHtml(locationStr)}</td>
          <td>
            <div class="fil-inv-actions">
              <button class="btn-icon btn-sm" title="Edit" onclick="window._filEditSpool('${f.id}')">&#x270E;</button>
              <button class="btn-icon btn-sm" title="Delete" onclick="window._filDeleteSpool('${f.id}')">&#x2716;</button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }

  function populateMaterialFilter() {
    const select = document.getElementById('fil-inv-filter-material');
    const materials = [...new Set(filaments.map(f => f.material))].sort();
    // Keep the "All Materials" option, add the rest
    const existing = select.querySelector('option[value="all"]');
    select.innerHTML = '';
    select.appendChild(existing);
    materials.forEach(mat => {
      const opt = document.createElement('option');
      opt.value = mat;
      opt.textContent = mat;
      select.appendChild(opt);
    });
  }

  function sortSpools(list, sortBy) {
    const copy = [...list];
    switch (sortBy) {
      case 'name':
        copy.sort((a, b) => `${a.brand} ${a.color}`.localeCompare(`${b.brand} ${b.color}`));
        break;
      case 'material':
        copy.sort((a, b) => a.material.localeCompare(b.material));
        break;
      case 'remaining':
        copy.sort((a, b) => a.weightRemaining_g - b.weightRemaining_g);
        break;
      case 'cost':
        copy.sort((a, b) => (b.costPerKg || 0) - (a.costPerKg || 0));
        break;
      case 'date':
        copy.sort((a, b) => (b.purchaseDate || '').localeCompare(a.purchaseDate || ''));
        break;
    }
    return copy;
  }

  function getSpoolStatus(f) {
    if (f.weightRemaining_g <= 0) return 'empty';
    if (f.location && f.location.printer && f.location.unit && f.location.slot) return 'loaded';
    return 'storage';
  }

  function getStatusTag(status) {
    switch (status) {
      case 'loaded':
        return '<span class="tag tag-success">Loaded</span>';
      case 'storage':
        return '<span class="tag">Storage</span>';
      case 'empty':
        return '<span class="tag tag-danger">Empty</span>';
      default:
        return '<span class="tag">Unknown</span>';
    }
  }

  function getLocationString(f) {
    if (!f.location || !f.location.printer) return 'Storage';
    const unit = AMS_UNITS.find(u => u.id === f.location.unit);
    const unitName = unit ? unit.name : f.location.unit;
    return `${unitName} / Slot ${f.location.slot}`;
  }

  // ---- Cost Calculations ----

  function renderCosts() {
    const now = new Date();
    const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const thisYear = String(now.getFullYear());

    let totalSpent = 0;
    let totalWeight = 0;
    let monthSpent = 0;
    let yearSpent = 0;
    const monthlyMap = {};

    filaments.forEach(f => {
      const spoolCost = calcSpoolCost(f);
      totalSpent += spoolCost;
      totalWeight += (f.weightTotal_g || 0);

      if (f.purchaseDate) {
        const monthKey = f.purchaseDate.substring(0, 7); // YYYY-MM
        const yearKey = f.purchaseDate.substring(0, 4);

        if (!monthlyMap[monthKey]) monthlyMap[monthKey] = { count: 0, total: 0 };
        monthlyMap[monthKey].count++;
        monthlyMap[monthKey].total += spoolCost;

        if (monthKey === thisMonth) monthSpent += spoolCost;
        if (yearKey === thisYear) yearSpent += spoolCost;
      }
    });

    const avgCostPerKg = totalWeight > 0 ? (totalSpent / (totalWeight / 1000)) : 0;

    // Summary cards
    document.getElementById('fil-cost-total').textContent = `$${totalSpent.toFixed(2)}`;
    document.getElementById('fil-cost-avg-kg').textContent = `$${avgCostPerKg.toFixed(2)}`;
    document.getElementById('fil-cost-month').textContent = `$${monthSpent.toFixed(2)}`;
    document.getElementById('fil-cost-year').textContent = `$${yearSpent.toFixed(2)}`;

    // Per-spool breakdown table
    const costTbody = document.getElementById('fil-cost-tbody');
    if (filaments.length === 0) {
      costTbody.innerHTML = '<tr><td colspan="7" class="text-muted" style="text-align:center;">No spools to display</td></tr>';
    } else {
      costTbody.innerHTML = filaments.map(f => {
        const spoolCost = calcSpoolCost(f);
        const usedG = (f.weightTotal_g || 0) - (f.weightRemaining_g || 0);
        const costPerGUsed = usedG > 0 ? (spoolCost / usedG) : 0;
        return `
          <tr>
            <td>
              <div class="flex items-center gap-sm">
                <span class="color-swatch" style="background:${escapeHtml(f.colorHex || '#888')};"></span>
                <span>${escapeHtml(f.brand)} ${escapeHtml(f.color || '')}</span>
              </div>
            </td>
            <td><span class="tag">${escapeHtml(f.material)}</span></td>
            <td>${f.weightTotal_g}g</td>
            <td>${f.costPerKg != null ? '$' + Number(f.costPerKg).toFixed(2) : '-'}</td>
            <td><strong>$${spoolCost.toFixed(2)}</strong></td>
            <td>${usedG > 0 ? '$' + costPerGUsed.toFixed(3) + '/g' : '-'}</td>
            <td>${f.purchaseDate ? formatDate(f.purchaseDate) : '-'}</td>
          </tr>
        `;
      }).join('');
    }

    // Monthly spending table
    const monthlyTbody = document.getElementById('fil-cost-monthly-tbody');
    const months = Object.keys(monthlyMap).sort().reverse();
    if (months.length === 0) {
      monthlyTbody.innerHTML = '<tr><td colspan="3" class="text-muted" style="text-align:center;">No purchase data yet</td></tr>';
    } else {
      monthlyTbody.innerHTML = months.map(m => {
        const d = monthlyMap[m];
        return `
          <tr>
            <td>${formatMonthLabel(m)}</td>
            <td>${d.count}</td>
            <td><strong>$${d.total.toFixed(2)}</strong></td>
          </tr>
        `;
      }).join('');
    }
  }

  function calcSpoolCost(f) {
    if (f.costPerKg == null || f.weightTotal_g == null) return 0;
    return (f.costPerKg * f.weightTotal_g) / 1000;
  }

  function formatMonthLabel(yyyymm) {
    const [y, m] = yyyymm.split('-');
    const names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${names[parseInt(m, 10) - 1]} ${y}`;
  }

  // ---- Materials Database ----

  function renderMaterials() {
    const container = document.getElementById('fil-materials-container');
    const db = window.materialDB || {};
    const keys = Object.keys(db);

    if (keys.length === 0) {
      container.innerHTML = '<div class="empty-state"><div class="empty-state-title">No materials in database</div></div>';
      return;
    }

    container.innerHTML = keys.map(key => {
      const mat = db[key];
      const diffClass = getDifficultyClass(mat.difficulty);
      const enclosureTag = mat.needsEnclosure
        ? '<span class="tag tag-warning">Enclosure Required</span>'
        : '<span class="tag tag-success">No Enclosure</span>';
      const printerTags = (mat.printerSupport || []).map(pid => {
        const p = window.printerProfiles && window.printerProfiles[pid];
        return p ? `<span class="tag">${escapeHtml(p.shortName)}</span>` : '';
      }).join('');

      return `
        <div class="fil-mat-card">
          <div class="fil-mat-header">
            <div>
              <div class="fil-mat-name">${escapeHtml(mat.name)}</div>
              <div class="fil-mat-fullname">${escapeHtml(mat.fullName || '')}</div>
            </div>
            <span class="fil-mat-difficulty ${diffClass}">${escapeHtml(mat.difficulty)}</span>
          </div>

          <div class="fil-mat-temps">
            <div class="fil-mat-temp">
              <div class="fil-mat-temp-label">Nozzle</div>
              <div class="fil-mat-temp-value">${mat.nozzleMin}-${mat.nozzleMax}&deg;C</div>
            </div>
            <div class="fil-mat-temp">
              <div class="fil-mat-temp-label">Bed</div>
              <div class="fil-mat-temp-value">${mat.bedMin}-${mat.bedMax}&deg;C</div>
            </div>
            <div class="fil-mat-temp">
              <div class="fil-mat-temp-label">Drying</div>
              <div class="fil-mat-temp-value">${mat.dryingTemp}&deg;C / ${mat.dryingTime_hr}h</div>
            </div>
          </div>

          <div class="fil-mat-props">
            <div class="fil-mat-prop">
              <span class="fil-mat-prop-label">Strength</span>
              <span class="fil-mat-prop-value">${escapeHtml(mat.strength)}</span>
            </div>
            <div class="fil-mat-prop">
              <span class="fil-mat-prop-label">Flexibility</span>
              <span class="fil-mat-prop-value">${escapeHtml(mat.flexibility)}</span>
            </div>
            <div class="fil-mat-prop">
              <span class="fil-mat-prop-label">UV Resistance</span>
              <span class="fil-mat-prop-value">${escapeHtml(mat.uvResistance)}</span>
            </div>
            <div class="fil-mat-prop">
              <span class="fil-mat-prop-label">Heat Resistance</span>
              <span class="fil-mat-prop-value">${escapeHtml(mat.heatResistance)}</span>
            </div>
            <div class="fil-mat-prop">
              <span class="fil-mat-prop-label">Moisture Sens.</span>
              <span class="fil-mat-prop-value">${escapeHtml(mat.moistureSensitive)}</span>
            </div>
            <div class="fil-mat-prop">
              <span class="fil-mat-prop-label">Food Safe</span>
              <span class="fil-mat-prop-value">${escapeHtml(mat.foodSafe)}</span>
            </div>
          </div>

          <div class="fil-mat-tags">
            ${enclosureTag}
            ${printerTags}
          </div>

          <div class="fil-mat-notes">${escapeHtml(mat.notes || '')}</div>
        </div>
      `;
    }).join('');
  }

  function getDifficultyClass(difficulty) {
    if (!difficulty) return '';
    const d = difficulty.toLowerCase();
    if (d === 'easy') return 'fil-mat-difficulty-easy';
    if (d.includes('moderate') || d.includes('hard')) return 'fil-mat-difficulty-moderate';
    if (d === 'hard') return 'fil-mat-difficulty-hard';
    if (d === 'expert') return 'fil-mat-difficulty-expert';
    return '';
  }

  // ---- Wishlist ----

  function renderWishlist() {
    const container = document.getElementById('fil-wishlist-container');
    const emptyState = document.getElementById('fil-wishlist-empty');

    if (wishlist.length === 0) {
      container.innerHTML = '';
      emptyState.style.display = 'block';
      return;
    }

    emptyState.style.display = 'none';
    container.innerHTML = wishlist.map((item, idx) => {
      const linkHtml = item.link
        ? `<a href="${escapeHtml(item.link)}" target="_blank" rel="noopener">Link</a>`
        : '';
      const priceHtml = item.price ? `<span>${escapeHtml(item.price)}</span>` : '';

      return `
        <div class="fil-wishlist-item">
          <div class="fil-wish-info">
            <div class="fil-wish-name">${escapeHtml(item.name)}</div>
            <div class="fil-wish-meta">
              ${priceHtml}
              ${linkHtml}
              ${item.notes ? '<span>' + escapeHtml(item.notes) + '</span>' : ''}
            </div>
          </div>
          <div class="fil-wish-actions">
            <button class="btn-icon btn-sm" title="Remove" onclick="window._filRemoveWish(${idx})">&#x2716;</button>
          </div>
        </div>
      `;
    }).join('');
  }

  async function addWishlistItem() {
    const nameEl = document.getElementById('fil-wish-name');
    const priceEl = document.getElementById('fil-wish-price');
    const linkEl = document.getElementById('fil-wish-link');
    const notesEl = document.getElementById('fil-wish-notes');

    const name = nameEl.value.trim();
    if (!name) return;

    wishlist.push({
      name,
      price: priceEl.value.trim(),
      link: linkEl.value.trim(),
      notes: notesEl.value.trim(),
      addedDate: new Date().toISOString().slice(0, 10)
    });

    await saveWishlist();
    renderWishlist();

    // Clear form
    nameEl.value = '';
    priceEl.value = '';
    linkEl.value = '';
    notesEl.value = '';
  }

  async function removeWishlistItem(idx) {
    if (idx < 0 || idx >= wishlist.length) return;
    wishlist.splice(idx, 1);
    await saveWishlist();
    renderWishlist();
  }

  async function saveWishlist() {
    await window.storage.saveSetting('filamentWishlist', wishlist);
  }

  // ---- Spool Modal (Add / Edit) ----

  function openSpoolModal(spoolId) {
    editingSpoolId = spoolId || null;
    const form = document.getElementById('fil-spool-form');
    form.reset();

    // Reset color picker to default
    document.getElementById('fil-form-colorhex').value = '#4facfe';
    document.getElementById('fil-form-colorhex-text').value = '#4facfe';
    document.getElementById('fil-form-swatch').style.background = '#4facfe';

    const deleteBtn = document.getElementById('fil-modal-delete');

    if (editingSpoolId) {
      // Editing existing spool
      const spool = filaments.find(f => f.id === editingSpoolId);
      if (!spool) return;

      document.getElementById('fil-modal-title').textContent = 'Edit Filament Spool';
      deleteBtn.style.display = 'inline-flex';

      document.getElementById('fil-form-id').value = spool.id;
      document.getElementById('fil-form-brand').value = spool.brand || '';
      document.getElementById('fil-form-material').value = spool.material || '';
      document.getElementById('fil-form-color').value = spool.color || '';

      const hex = spool.colorHex || '#4facfe';
      document.getElementById('fil-form-colorhex').value = hex;
      document.getElementById('fil-form-colorhex-text').value = hex;
      document.getElementById('fil-form-swatch').style.background = hex;

      document.getElementById('fil-form-weight-total').value = spool.weightTotal_g || '';
      document.getElementById('fil-form-weight-remaining').value = spool.weightRemaining_g || '';
      document.getElementById('fil-form-cost').value = spool.costPerKg != null ? spool.costPerKg : '';
      document.getElementById('fil-form-purchase-date').value = spool.purchaseDate || '';
      document.getElementById('fil-form-dried-date').value = spool.driedDate || '';

      // Location
      document.getElementById('fil-form-printer').value = (spool.location && spool.location.printer) || '';
      updateUnitOptions();
      document.getElementById('fil-form-unit').value = (spool.location && spool.location.unit) || '';
      updateSlotOptions();
      document.getElementById('fil-form-slot').value = (spool.location && spool.location.slot) || '';

      // Temps
      if (spool.tempRange) {
        document.getElementById('fil-form-nozzle-min').value = spool.tempRange.nozzleMin || '';
        document.getElementById('fil-form-nozzle-max').value = spool.tempRange.nozzleMax || '';
        document.getElementById('fil-form-bed-min').value = spool.tempRange.bedMin || '';
        document.getElementById('fil-form-bed-max').value = spool.tempRange.bedMax || '';
      }

      document.getElementById('fil-form-notes').value = spool.notes || '';
    } else {
      // Adding new spool
      document.getElementById('fil-modal-title').textContent = 'Add Filament Spool';
      deleteBtn.style.display = 'none';
      document.getElementById('fil-form-id').value = '';

      // Reset location dropdowns
      document.getElementById('fil-form-printer').value = '';
      updateUnitOptions();
      updateSlotOptions();
    }

    openModal('fil-spool-modal');
  }

  function openSpoolModalForSlot(printer, unit, slot) {
    openSpoolModal(null);
    // Pre-fill location
    document.getElementById('fil-form-printer').value = printer;
    updateUnitOptions();
    document.getElementById('fil-form-unit').value = unit;
    updateSlotOptions();
    document.getElementById('fil-form-slot').value = slot;
  }

  async function saveSpool() {
    const brand = document.getElementById('fil-form-brand').value.trim();
    const material = document.getElementById('fil-form-material').value;
    const color = document.getElementById('fil-form-color').value.trim();
    const colorHex = document.getElementById('fil-form-colorhex').value;
    const weightTotal = parseInt(document.getElementById('fil-form-weight-total').value, 10);
    const weightRemaining = parseInt(document.getElementById('fil-form-weight-remaining').value, 10);
    const costPerKg = parseFloat(document.getElementById('fil-form-cost').value) || null;
    const purchaseDate = document.getElementById('fil-form-purchase-date').value || null;
    const driedDate = document.getElementById('fil-form-dried-date').value || null;

    const printer = document.getElementById('fil-form-printer').value || null;
    const unit = document.getElementById('fil-form-unit').value || null;
    const slotNum = parseInt(document.getElementById('fil-form-slot').value, 10) || null;

    const nozzleMin = parseInt(document.getElementById('fil-form-nozzle-min').value, 10) || null;
    const nozzleMax = parseInt(document.getElementById('fil-form-nozzle-max').value, 10) || null;
    const bedMin = parseInt(document.getElementById('fil-form-bed-min').value, 10) || null;
    const bedMax = parseInt(document.getElementById('fil-form-bed-max').value, 10) || null;

    const notes = document.getElementById('fil-form-notes').value.trim();

    // Validation
    if (!brand || !material || isNaN(weightTotal) || isNaN(weightRemaining)) {
      return; // Required fields not filled
    }

    const spoolData = {
      brand,
      material,
      color,
      colorHex,
      weightTotal_g: weightTotal,
      weightRemaining_g: weightRemaining,
      costPerKg,
      purchaseDate,
      driedDate,
      location: (printer && unit && slotNum)
        ? { printer, unit, slot: slotNum }
        : null,
      tempRange: {
        nozzleMin,
        nozzleMax,
        bedMin,
        bedMax
      },
      notes
    };

    if (editingSpoolId) {
      // Update existing
      await window.storage.updateFilament(editingSpoolId, spoolData);
      const idx = filaments.findIndex(f => f.id === editingSpoolId);
      if (idx !== -1) Object.assign(filaments[idx], spoolData);
    } else {
      // Create new
      spoolData.id = generateId();
      await window.storage.addFilament(spoolData);
      filaments.push(spoolData);
    }

    closeModal('fil-spool-modal');
    editingSpoolId = null;

    // Re-render everything
    populateMaterialFilter();
    renderSlotMap();
    renderInventory();
    renderCosts();
  }

  async function deleteSpool() {
    if (!editingSpoolId) return;

    await window.storage.deleteFilament(editingSpoolId);
    filaments = filaments.filter(f => f.id !== editingSpoolId);

    closeModal('fil-spool-modal');
    editingSpoolId = null;

    populateMaterialFilter();
    renderSlotMap();
    renderInventory();
    renderCosts();
  }

  // ---- Location Cascade Dropdowns ----

  function updateUnitOptions() {
    const printerVal = document.getElementById('fil-form-printer').value;
    const unitSelect = document.getElementById('fil-form-unit');

    unitSelect.innerHTML = '<option value="">N/A</option>';

    if (!printerVal) {
      updateSlotOptions();
      return;
    }

    const units = AMS_UNITS.filter(u => u.printer === printerVal);
    units.forEach(u => {
      const opt = document.createElement('option');
      opt.value = u.id;
      opt.textContent = u.name;
      unitSelect.appendChild(opt);
    });

    // Auto-select if only one unit
    if (units.length === 1) {
      unitSelect.value = units[0].id;
    }

    updateSlotOptions();
  }

  function updateSlotOptions() {
    const unitVal = document.getElementById('fil-form-unit').value;
    const slotSelect = document.getElementById('fil-form-slot');

    slotSelect.innerHTML = '<option value="">N/A</option>';

    if (!unitVal) return;

    const unit = AMS_UNITS.find(u => u.id === unitVal);
    if (!unit) return;

    for (let s = 1; s <= unit.slots; s++) {
      const opt = document.createElement('option');
      opt.value = s;
      const occupant = findSpoolInSlot(unit.printer, unit.id, s);
      if (occupant && occupant.id !== editingSpoolId) {
        opt.textContent = `Slot ${s} (${occupant.brand} ${occupant.material})`;
        opt.disabled = true;
      } else {
        opt.textContent = `Slot ${s}`;
      }
      slotSelect.appendChild(opt);
    }
  }

  // ---- Auto-fill temps from materialDB ----

  function autoFillTemps() {
    const material = document.getElementById('fil-form-material').value;
    if (!material || !window.materialDB || !window.materialDB[material]) return;

    const mat = window.materialDB[material];

    const nozzleMinEl = document.getElementById('fil-form-nozzle-min');
    const nozzleMaxEl = document.getElementById('fil-form-nozzle-max');
    const bedMinEl = document.getElementById('fil-form-bed-min');
    const bedMaxEl = document.getElementById('fil-form-bed-max');

    // Only auto-fill if fields are empty
    if (!nozzleMinEl.value) nozzleMinEl.value = mat.nozzleMin;
    if (!nozzleMaxEl.value) nozzleMaxEl.value = mat.nozzleMax;
    if (!bedMinEl.value) bedMinEl.value = mat.bedMin;
    if (!bedMaxEl.value) bedMaxEl.value = mat.bedMax;
  }

  // ---- Helpers ----

  function getPercentRemaining(spool) {
    if (!spool.weightTotal_g || spool.weightTotal_g === 0) return 0;
    return Math.round((spool.weightRemaining_g / spool.weightTotal_g) * 100);
  }

  function getProgressClass(pct) {
    if (pct > 50) return 'fil-progress-good';
    if (pct > 25) return 'fil-progress-mid';
    if (pct > 10) return 'fil-progress-low';
    return 'fil-progress-critical';
  }

  function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // ---- Global hooks for inline onclick handlers ----

  window._filEditSpool = function (id) {
    openSpoolModal(id);
  };

  window._filDeleteSpool = async function (id) {
    if (!id) return;
    await window.storage.deleteFilament(id);
    filaments = filaments.filter(f => f.id !== id);
    populateMaterialFilter();
    renderSlotMap();
    renderInventory();
    renderCosts();
  };

  window._filRemoveWish = function (idx) {
    removeWishlistItem(idx);
  };

  // ---- Boot ----
  init();
})();
