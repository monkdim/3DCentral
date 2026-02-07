// Printer hardware profiles — editable defaults for both machines

window.printerProfiles = {
  bambu_a1: {
    id: 'bambu_a1',
    name: 'Bambu Lab A1 Combo',
    shortName: 'Bambu A1',
    buildVolume: { x: 256, y: 256, z: 256 },
    maxSpeed: 500,
    maxBedTemp: 100,
    maxNozzleTemp: 300,
    nozzleSize: 0.4,
    hasEnclosure: false,
    bedSurface: 'PEI textured plate',
    directDrive: true,
    features: ['LiDAR', 'Auto-calibration', 'Vibration compensation'],
    ams: {
      type: 'AMS Lite',
      units: 1,
      slotsPerUnit: 4,
      totalSlots: 4
    },
    supportedMaterials: ['PLA', 'PLA+', 'PETG', 'TPU', 'PVA', 'PLA-CF'],
    ecosystem: 'Bambu Studio',
    notes: 'Fast and reliable. No enclosure limits high-temp materials.'
  },
  kobra_s1: {
    id: 'kobra_s1',
    name: 'Anycubic Kobra S1 Combo',
    shortName: 'Kobra S1',
    buildVolume: { x: 220, y: 220, z: 250 },
    maxSpeed: 300,
    maxBedTemp: 110,
    maxNozzleTemp: 300,
    nozzleSize: 0.4,
    hasEnclosure: false,
    bedSurface: 'PEI spring steel',
    directDrive: true,
    features: ['Dual Ace Pro', '8-color capability', 'Direct drive'],
    ams: {
      type: 'Ace Pro',
      units: 2,
      slotsPerUnit: 4,
      totalSlots: 8
    },
    supportedMaterials: ['PLA', 'PLA+', 'PETG', 'TPU', 'ABS', 'ASA'],
    ecosystem: 'Anycubic Slicer / Cura',
    notes: '8-color capability with dual Ace Pro units. Great for multi-color prints.'
  }
};
