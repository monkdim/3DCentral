// G-code file parsing engine — client-side only

window.gcodeParser = {
  parse(gcodeText) {
    const lines = gcodeText.split('\n');
    const result = {
      layerCount: 0,
      layerHeight: 0,
      firstLayerHeight: 0,
      estimatedTime_min: 0,
      filamentLength_mm: 0,
      filamentWeight_g: 0,
      maxX: 0, maxY: 0, maxZ: 0,
      minX: Infinity, minY: Infinity,
      nozzleTemp: 0,
      bedTemp: 0,
      maxSpeed: 0,
      retractionCount: 0,
      retractionDistance: 0,
      travelDistance: 0,
      printMoves: 0,
      travelMoves: 0,
      warnings: []
    };

    let currentZ = 0;
    let lastX = 0, lastY = 0, lastZ = 0;
    let lastE = 0;
    let currentE = 0;
    let isAbsoluteE = true;
    let layerHeights = new Set();
    let speedValues = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line || line.startsWith(';')) {
        // Parse slicer comments for metadata
        if (line.startsWith(';TIME:') || line.startsWith('; estimated printing time')) {
          const match = line.match(/(\d+)/);
          if (match) {
            const val = parseInt(match[1]);
            if (line.includes('TIME:')) {
              result.estimatedTime_min = Math.round(val / 60);
            }
          }
        }
        if (line.startsWith(';Filament used:') || line.startsWith('; filament used')) {
          const match = line.match(/([\d.]+)\s*m/);
          if (match) {
            result.filamentLength_mm = parseFloat(match[1]) * 1000;
          }
        }
        continue;
      }

      const cmd = line.split(';')[0].trim();
      if (!cmd) continue;

      const parts = cmd.split(/\s+/);
      const code = parts[0];

      const params = {};
      for (let j = 1; j < parts.length; j++) {
        const p = parts[j];
        if (p.length > 0) {
          params[p[0]] = parseFloat(p.substring(1));
        }
      }

      // Movement commands
      if (code === 'G0' || code === 'G1') {
        const x = params.X !== undefined ? params.X : lastX;
        const y = params.Y !== undefined ? params.Y : lastY;
        const z = params.Z !== undefined ? params.Z : lastZ;
        const e = params.E !== undefined ? params.E : (isAbsoluteE ? currentE : 0);
        const f = params.F;

        if (f) speedValues.push(f / 60); // Convert mm/min to mm/s

        if (z !== lastZ) {
          currentZ = z;
          if (z > 0) {
            layerHeights.add(parseFloat(z.toFixed(3)));
          }
          result.maxZ = Math.max(result.maxZ, z);
        }

        if (params.X !== undefined || params.Y !== undefined) {
          result.maxX = Math.max(result.maxX, x);
          result.maxY = Math.max(result.maxY, y);
          result.minX = Math.min(result.minX, x);
          result.minY = Math.min(result.minY, y);

          const dist = Math.sqrt((x - lastX) ** 2 + (y - lastY) ** 2);
          const eChange = isAbsoluteE ? (e - currentE) : e;

          if (eChange > 0) {
            result.printMoves++;
          } else if (eChange < 0) {
            result.retractionCount++;
            result.retractionDistance += Math.abs(eChange);
          } else {
            result.travelMoves++;
            result.travelDistance += dist;
          }
        }

        lastX = x;
        lastY = y;
        lastZ = z;
        if (isAbsoluteE) {
          currentE = e;
        }
      }

      // Absolute/relative extrusion
      if (code === 'M82') isAbsoluteE = true;
      if (code === 'M83') isAbsoluteE = false;
      if (code === 'G92' && params.E !== undefined) {
        currentE = params.E;
      }

      // Temperature commands
      if ((code === 'M104' || code === 'M109') && params.S) {
        result.nozzleTemp = Math.max(result.nozzleTemp, params.S);
      }
      if ((code === 'M140' || code === 'M190') && params.S) {
        result.bedTemp = Math.max(result.bedTemp, params.S);
      }
    }

    // Post-process
    const sortedHeights = [...layerHeights].sort((a, b) => a - b);
    result.layerCount = sortedHeights.length;

    if (sortedHeights.length >= 2) {
      result.firstLayerHeight = sortedHeights[0];
      const diffs = [];
      for (let i = 1; i < Math.min(sortedHeights.length, 20); i++) {
        diffs.push(parseFloat((sortedHeights[i] - sortedHeights[i - 1]).toFixed(3)));
      }
      // Most common layer height difference
      const counts = {};
      diffs.forEach(d => { counts[d] = (counts[d] || 0) + 1; });
      result.layerHeight = parseFloat(
        Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || 0.2
      );
    }

    if (speedValues.length > 0) {
      result.maxSpeed = Math.round(Math.max(...speedValues));
    }

    // Filament weight estimate (PLA density ~1.24 g/cm³, 1.75mm filament)
    if (result.filamentLength_mm > 0) {
      const r = 1.75 / 2; // mm
      const volume_mm3 = Math.PI * r * r * result.filamentLength_mm;
      result.filamentWeight_g = parseFloat((volume_mm3 * 1.24 / 1000).toFixed(1));
    }

    // Dimensions
    if (result.minX === Infinity) result.minX = 0;
    if (result.minY === Infinity) result.minY = 0;

    result.dimensions = {
      x: parseFloat((result.maxX - result.minX).toFixed(1)),
      y: parseFloat((result.maxY - result.minY).toFixed(1)),
      z: parseFloat(result.maxZ.toFixed(1))
    };

    // Red flag detection
    this._detectWarnings(result);

    return result;
  },

  _detectWarnings(result) {
    if (result.dimensions.x < 0.4 || result.dimensions.y < 0.4) {
      result.warnings.push({
        level: 'warning',
        message: 'Very thin dimensions detected — may be too thin to print reliably.'
      });
    }
    if (result.retractionCount > 5000) {
      result.warnings.push({
        level: 'warning',
        message: `High retraction count (${result.retractionCount}) — increased clogging risk.`
      });
    }
    if (result.estimatedTime_min > 600 && result.layerHeight > 0.15) {
      result.warnings.push({
        level: 'info',
        message: 'Long print with moderate detail. Consider thicker layers to save time.'
      });
    }
    if (result.nozzleTemp > 260) {
      result.warnings.push({
        level: 'warning',
        message: `High nozzle temperature (${result.nozzleTemp}°C) — ensure all-metal hotend.`
      });
    }
    if (result.bedTemp === 0 && result.printMoves > 100) {
      result.warnings.push({
        level: 'error',
        message: 'No heated bed commands detected — adhesion issues likely.'
      });
    }
  },

  formatTime(minutes) {
    const hrs = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hrs > 0) return `${hrs}h ${mins}m`;
    return `${mins}m`;
  }
};
