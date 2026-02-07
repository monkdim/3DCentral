// Analytics & Insights Module
// Loads print/filament data and computes statistics, renders charts, detects milestones

(function () {
  'use strict';

  // ---- Color palette for charts ----
  const COLORS = [
    '#4facfe', '#4ecdc4', '#f9a825', '#e74c6f',
    '#9c6ade', '#e67e73', '#5bc0be', '#f4a261',
    '#6a9fdb', '#80cbc4', '#ffb74d', '#ef5350'
  ];

  const PRINTER_NAMES = {
    bambu_a1: 'Bambu Lab A1',
    kobra_s1: 'Kobra S1 Combo'
  };

  const FAILURE_LABELS = {
    adhesion: 'Adhesion Failure',
    stringing: 'Stringing',
    layer_shift: 'Layer Shift',
    spaghetti: 'Spaghetti',
    clog: 'Nozzle Clog',
    warping: 'Warping',
    other: 'Other'
  };

  const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  let allPrints = [];
  let allFilaments = [];
  let filteredPrints = [];

  // ---- Initialization ----

  async function init() {
    await loadData();
    initTabs('#analytics-module');
    initControls();
    render();
  }

  async function loadData() {
    try {
      allPrints = (await window.storage.getPrints()) || [];
      allFilaments = (await window.storage.getFilaments()) || [];
    } catch (e) {
      console.error('Analytics: failed to load data', e);
      allPrints = [];
      allFilaments = [];
    }
    applyTimeFilter();
  }

  function initControls() {
    const rangeSelect = document.getElementById('ana-time-range');
    if (rangeSelect) {
      rangeSelect.addEventListener('change', () => {
        applyTimeFilter();
        render();
      });
    }
    const refreshBtn = document.getElementById('ana-btn-refresh');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', async () => {
        await loadData();
        render();
      });
    }
  }

  function applyTimeFilter() {
    const rangeSelect = document.getElementById('ana-time-range');
    const range = rangeSelect ? rangeSelect.value : 'all';
    if (range === 'all') {
      filteredPrints = allPrints.slice();
    } else {
      const now = new Date();
      let cutoff;
      switch (range) {
        case '7d':  cutoff = new Date(now - 7 * 86400000); break;
        case '30d': cutoff = new Date(now - 30 * 86400000); break;
        case '90d': cutoff = new Date(now - 90 * 86400000); break;
        case '6m':  cutoff = new Date(now - 182 * 86400000); break;
        case '1y':  cutoff = new Date(now - 365 * 86400000); break;
        default:    cutoff = new Date(0);
      }
      filteredPrints = allPrints.filter(p => new Date(p.date) >= cutoff);
    }
  }

  // ---- Main render ----

  function render() {
    const emptyState = document.getElementById('ana-empty-state');
    const tabBar = document.getElementById('ana-tab-bar');

    if (allPrints.length === 0) {
      if (emptyState) emptyState.style.display = '';
      if (tabBar) tabBar.style.display = 'none';
      document.querySelectorAll('#analytics-module .tab-panel').forEach(p => p.style.display = 'none');
      return;
    }

    if (emptyState) emptyState.style.display = 'none';
    if (tabBar) tabBar.style.display = '';

    renderOverview();
    renderFailures();
    renderCosts();
    renderProgress();
  }


  // =====================
  // OVERVIEW TAB
  // =====================

  function renderOverview() {
    const prints = filteredPrints;
    const total = prints.length;
    const success = prints.filter(p => p.status === 'success').length;
    const failed = prints.filter(p => p.status === 'failed').length;
    const cancelled = prints.filter(p => p.status === 'cancelled').length;
    const successRate = total > 0 ? (success / total * 100) : 0;
    const totalMinutes = prints.reduce((s, p) => s + (p.printTime_min || 0), 0);
    const totalFilament = prints.reduce((s, p) => s + (p.filamentUsed_g || 0), 0);
    const avgMinutes = total > 0 ? totalMinutes / total : 0;

    setText('ana-stat-total-prints', total);
    setText('ana-stat-success-rate', successRate.toFixed(1) + '%');
    setText('ana-stat-total-hours', formatHours(totalMinutes));
    setText('ana-stat-total-filament', formatGrams(totalFilament));
    setText('ana-stat-success-count', success);
    setText('ana-stat-fail-count', failed);
    setText('ana-stat-cancel-count', cancelled);
    setText('ana-stat-avg-time', formatDuration(avgMinutes));

    renderPrintsTimeline(prints);
    renderSuccessTrend(prints);
    renderMaterialPie(prints);
    renderPrinterComparison(prints);
    renderPrinterBreakdownTable(prints);
    renderMaterialBreakdownTable(prints);
  }

  function renderPrintsTimeline(prints) {
    const monthly = groupByMonth(prints);
    const months = Object.keys(monthly).sort();
    if (months.length === 0) {
      setHTML('chart-prints-timeline', emptyChartHTML('No prints to chart'));
      return;
    }

    const data = months.map(m => {
      const items = monthly[m];
      return {
        label: formatMonthLabel(m),
        success: items.filter(p => p.status === 'success').length,
        failed: items.filter(p => p.status === 'failed').length,
        cancelled: items.filter(p => p.status === 'cancelled').length
      };
    });
    const maxVal = Math.max(...data.map(d => d.success + d.failed + d.cancelled), 1);

    let html = '<div class="ana-vbar-chart">';
    data.forEach(d => {
      const total = d.success + d.failed + d.cancelled;
      const sH = (d.success / maxVal * 100);
      const fH = (d.failed / maxVal * 100);
      const cH = (d.cancelled / maxVal * 100);
      html += `<div class="ana-vbar-col">
        <div class="ana-vbar-bar-group">
          <div class="ana-vbar-bar ana-bar-success" style="height:${sH}%" title="${d.success} success"></div>
          <div class="ana-vbar-bar ana-bar-fail" style="height:${fH}%" title="${d.failed} failed"></div>
          <div class="ana-vbar-bar ana-bar-cancel" style="height:${cH}%" title="${d.cancelled} cancelled"></div>
        </div>
        <div class="ana-vbar-label">${d.label}</div>
      </div>`;
    });
    html += '</div>';
    html += '<div style="display:flex;gap:16px;justify-content:center;margin-top:10px;">';
    html += '<span class="text-sm" style="display:flex;align-items:center;gap:4px;"><span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:var(--success);"></span> Success</span>';
    html += '<span class="text-sm" style="display:flex;align-items:center;gap:4px;"><span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:var(--danger);"></span> Failed</span>';
    html += '<span class="text-sm" style="display:flex;align-items:center;gap:4px;"><span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:var(--warning);"></span> Cancelled</span>';
    html += '</div>';
    setHTML('chart-prints-timeline', html);
  }

  function renderSuccessTrend(prints) {
    const monthly = groupByMonth(prints);
    const months = Object.keys(monthly).sort();
    if (months.length === 0) {
      setHTML('chart-success-trend', emptyChartHTML('No data'));
      return;
    }

    const data = months.map(m => {
      const items = monthly[m];
      const total = items.length;
      const success = items.filter(p => p.status === 'success').length;
      return {
        label: formatMonthLabel(m),
        rate: total > 0 ? (success / total * 100) : 0,
        total
      };
    });

    let html = '<div class="ana-vbar-chart">';
    data.forEach(d => {
      const h = d.rate;
      const color = d.rate >= 80 ? 'var(--success)' : d.rate >= 60 ? 'var(--warning)' : 'var(--danger)';
      html += `<div class="ana-vbar-col">
        <div class="ana-vbar-bar-group">
          <div class="ana-vbar-bar" style="height:${h}%; background:${color};" title="${d.rate.toFixed(1)}% (${d.total} prints)"></div>
        </div>
        <div class="ana-vbar-label">${d.label}</div>
      </div>`;
    });
    html += '</div>';
    setHTML('chart-success-trend', html);
  }

  function renderMaterialPie(prints) {
    const matCounts = {};
    prints.forEach(p => {
      const mats = extractMaterials(p);
      mats.forEach(m => { matCounts[m] = (matCounts[m] || 0) + 1; });
    });

    const entries = Object.entries(matCounts).sort((a, b) => b[1] - a[1]);
    if (entries.length === 0) {
      setHTML('chart-material-pie', emptyChartHTML('No material data'));
      return;
    }

    const total = entries.reduce((s, e) => s + e[1], 0);
    setHTML('chart-material-pie', buildPieChart(entries, total, 'prints'));
  }

  function renderPrinterComparison(prints) {
    const printers = {};
    prints.forEach(p => {
      const name = p.printer || 'Unknown';
      if (!printers[name]) printers[name] = { total: 0, success: 0 };
      printers[name].total++;
      if (p.status === 'success') printers[name].success++;
    });

    const entries = Object.entries(printers).sort((a, b) => b[1].total - a[1].total);
    if (entries.length === 0) {
      setHTML('chart-printer-comparison', emptyChartHTML('No printer data'));
      return;
    }

    const maxTotal = Math.max(...entries.map(e => e[1].total), 1);
    let html = '<div class="ana-bar-chart">';
    entries.forEach(([name, data], i) => {
      const pct = (data.total / maxTotal * 100);
      const rate = data.total > 0 ? (data.success / data.total * 100).toFixed(1) : 0;
      html += `<div class="ana-bar-row">
        <div class="ana-bar-label">${PRINTER_NAMES[name] || name}</div>
        <div class="ana-bar-track">
          <div class="ana-bar-fill" style="width:${pct}%; background:${COLORS[i % COLORS.length]};"></div>
        </div>
        <div class="ana-bar-value">${data.total} <span class="text-sm text-muted">(${rate}%)</span></div>
      </div>`;
    });
    html += '</div>';
    setHTML('chart-printer-comparison', html);
  }

  function renderPrinterBreakdownTable(prints) {
    const printers = {};
    prints.forEach(p => {
      const name = p.printer || 'Unknown';
      if (!printers[name]) printers[name] = { total: 0, success: 0, failed: 0, cancelled: 0, minutes: 0, filament: 0 };
      const d = printers[name];
      d.total++;
      if (p.status === 'success') d.success++;
      else if (p.status === 'failed') d.failed++;
      else if (p.status === 'cancelled') d.cancelled++;
      d.minutes += (p.printTime_min || 0);
      d.filament += (p.filamentUsed_g || 0);
    });

    const tbody = document.getElementById('ana-breakdown-printer-tbody');
    if (!tbody) return;
    tbody.innerHTML = Object.entries(printers).sort((a, b) => b[1].total - a[1].total).map(([name, d]) => {
      const rate = d.total > 0 ? (d.success / d.total * 100).toFixed(1) : '0.0';
      return `<tr>
        <td>${PRINTER_NAMES[name] || name}</td>
        <td>${d.total}</td>
        <td class="text-success">${d.success}</td>
        <td class="text-danger">${d.failed}</td>
        <td class="text-warning">${d.cancelled}</td>
        <td>${rateTag(parseFloat(rate))}</td>
        <td>${formatHours(d.minutes)}</td>
        <td>${formatGrams(d.filament)}</td>
      </tr>`;
    }).join('');
  }

  function renderMaterialBreakdownTable(prints) {
    const mats = {};
    prints.forEach(p => {
      const materials = extractMaterials(p);
      materials.forEach(m => {
        if (!mats[m]) mats[m] = { total: 0, success: 0, failed: 0, minutes: 0, filament: 0 };
        const d = mats[m];
        d.total++;
        if (p.status === 'success') d.success++;
        else if (p.status === 'failed') d.failed++;
        d.minutes += (p.printTime_min || 0);
        d.filament += (p.filamentUsed_g || 0);
      });
    });

    const tbody = document.getElementById('ana-breakdown-material-tbody');
    if (!tbody) return;
    tbody.innerHTML = Object.entries(mats).sort((a, b) => b[1].total - a[1].total).map(([name, d]) => {
      const rate = d.total > 0 ? (d.success / d.total * 100).toFixed(1) : '0.0';
      const avgMin = d.total > 0 ? d.minutes / d.total : 0;
      return `<tr>
        <td><span class="tag">${name}</span></td>
        <td>${d.total}</td>
        <td class="text-success">${d.success}</td>
        <td class="text-danger">${d.failed}</td>
        <td>${rateTag(parseFloat(rate))}</td>
        <td>${formatDuration(avgMin)}</td>
        <td>${formatGrams(d.filament)}</td>
      </tr>`;
    }).join('');
  }


  // =====================
  // FAILURES TAB
  // =====================

  function renderFailures() {
    const prints = filteredPrints;
    const failed = prints.filter(p => p.status === 'failed');
    const total = prints.length;
    const failRate = total > 0 ? (failed.length / total * 100) : 0;
    const wastedMinutes = failed.reduce((s, p) => s + (p.printTime_min || 0), 0);
    const wastedFilament = failed.reduce((s, p) => s + (p.filamentUsed_g || 0), 0);

    setText('ana-fail-total', failed.length);
    setText('ana-fail-rate', failRate.toFixed(1) + '%');
    setText('ana-fail-wasted-hours', formatHours(wastedMinutes));
    setText('ana-fail-wasted-filament', formatGrams(wastedFilament));

    renderFailureReasonsChart(failed);
    renderFailureReasonsList(failed);
    renderFailureCorrelations(prints, failed);
    renderFailByPrinter(prints);
    renderFailByMaterialTable(prints);
  }

  function renderFailureReasonsChart(failed) {
    const reasons = {};
    failed.forEach(p => {
      const r = p.failureReason || 'unknown';
      reasons[r] = (reasons[r] || 0) + 1;
    });

    const entries = Object.entries(reasons).sort((a, b) => b[1] - a[1]);
    if (entries.length === 0) {
      setHTML('chart-failure-reasons', emptyChartHTML('No failures recorded'));
      return;
    }

    const maxVal = entries[0][1];
    let html = '<div class="ana-bar-chart">';
    entries.forEach(([reason, count], i) => {
      const pct = (count / maxVal * 100);
      html += `<div class="ana-bar-row">
        <div class="ana-bar-label">${FAILURE_LABELS[reason] || reason}</div>
        <div class="ana-bar-track">
          <div class="ana-bar-fill" style="width:${pct}%; background:${COLORS[i % COLORS.length]};"></div>
        </div>
        <div class="ana-bar-value">${count}</div>
      </div>`;
    });
    html += '</div>';
    setHTML('chart-failure-reasons', html);
  }

  function renderFailureReasonsList(failed) {
    const reasons = {};
    failed.forEach(p => {
      const r = p.failureReason || 'unknown';
      reasons[r] = (reasons[r] || 0) + 1;
    });

    const entries = Object.entries(reasons).sort((a, b) => b[1] - a[1]);
    const container = document.getElementById('ana-failure-reasons-list');
    if (!container) return;

    if (entries.length === 0) {
      container.innerHTML = '<div class="text-muted text-sm" style="padding:16px;text-align:center;">No failures recorded yet.</div>';
      return;
    }

    const totalFail = failed.length;
    container.innerHTML = entries.map(([reason, count], i) => {
      const pct = (count / totalFail * 100).toFixed(1);
      return `<div class="ana-ranked-item">
        <div class="ana-rank-number">${i + 1}</div>
        <div class="ana-rank-info">
          <div class="ana-rank-name">${FAILURE_LABELS[reason] || reason}</div>
          <div class="ana-rank-detail">${pct}% of all failures</div>
        </div>
        <div class="ana-rank-bar">
          <div class="progress-bar"><div class="progress-fill" style="width:${pct}%;background:var(--danger);"></div></div>
        </div>
        <div class="ana-rank-value">${count}</div>
      </div>`;
    }).join('');
  }

  function renderFailureCorrelations(allPrintsInRange, failed) {
    const container = document.getElementById('ana-failure-correlations');
    const emptyEl = document.getElementById('ana-failure-correlations-empty');
    if (!container) return;

    const insights = [];

    // 1. Material + printer combos with higher failure rates
    const combos = {};
    allPrintsInRange.forEach(p => {
      const mats = extractMaterials(p);
      mats.forEach(m => {
        const key = `${m}|${p.printer || 'unknown'}`;
        if (!combos[key]) combos[key] = { total: 0, failed: 0, material: m, printer: p.printer };
        combos[key].total++;
        if (p.status === 'failed') combos[key].failed++;
      });
    });

    const overallFailRate = allPrintsInRange.length > 0
      ? allPrintsInRange.filter(p => p.status === 'failed').length / allPrintsInRange.length
      : 0;

    Object.entries(combos).forEach(([key, data]) => {
      if (data.total >= 3) {
        const comboRate = data.failed / data.total;
        if (comboRate > overallFailRate + 0.15 && comboRate > 0.2) {
          insights.push({
            type: 'danger',
            title: `${data.material} on ${PRINTER_NAMES[data.printer] || data.printer}`,
            detail: `${data.failed}/${data.total} prints failed (${(comboRate * 100).toFixed(0)}% failure rate) — significantly above your average of ${(overallFailRate * 100).toFixed(0)}%.`,
            stat: `${(comboRate * 100).toFixed(0)}% fail rate`
          });
        }
      }
    });

    // 2. Temperature ranges that correlate with failures
    const tempBuckets = { low: { total: 0, failed: 0 }, mid: { total: 0, failed: 0 }, high: { total: 0, failed: 0 } };
    allPrintsInRange.forEach(p => {
      if (!p.nozzleTemp) return;
      const bucket = p.nozzleTemp < 200 ? 'low' : p.nozzleTemp > 230 ? 'high' : 'mid';
      tempBuckets[bucket].total++;
      if (p.status === 'failed') tempBuckets[bucket].failed++;
    });

    const tempLabels = { low: 'Low nozzle temp (<200C)', mid: 'Mid nozzle temp (200-230C)', high: 'High nozzle temp (>230C)' };
    Object.entries(tempBuckets).forEach(([bucket, data]) => {
      if (data.total >= 3) {
        const rate = data.failed / data.total;
        if (rate > overallFailRate + 0.15 && rate > 0.2) {
          insights.push({
            type: 'warning',
            title: tempLabels[bucket],
            detail: `${data.failed}/${data.total} prints failed at this temperature range (${(rate * 100).toFixed(0)}%).`,
            stat: `${(rate * 100).toFixed(0)}% fail rate`
          });
        }
      }
    });

    // 3. Speed correlation
    const speedBuckets = { slow: { total: 0, failed: 0 }, normal: { total: 0, failed: 0 }, fast: { total: 0, failed: 0 } };
    allPrintsInRange.forEach(p => {
      if (!p.speed) return;
      const bucket = p.speed < 100 ? 'slow' : p.speed > 300 ? 'fast' : 'normal';
      speedBuckets[bucket].total++;
      if (p.status === 'failed') speedBuckets[bucket].failed++;
    });

    const speedLabels = { slow: 'Slow speed (<100mm/s)', normal: 'Normal speed (100-300mm/s)', fast: 'Fast speed (>300mm/s)' };
    Object.entries(speedBuckets).forEach(([bucket, data]) => {
      if (data.total >= 3) {
        const rate = data.failed / data.total;
        if (rate > overallFailRate + 0.15 && rate > 0.2) {
          insights.push({
            type: 'warning',
            title: speedLabels[bucket],
            detail: `${data.failed}/${data.total} prints failed at this speed range (${(rate * 100).toFixed(0)}%).`,
            stat: `${(rate * 100).toFixed(0)}% fail rate`
          });
        }
      }
    });

    // 4. Support type correlation
    const supportStats = {};
    allPrintsInRange.forEach(p => {
      const sType = p.supportType || 'none';
      if (!supportStats[sType]) supportStats[sType] = { total: 0, failed: 0 };
      supportStats[sType].total++;
      if (p.status === 'failed') supportStats[sType].failed++;
    });

    Object.entries(supportStats).forEach(([sType, data]) => {
      if (data.total >= 3 && sType !== 'none') {
        const rate = data.failed / data.total;
        if (rate > overallFailRate + 0.15 && rate > 0.2) {
          insights.push({
            type: 'info',
            title: `Prints with ${sType} supports`,
            detail: `${data.failed}/${data.total} failed (${(rate * 100).toFixed(0)}%) — check if support settings need tuning.`,
            stat: `${(rate * 100).toFixed(0)}% fail rate`
          });
        }
      }
    });

    // 5. Layer height correlation
    const layerStats = {};
    allPrintsInRange.forEach(p => {
      if (!p.layerHeight) return;
      const lh = p.layerHeight <= 0.12 ? 'fine' : p.layerHeight >= 0.28 ? 'coarse' : 'standard';
      if (!layerStats[lh]) layerStats[lh] = { total: 0, failed: 0 };
      layerStats[lh].total++;
      if (p.status === 'failed') layerStats[lh].failed++;
    });

    const layerLabels = { fine: 'Fine layers (<=0.12mm)', standard: 'Standard layers (0.12-0.28mm)', coarse: 'Coarse layers (>=0.28mm)' };
    Object.entries(layerStats).forEach(([lh, data]) => {
      if (data.total >= 3) {
        const rate = data.failed / data.total;
        if (rate > overallFailRate + 0.15 && rate > 0.2) {
          insights.push({
            type: 'warning',
            title: layerLabels[lh],
            detail: `${data.failed}/${data.total} prints failed with this layer height (${(rate * 100).toFixed(0)}%).`,
            stat: `${(rate * 100).toFixed(0)}% fail rate`
          });
        }
      }
    });

    if (insights.length === 0) {
      container.innerHTML = '';
      if (emptyEl) emptyEl.style.display = '';
    } else {
      if (emptyEl) emptyEl.style.display = 'none';
      container.innerHTML = insights.map(ins => {
        const cls = ins.type === 'danger' ? '' : ins.type === 'warning' ? ' ana-insight-warning' : ' ana-insight-info';
        return `<div class="ana-insight-card${cls}">
          <div class="ana-insight-title">${ins.title}</div>
          <div class="ana-insight-detail">${ins.detail}</div>
          <div class="ana-insight-stat">${ins.stat}</div>
        </div>`;
      }).join('');
    }
  }

  function renderFailByPrinter(prints) {
    const printers = {};
    prints.forEach(p => {
      const name = p.printer || 'Unknown';
      if (!printers[name]) printers[name] = { total: 0, failed: 0 };
      printers[name].total++;
      if (p.status === 'failed') printers[name].failed++;
    });

    const entries = Object.entries(printers).filter(e => e[1].total > 0);
    if (entries.length === 0) {
      setHTML('chart-fail-by-printer', emptyChartHTML('No printer data'));
      return;
    }

    let html = '<div class="ana-bar-chart">';
    entries.forEach(([name, data], i) => {
      const rate = (data.failed / data.total * 100);
      const color = rate > 30 ? 'var(--danger)' : rate > 15 ? 'var(--warning)' : 'var(--success)';
      html += `<div class="ana-bar-row">
        <div class="ana-bar-label">${PRINTER_NAMES[name] || name}</div>
        <div class="ana-bar-track">
          <div class="ana-bar-fill" style="width:${rate}%; background:${color};"></div>
        </div>
        <div class="ana-bar-value">${rate.toFixed(1)}%</div>
      </div>`;
    });
    html += '</div>';
    html += '<div class="text-sm text-muted" style="text-align:center;margin-top:8px;">Failure rate percentage</div>';
    setHTML('chart-fail-by-printer', html);
  }

  function renderFailByMaterialTable(prints) {
    const mats = {};
    prints.forEach(p => {
      const materials = extractMaterials(p);
      materials.forEach(m => {
        if (!mats[m]) mats[m] = { total: 0, failed: 0 };
        mats[m].total++;
        if (p.status === 'failed') mats[m].failed++;
      });
    });

    // Compute trend for each material: compare first half vs second half failure rate
    const tbody = document.getElementById('ana-fail-by-material-tbody');
    if (!tbody) return;

    const entries = Object.entries(mats).sort((a, b) => b[1].total - a[1].total);
    if (entries.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" class="text-muted" style="text-align:center;">No data</td></tr>';
      return;
    }

    // For trend, split prints by date order
    const sortedPrints = prints.slice().sort((a, b) => new Date(a.date) - new Date(b.date));
    const midpoint = Math.floor(sortedPrints.length / 2);
    const firstHalf = sortedPrints.slice(0, midpoint);
    const secondHalf = sortedPrints.slice(midpoint);

    function halfFailRate(half, material) {
      const relevant = half.filter(p => extractMaterials(p).includes(material));
      if (relevant.length === 0) return null;
      return relevant.filter(p => p.status === 'failed').length / relevant.length;
    }

    tbody.innerHTML = entries.map(([mat, data]) => {
      const rate = (data.failed / data.total * 100);
      const firstRate = halfFailRate(firstHalf, mat);
      const secondRate = halfFailRate(secondHalf, mat);
      let trend = '<span class="ana-trend-flat">--</span>';
      if (firstRate !== null && secondRate !== null) {
        const diff = secondRate - firstRate;
        if (diff < -0.05) trend = '<span class="ana-trend-up">&#x2193; Improving</span>';
        else if (diff > 0.05) trend = '<span class="ana-trend-down">&#x2191; Worsening</span>';
        else trend = '<span class="ana-trend-flat">&#x2194; Stable</span>';
      }
      return `<tr>
        <td><span class="tag">${mat}</span></td>
        <td>${data.total}</td>
        <td class="text-danger">${data.failed}</td>
        <td>${rateTag(rate, true)}</td>
        <td>${trend}</td>
      </tr>`;
    }).join('');
  }


  // =====================
  // COSTS TAB
  // =====================

  function renderCosts() {
    const prints = filteredPrints;
    const filaments = allFilaments;

    // Calculate cost per gram from filament data
    const costPerGram = computeCostPerGram(filaments);

    // Total filament cost from spools (purchase cost)
    const now = new Date();
    const thisYear = now.getFullYear();
    const thisMonth = now.getMonth();

    let totalSpoolCost = 0;
    let yearCost = 0;
    let monthCost = 0;

    filaments.forEach(f => {
      const spoolCost = ((f.costPerKg || 0) / 1000) * (f.weightTotal_g || 0);
      totalSpoolCost += spoolCost;
      if (f.purchaseDate) {
        const d = new Date(f.purchaseDate);
        if (d.getFullYear() === thisYear) yearCost += spoolCost;
        if (d.getFullYear() === thisYear && d.getMonth() === thisMonth) monthCost += spoolCost;
      }
    });

    // Cost per successful print
    const successPrints = prints.filter(p => p.status === 'success');
    const totalFilamentUsed = prints.reduce((s, p) => s + (p.filamentUsed_g || 0), 0);
    const successFilament = successPrints.reduce((s, p) => s + (p.filamentUsed_g || 0), 0);
    const estCostTotal = totalFilamentUsed * costPerGram;
    const costPerSuccessPrint = successPrints.length > 0 ? (successFilament * costPerGram) / successPrints.length : 0;

    const totalMinutes = prints.reduce((s, p) => s + (p.printTime_min || 0), 0);
    const costPerHour = totalMinutes > 0 ? (estCostTotal / (totalMinutes / 60)) : 0;
    const avgFilamentPerPrint = prints.length > 0 ? totalFilamentUsed / prints.length : 0;

    const failedFilament = prints.filter(p => p.status === 'failed').reduce((s, p) => s + (p.filamentUsed_g || 0), 0);
    const wastedCost = failedFilament * costPerGram;

    setText('ana-cost-all-time', '$' + totalSpoolCost.toFixed(2));
    setText('ana-cost-this-year', '$' + yearCost.toFixed(2));
    setText('ana-cost-this-month', '$' + monthCost.toFixed(2));
    setText('ana-cost-per-print', '$' + costPerSuccessPrint.toFixed(2));
    setText('ana-cost-per-hour', '$' + costPerHour.toFixed(2));
    setText('ana-cost-avg-filament', formatGrams(avgFilamentPerPrint));
    setText('ana-cost-wasted', '$' + wastedCost.toFixed(2));

    renderCostByPrinterChart(prints, costPerGram);
    renderCostByMaterialChart(prints, costPerGram);
    renderMonthlyCostChart(filaments);
    renderCostPrinterTable(prints, costPerGram);
  }

  function computeCostPerGram(filaments) {
    // Weighted average cost per gram across all spools
    let totalWeight = 0;
    let totalCost = 0;
    filaments.forEach(f => {
      if (f.costPerKg && f.weightTotal_g) {
        totalWeight += f.weightTotal_g;
        totalCost += (f.costPerKg / 1000) * f.weightTotal_g;
      }
    });
    return totalWeight > 0 ? (totalCost / totalWeight) : 0.025; // Default ~$25/kg
  }

  function renderCostByPrinterChart(prints, costPerGram) {
    const printers = {};
    prints.forEach(p => {
      const name = p.printer || 'Unknown';
      if (!printers[name]) printers[name] = 0;
      printers[name] += (p.filamentUsed_g || 0) * costPerGram;
    });

    const entries = Object.entries(printers).sort((a, b) => b[1] - a[1]);
    if (entries.length === 0) {
      setHTML('chart-cost-by-printer', emptyChartHTML('No data'));
      return;
    }

    const total = entries.reduce((s, e) => s + e[1], 0);
    const pieEntries = entries.map(([name, cost]) => [PRINTER_NAMES[name] || name, cost]);
    setHTML('chart-cost-by-printer', buildPieChart(pieEntries, total, '', true));
  }

  function renderCostByMaterialChart(prints, costPerGram) {
    const mats = {};
    prints.forEach(p => {
      const materials = extractMaterials(p);
      const costShare = ((p.filamentUsed_g || 0) * costPerGram) / Math.max(materials.length, 1);
      materials.forEach(m => {
        mats[m] = (mats[m] || 0) + costShare;
      });
    });

    const entries = Object.entries(mats).sort((a, b) => b[1] - a[1]);
    if (entries.length === 0) {
      setHTML('chart-cost-by-material', emptyChartHTML('No data'));
      return;
    }

    const total = entries.reduce((s, e) => s + e[1], 0);
    setHTML('chart-cost-by-material', buildPieChart(entries, total, '', true));
  }

  function renderMonthlyCostChart(filaments) {
    const monthly = {};
    filaments.forEach(f => {
      if (!f.purchaseDate) return;
      const key = f.purchaseDate.substring(0, 7); // YYYY-MM
      const cost = ((f.costPerKg || 0) / 1000) * (f.weightTotal_g || 0);
      monthly[key] = (monthly[key] || 0) + cost;
    });

    const months = Object.keys(monthly).sort();
    if (months.length === 0) {
      setHTML('chart-monthly-cost', emptyChartHTML('No purchase date data on spools'));
      return;
    }

    const maxVal = Math.max(...Object.values(monthly), 1);
    let html = '<div class="ana-vbar-chart">';
    months.forEach(m => {
      const cost = monthly[m];
      const h = (cost / maxVal * 100);
      html += `<div class="ana-vbar-col">
        <div class="ana-vbar-bar-group">
          <div class="ana-vbar-bar" style="height:${h}%; background:var(--success);" title="$${cost.toFixed(2)}"></div>
        </div>
        <div class="ana-vbar-label">${formatMonthLabel(m)}</div>
      </div>`;
    });
    html += '</div>';
    setHTML('chart-monthly-cost', html);
  }

  function renderCostPrinterTable(prints, costPerGram) {
    const printers = {};
    prints.forEach(p => {
      const name = p.printer || 'Unknown';
      if (!printers[name]) printers[name] = { total: 0, filament: 0, minutes: 0 };
      const d = printers[name];
      d.total++;
      d.filament += (p.filamentUsed_g || 0);
      d.minutes += (p.printTime_min || 0);
    });

    const tbody = document.getElementById('ana-cost-printer-tbody');
    if (!tbody) return;

    tbody.innerHTML = Object.entries(printers).sort((a, b) => b[1].filament - a[1].filament).map(([name, d]) => {
      const estCost = d.filament * costPerGram;
      const avgCost = d.total > 0 ? estCost / d.total : 0;
      const costHr = d.minutes > 0 ? estCost / (d.minutes / 60) : 0;
      return `<tr>
        <td>${PRINTER_NAMES[name] || name}</td>
        <td>${d.total}</td>
        <td>${formatGrams(d.filament)}</td>
        <td>$${estCost.toFixed(2)}</td>
        <td>$${avgCost.toFixed(2)}</td>
        <td>$${costHr.toFixed(2)}</td>
      </tr>`;
    }).join('');
  }


  // =====================
  // PROGRESS TAB
  // =====================

  function renderProgress() {
    renderSkillProgression();
    renderMilestones();
    renderUsagePatterns();
    renderDayHeatmap();
  }

  function renderSkillProgression() {
    const sorted = allPrints.slice().sort((a, b) => new Date(a.date) - new Date(b.date));
    if (sorted.length === 0) return;

    const firstDate = new Date(sorted[0].date);
    const firstMonthEnd = new Date(firstDate);
    firstMonthEnd.setDate(firstMonthEnd.getDate() + 30);

    const firstMonthPrints = sorted.filter(p => new Date(p.date) <= firstMonthEnd);
    const firstMonthRate = firstMonthPrints.length > 0
      ? (firstMonthPrints.filter(p => p.status === 'success').length / firstMonthPrints.length * 100)
      : null;

    const now = new Date();
    const recentCutoff = new Date(now - 30 * 86400000);
    const recentPrints = allPrints.filter(p => new Date(p.date) >= recentCutoff);
    const recentRate = recentPrints.length > 0
      ? (recentPrints.filter(p => p.status === 'success').length / recentPrints.length * 100)
      : null;

    setText('ana-skill-first-month', firstMonthRate !== null ? firstMonthRate.toFixed(1) + '%' : '--');
    setText('ana-skill-recent', recentRate !== null ? recentRate.toFixed(1) + '%' : '--');

    if (firstMonthRate !== null && recentRate !== null) {
      const diff = recentRate - firstMonthRate;
      const sign = diff >= 0 ? '+' : '';
      setText('ana-skill-improvement', sign + diff.toFixed(1) + 'pp');
      const el = document.getElementById('ana-skill-improvement');
      if (el) el.style.color = diff >= 0 ? 'var(--success)' : 'var(--danger)';
    } else {
      setText('ana-skill-improvement', '--');
    }

    // Monthly skill chart
    const monthly = groupByMonth(allPrints);
    const months = Object.keys(monthly).sort();

    if (months.length === 0) {
      setHTML('chart-skill-progression', emptyChartHTML('No data'));
      return;
    }

    const data = months.map(m => {
      const items = monthly[m];
      const t = items.length;
      const s = items.filter(p => p.status === 'success').length;
      return { label: formatMonthLabel(m), rate: t > 0 ? (s / t * 100) : 0 };
    });

    let html = '<div class="ana-vbar-chart">';
    data.forEach(d => {
      const color = d.rate >= 80 ? 'var(--success)' : d.rate >= 60 ? 'var(--accent)' : d.rate >= 40 ? 'var(--warning)' : 'var(--danger)';
      html += `<div class="ana-vbar-col">
        <div class="ana-vbar-bar-group">
          <div class="ana-vbar-bar" style="height:${d.rate}%; background:${color};" title="${d.rate.toFixed(1)}%"></div>
        </div>
        <div class="ana-vbar-label">${d.label}</div>
      </div>`;
    });
    html += '</div>';
    html += '<div class="text-sm text-muted" style="text-align:center;margin-top:8px;">Monthly success rate over time</div>';
    setHTML('chart-skill-progression', html);
  }

  function renderMilestones() {
    const sorted = allPrints.slice().sort((a, b) => new Date(a.date) - new Date(b.date));
    const milestones = [];

    // Print count milestones
    const countMilestones = [1, 10, 25, 50, 100, 250, 500, 1000];
    countMilestones.forEach(n => {
      if (sorted.length >= n) {
        const p = sorted[n - 1];
        milestones.push({
          icon: n === 1 ? '&#x1F476;' : n >= 500 ? '&#x1F451;' : n >= 100 ? '&#x1F3C6;' : n >= 50 ? '&#x2B50;' : '&#x1F3AF;',
          title: n === 1 ? 'First Print' : `${n}th Print`,
          detail: p.name || 'Print #' + n,
          date: p.date,
          achieved: true
        });
      } else {
        milestones.push({
          icon: n >= 500 ? '&#x1F451;' : n >= 100 ? '&#x1F3C6;' : '&#x1F3AF;',
          title: `${n}th Print`,
          detail: `${n - sorted.length} more to go`,
          achieved: false
        });
        return; // Only show one future milestone per category
      }
    });

    // First-time material milestones
    const materialFirstUse = {};
    sorted.forEach(p => {
      extractMaterials(p).forEach(m => {
        if (!materialFirstUse[m]) materialFirstUse[m] = p;
      });
    });

    const specialMaterials = ['PETG', 'TPU', 'ABS', 'ASA', 'Nylon', 'PC'];
    specialMaterials.forEach(m => {
      if (materialFirstUse[m]) {
        milestones.push({
          icon: '&#x1F9EA;',
          title: `First ${m} Print`,
          detail: materialFirstUse[m].name || 'Unnamed',
          date: materialFirstUse[m].date,
          achieved: true
        });
      }
    });

    // Streak milestones: longest success streak
    let maxStreak = 0;
    let currentStreak = 0;
    sorted.forEach(p => {
      if (p.status === 'success') {
        currentStreak++;
        if (currentStreak > maxStreak) maxStreak = currentStreak;
      } else {
        currentStreak = 0;
      }
    });

    if (maxStreak >= 5) {
      milestones.push({
        icon: '&#x1F525;',
        title: `${maxStreak}-Print Win Streak`,
        detail: 'Longest consecutive successes',
        achieved: true
      });
    }

    // Multi-material milestone
    const multiMat = sorted.find(p => {
      const m = extractMaterials(p);
      return m.length > 1;
    });
    if (multiMat) {
      milestones.push({
        icon: '&#x1F308;',
        title: 'First Multi-Material',
        detail: multiMat.name || 'Multi-material print',
        date: multiMat.date,
        achieved: true
      });
    }

    // Total hours milestone
    const totalHours = sorted.reduce((s, p) => s + (p.printTime_min || 0), 0) / 60;
    const hourMilestones = [10, 50, 100, 500, 1000];
    hourMilestones.forEach(h => {
      if (totalHours >= h) {
        milestones.push({
          icon: h >= 500 ? '&#x23F0;' : '&#x23F1;',
          title: `${h} Hours Printed`,
          detail: `Total print time exceeds ${h} hours`,
          achieved: true
        });
      }
    });

    // Total filament milestone
    const totalGrams = sorted.reduce((s, p) => s + (p.filamentUsed_g || 0), 0);
    if (totalGrams >= 1000) {
      const kgs = Math.floor(totalGrams / 1000);
      milestones.push({
        icon: '&#x1F3CB;',
        title: `${kgs}kg of Filament`,
        detail: `Used over ${kgs} kilogram${kgs > 1 ? 's' : ''} of filament`,
        achieved: true
      });
    }

    const container = document.getElementById('ana-milestones-grid');
    const emptyEl = document.getElementById('ana-milestones-empty');
    if (!container) return;

    const achieved = milestones.filter(m => m.achieved);
    const locked = milestones.filter(m => !m.achieved).slice(0, 3); // Show up to 3 locked

    if (achieved.length === 0 && locked.length === 0) {
      container.innerHTML = '';
      if (emptyEl) emptyEl.style.display = '';
      return;
    }

    if (emptyEl) emptyEl.style.display = 'none';

    container.innerHTML = [...achieved, ...locked].map(m => {
      const lockedCls = m.achieved ? '' : ' ana-milestone-locked';
      const dateHTML = m.date ? `<div class="ana-milestone-date">${formatDate(m.date)}</div>` : '';
      return `<div class="ana-milestone${lockedCls}">
        <div class="ana-milestone-icon">${m.icon}</div>
        <div class="ana-milestone-title">${m.title}</div>
        <div class="ana-milestone-detail">${m.detail}</div>
        ${dateHTML}
      </div>`;
    }).join('');
  }

  function renderUsagePatterns() {
    const prints = filteredPrints;

    // Most used materials
    const matCounts = {};
    prints.forEach(p => {
      extractMaterials(p).forEach(m => { matCounts[m] = (matCounts[m] || 0) + 1; });
    });
    const matEntries = Object.entries(matCounts).sort((a, b) => b[1] - a[1]).slice(0, 6);
    const matMax = matEntries.length > 0 ? matEntries[0][1] : 1;

    const matContainer = document.getElementById('ana-pattern-materials');
    if (matContainer) {
      if (matEntries.length === 0) {
        matContainer.innerHTML = '<div class="text-muted text-sm" style="padding:10px;">No material data</div>';
      } else {
        matContainer.innerHTML = matEntries.map(([name, count], i) => {
          const pct = (count / matMax * 100).toFixed(0);
          return `<div class="ana-ranked-item">
            <div class="ana-rank-number">${i + 1}</div>
            <div class="ana-rank-info">
              <div class="ana-rank-name">${name}</div>
              <div class="ana-rank-detail">${count} print${count !== 1 ? 's' : ''}</div>
            </div>
            <div class="ana-rank-bar">
              <div class="progress-bar"><div class="progress-fill" style="width:${pct}%;background:${COLORS[i % COLORS.length]};"></div></div>
            </div>
            <div class="ana-rank-value">${count}</div>
          </div>`;
        }).join('');
      }
    }

    // Most common tags
    const tagCounts = {};
    prints.forEach(p => {
      const tags = extractTags(p);
      tags.forEach(t => { tagCounts[t] = (tagCounts[t] || 0) + 1; });
    });
    const tagEntries = Object.entries(tagCounts).sort((a, b) => b[1] - a[1]).slice(0, 6);
    const tagMax = tagEntries.length > 0 ? tagEntries[0][1] : 1;

    const tagContainer = document.getElementById('ana-pattern-tags');
    if (tagContainer) {
      if (tagEntries.length === 0) {
        tagContainer.innerHTML = '<div class="text-muted text-sm" style="padding:10px;">No tags logged</div>';
      } else {
        tagContainer.innerHTML = tagEntries.map(([name, count], i) => {
          const pct = (count / tagMax * 100).toFixed(0);
          return `<div class="ana-ranked-item">
            <div class="ana-rank-number">${i + 1}</div>
            <div class="ana-rank-info">
              <div class="ana-rank-name">${name}</div>
              <div class="ana-rank-detail">${count} print${count !== 1 ? 's' : ''}</div>
            </div>
            <div class="ana-rank-bar">
              <div class="progress-bar"><div class="progress-fill" style="width:${pct}%;background:${COLORS[(i + 3) % COLORS.length]};"></div></div>
            </div>
            <div class="ana-rank-value">${count}</div>
          </div>`;
        }).join('');
      }
    }

    // Average print time, filament, busiest day
    const totalMinutes = prints.reduce((s, p) => s + (p.printTime_min || 0), 0);
    const avgTime = prints.length > 0 ? totalMinutes / prints.length : 0;
    const totalFilament = prints.reduce((s, p) => s + (p.filamentUsed_g || 0), 0);
    const avgFilament = prints.length > 0 ? totalFilament / prints.length : 0;

    setText('ana-pattern-avg-time', formatDuration(avgTime));
    setText('ana-pattern-avg-filament', formatGrams(avgFilament));

    // Busiest day of week
    const dayCounts = [0, 0, 0, 0, 0, 0, 0];
    prints.forEach(p => {
      if (p.date) {
        const d = new Date(p.date);
        dayCounts[d.getDay()]++;
      }
    });
    const maxDayIdx = dayCounts.indexOf(Math.max(...dayCounts));
    setText('ana-pattern-busiest-day', dayCounts[maxDayIdx] > 0 ? DAY_NAMES[maxDayIdx] : '--');
  }

  function renderDayHeatmap() {
    const prints = filteredPrints;
    const dayCounts = [0, 0, 0, 0, 0, 0, 0];
    const daySuccess = [0, 0, 0, 0, 0, 0, 0];
    prints.forEach(p => {
      if (p.date) {
        const d = new Date(p.date);
        const day = d.getDay();
        dayCounts[day]++;
        if (p.status === 'success') daySuccess[day]++;
      }
    });

    const maxCount = Math.max(...dayCounts, 1);

    let html = '<div class="ana-day-heatmap">';
    for (let i = 0; i < 7; i++) {
      const intensity = dayCounts[i] / maxCount;
      const bg = intensity === 0
        ? 'var(--bg-input)'
        : `rgba(79, 172, 254, ${0.1 + intensity * 0.5})`;
      const rate = dayCounts[i] > 0 ? (daySuccess[i] / dayCounts[i] * 100).toFixed(0) : 0;
      html += `<div class="ana-day-col">
        <div class="ana-day-name">${DAY_SHORT[i]}</div>
        <div class="ana-day-block" style="background:${bg};">
          <div class="ana-day-count">${dayCounts[i]}</div>
          <div class="ana-day-sub">${dayCounts[i] > 0 ? rate + '% ok' : 'none'}</div>
        </div>
      </div>`;
    }
    html += '</div>';
    setHTML('chart-day-heatmap', html);
  }


  // =====================
  // SHARED CHART BUILDERS
  // =====================

  function buildPieChart(entries, total, unitLabel, isCurrency) {
    // Build conic-gradient pie + legend
    const gradientStops = [];
    let cumulative = 0;

    entries.forEach(([name, value], i) => {
      const pct = (value / total * 100);
      const color = COLORS[i % COLORS.length];
      gradientStops.push(`${color} ${cumulative}% ${cumulative + pct}%`);
      cumulative += pct;
    });

    const gradient = `conic-gradient(${gradientStops.join(', ')})`;
    const centerText = isCurrency ? '$' + total.toFixed(0) : total;

    let html = `<div class="ana-pie-chart" style="background:${gradient};">
      <div class="ana-pie-center">
        <div class="ana-pie-center-value">${centerText}</div>
        <div class="ana-pie-center-label">${unitLabel || 'total'}</div>
      </div>
    </div>`;

    html += '<div class="ana-pie-legend">';
    entries.slice(0, 8).forEach(([name, value], i) => {
      const pct = (value / total * 100).toFixed(1);
      const display = isCurrency ? '$' + value.toFixed(2) : value;
      html += `<div class="ana-pie-legend-item">
        <div class="ana-pie-legend-swatch" style="background:${COLORS[i % COLORS.length]};"></div>
        <div class="ana-pie-legend-label">${name}</div>
        <div class="ana-pie-legend-value">${display} (${pct}%)</div>
      </div>`;
    });
    html += '</div>';

    return html;
  }

  function emptyChartHTML(message) {
    return `<div style="display:flex;align-items:center;justify-content:center;height:100%;min-height:120px;color:var(--text-muted);font-size:13px;">${message}</div>`;
  }


  // =====================
  // UTILITY FUNCTIONS
  // =====================

  function extractMaterials(print) {
    // Material can be a string, array, or come from filament references
    if (!print.material && !print.materials) return ['Unknown'];
    const mats = print.materials || print.material;
    if (Array.isArray(mats)) return mats.filter(Boolean).length > 0 ? mats.filter(Boolean) : ['Unknown'];
    if (typeof mats === 'string' && mats.trim()) return [mats.trim()];
    return ['Unknown'];
  }

  function extractTags(print) {
    if (!print.tags) return [];
    if (Array.isArray(print.tags)) return print.tags.map(t => t.trim()).filter(Boolean);
    if (typeof print.tags === 'string') return print.tags.split(',').map(t => t.trim()).filter(Boolean);
    return [];
  }

  function groupByMonth(prints) {
    const groups = {};
    prints.forEach(p => {
      if (!p.date) return;
      const key = p.date.substring(0, 7); // YYYY-MM
      if (!groups[key]) groups[key] = [];
      groups[key].push(p);
    });
    return groups;
  }

  function formatMonthLabel(yyyymm) {
    const [y, m] = yyyymm.split('-');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return months[parseInt(m, 10) - 1] + ' ' + y.substring(2);
  }

  function formatHours(minutes) {
    if (!minutes) return '0h';
    const hrs = (minutes / 60);
    if (hrs >= 1) return hrs.toFixed(1) + 'h';
    return Math.round(minutes) + 'm';
  }

  function formatGrams(grams) {
    if (!grams) return '0g';
    if (grams >= 1000) return (grams / 1000).toFixed(2) + 'kg';
    return grams.toFixed(1) + 'g';
  }

  function rateTag(rate, invert) {
    // invert: true means higher rate = bad (failure rate)
    let cls;
    if (invert) {
      cls = rate > 30 ? 'tag-danger' : rate > 15 ? 'tag-warning' : 'tag-success';
    } else {
      cls = rate >= 80 ? 'tag-success' : rate >= 60 ? 'tag-warning' : 'tag-danger';
    }
    return `<span class="tag ${cls}">${rate.toFixed(1)}%</span>`;
  }

  function setText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  function setHTML(id, html) {
    const el = document.getElementById(id);
    if (el) el.innerHTML = html;
  }

  // ---- Init on load ----
  init();

})();
