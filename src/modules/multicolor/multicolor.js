// Multi-Color Print Planner — Module JS
// Color matching, purge estimation, slot planning, and cost calculation

(function () {
  'use strict';

  // ---- State ----

  const state = {
    neededColors: [],      // [{ id, name, hex, grams }]
    filaments: [],         // full inventory from storage
    loadedFilaments: [],   // only filaments assigned to a printer slot
    matchResults: [],      // [{ needed, match, distance, score }]
    slotAssignments: {},   // { 'bambu_a1-0-1': colorId, ... }
    savedPlans: [],        // [{ id, name, notes, assignments, colors, createdAt }]
    batchModels: [],       // [{ id, name, printer, colorCount, filamentGrams }]
    draggedColorId: null
  };

  // ---- Init ----

  async function init() {
    initTabs('#multicolor-module');
    await loadInventory();
    bindEvents();
    renderLoadedFilaments();
    renderSlotPlanner();
    loadSavedPlans();
  }

  async function loadInventory() {
    try {
      state.filaments = (await window.storage.getFilaments()) || [];
    } catch (e) {
      state.filaments = [];
    }
    state.loadedFilaments = state.filaments.filter(
      f => f.printer && f.unit !== undefined && f.unit !== '' && f.slot !== undefined && f.slot !== ''
    );
  }

  // ---- Event Bindings ----

  function bindEvents() {
    // Color palette
    document.getElementById('mc-btn-add-color').addEventListener('click', addNeededColor);
    document.getElementById('mc-btn-clear-colors').addEventListener('click', clearNeededColors);
    document.getElementById('mc-btn-refresh').addEventListener('click', async () => {
      await loadInventory();
      renderLoadedFilaments();
      runColorMatching();
      renderSlotPlanner();
    });
    document.getElementById('mc-btn-new-plan').addEventListener('click', () => {
      clearNeededColors();
      clearSlotAssignments();
    });
    document.getElementById('mc-btn-apply-matches').addEventListener('click', applyMatchesToSlotPlanner);

    // Purge estimator
    document.getElementById('mc-btn-calc-purge').addEventListener('click', calculatePurge);
    document.getElementById('mc-btn-purge-reset').addEventListener('click', resetPurgeDefaults);
    document.getElementById('mc-purge-adv-toggle').addEventListener('click', () => {
      const section = document.getElementById('mc-purge-adv-section');
      const arrow = document.getElementById('mc-purge-adv-arrow');
      const visible = section.style.display !== 'none';
      section.style.display = visible ? 'none' : 'block';
      arrow.classList.toggle('open', !visible);
    });

    // Slot planner
    document.getElementById('mc-btn-save-plan').addEventListener('click', () => openModal('mc-modal-save-plan'));
    document.getElementById('mc-btn-delete-plan').addEventListener('click', deleteSelectedPlan);
    document.getElementById('mc-btn-clear-plan').addEventListener('click', clearSlotAssignments);
    document.getElementById('mc-btn-auto-assign').addEventListener('click', autoAssignColors);
    document.getElementById('mc-slot-plan-select').addEventListener('change', loadSelectedPlan);
    document.getElementById('mc-form-save-plan').addEventListener('submit', savePlan);

    // Batch planning
    document.getElementById('mc-btn-add-batch').addEventListener('click', () => openModal('mc-modal-add-batch'));
    document.getElementById('mc-form-add-batch').addEventListener('submit', addBatchModel);

    // Cost calculator
    document.getElementById('mc-btn-calc-cost').addEventListener('click', calculateCost);
    document.getElementById('mc-btn-cost-reset').addEventListener('click', resetCostDefaults);

    // Modal close buttons
    document.querySelectorAll('#multicolor-module [data-close]').forEach(btn => {
      btn.addEventListener('click', () => closeModal(btn.dataset.close));
    });

    // Allow enter key on color name to add
    document.getElementById('mc-pick-name').addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); addNeededColor(); }
    });
  }

  // ================================================================
  //  COLOR PALETTE TAB
  // ================================================================

  function addNeededColor() {
    const hex = document.getElementById('mc-pick-color').value;
    const name = document.getElementById('mc-pick-name').value.trim();
    const grams = parseFloat(document.getElementById('mc-pick-grams').value) || 25;

    if (!name) {
      document.getElementById('mc-pick-name').focus();
      return;
    }

    state.neededColors.push({
      id: generateId(),
      name: name,
      hex: hex.toUpperCase(),
      grams: grams
    });

    document.getElementById('mc-pick-name').value = '';
    renderNeededColors();
    runColorMatching();
    renderUnassignedPool();
  }

  function clearNeededColors() {
    state.neededColors = [];
    renderNeededColors();
    document.getElementById('mc-matching-card').style.display = 'none';
    renderUnassignedPool();
  }

  function removeNeededColor(id) {
    state.neededColors = state.neededColors.filter(c => c.id !== id);
    // Also clear from slot assignments
    Object.keys(state.slotAssignments).forEach(key => {
      if (state.slotAssignments[key] === id) delete state.slotAssignments[key];
    });
    renderNeededColors();
    runColorMatching();
    renderSlotPlanner();
    renderUnassignedPool();
  }

  function renderNeededColors() {
    const container = document.getElementById('mc-needed-colors');
    const empty = document.getElementById('mc-needed-empty');

    if (state.neededColors.length === 0) {
      container.innerHTML = '';
      container.appendChild(createEmptyState('mc-needed-empty', '&#x1F3A8;', 'No colors added yet', 'Add the colors your multi-color print requires above.'));
      return;
    }

    container.innerHTML = state.neededColors.map(c => `
      <div class="mc-needed-chip">
        <span class="color-swatch" style="background:${c.hex};"></span>
        <div class="mc-needed-chip-info">
          <span class="mc-needed-chip-name">${esc(c.name)}</span>
          <span class="mc-needed-chip-meta">${c.hex} &middot; ${c.grams}g</span>
        </div>
        <button class="mc-needed-chip-remove" data-id="${c.id}" title="Remove">&times;</button>
      </div>
    `).join('');

    container.querySelectorAll('.mc-needed-chip-remove').forEach(btn => {
      btn.addEventListener('click', () => removeNeededColor(btn.dataset.id));
    });
  }

  // ---- Loaded Filament Display ----

  function renderLoadedFilaments() {
    const container = document.getElementById('mc-loaded-filaments');
    const emptyEl = document.getElementById('mc-loaded-empty');
    const countEl = document.getElementById('mc-loaded-count');
    const profiles = window.printerProfiles;

    countEl.textContent = `${state.loadedFilaments.length} loaded`;

    if (state.loadedFilaments.length === 0) {
      container.innerHTML = '';
      emptyEl.classList.remove('hidden');
      return;
    }

    emptyEl.classList.add('hidden');

    const html = Object.keys(profiles).map(pId => {
      const p = profiles[pId];
      const printerFilaments = state.loadedFilaments.filter(f => f.printer === pId);
      const totalSlots = p.ams.totalSlots;

      let slotsHtml = '';
      for (let u = 0; u < p.ams.units; u++) {
        for (let s = 0; s < p.ams.slotsPerUnit; s++) {
          const fil = printerFilaments.find(f => String(f.unit) === String(u) && String(f.slot) === String(s));
          if (fil) {
            const pct = fil.weightTotal_g > 0 ? Math.round((fil.weightRemaining_g / fil.weightTotal_g) * 100) : 0;
            slotsHtml += `
              <div class="mc-loaded-item">
                <span class="color-swatch" style="background:${fil.colorHex || '#888'};"></span>
                <span class="mc-loaded-item-name">${esc(fil.color || fil.brand || 'Unknown')}</span>
                <span class="mc-loaded-item-detail">${fil.material || ''} &middot; ${pct}%</span>
              </div>`;
          } else {
            slotsHtml += `<div class="mc-loaded-empty-slot">Slot ${u * p.ams.slotsPerUnit + s + 1} &mdash; Empty</div>`;
          }
        }
      }

      return `
        <div class="mc-loaded-printer">
          <div class="mc-loaded-printer-header">
            <span class="mc-loaded-printer-name">${p.shortName}</span>
            <span class="mc-loaded-printer-slots">${printerFilaments.length}/${totalSlots} slots</span>
          </div>
          <div class="mc-loaded-list">${slotsHtml}</div>
        </div>`;
    }).join('');

    container.innerHTML = html;
  }

  // ---- Color Matching Engine ----

  /**
   * Euclidean distance in RGB space between two hex colors.
   * Returns a value from 0 (exact match) to ~441.67 (black vs white).
   */
  function colorDistance(hex1, hex2) {
    const r1 = parseInt(hex1.slice(1, 3), 16);
    const g1 = parseInt(hex1.slice(3, 5), 16);
    const b1 = parseInt(hex1.slice(5, 7), 16);
    const r2 = parseInt(hex2.slice(1, 3), 16);
    const g2 = parseInt(hex2.slice(3, 5), 16);
    const b2 = parseInt(hex2.slice(5, 7), 16);
    return Math.sqrt((r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2);
  }

  /**
   * Returns perceived luminance (0-255) for sorting light/dark.
   */
  function luminance(hex) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return 0.299 * r + 0.587 * g + 0.114 * b;
  }

  /**
   * Classify match quality based on RGB distance.
   * Thresholds chosen by visual perception research:
   *   0-15: nearly indistinguishable
   *  15-40: noticeable but acceptable
   *  40-80: clearly different but same family
   *   80+:  different color
   */
  function matchQuality(distance) {
    if (distance <= 15) return { label: 'Excellent', cls: 'mc-match-excellent', pct: 100 };
    if (distance <= 40) return { label: 'Good', cls: 'mc-match-good', pct: 85 };
    if (distance <= 80) return { label: 'Fair', cls: 'mc-match-fair', pct: 60 };
    if (distance <= 150) return { label: 'Poor', cls: 'mc-match-poor', pct: 30 };
    return { label: 'No match', cls: 'mc-match-none', pct: 0 };
  }

  function runColorMatching() {
    if (state.neededColors.length === 0 || state.loadedFilaments.length === 0) {
      document.getElementById('mc-matching-card').style.display = 'none';
      return;
    }

    document.getElementById('mc-matching-card').style.display = '';

    // For each needed color, find best match across all loaded filaments
    state.matchResults = state.neededColors.map(needed => {
      let bestMatch = null;
      let bestDist = Infinity;

      state.loadedFilaments.forEach(fil => {
        if (!fil.colorHex) return;
        const dist = colorDistance(needed.hex, fil.colorHex.toUpperCase());
        if (dist < bestDist) {
          bestDist = dist;
          bestMatch = fil;
        }
      });

      const quality = matchQuality(bestDist);
      return {
        needed,
        match: bestMatch,
        distance: bestDist,
        quality
      };
    });

    renderMatchResults();
    renderPrinterComparison();
    renderSubstitutions();
  }

  function renderMatchResults() {
    const container = document.getElementById('mc-match-results');
    const scoreTag = document.getElementById('mc-match-score-tag');

    if (state.matchResults.length === 0) {
      container.innerHTML = '<div class="text-sm text-muted" style="padding:12px;">No matches to display.</div>';
      return;
    }

    // Overall score: average of match percentages
    const avgScore = Math.round(state.matchResults.reduce((s, r) => s + r.quality.pct, 0) / state.matchResults.length);
    const overallQuality = avgScore >= 85 ? 'tag-success' : avgScore >= 60 ? 'tag-warning' : 'tag-danger';
    scoreTag.className = `tag ${overallQuality}`;
    scoreTag.textContent = `${avgScore}% match`;

    container.innerHTML = state.matchResults.map(r => {
      const matchInfo = r.match
        ? `<div class="mc-match-found">
             <span class="color-swatch" style="background:${r.match.colorHex};"></span>
             <div>
               <div class="mc-match-found-name">${esc(r.match.color || r.match.brand || 'Unknown')}</div>
               <div class="mc-match-found-detail">${r.match.material || ''} &middot; ${r.match.colorHex} &middot; ${getPrinterShortName(r.match.printer)}</div>
             </div>
           </div>`
        : `<div class="mc-match-found"><span class="text-muted">No loaded filament found</span></div>`;

      return `
        <div class="mc-match-row">
          <div class="mc-match-requested">
            <span class="color-swatch" style="background:${r.needed.hex};"></span>
            <span>${esc(r.needed.name)}</span>
          </div>
          <span class="mc-match-arrow">&rarr;</span>
          ${matchInfo}
          <span class="mc-match-score ${r.quality.cls}">${r.quality.label} (${Math.round(r.distance)})</span>
        </div>`;
    }).join('');
  }

  function renderPrinterComparison() {
    const container = document.getElementById('mc-printer-compare-grid');
    const profiles = window.printerProfiles;

    const printerScores = Object.keys(profiles).map(pId => {
      const printerFils = state.loadedFilaments.filter(f => f.printer === pId);
      let totalDist = 0;
      let matchCount = 0;
      let canFit = state.neededColors.length <= profiles[pId].ams.totalSlots;

      state.neededColors.forEach(needed => {
        let bestDist = Infinity;
        printerFils.forEach(fil => {
          if (!fil.colorHex) return;
          const d = colorDistance(needed.hex, fil.colorHex.toUpperCase());
          if (d < bestDist) bestDist = d;
        });
        if (bestDist < Infinity) {
          totalDist += bestDist;
          matchCount++;
        } else {
          totalDist += 441.67; // max distance as penalty
          matchCount++;
        }
      });

      const avgDist = matchCount > 0 ? totalDist / matchCount : 999;
      const avgScore = Math.max(0, Math.round(100 - (avgDist / 441.67) * 100));

      return {
        id: pId,
        profile: profiles[pId],
        avgDistance: avgDist,
        avgScore,
        matchedColors: printerFils.length,
        canFit,
        slotsAvailable: profiles[pId].ams.totalSlots
      };
    });

    // Determine best
    const bestId = printerScores.reduce((best, curr) =>
      curr.avgScore > best.avgScore ? curr : best
    , printerScores[0]).id;

    container.innerHTML = printerScores.map(ps => `
      <div class="mc-compare-card ${ps.id === bestId ? 'mc-compare-best' : ''}">
        <div class="mc-compare-card-header">
          <span class="mc-compare-card-name">${ps.profile.shortName}</span>
          ${ps.id === bestId ? '<span class="tag tag-success">Best Match</span>' : ''}
        </div>
        <div class="mc-compare-detail-row">
          <span>Match Score</span>
          <span>${ps.avgScore}%</span>
        </div>
        <div class="mc-compare-detail-row">
          <span>Available Slots</span>
          <span>${ps.slotsAvailable}</span>
        </div>
        <div class="mc-compare-detail-row">
          <span>Colors Fit?</span>
          <span class="${ps.canFit ? 'text-success' : 'text-danger'}">${ps.canFit ? 'Yes' : 'No (' + state.neededColors.length + ' needed)'}</span>
        </div>
        <div class="mc-compare-detail-row">
          <span>Loaded Filaments</span>
          <span>${ps.matchedColors}</span>
        </div>
        <div class="mc-compare-detail-row">
          <span>AMS Type</span>
          <span>${ps.profile.ams.type}</span>
        </div>
      </div>
    `).join('');
  }

  function renderSubstitutions() {
    const container = document.getElementById('mc-substitution-list');
    const wrapper = document.getElementById('mc-substitutions');

    // Only show substitution suggestions for poor/no-match results
    const poorMatches = state.matchResults.filter(r => r.quality.pct <= 60);
    if (poorMatches.length === 0) {
      wrapper.style.display = 'none';
      return;
    }

    wrapper.style.display = '';

    // Also check unloaded filaments in storage for better matches
    const unloadedFils = state.filaments.filter(f => !f.printer || f.printer === '');

    const suggestions = poorMatches.map(r => {
      // Check storage for a better match
      let betterMatch = null;
      let betterDist = r.distance;

      unloadedFils.forEach(fil => {
        if (!fil.colorHex) return;
        const d = colorDistance(r.needed.hex, fil.colorHex.toUpperCase());
        if (d < betterDist) {
          betterDist = d;
          betterMatch = fil;
        }
      });

      // Suggest a similar common color name
      const lum = luminance(r.needed.hex);
      const lumSuggestion = lum > 180
        ? 'Consider a lighter or pastel filament.'
        : lum < 60
        ? 'Consider a dark or matte filament for close results.'
        : 'A mid-tone filament may be a reasonable substitute.';

      if (betterMatch) {
        const q = matchQuality(betterDist);
        return `<div class="mc-sub-item">
          <span class="mc-sub-icon">&#x1F4E6;</span>
          <div class="mc-sub-text">
            For <strong>${esc(r.needed.name)}</strong>: load <strong>${esc(betterMatch.color || betterMatch.brand)} (${betterMatch.colorHex})</strong> from storage.
            Match quality: ${q.label} (distance ${Math.round(betterDist)}).
          </div>
        </div>`;
      }

      return `<div class="mc-sub-item">
        <span class="mc-sub-icon">&#x1F50D;</span>
        <div class="mc-sub-text">
          No good match for <strong>${esc(r.needed.name)} (${r.needed.hex})</strong> in inventory.
          ${lumSuggestion} You may need to purchase this color.
        </div>
      </div>`;
    });

    container.innerHTML = suggestions.join('');
  }

  // ================================================================
  //  PURGE ESTIMATOR TAB
  // ================================================================

  function calculatePurge() {
    const colors = intVal('mc-purge-colors', 4);
    const changesPerLayer = intVal('mc-purge-changes', 3);
    const totalLayers = intVal('mc-purge-layers', 200);
    const purgeVolMm3 = floatVal('mc-purge-volume', 180);
    const density = floatVal('mc-purge-density', 1.24); // g/cm3
    const costPerKg = floatVal('mc-purge-cost', 20);
    const ltdReduction = floatVal('mc-purge-ltd-reduction', 30) / 100;
    const dtlIncrease = floatVal('mc-purge-dtl-increase', 20) / 100;
    const towerInfill = floatVal('mc-purge-tower-infill', 100) / 100;

    const totalSwaps = changesPerLayer * totalLayers;

    // Purge volume to grams: mm3 -> cm3 (divide by 1000) -> grams (multiply by density)
    const purgePerSwapG = (purgeVolMm3 / 1000) * density;

    // Assume roughly equal light-to-dark and dark-to-light transitions
    // Apply directional adjustments: half get reduction, half get increase
    const avgAdjustment = 1 + (dtlIncrease - ltdReduction) / 2;
    const adjustedPurgePerSwap = purgePerSwapG * avgAdjustment;

    // Tower infill factor
    const effectivePurge = adjustedPurgePerSwap * towerInfill;

    const totalWasteG = totalSwaps * effectivePurge;
    const wasteCost = (totalWasteG / 1000) * costPerKg;

    // Model filament estimate (rough: needed colors grams if available, else default)
    const modelG = state.neededColors.length > 0
      ? state.neededColors.reduce((s, c) => s + c.grams, 0)
      : 100;
    const wasteRatio = modelG > 0 ? (totalWasteG / modelG * 100).toFixed(0) + '%' : '--';

    // Display summary
    document.getElementById('mc-purge-results-card').style.display = '';
    document.getElementById('mc-purge-total-swaps').textContent = totalSwaps.toLocaleString();
    document.getElementById('mc-purge-total-waste').textContent = totalWasteG.toFixed(1) + 'g';
    document.getElementById('mc-purge-waste-cost').textContent = '$' + wasteCost.toFixed(2);
    document.getElementById('mc-purge-ratio').textContent = wasteRatio;

    // ---- Printer comparison ----

    // Bambu A1 Combo: uses standard purge tower, efficient with Bambu Studio optimizations
    // Bambu typically has a purge multiplier of ~0.85x due to flushing optimization
    const bambuMultiplier = 0.85;
    const bambuWasteG = totalWasteG * bambuMultiplier;
    const bambuSwapTimeSec = 12; // ~12s per AMS Lite swap
    const bambuTimeImpactMin = (totalSwaps * bambuSwapTimeSec) / 60;
    // Tower footprint: approximate as 16x16mm for Bambu
    const bambuTowerMm = '16 x 16 mm';

    document.getElementById('mc-purge-bambu-method').textContent = 'Purge tower (Bambu Studio optimized)';
    document.getElementById('mc-purge-bambu-waste').textContent = bambuWasteG.toFixed(1) + 'g ($' + ((bambuWasteG / 1000) * costPerKg).toFixed(2) + ')';
    document.getElementById('mc-purge-bambu-time').textContent = '+' + bambuTimeImpactMin.toFixed(0) + ' min';
    document.getElementById('mc-purge-bambu-footprint').textContent = bambuTowerMm;

    // Anycubic Kobra S1 Combo: Ace Pro dual units, standard purge tower
    // Ace Pro is slightly less optimized, multiplier ~1.0x
    const kobraMultiplier = 1.0;
    const kobraWasteG = totalWasteG * kobraMultiplier;
    const kobraSwapTimeSec = 15; // ~15s per Ace Pro swap
    const kobraTimeImpactMin = (totalSwaps * kobraSwapTimeSec) / 60;
    const kobraTowerMm = '18 x 18 mm';

    document.getElementById('mc-purge-kobra-method').textContent = 'Purge tower (standard)';
    document.getElementById('mc-purge-kobra-waste').textContent = kobraWasteG.toFixed(1) + 'g ($' + ((kobraWasteG / 1000) * costPerKg).toFixed(2) + ')';
    document.getElementById('mc-purge-kobra-time').textContent = '+' + kobraTimeImpactMin.toFixed(0) + ' min';
    document.getElementById('mc-purge-kobra-footprint').textContent = kobraTowerMm;

    // ---- Waste Reduction Tips ----
    renderPurgeTips(totalWasteG, totalSwaps, changesPerLayer, colors, purgeVolMm3, bambuWasteG, kobraWasteG);
  }

  function renderPurgeTips(totalWasteG, totalSwaps, changesPerLayer, colors, purgeVol, bambuWaste, kobraWaste) {
    const tips = [];

    // Tip: Reduce purge volume
    if (purgeVol > 150) {
      const reducedWaste = totalSwaps * ((120 / 1000) * 1.24);
      const saving = totalWasteG - reducedWaste;
      tips.push({
        icon: '&#x1F4A7;',
        text: '<strong>Reduce purge volume</strong> to 120 mm&sup3; in slicer settings. Most PLA prints work well at this level, especially same-family color transitions.',
        saving: '-' + saving.toFixed(0) + 'g'
      });
    }

    // Tip: Optimize color order
    if (colors > 2) {
      tips.push({
        icon: '&#x1F308;',
        text: '<strong>Optimize color ordering</strong> from light to dark within each layer. This reduces purge volume because dark-over-light transitions need less flushing than light-over-dark.',
        saving: '~15-30%'
      });
    }

    // Tip: Reduce color changes
    if (changesPerLayer > 3) {
      tips.push({
        icon: '&#x2702;',
        text: '<strong>Reduce color changes per layer.</strong> Consider splitting the model into separately printed parts that can be assembled, or simplify the color design to fewer regions per layer.',
        saving: 'Proportional'
      });
    }

    // Tip: Use purge-into-infill
    tips.push({
      icon: '&#x267B;',
      text: '<strong>Enable "Flush into infill/objects"</strong> in your slicer. This purges transition material into the model\'s infill instead of a separate tower, reducing waste by 30-60%.',
      saving: '~30-60%'
    });

    // Tip: Bambu advantage
    if (bambuWaste < kobraWaste) {
      tips.push({
        icon: '&#x1F3C6;',
        text: '<strong>Bambu Studio flushing optimization</strong> can save ~15% purge waste compared to standard purge towers, thanks to configurable per-color purge matrices.',
        saving: '-' + (kobraWaste - bambuWaste).toFixed(0) + 'g'
      });
    }

    // Tip: Use transition tower for smaller prints
    if (totalWasteG > 100) {
      tips.push({
        icon: '&#x1F3D7;',
        text: '<strong>Consider a smaller purge tower.</strong> If your model footprint is small, the purge tower can be a significant percentage of total material. Batch multiple small models together to share the tower cost.',
        saving: 'Varies'
      });
    }

    // Tip: Material choice
    tips.push({
      icon: '&#x1F9EA;',
      text: '<strong>Some materials purge cleaner.</strong> PLA and PLA+ flush faster than PETG or TPU. Matte filaments tend to need less purging than silk or glossy variants.',
      saving: '~10-20%'
    });

    const container = document.getElementById('mc-purge-tips');
    container.innerHTML = tips.map(t => `
      <div class="mc-tip-item">
        <span class="mc-tip-icon">${t.icon}</span>
        <span class="mc-tip-text">${t.text}</span>
        <span class="mc-tip-saving">${t.saving}</span>
      </div>
    `).join('');
  }

  function resetPurgeDefaults() {
    document.getElementById('mc-purge-colors').value = 4;
    document.getElementById('mc-purge-changes').value = 3;
    document.getElementById('mc-purge-layers').value = 200;
    document.getElementById('mc-purge-volume').value = 180;
    document.getElementById('mc-purge-density').value = 1.24;
    document.getElementById('mc-purge-cost').value = 20;
    document.getElementById('mc-purge-ltd-reduction').value = 30;
    document.getElementById('mc-purge-dtl-increase').value = 20;
    document.getElementById('mc-purge-tower-infill').value = 100;
    document.getElementById('mc-purge-results-card').style.display = 'none';
  }

  // ================================================================
  //  SLOT PLANNER TAB
  // ================================================================

  function renderSlotPlanner() {
    const container = document.getElementById('mc-slot-planner-grid');
    const profiles = window.printerProfiles;

    let html = '';
    Object.keys(profiles).forEach(pId => {
      const p = profiles[pId];
      for (let u = 0; u < p.ams.units; u++) {
        const unitLabel = p.ams.units > 1
          ? `${p.ams.type} Unit ${u + 1}`
          : p.ams.type;

        let slotsHtml = '';
        for (let s = 0; s < p.ams.slotsPerUnit; s++) {
          const slotKey = `${pId}-${u}-${s}`;
          const globalSlotNum = u * p.ams.slotsPerUnit + s + 1;
          const assignedColorId = state.slotAssignments[slotKey];
          const color = assignedColorId ? state.neededColors.find(c => c.id === assignedColorId) : null;

          if (color) {
            slotsHtml += `
              <div class="mc-plan-slot mc-slot-filled" data-slot-key="${slotKey}"
                   ondragover="event.preventDefault()" ondragleave="this.classList.remove('mc-slot-drag-over')"
                   ondragenter="this.classList.add('mc-slot-drag-over')">
                <span class="mc-plan-slot-number">${globalSlotNum}</span>
                <button class="mc-plan-slot-clear" data-slot-key="${slotKey}" title="Clear slot">&times;</button>
                <div class="mc-plan-slot-content">
                  <div class="mc-plan-slot-swatch" style="background:${color.hex};"></div>
                  <div class="mc-plan-slot-name">${esc(color.name)}</div>
                  <div class="mc-plan-slot-hex">${color.hex}</div>
                </div>
              </div>`;
          } else {
            slotsHtml += `
              <div class="mc-plan-slot" data-slot-key="${slotKey}"
                   ondragover="event.preventDefault()" ondragleave="this.classList.remove('mc-slot-drag-over')"
                   ondragenter="this.classList.add('mc-slot-drag-over')">
                <span class="mc-plan-slot-number">${globalSlotNum}</span>
                <span class="mc-plan-slot-empty-icon">+</span>
                <span class="mc-plan-slot-empty-text">Empty</span>
              </div>`;
          }
        }

        html += `
          <div class="mc-unit-card" data-printer="${pId}" data-unit="${u}">
            <div class="mc-unit-header">
              <span class="mc-unit-name">${unitLabel}</span>
              <span class="mc-unit-printer-tag">${p.shortName}</span>
            </div>
            <div class="mc-unit-slots">${slotsHtml}</div>
          </div>`;
      }
    });

    container.innerHTML = html;

    // Bind slot click and drag events
    container.querySelectorAll('.mc-plan-slot').forEach(slot => {
      slot.addEventListener('drop', handleSlotDrop);
      slot.addEventListener('click', (e) => {
        if (e.target.classList.contains('mc-plan-slot-clear')) return;
        handleSlotClick(slot.dataset.slotKey);
      });
    });

    container.querySelectorAll('.mc-plan-slot-clear').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        delete state.slotAssignments[btn.dataset.slotKey];
        renderSlotPlanner();
        renderUnassignedPool();
      });
    });

    renderUnassignedPool();
  }

  function renderUnassignedPool() {
    const container = document.getElementById('mc-unassigned-pool');
    const emptyEl = document.getElementById('mc-unassigned-empty');

    const assignedIds = new Set(Object.values(state.slotAssignments));
    const unassigned = state.neededColors.filter(c => !assignedIds.has(c.id));

    if (state.neededColors.length === 0) {
      container.innerHTML = '';
      container.appendChild(createEmptyState('mc-unassigned-empty', null, null, 'Add colors in the Color Palette tab first, then plan slot assignments here.'));
      return;
    }

    if (unassigned.length === 0) {
      container.innerHTML = '<div class="text-sm text-success" style="padding:8px;">All colors assigned to slots.</div>';
      return;
    }

    container.innerHTML = unassigned.map(c => `
      <div class="mc-pool-color" draggable="true" data-color-id="${c.id}">
        <span class="color-swatch" style="background:${c.hex};"></span>
        <span>${esc(c.name)}</span>
      </div>
    `).join('');

    // Drag bindings for pool colors
    container.querySelectorAll('.mc-pool-color').forEach(el => {
      el.addEventListener('dragstart', (e) => {
        state.draggedColorId = el.dataset.colorId;
        el.classList.add('dragging');
        e.dataTransfer.setData('text/plain', el.dataset.colorId);
      });
      el.addEventListener('dragend', () => {
        el.classList.remove('dragging');
        state.draggedColorId = null;
        // Clean up any lingering drag-over states
        document.querySelectorAll('.mc-slot-drag-over').forEach(s => s.classList.remove('mc-slot-drag-over'));
      });
    });
  }

  function handleSlotDrop(e) {
    e.preventDefault();
    const slotKey = e.currentTarget.dataset.slotKey;
    const colorId = e.dataTransfer.getData('text/plain') || state.draggedColorId;
    if (!colorId || !slotKey) return;

    e.currentTarget.classList.remove('mc-slot-drag-over');

    // Remove color from any previous slot
    Object.keys(state.slotAssignments).forEach(key => {
      if (state.slotAssignments[key] === colorId) delete state.slotAssignments[key];
    });

    state.slotAssignments[slotKey] = colorId;
    state.draggedColorId = null;
    renderSlotPlanner();
  }

  function handleSlotClick(slotKey) {
    // If a color is already assigned, do nothing (user can clear via X button)
    if (state.slotAssignments[slotKey]) return;

    // Find first unassigned color
    const assignedIds = new Set(Object.values(state.slotAssignments));
    const unassigned = state.neededColors.filter(c => !assignedIds.has(c.id));
    if (unassigned.length === 0) return;

    state.slotAssignments[slotKey] = unassigned[0].id;
    renderSlotPlanner();
  }

  function clearSlotAssignments() {
    state.slotAssignments = {};
    renderSlotPlanner();
  }

  function autoAssignColors() {
    // Auto-assign needed colors to best matching loaded filament slots
    state.slotAssignments = {};
    const profiles = window.printerProfiles;

    // Build a list of all available slots across all printers
    const allSlots = [];
    Object.keys(profiles).forEach(pId => {
      const p = profiles[pId];
      for (let u = 0; u < p.ams.units; u++) {
        for (let s = 0; s < p.ams.slotsPerUnit; s++) {
          const key = `${pId}-${u}-${s}`;
          // Check if a matching filament is loaded in this slot
          const loaded = state.loadedFilaments.find(
            f => f.printer === pId && String(f.unit) === String(u) && String(f.slot) === String(s)
          );
          allSlots.push({ key, pId, unit: u, slot: s, loaded });
        }
      }
    });

    // For each needed color, find the loaded slot with closest color and assign
    const usedSlots = new Set();
    state.neededColors.forEach(needed => {
      let bestKey = null;
      let bestDist = Infinity;

      allSlots.forEach(sl => {
        if (usedSlots.has(sl.key)) return;
        if (!sl.loaded || !sl.loaded.colorHex) return;
        const d = colorDistance(needed.hex, sl.loaded.colorHex.toUpperCase());
        if (d < bestDist) {
          bestDist = d;
          bestKey = sl.key;
        }
      });

      if (bestKey) {
        state.slotAssignments[bestKey] = needed.id;
        usedSlots.add(bestKey);
      } else {
        // No match found among loaded; assign to first available empty slot
        const emptySlot = allSlots.find(sl => !usedSlots.has(sl.key));
        if (emptySlot) {
          state.slotAssignments[emptySlot.key] = needed.id;
          usedSlots.add(emptySlot.key);
        }
      }
    });

    renderSlotPlanner();
  }

  function applyMatchesToSlotPlanner() {
    state.slotAssignments = {};

    state.matchResults.forEach(r => {
      if (!r.match) return;
      const key = `${r.match.printer}-${r.match.unit}-${r.match.slot}`;
      state.slotAssignments[key] = r.needed.id;
    });

    // Switch to slot planner tab
    const slotTabBtn = document.querySelector('#mc-tab-bar .tab-btn[data-tab="mc-tab-slots"]');
    if (slotTabBtn) slotTabBtn.click();

    renderSlotPlanner();
  }

  // ---- Saved Plans ----

  async function loadSavedPlans() {
    try {
      state.savedPlans = (await window.storage.load('multicolor-plans.json')) || [];
    } catch (e) {
      state.savedPlans = [];
    }
    renderPlanSelect();
  }

  function renderPlanSelect() {
    const select = document.getElementById('mc-slot-plan-select');
    const currentVal = select.value;
    select.innerHTML = '<option value="">-- Current Slot Layout --</option>';
    state.savedPlans.forEach(plan => {
      const opt = document.createElement('option');
      opt.value = plan.id;
      opt.textContent = plan.name;
      select.appendChild(opt);
    });
    select.value = currentVal;
  }

  function savePlan(e) {
    e.preventDefault();
    const name = document.getElementById('mc-plan-name').value.trim();
    const notes = document.getElementById('mc-plan-notes').value.trim();
    if (!name) return;

    const plan = {
      id: generateId(),
      name,
      notes,
      assignments: { ...state.slotAssignments },
      colors: state.neededColors.map(c => ({ ...c })),
      createdAt: new Date().toISOString()
    };

    state.savedPlans.push(plan);
    window.storage.save('multicolor-plans.json', state.savedPlans);
    renderPlanSelect();

    document.getElementById('mc-plan-name').value = '';
    document.getElementById('mc-plan-notes').value = '';
    closeModal('mc-modal-save-plan');
  }

  function loadSelectedPlan() {
    const select = document.getElementById('mc-slot-plan-select');
    const planId = select.value;
    if (!planId) {
      // Reset to current layout
      state.slotAssignments = {};
      renderSlotPlanner();
      return;
    }
    const plan = state.savedPlans.find(p => p.id === planId);
    if (!plan) return;

    state.neededColors = plan.colors.map(c => ({ ...c }));
    state.slotAssignments = { ...plan.assignments };
    renderNeededColors();
    runColorMatching();
    renderSlotPlanner();
  }

  function deleteSelectedPlan() {
    const select = document.getElementById('mc-slot-plan-select');
    const planId = select.value;
    if (!planId) return;

    state.savedPlans = state.savedPlans.filter(p => p.id !== planId);
    window.storage.save('multicolor-plans.json', state.savedPlans);
    select.value = '';
    renderPlanSelect();
  }

  // ---- Batch Planning ----

  function addBatchModel(e) {
    e.preventDefault();
    const name = document.getElementById('mc-batch-model-name').value.trim();
    const printer = document.getElementById('mc-batch-printer').value;
    const colorCount = intVal('mc-batch-color-count', 4);
    const filamentGrams = intVal('mc-batch-filament', 50);

    if (!name) return;

    state.batchModels.push({
      id: generateId(),
      name,
      printer,
      colorCount,
      filamentGrams
    });

    renderBatchList();
    document.getElementById('mc-batch-model-name').value = '';
    closeModal('mc-modal-add-batch');
  }

  function removeBatchModel(id) {
    state.batchModels = state.batchModels.filter(m => m.id !== id);
    renderBatchList();
  }

  function renderBatchList() {
    const container = document.getElementById('mc-batch-list');
    const emptyEl = document.getElementById('mc-batch-empty');

    if (state.batchModels.length === 0) {
      container.innerHTML = '';
      container.appendChild(createEmptyState('mc-batch-empty', '&#x1F4E6;', 'No batch models', 'Add models to plan multiple color configurations in sequence.'));
      return;
    }

    container.innerHTML = state.batchModels.map((m, i) => {
      const pName = getPrinterShortName(m.printer);
      return `
        <div class="mc-batch-item">
          <div class="mc-batch-item-info">
            <div class="mc-batch-item-order">${i + 1}</div>
            <div>
              <div class="mc-batch-item-name">${esc(m.name)}</div>
              <div class="mc-batch-item-meta">${pName} &middot; ${m.colorCount} colors &middot; ~${m.filamentGrams}g</div>
            </div>
          </div>
          <div class="mc-batch-item-actions">
            <button class="btn btn-sm btn-danger mc-batch-remove" data-id="${m.id}">Remove</button>
          </div>
        </div>`;
    }).join('');

    container.querySelectorAll('.mc-batch-remove').forEach(btn => {
      btn.addEventListener('click', () => removeBatchModel(btn.dataset.id));
    });
  }

  // ================================================================
  //  COST CALCULATOR TAB
  // ================================================================

  function calculateCost() {
    const modelGrams = floatVal('mc-cost-model-grams', 100);
    const colors = intVal('mc-cost-colors', 4);
    const layers = intVal('mc-cost-layers', 200);
    const changesPerLayer = intVal('mc-cost-changes', 3);
    const purgeVolMm3 = floatVal('mc-cost-purge-vol', 180);
    const elecRate = floatVal('mc-cost-elec-rate', 0.12);
    const printTimeHrs = floatVal('mc-cost-time-hrs', 6);
    const wattage = floatVal('mc-cost-wattage', 120);
    const density = floatVal('mc-cost-density', 1.24);

    // Calculate purge waste
    const totalSwaps = changesPerLayer * layers;
    const purgePerSwapG = (purgeVolMm3 / 1000) * density;
    const totalPurgeG = totalSwaps * purgePerSwapG;

    // Determine average cost per kg from loaded filaments or default
    let avgCostPerKg = 20; // default
    if (state.loadedFilaments.length > 0) {
      const costs = state.loadedFilaments.filter(f => f.costPerKg > 0).map(f => f.costPerKg);
      if (costs.length > 0) avgCostPerKg = costs.reduce((a, b) => a + b, 0) / costs.length;
    }

    const filamentCost = (modelGrams / 1000) * avgCostPerKg;
    const purgeCost = (totalPurgeG / 1000) * avgCostPerKg;
    const electricityCost = (wattage / 1000) * printTimeHrs * elecRate;
    const totalCost = filamentCost + purgeCost + electricityCost;

    // Single color comparison: same model, no purge waste
    const singleColorCost = filamentCost + electricityCost;

    // Display
    document.getElementById('mc-cost-results-card').style.display = '';
    document.getElementById('mc-cost-filament-total').textContent = '$' + filamentCost.toFixed(2);
    document.getElementById('mc-cost-purge-total').textContent = '$' + purgeCost.toFixed(2);
    document.getElementById('mc-cost-elec-total').textContent = '$' + electricityCost.toFixed(2);
    document.getElementById('mc-cost-grand-total').textContent = '$' + totalCost.toFixed(2);

    document.getElementById('mc-cost-per-gram').textContent = '$' + (totalCost / modelGrams).toFixed(3);
    document.getElementById('mc-cost-waste-pct').textContent = ((totalPurgeG / (modelGrams + totalPurgeG)) * 100).toFixed(1) + '%';
    document.getElementById('mc-cost-single-color').textContent = '$' + singleColorCost.toFixed(2);

    // Per-color breakdown table
    renderColorCostTable(modelGrams, totalPurgeG, colors, avgCostPerKg);

    // Visual cost bar
    renderCostVisual(filamentCost, purgeCost, electricityCost, totalCost);
  }

  function renderColorCostTable(modelGrams, totalPurgeG, colors, avgCostPerKg) {
    const tbody = document.getElementById('mc-cost-color-tbody');

    if (state.neededColors.length > 0) {
      // Use actual needed colors
      const totalNeeded = state.neededColors.reduce((s, c) => s + c.grams, 0);
      const purgePerColor = totalPurgeG / state.neededColors.length;

      tbody.innerHTML = state.neededColors.map(c => {
        const proportion = totalNeeded > 0 ? c.grams / totalNeeded : 1 / state.neededColors.length;
        const colorModelG = modelGrams * proportion;
        const colorPurgeG = purgePerColor;

        // Find matched filament cost or use average
        const matchResult = state.matchResults.find(r => r.needed.id === c.id);
        const spoolCostPerKg = (matchResult && matchResult.match && matchResult.match.costPerKg > 0)
          ? matchResult.match.costPerKg
          : avgCostPerKg;
        const spoolName = (matchResult && matchResult.match)
          ? (matchResult.match.color || matchResult.match.brand || 'Unknown')
          : 'Unmatched';
        const lineCost = ((colorModelG + colorPurgeG) / 1000) * spoolCostPerKg;

        return `<tr>
          <td><div class="mc-cost-color-cell"><span class="color-swatch" style="background:${c.hex};"></span> ${esc(c.name)}</div></td>
          <td>${esc(spoolName)}</td>
          <td>${colorModelG.toFixed(1)}g</td>
          <td>${colorPurgeG.toFixed(1)}g</td>
          <td>$${spoolCostPerKg.toFixed(2)}</td>
          <td>$${lineCost.toFixed(2)}</td>
        </tr>`;
      }).join('');
    } else {
      // Generic breakdown
      const perColorModelG = modelGrams / colors;
      const perColorPurgeG = totalPurgeG / colors;
      const lineCost = ((perColorModelG + perColorPurgeG) / 1000) * avgCostPerKg;

      const rows = [];
      for (let i = 0; i < colors; i++) {
        rows.push(`<tr>
          <td><div class="mc-cost-color-cell"><span class="color-swatch" style="background:var(--text-muted);"></span> Color ${i + 1}</div></td>
          <td>--</td>
          <td>${perColorModelG.toFixed(1)}g</td>
          <td>${perColorPurgeG.toFixed(1)}g</td>
          <td>$${avgCostPerKg.toFixed(2)}</td>
          <td>$${lineCost.toFixed(2)}</td>
        </tr>`);
      }
      tbody.innerHTML = rows.join('');
    }
  }

  function renderCostVisual(filamentCost, purgeCost, electricityCost, totalCost) {
    const container = document.getElementById('mc-cost-visual');
    if (totalCost <= 0) {
      container.innerHTML = '<div class="text-sm text-muted" style="padding:12px;">No costs to display.</div>';
      return;
    }

    const filPct = (filamentCost / totalCost * 100).toFixed(1);
    const purgePct = (purgeCost / totalCost * 100).toFixed(1);
    const elecPct = (electricityCost / totalCost * 100).toFixed(1);

    container.innerHTML = `
      <div class="mc-cost-breakdown-visual">
        <div class="mc-cost-bar-segment mc-cost-bar-filament" style="width:${filPct}%;" title="Filament: $${filamentCost.toFixed(2)}">
          ${parseFloat(filPct) > 15 ? 'Filament ' + filPct + '%' : ''}
        </div>
        <div class="mc-cost-bar-segment mc-cost-bar-purge" style="width:${purgePct}%;" title="Purge: $${purgeCost.toFixed(2)}">
          ${parseFloat(purgePct) > 15 ? 'Purge ' + purgePct + '%' : ''}
        </div>
        <div class="mc-cost-bar-segment mc-cost-bar-electricity" style="width:${elecPct}%;" title="Electricity: $${electricityCost.toFixed(2)}">
          ${parseFloat(elecPct) > 15 ? 'Power ' + elecPct + '%' : ''}
        </div>
      </div>
      <div class="mc-cost-legend">
        <div class="mc-cost-legend-item">
          <span class="mc-cost-legend-dot" style="background:var(--accent);"></span>
          Filament ($${filamentCost.toFixed(2)})
        </div>
        <div class="mc-cost-legend-item">
          <span class="mc-cost-legend-dot" style="background:var(--warning);"></span>
          Purge Waste ($${purgeCost.toFixed(2)})
        </div>
        <div class="mc-cost-legend-item">
          <span class="mc-cost-legend-dot" style="background:var(--success);"></span>
          Electricity ($${electricityCost.toFixed(2)})
        </div>
      </div>`;
  }

  function resetCostDefaults() {
    document.getElementById('mc-cost-model-grams').value = 100;
    document.getElementById('mc-cost-colors').value = 4;
    document.getElementById('mc-cost-layers').value = 200;
    document.getElementById('mc-cost-changes').value = 3;
    document.getElementById('mc-cost-purge-vol').value = 180;
    document.getElementById('mc-cost-elec-rate').value = 0.12;
    document.getElementById('mc-cost-time-hrs').value = 6;
    document.getElementById('mc-cost-wattage').value = 120;
    document.getElementById('mc-cost-density').value = 1.24;
    document.getElementById('mc-cost-results-card').style.display = 'none';
  }

  // ================================================================
  //  UTILITIES
  // ================================================================

  function esc(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function intVal(id, fallback) {
    return parseInt(document.getElementById(id).value, 10) || fallback;
  }

  function floatVal(id, fallback) {
    return parseFloat(document.getElementById(id).value) || fallback;
  }

  function getPrinterShortName(printerId) {
    const p = window.printerProfiles[printerId];
    return p ? p.shortName : printerId || 'Unknown';
  }

  function createEmptyState(id, icon, title, text) {
    const div = document.createElement('div');
    div.className = 'empty-state';
    div.id = id;
    div.style.padding = '20px';
    div.innerHTML = `
      ${icon ? `<div class="empty-state-icon" style="font-size:28px;">${icon}</div>` : ''}
      ${title ? `<div class="empty-state-title" style="font-size:14px;">${title}</div>` : ''}
      <div class="empty-state-text">${text}</div>`;
    return div;
  }

  // ---- Bootstrap ----

  init();

})();
