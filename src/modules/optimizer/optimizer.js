// Strength & Settings Optimizer Module

(function () {
  'use strict';

  // ======================================================================
  // BUILT-IN PRINT PROFILES (recipes)
  // ======================================================================

  const BUILTIN_PROFILES = [
    {
      id: 'builtin-bulletproof',
      name: 'Bulletproof Functional Part',
      printer: 'both',
      material: 'PETG',
      useCase: 'structural',
      builtin: true,
      settings: {
        layerHeight: 0.20,
        infill: 40,
        infillPattern: 'cubic',
        wallCount: 4,
        topLayers: 5,
        bottomLayers: 5,
        speed: 150,
        nozzleTemp: 240,
        bedTemp: 80
      },
      notes: 'Tested on shelf brackets and tool holders. Excellent layer adhesion with PETG. 4 walls provide impact resistance on edges.',
      tags: ['strong', 'structural', 'tested']
    },
    {
      id: 'builtin-fastdraft',
      name: 'Fast Draft',
      printer: 'both',
      material: 'PLA',
      useCase: 'fast',
      builtin: true,
      settings: {
        layerHeight: 0.28,
        infill: 10,
        infillPattern: 'lightning',
        wallCount: 2,
        topLayers: 3,
        bottomLayers: 3,
        speed: 250,
        nozzleTemp: 215,
        bedTemp: 60
      },
      notes: 'For rapid prototypes and fit checks. Lightning infill minimizes material and time. Not for load-bearing parts.',
      tags: ['fast', 'prototype', 'low-material']
    },
    {
      id: 'builtin-display',
      name: 'Display Piece',
      printer: 'both',
      material: 'PLA',
      useCase: 'display',
      builtin: true,
      settings: {
        layerHeight: 0.12,
        infill: 15,
        infillPattern: 'gyroid',
        wallCount: 3,
        topLayers: 6,
        bottomLayers: 4,
        speed: 100,
        nozzleTemp: 210,
        bedTemp: 60
      },
      notes: 'Optimized for surface quality and detail. Fine layer height hides lines. Extra top layers for smooth ceilings. Slow speed reduces artifacts.',
      tags: ['display', 'quality', 'detailed']
    },
    {
      id: 'builtin-flexible',
      name: 'Flexible Part',
      printer: 'both',
      material: 'TPU',
      useCase: 'flexible',
      builtin: true,
      settings: {
        layerHeight: 0.20,
        infill: 15,
        infillPattern: 'gyroid',
        wallCount: 3,
        topLayers: 4,
        bottomLayers: 4,
        speed: 35,
        nozzleTemp: 225,
        bedTemp: 50
      },
      notes: 'For phone cases, gaskets, vibration dampeners. Very slow speed is critical for TPU. Gyroid infill gives even flex in all directions. Disable or minimize retraction.',
      tags: ['flexible', 'tpu', 'slow']
    },
    {
      id: 'builtin-mechanical',
      name: 'Mechanical Parts',
      printer: 'both',
      material: 'PLA+',
      useCase: 'mechanical',
      builtin: true,
      settings: {
        layerHeight: 0.16,
        infill: 30,
        infillPattern: 'grid',
        wallCount: 4,
        topLayers: 5,
        bottomLayers: 5,
        speed: 120,
        nozzleTemp: 215,
        bedTemp: 60
      },
      notes: 'For gears, hinges, clips, and moving parts. Grid infill handles multi-directional loads. 0.16mm layer gives good tolerance for interlocking pieces. PLA+ gives better impact resistance than standard PLA.',
      tags: ['mechanical', 'gears', 'functional']
    },
    {
      id: 'builtin-outdoor',
      name: 'Outdoor / UV Resistant',
      printer: 'kobra_s1',
      material: 'ASA',
      useCase: 'outdoor',
      builtin: true,
      settings: {
        layerHeight: 0.20,
        infill: 30,
        infillPattern: 'cubic',
        wallCount: 4,
        topLayers: 5,
        bottomLayers: 5,
        speed: 100,
        nozzleTemp: 250,
        bedTemp: 100
      },
      notes: 'ASA is UV-stable and weather-resistant. Requires enclosure or draft-free environment. Use glue stick on PEI bed. If you lack an enclosure, use PETG as a compromise.',
      tags: ['outdoor', 'uv', 'weather', 'asa']
    }
  ];

  // ======================================================================
  // INFILL PATTERN DATA
  // ======================================================================

  const INFILL_PATTERNS = {
    grid: {
      name: 'Grid',
      ascii: [
        '| | | | | | |',
        '-+-+-+-+-+-+-',
        '| | | | | | |',
        '-+-+-+-+-+-+-',
        '| | | | | | |',
        '-+-+-+-+-+-+-',
        '| | | | | | |'
      ].join('\n'),
      strengthXY: 4,
      strengthZ: 3,
      printSpeed: 4,
      materialUse: 3,
      description: 'Perpendicular lines crossing at 90 degrees. Strong in both X and Y axes. Simple and fast to print.',
      useCases: 'General-purpose parts, mechanical components, anything needing multi-directional strength on the horizontal plane.',
      slicers: ['Bambu Studio', 'Cura', 'PrusaSlicer', 'OrcaSlicer'],
      strengthFactor: 1.0
    },
    gyroid: {
      name: 'Gyroid',
      ascii: [
        ' ~  /~  /~  /',
        '/  ~  /~  /~ ',
        '~  /~  /~  / ',
        ' /~  /~  /~  ',
        '~  /~  /~  / ',
        '/  ~  /~  /~ ',
        ' ~  /~  /~  /'
      ].join('\n'),
      strengthXY: 4,
      strengthZ: 5,
      printSpeed: 3,
      materialUse: 3,
      description: 'Continuous 3D sinusoidal wave pattern. Equal strength in all directions (isotropic). Excellent layer adhesion due to no crossing lines. Self-supporting geometry.',
      useCases: 'Best all-around pattern. Load-bearing parts where force direction is unknown, functional enclosures, parts requiring water/air tightness at high infill.',
      slicers: ['Bambu Studio', 'Cura', 'PrusaSlicer', 'OrcaSlicer'],
      strengthFactor: 1.15
    },
    honeycomb: {
      name: 'Honeycomb',
      ascii: [
        ' / \\ / \\ / \\',
        '|   |   |   |',
        ' \\ / \\ / \\ /',
        '  |   |   |  ',
        ' / \\ / \\ / \\',
        '|   |   |   |',
        ' \\ / \\ / \\ /'
      ].join('\n'),
      strengthXY: 5,
      strengthZ: 3,
      printSpeed: 2,
      materialUse: 4,
      description: 'Hexagonal cells mimicking natural honeycomb. Outstanding strength-to-weight ratio in the horizontal plane. Many direction changes slow printing.',
      useCases: 'Lightweight structural parts, drone frames, panels that need stiffness without weight. Best when loads are primarily in XY.',
      slicers: ['Cura', 'PrusaSlicer', 'OrcaSlicer'],
      strengthFactor: 1.10
    },
    cubic: {
      name: 'Cubic',
      ascii: [
        ' /\\ /\\ /\\ /\\',
        '/  X  X  X  \\',
        '\\  X  X  X  /',
        ' \\/  \\/  \\/  ',
        ' /\\ /\\ /\\ /\\',
        '/  X  X  X  \\',
        '\\  X  X  X  /'
      ].join('\n'),
      strengthXY: 4,
      strengthZ: 4,
      printSpeed: 3,
      materialUse: 3,
      description: 'Stacked cubes rotated 45 degrees creating a 3D lattice. Good isotropic strength. Moderate print speed. Balanced in all three axes.',
      useCases: 'Functional parts with multi-axis loading, structural brackets, enclosures. Good default choice for strong parts.',
      slicers: ['Bambu Studio', 'Cura', 'PrusaSlicer', 'OrcaSlicer'],
      strengthFactor: 1.05
    },
    lightning: {
      name: 'Lightning',
      ascii: [
        '         |    ',
        '     ----+    ',
        '     |        ',
        ' ----+---+    ',
        ' |       |    ',
        '-+   ----+--- ',
        '     |       |'
      ].join('\n'),
      strengthXY: 1,
      strengthZ: 1,
      printSpeed: 5,
      materialUse: 5,
      description: 'Tree-like branching structure that only supports top surfaces. Minimal material usage. Extremely fast. Provides almost no internal strength.',
      useCases: 'Non-structural prints: figurines, decorative items, display models, prototypes for visual evaluation only.',
      slicers: ['Bambu Studio', 'Cura', 'OrcaSlicer'],
      strengthFactor: 0.30
    },
    lines: {
      name: 'Lines',
      ascii: [
        '/ / / / / / /',
        '/ / / / / / /',
        '/ / / / / / /',
        '/ / / / / / /',
        '/ / / / / / /',
        '/ / / / / / /',
        '/ / / / / / /'
      ].join('\n'),
      strengthXY: 2,
      strengthZ: 2,
      printSpeed: 5,
      materialUse: 4,
      description: 'Parallel lines alternating direction each layer (typically 45 and 135 degrees). Fastest standard infill. Weak perpendicular to line direction on any single layer.',
      useCases: 'Quick prints, thin-walled containers, parts with no structural requirements. Good for speed-critical prototyping.',
      slicers: ['Bambu Studio', 'Cura', 'PrusaSlicer', 'OrcaSlicer'],
      strengthFactor: 0.65
    },
    concentric: {
      name: 'Concentric',
      ascii: [
        '+----------+',
        '| +------+ |',
        '| | +--+ | |',
        '| | |  | | |',
        '| | +--+ | |',
        '| +------+ |',
        '+----------+'
      ].join('\n'),
      strengthXY: 2,
      strengthZ: 2,
      printSpeed: 4,
      materialUse: 3,
      description: 'Nested outlines following the part perimeter. Good for flexible parts since it flexes uniformly. Poor for rigid strength needs.',
      useCases: 'Flexible/TPU parts, clear containers (less visible infill), thin-walled objects. Ideal for living hinges.',
      slicers: ['Bambu Studio', 'Cura', 'PrusaSlicer', 'OrcaSlicer'],
      strengthFactor: 0.55
    },
    triangles: {
      name: 'Triangles',
      ascii: [
        '/\\  /\\  /\\  /',
        '/__\\/__\\/__\\/',
        '\\  /\\  /\\  /\\',
        ' \\/__\\/__\\/__',
        '/\\  /\\  /\\  /',
        '/__\\/__\\/__\\/',
        '\\  /\\  /\\  /\\'
      ].join('\n'),
      strengthXY: 5,
      strengthZ: 3,
      printSpeed: 3,
      materialUse: 4,
      description: 'Triangular tessellation providing excellent rigidity in the XY plane. Triangles cannot deform without bending a side. Uses more material than grid.',
      useCases: 'Parts requiring high horizontal rigidity: mounts, bases, load plates. Very stiff on horizontal forces.',
      slicers: ['Bambu Studio', 'Cura', 'PrusaSlicer', 'OrcaSlicer'],
      strengthFactor: 1.10
    }
  };

  // ======================================================================
  // MATERIAL STRENGTH FACTORS
  // ======================================================================

  const MATERIAL_STRENGTH = {
    PLA:   { tensile: 0.60, impact: 0.25, layerAdhesion: 0.70, label: 'Moderate' },
    'PLA+': { tensile: 0.70, impact: 0.40, layerAdhesion: 0.75, label: 'Moderate-High' },
    PETG:  { tensile: 0.75, impact: 0.65, layerAdhesion: 0.85, label: 'High' },
    TPU:   { tensile: 0.40, impact: 0.95, layerAdhesion: 0.80, label: 'High (impact)' },
    ABS:   { tensile: 0.72, impact: 0.60, layerAdhesion: 0.65, label: 'High' },
    ASA:   { tensile: 0.72, impact: 0.58, layerAdhesion: 0.65, label: 'High' },
    Nylon: { tensile: 0.90, impact: 0.90, layerAdhesion: 0.75, label: 'Very High' },
    PC:    { tensile: 0.95, impact: 0.85, layerAdhesion: 0.70, label: 'Very High' }
  };

  // ======================================================================
  // TROUBLESHOOTING DATA
  // ======================================================================

  const TROUBLESHOOT_DATA = {
    stringing: {
      icon: '\uD83E\uDDF5',
      title: 'Stringing / Oozing',
      description: 'Thin wisps of filament stretched between separate parts of the print during travel moves. Caused by molten filament leaking from the nozzle while the printhead moves over empty space.',
      causes: [
        'Retraction distance or speed too low',
        'Nozzle temperature too high for the material',
        'Travel speed too slow, giving filament time to ooze',
        'Wet or moisture-absorbed filament',
        'Bowden tube wear or loose fittings (if applicable)',
        'Coasting/wipe settings not enabled or misconfigured'
      ],
      steps: [
        {
          title: 'Check filament moisture',
          detail: 'Stringing is often the first sign of wet filament. Try a fresh spool or dry the current spool. PLA: 50\u00B0C for 4h. PETG: 65\u00B0C for 6h. TPU: 50\u00B0C for 8h. If stringing appeared on filament that previously printed fine, moisture is very likely the cause.'
        },
        {
          title: 'Lower nozzle temperature',
          detail: 'Reduce nozzle temp by 5\u00B0C increments. Lower temperature increases filament viscosity and reduces oozing. Stay within the manufacturer\'s recommended range. Test with a stringing tower model.'
        },
        {
          title: 'Increase retraction distance',
          detail: 'For direct drive extruders (A1, S1): try <code>0.5-2.0mm</code>. For Bowden: try <code>4-7mm</code>. Increase by 0.5mm increments. Too much retraction can cause clogs or grinding, so go conservatively.'
        },
        {
          title: 'Increase retraction speed',
          detail: 'Try <code>30-50 mm/s</code> for retraction speed. Faster retraction pulls filament back before it can ooze. Some materials (TPU) need slower retraction or none at all.'
        },
        {
          title: 'Increase travel speed',
          detail: 'Set travel speed to <code>150-250 mm/s</code> or higher if your printer supports it. Faster travel means less time for filament to ooze between points.'
        },
        {
          title: 'Enable wipe and coasting',
          detail: 'Enable <code>Wipe on Retract</code> so the nozzle wipes along the perimeter before traveling. Enable <code>Coasting</code> (0.03-0.06mm\u00B3) to stop extruding slightly before the end of a line, relieving nozzle pressure.'
        }
      ],
      settings: [
        { setting: 'Retraction Distance', value: '0.8-1.5mm (direct drive)', notes: 'Start at 1mm, increase by 0.25mm' },
        { setting: 'Retraction Speed', value: '35-45 mm/s', notes: 'Higher reduces oozing' },
        { setting: 'Travel Speed', value: '150-250 mm/s', notes: 'Faster = less stringing' },
        { setting: 'Nozzle Temp', value: 'Lower end of range', notes: 'Reduce 5\u00B0C at a time' },
        { setting: 'Z Hop', value: '0.2-0.4mm (optional)', notes: 'Helps but can worsen stringing if retraction is poor' }
      ]
    },

    layer_shift: {
      icon: '\u2B06\uFE0F',
      title: 'Layer Shifts',
      description: 'Layers are offset horizontally creating a staircase or sheared appearance. The printer loses its position during printing, causing all subsequent layers to be displaced.',
      causes: [
        'Loose belts on X or Y axis',
        'Print speed too high for the mechanical system',
        'Stepper motor overheating and skipping steps',
        'Obstruction or cable catching on the frame',
        'Print coming loose from the bed and catching the nozzle',
        'Acceleration and jerk values too aggressive',
        'Stepper driver current too low'
      ],
      steps: [
        {
          title: 'Check belt tension',
          detail: 'Both X and Y belts should be taut with a slight twang when plucked. Loose belts are the most common cause. Tighten using the tensioning mechanisms on your printer. A1 has integrated tensioners; S1 may need manual adjustment.'
        },
        {
          title: 'Reduce print speed and acceleration',
          detail: 'Lower speed to <code>100-150 mm/s</code> and reduce acceleration to <code>2000-3000 mm/s\u00B2</code>. High speeds with heavy toolheads or loose mechanics cause missed steps. Test with progressively higher speeds to find your limit.'
        },
        {
          title: 'Check for physical obstructions',
          detail: 'Verify that cables, filament tubes, and the spool do not catch or snag during movement. Route cables cleanly. Check that the gantry moves freely by hand with the printer off.'
        },
        {
          title: 'Ensure bed adhesion is solid',
          detail: 'If the part comes loose mid-print, the nozzle can hit it and cause a shift. Clean the build plate with IPA. Use glue stick for PETG. Ensure first layer is properly squished.'
        },
        {
          title: 'Check stepper motor temperature',
          detail: 'Carefully touch the stepper motors after a long print. If they are too hot to touch (>60\u00B0C), they may be skipping steps from thermal shutdown. Improve cooling or reduce motor current slightly.'
        },
        {
          title: 'Inspect mechanical components',
          detail: 'Check for worn pulleys, loose grub screws on pulleys (the tiny set screws on the flat of the motor shaft), and cracked motor mounts. A single loose grub screw is a very common culprit.'
        }
      ],
      settings: [
        { setting: 'Print Speed', value: '100-150 mm/s', notes: 'Reduce until shifts stop, then slowly increase' },
        { setting: 'Acceleration', value: '2000-3000 mm/s\u00B2', notes: 'Lower values reduce mechanical stress' },
        { setting: 'Jerk / Junction Deviation', value: 'Reduce by 30-50%', notes: 'Lower values smooth direction changes' }
      ]
    },

    warping: {
      icon: '\uD83C\uDF00',
      title: 'Warping / Lifting',
      description: 'Corners or edges of the print curl upward from the build plate. Caused by differential cooling: the top of the print shrinks as it cools while the bottom is held by the bed, creating internal stress.',
      causes: [
        'Bed temperature too low for the material',
        'First layer not squished enough (Z offset too high)',
        'Drafts or cold ambient air hitting the print',
        'Build plate not clean (oil from fingers, dust)',
        'Large flat parts with sharp corners are most susceptible',
        'Material is prone to warping (ABS, ASA, Nylon)',
        'No enclosure for high-temp materials'
      ],
      steps: [
        {
          title: 'Clean the build plate thoroughly',
          detail: 'Wash with dish soap and warm water, then wipe with isopropyl alcohol (90%+). Finger oils cause adhesion failure. Avoid touching the build surface after cleaning. This single step fixes most warping issues with PLA/PETG.'
        },
        {
          title: 'Calibrate first layer (Z offset)',
          detail: 'The first layer should be slightly squished. Lines should be flat and wide, not round. Run first-layer calibration and lower Z offset by <code>-0.02mm</code> increments until you get a good squish without dragging.'
        },
        {
          title: 'Increase bed temperature',
          detail: 'Try raising bed temp by <code>5-10\u00B0C</code>. PLA: 60-65\u00B0C. PETG: 75-85\u00B0C. ABS/ASA: 100-110\u00B0C. Higher bed temp keeps the base of the print above its glass transition, reducing stress.'
        },
        {
          title: 'Use adhesion helpers',
          detail: 'Add a <code>Brim</code> (5-10mm) in your slicer for large/flat parts. Apply glue stick (PVA) for PETG on PEI. Use ABS slurry for ABS. The brim adds surface area and is easy to remove later.'
        },
        {
          title: 'Eliminate drafts',
          detail: 'Avoid placing the printer near windows, AC vents, or fans. For ABS/ASA/Nylon, an enclosure is nearly mandatory. Even a cardboard box or plastic bin enclosure helps significantly for draft-sensitive materials.'
        },
        {
          title: 'Design mitigations',
          detail: 'Add mouse-ear pads to sharp corners in your model. Use chamfers instead of sharp 90\u00B0 edges on the first layer. Reorienting the part so the largest flat area is not on the bed can also help.'
        }
      ],
      settings: [
        { setting: 'Bed Temperature', value: 'Upper end of material range', notes: '+5-10\u00B0C above default' },
        { setting: 'First Layer Speed', value: '20-30 mm/s', notes: 'Slow = better adhesion' },
        { setting: 'Brim Width', value: '5-10mm', notes: 'Adds adhesion area for large parts' },
        { setting: 'Initial Layer Height', value: '0.25-0.30mm', notes: 'Thicker first layer grips better' },
        { setting: 'Part Cooling Fan', value: '0% for first 3-4 layers', notes: 'Let base layers cool slowly' }
      ]
    },

    elephants_foot: {
      icon: '\uD83D\uDC18',
      title: "Elephant's Foot",
      description: 'The first few layers bulge outward wider than the rest of the print, creating a flared base. Caused by the weight of the print compressing still-soft lower layers, or by the nozzle being too close to the bed.',
      causes: [
        'Nozzle too close to bed (Z offset too low)',
        'Bed temperature too high, keeping the base soft',
        'First layer flow rate / extrusion multiplier too high',
        'Cooling fan off for too many initial layers',
        'Heavy or tall prints compressing the warm base'
      ],
      steps: [
        {
          title: 'Adjust Z offset upward slightly',
          detail: 'If your first layer is being squished too much, raise Z offset by <code>+0.01 to +0.03mm</code>. The first layer should be flat but not so compressed that filament squeezes outward.'
        },
        {
          title: 'Lower bed temperature',
          detail: 'Reduce bed temp by <code>5\u00B0C</code>. A cooler bed lets the bottom layers solidify faster so they do not get compressed by the weight above. Balance with adhesion needs.'
        },
        {
          title: 'Enable elephant foot compensation',
          detail: 'Most slicers have an <code>Elephant Foot Compensation</code> setting (sometimes called Initial Layer Horizontal Expansion). Set to <code>-0.1 to -0.2mm</code> to shrink the first layer inward, compensating for the bulge.'
        },
        {
          title: 'Turn on cooling fan earlier',
          detail: 'Reduce the number of initial layers with the fan off. Try fan on at <code>layer 2</code> instead of layer 3-4. This solidifies the base faster.'
        },
        {
          title: 'Reduce first layer flow rate',
          detail: 'Lower first layer flow to <code>90-95%</code> if over-extrusion is contributing. Be careful not to go too low or you will lose bed adhesion.'
        }
      ],
      settings: [
        { setting: 'Elephant Foot Compensation', value: '-0.1 to -0.2mm', notes: 'PrusaSlicer/OrcaSlicer: built-in setting' },
        { setting: 'Bed Temperature', value: 'Reduce by 5\u00B0C', notes: 'Hardens base faster' },
        { setting: 'Initial Layer Flow', value: '90-95%', notes: 'Slight under-extrusion on first layer' },
        { setting: 'Fan Start Layer', value: 'Layer 2', notes: 'Cool base layers sooner' }
      ]
    },

    under_extrusion: {
      icon: '\u26A0\uFE0F',
      title: 'Under-Extrusion',
      description: 'Not enough filament is deposited, resulting in gaps between lines, weak layers, visible holes in top surfaces, or thin wispy layers. The extruder is not pushing enough filament for what the slicer expects.',
      causes: [
        'Partial nozzle clog',
        'Filament grinding (extruder gear eating into filament)',
        'Printing too fast for the hotend to melt filament',
        'Nozzle temperature too low',
        'Incorrect filament diameter setting in slicer',
        'Worn or loose extruder gear tension',
        'Wet filament producing steam bubbles',
        'Tangled or binding filament on the spool'
      ],
      steps: [
        {
          title: 'Check for a clog',
          detail: 'Do a cold pull: heat the nozzle to 90\u00B0C for PLA (or 160\u00B0C for PETG), push filament in, then yank it out. Inspect the tip for debris. Repeat until the pulled filament has a clean, pointed tip. If clogs persist, replace the nozzle.'
        },
        {
          title: 'Inspect the extruder gear',
          detail: 'Remove the filament and inspect the drive gear. Look for filament shavings (grinding). Check gear tension: too tight grinds filament, too loose slips. Clean the gear teeth with a brass brush.'
        },
        {
          title: 'Increase nozzle temperature',
          detail: 'Raise temp by <code>5-10\u00B0C</code>. The hotend may not melt filament fast enough at the current speed/temp combination. This is especially common at higher print speeds.'
        },
        {
          title: 'Reduce print speed',
          detail: 'Lower speed by <code>20-30%</code>. High speeds demand high volumetric flow. Your hotend has a maximum melt rate. Bambu A1 handles around 24mm\u00B3/s; exceeding this causes under-extrusion.'
        },
        {
          title: 'Verify filament diameter',
          detail: 'Measure your filament with calipers at several points. Ensure your slicer is set to <code>1.75mm</code>. Budget filaments sometimes vary from 1.70 to 1.80mm, causing flow inconsistencies.'
        },
        {
          title: 'Dry your filament',
          detail: 'Moisture in filament creates steam bubbles that disrupt flow. Listen for popping/crackling sounds during extrusion. Dry the filament at the recommended temperature for the material.'
        },
        {
          title: 'Increase flow rate as last resort',
          detail: 'If all physical checks pass, increase flow rate by <code>2-5%</code> in the slicer. This compensates for minor flow issues but does not fix the root cause. Proper calibration (flow rate test) is preferred.'
        }
      ],
      settings: [
        { setting: 'Nozzle Temperature', value: '+5-10\u00B0C', notes: 'Helps melt filament faster' },
        { setting: 'Print Speed', value: 'Reduce by 20-30%', notes: 'Stay within volumetric flow limit' },
        { setting: 'Flow Rate', value: '100-105%', notes: 'Fine-tune after calibration' },
        { setting: 'Retraction Distance', value: 'Reduce if clogging', notes: 'Excess retraction can cause jams' }
      ]
    },

    over_extrusion: {
      icon: '\uD83D\uDCA7',
      title: 'Over-Extrusion',
      description: 'Too much filament is deposited, resulting in blobby surfaces, rough layer tops, dimensional inaccuracy (parts too large), and filament squeezing out between lines.',
      causes: [
        'Flow rate / extrusion multiplier too high',
        'Nozzle temperature too high (filament too runny)',
        'Incorrect filament diameter in slicer (set too thin)',
        'E-steps not calibrated properly',
        'Line width too narrow for the nozzle'
      ],
      steps: [
        {
          title: 'Calibrate E-steps',
          detail: 'Mark the filament 120mm above the extruder entry. Extrude 100mm. Measure the remaining distance. If less than 20mm remains, your E-steps are too high. Adjust with <code>M92 Exxx</code> in firmware.'
        },
        {
          title: 'Reduce flow rate',
          detail: 'Lower extrusion multiplier to <code>95-98%</code>. Print a single-wall cube and measure wall thickness with calipers. For a 0.4mm nozzle, a single wall should measure 0.4-0.45mm.'
        },
        {
          title: 'Lower nozzle temperature',
          detail: 'Reduce by <code>5-10\u00B0C</code>. Overly hot filament is less viscous and flows too freely, leading to extra material deposition especially on overhangs and top surfaces.'
        },
        {
          title: 'Verify filament diameter setting',
          detail: 'Ensure your slicer is set to <code>1.75mm</code>. Measure your actual filament with calipers and enter the real value for precision. Even 0.05mm error causes ~5% flow difference.'
        },
        {
          title: 'Check line width settings',
          detail: 'Line width should be 100-120% of nozzle diameter. For a 0.4mm nozzle, use <code>0.4-0.48mm</code>. Narrower line widths with a wide nozzle force excess material out the sides.'
        }
      ],
      settings: [
        { setting: 'Flow Rate', value: '95-100%', notes: 'Calibrate with single-wall test' },
        { setting: 'Nozzle Temperature', value: 'Lower end of range', notes: 'Reduce 5\u00B0C at a time' },
        { setting: 'Line Width', value: '0.4-0.48mm (for 0.4mm nozzle)', notes: '100-120% of nozzle size' }
      ]
    },

    poor_bridging: {
      icon: '\uD83C\uDF09',
      title: 'Poor Bridging',
      description: 'Filament sags, droops, or creates messy strands when printing horizontally over open air between two supported points. The unsupported span fails to form a clean bridge.',
      causes: [
        'Part cooling fan speed too low during bridging',
        'Bridging speed too fast or too slow',
        'Nozzle temperature too high',
        'Bridge flow rate too high (excess material droops)',
        'Bridge distance too long for the material',
        'Fan duct not directing air at the nozzle effectively'
      ],
      steps: [
        {
          title: 'Maximize cooling fan for bridges',
          detail: 'Set bridge fan speed to <code>100%</code>. Rapid cooling is critical for bridging: the filament needs to solidify quickly before gravity pulls it down. Ensure your fan duct is not clogged and is actually directing air at the nozzle area.'
        },
        {
          title: 'Adjust bridge speed',
          detail: 'Try <code>20-30 mm/s</code> for bridge speed. Too fast and the filament does not have time to adhere to anchor points. Too slow and it droops from heat. Test with a bridging test model.'
        },
        {
          title: 'Reduce bridge flow rate',
          detail: 'Set bridge flow rate to <code>85-95%</code>. Less material means thinner strands that cool faster and sag less. This is a separate setting from normal flow rate in most slicers.'
        },
        {
          title: 'Lower nozzle temperature for bridges',
          detail: 'Reduce by <code>5-10\u00B0C</code> if your slicer supports per-feature temperature control. Cooler filament has higher viscosity and resists drooping. PLA bridges best at the low end of its range.'
        },
        {
          title: 'Use support structures for long spans',
          detail: 'If the bridge distance exceeds <code>40-50mm</code>, consider adding supports. Tree supports are efficient and easy to remove. You can also redesign the part to reduce the unsupported span.'
        }
      ],
      settings: [
        { setting: 'Bridge Fan Speed', value: '100%', notes: 'Maximum cooling for bridges' },
        { setting: 'Bridge Speed', value: '20-30 mm/s', notes: 'Slower than normal print speed' },
        { setting: 'Bridge Flow Rate', value: '85-95%', notes: 'Less material = less droop' },
        { setting: 'Nozzle Temperature', value: '-5 to -10\u00B0C', notes: 'Cooler = stiffer extrusion' }
      ]
    },

    layer_separation: {
      icon: '\uD83E\uDE93',
      title: 'Layer Separation / Delamination',
      description: 'Layers do not bond well to each other, resulting in cracks between layers or the part splitting apart along layer lines when any force is applied. This is a structural failure of inter-layer adhesion.',
      causes: [
        'Nozzle temperature too low for the material',
        'Excessive part cooling (fan too high)',
        'Layer height too large for the nozzle',
        'Printing too fast for the layer to bond',
        'Wet filament (steam disrupts bonding)',
        'Draft or cold environment chilling layers before bonding',
        'Contaminated or old filament'
      ],
      steps: [
        {
          title: 'Increase nozzle temperature',
          detail: 'Raise by <code>5-10\u00B0C</code>. Hotter filament bonds better to the previous layer by partially remelting it. This is the single most effective fix. PETG and ABS especially need sufficient temperature for adhesion.'
        },
        {
          title: 'Reduce cooling fan speed',
          detail: 'Lower fan to <code>50-70%</code> for PLA, or <code>30-50%</code> for PETG. For ABS/ASA, use <code>0-20%</code>. Excessive cooling solidifies the previous layer too quickly, preventing the new layer from bonding.'
        },
        {
          title: 'Dry the filament',
          detail: 'Wet filament causes tiny steam explosions between layers, creating voids and poor adhesion. Even slightly moist filament degrades layer bonding significantly. Dry at the recommended temp for your material.'
        },
        {
          title: 'Reduce layer height',
          detail: 'Use a layer height no more than <code>75-80%</code> of the nozzle diameter. For a 0.4mm nozzle, max 0.28-0.32mm. Thicker layers have less surface contact and bond poorly. Try 0.20mm if having adhesion issues.'
        },
        {
          title: 'Slow down print speed',
          detail: 'Reduce speed by <code>20-30%</code>. Slower printing gives each layer more time at elevated temperature, improving the thermal bond with the layer below.'
        },
        {
          title: 'Use an enclosure',
          detail: 'For ABS, ASA, Nylon, and PC, an enclosure maintains ambient temperature and dramatically improves inter-layer adhesion. Even a simple enclosure (plastic storage bin, foam board box) makes a measurable difference.'
        }
      ],
      settings: [
        { setting: 'Nozzle Temperature', value: '+10-15\u00B0C', notes: 'Biggest impact on layer adhesion' },
        { setting: 'Fan Speed', value: '50-70% PLA, 0-30% ABS', notes: 'Less cooling = better bonding' },
        { setting: 'Layer Height', value: '\u226475% of nozzle diameter', notes: '0.28mm max for 0.4mm nozzle' },
        { setting: 'Print Speed', value: 'Reduce 20-30%', notes: 'More heat transfer time per layer' }
      ]
    },

    zits_blobs: {
      icon: '\u26AB',
      title: 'Zits / Blobs on Surface',
      description: 'Small bumps, raised dots, or irregular blobs appear on the outer surface of the print, usually at the point where each layer starts and ends (the seam) or scattered randomly.',
      causes: [
        'Z-seam not aligned (random placement spreads blobs everywhere)',
        'Retraction settings not tuned (too much prime after retract)',
        'Pressure buildup in the nozzle at layer change',
        'Linear advance / pressure advance not calibrated',
        'Coasting distance incorrect',
        'Filament moisture causing micro-bubbles that pop at the surface'
      ],
      steps: [
        {
          title: 'Align the Z-seam',
          detail: 'Set Z-seam position to <code>Aligned</code> or <code>Back</code> in your slicer. This concentrates the start/end point into a single vertical line instead of scattering blobs randomly. The line is easier to sand or hide on a back face.'
        },
        {
          title: 'Tune retraction extra prime amount',
          detail: 'Reduce <code>Extra Restart Distance</code> (or Extra Prime Amount) to <code>0</code> or a small negative value like <code>-0.02mm</code>. Excess prime deposits extra filament at the restart point creating a blob.'
        },
        {
          title: 'Enable and tune coasting',
          detail: 'Enable <code>Coasting</code> with a distance of <code>0.2-0.5mm</code>. This stops extruding just before the end of each perimeter loop, reducing the pressure buildup that causes the blob where the seam closes.'
        },
        {
          title: 'Calibrate pressure advance / linear advance',
          detail: 'Run a pressure advance calibration test (Marlin: <code>M900</code>, Klipper: <code>SET_PRESSURE_ADVANCE</code>). Proper PA value compensates for nozzle pressure lag, significantly reducing blobs at speed changes and seams.'
        },
        {
          title: 'Reduce nozzle temperature slightly',
          detail: 'Lower by <code>3-5\u00B0C</code>. Slightly cooler filament is less fluid and does not ooze as much at seam points and during retraction. Small change, but it helps.'
        },
        {
          title: 'Dry your filament',
          detail: 'Moisture causes random surface zits as steam escapes from the nozzle. If blobs are scattered randomly (not just at the seam), moisture is a likely cause. Listen for popping sounds during extrusion.'
        }
      ],
      settings: [
        { setting: 'Z-Seam Position', value: 'Aligned / Sharpest Corner', notes: 'Concentrates seam in one line' },
        { setting: 'Extra Restart Distance', value: '0 to -0.02mm', notes: 'Reduce prime blob at seam' },
        { setting: 'Coasting Distance', value: '0.2-0.5mm', notes: 'Relieves pressure at seam' },
        { setting: 'Wipe Distance', value: '1-2mm', notes: 'Wipes nozzle along wall at retract' }
      ]
    }
  };

  // ======================================================================
  // STATE
  // ======================================================================

  let customProfiles = [];
  let editingProfileId = null;

  // ======================================================================
  // INIT
  // ======================================================================

  async function init() {
    initTabs('#optimizer-module');
    await loadCustomProfiles();
    renderBuiltinProfiles();
    renderCustomProfiles();
    bindProfileActions();
    bindCompareTab();
    bindStrengthTab();
    renderInfillGuide();
    bindTroubleshooter();
    // Run initial compare calculation
    updateCompare();
  }

  // ======================================================================
  // PROFILES TAB
  // ======================================================================

  async function loadCustomProfiles() {
    try {
      const all = await window.storage.getProfiles();
      customProfiles = all || [];
    } catch (e) {
      customProfiles = [];
    }
  }

  function matchesFilters(profile) {
    const printerFilter = document.getElementById('opt-prof-filter-printer').value;
    const useFilter = document.getElementById('opt-prof-filter-use').value;
    const search = document.getElementById('opt-prof-search').value.toLowerCase().trim();

    if (printerFilter !== 'all' && profile.printer !== 'both' && profile.printer !== printerFilter) return false;
    if (useFilter !== 'all' && profile.useCase !== useFilter) return false;
    if (search) {
      const haystack = (profile.name + ' ' + profile.material + ' ' + (profile.notes || '') + ' ' + (profile.tags || []).join(' ')).toLowerCase();
      if (!haystack.includes(search)) return false;
    }
    return true;
  }

  function renderProfileCard(profile, isBuiltin) {
    const s = profile.settings;
    const printerLabel = profile.printer === 'both' ? 'Both Printers' :
      (profile.printer === 'bambu_a1' ? 'Bambu A1' : 'Kobra S1');
    const patternName = INFILL_PATTERNS[s.infillPattern] ? INFILL_PATTERNS[s.infillPattern].name : s.infillPattern;

    const tags = (profile.tags || []).map(t =>
      `<span class="tag">${escapeHtml(t)}</span>`
    ).join('');

    let actions = '';
    if (isBuiltin) {
      actions = `
        <button class="btn btn-sm btn-secondary opt-act-duplicate" data-id="${profile.id}">Duplicate</button>
        <button class="btn btn-sm btn-secondary opt-act-use-compare" data-id="${profile.id}">Compare</button>`;
    } else {
      actions = `
        <button class="btn btn-sm btn-secondary opt-act-edit" data-id="${profile.id}">Edit</button>
        <button class="btn btn-sm btn-secondary opt-act-duplicate" data-id="${profile.id}">Duplicate</button>
        <button class="btn btn-sm btn-danger opt-act-delete" data-id="${profile.id}">Delete</button>`;
    }

    return `
      <div class="opt-profile-card ${isBuiltin ? 'opt-builtin' : 'opt-custom'}">
        <div class="opt-profile-card-header">
          <div>
            <div class="opt-profile-card-name">${escapeHtml(profile.name)}</div>
            <div class="opt-profile-card-usecase">${escapeHtml(profile.material)} &middot; ${escapeHtml(printerLabel)}</div>
          </div>
          <span class="opt-profile-card-badge ${isBuiltin ? 'opt-badge-builtin' : 'opt-badge-custom'}">
            ${isBuiltin ? 'Recipe' : 'Custom'}
          </span>
        </div>
        <div class="opt-profile-card-settings">
          <div class="opt-profile-setting"><span class="opt-profile-setting-label">Layer</span><span class="opt-profile-setting-value">${s.layerHeight}mm</span></div>
          <div class="opt-profile-setting"><span class="opt-profile-setting-label">Walls</span><span class="opt-profile-setting-value">${s.wallCount}</span></div>
          <div class="opt-profile-setting"><span class="opt-profile-setting-label">Infill</span><span class="opt-profile-setting-value">${s.infill}%</span></div>
          <div class="opt-profile-setting"><span class="opt-profile-setting-label">Pattern</span><span class="opt-profile-setting-value">${escapeHtml(patternName)}</span></div>
          <div class="opt-profile-setting"><span class="opt-profile-setting-label">Speed</span><span class="opt-profile-setting-value">${s.speed}mm/s</span></div>
          <div class="opt-profile-setting"><span class="opt-profile-setting-label">Nozzle</span><span class="opt-profile-setting-value">${s.nozzleTemp}\u00B0C</span></div>
        </div>
        ${tags ? `<div class="opt-profile-card-tags">${tags}</div>` : ''}
        ${profile.notes ? `<div class="opt-profile-card-notes">${escapeHtml(profile.notes)}</div>` : ''}
        <div class="opt-profile-card-actions">${actions}</div>
      </div>`;
  }

  function renderBuiltinProfiles() {
    const grid = document.getElementById('opt-builtin-grid');
    const filtered = BUILTIN_PROFILES.filter(p => matchesFilters(p));
    grid.innerHTML = filtered.length
      ? filtered.map(p => renderProfileCard(p, true)).join('')
      : '<div class="text-sm text-muted" style="padding:12px;">No built-in profiles match the current filters.</div>';
  }

  function renderCustomProfiles() {
    const grid = document.getElementById('opt-custom-grid');
    const empty = document.getElementById('opt-custom-empty');
    const filtered = customProfiles.filter(p => matchesFilters(p));

    if (customProfiles.length === 0) {
      grid.innerHTML = '';
      empty.style.display = '';
    } else if (filtered.length === 0) {
      grid.innerHTML = '<div class="text-sm text-muted" style="padding:12px;">No custom profiles match the current filters.</div>';
      empty.style.display = 'none';
    } else {
      grid.innerHTML = filtered.map(p => renderProfileCard(p, false)).join('');
      empty.style.display = 'none';
    }
  }

  function renderAllProfiles() {
    renderBuiltinProfiles();
    renderCustomProfiles();
  }

  function bindProfileActions() {
    const module = document.getElementById('optimizer-module');

    // Filter change
    ['opt-prof-filter-printer', 'opt-prof-filter-use'].forEach(id => {
      document.getElementById(id).addEventListener('change', renderAllProfiles);
    });
    document.getElementById('opt-prof-search').addEventListener('input', renderAllProfiles);

    // New profile button
    document.getElementById('opt-btn-new-profile').addEventListener('click', () => openProfileModal(null));

    // Delegated click actions on profile cards
    module.addEventListener('click', async (e) => {
      const btn = e.target.closest('button');
      if (!btn) return;
      const id = btn.dataset.id;

      if (btn.classList.contains('opt-act-edit')) {
        const profile = customProfiles.find(p => p.id === id);
        if (profile) openProfileModal(profile);
      }

      if (btn.classList.contains('opt-act-duplicate')) {
        const profile = findProfileById(id);
        if (profile) duplicateProfile(profile);
      }

      if (btn.classList.contains('opt-act-delete')) {
        if (confirm('Delete this profile? This cannot be undone.')) {
          await deleteProfile(id);
        }
      }

      if (btn.classList.contains('opt-act-use-compare')) {
        const profile = findProfileById(id);
        if (profile) loadIntoCompare(profile);
      }
    });

    // Modal buttons
    document.getElementById('opt-modal-close-x').addEventListener('click', closeProfileModal);
    document.getElementById('opt-modal-cancel').addEventListener('click', closeProfileModal);
    document.getElementById('opt-modal-save').addEventListener('click', saveProfile);
    document.getElementById('opt-modal-delete').addEventListener('click', async () => {
      if (editingProfileId && confirm('Delete this profile?')) {
        await deleteProfile(editingProfileId);
        closeProfileModal();
      }
    });
  }

  function findProfileById(id) {
    return BUILTIN_PROFILES.find(p => p.id === id) || customProfiles.find(p => p.id === id);
  }

  // ---- Modal CRUD ----

  function openProfileModal(profile) {
    const form = document.getElementById('opt-profile-form');
    const title = document.getElementById('opt-modal-title');
    const deleteBtn = document.getElementById('opt-modal-delete');

    form.reset();
    editingProfileId = null;

    if (profile) {
      editingProfileId = profile.id;
      title.textContent = 'Edit Print Profile';
      deleteBtn.style.display = '';

      document.getElementById('opt-form-id').value = profile.id;
      document.getElementById('opt-form-name').value = profile.name;
      document.getElementById('opt-form-printer').value = profile.printer || 'both';
      document.getElementById('opt-form-material').value = profile.material;
      document.getElementById('opt-form-usecase').value = profile.useCase || 'structural';
      document.getElementById('opt-form-layerheight').value = profile.settings.layerHeight;
      document.getElementById('opt-form-infill').value = profile.settings.infill;
      document.getElementById('opt-form-pattern').value = profile.settings.infillPattern;
      document.getElementById('opt-form-walls').value = profile.settings.wallCount;
      document.getElementById('opt-form-top').value = profile.settings.topLayers;
      document.getElementById('opt-form-bottom').value = profile.settings.bottomLayers;
      document.getElementById('opt-form-speed').value = profile.settings.speed;
      document.getElementById('opt-form-nozzletemp').value = profile.settings.nozzleTemp;
      document.getElementById('opt-form-bedtemp').value = profile.settings.bedTemp;
      document.getElementById('opt-form-notes').value = profile.notes || '';
      document.getElementById('opt-form-tags').value = (profile.tags || []).join(', ');
    } else {
      title.textContent = 'New Print Profile';
      deleteBtn.style.display = 'none';
    }

    openModal('opt-profile-modal');
  }

  function closeProfileModal() {
    editingProfileId = null;
    closeModal('opt-profile-modal');
  }

  async function saveProfile() {
    const name = document.getElementById('opt-form-name').value.trim();
    const material = document.getElementById('opt-form-material').value;
    if (!name || !material) {
      alert('Please provide a profile name and material.');
      return;
    }

    const tagsRaw = document.getElementById('opt-form-tags').value;
    const tags = tagsRaw ? tagsRaw.split(',').map(t => t.trim()).filter(Boolean) : [];

    const profile = {
      id: editingProfileId || generateId(),
      name: name,
      printer: document.getElementById('opt-form-printer').value,
      material: material,
      useCase: document.getElementById('opt-form-usecase').value,
      settings: {
        layerHeight: parseFloat(document.getElementById('opt-form-layerheight').value) || 0.20,
        infill: parseInt(document.getElementById('opt-form-infill').value) || 20,
        infillPattern: document.getElementById('opt-form-pattern').value,
        wallCount: parseInt(document.getElementById('opt-form-walls').value) || 3,
        topLayers: parseInt(document.getElementById('opt-form-top').value) || 4,
        bottomLayers: parseInt(document.getElementById('opt-form-bottom').value) || 4,
        speed: parseInt(document.getElementById('opt-form-speed').value) || 150,
        nozzleTemp: parseInt(document.getElementById('opt-form-nozzletemp').value) || 210,
        bedTemp: parseInt(document.getElementById('opt-form-bedtemp').value) || 60
      },
      notes: document.getElementById('opt-form-notes').value.trim(),
      tags: tags
    };

    if (editingProfileId) {
      await window.storage.updateProfile(editingProfileId, profile);
      const idx = customProfiles.findIndex(p => p.id === editingProfileId);
      if (idx !== -1) customProfiles[idx] = profile;
    } else {
      await window.storage.addProfile(profile);
      customProfiles.push(profile);
    }

    closeProfileModal();
    renderAllProfiles();
  }

  async function duplicateProfile(source) {
    const dup = JSON.parse(JSON.stringify(source));
    dup.id = generateId();
    dup.name = source.name + ' (copy)';
    dup.builtin = false;
    delete dup.builtin;

    await window.storage.addProfile(dup);
    customProfiles.push(dup);
    renderAllProfiles();
  }

  async function deleteProfile(id) {
    await window.storage.deleteProfile(id);
    customProfiles = customProfiles.filter(p => p.id !== id);
    renderAllProfiles();
  }

  // ======================================================================
  // COMPARE TAB - Heuristic Impact Calculations
  // ======================================================================

  function bindCompareTab() {
    const sliders = ['opt-cmp-walls', 'opt-cmp-infill', 'opt-cmp-layer', 'opt-cmp-speed'];
    sliders.forEach(id => {
      document.getElementById(id).addEventListener('input', updateCompare);
    });
    document.getElementById('opt-cmp-material').addEventListener('change', updateCompare);
    document.getElementById('opt-cmp-pattern').addEventListener('change', updateCompare);
  }

  function loadIntoCompare(profile) {
    const s = profile.settings;
    document.getElementById('opt-cmp-material').value = profile.material;
    document.getElementById('opt-cmp-walls').value = s.wallCount;
    document.getElementById('opt-cmp-infill').value = s.infill;
    document.getElementById('opt-cmp-pattern').value = s.infillPattern;
    document.getElementById('opt-cmp-speed').value = s.speed;

    // Find closest layer height step
    const layerSlider = document.getElementById('opt-cmp-layer');
    const steps = [0.08, 0.12, 0.16, 0.20, 0.24, 0.28, 0.32];
    let closest = steps.reduce((prev, curr) =>
      Math.abs(curr - s.layerHeight) < Math.abs(prev - s.layerHeight) ? curr : prev
    );
    layerSlider.value = closest;

    updateCompare();

    // Switch to compare tab
    const module = document.getElementById('optimizer-module');
    module.querySelectorAll('.tab-btn').forEach(b =>
      b.classList.toggle('active', b.dataset.tab === 'opt-tab-compare')
    );
    module.querySelectorAll('.tab-panel').forEach(p =>
      p.classList.toggle('active', p.id === 'opt-tab-compare')
    );
  }

  function updateCompare() {
    const material = document.getElementById('opt-cmp-material').value;
    const walls = parseInt(document.getElementById('opt-cmp-walls').value);
    const infill = parseInt(document.getElementById('opt-cmp-infill').value);
    const pattern = document.getElementById('opt-cmp-pattern').value;
    const layerH = parseFloat(document.getElementById('opt-cmp-layer').value);
    const speed = parseInt(document.getElementById('opt-cmp-speed').value);

    // Update slider value displays
    document.getElementById('opt-cmp-walls-val').textContent = walls;
    document.getElementById('opt-cmp-infill-val').textContent = infill + '%';
    document.getElementById('opt-cmp-layer-val').textContent = layerH.toFixed(2);
    document.getElementById('opt-cmp-speed-val').textContent = speed;

    // --- Heuristic calculations ---
    // Baseline: 2 walls, 15% infill, grid, 0.20mm layer, 150mm/s, PLA

    const matData = MATERIAL_STRENGTH[material] || MATERIAL_STRENGTH.PLA;
    const patData = INFILL_PATTERNS[pattern] || INFILL_PATTERNS.grid;

    // STRENGTH SCORE (0-100)
    // Wall contribution: each wall adds ~12% strength, with diminishing returns
    // Base 2 walls = reference (30 points), max at 8 walls ~65 points from walls
    const wallStrength = Math.min(35, 10 + (walls * 12) * (1 - walls * 0.03));

    // Infill contribution: logarithmic diminishing returns
    // 0% = 0 pts, 20% = 10 pts, 50% = 18 pts, 100% = 25 pts
    const infillStrength = infill === 0 ? 0 : 25 * (Math.log10(infill + 1) / Math.log10(101));

    // Pattern multiplier
    const patternMult = patData.strengthFactor;

    // Material multiplier
    const matMult = matData.tensile;

    // Layer height: thinner = stronger (more adhesion surface per mm height)
    // 0.08mm = 1.15x, 0.20mm = 1.0x, 0.32mm = 0.88x
    const layerMult = 1.0 + (0.20 - layerH) * 0.8;

    let strength = Math.round((wallStrength + infillStrength * patternMult) * matMult * layerMult);
    strength = Math.max(5, Math.min(100, strength));

    // PRINT TIME SCORE (0-100, higher = longer)
    // More walls, more infill, finer layers, slower speed = more time
    const wallTime = walls * 8;
    const infillTime = infill * 0.3;
    const layerTime = (0.32 / layerH) * 12;
    const speedTime = Math.max(5, 40 - (speed - 50) * 0.15);
    let timeScore = Math.round(wallTime + infillTime + layerTime + speedTime);
    timeScore = Math.max(5, Math.min(100, timeScore));

    // FILAMENT USAGE (0-100, higher = more)
    const wallFil = walls * 10;
    const infillFil = infill * 0.45;
    const layerFil = 8; // layer height has minimal effect on total filament
    let filScore = Math.round(wallFil + infillFil + layerFil);
    filScore = Math.max(5, Math.min(100, filScore));

    // SURFACE QUALITY (0-100)
    // Thinner layers = better, slower = better, material matters
    const layerQual = Math.max(0, 85 - (layerH - 0.08) * 200);
    const speedQual = Math.max(0, 30 - (speed - 60) * 0.1);
    let qualScore = Math.round(layerQual + speedQual);
    qualScore = Math.max(5, Math.min(100, qualScore));

    // Update UI
    setImpactBar('opt-cmp-str-bar', 'opt-cmp-str-text', strength, 'var(--success)', getLabel(strength, ['Fragile', 'Weak', 'Fair', 'Good', 'Strong', 'Very Strong']));
    setImpactBar('opt-cmp-time-bar', 'opt-cmp-time-text', timeScore, 'var(--warning)', getLabel(timeScore, ['Very Fast', 'Fast', 'Moderate', 'Slow', 'Very Slow', 'Extremely Slow']));
    setImpactBar('opt-cmp-fil-bar', 'opt-cmp-fil-text', filScore, 'var(--accent)', getLabel(filScore, ['Minimal', 'Low', 'Moderate', 'High', 'Very High', 'Maximum']));
    setImpactBar('opt-cmp-qual-bar', 'opt-cmp-qual-text', qualScore, 'var(--info)', getLabel(qualScore, ['Rough', 'Visible Lines', 'Acceptable', 'Good', 'Fine', 'Ultra Smooth']));

    // Summary text
    const summaryParts = [];
    if (strength >= 70) summaryParts.push('This configuration produces a strong part.');
    else if (strength >= 40) summaryParts.push('Moderate strength suitable for light functional use.');
    else summaryParts.push('Low strength. Not recommended for load-bearing applications.');

    if (walls >= 4) summaryParts.push(`${walls} walls contribute significantly to edge and impact strength.`);
    else if (walls <= 2) summaryParts.push('Consider adding more walls for better impact resistance on edges.');

    if (infill > 50) summaryParts.push(`At ${infill}% infill, you are past the point of diminishing returns. Consider reducing to 40% and adding walls instead.`);
    else if (infill < 10 && strength < 40) summaryParts.push('Very low infill. Increase to at least 15-20% for any functional use.');

    if (patData.strengthFactor < 0.5) summaryParts.push(`${patData.name} infill provides minimal structural support. Switch to grid, gyroid, or cubic for load-bearing parts.`);
    if (patData.strengthFactor >= 1.1) summaryParts.push(`${patData.name} is an excellent choice for this application.`);

    if (layerH <= 0.12) summaryParts.push('Fine layers improve quality and strength but significantly increase print time.');
    if (layerH >= 0.28) summaryParts.push('Thick layers reduce print time but may weaken inter-layer adhesion.');

    if (speed > 200) summaryParts.push('High speeds may cause quality issues. Monitor for ringing/ghosting artifacts.');

    if (matData.tensile < 0.5) summaryParts.push(`${material} is flexible and not suited for rigid structural use.`);

    document.getElementById('opt-cmp-summary-text').textContent = summaryParts.join(' ');
  }

  function setImpactBar(barId, textId, value, color, label) {
    const bar = document.getElementById(barId);
    const text = document.getElementById(textId);
    bar.style.width = value + '%';
    bar.style.background = color;
    text.textContent = `${value} / 100 (${label})`;
  }

  function getLabel(score, labels) {
    // Map 0-100 to 6-tier label
    const idx = Math.min(labels.length - 1, Math.floor(score / (100 / labels.length)));
    return labels[idx];
  }

  // ======================================================================
  // STRENGTH ESTIMATOR TAB
  // ======================================================================

  function bindStrengthTab() {
    document.getElementById('opt-str-calculate').addEventListener('click', calculateStrength);
  }

  function calculateStrength() {
    const material = document.getElementById('opt-str-material').value;
    const walls = parseInt(document.getElementById('opt-str-walls').value) || 3;
    const infill = parseInt(document.getElementById('opt-str-infill').value) || 20;
    const pattern = document.getElementById('opt-str-pattern').value;
    const layerH = parseFloat(document.getElementById('opt-str-layer').value) || 0.20;
    const shells = parseInt(document.getElementById('opt-str-shells').value) || 4;
    const speed = parseInt(document.getElementById('opt-str-speed').value) || 150;

    const matData = MATERIAL_STRENGTH[material] || MATERIAL_STRENGTH.PLA;
    const patData = INFILL_PATTERNS[pattern] || INFILL_PATTERNS.grid;

    // Strength calculation (same heuristics as compare, with shell bonus)
    const wallStrength = Math.min(38, 10 + (walls * 12) * (1 - walls * 0.025));
    const infillStrength = infill === 0 ? 0 : 25 * (Math.log10(infill + 1) / Math.log10(101));
    const shellBonus = Math.min(8, (shells - 3) * 2);
    const patternMult = patData.strengthFactor;
    const matMult = matData.tensile;
    const layerMult = 1.0 + (0.20 - layerH) * 0.8;

    let score = Math.round((wallStrength + infillStrength * patternMult + shellBonus) * matMult * layerMult);
    score = Math.max(3, Math.min(100, score));

    // Weight factor relative to a 2-wall / 15% infill baseline
    const baselineWeight = 2 * 10 + 15 * 0.45 + 3 * 2;
    const currentWeight = walls * 10 + infill * 0.45 + shells * 2;
    const weightFactor = (currentWeight / baselineWeight).toFixed(2);

    // Time factor relative to standard settings
    const baseTime = 2 * 8 + 15 * 0.3 + (0.32 / 0.20) * 12 + Math.max(5, 40 - 100 * 0.15);
    const curTime = walls * 8 + infill * 0.3 + (0.32 / layerH) * 12 + Math.max(5, 40 - (speed - 50) * 0.15);
    const timeFactor = (curTime / baseTime).toFixed(2);

    // Layer adhesion rating
    const adhesionScore = Math.round(matData.layerAdhesion * layerMult * 100);
    const adhesionLabel = adhesionScore >= 80 ? 'Excellent' : adhesionScore >= 60 ? 'Good' : adhesionScore >= 40 ? 'Fair' : 'Poor';

    // Update UI
    document.getElementById('opt-str-score-fill').style.width = score + '%';
    document.getElementById('opt-str-score-text').textContent = score;

    const ratingLabels = ['Very Weak', 'Weak', 'Below Average', 'Average', 'Above Average', 'Good', 'Strong', 'Very Strong', 'Excellent', 'Outstanding'];
    const ratingIdx = Math.min(ratingLabels.length - 1, Math.floor(score / 11));
    document.getElementById('opt-str-rating').textContent = ratingLabels[ratingIdx] + ' (' + matData.label + ' base material)';

    document.getElementById('opt-str-weight').textContent = weightFactor + 'x';
    document.getElementById('opt-str-weight-note').textContent = weightFactor > 1.2 ? 'heavier than baseline' : weightFactor < 0.8 ? 'lighter than baseline' : 'near baseline';

    document.getElementById('opt-str-time').textContent = timeFactor + 'x';
    document.getElementById('opt-str-time-note').textContent = timeFactor > 1.3 ? 'slower than baseline' : timeFactor < 0.8 ? 'faster than baseline' : 'near baseline';

    document.getElementById('opt-str-adhesion').textContent = adhesionLabel;
    document.getElementById('opt-str-adhesion-note').textContent = material + ' @ ' + layerH + 'mm layers';

    // Guidance
    const tips = [];

    if (walls < 3 && score < 50) {
      tips.push('Increase wall count to at least 3. Each additional wall adds roughly 12% strength and significantly improves impact resistance on edges.');
    }
    if (walls >= 3 && infill < 15) {
      tips.push('Your wall count is good, but very low infill leaves the interior hollow. Consider 15-20% minimum for any functional part.');
    }
    if (infill > 60) {
      tips.push('Infill above 60% has diminishing returns. The extra material adds weight and time but little strength. Consider 40% infill with more walls instead.');
    }
    if (patData.strengthFactor < 0.5) {
      tips.push(`${patData.name} pattern is not suitable for structural parts. Switch to gyroid, grid, or cubic for better load-bearing capacity.`);
    }
    if (layerH >= 0.28 && score < 60) {
      tips.push('Thick layer heights (0.28mm+) weaken inter-layer bonds. Dropping to 0.20mm improves strength with moderate time increase.');
    }
    if (material === 'PLA' && score < 40) {
      tips.push('PLA is brittle under stress. For stronger parts, consider PLA+ or PETG which offer better impact resistance and layer adhesion.');
    }
    if (material === 'TPU') {
      tips.push('TPU strength comes from flexibility and impact absorption, not rigidity. The score reflects tensile strength; actual impact performance is much better.');
    }
    if (shells < 4 && walls >= 4) {
      tips.push('Your walls are strong but top/bottom layers are thin. Increase to 4-5 shells for consistent strength on horizontal faces.');
    }
    if (speed > 200 && layerH >= 0.24) {
      tips.push('High speed with thick layers can outrun the hotend melt capacity, causing under-extrusion and weak layers. Consider reducing speed or layer height.');
    }
    if (score >= 75) {
      tips.push('This is a strong configuration. For further improvement, ensure filament is dry and nozzle temperature is at the higher end of the material range for maximum layer adhesion.');
    }

    if (tips.length === 0) {
      tips.push('Settings look balanced. Monitor prints for quality and adjust based on actual results.');
    }

    document.getElementById('opt-str-guidance-text').innerHTML = tips.map(t =>
      '<p style="margin-bottom:8px;">' + escapeHtml(t) + '</p>'
    ).join('');
  }

  // ======================================================================
  // INFILL GUIDE TAB
  // ======================================================================

  function renderInfillGuide() {
    const grid = document.getElementById('opt-infill-grid');
    const cards = Object.values(INFILL_PATTERNS).map(pat => {
      const stars = (n) => {
        let s = '';
        for (let i = 0; i < 5; i++) s += i < n ? '\u2605' : '\u2606';
        return s;
      };

      const slicerTags = pat.slicers.map(s => `<span class="tag">${escapeHtml(s)}</span>`).join(' ');

      return `
        <div class="opt-infill-card">
          <div class="opt-infill-card-header">
            <span class="opt-infill-card-name">${escapeHtml(pat.name)}</span>
            <span class="tag ${pat.strengthFactor >= 1.0 ? 'tag-success' : pat.strengthFactor >= 0.6 ? 'tag-warning' : 'tag-danger'}">
              ${pat.strengthFactor >= 1.0 ? 'Strong' : pat.strengthFactor >= 0.6 ? 'Moderate' : 'Weak'}
            </span>
          </div>
          <div class="opt-infill-ascii">${escapeHtml(pat.ascii)}</div>
          <div class="opt-infill-ratings">
            <div class="opt-infill-rating">
              <span class="opt-infill-rating-label">XY Str:</span>
              <span class="opt-infill-rating-stars">${stars(pat.strengthXY)}</span>
            </div>
            <div class="opt-infill-rating">
              <span class="opt-infill-rating-label">Z Str:</span>
              <span class="opt-infill-rating-stars">${stars(pat.strengthZ)}</span>
            </div>
            <div class="opt-infill-rating">
              <span class="opt-infill-rating-label">Speed:</span>
              <span class="opt-infill-rating-stars">${stars(pat.printSpeed)}</span>
            </div>
            <div class="opt-infill-rating">
              <span class="opt-infill-rating-label">Savings:</span>
              <span class="opt-infill-rating-stars">${stars(pat.materialUse)}</span>
            </div>
          </div>
          <div class="opt-infill-usecases">
            <p style="margin-bottom:6px;">${escapeHtml(pat.description)}</p>
            <p><strong>Best for:</strong> ${escapeHtml(pat.useCases)}</p>
          </div>
          <div class="opt-infill-compat">${slicerTags}</div>
        </div>`;
    });

    grid.innerHTML = cards.join('');
  }

  // ======================================================================
  // TROUBLESHOOTER TAB
  // ======================================================================

  function bindTroubleshooter() {
    document.getElementById('opt-ts-issue').addEventListener('change', renderTroubleshoot);
  }

  function renderTroubleshoot() {
    const issueKey = document.getElementById('opt-ts-issue').value;
    const output = document.getElementById('opt-ts-output');
    const empty = document.getElementById('opt-ts-empty');

    if (!issueKey || !TROUBLESHOOT_DATA[issueKey]) {
      output.style.display = 'none';
      empty.style.display = '';
      return;
    }

    const data = TROUBLESHOOT_DATA[issueKey];
    output.style.display = '';
    empty.style.display = 'none';

    document.getElementById('opt-ts-icon').textContent = data.icon;
    document.getElementById('opt-ts-title').textContent = data.title;
    document.getElementById('opt-ts-description').textContent = data.description;

    // Causes
    document.getElementById('opt-ts-causes').innerHTML = data.causes
      .map(c => `<li>${escapeHtml(c)}</li>`)
      .join('');

    // Steps
    document.getElementById('opt-ts-steps-container').innerHTML = data.steps.map((step, i) => `
      <div class="opt-ts-step">
        <div class="opt-ts-step-number">${i + 1}</div>
        <div class="opt-ts-step-content">
          <div class="opt-ts-step-title">${escapeHtml(step.title)}</div>
          <div class="opt-ts-step-detail">${step.detail}</div>
        </div>
      </div>
    `).join('');

    // Settings table
    const settingsCard = document.getElementById('opt-ts-settings-card');
    if (data.settings && data.settings.length) {
      settingsCard.style.display = '';
      document.getElementById('opt-ts-settings-tbody').innerHTML = data.settings.map(s => `
        <tr>
          <td style="font-weight:500;">${escapeHtml(s.setting)}</td>
          <td><code style="background:var(--bg-primary); padding:2px 6px; border-radius:3px; font-family:var(--font-mono); font-size:12px; color:var(--accent);">${escapeHtml(s.value)}</code></td>
          <td class="text-muted">${escapeHtml(s.notes)}</td>
        </tr>
      `).join('');
    } else {
      settingsCard.style.display = 'none';
    }
  }

  // ======================================================================
  // UTILITIES
  // ======================================================================

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // ======================================================================
  // BOOT
  // ======================================================================

  init();

})();
