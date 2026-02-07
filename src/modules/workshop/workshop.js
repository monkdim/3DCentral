// Design Workshop — Module JavaScript
// Part Generator, Design Rules, Measurement Wizard, STL Fix, CAD Links

(function () {
  'use strict';

  // ================================================================
  //  TEMPLATE DEFINITIONS
  // ================================================================

  const TEMPLATES = {
    box_with_lid: {
      name: 'Box with Lid',
      subtitle: 'Parametric storage box with removable lid',
      params: [
        { id: 'length',     label: 'Inner Length',    unit: 'mm', min: 15,  max: 250, step: 1,   value: 60,   desc: 'Interior length of the box' },
        { id: 'width',      label: 'Inner Width',     unit: 'mm', min: 15,  max: 250, step: 1,   value: 40,   desc: 'Interior width of the box' },
        { id: 'height',     label: 'Inner Height',    unit: 'mm', min: 10,  max: 150, step: 1,   value: 30,   desc: 'Interior depth of the box (excluding lid)' },
        { id: 'wall',       label: 'Wall Thickness',  unit: 'mm', min: 0.8, max: 4,   step: 0.2, value: 1.6,  desc: 'Thickness of walls and bottom' },
        { id: 'lidTol',     label: 'Lid Tolerance',   unit: 'mm', min: 0.0, max: 1.0, step: 0.05,value: 0.2,  desc: 'Gap between lid and box walls. 0.15-0.25 for snug fit.' },
        { id: 'lidDepth',   label: 'Lid Lip Depth',   unit: 'mm', min: 1,   max: 20,  step: 0.5, value: 5,    desc: 'How far the lid lip extends into the box' },
        { id: 'cornerR',    label: 'Corner Radius',   unit: 'mm', min: 0,   max: 15,  step: 0.5, value: 2,    desc: 'Rounding of inner corners. 0 = sharp.' },
      ],
      preview: drawBoxPreview,
      volume: (p) => {
        const outerL = p.length + 2 * p.wall;
        const outerW = p.width + 2 * p.wall;
        const outerH = p.height + p.wall;
        const boxVol = outerL * outerW * outerH - p.length * p.width * p.height;
        const lidL = p.length + 2 * p.wall;
        const lidW = p.width + 2 * p.wall;
        const lidH = p.wall + p.lidDepth;
        const lidVol = lidL * lidW * lidH - (p.length + 2 * p.lidTol) * (p.width + 2 * p.lidTol) * p.lidDepth;
        return boxVol + Math.max(0, lidVol);
      }
    },

    phone_stand: {
      name: 'Phone Stand',
      subtitle: 'Adjustable-angle phone/tablet stand',
      params: [
        { id: 'deviceW',  label: 'Device Width',    unit: 'mm', min: 50,  max: 250, step: 1,   value: 78,   desc: 'Width of your phone or tablet' },
        { id: 'angle',    label: 'Viewing Angle',    unit: 'deg',min: 30,  max: 80,  step: 5,   value: 65,   desc: 'Angle from horizontal. 60-70 for desk use.' },
        { id: 'baseD',    label: 'Base Depth',       unit: 'mm', min: 40,  max: 150, step: 1,   value: 80,   desc: 'How far the base extends on the desk' },
        { id: 'lipH',     label: 'Front Lip Height', unit: 'mm', min: 3,   max: 20,  step: 1,   value: 8,    desc: 'Lip that prevents the phone from sliding off' },
        { id: 'thick',    label: 'Material Thickness',unit: 'mm',min: 2,   max: 6,   step: 0.5, value: 3,    desc: 'Wall/sheet thickness of the stand' },
        { id: 'cableSlot',label: 'Cable Slot Width', unit: 'mm', min: 0,   max: 20,  step: 1,   value: 12,   desc: 'Width of charging cable pass-through. 0 = none.' },
      ],
      preview: drawPhoneStandPreview,
      volume: (p) => {
        const rad = p.angle * Math.PI / 180;
        const backH = p.baseD * Math.tan(rad);
        return p.deviceW * p.thick * (p.baseD + backH + p.lipH) * 0.6;
      }
    },

    cable_clip: {
      name: 'Cable Clip',
      subtitle: 'Desk or wall mount cable organizer',
      params: [
        { id: 'cableDia',  label: 'Cable Diameter',   unit: 'mm', min: 2,   max: 15,  step: 0.5, value: 5,    desc: 'Measure around the thickest part of the cable' },
        { id: 'clipCount', label: 'Number of Slots',   unit: '',   min: 1,   max: 6,   step: 1,   value: 3,    desc: 'How many cables this clip holds' },
        { id: 'clipWall',  label: 'Wall Thickness',    unit: 'mm', min: 1,   max: 4,   step: 0.2, value: 1.6,  desc: 'Clip wall thickness' },
        { id: 'mountType', label: 'Mount Width',       unit: 'mm', min: 10,  max: 40,  step: 1,   value: 20,   desc: 'Base plate width for adhesive or screw mount' },
        { id: 'baseH',     label: 'Base Height',       unit: 'mm', min: 2,   max: 6,   step: 0.5, value: 3,    desc: 'Thickness of the mounting base' },
      ],
      preview: drawCableClipPreview,
      volume: (p) => {
        const slotR = p.cableDia / 2 + p.clipWall;
        const slotW = slotR * 2;
        const totalW = slotW * p.clipCount + 4 * (p.clipCount - 1);
        return totalW * p.mountType * p.baseH + p.clipCount * Math.PI * slotR * slotR * p.mountType * 0.4;
      }
    },

    shelf_bracket: {
      name: 'Shelf Bracket',
      subtitle: 'L-shaped shelf bracket with mounting holes',
      params: [
        { id: 'depth',       label: 'Shelf Depth',       unit: 'mm', min: 50,  max: 300, step: 5,   value: 120,  desc: 'How far the bracket extends from the wall' },
        { id: 'height',      label: 'Wall Plate Height', unit: 'mm', min: 50,  max: 300, step: 5,   value: 120,  desc: 'Height of the vertical wall mounting plate' },
        { id: 'thick',       label: 'Thickness',         unit: 'mm', min: 3,   max: 10,  step: 0.5, value: 5,    desc: 'Material thickness' },
        { id: 'bracketW',    label: 'Bracket Width',     unit: 'mm', min: 15,  max: 60,  step: 1,   value: 30,   desc: 'Width of the bracket (side-to-side)' },
        { id: 'screwDia',    label: 'Screw Hole Dia',    unit: 'mm', min: 3,   max: 8,   step: 0.5, value: 4.5,  desc: 'Diameter of screw pass-through holes' },
        { id: 'screwSpacing',label: 'Screw Spacing',     unit: 'mm', min: 20,  max: 200, step: 5,   value: 60,   desc: 'Distance between screw hole centers' },
        { id: 'gusset',      label: 'Gusset Length',     unit: 'mm', min: 0,   max: 150, step: 5,   value: 60,   desc: 'Length of diagonal brace. 0 = none (weaker).' },
      ],
      preview: drawBracketPreview,
      volume: (p) => {
        const vPlate = p.height * p.bracketW * p.thick;
        const hPlate = p.depth * p.bracketW * p.thick;
        const gusset = p.gusset > 0 ? p.gusset * p.bracketW * p.thick * 0.5 : 0;
        return vPlate + hPlate + gusset;
      }
    },

    drawer_organizer: {
      name: 'Drawer Organizer',
      subtitle: 'Grid-based drawer insert with compartments',
      params: [
        { id: 'drawerL',  label: 'Drawer Length',       unit: 'mm', min: 50,  max: 600, step: 5,   value: 300,  desc: 'Inner length of the drawer' },
        { id: 'drawerW',  label: 'Drawer Width',        unit: 'mm', min: 50,  max: 400, step: 5,   value: 200,  desc: 'Inner width of the drawer' },
        { id: 'height',   label: 'Organizer Height',    unit: 'mm', min: 10,  max: 100, step: 1,   value: 40,   desc: 'Height of the divider walls' },
        { id: 'cols',     label: 'Columns',              unit: '',   min: 1,   max: 8,   step: 1,   value: 3,    desc: 'Number of columns (across width)' },
        { id: 'rows',     label: 'Rows',                 unit: '',   min: 1,   max: 8,   step: 1,   value: 2,    desc: 'Number of rows (across length)' },
        { id: 'wall',     label: 'Wall Thickness',       unit: 'mm', min: 0.8, max: 3,   step: 0.2, value: 1.2,  desc: 'Thickness of divider walls' },
        { id: 'clearance',label: 'Drawer Clearance',     unit: 'mm', min: 0,   max: 3,   step: 0.1, value: 0.5,  desc: 'Gap between organizer and drawer walls' },
      ],
      preview: drawOrganizerPreview,
      volume: (p) => {
        const orgL = p.drawerL - 2 * p.clearance;
        const orgW = p.drawerW - 2 * p.clearance;
        const wallVol = (p.cols + 1) * p.wall * orgL * p.height + (p.rows + 1) * p.wall * orgW * p.height;
        const baseVol = orgL * orgW * p.wall;
        return wallVol + baseVol;
      }
    },

    knob_handle: {
      name: 'Knob / Handle',
      subtitle: 'Replacement drawer or cabinet knob',
      params: [
        { id: 'shaftDia',  label: 'Bolt Hole Dia',     unit: 'mm', min: 2,   max: 10,  step: 0.5, value: 4.2,  desc: 'Diameter for the mounting bolt (M3=3.2, M4=4.2, M5=5.2)' },
        { id: 'shaftDepth',label: 'Bolt Hole Depth',    unit: 'mm', min: 5,   max: 30,  step: 1,   value: 12,   desc: 'How deep the bolt hole goes' },
        { id: 'gripDia',   label: 'Grip Diameter',      unit: 'mm', min: 15,  max: 60,  step: 1,   value: 30,   desc: 'Outer diameter of the knob head' },
        { id: 'gripH',     label: 'Grip Height',        unit: 'mm', min: 8,   max: 40,  step: 1,   value: 16,   desc: 'Height of the knob head portion' },
        { id: 'neckDia',   label: 'Neck Diameter',      unit: 'mm', min: 8,   max: 40,  step: 1,   value: 14,   desc: 'Diameter of the neck connecting head to base' },
        { id: 'neckH',     label: 'Neck Height',        unit: 'mm', min: 0,   max: 20,  step: 1,   value: 6,    desc: 'Height of the neck. 0 = no neck.' },
        { id: 'flatBase',  label: 'Base Flange Dia',    unit: 'mm', min: 0,   max: 50,  step: 1,   value: 20,   desc: 'Diameter of flat base against the drawer. 0 = no flange.' },
      ],
      preview: drawKnobPreview,
      volume: (p) => {
        const gripVol = Math.PI * (p.gripDia / 2) ** 2 * p.gripH;
        const neckVol = Math.PI * (p.neckDia / 2) ** 2 * p.neckH;
        const flangeVol = p.flatBase > 0 ? Math.PI * (p.flatBase / 2) ** 2 * 2 : 0;
        const holeVol = Math.PI * (p.shaftDia / 2) ** 2 * p.shaftDepth;
        return gripVol + neckVol + flangeVol - holeVol;
      }
    }
  };


  // ================================================================
  //  SVG PREVIEW RENDERERS
  // ================================================================

  function svgEl(tag, attrs) {
    const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
    for (const [k, v] of Object.entries(attrs || {})) el.setAttribute(k, v);
    return el;
  }

  function createSvg(w, h) {
    const svg = svgEl('svg', { viewBox: `0 0 ${w} ${h}`, class: 'ws-preview-svg', preserveAspectRatio: 'xMidYMid meet' });
    return svg;
  }

  // Helper to add a dimension line with label
  function addDimension(svg, x1, y1, x2, y2, label, offset, color) {
    color = color || 'var(--text-muted)';
    const g = svgEl('g', {});
    const dx = x2 - x1, dy = y2 - y1;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len < 1) return g;
    const nx = -dy / len * offset, ny = dx / len * offset;
    // end ticks
    g.appendChild(svgEl('line', { x1: x1, y1: y1, x2: x1 + nx, y2: y1 + ny, stroke: color, 'stroke-width': 0.5, 'stroke-dasharray': '2,2' }));
    g.appendChild(svgEl('line', { x1: x2, y1: y2, x2: x2 + nx, y2: y2 + ny, stroke: color, 'stroke-width': 0.5, 'stroke-dasharray': '2,2' }));
    // main dim line
    g.appendChild(svgEl('line', { x1: x1 + nx, y1: y1 + ny, x2: x2 + nx, y2: y2 + ny, stroke: color, 'stroke-width': 0.8 }));
    // text
    const tx = (x1 + x2) / 2 + nx * 1.6;
    const ty = (y1 + y2) / 2 + ny * 1.6;
    const txt = svgEl('text', { x: tx, y: ty, fill: color, 'font-size': '9', 'text-anchor': 'middle', 'dominant-baseline': 'middle', 'font-family': 'var(--font-mono)' });
    txt.textContent = label;
    g.appendChild(txt);
    svg.appendChild(g);
    return g;
  }

  // --- Box preview (isometric-ish front view) ---
  function drawBoxPreview(container, p) {
    const pad = 30;
    const svgW = 280, svgH = 260;
    const svg = createSvg(svgW, svgH);

    // Scale to fit
    const outerL = p.length + 2 * p.wall;
    const outerH = p.height + p.wall;
    const maxDim = Math.max(outerL, outerH + p.wall + p.lidDepth);
    const scale = Math.min((svgW - 2 * pad) / outerL, (svgH - 2 * pad) / (outerH + p.wall + p.lidDepth + 8));

    const cx = svgW / 2;
    const bx = cx - outerL * scale / 2;
    const by = svgH - pad;

    // Box body (cross-section)
    const bw = outerL * scale;
    const bh = outerH * scale;
    svg.appendChild(svgEl('rect', { x: bx, y: by - bh, width: bw, height: bh, fill: 'var(--accent)', opacity: '0.25', stroke: 'var(--accent)', 'stroke-width': '1.5', rx: Math.min(p.cornerR * scale, 8) }));

    // Inner cavity
    const iw = p.length * scale;
    const ih = p.height * scale;
    const ix = cx - iw / 2;
    const iy = by - p.wall * scale - ih;
    svg.appendChild(svgEl('rect', { x: ix, y: iy, width: iw, height: ih, fill: 'var(--bg-primary)', stroke: 'var(--accent)', 'stroke-width': '0.8', 'stroke-dasharray': '3,2', rx: Math.min(p.cornerR * scale, 6) }));

    // Lid (above box with small gap)
    const lidGap = 4;
    const lidOuterH = (p.wall + p.lidDepth) * scale;
    const ly = by - bh - lidGap - lidOuterH;
    svg.appendChild(svgEl('rect', { x: bx, y: ly, width: bw, height: lidOuterH, fill: 'var(--success)', opacity: '0.25', stroke: 'var(--success)', 'stroke-width': '1.5', rx: Math.min(p.cornerR * scale, 8) }));

    // Lid lip (dashed inner)
    const lipInnerW = (p.length + 2 * p.lidTol) * scale;
    const lipH = p.lidDepth * scale;
    const lix = cx - lipInnerW / 2;
    svg.appendChild(svgEl('rect', { x: lix, y: ly + p.wall * scale, width: lipInnerW, height: lipH, fill: 'none', stroke: 'var(--success)', 'stroke-width': '0.8', 'stroke-dasharray': '3,2', rx: 2 }));

    // Dimensions
    addDimension(svg, bx, by, bx + bw, by, `${outerL.toFixed(1)}`, 12);
    addDimension(svg, bx - 2, by, bx - 2, by - bh, `${outerH.toFixed(1)}`, -14);
    addDimension(svg, bx + bw + 2, ly, bx + bw + 2, ly + lidOuterH, `${(p.wall + p.lidDepth).toFixed(1)}`, 14, 'var(--success)');

    container.innerHTML = '';
    container.appendChild(svg);
  }

  // --- Phone stand preview (side cross-section) ---
  function drawPhoneStandPreview(container, p) {
    const pad = 30;
    const svgW = 280, svgH = 260;
    const svg = createSvg(svgW, svgH);

    const rad = p.angle * Math.PI / 180;
    const backH = p.baseD * Math.tan(rad);
    const maxDim = Math.max(p.baseD, backH + p.lipH);
    const scale = Math.min((svgW - 2 * pad) / p.baseD, (svgH - 2 * pad) / (backH + p.lipH));

    const baseY = svgH - pad;
    const baseX = pad + 10;

    // Base plate
    const bw = p.baseD * scale;
    svg.appendChild(svgEl('rect', { x: baseX, y: baseY - p.thick * scale, width: bw, height: p.thick * scale, fill: 'var(--accent)', opacity: '0.3', stroke: 'var(--accent)', 'stroke-width': '1.5', rx: 2 }));

    // Back support (angled)
    const topX = baseX;
    const topY = baseY - p.thick * scale - backH * scale;
    const botX = baseX;
    const botY = baseY - p.thick * scale;
    const pts = `${botX},${botY} ${topX},${topY} ${topX + p.thick * scale},${topY} ${botX + p.thick * scale},${botY}`;
    svg.appendChild(svgEl('polygon', { points: pts, fill: 'var(--accent)', opacity: '0.3', stroke: 'var(--accent)', 'stroke-width': '1.5' }));

    // Front lip
    const lipX = baseX + bw - p.thick * scale;
    const lipH = p.lipH * scale;
    svg.appendChild(svgEl('rect', { x: lipX, y: baseY - p.thick * scale - lipH, width: p.thick * scale, height: lipH, fill: 'var(--success)', opacity: '0.3', stroke: 'var(--success)', 'stroke-width': '1.5', rx: 1 }));

    // Phone outline (ghosted)
    const phoneThick = 8 * scale;
    const phoneH = Math.min(backH * 0.9, 140) * scale;
    const phoneBX = baseX + p.thick * scale * 0.5 + 4;
    const phoneBY = baseY - p.thick * scale;
    // phone rests on the base at the angle
    const phX1 = phoneBX + Math.cos(rad) * phoneThick;
    const phY1 = phoneBY - Math.sin(rad) * phoneThick;
    svg.appendChild(svgEl('rect', {
      x: phoneBX, y: phoneBY - phoneH,
      width: phoneThick, height: phoneH,
      fill: 'var(--text-muted)', opacity: '0.15',
      stroke: 'var(--text-muted)', 'stroke-width': '1',
      'stroke-dasharray': '4,3', rx: 3,
      transform: `rotate(${-(90 - p.angle)} ${phoneBX} ${phoneBY})`
    }));

    // Angle arc
    const arcR = 25;
    const arcEndX = baseX + arcR;
    const arcStartX = baseX + arcR * Math.cos(rad);
    const arcStartY = botY - arcR * Math.sin(rad);
    svg.appendChild(svgEl('path', {
      d: `M ${arcEndX} ${botY} A ${arcR} ${arcR} 0 0 0 ${arcStartX} ${arcStartY}`,
      fill: 'none', stroke: 'var(--text-muted)', 'stroke-width': '0.8'
    }));
    const angTxt = svgEl('text', { x: baseX + arcR + 8, y: botY - arcR * 0.3, fill: 'var(--text-muted)', 'font-size': '9', 'font-family': 'var(--font-mono)' });
    angTxt.textContent = `${p.angle}\u00B0`;
    svg.appendChild(angTxt);

    // Dimensions
    addDimension(svg, baseX, baseY, baseX + bw, baseY, `${p.baseD}mm`, 12);

    container.innerHTML = '';
    container.appendChild(svg);
  }

  // --- Cable clip preview ---
  function drawCableClipPreview(container, p) {
    const svgW = 280, svgH = 220;
    const svg = createSvg(svgW, svgH);

    const slotR = (p.cableDia / 2 + p.clipWall);
    const slotSpacing = slotR * 2 + 4;
    const totalW = slotSpacing * p.clipCount;
    const scale = Math.min((svgW - 60) / totalW, (svgH - 60) / (slotR * 2 + p.baseH + 10));

    const baseY = svgH - 30;
    const startX = svgW / 2 - (totalW * scale) / 2 + slotSpacing * scale / 2;

    // Base plate
    const bpW = Math.max(totalW * scale, p.mountType * scale);
    const bpX = svgW / 2 - bpW / 2;
    svg.appendChild(svgEl('rect', { x: bpX, y: baseY - p.baseH * scale, width: bpW, height: p.baseH * scale, fill: 'var(--accent)', opacity: '0.3', stroke: 'var(--accent)', 'stroke-width': '1.5', rx: 2 }));

    // Clip loops
    for (let i = 0; i < p.clipCount; i++) {
      const cx = startX + i * slotSpacing * scale;
      const cy = baseY - p.baseH * scale - slotR * scale;

      // Outer circle (clip body)
      svg.appendChild(svgEl('circle', { cx, cy, r: slotR * scale, fill: 'var(--accent)', opacity: '0.2', stroke: 'var(--accent)', 'stroke-width': '1.5' }));
      // Inner circle (cable hole)
      svg.appendChild(svgEl('circle', { cx, cy, r: (p.cableDia / 2) * scale, fill: 'var(--bg-primary)', stroke: 'var(--text-muted)', 'stroke-width': '0.8', 'stroke-dasharray': '2,2' }));
      // Opening gap at top
      const gapW = (p.cableDia * 0.6) * scale;
      svg.appendChild(svgEl('rect', { x: cx - gapW / 2, y: cy - slotR * scale - 1, width: gapW, height: slotR * scale * 0.5, fill: 'var(--bg-primary)' }));

      // Cable label
      if (i === 0) {
        const lbl = svgEl('text', { x: cx, y: cy + 3, fill: 'var(--text-muted)', 'font-size': '8', 'text-anchor': 'middle', 'font-family': 'var(--font-mono)' });
        lbl.textContent = `\u00D8${p.cableDia}`;
        svg.appendChild(lbl);
      }
    }

    container.innerHTML = '';
    container.appendChild(svg);
  }

  // --- Shelf bracket preview ---
  function drawBracketPreview(container, p) {
    const svgW = 280, svgH = 260;
    const svg = createSvg(svgW, svgH);

    const maxDim = Math.max(p.depth, p.height);
    const scale = Math.min((svgW - 80) / p.depth, (svgH - 60) / p.height);

    // Origin at top-left corner of the L
    const ox = 40;
    const oy = 30;

    // Vertical plate (wall side)
    svg.appendChild(svgEl('rect', { x: ox, y: oy, width: p.thick * scale, height: p.height * scale, fill: 'var(--accent)', opacity: '0.25', stroke: 'var(--accent)', 'stroke-width': '1.5', rx: 1 }));

    // Horizontal plate (shelf side)
    const hpY = oy + p.height * scale - p.thick * scale;
    svg.appendChild(svgEl('rect', { x: ox, y: hpY, width: p.depth * scale, height: p.thick * scale, fill: 'var(--accent)', opacity: '0.25', stroke: 'var(--accent)', 'stroke-width': '1.5', rx: 1 }));

    // Gusset (diagonal brace)
    if (p.gusset > 0) {
      const gLen = Math.min(p.gusset, Math.min(p.depth, p.height) * 0.8);
      const gx = ox + p.thick * scale;
      const gy1 = hpY;
      const gy2 = hpY - gLen * scale;
      const gx2 = gx + gLen * scale;
      svg.appendChild(svgEl('polygon', {
        points: `${gx},${gy1} ${gx},${gy2} ${gx2},${gy1}`,
        fill: 'var(--warning)', opacity: '0.15', stroke: 'var(--warning)', 'stroke-width': '1', 'stroke-dasharray': '3,2'
      }));
    }

    // Screw holes on vertical plate
    const holeR = (p.screwDia / 2) * scale;
    const centerX = ox + p.thick * scale / 2;
    if (p.screwSpacing > 0 && p.height >= p.screwSpacing + 20) {
      const midY = oy + p.height * scale / 2;
      const h1y = midY - p.screwSpacing * scale / 2;
      const h2y = midY + p.screwSpacing * scale / 2;
      svg.appendChild(svgEl('circle', { cx: centerX, cy: h1y, r: holeR, fill: 'var(--bg-primary)', stroke: 'var(--text-muted)', 'stroke-width': '1' }));
      svg.appendChild(svgEl('circle', { cx: centerX, cy: h2y, r: holeR, fill: 'var(--bg-primary)', stroke: 'var(--text-muted)', 'stroke-width': '1' }));
    }

    // Dimensions
    addDimension(svg, ox, oy + p.height * scale + 2, ox + p.depth * scale, oy + p.height * scale + 2, `${p.depth}mm`, 12);
    addDimension(svg, ox - 2, oy, ox - 2, oy + p.height * scale, `${p.height}mm`, -16);

    container.innerHTML = '';
    container.appendChild(svg);
  }

  // --- Drawer organizer preview (top-down) ---
  function drawOrganizerPreview(container, p) {
    const svgW = 280, svgH = 240;
    const svg = createSvg(svgW, svgH);

    const orgL = p.drawerL - 2 * p.clearance;
    const orgW = p.drawerW - 2 * p.clearance;
    const scale = Math.min((svgW - 40) / orgL, (svgH - 50) / orgW);

    const ox = (svgW - orgL * scale) / 2;
    const oy = (svgH - orgW * scale) / 2;

    // Outer drawer (dashed)
    svg.appendChild(svgEl('rect', {
      x: ox - p.clearance * scale, y: oy - p.clearance * scale,
      width: p.drawerL * scale, height: p.drawerW * scale,
      fill: 'none', stroke: 'var(--text-muted)', 'stroke-width': '1', 'stroke-dasharray': '4,3', rx: 2
    }));

    // Organizer outer
    svg.appendChild(svgEl('rect', { x: ox, y: oy, width: orgL * scale, height: orgW * scale, fill: 'var(--accent)', opacity: '0.1', stroke: 'var(--accent)', 'stroke-width': '1.5', rx: 2 }));

    // Column dividers (vertical lines)
    const cellW = orgL / p.cols;
    for (let i = 1; i < p.cols; i++) {
      const lx = ox + i * cellW * scale;
      svg.appendChild(svgEl('line', { x1: lx, y1: oy, x2: lx, y2: oy + orgW * scale, stroke: 'var(--accent)', 'stroke-width': '1' }));
    }

    // Row dividers (horizontal lines)
    const cellH = orgW / p.rows;
    for (let j = 1; j < p.rows; j++) {
      const ly = oy + j * cellH * scale;
      svg.appendChild(svgEl('line', { x1: ox, y1: ly, x2: ox + orgL * scale, y2: ly, stroke: 'var(--accent)', 'stroke-width': '1' }));
    }

    // Cell size label in first cell
    const cellLabelX = ox + cellW * scale / 2;
    const cellLabelY = oy + cellH * scale / 2;
    const innerCellW = (cellW - p.wall).toFixed(1);
    const innerCellH = (cellH - p.wall).toFixed(1);
    const cellTxt = svgEl('text', { x: cellLabelX, y: cellLabelY, fill: 'var(--text-muted)', 'font-size': '8', 'text-anchor': 'middle', 'dominant-baseline': 'middle', 'font-family': 'var(--font-mono)' });
    cellTxt.textContent = `${innerCellW}x${innerCellH}`;
    svg.appendChild(cellTxt);

    // Grid label
    const gridTxt = svgEl('text', { x: svgW / 2, y: oy + orgW * scale + 16, fill: 'var(--text-secondary)', 'font-size': '10', 'text-anchor': 'middle', 'font-family': 'var(--font-mono)' });
    gridTxt.textContent = `${p.cols}x${p.rows} grid \u2022 ${orgL.toFixed(0)} x ${orgW.toFixed(0)}mm`;
    svg.appendChild(gridTxt);

    container.innerHTML = '';
    container.appendChild(svg);
  }

  // --- Knob/Handle preview (front cross-section) ---
  function drawKnobPreview(container, p) {
    const svgW = 280, svgH = 260;
    const svg = createSvg(svgW, svgH);

    const totalH = p.gripH + p.neckH + (p.flatBase > 0 ? 2 : 0);
    const maxDia = Math.max(p.gripDia, p.flatBase);
    const scale = Math.min((svgW - 60) / maxDia, (svgH - 50) / totalH);

    const cx = svgW / 2;
    const baseY = svgH - 30;

    let currentY = baseY;

    // Base flange
    if (p.flatBase > 0) {
      const fh = 2 * scale;
      const fw = p.flatBase * scale;
      svg.appendChild(svgEl('rect', { x: cx - fw / 2, y: currentY - fh, width: fw, height: fh, fill: 'var(--accent)', opacity: '0.2', stroke: 'var(--accent)', 'stroke-width': '1.5', rx: 2 }));
      currentY -= fh;
    }

    // Neck
    if (p.neckH > 0) {
      const nh = p.neckH * scale;
      const nw = p.neckDia * scale;
      svg.appendChild(svgEl('rect', { x: cx - nw / 2, y: currentY - nh, width: nw, height: nh, fill: 'var(--accent)', opacity: '0.25', stroke: 'var(--accent)', 'stroke-width': '1.5', rx: 2 }));
      currentY -= nh;
    }

    // Grip head (rounded rect / ellipse approximation)
    const gh = p.gripH * scale;
    const gw = p.gripDia * scale;
    svg.appendChild(svgEl('rect', { x: cx - gw / 2, y: currentY - gh, width: gw, height: gh, fill: 'var(--accent)', opacity: '0.3', stroke: 'var(--accent)', 'stroke-width': '1.5', rx: gw * 0.15 }));

    // Bolt hole (dashed line from bottom)
    const holeW = p.shaftDia * scale;
    const holeH = p.shaftDepth * scale;
    svg.appendChild(svgEl('rect', {
      x: cx - holeW / 2, y: baseY - holeH,
      width: holeW, height: holeH,
      fill: 'var(--bg-primary)', stroke: 'var(--text-muted)', 'stroke-width': '0.8', 'stroke-dasharray': '3,2', rx: 1
    }));

    // Dimensions
    addDimension(svg, cx - gw / 2, currentY - gh - 2, cx + gw / 2, currentY - gh - 2, `\u00D8${p.gripDia}`, -10);

    container.innerHTML = '';
    container.appendChild(svg);
  }


  // ================================================================
  //  PART GENERATOR LOGIC
  // ================================================================

  let activeTemplate = null;
  let paramValues = {};

  function initPartGenerator() {
    // Card click handlers
    document.querySelectorAll('.ws-template-card').forEach(card => {
      card.querySelector('.ws-template-btn').addEventListener('click', () => {
        openTemplate(card.dataset.template);
      });
    });

    // Back button
    document.getElementById('ws-partgen-back').addEventListener('click', closeTemplate);

    // Download spec
    document.getElementById('ws-btn-download-spec').addEventListener('click', downloadSpecification);

    // Copy dimensions
    document.getElementById('ws-btn-copy-dims').addEventListener('click', copyDimensions);
  }

  function openTemplate(templateId) {
    const tmpl = TEMPLATES[templateId];
    if (!tmpl) return;

    activeTemplate = templateId;
    paramValues = {};

    document.getElementById('ws-partgen-title').textContent = tmpl.name;
    document.getElementById('ws-partgen-subtitle').textContent = tmpl.subtitle;

    // Build param form
    const formEl = document.getElementById('ws-partgen-form');
    formEl.innerHTML = '';

    tmpl.params.forEach(param => {
      paramValues[param.id] = param.value;

      const group = document.createElement('div');
      group.className = 'ws-param-group';

      group.innerHTML = `
        <div class="ws-param-label">
          <span>${param.label}</span>
          <span class="ws-param-range-info">${param.min}${param.unit} - ${param.max}${param.unit}</span>
        </div>
        <div class="ws-param-input-row">
          <input type="range" class="range-slider" id="ws-slider-${param.id}"
            min="${param.min}" max="${param.max}" step="${param.step}" value="${param.value}">
          <input type="number" class="form-input" id="ws-input-${param.id}"
            min="${param.min}" max="${param.max}" step="${param.step}" value="${param.value}"
            style="width:80px;">
          <span class="ws-param-unit">${param.unit}</span>
        </div>
        <div class="text-sm text-muted" style="margin-top:2px; font-size:11px;">${param.desc}</div>
      `;

      formEl.appendChild(group);

      // Sync slider <-> input
      const slider = group.querySelector(`#ws-slider-${param.id}`);
      const input = group.querySelector(`#ws-input-${param.id}`);

      slider.addEventListener('input', () => {
        let v = parseFloat(slider.value);
        v = clampParam(param, v);
        input.value = v;
        paramValues[param.id] = v;
        updatePreview();
      });

      input.addEventListener('input', () => {
        let v = parseFloat(input.value);
        if (isNaN(v)) return;
        v = clampParam(param, v);
        slider.value = v;
        paramValues[param.id] = v;
        updatePreview();
      });

      input.addEventListener('blur', () => {
        let v = parseFloat(input.value);
        if (isNaN(v)) v = param.value;
        v = clampParam(param, v);
        input.value = v;
        slider.value = v;
        paramValues[param.id] = v;
        updatePreview();
      });
    });

    // Show workspace, hide grid
    document.getElementById('ws-template-grid').classList.add('hidden');
    document.getElementById('ws-partgen-workspace').classList.remove('hidden');

    updatePreview();
  }

  function clampParam(param, v) {
    return Math.max(param.min, Math.min(param.max, v));
  }

  function closeTemplate() {
    activeTemplate = null;
    document.getElementById('ws-template-grid').classList.remove('hidden');
    document.getElementById('ws-partgen-workspace').classList.add('hidden');
  }

  function updatePreview() {
    if (!activeTemplate) return;
    const tmpl = TEMPLATES[activeTemplate];

    // Draw SVG preview
    const previewContainer = document.getElementById('ws-preview-container');
    tmpl.preview(previewContainer, paramValues);

    // Update dimension readout
    const dimsEl = document.getElementById('ws-preview-dimensions');
    const p = paramValues;
    let dimsHTML = '';
    tmpl.params.forEach(param => {
      dimsHTML += `<span class="ws-dim-item"><span class="ws-dim-label">${param.label}:</span> <span class="ws-dim-value">${p[param.id]}${param.unit}</span></span>`;
    });
    dimsEl.innerHTML = dimsHTML;

    // Volume estimate
    const vol = tmpl.volume(p);
    const volCm3 = vol / 1000;
    const weightG = volCm3 * 1.24; // PLA density approx
    document.getElementById('ws-partgen-volume').textContent = `Est. volume: ${volCm3.toFixed(1)} cm\u00B3 \u2022 ~${weightG.toFixed(1)}g PLA`;
  }

  function downloadSpecification() {
    if (!activeTemplate) return;
    const tmpl = TEMPLATES[activeTemplate];
    const p = paramValues;

    let text = `=== ${tmpl.name} Specification ===\n`;
    text += `Generated by PrintHQ Design Workshop\n`;
    text += `Date: ${new Date().toISOString().slice(0, 10)}\n\n`;
    text += `--- Parameters ---\n`;
    tmpl.params.forEach(param => {
      text += `${param.label}: ${p[param.id]} ${param.unit}\n`;
    });
    text += `\n--- Computed ---\n`;
    const vol = tmpl.volume(p);
    text += `Estimated volume: ${(vol / 1000).toFixed(1)} cm\u00B3\n`;
    text += `Estimated weight (PLA): ${(vol / 1000 * 1.24).toFixed(1)} g\n`;

    // Add template-specific notes
    if (activeTemplate === 'box_with_lid') {
      text += `\nOuter dimensions: ${(p.length + 2 * p.wall).toFixed(1)} x ${(p.width + 2 * p.wall).toFixed(1)} x ${(p.height + p.wall).toFixed(1)} mm\n`;
      text += `Lid outer: ${(p.length + 2 * p.wall).toFixed(1)} x ${(p.width + 2 * p.wall).toFixed(1)} x ${(p.wall + p.lidDepth).toFixed(1)} mm\n`;
      text += `Lid lip inner: ${(p.length + 2 * p.lidTol).toFixed(1)} x ${(p.width + 2 * p.lidTol).toFixed(1)} mm\n`;
    }

    // Try to save via Electron API, fallback to clipboard
    if (window.api && window.api.saveFile) {
      window.api.saveFile(`${tmpl.name.replace(/\s+/g, '_')}_spec.txt`, text);
    } else {
      // Fallback: download via blob
      const blob = new Blob([text], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${tmpl.name.replace(/[\s/]+/g, '_')}_spec.txt`;
      a.click();
      URL.revokeObjectURL(url);
    }
  }

  function copyDimensions() {
    if (!activeTemplate) return;
    const tmpl = TEMPLATES[activeTemplate];
    const p = paramValues;

    let text = `${tmpl.name}: `;
    const parts = tmpl.params.map(param => `${param.label}=${p[param.id]}${param.unit}`);
    text += parts.join(', ');

    navigator.clipboard.writeText(text).then(() => {
      const btn = document.getElementById('ws-btn-copy-dims');
      const orig = btn.textContent;
      btn.textContent = 'Copied!';
      setTimeout(() => { btn.textContent = orig; }, 1500);
    }).catch(() => {});
  }


  // ================================================================
  //  MEASUREMENT WIZARD
  // ================================================================

  const MEASURE_CHECKLISTS = {
    enclosure: [
      { id: 'obj_length', title: 'Object Length (longest side)', hint: 'Measure the longest dimension of the object this will enclose. Add 1-2mm clearance.', unit: 'mm' },
      { id: 'obj_width',  title: 'Object Width', hint: 'Measure the second horizontal dimension.', unit: 'mm' },
      { id: 'obj_height', title: 'Object Height', hint: 'Measure from the base to the tallest point.', unit: 'mm' },
      { id: 'cable_dia',  title: 'Cable/Connector Openings (if any)', hint: 'Measure the diameter or width of any cables or connectors that need pass-through holes.', unit: 'mm' },
      { id: 'wall_min',   title: 'Desired Wall Thickness', hint: 'Recommended: 1.6-2.4mm for a sturdy enclosure.', unit: 'mm', default: 2.0 },
    ],
    replacement: [
      { id: 'part_length', title: 'Part Length', hint: 'Measure the full length of the original part.', unit: 'mm' },
      { id: 'part_width',  title: 'Part Width', hint: 'Measure the width at the widest point.', unit: 'mm' },
      { id: 'part_height', title: 'Part Height/Thickness', hint: 'Measure the height or thickness.', unit: 'mm' },
      { id: 'hole_dia',    title: 'Mounting Hole Diameter(s)', hint: 'Measure any mounting holes. Use calipers for best accuracy.', unit: 'mm' },
      { id: 'hole_spacing', title: 'Hole Spacing (center to center)', hint: 'Measure between hole centers, not edges.', unit: 'mm' },
      { id: 'special',     title: 'Any Special Features (radius, chamfer, etc.)', hint: 'Measure radii, chamfers, angles, or other geometry.', unit: 'mm' },
    ],
    adapter: [
      { id: 'side_a_dim',  title: 'Side A Dimension (what it connects to)', hint: 'Inner or outer diameter/width of the first connection point.', unit: 'mm' },
      { id: 'side_a_type', title: 'Side A Type', hint: 'Is it a male (outer) or female (inner) connection? This determines if you need inner or outer tolerance.', unit: '' },
      { id: 'side_b_dim',  title: 'Side B Dimension (what it connects to)', hint: 'Inner or outer diameter/width of the second connection point.', unit: 'mm' },
      { id: 'side_b_type', title: 'Side B Type', hint: 'Male or female?', unit: '' },
      { id: 'adapter_len', title: 'Adapter Length/Height', hint: 'Total length of the adapter between the two connection points.', unit: 'mm' },
    ],
    mount: [
      { id: 'obj_width',   title: 'Object Width/Diameter', hint: 'Width of the thing being mounted.', unit: 'mm' },
      { id: 'obj_depth',   title: 'Object Depth', hint: 'How far the object extends from the mounting surface.', unit: 'mm' },
      { id: 'obj_weight',  title: 'Object Weight (approx)', hint: 'Helps determine wall thickness and material choice.', unit: 'g' },
      { id: 'mount_spacing', title: 'Mounting Hole Spacing', hint: 'Distance between screws on the wall/surface.', unit: 'mm' },
      { id: 'screw_dia',   title: 'Screw Diameter', hint: 'M3=3mm, M4=4mm, M5=5mm, etc.', unit: 'mm' },
    ],
    cover: [
      { id: 'opening_l',  title: 'Opening Length', hint: 'Inner length of the opening to be covered.', unit: 'mm' },
      { id: 'opening_w',  title: 'Opening Width', hint: 'Inner width of the opening.', unit: 'mm' },
      { id: 'lip_depth',  title: 'Lip/Ledge Depth', hint: 'How deep the lip sits inside the opening (if any).', unit: 'mm' },
      { id: 'lip_width',  title: 'Ledge Width', hint: 'Width of the ledge the cover rests on (if any).', unit: 'mm' },
      { id: 'thickness',  title: 'Cover Thickness', hint: 'How thick the cover should be.', unit: 'mm', default: 2.0 },
    ],
    organizer: [
      { id: 'space_l', title: 'Available Space Length', hint: 'Inner length of the drawer/shelf.', unit: 'mm' },
      { id: 'space_w', title: 'Available Space Width', hint: 'Inner width.', unit: 'mm' },
      { id: 'space_h', title: 'Available Space Height', hint: 'How tall the organizer can be.', unit: 'mm' },
      { id: 'item_l',  title: 'Largest Item Length', hint: 'Length of the biggest item you want to store.', unit: 'mm' },
      { id: 'item_w',  title: 'Largest Item Width', hint: 'Width of the biggest item.', unit: 'mm' },
    ],
    custom: [
      { id: 'dim_1', title: 'Primary Dimension', hint: 'The most important measurement for your project.', unit: 'mm' },
      { id: 'dim_2', title: 'Secondary Dimension', hint: 'The second key measurement.', unit: 'mm' },
      { id: 'dim_3', title: 'Third Dimension', hint: 'Height, depth, or thickness.', unit: 'mm' },
      { id: 'notes', title: 'Special Notes', hint: 'Any angles, radii, or features to remember.', unit: '' },
    ]
  };

  const TOLERANCE_DATA = {
    press:  { label: 'Press Fit', perSide: 0.0,  total: '0.0 - 0.1mm', desc: 'Parts will be very tight. You may need to push or lightly tap to assemble. Good for permanent joins, bearing seats, and snap fits.' },
    snug:   { label: 'Snug / Sliding Fit', perSide: 0.15, total: '0.1 - 0.25mm per side', desc: 'Parts slide together smoothly but without slop. Good for drawer slides, lids, and hinges.' },
    loose:  { label: 'Loose / Clearance', perSide: 0.4,  total: '0.3 - 0.5mm per side', desc: 'Parts have a visible gap. Easy to assemble/disassemble. Good for bolt holes and loosely coupled parts.' }
  };

  const SHRINKAGE_DATA = {
    pla:   { name: 'PLA',   pct: 0.3, note: 'PLA has very low shrinkage. Your measurements can be nearly 1:1. Minor compensation of ~0.3% is rarely needed except for very large parts.' },
    petg:  { name: 'PETG',  pct: 0.4, note: 'PETG shrinks slightly more than PLA. For parts over 100mm, consider adding 0.4mm per 100mm of length.' },
    abs:   { name: 'ABS',   pct: 0.7, note: 'ABS has significant shrinkage. Scale your model up by ~0.7% or add 0.7mm per 100mm. Use an enclosure to reduce warping.' },
    asa:   { name: 'ASA',   pct: 0.6, note: 'ASA is similar to ABS but slightly less shrinkage. Scale up ~0.6% for large parts.' },
    nylon: { name: 'Nylon', pct: 1.5, note: 'Nylon shrinks the most of common filaments. Scale up by 1-2% and expect some post-print dimensional change as it absorbs moisture.' },
    tpu:   { name: 'TPU',   pct: 0.2, note: 'TPU has very low shrinkage. However, its flexibility means dimensions may not hold under force. Over-constrain fits by ~0.5mm for flexible applications.' }
  };

  let wizardStep = 0;
  let wizardData = {};

  function initMeasureWizard() {
    // Navigation buttons
    document.getElementById('ws-wizard-next-0').addEventListener('click', () => goWizardStep(1));
    document.getElementById('ws-wizard-back-1').addEventListener('click', () => goWizardStep(0));
    document.getElementById('ws-wizard-next-1').addEventListener('click', () => goWizardStep(2));
    document.getElementById('ws-wizard-back-2').addEventListener('click', () => goWizardStep(1));
    document.getElementById('ws-wizard-next-2').addEventListener('click', () => goWizardStep(3));
    document.getElementById('ws-wizard-back-3').addEventListener('click', () => goWizardStep(2));
    document.getElementById('ws-wizard-restart').addEventListener('click', restartWizard);
    document.getElementById('ws-wizard-copy-spec').addEventListener('click', copySpecSheet);

    // Fit type change
    document.getElementById('ws-measure-fit').addEventListener('change', updateToleranceRecommendation);
    document.getElementById('ws-measure-material').addEventListener('change', updateShrinkageNote);

    // Project type change builds checklist
    document.getElementById('ws-measure-type').addEventListener('change', () => {
      buildChecklist();
    });

    // Initial state
    updateToleranceRecommendation();
    updateShrinkageNote();
  }

  function goWizardStep(step) {
    // Validate current step before proceeding forward
    if (step > wizardStep) {
      if (wizardStep === 0) {
        const typeVal = document.getElementById('ws-measure-type').value;
        if (!typeVal) {
          document.getElementById('ws-measure-type').focus();
          return;
        }
        wizardData.type = typeVal;
        wizardData.description = document.getElementById('ws-measure-desc').value || 'Untitled project';
        buildChecklist();
      }
      if (wizardStep === 1) {
        collectMeasurements();
      }
      if (wizardStep === 2) {
        wizardData.fitType = document.getElementById('ws-measure-fit').value;
        wizardData.material = document.getElementById('ws-measure-material').value;
        generateSpecSheet();
      }
    }

    wizardStep = step;

    // Update progress indicator
    document.querySelectorAll('.ws-wizard-step').forEach(el => {
      const s = parseInt(el.dataset.step);
      el.classList.toggle('active', s === step);
      el.classList.toggle('completed', s < step);
    });

    // Show/hide panels
    document.querySelectorAll('.ws-wizard-panel').forEach((panel, i) => {
      panel.classList.toggle('active', i === step);
    });
  }

  function buildChecklist() {
    const type = document.getElementById('ws-measure-type').value;
    const items = MEASURE_CHECKLISTS[type] || MEASURE_CHECKLISTS.custom;
    const container = document.getElementById('ws-measure-checklist');

    container.innerHTML = '';
    items.forEach(item => {
      const div = document.createElement('div');
      div.className = 'ws-measure-item';
      div.dataset.measureId = item.id;

      const hasInput = item.unit !== '';
      div.innerHTML = `
        <input type="checkbox" class="ws-measure-check" id="ws-mcheck-${item.id}">
        <div class="ws-measure-item-content">
          <div class="ws-measure-item-title">${item.title}</div>
          <div class="ws-measure-item-hint">${item.hint}</div>
          ${hasInput ? `
          <div class="ws-measure-item-input">
            <input type="number" class="form-input" id="ws-mval-${item.id}"
              step="0.1" placeholder="0.0" value="${item.default || ''}">
            <span class="ws-param-unit">${item.unit}</span>
          </div>` : `
          <div class="ws-measure-item-input">
            <input type="text" class="form-input" id="ws-mval-${item.id}" placeholder="Notes..." style="width:200px;">
          </div>`}
        </div>
      `;
      container.appendChild(div);

      // Checkbox toggles completed style
      const check = div.querySelector('.ws-measure-check');
      check.addEventListener('change', () => {
        div.classList.toggle('completed', check.checked);
      });

      // Auto-check when value entered
      const input = div.querySelector(`#ws-mval-${item.id}`);
      input.addEventListener('input', () => {
        if (input.value.trim()) {
          check.checked = true;
          div.classList.add('completed');
        }
      });
    });
  }

  function collectMeasurements() {
    const type = wizardData.type || 'custom';
    const items = MEASURE_CHECKLISTS[type] || MEASURE_CHECKLISTS.custom;
    wizardData.measurements = {};

    items.forEach(item => {
      const input = document.getElementById(`ws-mval-${item.id}`);
      if (input) {
        wizardData.measurements[item.id] = {
          label: item.title,
          value: input.value,
          unit: item.unit
        };
      }
    });
  }

  function updateToleranceRecommendation() {
    const fit = document.getElementById('ws-measure-fit').value;
    const data = TOLERANCE_DATA[fit];
    const el = document.getElementById('ws-tolerance-recommendation');
    el.innerHTML = `
      <strong>${data.label}</strong> (${data.total})<br>
      <span class="text-muted">${data.desc}</span>
    `;
  }

  function updateShrinkageNote() {
    const mat = document.getElementById('ws-measure-material').value;
    const data = SHRINKAGE_DATA[mat];
    document.getElementById('ws-shrinkage-note').textContent = data ? data.note : '';
  }

  function generateSpecSheet() {
    const el = document.getElementById('ws-spec-sheet');
    const fit = TOLERANCE_DATA[wizardData.fitType] || TOLERANCE_DATA.snug;
    const mat = SHRINKAGE_DATA[wizardData.material] || SHRINKAGE_DATA.pla;

    let html = `<div class="ws-spec-header">Specification Sheet: ${escHtml(wizardData.description)}</div>`;
    html += `<div class="ws-spec-section">
      <div class="ws-spec-section-title">Project Info</div>
      <div class="ws-spec-row"><span class="ws-spec-label">Type:</span> <span class="ws-spec-value">${escHtml(wizardData.type)}</span></div>
      <div class="ws-spec-row"><span class="ws-spec-label">Fit:</span> <span class="ws-spec-value">${fit.label} (${fit.total})</span></div>
      <div class="ws-spec-row"><span class="ws-spec-label">Material:</span> <span class="ws-spec-value">${mat.name} (~${mat.pct}% shrinkage)</span></div>
    </div>`;

    html += `<div class="ws-spec-section">
      <div class="ws-spec-section-title">Raw Measurements</div>`;
    for (const [key, m] of Object.entries(wizardData.measurements || {})) {
      if (m.value) {
        html += `<div class="ws-spec-row"><span class="ws-spec-label">${escHtml(m.label)}:</span> <span class="ws-spec-value">${escHtml(m.value)} ${escHtml(m.unit)}</span></div>`;
      }
    }
    html += `</div>`;

    // Adjusted measurements (with tolerance + shrinkage)
    html += `<div class="ws-spec-section">
      <div class="ws-spec-section-title">Adjusted for Print (tolerance + shrinkage)</div>`;
    for (const [key, m] of Object.entries(wizardData.measurements || {})) {
      const numVal = parseFloat(m.value);
      if (!isNaN(numVal) && m.unit === 'mm') {
        const shrinkComp = numVal * (mat.pct / 100);
        const tolComp = fit.perSide * 2;
        const adjusted = numVal + shrinkComp + tolComp;
        html += `<div class="ws-spec-row"><span class="ws-spec-label">${escHtml(m.label)}:</span> <span class="ws-spec-value">${adjusted.toFixed(2)} mm</span></div>`;
        html += `<div class="ws-spec-row" style="padding-left:16px;"><span class="ws-spec-label text-muted">(base ${numVal} + tol ${tolComp.toFixed(2)} + shrink ${shrinkComp.toFixed(2)})</span></div>`;
      }
    }
    html += `</div>`;

    html += `<div class="ws-spec-section">
      <div class="ws-spec-section-title">Printing Notes</div>
      <div>${escHtml(mat.note)}</div>
    </div>`;

    el.innerHTML = html;
  }

  function copySpecSheet() {
    const el = document.getElementById('ws-spec-sheet');
    const text = el.innerText;
    navigator.clipboard.writeText(text).then(() => {
      const btn = document.getElementById('ws-wizard-copy-spec');
      const orig = btn.textContent;
      btn.textContent = 'Copied!';
      setTimeout(() => { btn.textContent = orig; }, 1500);
    }).catch(() => {});
  }

  function restartWizard() {
    wizardStep = 0;
    wizardData = {};
    document.getElementById('ws-measure-type').value = '';
    document.getElementById('ws-measure-desc').value = '';
    document.getElementById('ws-measure-checklist').innerHTML = '';
    goWizardStep(0);
  }


  // ================================================================
  //  STL FILE ANALYZER
  // ================================================================

  function initStlFix() {
    const dropzone = document.getElementById('ws-stl-dropzone');
    const fileInput = document.getElementById('ws-stl-file-input');

    // Click to browse
    dropzone.addEventListener('click', () => fileInput.click());

    // Drag events
    dropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropzone.classList.add('dragover');
    });
    dropzone.addEventListener('dragleave', () => {
      dropzone.classList.remove('dragover');
    });
    dropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropzone.classList.remove('dragover');
      const file = e.dataTransfer.files[0];
      if (file && file.name.toLowerCase().endsWith('.stl')) {
        loadStlFile(file);
      }
    });

    // File input change
    fileInput.addEventListener('change', () => {
      if (fileInput.files[0]) {
        loadStlFile(fileInput.files[0]);
      }
    });

    // Clear button
    document.getElementById('ws-stl-clear').addEventListener('click', clearStl);
  }

  function loadStlFile(file) {
    document.getElementById('ws-stl-filename').textContent = file.name;
    document.getElementById('ws-stl-filesize').textContent = formatFileSize(file.size);
    document.getElementById('ws-stl-fileinfo').classList.remove('hidden');
    document.getElementById('ws-stl-analyzing').classList.remove('hidden');
    document.getElementById('ws-stl-results').classList.add('hidden');
    document.getElementById('ws-stl-repair-section').classList.add('hidden');

    const reader = new FileReader();
    reader.onload = (e) => {
      const buffer = e.target.result;
      setTimeout(() => {
        try {
          const results = analyzeStlBinary(buffer);
          displayStlResults(results);
        } catch (err) {
          displayStlError(err.message);
        }
      }, 100);
    };
    reader.readAsArrayBuffer(file);
  }

  function analyzeStlBinary(buffer) {
    const view = new DataView(buffer);

    // Binary STL: 80 byte header + 4 byte triangle count + 50 bytes per triangle
    if (buffer.byteLength < 84) {
      throw new Error('File too small to be a valid STL');
    }

    // Check if this might be ASCII STL
    const headerBytes = new Uint8Array(buffer, 0, 5);
    const headerStr = String.fromCharCode(...headerBytes);
    if (headerStr === 'solid') {
      // Could be ASCII - check further
      const fullHeader = new Uint8Array(buffer, 0, Math.min(80, buffer.byteLength));
      const fullStr = String.fromCharCode(...fullHeader);
      // If it has newlines early, it's likely ASCII
      if (fullStr.includes('\n')) {
        throw new Error('This appears to be an ASCII STL file. Only binary STL is supported currently.');
      }
    }

    const numTriangles = view.getUint32(80, true);
    const expectedSize = 84 + numTriangles * 50;

    const sizeMismatch = Math.abs(buffer.byteLength - expectedSize) > 10;

    // Parse all triangles
    const vertices = new Map(); // position string -> index
    let uniqueVertexCount = 0;
    let degenerateCount = 0;
    let flippedNormalCount = 0;
    let nonManifoldEdges = 0;

    const edgeMap = new Map(); // "v1_v2" -> count

    const bbox = {
      minX: Infinity, minY: Infinity, minZ: Infinity,
      maxX: -Infinity, maxY: -Infinity, maxZ: -Infinity
    };

    const triangleCount = Math.min(numTriangles, (buffer.byteLength - 84) / 50 | 0);

    for (let i = 0; i < triangleCount; i++) {
      const offset = 84 + i * 50;

      // Normal vector
      const nx = view.getFloat32(offset, true);
      const ny = view.getFloat32(offset + 4, true);
      const nz = view.getFloat32(offset + 8, true);

      // Three vertices
      const verts = [];
      for (let v = 0; v < 3; v++) {
        const voff = offset + 12 + v * 12;
        const x = view.getFloat32(voff, true);
        const y = view.getFloat32(voff + 4, true);
        const z = view.getFloat32(voff + 8, true);
        verts.push({ x, y, z });

        // Track unique vertices (rounded to avoid floating point issues)
        const key = `${x.toFixed(4)}_${y.toFixed(4)}_${z.toFixed(4)}`;
        if (!vertices.has(key)) {
          vertices.set(key, uniqueVertexCount++);
        }

        // Update bounding box
        bbox.minX = Math.min(bbox.minX, x);
        bbox.minY = Math.min(bbox.minY, y);
        bbox.minZ = Math.min(bbox.minZ, z);
        bbox.maxX = Math.max(bbox.maxX, x);
        bbox.maxY = Math.max(bbox.maxY, y);
        bbox.maxZ = Math.max(bbox.maxZ, z);
      }

      // Check for degenerate triangle (zero area)
      const e1x = verts[1].x - verts[0].x, e1y = verts[1].y - verts[0].y, e1z = verts[1].z - verts[0].z;
      const e2x = verts[2].x - verts[0].x, e2y = verts[2].y - verts[0].y, e2z = verts[2].z - verts[0].z;
      const crossX = e1y * e2z - e1z * e2y;
      const crossY = e1z * e2x - e1x * e2z;
      const crossZ = e1x * e2y - e1y * e2x;
      const area = Math.sqrt(crossX * crossX + crossY * crossY + crossZ * crossZ) / 2;

      if (area < 1e-10) {
        degenerateCount++;
      } else {
        // Check normal consistency (computed vs stored)
        const compLen = Math.sqrt(crossX * crossX + crossY * crossY + crossZ * crossZ);
        if (compLen > 1e-10) {
          const cnx = crossX / compLen, cny = crossY / compLen, cnz = crossZ / compLen;
          const storedLen = Math.sqrt(nx * nx + ny * ny + nz * nz);
          if (storedLen > 1e-10) {
            const snx = nx / storedLen, sny = ny / storedLen, snz = nz / storedLen;
            const dot = cnx * snx + cny * sny + cnz * snz;
            if (dot < -0.1) {
              flippedNormalCount++;
            }
          }
        }
      }

      // Track edges for manifold check (using vertex keys)
      for (let e = 0; e < 3; e++) {
        const v1 = verts[e], v2 = verts[(e + 1) % 3];
        const k1 = `${v1.x.toFixed(4)}_${v1.y.toFixed(4)}_${v1.z.toFixed(4)}`;
        const k2 = `${v2.x.toFixed(4)}_${v2.y.toFixed(4)}_${v2.z.toFixed(4)}`;
        // Use sorted key so both directions are tracked under one key
        const edgeKey = k1 < k2 ? `${k1}|${k2}` : `${k2}|${k1}`;
        edgeMap.set(edgeKey, (edgeMap.get(edgeKey) || 0) + 1);
      }
    }

    // Non-manifold edges: edges shared by != 2 triangles
    for (const [, count] of edgeMap) {
      if (count !== 2) {
        nonManifoldEdges++;
      }
    }

    const bboxSize = {
      x: bbox.maxX - bbox.minX,
      y: bbox.maxY - bbox.minY,
      z: bbox.maxZ - bbox.minZ
    };

    return {
      triangleCount,
      declaredTriangles: numTriangles,
      uniqueVertexCount,
      bbox: bboxSize,
      degenerateCount,
      flippedNormalCount,
      nonManifoldEdges,
      sizeMismatch,
      edgeCount: edgeMap.size,
      totalEdges: triangleCount * 3
    };
  }

  function displayStlResults(r) {
    document.getElementById('ws-stl-analyzing').classList.add('hidden');
    document.getElementById('ws-stl-results').classList.remove('hidden');

    // Summary stats
    document.getElementById('ws-stl-triangles').textContent = r.triangleCount.toLocaleString();
    document.getElementById('ws-stl-vertices').textContent = r.uniqueVertexCount.toLocaleString();
    document.getElementById('ws-stl-bbox').textContent = `${r.bbox.x.toFixed(1)} x ${r.bbox.y.toFixed(1)} x ${r.bbox.z.toFixed(1)}`;

    // Diagnostic checks
    const checks = document.getElementById('ws-stl-checks');
    checks.innerHTML = '';

    const addCheck = (name, detail, value, status) => {
      const div = document.createElement('div');
      div.className = `ws-stl-check ${status}`;
      const icon = status === 'pass' ? '\u2705' : status === 'warn' ? '\u26A0\uFE0F' : '\u274C';
      div.innerHTML = `
        <div class="ws-stl-check-icon">${icon}</div>
        <div class="ws-stl-check-info">
          <div class="ws-stl-check-name">${name}</div>
          <div class="ws-stl-check-detail">${detail}</div>
        </div>
        <div class="ws-stl-check-value">${value}</div>
      `;
      checks.appendChild(div);
    };

    // Triangle count sanity
    if (r.sizeMismatch) {
      addCheck('File Integrity', 'File size does not match declared triangle count. The file may be truncated or corrupted.', `${r.declaredTriangles} declared / ${r.triangleCount} found`, 'warn');
    } else {
      addCheck('File Integrity', 'File size matches declared triangle count.', `${r.triangleCount} triangles`, 'pass');
    }

    // Non-manifold edges
    if (r.nonManifoldEdges === 0) {
      addCheck('Manifold Edges', 'All edges are shared by exactly 2 triangles. The mesh is watertight.', 'Clean', 'pass');
    } else if (r.nonManifoldEdges < 10) {
      addCheck('Non-Manifold Edges', 'Some edges are shared by more or fewer than 2 triangles. The mesh has small gaps or overlapping faces.', r.nonManifoldEdges.toString(), 'warn');
    } else {
      addCheck('Non-Manifold Edges', 'Many edges are not shared by exactly 2 triangles. The mesh has significant holes or overlaps. Repair needed.', r.nonManifoldEdges.toString(), 'fail');
    }

    // Flipped normals
    if (r.flippedNormalCount === 0) {
      addCheck('Normal Consistency', 'All face normals point outward consistently.', 'Consistent', 'pass');
    } else if (r.flippedNormalCount < r.triangleCount * 0.05) {
      addCheck('Flipped Normals', 'A few face normals point inward. The slicer may interpret these as inside-out surfaces.', r.flippedNormalCount.toString(), 'warn');
    } else {
      addCheck('Flipped Normals', 'Many normals are flipped. This will cause rendering and slicing errors. Recalculate normals in your CAD tool.', r.flippedNormalCount.toString(), 'fail');
    }

    // Degenerate triangles (zero-area)
    if (r.degenerateCount === 0) {
      addCheck('Zero-Area Faces', 'No degenerate (zero-area) triangles found.', 'None', 'pass');
    } else if (r.degenerateCount < 5) {
      addCheck('Zero-Area Faces', 'A few triangles have zero area. These are harmless in most slicers but indicate messy geometry.', r.degenerateCount.toString(), 'warn');
    } else {
      addCheck('Zero-Area Faces', 'Many zero-area triangles. This indicates overlapping vertices or collapsed geometry. Clean up in your CAD tool.', r.degenerateCount.toString(), 'fail');
    }

    // Model size check
    const maxDim = Math.max(r.bbox.x, r.bbox.y, r.bbox.z);
    const minDim = Math.min(r.bbox.x, r.bbox.y, r.bbox.z);
    if (maxDim > 500) {
      addCheck('Model Size', 'The model may be too large for most consumer 3D printers. Check if units are correct (mm vs inches vs meters).', `${maxDim.toFixed(0)}mm max`, 'warn');
    } else if (maxDim < 1) {
      addCheck('Model Size', 'The model is very small. It may be in meters instead of millimeters. Try scaling by 1000x.', `${maxDim.toFixed(3)}mm max`, 'warn');
    } else {
      addCheck('Model Size', 'Model dimensions are within typical 3D printer build volumes.', `${maxDim.toFixed(1)}mm max`, 'pass');
    }

    // Triangle density
    const surfaceArea = r.bbox.x * r.bbox.y * 2 + r.bbox.y * r.bbox.z * 2 + r.bbox.x * r.bbox.z * 2;
    const density = surfaceArea > 0 ? r.triangleCount / surfaceArea : 0;
    if (r.triangleCount > 500000) {
      addCheck('Triangle Count', 'Very high triangle count. Consider decimating the mesh for faster slicing, especially if this is an organic/sculpted model.', `${(r.triangleCount / 1000).toFixed(0)}K`, 'warn');
    } else {
      addCheck('Triangle Count', 'Triangle count is reasonable for slicing.', `${(r.triangleCount / 1000).toFixed(1)}K`, 'pass');
    }
  }

  function displayStlError(msg) {
    document.getElementById('ws-stl-analyzing').classList.add('hidden');
    document.getElementById('ws-stl-results').classList.remove('hidden');

    const checks = document.getElementById('ws-stl-checks');
    checks.innerHTML = `
      <div class="ws-stl-check fail">
        <div class="ws-stl-check-icon">\u274C</div>
        <div class="ws-stl-check-info">
          <div class="ws-stl-check-name">Analysis Failed</div>
          <div class="ws-stl-check-detail">${escHtml(msg)}</div>
        </div>
      </div>
    `;
    document.getElementById('ws-stl-triangles').textContent = '-';
    document.getElementById('ws-stl-vertices').textContent = '-';
    document.getElementById('ws-stl-bbox').textContent = '-';
  }

  function clearStl() {
    document.getElementById('ws-stl-fileinfo').classList.add('hidden');
    document.getElementById('ws-stl-file-input').value = '';
  }

  function formatFileSize(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }


  // ================================================================
  //  CAD LINKS
  // ================================================================

  function initCadLinks() {
    document.querySelectorAll('.ws-cad-link').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const url = link.dataset.url;
        // Use Electron shell.openExternal if available, otherwise window.open
        if (window.api && window.api.openExternal) {
          window.api.openExternal(url);
        } else {
          window.open(url, '_blank');
        }
      });
    });
  }


  // ================================================================
  //  TABS & INIT
  // ================================================================

  function escHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function init() {
    // Initialize tabs (uses global initTabs from renderer.js)
    // initTabs expects a container that wraps both .tab-btn and .tab-panel elements
    if (typeof initTabs === 'function') {
      initTabs('#workshop-module');
    }

    // Initialize all sub-systems
    initPartGenerator();
    initMeasureWizard();
    initStlFix();
    initCadLinks();
  }

  // Run init. The module JS is loaded via a <script> tag after the HTML is in the DOM.
  init();

})();
