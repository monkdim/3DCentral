// Print Router Module — Recommendation Engine
// Analyzes print job parameters and recommends the best printer with reasoning.

(function () {
  'use strict';

  // ---- Editable Profile Overrides (synced from profile inputs) ----
  // Start from window.printerProfiles, but allow user edits within this session.

  let profileOverrides = {
    bambu_a1: {
      buildX: 256, buildY: 256, buildZ: 256,
      maxSpeed: 500, amsSlots: 4,
      maxNozzleTemp: 300, maxBedTemp: 100,
      hasEnclosure: false,
      materials: ['PLA', 'PLA+', 'PETG', 'TPU', 'PVA', 'PLA-CF']
    },
    kobra_s1: {
      buildX: 220, buildY: 220, buildZ: 250,
      maxSpeed: 300, amsSlots: 8,
      maxNozzleTemp: 300, maxBedTemp: 110,
      hasEnclosure: false,
      materials: ['PLA', 'PLA+', 'PETG', 'TPU', 'ABS', 'ASA']
    }
  };

  // Sync overrides from the global printerProfiles on load
  function syncFromGlobalProfiles() {
    const profiles = window.printerProfiles || {};
    Object.keys(profiles).forEach(id => {
      const p = profiles[id];
      if (!profileOverrides[id]) return;
      profileOverrides[id].buildX = p.buildVolume.x;
      profileOverrides[id].buildY = p.buildVolume.y;
      profileOverrides[id].buildZ = p.buildVolume.z;
      profileOverrides[id].maxSpeed = p.maxSpeed;
      profileOverrides[id].amsSlots = p.ams ? p.ams.totalSlots : 1;
      profileOverrides[id].maxNozzleTemp = p.maxNozzleTemp;
      profileOverrides[id].maxBedTemp = p.maxBedTemp;
      profileOverrides[id].hasEnclosure = p.hasEnclosure;
      profileOverrides[id].materials = [...p.supportedMaterials];
    });
  }

  // ---- Cached data from async sources ----
  let cachedFilaments = [];
  let cachedPrints = [];

  // ---- DOM References ----

  const form = document.getElementById('rtr-job-form');
  const resultsArea = document.getElementById('rtr-results-area');
  const btnReset = document.getElementById('rtr-btn-reset');
  const btnAnalyze = document.getElementById('rtr-btn-analyze');

  // Sliders
  const sliderSpeedQuality = document.getElementById('rtr-priority-speed-quality');
  const sliderStrengthFinish = document.getElementById('rtr-priority-strength-finish');
  const valSpeedQuality = document.getElementById('rtr-val-speed-quality');
  const valStrengthFinish = document.getElementById('rtr-val-strength-finish');

  // ---- Slider Label Updates ----

  function describeSlider(value) {
    if (value <= 15) return 'Strongly Left';
    if (value <= 35) return 'Leans Left';
    if (value <= 65) return 'Balanced';
    if (value <= 85) return 'Leans Right';
    return 'Strongly Right';
  }

  function describeSpeedQuality(value) {
    const v = parseInt(value, 10);
    if (v <= 15) return 'Max Speed';
    if (v <= 35) return 'Favor Speed';
    if (v <= 65) return 'Balanced';
    if (v <= 85) return 'Favor Quality';
    return 'Max Quality';
  }

  function describeStrengthFinish(value) {
    const v = parseInt(value, 10);
    if (v <= 15) return 'Max Strength';
    if (v <= 35) return 'Favor Strength';
    if (v <= 65) return 'Balanced';
    if (v <= 85) return 'Favor Surface Finish';
    return 'Best Surface Finish';
  }

  if (sliderSpeedQuality) {
    sliderSpeedQuality.addEventListener('input', () => {
      valSpeedQuality.textContent = describeSpeedQuality(sliderSpeedQuality.value);
    });
  }
  if (sliderStrengthFinish) {
    sliderStrengthFinish.addEventListener('input', () => {
      valStrengthFinish.textContent = describeStrengthFinish(sliderStrengthFinish.value);
    });
  }

  // ---- Gather Form Data ----

  function getJobParams() {
    return {
      name: document.getElementById('rtr-job-name').value.trim(),
      material: document.getElementById('rtr-material').value,
      dimX: parseFloat(document.getElementById('rtr-dim-x').value) || 0,
      dimY: parseFloat(document.getElementById('rtr-dim-y').value) || 0,
      dimZ: parseFloat(document.getElementById('rtr-dim-z').value) || 0,
      colors: parseInt(document.getElementById('rtr-colors').value, 10) || 1,
      speedQuality: parseInt(sliderSpeedQuality.value, 10),
      strengthFinish: parseInt(sliderStrengthFinish.value, 10),
      needsSupports: document.getElementById('rtr-req-supports').checked,
      flexibleMaterial: document.getElementById('rtr-req-flexible').checked,
      highTemp: document.getElementById('rtr-req-hightemp').checked,
      enclosedChamber: document.getElementById('rtr-req-enclosed').checked,
      estWeight: parseFloat(document.getElementById('rtr-est-weight').value) || 0
    };
  }

  // ---- Recommendation Engine ----

  // Evaluate a single printer against the job parameters.
  // Returns { score, canPrint, reasons[], advantages[], limitations[] }
  function evaluatePrinter(printerId, job) {
    const prof = profileOverrides[printerId];
    if (!prof) return { score: 0, canPrint: false, reasons: [], advantages: [], limitations: [] };

    const printerName = printerId === 'bambu_a1' ? 'Bambu A1' : 'Kobra S1';

    let score = 50; // Start at neutral
    const reasons = [];
    const advantages = [];
    const limitations = [];
    let canPrint = true;

    // ---- 1. SIZE CHECK ----
    const fitsX = job.dimX <= prof.buildX;
    const fitsY = job.dimY <= prof.buildY;
    const fitsZ = job.dimZ <= prof.buildZ;
    const fitsAll = fitsX && fitsY && fitsZ;

    if (!fitsAll) {
      canPrint = false;
      const overDims = [];
      if (!fitsX) overDims.push(`X: ${job.dimX}mm > ${prof.buildX}mm`);
      if (!fitsY) overDims.push(`Y: ${job.dimY}mm > ${prof.buildY}mm`);
      if (!fitsZ) overDims.push(`Z: ${job.dimZ}mm > ${prof.buildZ}mm`);
      reasons.push({ type: 'con', text: `Model exceeds build volume (${overDims.join(', ')})` });
      limitations.push(`Build plate too small: ${prof.buildX}x${prof.buildY}x${prof.buildZ}mm`);
      score -= 50;
    } else {
      // Reward printers where the model fits comfortably (more margin)
      const marginX = (prof.buildX - job.dimX) / prof.buildX;
      const marginY = (prof.buildY - job.dimY) / prof.buildY;
      const marginZ = (prof.buildZ - job.dimZ) / prof.buildZ;
      const avgMargin = (marginX + marginY + marginZ) / 3;
      if (avgMargin > 0.5) {
        advantages.push(`Fits easily with ${Math.round(avgMargin * 100)}% margin`);
        score += 3;
      } else if (avgMargin < 0.1) {
        reasons.push({ type: 'warn', text: `Tight fit on ${printerName} (less than 10% margin)` });
        limitations.push('Very tight fit on build plate');
        score -= 5;
      } else {
        advantages.push(`Fits within build volume (${prof.buildX}x${prof.buildY}x${prof.buildZ}mm)`);
        score += 2;
      }
    }

    // ---- 2. MATERIAL CHECK ----
    const matDB = window.materialDB || {};
    const matInfo = matDB[job.material];
    const printerSupportsMat = prof.materials.includes(job.material);
    const matDBSupportsPrinter = matInfo && matInfo.printerSupport && matInfo.printerSupport.includes(printerId);

    if (!printerSupportsMat && !matDBSupportsPrinter) {
      canPrint = false;
      reasons.push({ type: 'con', text: `${job.material} is not supported on ${printerName}` });
      limitations.push(`${job.material} not in supported material list`);
      score -= 40;
    } else if (printerSupportsMat || matDBSupportsPrinter) {
      advantages.push(`${job.material} is supported`);
      score += 5;
    }

    // Temperature feasibility
    if (matInfo) {
      if (matInfo.nozzleMax > prof.maxNozzleTemp) {
        reasons.push({ type: 'warn', text: `${job.material} may need up to ${matInfo.nozzleMax}\u00B0C nozzle; printer max is ${prof.maxNozzleTemp}\u00B0C` });
        if (matInfo.nozzleMin > prof.maxNozzleTemp) {
          canPrint = false;
          limitations.push(`Nozzle temp too low for ${job.material}`);
          score -= 30;
        } else {
          limitations.push('Running near nozzle temp limit');
          score -= 5;
        }
      }
      if (matInfo.bedMin > prof.maxBedTemp) {
        canPrint = false;
        reasons.push({ type: 'con', text: `${job.material} needs ${matInfo.bedMin}\u00B0C bed min; printer max is ${prof.maxBedTemp}\u00B0C` });
        limitations.push(`Bed temp too low for ${job.material}`);
        score -= 25;
      }
    }

    // ---- 3. COLOR CHECK ----
    if (job.colors > prof.amsSlots) {
      canPrint = false;
      reasons.push({ type: 'con', text: `Needs ${job.colors} colors but ${printerName} only has ${prof.amsSlots} AMS slots` });
      limitations.push(`Only ${prof.amsSlots} color slots available`);
      score -= 35;
    } else if (job.colors <= prof.amsSlots) {
      if (job.colors > 1) {
        const remaining = prof.amsSlots - job.colors;
        advantages.push(`${prof.amsSlots} color slots available (${remaining} spare)`);
        // More spare slots = slight advantage
        score += Math.min(remaining * 2, 10);
      }
    }

    // Kobra wins at 5-8 colors due to dual Ace Pro
    if (job.colors >= 5 && job.colors <= 8) {
      if (printerId === 'kobra_s1' && prof.amsSlots >= 8) {
        reasons.push({ type: 'pro', text: 'Dual Ace Pro handles 5-8 colors natively' });
        advantages.push('8-color capability with dual Ace Pro');
        score += 20;
      } else if (printerId === 'bambu_a1' && prof.amsSlots < job.colors) {
        // Already penalized above
      }
    }

    // ---- 4. SPEED CHECK ----
    // speedQuality: 0 = max speed, 100 = max quality
    const speedPriority = (100 - job.speedQuality) / 100; // 1.0 = max speed priority
    if (speedPriority > 0.5) {
      // User favors speed
      const speedAdvantage = prof.maxSpeed / 500; // Normalized to Bambu's 500
      score += Math.round(speedAdvantage * speedPriority * 15);
      if (prof.maxSpeed >= 400) {
        advantages.push(`High speed: up to ${prof.maxSpeed}mm/s`);
      }
      if (prof.maxSpeed < 350 && speedPriority > 0.7) {
        reasons.push({ type: 'warn', text: `${printerName} max speed is ${prof.maxSpeed}mm/s; speed is a priority` });
        limitations.push(`Lower max speed (${prof.maxSpeed}mm/s)`);
      }
    }

    // ---- 5. ENCLOSURE CHECK ----
    if (job.enclosedChamber || (matInfo && matInfo.needsEnclosure)) {
      if (prof.hasEnclosure) {
        advantages.push('Has enclosed chamber');
        score += 15;
      } else {
        if (matInfo && matInfo.needsEnclosure) {
          reasons.push({ type: 'warn', text: `${job.material} strongly benefits from an enclosure; ${printerName} is open-frame` });
          limitations.push('No enclosure (warping risk)');
          score -= 15;
        }
        if (job.enclosedChamber) {
          reasons.push({ type: 'con', text: `Enclosed chamber required but ${printerName} is open-frame` });
          limitations.push('Enclosed chamber not available');
          score -= 20;
        }
      }
    }

    // ---- 6. HIGH TEMP CHECK ----
    if (job.highTemp) {
      if (prof.maxNozzleTemp >= 280) {
        advantages.push(`High nozzle temp support (${prof.maxNozzleTemp}\u00B0C)`);
        score += 5;
      } else {
        limitations.push(`Max nozzle temp is ${prof.maxNozzleTemp}\u00B0C`);
        score -= 5;
      }
      if (prof.maxBedTemp >= 100) {
        advantages.push(`High bed temp (${prof.maxBedTemp}\u00B0C)`);
        score += 3;
      }
    }

    // ---- 7. FLEXIBLE MATERIAL CHECK ----
    if (job.flexibleMaterial) {
      // Direct drive is essential for flex; both printers have it
      // But slower printers handle flex better
      if (prof.maxSpeed <= 300) {
        advantages.push('Lower speed range suits flexible materials');
        score += 5;
      }
      reasons.push({ type: 'info', text: `TPU/flex prints best at 20-40mm/s regardless of printer max speed` });
    }

    // ---- 8. SUPPORT MATERIAL CHECK ----
    if (job.needsSupports) {
      // PVA support is a big advantage (Bambu supports PVA)
      if (prof.materials.includes('PVA')) {
        advantages.push('PVA water-soluble supports available');
        score += 8;
      } else {
        limitations.push('No PVA support material capability');
      }
    }

    // ---- 9. SPECIAL FEATURES ----
    // Give Bambu a bonus for LiDAR / auto-calibration (reliability)
    if (printerId === 'bambu_a1') {
      const globalProfile = (window.printerProfiles || {}).bambu_a1;
      if (globalProfile && globalProfile.features) {
        if (globalProfile.features.includes('LiDAR')) {
          advantages.push('LiDAR first-layer inspection');
          score += 3;
        }
        if (globalProfile.features.includes('Vibration compensation')) {
          advantages.push('Vibration compensation for better quality at speed');
          score += 3;
        }
      }
    }

    // ---- 10. FILAMENT AVAILABILITY ----
    const matchingFilaments = cachedFilaments.filter(f =>
      f.material === job.material && f.printer === printerId && f.weightRemaining_g > 0
    );
    if (matchingFilaments.length > 0) {
      const totalAvailable = matchingFilaments.reduce((sum, f) => sum + f.weightRemaining_g, 0);
      advantages.push(`${job.material} loaded: ${Math.round(totalAvailable)}g across ${matchingFilaments.length} spool(s)`);
      score += 10;

      // Check if enough filament for estimated weight
      if (job.estWeight > 0 && totalAvailable < job.estWeight) {
        reasons.push({ type: 'warn', text: `Only ${Math.round(totalAvailable)}g of ${job.material} loaded; job needs ~${job.estWeight}g` });
        limitations.push(`Loaded filament may not be enough (${Math.round(totalAvailable)}g < ${job.estWeight}g)`);
        score -= 5;
      }
    } else {
      // Check storage spools (not loaded)
      const storageSpools = cachedFilaments.filter(f =>
        f.material === job.material && (!f.printer || f.printer === '') && f.weightRemaining_g > 0
      );
      if (storageSpools.length > 0) {
        reasons.push({ type: 'info', text: `${job.material} available in storage (${storageSpools.length} spool(s)) but not loaded on ${printerName}` });
      } else {
        const anyPrinterSpools = cachedFilaments.filter(f =>
          f.material === job.material && f.weightRemaining_g > 0
        );
        if (anyPrinterSpools.length === 0) {
          reasons.push({ type: 'warn', text: `No ${job.material} spools found in inventory` });
          limitations.push(`No ${job.material} in filament inventory`);
        }
      }
    }

    // ---- 11. PRINT HISTORY CHECK ----
    const similarPrints = cachedPrints.filter(p =>
      p.printer === printerId && p.material === job.material
    );
    const successPrints = similarPrints.filter(p => p.status === 'success');
    const failedPrints = similarPrints.filter(p => p.status === 'failed');

    if (similarPrints.length > 0) {
      const successRate = similarPrints.length > 0 ? (successPrints.length / similarPrints.length * 100) : 0;
      if (successRate >= 80 && successPrints.length >= 2) {
        reasons.push({ type: 'pro', text: `Strong track record: ${successPrints.length}/${similarPrints.length} successful ${job.material} prints on ${printerName}` });
        advantages.push(`${Math.round(successRate)}% success rate with ${job.material}`);
        score += 10;
      } else if (successRate >= 50) {
        reasons.push({ type: 'info', text: `${successPrints.length}/${similarPrints.length} successful ${job.material} prints on ${printerName}` });
        score += 3;
      } else if (failedPrints.length > successPrints.length && similarPrints.length >= 2) {
        reasons.push({ type: 'warn', text: `History shows ${failedPrints.length} failures with ${job.material} on ${printerName}` });
        limitations.push(`Poor history: ${failedPrints.length} failures`);
        score -= 10;
      }
    }

    // Clamp score
    score = Math.max(0, Math.min(100, score));

    return { score, canPrint, reasons, advantages, limitations };
  }

  // Run the full recommendation engine.
  // Returns { recommended, bambuResult, kobraResult, confidence, reasoning }
  function runRecommendation(job) {
    const bambu = evaluatePrinter('bambu_a1', job);
    const kobra = evaluatePrinter('kobra_s1', job);

    let recommended = null;
    let confidence = 0;
    const reasoning = [];

    const bothCanPrint = bambu.canPrint && kobra.canPrint;
    const neitherCanPrint = !bambu.canPrint && !kobra.canPrint;

    if (neitherCanPrint) {
      recommended = 'neither';
      confidence = 0;
      reasoning.push({ type: 'con', text: 'Neither printer can handle this job as configured' });
      // Collect all blocking reasons
      bambu.reasons.filter(r => r.type === 'con').forEach(r => reasoning.push(r));
      kobra.reasons.filter(r => r.type === 'con').forEach(r => reasoning.push(r));
      reasoning.push({ type: 'info', text: 'Consider adjusting model size, material choice, or printer upgrades' });
    } else if (bambu.canPrint && !kobra.canPrint) {
      recommended = 'bambu_a1';
      confidence = Math.min(95, bambu.score);
      reasoning.push({ type: 'pro', text: 'Bambu A1 is the only printer that can handle this job' });
      kobra.reasons.filter(r => r.type === 'con').forEach(r => reasoning.push(r));
    } else if (!bambu.canPrint && kobra.canPrint) {
      recommended = 'kobra_s1';
      confidence = Math.min(95, kobra.score);
      reasoning.push({ type: 'pro', text: 'Kobra S1 is the only printer that can handle this job' });
      bambu.reasons.filter(r => r.type === 'con').forEach(r => reasoning.push(r));
    } else {
      // Both can print — compare scores
      const scoreDiff = Math.abs(bambu.score - kobra.score);

      if (scoreDiff < 5) {
        // Too close to call
        recommended = 'either';
        confidence = Math.round((bambu.score + kobra.score) / 2);
        reasoning.push({ type: 'info', text: 'Both printers are equally suitable for this job' });
      } else if (bambu.score > kobra.score) {
        recommended = 'bambu_a1';
        confidence = Math.min(95, Math.round(50 + scoreDiff * 0.8));
      } else {
        recommended = 'kobra_s1';
        confidence = Math.min(95, Math.round(50 + scoreDiff * 0.8));
      }

      // Collect the winning reasons
      const winner = recommended === 'bambu_a1' ? bambu : (recommended === 'kobra_s1' ? kobra : bambu);
      const loser = recommended === 'bambu_a1' ? kobra : (recommended === 'kobra_s1' ? bambu : kobra);

      // Add the key differentiating reasons
      winner.reasons.filter(r => r.type === 'pro').forEach(r => reasoning.push(r));

      // Add info/warn items from both
      [...bambu.reasons, ...kobra.reasons]
        .filter(r => r.type === 'info' || r.type === 'warn')
        .forEach(r => {
          // Avoid duplicates
          if (!reasoning.find(existing => existing.text === r.text)) {
            reasoning.push(r);
          }
        });
    }

    return { recommended, bambuResult: bambu, kobraResult: kobra, confidence, reasoning };
  }

  // ---- Render Results ----

  function renderRecommendation(result) {
    resultsArea.style.display = 'block';

    const { recommended, bambuResult, kobraResult, confidence, reasoning } = result;

    // --- Recommendation Banner ---
    const banner = document.getElementById('rtr-recommendation-banner');
    banner.className = 'card rtr-recommendation-card';

    const iconEl = document.getElementById('rtr-rec-icon');
    const printerEl = document.getElementById('rtr-rec-printer');
    const confEl = document.getElementById('rtr-rec-confidence');

    if (recommended === 'bambu_a1') {
      banner.classList.add('rtr-rec-bambu');
      iconEl.textContent = '\uD83D\uDDA8\uFE0F';
      printerEl.textContent = 'Bambu Lab A1 Combo';
    } else if (recommended === 'kobra_s1') {
      banner.classList.add('rtr-rec-kobra');
      iconEl.textContent = '\uD83D\uDDA8\uFE0F';
      printerEl.textContent = 'Anycubic Kobra S1 Combo';
    } else if (recommended === 'either') {
      banner.classList.add('rtr-rec-either');
      iconEl.textContent = '\u2696\uFE0F';
      printerEl.textContent = 'Either Printer Works';
    } else {
      banner.classList.add('rtr-rec-neither');
      iconEl.textContent = '\u26A0\uFE0F';
      printerEl.textContent = 'No Suitable Printer';
    }

    confEl.textContent = confidence > 0 ? `${confidence}%` : '--';
    confEl.className = 'rtr-confidence-value';
    if (confidence >= 70) confEl.classList.add('rtr-conf-high');
    else if (confidence >= 40) confEl.classList.add('rtr-conf-medium');
    else confEl.classList.add('rtr-conf-low');

    // Reasoning bullets
    const reasoningEl = document.getElementById('rtr-rec-reasoning');
    if (reasoning.length > 0) {
      const iconMap = {
        pro: { cls: 'rtr-reason-pro', symbol: '\u2713' },
        con: { cls: 'rtr-reason-con', symbol: '\u2717' },
        info: { cls: 'rtr-reason-info', symbol: '\u2139' },
        warn: { cls: 'rtr-reason-warn', symbol: '\u26A0' }
      };
      reasoningEl.innerHTML = `<ul class="rtr-reasoning-list">${reasoning.map(r => {
        const ic = iconMap[r.type] || iconMap.info;
        return `<li class="rtr-reasoning-item">
          <span class="rtr-reasoning-icon ${ic.cls}">${ic.symbol}</span>
          <span>${escapeHtml(r.text)}</span>
        </li>`;
      }).join('')}</ul>`;
    } else {
      reasoningEl.innerHTML = '<p class="text-muted text-sm">No specific reasoning generated.</p>';
    }

    // Override / use buttons
    const btnUse = document.getElementById('rtr-btn-use-recommended');
    const btnOverride = document.getElementById('rtr-btn-override');
    if (recommended === 'neither') {
      btnUse.style.display = 'none';
      btnOverride.style.display = 'none';
    } else if (recommended === 'either') {
      btnUse.textContent = 'Use Bambu A1';
      btnUse.style.display = '';
      btnOverride.textContent = 'Use Kobra S1';
      btnOverride.style.display = '';
    } else {
      btnUse.textContent = `Use ${recommended === 'bambu_a1' ? 'Bambu A1' : 'Kobra S1'}`;
      btnUse.style.display = '';
      const otherName = recommended === 'bambu_a1' ? 'Kobra S1' : 'Bambu A1';
      btnOverride.textContent = `Override \u2014 Use ${otherName}`;
      btnOverride.style.display = '';
    }

    // --- Side-by-Side Comparison ---
    renderComparisonCard('bambu_a1', bambuResult, recommended);
    renderComparisonCard('kobra_s1', kobraResult, recommended);

    // --- Filament Availability ---
    renderFilamentAvailability();

    // --- Past Prints ---
    renderPastPrints();

    // Scroll to results
    resultsArea.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function renderComparisonCard(printerId, result, recommended) {
    const card = document.getElementById(`rtr-compare-${printerId}`);
    const body = document.getElementById(`rtr-compare-body-${printerId}`);
    const tag = document.getElementById(`rtr-tag-${printerId}`);
    const prof = profileOverrides[printerId];

    // Card border styling
    card.className = 'rtr-compare-card';
    if (recommended === printerId) {
      card.classList.add('rtr-compare-recommended');
    } else if (!result.canPrint) {
      card.classList.add('rtr-compare-blocked');
    }

    // Tag
    tag.className = 'tag';
    if (recommended === printerId) {
      tag.classList.add('tag-success');
      tag.textContent = 'Recommended';
    } else if (recommended === 'either') {
      tag.classList.add('tag-success');
      tag.textContent = 'Suitable';
    } else if (!result.canPrint) {
      tag.classList.add('tag-danger');
      tag.textContent = 'Cannot Print';
    } else {
      tag.classList.add('tag-warning');
      tag.textContent = 'Alternative';
    }

    // Build comparison rows
    const statusIcon = (ok) => ok
      ? '<span class="rtr-check">\u2713</span>'
      : '<span class="rtr-cross">\u2717</span>';

    const job = getJobParams();

    let html = '';

    // Size fit
    const fits = job.dimX <= prof.buildX && job.dimY <= prof.buildY && job.dimZ <= prof.buildZ;
    html += compRow('Build Volume', `${prof.buildX}x${prof.buildY}x${prof.buildZ}mm ${statusIcon(fits)}`);

    // Material
    const matOk = prof.materials.includes(job.material);
    html += compRow('Material', `${job.material} ${statusIcon(matOk)}`);

    // Colors
    const colorOk = job.colors <= prof.amsSlots;
    html += compRow('Color Slots', `${prof.amsSlots} slots ${statusIcon(colorOk)}`);

    // Speed
    html += compRow('Max Speed', `${prof.maxSpeed} mm/s`);

    // Enclosure
    html += compRow('Enclosure', prof.hasEnclosure ? 'Yes \u2713' : 'No (open frame)');

    // Temps
    html += compRow('Max Nozzle', `${prof.maxNozzleTemp}\u00B0C`);
    html += compRow('Max Bed', `${prof.maxBedTemp}\u00B0C`);

    // Advantages
    if (result.advantages.length > 0) {
      html += `<div class="rtr-compare-section-title">Advantages</div>`;
      html += `<ul class="rtr-compare-list rtr-adv-list">${result.advantages.map(a =>
        `<li><span class="icon">\u2713</span> ${escapeHtml(a)}</li>`
      ).join('')}</ul>`;
    }

    // Limitations
    if (result.limitations.length > 0) {
      html += `<div class="rtr-compare-section-title">Limitations</div>`;
      html += `<ul class="rtr-compare-list rtr-lim-list">${result.limitations.map(l =>
        `<li><span class="icon">\u2717</span> ${escapeHtml(l)}</li>`
      ).join('')}</ul>`;
    }

    // Score bar
    const scoreClass = result.score >= 65 ? 'rtr-score-high' : (result.score >= 35 ? 'rtr-score-medium' : 'rtr-score-low');
    html += `<div class="rtr-score-bar-container">
      <div class="rtr-score-label">
        <span>Overall Score</span>
        <span>${result.score}/100</span>
      </div>
      <div class="rtr-score-bar">
        <div class="rtr-score-fill ${scoreClass}" style="width:${result.score}%"></div>
      </div>
    </div>`;

    body.innerHTML = html;
  }

  function compRow(label, value) {
    return `<div class="rtr-compare-row">
      <span class="rtr-compare-label">${escapeHtml(label)}</span>
      <span class="rtr-compare-value">${value}</span>
    </div>`;
  }

  function renderFilamentAvailability() {
    const job = getJobParams();
    const container = document.getElementById('rtr-filament-list');
    const matching = cachedFilaments.filter(f => f.material === job.material && f.weightRemaining_g > 0);

    if (matching.length === 0) {
      container.innerHTML = `<div class="empty-state" style="padding:24px;">
        <div class="empty-state-icon">\uD83E\uDDF5</div>
        <div class="empty-state-title">No ${escapeHtml(job.material)} spools in inventory</div>
        <div class="empty-state-text">Add spools via the Filament Manager to see availability here.</div>
      </div>`;
      return;
    }

    container.innerHTML = matching.map(f => {
      const printerName = f.printer === 'bambu_a1' ? 'Bambu A1'
        : f.printer === 'kobra_s1' ? 'Kobra S1'
        : 'Storage';
      const locationDetail = f.printer ? `Loaded on ${printerName}` : 'In storage (not loaded)';
      const color = f.colorHex || '#888';
      const name = [f.brand, f.color, f.material].filter(Boolean).join(' ');
      const remaining = Math.round(f.weightRemaining_g);
      return `<div class="rtr-filament-row">
        <div class="rtr-filament-swatch" style="background:${escapeHtml(color)}"></div>
        <div class="rtr-filament-info">
          <div class="rtr-filament-name">${escapeHtml(name || f.material)}</div>
          <div class="rtr-filament-detail">${remaining}g remaining</div>
        </div>
        <div class="rtr-filament-location">${escapeHtml(locationDetail)}</div>
      </div>`;
    }).join('');
  }

  function renderPastPrints() {
    const job = getJobParams();
    const container = document.getElementById('rtr-history-list');
    const similar = cachedPrints.filter(p => p.material === job.material).slice(0, 10);

    if (similar.length === 0) {
      container.innerHTML = `<div class="empty-state" style="padding:24px;">
        <div class="empty-state-icon">\uD83D\uDCDA</div>
        <div class="empty-state-title">No past prints with ${escapeHtml(job.material)}</div>
        <div class="empty-state-text">Print history will appear here once you log prints using this material.</div>
      </div>`;
      return;
    }

    container.innerHTML = similar.map(p => {
      const printerLabel = p.printer === 'bambu_a1' ? 'Bambu A1' : (p.printer === 'kobra_s1' ? 'Kobra S1' : p.printer);
      const statusTag = p.status === 'success' ? '<span class="tag tag-success">Success</span>'
        : p.status === 'failed' ? '<span class="tag tag-danger">Failed</span>'
        : '<span class="tag tag-warning">Cancelled</span>';
      const date = p.date ? formatDate(p.date) : '';
      return `<div class="rtr-history-row">
        <div class="rtr-history-name">${escapeHtml(p.name || 'Untitled')}</div>
        <div class="rtr-history-printer">${escapeHtml(printerLabel)}</div>
        <div class="rtr-history-material">${escapeHtml(p.material || '')}</div>
        ${statusTag}
        <div class="text-sm text-muted">${escapeHtml(date)}</div>
      </div>`;
    }).join('');
  }

  // ---- Override / Use Logging ----

  function logChoice(chosenPrinter, wasOverride) {
    const job = getJobParams();
    const entry = {
      id: generateId(),
      timestamp: new Date().toISOString(),
      jobName: job.name || 'Unnamed job',
      material: job.material,
      dimensions: { x: job.dimX, y: job.dimY, z: job.dimZ },
      colors: job.colors,
      chosenPrinter: chosenPrinter,
      wasOverride: wasOverride
    };

    // Store in router-choices for future learning
    window.storage.load('router-choices.json').then(choices => {
      const list = choices || [];
      list.unshift(entry);
      // Keep last 200 choices
      if (list.length > 200) list.length = 200;
      window.storage.save('router-choices.json', list);
    }).catch(() => {
      window.storage.save('router-choices.json', [entry]);
    });

    // Show confirmation
    const name = chosenPrinter === 'bambu_a1' ? 'Bambu Lab A1 Combo' : 'Anycubic Kobra S1 Combo';
    const action = wasOverride ? 'Override logged' : 'Choice logged';
    if (window.notifications && typeof window.notifications.show === 'function') {
      window.notifications.show(`${action}: ${name}`, 'success');
    } else {
      console.log(`[Router] ${action}: ${name}`, entry);
    }
  }

  // ---- Profile Management ----

  function readProfileInputs() {
    document.querySelectorAll('.rtr-profile-input').forEach(input => {
      const printer = input.dataset.printer;
      const field = input.dataset.field;
      if (!printer || !field || !profileOverrides[printer]) return;

      if (field === 'materials') {
        profileOverrides[printer].materials = input.value.split(',').map(s => s.trim()).filter(Boolean);
      } else {
        profileOverrides[printer][field] = parseFloat(input.value) || 0;
      }
    });

    document.querySelectorAll('.rtr-profile-check').forEach(input => {
      const printer = input.dataset.printer;
      const field = input.dataset.field;
      if (!printer || !field || !profileOverrides[printer]) return;
      profileOverrides[printer][field] = input.checked;
    });
  }

  function populateProfileInputs() {
    Object.keys(profileOverrides).forEach(printer => {
      const prof = profileOverrides[printer];
      document.querySelectorAll(`.rtr-profile-input[data-printer="${printer}"]`).forEach(input => {
        const field = input.dataset.field;
        if (field === 'materials') {
          input.value = prof.materials.join(', ');
        } else if (prof[field] !== undefined) {
          input.value = prof[field];
        }
      });
      document.querySelectorAll(`.rtr-profile-check[data-printer="${printer}"]`).forEach(input => {
        const field = input.dataset.field;
        if (prof[field] !== undefined) {
          input.checked = prof[field];
        }
      });
    });
  }

  function resetProfilesToDefaults() {
    syncFromGlobalProfiles();
    populateProfileInputs();
  }

  async function saveProfiles() {
    readProfileInputs();
    await window.storage.save('router-profiles.json', profileOverrides);
    if (window.notifications && typeof window.notifications.show === 'function') {
      window.notifications.show('Printer profiles saved', 'success');
    }
  }

  async function loadSavedProfiles() {
    try {
      const saved = await window.storage.load('router-profiles.json');
      if (saved && typeof saved === 'object') {
        Object.keys(saved).forEach(id => {
          if (profileOverrides[id]) {
            Object.assign(profileOverrides[id], saved[id]);
          }
        });
      }
    } catch (e) {
      // No saved profiles, use defaults
    }
    populateProfileInputs();
  }

  // ---- Utility ----

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // ---- Event Handlers ----

  // Analyze button / form submit
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      // Read latest profile edits
      readProfileInputs();

      // Fetch fresh data from storage
      try {
        cachedFilaments = await window.storage.getFilaments();
      } catch (err) {
        cachedFilaments = [];
      }
      try {
        cachedPrints = await window.storage.getPrints();
      } catch (err) {
        cachedPrints = [];
      }

      const job = getJobParams();

      // Basic validation
      if (!job.material) {
        alert('Please select a material.');
        return;
      }
      if (job.dimX <= 0 || job.dimY <= 0 || job.dimZ <= 0) {
        alert('Please enter valid model dimensions (X, Y, Z).');
        return;
      }

      // Run engine
      const result = runRecommendation(job);
      renderRecommendation(result);
    });
  }

  // Reset button
  if (btnReset) {
    btnReset.addEventListener('click', () => {
      if (form) form.reset();
      resultsArea.style.display = 'none';
      // Reset slider labels
      if (valSpeedQuality) valSpeedQuality.textContent = 'Balanced';
      if (valStrengthFinish) valStrengthFinish.textContent = 'Balanced';
    });
  }

  // Use recommended button
  document.getElementById('rtr-btn-use-recommended')?.addEventListener('click', () => {
    const printerEl = document.getElementById('rtr-rec-printer');
    const text = printerEl.textContent;
    let chosen = null;
    if (text.includes('Bambu')) chosen = 'bambu_a1';
    else if (text.includes('Kobra')) chosen = 'kobra_s1';
    else {
      // "Either" — default to bambu (button says "Use Bambu A1")
      chosen = 'bambu_a1';
    }
    if (chosen) logChoice(chosen, false);
  });

  // Override button
  document.getElementById('rtr-btn-override')?.addEventListener('click', () => {
    const printerEl = document.getElementById('rtr-rec-printer');
    const text = printerEl.textContent;
    let chosen = null;
    if (text.includes('Bambu')) chosen = 'kobra_s1';
    else if (text.includes('Kobra')) chosen = 'bambu_a1';
    else {
      // "Either" — override button says "Use Kobra S1"
      chosen = 'kobra_s1';
    }
    if (chosen) logChoice(chosen, true);
  });

  // Profile save / reset buttons
  document.getElementById('rtr-btn-save-profiles')?.addEventListener('click', () => {
    saveProfiles();
  });
  document.getElementById('rtr-btn-reset-profiles')?.addEventListener('click', () => {
    resetProfilesToDefaults();
  });

  // ---- Initialize ----

  syncFromGlobalProfiles();
  loadSavedProfiles();

})();
