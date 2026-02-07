// G-code Toolkit — Module Script
// Analyzes, modifies, and optimizes G-code files

(function () {
  'use strict';

  // ---- State ----

  let gcodeRawText = null;       // Original file text
  let gcodeFileName = null;      // Loaded filename
  let gcodeAnalysis = null;      // Parsed analysis result
  let layerPauses = [];          // [{layer, command, customGcode}]
  let injections = [];           // [{mode, number, gcode}]
  let templates = [];            // [{id, name, printer, purpose, gcode, notes, builtIn}]

  const TEMPLATES_KEY = 'gcode-templates';

  // ---- Pre-built Templates ----

  const BUILTIN_TEMPLATES = [
    {
      id: 'builtin-bambu-end',
      name: 'Bambu A1 — Standard End',
      printer: 'bambu_a1',
      purpose: 'end-gcode',
      builtIn: true,
      notes: 'Standard end G-code for Bambu Lab A1. Turns off heaters, retracts, and homes.',
      gcode: [
        '; Bambu A1 Standard End G-code',
        'M400 ; Wait for moves to finish',
        'M104 S0 ; Turn off nozzle heater',
        'M140 S0 ; Turn off bed heater',
        'G91 ; Relative positioning',
        'G1 E-2 F1800 ; Retract filament',
        'G1 Z5 F3000 ; Lift nozzle 5mm',
        'G90 ; Absolute positioning',
        'G28 X ; Home X axis',
        'M84 ; Disable steppers',
        'M107 ; Turn off fan'
      ].join('\n')
    },
    {
      id: 'builtin-bambu-cool-release',
      name: 'Bambu A1 — Cool & Release',
      printer: 'bambu_a1',
      purpose: 'auto-eject',
      builtIn: true,
      notes: 'Cools bed to 30C then lifts nozzle. Good for PLA on textured PEI.',
      gcode: [
        '; Bambu A1 Cool & Release End G-code',
        'M400 ; Wait for moves to finish',
        'M104 S0 ; Turn off nozzle heater',
        'M140 S30 ; Cool bed to 30C',
        'G91 ; Relative positioning',
        'G1 E-2 F1800 ; Retract filament',
        'G1 Z10 F3000 ; Lift nozzle 10mm',
        'G90 ; Absolute positioning',
        'G28 X ; Home X axis',
        'M190 S30 ; Wait for bed to reach 30C',
        'G4 S60 ; Wait 60 seconds for part release',
        'M140 S0 ; Turn off bed completely',
        'M84 ; Disable steppers',
        'M107 ; Turn off fan'
      ].join('\n')
    },
    {
      id: 'builtin-kobra-end',
      name: 'Kobra S1 — Standard End',
      printer: 'kobra_s1',
      purpose: 'end-gcode',
      builtIn: true,
      notes: 'Standard end G-code for Anycubic Kobra S1. Retracts, lifts, and presents the bed.',
      gcode: [
        '; Kobra S1 Standard End G-code',
        'M400 ; Wait for moves to finish',
        'M104 S0 ; Turn off nozzle heater',
        'M140 S0 ; Turn off bed heater',
        'G91 ; Relative positioning',
        'G1 E-3 F1800 ; Retract filament',
        'G1 Z10 F3000 ; Lift nozzle 10mm',
        'G90 ; Absolute positioning',
        'G1 X0 Y220 F6000 ; Present bed',
        'M84 ; Disable steppers',
        'M107 ; Turn off fan'
      ].join('\n')
    },
    {
      id: 'builtin-kobra-cool-release',
      name: 'Kobra S1 — Cool & Release',
      printer: 'kobra_s1',
      purpose: 'auto-eject',
      builtIn: true,
      notes: 'Cools bed to 30C, presents bed for easy part removal on spring steel PEI.',
      gcode: [
        '; Kobra S1 Cool & Release End G-code',
        'M400 ; Wait for moves to finish',
        'M104 S0 ; Turn off nozzle heater',
        'M140 S30 ; Cool bed to 30C',
        'G91 ; Relative positioning',
        'G1 E-3 F1800 ; Retract filament',
        'G1 Z10 F3000 ; Lift nozzle 10mm',
        'G90 ; Absolute positioning',
        'G1 X0 Y220 F6000 ; Present bed',
        'M190 S30 ; Wait for bed to reach 30C',
        'G4 S60 ; Wait 60 seconds',
        'M140 S0 ; Turn off bed completely',
        'M84 ; Disable steppers',
        'M107 ; Turn off fan'
      ].join('\n')
    }
  ];


  // ---- Initialization ----

  function init() {
    initTabs('#gcode-module');
    initDropZone();
    initPostProcessor();
    initTemplates();
  }


  // ---- Drop Zone & File Loading ----

  function initDropZone() {
    const dropZone = document.getElementById('gc-drop-zone');
    const openBtn = document.getElementById('gc-btn-open-file');
    const clearBtn = document.getElementById('gc-btn-clear-file');

    // Drag events
    dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.add('dragover');
    });

    dropZone.addEventListener('dragleave', (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.remove('dragover');
    });

    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.remove('dragover');

      const files = e.dataTransfer.files;
      if (files.length > 0) {
        handleDroppedFile(files[0]);
      }
    });

    // Click to open
    dropZone.addEventListener('click', () => {
      if (!gcodeRawText) {
        openFileDialog();
      }
    });

    // Open button in header
    openBtn.addEventListener('click', () => {
      openFileDialog();
    });

    // Clear button
    clearBtn.addEventListener('click', clearLoadedFile);
  }

  async function openFileDialog() {
    try {
      const filePath = await window.api.openFile({
        filters: [{ name: 'G-code Files', extensions: ['gcode', 'gco', 'g'] }]
      });
      if (filePath) {
        const content = await window.api.readFile(filePath);
        const name = filePath.split(/[/\\]/).pop();
        loadGcodeContent(content, name);
      }
    } catch (err) {
      console.error('Failed to open file:', err);
    }
  }

  async function handleDroppedFile(file) {
    if (!file.name.match(/\.(gcode|gco|g)$/i)) {
      return;
    }
    const text = await file.text();
    loadGcodeContent(text, file.name);
  }

  function loadGcodeContent(text, filename) {
    gcodeRawText = text;
    gcodeFileName = filename;
    gcodeAnalysis = window.gcodeParser.parse(text);

    // Reset modifications
    layerPauses = [];
    injections = [];

    renderAnalysis();
    updatePostProcessorState();
    updateFileBadge();
  }

  function clearLoadedFile() {
    gcodeRawText = null;
    gcodeFileName = null;
    gcodeAnalysis = null;
    layerPauses = [];
    injections = [];

    document.getElementById('gc-analysis-results').style.display = 'none';
    document.getElementById('gc-drop-zone').style.display = '';
    document.getElementById('gc-drop-zone').classList.remove('gc-has-file');
    document.getElementById('gc-file-badge').style.display = 'none';
    document.getElementById('gc-pause-list').innerHTML = '';
    document.getElementById('gc-injection-list').innerHTML = '';

    updatePostProcessorState();
  }

  function updateFileBadge() {
    const badge = document.getElementById('gc-file-badge');
    const badgeName = document.getElementById('gc-file-badge-name');
    if (gcodeFileName) {
      badge.style.display = '';
      badgeName.textContent = gcodeFileName;
    } else {
      badge.style.display = 'none';
    }
  }


  // ---- Analysis Rendering ----

  function renderAnalysis() {
    if (!gcodeAnalysis) return;

    const a = gcodeAnalysis;
    const dropZone = document.getElementById('gc-drop-zone');
    const results = document.getElementById('gc-analysis-results');

    // Hide drop zone, show results
    dropZone.style.display = 'none';
    results.style.display = '';

    // File summary
    document.getElementById('gc-summary-filename').textContent = gcodeFileName;
    const lineCount = gcodeRawText.split('\n').length;
    const fileSize = (new Blob([gcodeRawText]).size / 1024).toFixed(0);
    document.getElementById('gc-summary-meta').textContent =
      `${lineCount.toLocaleString()} lines | ${fileSize} KB | ${a.layerCount} layers`;

    // Stats
    document.getElementById('gc-stat-time').textContent =
      a.estimatedTime_min > 0 ? window.gcodeParser.formatTime(a.estimatedTime_min) : 'N/A';

    const filamentM = (a.filamentLength_mm / 1000).toFixed(2);
    document.getElementById('gc-stat-filament').textContent =
      a.filamentLength_mm > 0 ? `${filamentM}m (${a.filamentWeight_g}g)` : 'N/A';

    document.getElementById('gc-stat-layers').textContent =
      a.layerCount > 0 ? a.layerCount.toLocaleString() : 'N/A';

    document.getElementById('gc-stat-layer-height').textContent =
      a.layerHeight > 0 ? `${a.layerHeight}mm` : 'N/A';

    document.getElementById('gc-stat-dimensions').textContent =
      a.dimensions ? `${a.dimensions.x} x ${a.dimensions.y} x ${a.dimensions.z}` : 'N/A';

    document.getElementById('gc-stat-temps').textContent =
      `${a.nozzleTemp || '?'}°C / ${a.bedTemp || '?'}°C`;

    document.getElementById('gc-stat-speed').textContent =
      a.maxSpeed > 0 ? `${a.maxSpeed}` : 'N/A';

    document.getElementById('gc-stat-retractions').textContent =
      a.retractionCount.toLocaleString();

    const travelM = (a.travelDistance / 1000).toFixed(1);
    document.getElementById('gc-stat-travel').textContent =
      a.travelDistance > 0 ? `${travelM}m` : 'N/A';

    // Warnings
    renderWarnings(a.warnings);
  }

  function renderWarnings(warnings) {
    const area = document.getElementById('gc-warnings-area');
    const list = document.getElementById('gc-warnings-list');

    if (!warnings || warnings.length === 0) {
      area.style.display = 'none';
      return;
    }

    area.style.display = '';
    list.innerHTML = '';

    const icons = {
      error: '&#x26D4;',
      warning: '&#x26A0;',
      info: '&#x2139;'
    };

    warnings.forEach(w => {
      const card = document.createElement('div');
      card.className = `gc-warning-card gc-warn-${w.level}`;
      card.innerHTML = `
        <span class="gc-warning-icon">${icons[w.level] || icons.info}</span>
        <span class="gc-warning-text">${escapeHtml(w.message)}</span>
      `;
      list.appendChild(card);
    });
  }


  // ---- Post-Processor ----

  function initPostProcessor() {
    // Auto-eject toggle bodies
    setupEjectToggle('gc-eject-cool', 'gc-eject-cool-opts');
    setupEjectToggle('gc-eject-shake', 'gc-eject-shake-opts');
    setupEjectToggle('gc-eject-push', 'gc-eject-push-opts');

    // Pause command custom toggle
    document.getElementById('gc-pause-command').addEventListener('change', (e) => {
      document.getElementById('gc-pause-custom-group').style.display =
        e.target.value === 'custom' ? '' : 'none';
    });

    // Add pause button
    document.getElementById('gc-btn-add-pause').addEventListener('click', addLayerPause);

    // Speed slider
    const speedSlider = document.getElementById('gc-speed-slider');
    const speedTag = document.getElementById('gc-speed-value-tag');
    speedSlider.addEventListener('input', () => {
      speedTag.textContent = speedSlider.value + '%';
    });

    // Fan slider
    const fanSlider = document.getElementById('gc-fan-slider');
    const fanTag = document.getElementById('gc-fan-value-tag');
    fanSlider.addEventListener('input', () => {
      fanTag.textContent = fanSlider.value + '%';
    });

    // Add injection button
    document.getElementById('gc-btn-add-injection').addEventListener('click', addInjection);

    // Apply & Download
    document.getElementById('gc-btn-apply-download').addEventListener('click', applyAndDownload);
  }

  function setupEjectToggle(checkboxId, bodyId) {
    const checkbox = document.getElementById(checkboxId);
    const body = document.getElementById(bodyId);

    checkbox.addEventListener('change', () => {
      body.classList.toggle('active', checkbox.checked);
    });

    // Also allow clicking the header to toggle
    const header = checkbox.closest('.gc-pp-option-header');
    header.addEventListener('click', (e) => {
      if (e.target === header || e.target.tagName === 'SPAN') {
        checkbox.checked = !checkbox.checked;
        checkbox.dispatchEvent(new Event('change'));
      }
    });
  }

  function updatePostProcessorState() {
    const hasFile = !!gcodeRawText;
    document.getElementById('gc-pp-no-file').style.display = hasFile ? 'none' : '';
    document.getElementById('gc-pp-controls').style.display = hasFile ? '' : 'none';
    updateModSummary();
  }

  function addLayerPause() {
    const layerInput = document.getElementById('gc-pause-layer');
    const commandSelect = document.getElementById('gc-pause-command');
    const customGcode = document.getElementById('gc-pause-custom-gcode');

    const layer = parseInt(layerInput.value);
    if (!layer || layer < 1) return;

    const command = commandSelect.value;
    const pause = {
      layer,
      command: command === 'custom' ? 'custom' : command,
      customGcode: command === 'custom' ? customGcode.value.trim() : ''
    };

    layerPauses.push(pause);
    layerPauses.sort((a, b) => a.layer - b.layer);
    renderPauseList();
    updateModSummary();

    // Reset inputs
    layerInput.value = '';
    customGcode.value = '';
  }

  function renderPauseList() {
    const container = document.getElementById('gc-pause-list');
    container.innerHTML = '';

    layerPauses.forEach((p, idx) => {
      const item = document.createElement('div');
      item.className = 'gc-modifier-item';
      const displayCmd = p.command === 'custom' ? 'Custom' : p.command;
      item.innerHTML = `
        <div class="gc-modifier-item-info">
          <span class="tag tag-warning">Layer ${p.layer}</span>
          <span class="gc-modifier-item-text">${escapeHtml(displayCmd)}</span>
        </div>
        <button class="gc-modifier-item-remove" data-pause-idx="${idx}">&times;</button>
      `;
      container.appendChild(item);
    });

    container.querySelectorAll('.gc-modifier-item-remove').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.pauseIdx);
        layerPauses.splice(idx, 1);
        renderPauseList();
        updateModSummary();
      });
    });
  }

  function addInjection() {
    const modeSelect = document.getElementById('gc-inject-mode');
    const numberInput = document.getElementById('gc-inject-number');
    const gcodeInput = document.getElementById('gc-inject-gcode');

    const num = parseInt(numberInput.value);
    const gcode = gcodeInput.value.trim();
    if (!num || num < 1 || !gcode) return;

    injections.push({
      mode: modeSelect.value,
      number: num,
      gcode: gcode
    });

    renderInjectionList();
    updateModSummary();

    // Reset
    numberInput.value = '';
    gcodeInput.value = '';
  }

  function renderInjectionList() {
    const container = document.getElementById('gc-injection-list');
    container.innerHTML = '';

    injections.forEach((inj, idx) => {
      const item = document.createElement('div');
      item.className = 'gc-modifier-item';
      const label = inj.mode === 'layer' ? `Layer ${inj.number}` : `Line ${inj.number}`;
      const preview = inj.gcode.split('\n')[0].substring(0, 40);
      item.innerHTML = `
        <div class="gc-modifier-item-info">
          <span class="tag">${escapeHtml(label)}</span>
          <span class="gc-modifier-item-text">${escapeHtml(preview)}${inj.gcode.length > 40 ? '...' : ''}</span>
        </div>
        <button class="gc-modifier-item-remove" data-inject-idx="${idx}">&times;</button>
      `;
      container.appendChild(item);
    });

    container.querySelectorAll('.gc-modifier-item-remove').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.injectIdx);
        injections.splice(idx, 1);
        renderInjectionList();
        updateModSummary();
      });
    });
  }

  function updateModSummary() {
    const parts = [];

    if (document.getElementById('gc-eject-cool').checked) parts.push('Cool & Release');
    if (document.getElementById('gc-eject-shake').checked) parts.push('Bed Shake');
    if (document.getElementById('gc-eject-push').checked) parts.push('Push-Off');
    if (layerPauses.length > 0) parts.push(`${layerPauses.length} pause(s)`);

    const speedVal = parseInt(document.getElementById('gc-speed-slider').value);
    if (speedVal !== 100) parts.push(`Speed ${speedVal}%`);

    const nozzleOff = parseInt(document.getElementById('gc-temp-nozzle-offset').value) || 0;
    const bedOff = parseInt(document.getElementById('gc-temp-bed-offset').value) || 0;
    if (nozzleOff !== 0 || bedOff !== 0) parts.push('Temp tweak');

    const fanVal = parseInt(document.getElementById('gc-fan-slider').value);
    if (fanVal !== 100) parts.push(`Fan ${fanVal}%`);

    if (injections.length > 0) parts.push(`${injections.length} injection(s)`);

    const summary = document.getElementById('gc-pp-mod-summary');
    summary.textContent = parts.length > 0 ? parts.join(' + ') : 'No modifications configured';
  }


  // ---- G-code Modification Engine ----

  async function applyAndDownload() {
    if (!gcodeRawText) return;

    let lines = gcodeRawText.split('\n');

    // 1. Apply speed override
    lines = applySpeedOverride(lines);

    // 2. Apply temperature tweaks
    lines = applyTempTweak(lines);

    // 3. Apply fan control override
    lines = applyFanOverride(lines);

    // 4. Apply layer pauses (process from highest layer to lowest to avoid index shifts)
    lines = applyLayerPauses(lines);

    // 5. Apply custom injections (process from highest to lowest)
    lines = applyInjections(lines);

    // 6. Apply auto-eject sequences (appended at end)
    lines = applyAutoEject(lines);

    const modifiedText = lines.join('\n');

    // Save file
    try {
      const baseName = gcodeFileName.replace(/\.(gcode|gco|g)$/i, '');
      const ext = gcodeFileName.match(/\.(gcode|gco|g)$/i)?.[0] || '.gcode';
      const suggestedName = `${baseName}_modified${ext}`;

      const savePath = await window.api.saveFile({
        defaultPath: suggestedName,
        filters: [{ name: 'G-code Files', extensions: ['gcode', 'gco', 'g'] }]
      });

      if (savePath) {
        await window.api.writeFile(savePath, modifiedText);
      }
    } catch (err) {
      console.error('Failed to save modified G-code:', err);
    }
  }

  function applySpeedOverride(lines) {
    const pct = parseInt(document.getElementById('gc-speed-slider').value);
    if (pct === 100) return lines;

    const multiplier = pct / 100;

    return lines.map(line => {
      const stripped = line.split(';')[0].trim();
      if (!stripped) return line;

      const cmd = stripped.split(/\s+/)[0];
      if (cmd !== 'G0' && cmd !== 'G1') return line;

      // Find and modify F parameter
      return line.replace(/F([\d.]+)/g, (match, val) => {
        const newVal = Math.round(parseFloat(val) * multiplier);
        return `F${newVal}`;
      });
    });
  }

  function applyTempTweak(lines) {
    const nozzleOffset = parseInt(document.getElementById('gc-temp-nozzle-offset').value) || 0;
    const bedOffset = parseInt(document.getElementById('gc-temp-bed-offset').value) || 0;

    if (nozzleOffset === 0 && bedOffset === 0) return lines;

    return lines.map(line => {
      const stripped = line.split(';')[0].trim();
      if (!stripped) return line;

      const cmd = stripped.split(/\s+/)[0];

      // Nozzle temp commands
      if ((cmd === 'M104' || cmd === 'M109') && nozzleOffset !== 0) {
        return line.replace(/S([\d.]+)/, (match, val) => {
          const newTemp = Math.max(0, Math.round(parseFloat(val) + nozzleOffset));
          return `S${newTemp}`;
        });
      }

      // Bed temp commands
      if ((cmd === 'M140' || cmd === 'M190') && bedOffset !== 0) {
        return line.replace(/S([\d.]+)/, (match, val) => {
          const newTemp = Math.max(0, Math.round(parseFloat(val) + bedOffset));
          return `S${newTemp}`;
        });
      }

      return line;
    });
  }

  function applyFanOverride(lines) {
    const fanPct = parseInt(document.getElementById('gc-fan-slider').value);
    if (fanPct === 100) return lines;

    const scale = fanPct / 100;

    return lines.map(line => {
      const stripped = line.split(';')[0].trim();
      if (!stripped) return line;

      const cmd = stripped.split(/\s+/)[0];
      if (cmd !== 'M106') return line;

      return line.replace(/S([\d.]+)/, (match, val) => {
        const original = parseFloat(val);
        const newVal = Math.min(255, Math.max(0, Math.round(original * scale)));
        return `S${newVal}`;
      });
    });
  }

  function applyLayerPauses(lines) {
    if (layerPauses.length === 0) return lines;

    // Build a map of line indices where each layer starts
    const layerStartLines = findLayerStartLines(lines);

    // Sort pauses descending so insertion indices remain valid
    const sortedPauses = [...layerPauses].sort((a, b) => b.layer - a.layer);

    sortedPauses.forEach(pause => {
      const insertIdx = layerStartLines[pause.layer];
      if (insertIdx === undefined) return;

      const insertLines = [];
      insertLines.push(`; --- Layer Pause at Layer ${pause.layer} ---`);

      if (pause.command === 'custom' && pause.customGcode) {
        pause.customGcode.split('\n').forEach(l => insertLines.push(l));
      } else {
        insertLines.push(pause.command + ` ; Pause at layer ${pause.layer}`);
      }

      insertLines.push('; --- End Layer Pause ---');

      lines.splice(insertIdx, 0, ...insertLines);
    });

    return lines;
  }

  function applyInjections(lines) {
    if (injections.length === 0) return lines;

    // Separate layer injections and line injections
    const layerInjects = injections.filter(i => i.mode === 'layer');
    const lineInjects = injections.filter(i => i.mode === 'line');

    // Apply layer injections (descending order)
    if (layerInjects.length > 0) {
      const layerStartLines = findLayerStartLines(lines);
      const sorted = [...layerInjects].sort((a, b) => b.number - a.number);

      sorted.forEach(inj => {
        const insertIdx = layerStartLines[inj.number];
        if (insertIdx === undefined) return;

        const insertLines = [];
        insertLines.push(`; --- Custom Injection at Layer ${inj.number} ---`);
        inj.gcode.split('\n').forEach(l => insertLines.push(l));
        insertLines.push('; --- End Custom Injection ---');

        lines.splice(insertIdx, 0, ...insertLines);
      });
    }

    // Apply line injections (descending order)
    if (lineInjects.length > 0) {
      const sorted = [...lineInjects].sort((a, b) => b.number - a.number);

      sorted.forEach(inj => {
        const insertIdx = inj.number - 1; // Convert 1-based to 0-based
        if (insertIdx < 0 || insertIdx > lines.length) return;

        const insertLines = [];
        insertLines.push(`; --- Custom Injection at Line ${inj.number} ---`);
        inj.gcode.split('\n').forEach(l => insertLines.push(l));
        insertLines.push('; --- End Custom Injection ---');

        lines.splice(insertIdx, 0, ...insertLines);
      });
    }

    return lines;
  }

  function applyAutoEject(lines) {
    const printer = document.getElementById('gc-pp-printer').value;
    const isBambu = printer === 'bambu_a1';

    const coolEnabled = document.getElementById('gc-eject-cool').checked;
    const shakeEnabled = document.getElementById('gc-eject-shake').checked;
    const pushEnabled = document.getElementById('gc-eject-push').checked;

    if (!coolEnabled && !shakeEnabled && !pushEnabled) return lines;

    const ejectLines = [];
    ejectLines.push('');
    ejectLines.push('; ========== AUTO-EJECT SEQUENCE ==========');

    // Cool & Release
    if (coolEnabled) {
      const targetTemp = parseInt(document.getElementById('gc-cool-target-temp').value) || 30;
      const waitTime = parseInt(document.getElementById('gc-cool-wait-time').value) || 60;

      ejectLines.push('; --- Cool & Release ---');
      ejectLines.push('M104 S0 ; Turn off nozzle heater');
      ejectLines.push(`M140 S${targetTemp} ; Set bed to target cool temperature`);
      ejectLines.push('G91 ; Relative positioning');
      ejectLines.push('G1 E-2 F1800 ; Retract filament');
      ejectLines.push('G1 Z10 F3000 ; Lift nozzle away from print');
      ejectLines.push('G90 ; Absolute positioning');

      if (isBambu) {
        ejectLines.push('G28 X ; Home X axis');
      } else {
        ejectLines.push(`G1 X0 Y${isBambu ? 256 : 220} F6000 ; Move to front`);
      }

      ejectLines.push(`M190 S${targetTemp} ; Wait for bed to cool to ${targetTemp}C`);
      ejectLines.push(`G4 S${waitTime} ; Wait ${waitTime} seconds for part release`);
      ejectLines.push('M140 S0 ; Turn off bed completely');
    }

    // Bed Shake
    if (shakeEnabled) {
      const shakeD = parseFloat(document.getElementById('gc-shake-distance').value) || 2;
      const shakeF = parseInt(document.getElementById('gc-shake-speed').value) || 3000;
      const shakeReps = parseInt(document.getElementById('gc-shake-reps').value) || 10;

      ejectLines.push('; --- Bed Shake ---');

      // Ensure we are not too close to the bed
      if (!coolEnabled) {
        ejectLines.push('G91 ; Relative positioning');
        ejectLines.push('G1 Z5 F3000 ; Lift nozzle first');
      }

      ejectLines.push('G90 ; Absolute positioning');

      // Move to center of bed for balanced shaking
      const centerY = isBambu ? 128 : 110;
      ejectLines.push(`G1 Y${centerY} F6000 ; Move to bed center Y`);
      ejectLines.push('G91 ; Relative positioning');

      for (let i = 0; i < shakeReps; i++) {
        ejectLines.push(`G1 Y${shakeD} F${shakeF} ; Shake forward`);
        ejectLines.push(`G1 Y-${shakeD} F${shakeF} ; Shake backward`);
      }

      ejectLines.push('G90 ; Absolute positioning');
    }

    // Push-Off
    if (pushEnabled) {
      const pushDist = parseInt(document.getElementById('gc-push-distance').value) || 30;
      const pushSpeed = parseInt(document.getElementById('gc-push-speed').value) || 300;

      ejectLines.push('; --- Push-Off ---');

      // Lower nozzle to just above first layer height for pushing
      if (gcodeAnalysis) {
        const pushZ = Math.max(0.3, gcodeAnalysis.firstLayerHeight || 0.2);
        ejectLines.push('G90 ; Absolute positioning');
        ejectLines.push(`G1 Z${pushZ.toFixed(1)} F1000 ; Lower to push height`);

        // Move to the min-X side of the print (approach from the left)
        const approachX = Math.max(0, (gcodeAnalysis.minX || 10) - 10);
        const midY = gcodeAnalysis.dimensions
          ? ((gcodeAnalysis.minY || 0) + gcodeAnalysis.dimensions.y / 2).toFixed(1)
          : '110';

        ejectLines.push(`G1 X${approachX} Y${midY} F3000 ; Move to part edge`);
        ejectLines.push(`G1 X${approachX + pushDist} F${pushSpeed} ; Push part off bed`);
      } else {
        ejectLines.push('G90 ; Absolute positioning');
        ejectLines.push('G1 Z0.3 F1000 ; Lower to push height');
        ejectLines.push(`G1 X10 Y110 F3000 ; Move to starting position`);
        ejectLines.push(`G1 X${10 + pushDist} F${pushSpeed} ; Push part`);
      }

      // Lift after push
      ejectLines.push('G91 ; Relative positioning');
      ejectLines.push('G1 Z20 F3000 ; Lift nozzle after push');
      ejectLines.push('G90 ; Absolute positioning');
    }

    // Final cleanup
    ejectLines.push('; --- Cleanup ---');
    if (!coolEnabled) {
      ejectLines.push('M104 S0 ; Turn off nozzle');
      ejectLines.push('M140 S0 ; Turn off bed');
    }
    ejectLines.push('M107 ; Turn off fan');
    ejectLines.push('M84 ; Disable steppers');
    ejectLines.push('; ========== END AUTO-EJECT SEQUENCE ==========');

    return [...lines, ...ejectLines];
  }

  /**
   * Build a map of layer number -> line index where that layer starts.
   * Detects layer changes by Z-height changes in G0/G1 moves.
   */
  function findLayerStartLines(lines) {
    const map = {};
    let currentZ = -1;
    let layerNum = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // Check for slicer layer comments (common patterns)
      const layerComment = line.match(/^;\s*(?:LAYER|layer)[:\s_]+(\d+)/i);
      if (layerComment) {
        const num = parseInt(layerComment[1]);
        if (map[num] === undefined) {
          map[num] = i;
        }
        continue;
      }

      // Fall back to Z-height detection
      if (!line || line.startsWith(';')) continue;

      const cmd = line.split(';')[0].trim();
      if (!cmd) continue;

      const parts = cmd.split(/\s+/);
      const code = parts[0];

      if (code === 'G0' || code === 'G1') {
        const zMatch = cmd.match(/Z([\d.]+)/);
        if (zMatch) {
          const z = parseFloat(zMatch[1]);
          if (z > currentZ) {
            currentZ = z;
            layerNum++;
            if (map[layerNum] === undefined) {
              map[layerNum] = i;
            }
          }
        }
      }
    }

    return map;
  }


  // ---- Templates ----

  async function initTemplates() {
    await loadTemplates();
    renderTemplateList();

    document.getElementById('gc-btn-new-template').addEventListener('click', () => {
      openTemplateModal(null);
    });

    document.getElementById('gc-tpl-modal-close').addEventListener('click', () => {
      closeModal('gc-template-modal');
    });

    document.getElementById('gc-tpl-modal-cancel').addEventListener('click', () => {
      closeModal('gc-template-modal');
    });

    document.getElementById('gc-tpl-modal-save').addEventListener('click', saveTemplate);

    document.getElementById('gc-tpl-modal-delete').addEventListener('click', deleteTemplate);
  }

  async function loadTemplates() {
    try {
      const stored = await window.storage.load(TEMPLATES_KEY + '.json');
      templates = stored || [];
    } catch (e) {
      templates = [];
    }

    // Ensure built-in templates exist
    BUILTIN_TEMPLATES.forEach(bt => {
      if (!templates.find(t => t.id === bt.id)) {
        templates.push({ ...bt });
      }
    });

    await persistTemplates();
  }

  async function persistTemplates() {
    try {
      await window.storage.save(TEMPLATES_KEY + '.json', templates);
    } catch (e) {
      console.error('Failed to save templates:', e);
    }
  }

  function renderTemplateList() {
    const container = document.getElementById('gc-template-list');
    const emptyState = document.getElementById('gc-template-empty');

    if (templates.length === 0) {
      container.innerHTML = '';
      emptyState.style.display = '';
      return;
    }

    emptyState.style.display = 'none';
    container.innerHTML = '';

    const printerNames = {
      bambu_a1: 'Bambu A1',
      kobra_s1: 'Kobra S1',
      generic: 'Generic'
    };

    const purposeLabels = {
      'end-gcode': 'End G-code',
      'start-gcode': 'Start G-code',
      'pause-gcode': 'Pause G-code',
      'filament-change': 'Filament Change',
      'auto-eject': 'Auto-Eject',
      'custom': 'Custom'
    };

    templates.forEach(tpl => {
      const card = document.createElement('div');
      card.className = 'gc-template-card';

      const printerLabel = printerNames[tpl.printer] || tpl.printer;
      const purposeLabel = purposeLabels[tpl.purpose] || tpl.purpose;
      const previewLines = (tpl.gcode || '').split('\n').slice(0, 8).join('\n');
      const builtInTag = tpl.builtIn ? '<span class="tag tag-success">Built-in</span>' : '';

      card.innerHTML = `
        <div class="gc-template-card-header">
          <div>
            <div class="gc-template-card-title">${escapeHtml(tpl.name)}</div>
            <div class="gc-template-card-meta">
              <span class="tag">${escapeHtml(printerLabel)}</span>
              <span class="tag tag-warning">${escapeHtml(purposeLabel)}</span>
              ${builtInTag}
            </div>
          </div>
          <div class="gc-template-card-actions">
            <button class="btn btn-sm btn-secondary gc-tpl-copy-btn" data-tpl-id="${tpl.id}" title="Copy to clipboard">Copy</button>
            <button class="btn btn-sm btn-secondary gc-tpl-edit-btn" data-tpl-id="${tpl.id}">Edit</button>
          </div>
        </div>
        <div class="gc-template-card-preview">${escapeHtml(previewLines)}${(tpl.gcode || '').split('\n').length > 8 ? '\n...' : ''}</div>
        ${tpl.notes ? `<div class="gc-template-card-notes">${escapeHtml(tpl.notes)}</div>` : ''}
      `;

      container.appendChild(card);
    });

    // Edit buttons
    container.querySelectorAll('.gc-tpl-edit-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const tpl = templates.find(t => t.id === btn.dataset.tplId);
        if (tpl) openTemplateModal(tpl);
      });
    });

    // Copy buttons
    container.querySelectorAll('.gc-tpl-copy-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const tpl = templates.find(t => t.id === btn.dataset.tplId);
        if (tpl && tpl.gcode) {
          navigator.clipboard.writeText(tpl.gcode).then(() => {
            btn.textContent = 'Copied!';
            setTimeout(() => { btn.textContent = 'Copy'; }, 1500);
          });
        }
      });
    });
  }

  function openTemplateModal(tpl) {
    const isEdit = !!tpl;
    document.getElementById('gc-tpl-modal-title').textContent = isEdit ? 'Edit Template' : 'New Template';
    document.getElementById('gc-tpl-modal-delete').style.display = (isEdit && !tpl.builtIn) ? '' : 'none';

    document.getElementById('gc-tpl-form-id').value = isEdit ? tpl.id : '';
    document.getElementById('gc-tpl-form-name').value = isEdit ? tpl.name : '';
    document.getElementById('gc-tpl-form-printer').value = isEdit ? tpl.printer : '';
    document.getElementById('gc-tpl-form-purpose').value = isEdit ? (tpl.purpose || 'end-gcode') : 'end-gcode';
    document.getElementById('gc-tpl-form-gcode').value = isEdit ? tpl.gcode : '';
    document.getElementById('gc-tpl-form-notes').value = isEdit ? (tpl.notes || '') : '';

    openModal('gc-template-modal');
  }

  async function saveTemplate() {
    const id = document.getElementById('gc-tpl-form-id').value;
    const name = document.getElementById('gc-tpl-form-name').value.trim();
    const printer = document.getElementById('gc-tpl-form-printer').value;
    const purpose = document.getElementById('gc-tpl-form-purpose').value;
    const gcode = document.getElementById('gc-tpl-form-gcode').value;
    const notes = document.getElementById('gc-tpl-form-notes').value.trim();

    if (!name || !printer || !gcode) return;

    if (id) {
      // Update existing
      const idx = templates.findIndex(t => t.id === id);
      if (idx !== -1) {
        templates[idx].name = name;
        templates[idx].printer = printer;
        templates[idx].purpose = purpose;
        templates[idx].gcode = gcode;
        templates[idx].notes = notes;
      }
    } else {
      // Create new
      templates.push({
        id: generateId(),
        name,
        printer,
        purpose,
        gcode,
        notes,
        builtIn: false
      });
    }

    await persistTemplates();
    renderTemplateList();
    closeModal('gc-template-modal');
  }

  async function deleteTemplate() {
    const id = document.getElementById('gc-tpl-form-id').value;
    if (!id) return;

    templates = templates.filter(t => t.id !== id);
    await persistTemplates();
    renderTemplateList();
    closeModal('gc-template-modal');
  }


  // ---- Utility ----

  function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }


  // ---- Boot ----

  init();

})();
