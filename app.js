/**
 * Sprint Routechoice Analyser
 * Clean, modern, self-contained application for orienteering sprint course & routechoice analysis.
 */

(function () {
  'use strict';

  // --- IOF COLOR & SYMBOLOGY CONSTANTS ---
  const IOF_PURPLE = 'rgba(192, 38, 211, 1)'; // Vibrant IOF PMS purple (#c026d3)
  const IOF_PURPLE_DARK = 'rgba(147, 19, 147, 1)';
  const ROUTE_COLORS = [
    { name: 'Blue', hex: '#2563eb' },
    { name: 'Emerald', hex: '#059669' },
    { name: 'Amber', hex: '#d97706' },
    { name: 'Purple', hex: '#9333ea' },
    { name: 'Crimson', hex: '#e11d48' },
    { name: 'Cyan', hex: '#0891b2' },
    { name: 'Pink', hex: '#db2777' },
    { name: 'Indigo', hex: '#4f46e5' }
  ];

  // Configure PDF.js Worker
  if (window.pdfjsLib) {
    window.pdfjsLib.GlobalWorkerOptions.workerSrc =
      'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  }

  // --- APPLICATION STATE ---
  const state = {
    step: 1, // 1: Map & Scale, 2: Draw Course, 3: Routechoices
    eventName: '',
    map: {
      image: null,
      width: 0,
      height: 0,
      fileName: '',
      dataUrl: '',
      stitchedInfo: null
    },
    scale: 4000,
    dpi: 150,
    calibration: {
      active: false,
      point1: null,
      point2: null
    },
    controls: [], // Array of { id, x, y, isFinish }
    legs: [], // Derived array of { index, start, end, label, straightDistMeters }
    selectedLegIndex: 0,
    autoRotate: true,
    showOverprint: true,
    showLegLines: true,
    showRouteLabels: true,
    markLastAsFinish: true,
    variants: [], // Array of { id, legIndex, name, color, points: [{x,y},...] }
    takenRouteByLeg: {}, // legIndex -> variantId (the route taken by user for each leg)
    runningPace: 4.0, // Running pace in min/km (default 4 mins/k)
    activeDrawing: [], // Points for route currently being drawn [{x, y}, ...]
    legNotes: {}, // legIndex -> string
    view: {
      zoom: 1,
      panX: 0,
      panY: 0,
      rotation: 0 // In degrees
    },
    mouse: {
      screenX: 0,
      screenY: 0,
      mapX: 0,
      mapY: 0,
      isPanning: false,
      panStartX: 0,
      panStartY: 0,
      draggedControl: null
    }
  };

  // --- DOM ELEMENTS ---
  const canvas = document.getElementById('mapCanvas');
  const ctx = canvas.getContext('2d');

  // Steps & Panels
  const stepBadge = document.getElementById('stepBadge');
  const navStep1 = document.getElementById('navStep1');
  const navStep2 = document.getElementById('navStep2');
  const navStep3 = document.getElementById('navStep3');
  const step1Panel = document.getElementById('step1Panel');
  const step2Panel = document.getElementById('step2Panel');
  const step3Panel = document.getElementById('step3Panel');

  // Step 1 Controls
  const eventNameInput = document.getElementById('eventNameInput');
  const dropZone = document.getElementById('dropZone');
  const mapFileInput = document.getElementById('mapFileInput');
  const mapStatusBox = document.getElementById('mapStatusBox');
  const mapStatusText = document.getElementById('mapStatusText');
  const removeMapBtn = document.getElementById('removeMapBtn');
  const appendMapBtn = document.getElementById('appendMapBtn');
  const appendMapFileInput = document.getElementById('appendMapFileInput');
  const stitchOptionsBox = document.getElementById('stitchOptionsBox');
  const stitchLayoutHBtn = document.getElementById('stitchLayoutHBtn');
  const stitchLayoutVBtn = document.getElementById('stitchLayoutVBtn');
  const restoreCourseScaleBtn = document.getElementById('restoreCourseScaleBtn');
  const scaleSelect = document.getElementById('scaleSelect');
  const customScaleInput = document.getElementById('customScaleInput');
  const dpiInput = document.getElementById('dpiInput');
  const resetCalibrationBtn = document.getElementById('resetCalibrationBtn');
  const startCalibrateBtn = document.getElementById('startCalibrateBtn');
  const calibrationActiveBanner = document.getElementById('calibrationActiveBanner');
  const calibStepText = document.getElementById('calibStepText');
  const cancelCalibBtn = document.getElementById('cancelCalibBtn');
  const proceedToStep2Btn = document.getElementById('proceedToStep2Btn');
  const emptyMapPrompt = document.getElementById('emptyMapPrompt');

  // Calibration Modal
  const calibrationModal = document.getElementById('calibrationModal');
  const calibDistanceInput = document.getElementById('calibDistanceInput');
  const calibCancelModalBtn = document.getElementById('calibCancelModalBtn');
  const calibApplyModalBtn = document.getElementById('calibApplyModalBtn');

  // Step 2 Controls
  const courseControlsCount = document.getElementById('courseControlsCount');
  const courseLegsCount = document.getElementById('courseLegsCount');
  const undoControlBtn = document.getElementById('undoControlBtn');
  const clearCourseBtn = document.getElementById('clearCourseBtn');
  const markFinishCheckbox = document.getElementById('markFinishCheckbox');
  const showOverprintCheckbox = document.getElementById('showOverprintCheckbox');
  const showLegLinesCheckbox = document.getElementById('showLegLinesCheckbox');
  const proceedToStep3Btn = document.getElementById('proceedToStep3Btn');
  const backToStep1Btn = document.getElementById('backToStep1Btn');

  // Step 3 Controls
  const prevLegBtn = document.getElementById('prevLegBtn');
  const nextLegBtn = document.getElementById('nextLegBtn');
  const legSelectDropdown = document.getElementById('legSelectDropdown');
  const legStraightDistBadge = document.getElementById('legStraightDistBadge');
  const autoRotateCheckbox = document.getElementById('autoRotateCheckbox');
  const showRouteLabelsCheckbox = document.getElementById('showRouteLabelsCheckbox');
  const toggleRouteLabelsQuickBtn = document.getElementById('toggleRouteLabelsQuickBtn');
  const resetLegViewBtn = document.getElementById('resetLegViewBtn');
  const showOverprintStep3Checkbox = document.getElementById('showOverprintStep3Checkbox');
  const showLegLinesStep3Checkbox = document.getElementById('showLegLinesStep3Checkbox');
  const activeRouteColorDot = document.getElementById('activeRouteColorDot');
  const activeRouteNameLabel = document.getElementById('activeRouteNameLabel');
  const liveRouteDistText = document.getElementById('liveRouteDistText');
  const undoRoutePointBtn = document.getElementById('undoRoutePointBtn');
  const saveRouteBtn = document.getElementById('saveRouteBtn');
  const variantsListContainer = document.getElementById('variantsListContainer');
  const variantCountBadge = document.getElementById('variantCountBadge');
  const noVariantsMsg = document.getElementById('noVariantsMsg');
  const legNotesTextarea = document.getElementById('legNotesTextarea');
  const saveProjectBtn = document.getElementById('saveProjectBtn');
  const loadProjectBtn = document.getElementById('loadProjectBtn');
  const projectFileInput = document.getElementById('projectFileInput');
  const saveProjectBtnStep1 = document.getElementById('saveProjectBtnStep1');
  const loadProjectBtnStep1 = document.getElementById('loadProjectBtnStep1');
  const saveProjectBtnStep2 = document.getElementById('saveProjectBtnStep2');
  const loadProjectBtnStep2 = document.getElementById('loadProjectBtnStep2');
  const exportHtmlBtn = document.getElementById('exportHtmlBtn');
  const backToStep2Btn = document.getElementById('backToStep2Btn');

  // Top Header & Project Dropdown Elements
  const projectMenuBtn = document.getElementById('projectMenuBtn');
  const projectMenuDropdown = document.getElementById('projectMenuDropdown');
  const menuOpenProjectBtn = document.getElementById('menuOpenProjectBtn');
  const menuPullGhBtn = document.getElementById('menuPullGhBtn');
  const menuExportJsonBtn = document.getElementById('menuExportJsonBtn');
  const menuResetProjectBtn = document.getElementById('menuResetProjectBtn');

  // Step 3 View Dropdown Elements
  const viewMenuBtn = document.getElementById('viewMenuBtn');
  const viewMenuDropdown = document.getElementById('viewMenuDropdown');

  // Collapsible Run Stats Elements
  const toggleStatsBtn = document.getElementById('toggleStatsBtn');
  const statsSummaryText = document.getElementById('statsSummaryText');
  const statsToggleIcon = document.getElementById('statsToggleIcon');
  const statsDetailsSection = document.getElementById('statsDetailsSection');

  // Run Performance & Stats Elements
  const runningPaceSelect = document.getElementById('runningPaceSelect');
  const statsLegsRatio = document.getElementById('statsLegsRatio');
  const statsCorrectPercent = document.getElementById('statsCorrectPercent');
  const statsTotalExtraDist = document.getElementById('statsTotalExtraDist');
  const statsAvgPercentLoss = document.getElementById('statsAvgPercentLoss');
  const statsAvgDistLoss = document.getElementById('statsAvgDistLoss');
  const statsTimeLoss = document.getElementById('statsTimeLoss');
  const statsPaceLabel = document.getElementById('statsPaceLabel');

  // Floating Viewport Controls
  const zoomInBtn = document.getElementById('zoomInBtn');
  const zoomOutBtn = document.getElementById('zoomOutBtn');
  const rotateLeftBtn = document.getElementById('rotateLeftBtn');
  const rotateRightBtn = document.getElementById('rotateRightBtn');
  const resetRotationBtn = document.getElementById('resetRotationBtn');
  const rotationAngleDisplay = document.getElementById('rotationAngleDisplay');
  const resetZoomBtn = document.getElementById('resetZoomBtn');

  // --- COORDINATE MATH & TRANSFORMATIONS ---

  /** Converts screen pixels (clientX/Y relative to canvas) to map pixels */
  function screenToMap(screenX, screenY) {
    const cx = screenX - canvas.width / 2;
    const cy = screenY - canvas.height / 2;
    const rad = (-state.view.rotation * Math.PI) / 180;

    // Un-rotate
    const rx = cx * Math.cos(rad) - cy * Math.sin(rad);
    const ry = cx * Math.sin(rad) + cy * Math.cos(rad);

    // Un-pan and un-zoom
    const mapX = (rx - state.view.panX) / state.view.zoom + state.map.width / 2;
    const mapY = (ry - state.view.panY) / state.view.zoom + state.map.height / 2;
    return { x: mapX, y: mapY };
  }

  /** Converts map pixels to screen coordinates */
  function mapToScreen(mapX, mapY) {
    const dx = (mapX - state.map.width / 2) * state.view.zoom + state.view.panX;
    const dy = (mapY - state.map.height / 2) * state.view.zoom + state.view.panY;
    const rad = (state.view.rotation * Math.PI) / 180;

    const rx = dx * Math.cos(rad) - dy * Math.sin(rad);
    const ry = dx * Math.sin(rad) + dy * Math.cos(rad);

    return {
      x: canvas.width / 2 + rx,
      y: canvas.height / 2 + ry
    };
  }

  /** Calculates real-world distance in meters from map pixels */
  function pixelsToMeters(pixelDistance) {
    if (!state.dpi || !state.scale || pixelDistance <= 0) return 0;
    // (pixels / dpi) * 0.0254 m/inch * scale
    return (pixelDistance / state.dpi) * 0.0254 * state.scale;
  }

  /** Calculates distance between two points */
  function distanceBetween(p1, p2) {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /** Calculates total length of a polyline in meters */
  function polylineLengthMeters(points) {
    if (!points || points.length < 2) return 0;
    let totalPixels = 0;
    for (let i = 0; i < points.length - 1; i++) {
      totalPixels += distanceBetween(points[i], points[i + 1]);
    }
    return pixelsToMeters(totalPixels);
  }

  // --- MAP RESIZE & RENDERING ENGINE ---

  function resizeCanvas() {
    const rect = canvas.parentElement.getBoundingClientRect();
    if (canvas.width !== rect.width || canvas.height !== rect.height) {
      canvas.width = rect.width;
      canvas.height = rect.height;
      render();
    }
  }
  window.addEventListener('resize', resizeCanvas);

  /** Main Render Loop */
  function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!state.map.image) {
      emptyMapPrompt.classList.remove('hidden');
      return;
    }
    emptyMapPrompt.classList.add('hidden');

    ctx.save();
    // Center of canvas
    ctx.translate(canvas.width / 2, canvas.height / 2);
    // Rotate
    ctx.rotate((state.view.rotation * Math.PI) / 180);
    // Pan & Zoom
    ctx.translate(state.view.panX, state.view.panY);
    ctx.scale(state.view.zoom, state.view.zoom);

    // Draw Map Image
    ctx.drawImage(
      state.map.image,
      -state.map.width / 2,
      -state.map.height / 2,
      state.map.width,
      state.map.height
    );

    // Coordinate offset to map origin (0, 0)
    ctx.translate(-state.map.width / 2, -state.map.height / 2);

    // 1. Draw Course Overprint (Start, Controls, Legs, Finish)
    if ((state.showOverprint || state.showLegLines) && state.controls.length > 0) {
      drawCourseOverprint();
    }

    // 2. Draw Saved Routechoices & Active Drawing (only in Routechoices mode - Step 3)
    if (state.step === 3) {
      drawSavedRoutechoices();
      drawActiveRouteDrawing();
    }

    // 4. Draw 2-Point Calibration Line (if active)
    drawCalibrationLine();

    ctx.restore();
  }

  /** Draws IOF Orienteering Course Overprints */
  function drawCourseOverprint() {
    const ctrlRadius = Math.max(14, 18 / state.view.zoom);
    const lineWidth = Math.max(2.5, 3.2 / state.view.zoom);
    const fontSize = Math.max(16, 20 / state.view.zoom);

    // Connect Leg lines between consecutive controls
    if (state.showLegLines) {
      for (let i = 0; i < state.controls.length - 1; i++) {
        const c1 = state.controls[i];
        const c2 = state.controls[i + 1];
        const dist = distanceBetween(c1, c2);

        const isActiveLeg = state.step === 3 && state.selectedLegIndex === i;

        // Draw leg line with gap around control circles
        if (dist > ctrlRadius * 2) {
          const gap1 = i === 0 ? ctrlRadius * 1.1 : ctrlRadius;
          const gap2 = ctrlRadius;
          const dx = (c2.x - c1.x) / dist;
          const dy = (c2.y - c1.y) / dist;

          const x1 = c1.x + dx * gap1;
          const y1 = c1.y + dy * gap1;
          const x2 = c2.x - dx * gap2;
          const y2 = c2.y - dy * gap2;

          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.strokeStyle = isActiveLeg ? '#f43f5e' : IOF_PURPLE;
          ctx.lineWidth = isActiveLeg ? lineWidth * 1.5 : lineWidth;
          ctx.lineCap = 'round';
          ctx.stroke();
        }
      }
    }

    // Draw Controls
    if (state.showOverprint) {
      state.controls.forEach((ctrl, idx) => {
        const isStart = idx === 0;
        const isFinish = (ctrl.isFinish || idx === state.controls.length - 1) && state.controls.length > 1 && state.markLastAsFinish;

        ctx.save();

        if (isStart) {
          // Start: Purple Triangle oriented towards control 1
          let angle = 0;
          if (state.controls.length > 1) {
            const next = state.controls[1];
            angle = Math.atan2(next.y - ctrl.y, next.x - ctrl.x);
          }
          const triSize = ctrlRadius * 1.35;

          ctx.translate(ctrl.x, ctrl.y);
          ctx.rotate(angle);

          ctx.beginPath();
          ctx.moveTo(triSize, 0);
          ctx.lineTo(
            triSize * Math.cos((2 * Math.PI) / 3),
            triSize * Math.sin((2 * Math.PI) / 3)
          );
          ctx.lineTo(
            triSize * Math.cos((4 * Math.PI) / 3),
            triSize * Math.sin((4 * Math.PI) / 3)
          );
          ctx.closePath();

          ctx.strokeStyle = IOF_PURPLE;
          ctx.lineWidth = lineWidth;
          ctx.stroke();
        } else if (isFinish) {
          // Finish: Double Concentric Circle
          ctx.beginPath();
          ctx.arc(ctrl.x, ctrl.y, ctrlRadius * 0.7, 0, Math.PI * 2);
          ctx.strokeStyle = IOF_PURPLE;
          ctx.lineWidth = lineWidth;
          ctx.stroke();

          ctx.beginPath();
          ctx.arc(ctrl.x, ctrl.y, ctrlRadius * 1.15, 0, Math.PI * 2);
          ctx.strokeStyle = IOF_PURPLE;
          ctx.lineWidth = lineWidth;
          ctx.stroke();
        } else {
          // Standard Control Circle
          ctx.beginPath();
          ctx.arc(ctrl.x, ctrl.y, ctrlRadius, 0, Math.PI * 2);
          ctx.strokeStyle = IOF_PURPLE;
          ctx.lineWidth = lineWidth;
          ctx.stroke();

          // Control Number label offset
          const numText = idx.toString();
          ctx.font = `bold ${fontSize}px sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';

          // Offset position
          const textOffset = ctrlRadius * 1.6;
          let tx = ctrl.x + textOffset;
          let ty = ctrl.y - textOffset;

          // White text halo for contrast
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 4 / state.view.zoom;
          ctx.strokeText(numText, tx, ty);

          ctx.fillStyle = IOF_PURPLE_DARK;
          ctx.fillText(numText, tx, ty);
        }

        ctx.restore();
      });
    }
  }

  /** Draws Saved Routechoices */
  function drawSavedRoutechoices() {
    if (state.step !== 3) return; // Only show routechoices in Step 3 (Routechoices mode)

    const lineWidth = Math.max(3.5, 4.5 / state.view.zoom);
    const labelFontSize = Math.max(13, 16 / state.view.zoom);

    state.variants.forEach((variant) => {
      // In Step 3, focus on the selected leg; show others dimmed
      const isSelectedLeg = variant.legIndex === state.selectedLegIndex;
      const opacity = isSelectedLeg ? 0.95 : 0.25;

      if (!variant.points || variant.points.length < 2) return;

      ctx.save();
      ctx.globalAlpha = opacity;

      // Draw polyline route
      ctx.beginPath();
      ctx.moveTo(variant.points[0].x, variant.points[0].y);
      for (let i = 1; i < variant.points.length; i++) {
        ctx.lineTo(variant.points[i].x, variant.points[i].y);
      }
      ctx.strokeStyle = variant.color;
      ctx.lineWidth = lineWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke();

      // Draw route midpoint badge / label
      if (isSelectedLeg && state.showRouteLabels) {
        const isTaken = state.takenRouteByLeg[variant.legIndex] === variant.id;
        const midIdx = Math.floor(variant.points.length / 2);
        const midP = variant.points[midIdx];

        ctx.font = `bold ${labelFontSize}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // Badge pill background
        const lengthText = `${polylineLengthMeters(variant.points).toFixed(0)}m`;
        const text = isTaken ? `✓ ${variant.name} (${lengthText}) [My Route]` : `${variant.name} (${lengthText})`;
        const metrics = ctx.measureText(text);
        const padX = 7 / state.view.zoom;
        const padY = 4 / state.view.zoom;
        const bw = metrics.width + padX * 2;
        const bh = labelFontSize + padY * 2;

        ctx.fillStyle = isTaken ? '#4338ca' : variant.color;
        ctx.beginPath();
        ctx.roundRect(midP.x - bw / 2, midP.y - bh / 2 - 12 / state.view.zoom, bw, bh, 4 / state.view.zoom);
        ctx.fill();

        if (isTaken) {
          ctx.strokeStyle = '#fbbf24'; // Gold border for my route
          ctx.lineWidth = 2 / state.view.zoom;
          ctx.stroke();
        }

        ctx.fillStyle = '#ffffff';
        ctx.fillText(text, midP.x, midP.y - 12 / state.view.zoom);
      }

      ctx.restore();
    });
  }

  /** Draws Active Route Polyline currently being drawn */
  function drawActiveRouteDrawing() {
    if (state.step !== 3) return;
    if (state.activeDrawing.length === 0) return;

    const lineWidth = Math.max(3.5, 4.5 / state.view.zoom);
    const color = getNextVariantColor();

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(state.activeDrawing[0].x, state.activeDrawing[0].y);
    for (let i = 1; i < state.activeDrawing.length; i++) {
      ctx.lineTo(state.activeDrawing[i].x, state.activeDrawing[i].y);
    }
    // Connect to current cursor position
    ctx.lineTo(state.mouse.mapX, state.mouse.mapY);

    ctx.strokeStyle = color.hex;
    ctx.lineWidth = lineWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.setLineDash([8 / state.view.zoom, 6 / state.view.zoom]);
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw vertex dots
    state.activeDrawing.forEach((p) => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 4 / state.view.zoom, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.strokeStyle = color.hex;
      ctx.lineWidth = 2 / state.view.zoom;
      ctx.stroke();
    });

    ctx.restore();
  }

  /** Draws 2-Point Calibration Line */
  function drawCalibrationLine() {
    if (!state.calibration.active || !state.calibration.point1) return;

    const p1 = state.calibration.point1;
    const p2 = state.calibration.point2 || { x: state.mouse.mapX, y: state.mouse.mapY };

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.strokeStyle = '#2563eb';
    ctx.lineWidth = 3 / state.view.zoom;
    ctx.setLineDash([6 / state.view.zoom, 4 / state.view.zoom]);
    ctx.stroke();
    ctx.setLineDash([]);

    // End points
    [p1, p2].forEach((p) => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 6 / state.view.zoom, 0, Math.PI * 2);
      ctx.fillStyle = '#2563eb';
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2 / state.view.zoom;
      ctx.stroke();
    });

    ctx.restore();
  }

  // --- COURSE & LEGS COMPUTATION ---

  function updateLegs() {
    const legs = [];
    for (let i = 0; i < state.controls.length - 1; i++) {
      const c1 = state.controls[i];
      const c2 = state.controls[i + 1];
      const label1 = i === 0 ? 'S' : i.toString();
      const isFinish = (c2.isFinish || i + 1 === state.controls.length - 1) && state.markLastAsFinish;
      const label2 = isFinish ? 'F' : (i + 1).toString();

      const dist = pixelsToMeters(distanceBetween(c1, c2));
      legs.push({
        index: i,
        start: c1,
        end: c2,
        label: `Leg ${label1} → ${label2}`,
        straightDistMeters: dist
      });
    }
    state.legs = legs;

    // Update UI Badges
    courseControlsCount.textContent = `${state.controls.length} control${state.controls.length === 1 ? '' : 's'} placed`;
    courseLegsCount.textContent = `${legs.length} leg${legs.length === 1 ? '' : 's'}`;

    undoControlBtn.disabled = state.controls.length === 0;
    clearCourseBtn.disabled = state.controls.length === 0;
    proceedToStep3Btn.disabled = legs.length === 0;

    if (legs.length > 0) {
      proceedToStep3Btn.classList.remove('bg-slate-200', 'text-slate-400', 'cursor-not-allowed');
      proceedToStep3Btn.classList.add('bg-blue-600', 'hover:bg-blue-700', 'text-white', 'shadow-sm', 'cursor-pointer');
    } else {
      proceedToStep3Btn.classList.add('bg-slate-200', 'text-slate-400', 'cursor-not-allowed');
      proceedToStep3Btn.classList.remove('bg-blue-600', 'hover:bg-blue-700', 'text-white', 'shadow-sm', 'cursor-pointer');
    }

    updateLegDropdown();
  }

  function updateLegDropdown() {
    legSelectDropdown.innerHTML = '';
    state.legs.forEach((leg, idx) => {
      const opt = document.createElement('option');
      opt.value = idx;
      opt.textContent = leg.label;
      legSelectDropdown.appendChild(opt);
    });

    if (state.selectedLegIndex >= state.legs.length) {
      state.selectedLegIndex = Math.max(0, state.legs.length - 1);
    }
    legSelectDropdown.value = state.selectedLegIndex;

    prevLegBtn.disabled = state.selectedLegIndex <= 0;
    nextLegBtn.disabled = state.selectedLegIndex >= state.legs.length - 1;

    updateActiveLegUI();
  }

  /** Focus, center, and auto-rotate the viewport on the selected leg */
  function focusLeg(legIndex) {
    if (legIndex < 0 || legIndex >= state.legs.length) return;
    const leg = state.legs[legIndex];

    // Calculate rotation: orient leg vertically (start at bottom, end at top)
    const dx = leg.end.x - leg.start.x;
    const dy = leg.end.y - leg.start.y;
    const legAngleDeg = (Math.atan2(dy, dx) * 180) / Math.PI;

    if (state.autoRotate) {
      // Rotating so (dx, dy) points towards -90deg (top of screen)
      state.view.rotation = Math.round(-(legAngleDeg + 90));
      rotationAngleDisplay.textContent = `${state.view.rotation}°`;
    }

    // Collect all points on this leg (Start, End, and all drawn route variants)
    const legVariants = state.variants.filter((v) => v.legIndex === legIndex);
    const allPoints = [leg.start, leg.end];
    legVariants.forEach((v) => allPoints.push(...v.points));

    // Calculate center
    const avgX = allPoints.reduce((sum, p) => sum + p.x, 0) / allPoints.length;
    const avgY = allPoints.reduce((sum, p) => sum + p.y, 0) / allPoints.length;

    // Calculate rotated bounding box
    const rad = (-state.view.rotation * Math.PI) / 180;
    let maxRotX = 0;
    let maxRotY = 0;
    allPoints.forEach((p) => {
      const ox = p.x - avgX;
      const oy = p.y - avgY;
      const rx = Math.abs(ox * Math.cos(rad) - oy * Math.sin(rad));
      const ry = Math.abs(ox * Math.sin(rad) + oy * Math.cos(rad));
      if (rx > maxRotX) maxRotX = rx;
      if (ry > maxRotY) maxRotY = ry;
    });

    // Determine optimal zoom with safe viewport margins (padding)
    const availW = canvas.width - 80;
    const availH = canvas.height - 100;
    const zoomX = maxRotX > 0 ? availW / (maxRotX * 2.4) : 1;
    const zoomY = maxRotY > 0 ? availH / (maxRotY * 2.4) : 1;
    const fitZoom = Math.max(0.1, Math.min(Math.min(zoomX, zoomY), 6.0));

    state.view.zoom = fitZoom;
    // Set pan so avgX, avgY is at canvas center
    state.view.panX = -(avgX - state.map.width / 2) * fitZoom;
    state.view.panY = -(avgY - state.map.height / 2) * fitZoom;

    render();
  }

  function updateActiveLegUI() {
    if (state.legs.length === 0) {
      legStraightDistBadge.textContent = '-- m';
      return;
    }
    const currentLeg = state.legs[state.selectedLegIndex];
    if (currentLeg) {
      legStraightDistBadge.textContent = `${currentLeg.straightDistMeters.toFixed(0)}m straight`;
      legNotesTextarea.value = state.legNotes[state.selectedLegIndex] || '';
    }

    prevLegBtn.disabled = state.selectedLegIndex <= 0;
    nextLegBtn.disabled = state.selectedLegIndex >= state.legs.length - 1;

    updateVariantsList();
  }

  function getNextVariantColor() {
    const count = state.variants.filter((v) => v.legIndex === state.selectedLegIndex).length;
    return ROUTE_COLORS[count % ROUTE_COLORS.length];
  }

  function getNextVariantName() {
    const count = state.variants.filter((v) => v.legIndex === state.selectedLegIndex).length;
    return `Option ${String.fromCharCode(65 + count)}`;
  }

  function updateVariantsList() {
    const legVariants = state.variants.filter((v) => v.legIndex === state.selectedLegIndex);
    variantCountBadge.textContent = `${legVariants.length} route${legVariants.length === 1 ? '' : 's'}`;

    variantsListContainer.innerHTML = '';
    if (legVariants.length === 0) {
      variantsListContainer.appendChild(noVariantsMsg);
      noVariantsMsg.classList.remove('hidden');
    } else {
      noVariantsMsg.classList.add('hidden');

      // Find shortest route length
      const lengths = legVariants.map((v) => polylineLengthMeters(v.points));
      const minLength = Math.min(...lengths);
      const takenVariantId = state.takenRouteByLeg[state.selectedLegIndex];

      legVariants.forEach((v, idx) => {
        const len = lengths[idx];
        const diffPercent = minLength > 0 ? ((len - minLength) / minLength) * 100 : 0;
        const isOptimal = Math.abs(len - minLength) < 0.1;
        const isTaken = takenVariantId === v.id;

        const item = document.createElement('div');
        item.className = `flex items-center justify-between p-2 rounded-lg border text-xs shadow-xs transition-colors ${
          isTaken ? 'bg-indigo-50 border-indigo-300 ring-1 ring-indigo-400' : 'bg-slate-50 border-slate-200'
        }`;

        item.innerHTML = `
          <div class="flex items-center gap-2">
            <!-- My Route Checkbox -->
            <label class="flex items-center cursor-pointer" title="Tick if this is the route you took on this leg">
              <input type="checkbox" class="take-route-checkbox accent-indigo-600 rounded cursor-pointer" data-id="${v.id}" ${isTaken ? 'checked' : ''}>
            </label>
            <span class="w-3 h-3 rounded-full shrink-0" style="background-color: ${v.color};"></span>
            <span class="font-bold text-slate-800">${v.name}</span>
            <span class="font-mono text-slate-600 font-semibold">${len.toFixed(0)}m</span>
            ${isTaken ? '<span class="px-1.5 py-0.2 rounded text-[9px] font-bold bg-indigo-600 text-white uppercase tracking-wider">My Route</span>' : ''}
          </div>
          <div class="flex items-center gap-2">
            <span class="px-1.5 py-0.5 rounded text-[10px] font-bold ${
              isOptimal ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
            }">
              ${isOptimal ? 'Fastest' : `+${diffPercent.toFixed(1)}%`}
            </span>
            <button class="delete-variant-btn text-slate-400 hover:text-red-600 font-bold p-1 cursor-pointer" title="Delete variant" data-id="${v.id}">
              ✕
            </button>
          </div>
        `;
        variantsListContainer.appendChild(item);
      });

      // Attach 'My Route' checkbox toggles
      variantsListContainer.querySelectorAll('.take-route-checkbox').forEach((checkbox) => {
        checkbox.addEventListener('change', (e) => {
          const id = Number(e.currentTarget.dataset.id);
          if (e.currentTarget.checked) {
            state.takenRouteByLeg[state.selectedLegIndex] = id;
          } else {
            if (state.takenRouteByLeg[state.selectedLegIndex] === id) {
              delete state.takenRouteByLeg[state.selectedLegIndex];
            }
          }
          updateVariantsList();
          recalculateRunStats();
          render();
        });
      });

      // Attach delete events
      variantsListContainer.querySelectorAll('.delete-variant-btn').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          const id = Number(e.currentTarget.dataset.id);
          state.variants = state.variants.filter((v) => v.id !== id);
          if (state.takenRouteByLeg[state.selectedLegIndex] === id) {
            delete state.takenRouteByLeg[state.selectedLegIndex];
          }
          updateVariantsList();
          recalculateRunStats();
          render();
        });
      });
    }

    // Update active route preparation
    const nextColor = getNextVariantColor();
    activeRouteColorDot.style.backgroundColor = nextColor.hex;
    activeRouteNameLabel.textContent = getNextVariantName();

    recalculateRunStats();
  }

  /** Calculates Run Performance & Error Analytics across all legs */
  function recalculateRunStats() {
    if (!statsLegsRatio) return;

    let evaluatedLegsCount = 0;
    let optimalLegsCount = 0;
    let totalExtraDistanceMeters = 0;
    let totalTakenDistanceMeters = 0;
    let totalOptimalDistanceMeters = 0;

    state.legs.forEach((leg, idx) => {
      const legVariants = state.variants.filter((v) => v.legIndex === idx);
      if (legVariants.length === 0) return;

      const lengths = legVariants.map((v) => polylineLengthMeters(v.points));
      const minLength = Math.min(...lengths);

      const takenId = state.takenRouteByLeg[idx];
      const takenVar = legVariants.find((v) => v.id === takenId);

      if (takenVar) {
        evaluatedLegsCount++;
        const takenLen = polylineLengthMeters(takenVar.points);
        const extra = Math.max(0, takenLen - minLength);
        totalExtraDistanceMeters += extra;
        totalTakenDistanceMeters += takenLen;
        totalOptimalDistanceMeters += minLength;

        if (extra < 0.5) {
          optimalLegsCount++;
        }
      }
    });

    const totalLegs = state.legs.length;
    statsLegsRatio.textContent = `${evaluatedLegsCount} / ${totalLegs}`;

    if (evaluatedLegsCount === 0) {
      statsCorrectPercent.textContent = '0% Optimal';
      statsTotalExtraDist.textContent = '+0 m';
      statsAvgPercentLoss.textContent = 'Avg: +0.0%';
      statsAvgDistLoss.textContent = '0 m';
      statsTimeLoss.textContent = '+0.0s';
      if (statsSummaryText) {
        statsSummaryText.textContent = `${evaluatedLegsCount}/${totalLegs} legs · +0.0s loss`;
      }
      if (statsPaceLabel) statsPaceLabel.textContent = `at ${state.runningPace.toFixed(2)} min/km`;
      return;
    }

    const correctPct = (optimalLegsCount / evaluatedLegsCount) * 100;
    statsCorrectPercent.textContent = `${correctPct.toFixed(0)}% Optimal (${optimalLegsCount} leg${optimalLegsCount === 1 ? '' : 's'})`;

    statsTotalExtraDist.textContent = `+${totalExtraDistanceMeters.toFixed(0)} m`;

    const avgExtraMeters = totalExtraDistanceMeters / evaluatedLegsCount;
    statsAvgDistLoss.textContent = `+${avgExtraMeters.toFixed(1)} m`;

    const avgPct = totalOptimalDistanceMeters > 0 
      ? (totalExtraDistanceMeters / totalOptimalDistanceMeters) * 100 
      : 0;
    statsAvgPercentLoss.textContent = `Avg: +${avgPct.toFixed(1)}%`;

    // Time loss calculation:
    // Pace in min/km -> seconds per meter = (pace * 60) / 1000
    const secPerMeter = (state.runningPace * 60) / 1000;
    const timeLossSeconds = totalExtraDistanceMeters * secPerMeter;

    let timeLossFormatted = `+${timeLossSeconds.toFixed(1)}s`;
    if (timeLossSeconds < 60) {
      statsTimeLoss.textContent = `+${timeLossSeconds.toFixed(1)}s`;
    } else {
      const mins = Math.floor(timeLossSeconds / 60);
      const remSecs = (timeLossSeconds % 60).toFixed(0);
      statsTimeLoss.textContent = `+${mins}m ${remSecs}s`;
      timeLossFormatted = `+${mins}m ${remSecs}s`;
    }

    if (statsSummaryText) {
      statsSummaryText.textContent = `${evaluatedLegsCount}/${totalLegs} legs · ${timeLossFormatted} loss`;
    }

    if (statsPaceLabel) {
      const mins = Math.floor(state.runningPace);
      const secs = Math.round((state.runningPace - mins) * 60);
      const secsStr = secs < 10 ? `0${secs}` : secs;
      statsPaceLabel.textContent = `at ${mins}:${secsStr} min/km`;
    }
  }

  // --- STEPPER TRANSITIONS ---

  function setStep(newStep) {
    state.step = newStep;
    stepBadge.textContent = `Step ${newStep}/3`;

    // Header Tabs styling
    [navStep1, navStep2, navStep3].forEach((tab, i) => {
      if (i + 1 === newStep) {
        tab.className = 'px-3.5 py-1.5 rounded-lg text-xs font-bold bg-blue-600 text-white shadow-sm transition-all cursor-pointer';
      } else {
        tab.className = 'px-3.5 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-all cursor-pointer';
      }
    });

    // Panels visibility
    step1Panel.classList.toggle('hidden', newStep !== 1);
    step2Panel.classList.toggle('hidden', newStep !== 2);
    step3Panel.classList.toggle('hidden', newStep !== 3);

    // Canvas cursor
    canvas.classList.remove('drawing-mode', 'calibrating-mode');
    if (newStep === 2 || newStep === 3) {
      canvas.classList.add('drawing-mode');
    }

    // If entering Step 3, auto-focus Leg 1
    if (newStep === 3 && state.legs.length > 0) {
      focusLeg(state.selectedLegIndex);
    } else if (newStep === 2) {
      render();
    }
  }

  // Stepper tab click events
  navStep1.addEventListener('click', () => setStep(1));
  navStep2.addEventListener('click', () => {
    if (state.map.image) setStep(2);
  });
  navStep3.addEventListener('click', () => {
    if (state.map.image && state.legs.length > 0) setStep(3);
  });

  proceedToStep2Btn.addEventListener('click', () => setStep(2));
  backToStep1Btn.addEventListener('click', () => setStep(1));
  proceedToStep3Btn.addEventListener('click', () => setStep(3));
  backToStep2Btn.addEventListener('click', () => setStep(2));

  // --- MAP UPLOAD & HANDLING ---

  function getMapImageFileName(fileName) {
    if (!fileName) return 'map.png';
    // If it has .pdf extension, replace it with .png
    if (/\.pdf$/i.test(fileName)) {
      return fileName.replace(/\.pdf$/i, '.png');
    }
    // If it has a standard image extension, keep it
    if (/\.(png|jpe?g|webp|gif|svg)$/i.test(fileName)) {
      return fileName;
    }
    return fileName + '.png';
  }

  function downloadDataUrlAsFile(dataUrl, fileName) {
    try {
      const parts = dataUrl.split(';base64,');
      if (parts.length === 2) {
        const contentType = parts[0].replace('data:', '') || 'image/png';
        const raw = window.atob(parts[1]);
        const rawLength = raw.length;
        const uInt8Array = new Uint8Array(rawLength);
        for (let i = 0; i < rawLength; ++i) {
          uInt8Array[i] = raw.charCodeAt(i);
        }
        const blob = new Blob([uInt8Array], { type: contentType });
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(blobUrl), 3000);
        return;
      }
    } catch (err) {
      console.warn('Blob download fallback:', err);
    }
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  // Natural sort for file names (e.g. part1, part2, part10)
  function sortFilesByName(files) {
    return [...files].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
  }

  function drawPartBadge(ctx, text, x, y) {
    ctx.save();
    ctx.font = 'bold 22px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    const textMetrics = ctx.measureText(text);
    const padX = 14;
    const padY = 8;
    const bw = textMetrics.width + padX * 2;
    const bh = 34;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(x, y, bw, bh, 8);
    } else {
      ctx.rect(x, y, bw, bh);
    }
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#f8fafc';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x + padX, y + bh / 2);
    ctx.restore();
  }

  // Master Stitching Function: combines multiple rendered part canvases into one master canvas
  function stitchCanvases(parts, requestedLayout) {
    if (!parts || parts.length === 0) return null;
    if (parts.length === 1) {
      return {
        canvas: parts[0].canvas,
        dataUrl: parts[0].canvas.toDataURL('image/png'),
        width: parts[0].width,
        height: parts[0].height,
        layout: 'single',
        gap: 0,
        offsets: [{ x: 0, y: 0, width: parts[0].width, height: parts[0].height, name: parts[0].name }]
      };
    }

    // Determine layout: if portrait (height >= width), default horizontal side-by-side
    let layout = requestedLayout;
    if (!layout || layout === 'auto') {
      layout = (parts[0].height >= parts[0].width) ? 'horizontal' : 'vertical';
    }

    const gap = 24;
    let totalWidth = 0;
    let totalHeight = 0;

    if (layout === 'horizontal') {
      totalWidth = parts.reduce((sum, p) => sum + p.width, 0) + gap * (parts.length - 1);
      totalHeight = Math.max(...parts.map(p => p.height));
    } else {
      totalWidth = Math.max(...parts.map(p => p.width));
      totalHeight = parts.reduce((sum, p) => sum + p.height, 0) + gap * (parts.length - 1);
    }

    const masterCanvas = document.createElement('canvas');
    masterCanvas.width = totalWidth;
    masterCanvas.height = totalHeight;
    const mCtx = masterCanvas.getContext('2d');

    // Fill background with elegant dark slate matching dark theme
    mCtx.fillStyle = '#0f172a';
    mCtx.fillRect(0, 0, totalWidth, totalHeight);

    const offsets = [];

    if (layout === 'horizontal') {
      let curX = 0;
      for (let i = 0; i < parts.length; i++) {
        const p = parts[i];
        // Always align to top (0) so Part 1 coordinate origin (0, 0) is strictly preserved
        const curY = 0;
        mCtx.drawImage(p.canvas || p.image, curX, curY, p.width, p.height);
        offsets.push({ x: curX, y: curY, width: p.width, height: p.height, name: p.name });

        // Draw Part Identifier Badge on the map
        drawPartBadge(mCtx, p.name || `Part ${i + 1}`, curX + 24, curY + 24);

        // Divider line in the gap
        if (i < parts.length - 1) {
          const divX = curX + p.width + Math.round(gap / 2);
          mCtx.save();
          mCtx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
          mCtx.lineWidth = 3;
          mCtx.setLineDash([10, 8]);
          mCtx.beginPath();
          mCtx.moveTo(divX, 0);
          mCtx.lineTo(divX, totalHeight);
          mCtx.stroke();
          mCtx.restore();
        }
        curX += p.width + gap;
      }
    } else {
      let curY = 0;
      for (let i = 0; i < parts.length; i++) {
        const p = parts[i];
        // Always align to left (0) so Part 1 coordinate origin (0, 0) is strictly preserved
        const curX = 0;
        mCtx.drawImage(p.canvas || p.image, curX, curY, p.width, p.height);
        offsets.push({ x: curX, y: curY, width: p.width, height: p.height, name: p.name });

        // Draw Part Identifier Badge
        drawPartBadge(mCtx, p.name || `Part ${i + 1}`, curX + 24, curY + 24);

        // Divider line in the gap
        if (i < parts.length - 1) {
          const divY = curY + p.height + Math.round(gap / 2);
          mCtx.save();
          mCtx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
          mCtx.lineWidth = 3;
          mCtx.setLineDash([10, 8]);
          mCtx.beginPath();
          mCtx.moveTo(0, divY);
          mCtx.lineTo(totalWidth, divY);
          mCtx.stroke();
          mCtx.restore();
        }
        curY += p.height + gap;
      }
    }

    return {
      canvas: masterCanvas,
      dataUrl: masterCanvas.toDataURL('image/png'),
      width: totalWidth,
      height: totalHeight,
      layout,
      gap,
      offsets
    };
  }

  async function loadPdfDoc(typedarray, scale = 3.5) {
    const pdf = await window.pdfjsLib.getDocument({ data: typedarray }).promise;
    const numPages = pdf.numPages;
    const pages = [];

    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale });
      const offCanvas = document.createElement('canvas');
      offCanvas.width = viewport.width;
      offCanvas.height = viewport.height;
      const offCtx = offCanvas.getContext('2d');
      await page.render({ canvasContext: offCtx, viewport }).promise;

      pages.push({
        name: numPages > 1 ? `Part ${pageNum} (Page ${pageNum})` : `Page ${pageNum}`,
        type: 'pdf',
        pdfBytes: typedarray,
        pageNum: pageNum,
        canvas: offCanvas,
        width: viewport.width,
        height: viewport.height
      });
    }

    return { pdf, numPages, pages };
  }

  function loadRasterImage(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const offCanvas = document.createElement('canvas');
          offCanvas.width = img.naturalWidth || img.width;
          offCanvas.height = img.naturalHeight || img.height;
          const offCtx = offCanvas.getContext('2d');
          offCtx.drawImage(img, 0, 0);

          resolve({
            name: file.name.replace(/\.[^.]+$/i, ''),
            type: 'image',
            pdfBytes: null,
            pageNum: 1,
            canvas: offCanvas,
            image: img,
            dataUrl: e.target.result,
            width: offCanvas.width,
            height: offCanvas.height
          });
        };
        img.onerror = reject;
        img.src = e.target.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function updateStitchUi(isStitched, layout = 'horizontal', partCount = 1) {
    if (isStitched && partCount > 1) {
      if (stitchOptionsBox) stitchOptionsBox.classList.remove('hidden');
      if (appendMapBtn) appendMapBtn.classList.remove('hidden');

      if (stitchLayoutHBtn && stitchLayoutVBtn) {
        if (layout === 'horizontal') {
          stitchLayoutHBtn.className = 'px-2 py-0.5 font-bold rounded-l-md bg-blue-600 text-white border border-blue-600 cursor-pointer';
          stitchLayoutVBtn.className = 'px-2 py-0.5 font-medium rounded-r-md bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 cursor-pointer';
        } else {
          stitchLayoutHBtn.className = 'px-2 py-0.5 font-medium rounded-l-md bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 cursor-pointer';
          stitchLayoutVBtn.className = 'px-2 py-0.5 font-bold rounded-r-md bg-blue-600 text-white border border-blue-600 cursor-pointer';
        }
      }
    } else {
      if (stitchOptionsBox) stitchOptionsBox.classList.add('hidden');
      if (appendMapBtn) {
        if (state.map.image) {
          appendMapBtn.classList.remove('hidden');
        } else {
          appendMapBtn.classList.add('hidden');
        }
      }
    }
  }

  function applyStitchedMapParts(parts, baseFileName, requestedLayout) {
    if (!parts || parts.length === 0) return;

    let layout = requestedLayout || (state.map.stitchedInfo ? state.map.stitchedInfo.layout : null);
    const stitchResult = stitchCanvases(parts, layout);
    if (!stitchResult) return;

    state.map.stitchedInfo = {
      isStitched: true,
      layout: stitchResult.layout,
      gap: stitchResult.gap,
      parts: parts,
      offsets: stitchResult.offsets
    };

    const firstPdfPart = parts.find(p => p.pdfBytes);
    if (firstPdfPart) {
      state.map.pdfBytes = firstPdfPart.pdfBytes;
    }

    updateStitchUi(true, stitchResult.layout, parts.length);

    const safeBaseName = baseFileName || 'map';
    const stitchedName = parts.length > 1
      ? `${safeBaseName.replace(/\.[^.]+$/i, '')} (Stitched ${parts.length} Parts).png`
      : (safeBaseName.endsWith('.png') ? safeBaseName : `${safeBaseName}.png`);

    // IMPORTANT: skipAutoRescale = true prevents expanding canvas dimensions from scaling course points!
    setMapImage(stitchResult.dataUrl, stitchedName, stitchResult.width, stitchResult.height, true);
  }

  async function loadMultipleMapFiles(fileList, appendToExisting = false) {
    const files = Array.from(fileList);
    if (!files.length) return;

    const validFiles = files.filter(f => {
      const isPdf = f.type === 'application/pdf' || /\.pdf$/i.test(f.name);
      const isImg = f.type.startsWith('image/') || /\.(png|jpe?g|webp|gif)$/i.test(f.name);
      return isPdf || isImg;
    });

    if (!validFiles.length) {
      alert('No valid PDF or image files selected.');
      return;
    }

    const sortedFiles = sortFilesByName(validFiles);
    mapStatusText.textContent = `Processing ${sortedFiles.length} map files...`;
    mapStatusBox.classList.remove('hidden');

    try {
      const newParts = [];

      for (let i = 0; i < sortedFiles.length; i++) {
        const f = sortedFiles[i];
        const isPdf = f.type === 'application/pdf' || /\.pdf$/i.test(f.name);
        if (isPdf) {
          mapStatusText.textContent = `Rendering PDF (${i + 1}/${sortedFiles.length}): ${f.name}...`;
          const arrayBuffer = await f.arrayBuffer();
          const typedarray = new Uint8Array(arrayBuffer);
          const pdfResult = await loadPdfDoc(typedarray, 3.5);
          pdfResult.pages.forEach((p) => {
            const partLabel = sortedFiles.length > 1
              ? `Part ${newParts.length + 1} (${f.name.replace(/\.pdf$/i, '')}${pdfResult.numPages > 1 ? ` - P${p.pageNum}` : ''})`
              : p.name;
            newParts.push({ ...p, name: partLabel });
          });
        } else {
          mapStatusText.textContent = `Loading image (${i + 1}/${sortedFiles.length}): ${f.name}...`;
          const imgPart = await loadRasterImage(f);
          const partLabel = `Part ${newParts.length + 1} (${imgPart.name})`;
          newParts.push({ ...imgPart, name: partLabel });
        }
      }

      let allParts = [];
      if (appendToExisting) {
        if (state.map.stitchedInfo && state.map.stitchedInfo.parts && state.map.stitchedInfo.parts.length > 0) {
          allParts = [...state.map.stitchedInfo.parts];
        } else if (state.map.image) {
          const offCanvas = document.createElement('canvas');
          offCanvas.width = state.map.width;
          offCanvas.height = state.map.height;
          const offCtx = offCanvas.getContext('2d');
          offCtx.drawImage(state.map.image, 0, 0);

          allParts.push({
            name: 'Part 1',
            type: state.map.pdfBytes ? 'pdf' : 'image',
            pdfBytes: state.map.pdfBytes,
            pageNum: 1,
            canvas: offCanvas,
            image: state.map.image,
            dataUrl: state.map.dataUrl,
            width: state.map.width,
            height: state.map.height
          });
        }
        newParts.forEach(p => allParts.push(p));
        allParts.forEach((p, idx) => {
          p.name = `Part ${idx + 1}`;
        });
      } else {
        allParts = newParts;
      }

      applyStitchedMapParts(allParts, sortedFiles[0].name);
    } catch (err) {
      console.error('Error loading multiple map files:', err);
      alert('Error loading map files: ' + (err.message || err));
      mapStatusBox.classList.add('hidden');
    }
  }

  async function loadMapFile(file) {
    if (!file) return;

    const isHtml = file.type === 'text/html' || /\.html?$/i.test(file.name);
    const isJson = file.type === 'application/json' || /\.json$/i.test(file.name);

    if (isHtml || isJson) {
      loadProjectFile(file);
      return;
    }

    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');

    if (isPdf) {
      mapStatusText.textContent = 'Reading PDF map...';
      mapStatusBox.classList.remove('hidden');

      try {
        const arrayBuffer = await file.arrayBuffer();
        const typedarray = new Uint8Array(arrayBuffer);
        mapStatusText.textContent = 'Inspecting PDF pages...';
        const pdfResult = await loadPdfDoc(typedarray, 3.5);

        if (pdfResult.numPages > 1) {
          mapStatusText.textContent = `Auto-stitching ${pdfResult.numPages} PDF pages (Part 1 & Part 2)...`;
          applyStitchedMapParts(pdfResult.pages, file.name);
        } else {
          const p = pdfResult.pages[0];
          state.map.pdfBytes = typedarray;
          state.map.pdfDoc = pdfResult.pdf;
          state.map.pdfPage = await pdfResult.pdf.getPage(1);
          state.map.stitchedInfo = null;
          updateStitchUi(false);

          const pngName = file.name.replace(/\.pdf$/i, '.png');
          setMapImage(p.canvas.toDataURL('image/png'), pngName, p.width, p.height);
        }
      } catch (err) {
        console.error('PDF Render Error:', err);
        alert('Failed to render PDF: ' + (err.message || err));
        mapStatusBox.classList.add('hidden');
      }
    } else {
      try {
        const imgPart = await loadRasterImage(file);
        state.map.pdfBytes = null;
        state.map.pdfDoc = null;
        state.map.pdfPage = null;
        state.map.stitchedInfo = null;
        updateStitchUi(false);
        setMapImage(imgPart.dataUrl, file.name, imgPart.width, imgPart.height);
      } catch (err) {
        console.error('Image load error:', err);
        alert('Failed to load image: ' + err.message);
      }
    }
  }

  function rescaleCoursePoints(scaleRatio) {
    if (!scaleRatio || Math.abs(scaleRatio - 1.0) < 0.001) return;
    state.controls.forEach((c) => {
      c.x *= scaleRatio;
      c.y *= scaleRatio;
    });
    state.variants.forEach((v) => {
      if (v.points) {
        v.points.forEach((p) => {
          p.x *= scaleRatio;
          p.y *= scaleRatio;
        });
      }
    });
    if (state.activeDrawing && state.activeDrawing.length > 0) {
      state.activeDrawing.forEach((p) => {
        p.x *= scaleRatio;
        p.y *= scaleRatio;
      });
    }
    updateLegs();
  }

  function setMapImage(dataUrl, fileName, width, height, skipAutoRescale, callback) {
    const safeFileName = getMapImageFileName(fileName);
    const img = new Image();
    img.onload = function () {
      const finalW = width || img.naturalWidth || img.width;
      const finalH = height || img.naturalHeight || img.height;

      // If map was replaced or re-rendered at a different scale, automatically adapt existing course coordinates!
      if (!skipAutoRescale && state.map.width > 0 && finalW > 0 && Math.abs(finalW - state.map.width) > 1) {
        const ratio = finalW / state.map.width;
        rescaleCoursePoints(ratio);
      }

      state.map.image = img;
      state.map.width = finalW;
      state.map.height = finalH;
      state.map.fileName = safeFileName;
      state.map.dataUrl = dataUrl;

      mapStatusText.textContent = `${safeFileName} (${finalW} × ${finalH}px)`;
      mapStatusBox.classList.remove('hidden');

      if (state.map.stitchedInfo && state.map.stitchedInfo.isStitched) {
        updateStitchUi(true, state.map.stitchedInfo.layout, state.map.stitchedInfo.parts.length);
      } else {
        updateStitchUi(false);
      }

      proceedToStep2Btn.disabled = false;
      proceedToStep2Btn.classList.remove('bg-slate-200', 'text-slate-400', 'cursor-not-allowed');
      proceedToStep2Btn.classList.add('bg-blue-600', 'hover:bg-blue-700', 'text-white', 'shadow-sm', 'cursor-pointer');

      // Auto-fit map to canvas
      resetZoomToFit();

      if (typeof callback === 'function') {
        callback();
      } else if (state.step === 1 && state.controls.length === 0) {
        setTimeout(() => setStep(2), 300);
      }
      render();
    };
    img.src = dataUrl;
  }

  // File Input and Drag & Drop
  dropZone.addEventListener('click', () => mapFileInput.click());
  mapFileInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files.length > 0) {
      if (e.target.files.length > 1) {
        loadMultipleMapFiles(e.target.files);
      } else {
        loadMapFile(e.target.files[0]);
      }
      mapFileInput.value = '';
    }
  });

  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('border-blue-500', 'bg-blue-50');
  });
  dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('border-blue-500', 'bg-blue-50');
  });
  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('border-blue-500', 'bg-blue-50');
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      if (e.dataTransfer.files.length > 1) {
        loadMultipleMapFiles(e.dataTransfer.files);
      } else {
        loadMapFile(e.dataTransfer.files[0]);
      }
    }
  });

  if (appendMapBtn && appendMapFileInput) {
    appendMapBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      appendMapFileInput.click();
    });

    appendMapFileInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files.length > 0) {
        loadMultipleMapFiles(e.target.files, true);
        appendMapFileInput.value = '';
      }
    });
  }

  if (stitchLayoutHBtn && stitchLayoutVBtn) {
    stitchLayoutHBtn.addEventListener('click', () => {
      if (state.map.stitchedInfo && state.map.stitchedInfo.parts) {
        applyStitchedMapParts(state.map.stitchedInfo.parts, state.map.fileName, 'horizontal');
      }
    });
    stitchLayoutVBtn.addEventListener('click', () => {
      if (state.map.stitchedInfo && state.map.stitchedInfo.parts) {
        applyStitchedMapParts(state.map.stitchedInfo.parts, state.map.fileName, 'vertical');
      }
    });
  }

  function restoreStretchedCourseCoordinates() {
    if (!state.map.stitchedInfo || !state.map.stitchedInfo.parts || state.map.stitchedInfo.parts.length < 2) {
      alert('No stitched multi-part map detected.');
      return;
    }
    const origW = state.map.stitchedInfo.parts[0].width;
    const currentW = state.map.width;
    if (origW > 0 && currentW > origW) {
      const stretchRatio = currentW / origW;
      if (Math.abs(stretchRatio - 1.0) > 0.05) {
        rescaleCoursePoints(1 / stretchRatio);
        render();
        alert(`Course coordinates restored! Rescaled back by ${(1 / stretchRatio).toFixed(4)}x to match Part 1.`);
        return;
      }
    }
    alert('Course coordinates are already aligned to Part 1 scale.');
  }

  if (restoreCourseScaleBtn) {
    restoreCourseScaleBtn.addEventListener('click', restoreStretchedCourseCoordinates);
  }

  removeMapBtn.addEventListener('click', () => {
    state.map.image = null;
    state.map.dataUrl = '';
    state.map.fileName = '';
    state.map.pdfBytes = null;
    state.map.pdfDoc = null;
    state.map.pdfPage = null;
    state.map.stitchedInfo = null;
    mapStatusBox.classList.add('hidden');
    updateStitchUi(false);
    proceedToStep2Btn.disabled = true;
    proceedToStep2Btn.classList.add('bg-slate-200', 'text-slate-400', 'cursor-not-allowed');
    proceedToStep2Btn.classList.remove('bg-blue-600', 'hover:bg-blue-700', 'text-white');
    render();
  });

  // Scale & DPI inputs
  scaleSelect.addEventListener('change', (e) => {
    if (e.target.value === 'custom') {
      customScaleInput.classList.remove('hidden');
      customScaleInput.focus();
    } else {
      customScaleInput.classList.add('hidden');
      state.scale = Number(e.target.value);
      updateLegs();
      render();
    }
  });

  customScaleInput.addEventListener('input', (e) => {
    const val = Number(e.target.value);
    if (val > 0) {
      state.scale = val;
      updateLegs();
      render();
    }
  });

  dpiInput.addEventListener('input', (e) => {
    const val = Number(e.target.value);
    if (val > 0) {
      state.dpi = val;
      updateLegs();
      render();
    }
  });

  resetCalibrationBtn.addEventListener('click', () => {
    scaleSelect.value = '4000';
    customScaleInput.classList.add('hidden');
    dpiInput.value = '150';
    state.scale = 4000;
    state.dpi = 150;
    updateLegs();
    render();
  });

  eventNameInput.addEventListener('input', (e) => {
    state.eventName = e.target.value;
  });

  // --- 2-POINT CALIBRATION TOOL ---

  startCalibrateBtn.addEventListener('click', () => {
    if (!state.map.image) {
      alert('Please upload a map first.');
      return;
    }
    state.calibration.active = true;
    state.calibration.point1 = null;
    state.calibration.point2 = null;
    calibrationActiveBanner.classList.remove('hidden');
    calibStepText.textContent = 'Click Point 1 on map (e.g. scale bar start)...';
    canvas.classList.add('calibrating-mode');
    render();
  });

  cancelCalibBtn.addEventListener('click', () => {
    state.calibration.active = false;
    state.calibration.point1 = null;
    state.calibration.point2 = null;
    calibrationActiveBanner.classList.add('hidden');
    canvas.classList.remove('calibrating-mode');
    render();
  });

  calibCancelModalBtn.addEventListener('click', () => {
    calibrationModal.classList.add('hidden');
    cancelCalibBtn.click();
  });

  calibApplyModalBtn.addEventListener('click', () => {
    const realMeters = parseFloat(calibDistanceInput.value);
    if (!realMeters || realMeters <= 0) {
      alert('Please enter a positive distance in meters.');
      return;
    }

    const p1 = state.calibration.point1;
    const p2 = state.calibration.point2;
    const pixelDist = distanceBetween(p1, p2);

    // Compute DPI:
    // realMeters = (pixelDist / DPI) * 0.0254 * Scale
    // => DPI = (pixelDist * 0.0254 * Scale) / realMeters
    const calculatedDpi = Math.round((pixelDist * 0.0254 * state.scale) / realMeters);

    if (calculatedDpi > 10 && calculatedDpi < 2400) {
      state.dpi = calculatedDpi;
      dpiInput.value = calculatedDpi;
      updateLegs();
      alert(`Calibration complete!\nComputed DPI: ${calculatedDpi} DPI based on ${realMeters}m measurement.`);
    } else {
      alert(`Calculated DPI (${calculatedDpi}) is out of reasonable range. Check your scale setting.`);
    }

    calibrationModal.classList.add('hidden');
    state.calibration.active = false;
    state.calibration.point1 = null;
    state.calibration.point2 = null;
    calibrationActiveBanner.classList.add('hidden');
    canvas.classList.remove('calibrating-mode');
    render();
  });

  // --- COURSE BUILDING ACTIONS ---

  undoControlBtn.addEventListener('click', () => {
    if (state.controls.length > 0) {
      state.controls.pop();
      updateLegs();
      render();
    }
  });

  clearCourseBtn.addEventListener('click', () => {
    if (confirm('Clear all course controls and routechoices?')) {
      state.controls = [];
      state.variants = [];
      state.activeDrawing = [];
      updateLegs();
      render();
    }
  });

  markFinishCheckbox.addEventListener('change', (e) => {
    state.markLastAsFinish = e.target.checked;
    updateLegs();
    render();
  });

  function setOverprintVisibility(visible) {
    state.showOverprint = Boolean(visible);
    if (showOverprintCheckbox) showOverprintCheckbox.checked = state.showOverprint;
    if (showOverprintStep3Checkbox) showOverprintStep3Checkbox.checked = state.showOverprint;
    const exportOptOverprintEl = document.getElementById('exportOptOverprint');
    if (exportOptOverprintEl) exportOptOverprintEl.checked = state.showOverprint;
    render();
  }

  function setLegLinesVisibility(visible) {
    state.showLegLines = Boolean(visible);
    if (showLegLinesCheckbox) showLegLinesCheckbox.checked = state.showLegLines;
    if (showLegLinesStep3Checkbox) showLegLinesStep3Checkbox.checked = state.showLegLines;
    const exportOptLegLinesEl = document.getElementById('exportOptLegLines');
    if (exportOptLegLinesEl) exportOptLegLinesEl.checked = state.showLegLines;
    render();
  }

  if (showOverprintCheckbox) {
    showOverprintCheckbox.addEventListener('change', (e) => setOverprintVisibility(e.target.checked));
  }
  if (showOverprintStep3Checkbox) {
    showOverprintStep3Checkbox.addEventListener('change', (e) => setOverprintVisibility(e.target.checked));
  }

  if (showLegLinesCheckbox) {
    showLegLinesCheckbox.addEventListener('change', (e) => setLegLinesVisibility(e.target.checked));
  }
  if (showLegLinesStep3Checkbox) {
    showLegLinesStep3Checkbox.addEventListener('change', (e) => setLegLinesVisibility(e.target.checked));
  }

  function setRouteLabelsVisibility(visible) {
    state.showRouteLabels = Boolean(visible);
    if (showRouteLabelsCheckbox) showRouteLabelsCheckbox.checked = state.showRouteLabels;
    if (toggleRouteLabelsQuickBtn) {
      toggleRouteLabelsQuickBtn.textContent = state.showRouteLabels ? 'Hide Labels' : 'Show Labels';
    }
    render();
  }

  if (showRouteLabelsCheckbox) {
    showRouteLabelsCheckbox.addEventListener('change', (e) => setRouteLabelsVisibility(e.target.checked));
  }
  if (toggleRouteLabelsQuickBtn) {
    toggleRouteLabelsQuickBtn.addEventListener('click', () => setRouteLabelsVisibility(!state.showRouteLabels));
  }

  // --- ROUTECHOICE DRAWING ACTIONS ---

  undoRoutePointBtn.addEventListener('click', () => {
    if (state.activeDrawing.length > 0) {
      state.activeDrawing.pop();
      updateLiveDrawingStats();
      render();
    }
  });

  function saveActiveRoute() {
    if (state.activeDrawing.length < 2) return;

    // Anchor first point to leg start and last point to leg end for clean visuals
    const currentLeg = state.legs[state.selectedLegIndex];
    if (currentLeg) {
      const startDist = distanceBetween(state.activeDrawing[0], currentLeg.start);
      if (startDist < 40) {
        state.activeDrawing[0] = { x: currentLeg.start.x, y: currentLeg.start.y };
      }
      const lastIdx = state.activeDrawing.length - 1;
      const endDist = distanceBetween(state.activeDrawing[lastIdx], currentLeg.end);
      if (endDist < 40) {
        state.activeDrawing[lastIdx] = { x: currentLeg.end.x, y: currentLeg.end.y };
      }
    }

    const nextColor = getNextVariantColor();
    const nextName = getNextVariantName();

    state.variants.push({
      id: Date.now(),
      legIndex: state.selectedLegIndex,
      name: nextName,
      color: nextColor.hex,
      points: [...state.activeDrawing]
    });

    // Reset active drawing
    state.activeDrawing = [];
    updateLiveDrawingStats();
    updateVariantsList();
    render();
  }

  saveRouteBtn.addEventListener('click', saveActiveRoute);

  // Global Keyboard Shortcuts for Drawing (Enter to Save, Backspace to Undo Point)
  window.addEventListener('keydown', (e) => {
    // Ignore keystrokes if typing into an input or textarea
    const activeEl = document.activeElement;
    const isEditingText = activeEl && (
      activeEl.tagName === 'INPUT' || 
      activeEl.tagName === 'TEXTAREA' || 
      activeEl.tagName === 'SELECT'
    );

    if (e.key === 'Enter') {
      if (state.step === 3 && state.activeDrawing.length >= 2 && !isEditingText) {
        e.preventDefault();
        saveActiveRoute();
      }
    } else if (e.key === 'Backspace') {
      if (state.step === 3 && state.activeDrawing.length > 0 && !isEditingText) {
        e.preventDefault();
        state.activeDrawing.pop();
        updateLiveDrawingStats();
        render();
      }
    } else if ((e.key === 'l' || e.key === 'L') && !isEditingText && state.step === 3) {
      e.preventDefault();
      setRouteLabelsVisibility(!state.showRouteLabels);
    }
  });

  function updateLiveDrawingStats() {
    undoRoutePointBtn.disabled = state.activeDrawing.length === 0;
    saveRouteBtn.disabled = state.activeDrawing.length < 2;

    if (state.activeDrawing.length < 2) {
      liveRouteDistText.textContent = '0.0 m';
    } else {
      const dist = polylineLengthMeters(state.activeDrawing);
      liveRouteDistText.textContent = `${dist.toFixed(1)} m`;
    }
  }

  // Leg Navigation
  prevLegBtn.addEventListener('click', () => {
    if (state.selectedLegIndex > 0) {
      state.selectedLegIndex--;
      legSelectDropdown.value = state.selectedLegIndex;
      state.activeDrawing = [];
      updateLiveDrawingStats();
      updateActiveLegUI();
      focusLeg(state.selectedLegIndex);
    }
  });

  nextLegBtn.addEventListener('click', () => {
    if (state.selectedLegIndex < state.legs.length - 1) {
      state.selectedLegIndex++;
      legSelectDropdown.value = state.selectedLegIndex;
      state.activeDrawing = [];
      updateLiveDrawingStats();
      updateActiveLegUI();
      focusLeg(state.selectedLegIndex);
    }
  });

  legSelectDropdown.addEventListener('change', (e) => {
    state.selectedLegIndex = Number(e.target.value);
    state.activeDrawing = [];
    updateLiveDrawingStats();
    updateActiveLegUI();
    focusLeg(state.selectedLegIndex);
  });

  autoRotateCheckbox.addEventListener('change', (e) => {
    state.autoRotate = e.target.checked;
    if (state.autoRotate && state.step === 3) {
      focusLeg(state.selectedLegIndex);
    }
  });

  resetLegViewBtn.addEventListener('click', () => {
    focusLeg(state.selectedLegIndex);
  });

  legNotesTextarea.addEventListener('input', (e) => {
    state.legNotes[state.selectedLegIndex] = e.target.value;
  });

  // --- FLOATING VIEWPORT ACTIONS ---

  function resetZoomToFit() {
    if (!state.map.image) return;
    const availW = canvas.width - 40;
    const availH = canvas.height - 40;
    const fitZoom = Math.min(availW / state.map.width, availH / state.map.height) * 0.95;
    state.view.zoom = Math.max(0.05, fitZoom);
    state.view.panX = 0;
    state.view.panY = 0;
    state.view.rotation = 0;
    rotationAngleDisplay.textContent = '0°';
    render();
  }

  function zoomAtCenter(factor) {
    const oldZoom = state.view.zoom;
    const newZoom = Math.max(0.05, Math.min(state.view.zoom * factor, 30));
    if (newZoom === oldZoom) return;
    const scale = newZoom / oldZoom;
    state.view.zoom = newZoom;
    state.view.panX *= scale;
    state.view.panY *= scale;
    render();
  }

  zoomInBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    zoomAtCenter(1.25);
  });

  zoomOutBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    zoomAtCenter(1 / 1.25);
  });

  rotateLeftBtn.addEventListener('click', () => {
    state.view.rotation = (state.view.rotation - 15) % 360;
    rotationAngleDisplay.textContent = `${state.view.rotation}°`;
    render();
  });

  rotateRightBtn.addEventListener('click', () => {
    state.view.rotation = (state.view.rotation + 15) % 360;
    rotationAngleDisplay.textContent = `${state.view.rotation}°`;
    render();
  });

  resetRotationBtn.addEventListener('click', () => {
    state.view.rotation = 0;
    rotationAngleDisplay.textContent = '0°';
    render();
  });

  resetZoomBtn.addEventListener('click', resetZoomToFit);

  // --- MOUSE & CANVAS INTERACTION ---

  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
    const newZoom = Math.max(0.05, Math.min(state.view.zoom * zoomFactor, 30));

    // Keep point under mouse fixed
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const mapPtBefore = screenToMap(mouseX, mouseY);
    state.view.zoom = newZoom;
    const screenPtAfter = mapToScreen(mapPtBefore.x, mapPtBefore.y);

    // Adjust pan
    const dx = mouseX - screenPtAfter.x;
    const dy = mouseY - screenPtAfter.y;
    const rad = (-state.view.rotation * Math.PI) / 180;
    state.view.panX += (dx * Math.cos(rad) - dy * Math.sin(rad));
    state.view.panY += (dx * Math.sin(rad) + dy * Math.cos(rad));

    render();
  }, { passive: false });

  canvas.addEventListener('mousedown', (e) => {
    const rect = canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const mapPt = screenToMap(sx, sy);

    // Middle click or Alt+click pans in any mode
    if (e.button === 1 || e.altKey) {
      state.mouse.isPanning = true;
      state.mouse.panStartX = sx;
      state.mouse.panStartY = sy;
      canvas.classList.add('panning-mode');
      return;
    }

    if (e.button !== 0) return; // Only primary click below

    // 1. Calibration Mode
    if (state.calibration.active) {
      if (!state.calibration.point1) {
        state.calibration.point1 = { x: mapPt.x, y: mapPt.y };
        calibStepText.textContent = 'Click Point 2 on map...';
        render();
      } else {
        state.calibration.point2 = { x: mapPt.x, y: mapPt.y };
        calibrationModal.classList.remove('hidden');
        calibDistanceInput.focus();
        calibDistanceInput.select();
        render();
      }
      return;
    }

    // 2. Step 2: Draw Course Controls
    if (state.step === 2) {
      // Check if clicking near an existing control to drag it
      for (const ctrl of state.controls) {
        if (distanceBetween(mapPt, ctrl) < 25 / state.view.zoom) {
          state.mouse.draggedControl = ctrl;
          return;
        }
      }

      // Otherwise add control
      state.controls.push({
        id: Date.now(),
        x: Math.round(mapPt.x),
        y: Math.round(mapPt.y),
        isFinish: false
      });
      updateLegs();
      render();
      return;
    }

    // 3. Step 3: Draw Routechoices
    if (state.step === 3 && state.legs.length > 0) {
      state.activeDrawing.push({
        x: Math.round(mapPt.x),
        y: Math.round(mapPt.y)
      });
      updateLiveDrawingStats();
      render();
      return;
    }

    // Default primary drag = panning if no tool active
    state.mouse.isPanning = true;
    state.mouse.panStartX = sx;
    state.mouse.panStartY = sy;
    canvas.classList.add('panning-mode');
  });

  window.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const mapPt = screenToMap(sx, sy);

    state.mouse.screenX = sx;
    state.mouse.screenY = sy;
    state.mouse.mapX = mapPt.x;
    state.mouse.mapY = mapPt.y;

    // Handle dragged control point
    if (state.mouse.draggedControl) {
      state.mouse.draggedControl.x = Math.round(mapPt.x);
      state.mouse.draggedControl.y = Math.round(mapPt.y);
      updateLegs();
      render();
      return;
    }

    // Handle panning
    if (state.mouse.isPanning) {
      const dx = sx - state.mouse.panStartX;
      const dy = sy - state.mouse.panStartY;
      state.mouse.panStartX = sx;
      state.mouse.panStartY = sy;

      const rad = (-state.view.rotation * Math.PI) / 180;
      state.view.panX += (dx * Math.cos(rad) - dy * Math.sin(rad));
      state.view.panY += (dx * Math.sin(rad) + dy * Math.cos(rad));
      render();
      return;
    }

    // Live preview for drawing or calibration line
    if (state.activeDrawing.length > 0 || (state.calibration.active && state.calibration.point1)) {
      render();
    }
  });

  window.addEventListener('mouseup', () => {
    if (state.mouse.isPanning) {
      state.mouse.isPanning = false;
      canvas.classList.remove('panning-mode');
    }
    state.mouse.draggedControl = null;
  });

  // --- SAVE & LOAD PROJECT (JSON CONFIG) ---

  function exportProjectConfig() {
    const project = {
      version: '1.3.0',
      exportedAt: new Date().toISOString(),
      eventName: state.eventName,
      scale: state.scale,
      dpi: state.dpi,
      mapFileName: state.map.fileName,
      mapDataUrl: state.map.dataUrl,
      mapWidth: state.map.width,
      mapHeight: state.map.height,
      controls: state.controls,
      markLastAsFinish: state.markLastAsFinish,
      showOverprint: state.showOverprint,
      showLegLines: state.showLegLines,
      variants: state.variants,
      takenRouteByLeg: state.takenRouteByLeg,
      runningPace: state.runningPace,
      legNotes: state.legNotes,
      stitchedInfo: state.map.stitchedInfo
    };

    const fileName = (state.eventName ? state.eventName.replace(/[^a-zA-Z0-9_\-]+/g, '_') : 'orienteering_course') + '_config.json';
    const blob = new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (saveProjectBtn) saveProjectBtn.addEventListener('click', exportProjectConfig);
  if (saveProjectBtnStep1) saveProjectBtnStep1.addEventListener('click', exportProjectConfig);
  if (saveProjectBtnStep2) saveProjectBtnStep2.addEventListener('click', exportProjectConfig);

  function triggerLoadConfig() {
    if (projectFileInput) projectFileInput.click();
  }

  if (loadProjectBtn) loadProjectBtn.addEventListener('click', triggerLoadConfig);
  if (loadProjectBtnStep1) loadProjectBtnStep1.addEventListener('click', triggerLoadConfig);
  if (loadProjectBtnStep2) loadProjectBtnStep2.addEventListener('click', triggerLoadConfig);

  // --- DROPDOWN MENUS & ACTION BINDINGS ---

  function closeDropdowns() {
    if (projectMenuDropdown) projectMenuDropdown.classList.add('hidden');
    if (viewMenuDropdown) viewMenuDropdown.classList.add('hidden');
  }

  if (projectMenuBtn && projectMenuDropdown) {
    projectMenuBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (viewMenuDropdown) viewMenuDropdown.classList.add('hidden');
      projectMenuDropdown.classList.toggle('hidden');
    });
  }

  if (viewMenuBtn && viewMenuDropdown) {
    viewMenuBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (projectMenuDropdown) projectMenuDropdown.classList.add('hidden');
      viewMenuDropdown.classList.toggle('hidden');
    });
  }

  if (projectMenuDropdown) {
    projectMenuDropdown.addEventListener('click', (e) => {
      e.stopPropagation();
    });
  }
  if (viewMenuDropdown) {
    viewMenuDropdown.addEventListener('click', (e) => {
      e.stopPropagation();
    });
  }

  window.addEventListener('click', () => {
    closeDropdowns();
  });

  if (menuOpenProjectBtn) {
    menuOpenProjectBtn.addEventListener('click', () => {
      closeDropdowns();
      triggerLoadConfig();
    });
  }

  if (menuPullGhBtn) {
    menuPullGhBtn.addEventListener('click', () => {
      closeDropdowns();
      openPullGitHubModal();
    });
  }

  if (menuExportJsonBtn) {
    menuExportJsonBtn.addEventListener('click', () => {
      closeDropdowns();
      exportProjectConfig();
    });
  }

  if (menuResetProjectBtn) {
    menuResetProjectBtn.addEventListener('click', () => {
      closeDropdowns();
      if (confirm('Start a new course? This will clear all current controls and routechoices.')) {
        state.controls = [];
        state.variants = [];
        state.activeDrawing = [];
        state.takenRouteByLeg = {};
        state.legNotes = {};
        state.selectedLegIndex = 0;
        updateLegs();
        render();
        setStep(1);
      }
    });
  }

  // --- COLLAPSIBLE RUN STATS ACCORDION ---
  if (toggleStatsBtn && statsDetailsSection) {
    toggleStatsBtn.addEventListener('click', () => {
      const isHidden = statsDetailsSection.classList.toggle('hidden');
      if (statsToggleIcon) {
        statsToggleIcon.style.transform = isHidden ? 'rotate(0deg)' : 'rotate(180deg)';
      }
    });
  }

  function parseProjectFromText(content, fileName) {
    if (!content || typeof content !== 'string') {
      throw new Error('File content is empty or invalid.');
    }

    // 1. Direct JSON config
    try {
      const json = JSON.parse(content);
      if (json && (json.controls || json.mapDataUrl || json.variants)) {
        return json;
      }
    } catch (_) {}

    // 2. Embedded sprint-course-data in HTML presentation
    const courseDataMatch = content.match(/<script\s+id=["']sprint-course-data["']\s+type=["']application\/json["']>([\s\S]*?)<\/script>/i);
    if (courseDataMatch) {
      try {
        const cleanJson = courseDataMatch[1].replace(/<\\\/script>/gi, '</script>');
        const project = JSON.parse(cleanJson);
        if (project && (project.controls || project.variants || project.mapDataUrl)) {
          return project;
        }
      } catch (err) {
        console.warn('Failed parsing embedded sprint-course-data JSON:', err);
      }
    }

    // 3. Legacy exported HTML fallback (regex extraction)
    const mapSrcMatch = content.match(/const mapSrc\s*=\s*"(data:image\/[a-z]+;base64,[^"]+)";/i);
    const legsMatch = content.match(/const legs\s*=\s*(\[[\s\S]*?\]);\s*const variants/);
    const variantsMatch = content.match(/const variants\s*=\s*(\[[\s\S]*?\]);\s*const takenRouteByLeg/);

    if (mapSrcMatch || (legsMatch && variantsMatch)) {
      try {
        const mapDataUrl = mapSrcMatch ? mapSrcMatch[1] : '';
        const legs = legsMatch ? JSON.parse(legsMatch[1]) : [];
        const variants = variantsMatch ? JSON.parse(variantsMatch[1]) : [];

        const takenMatch = content.match(/const takenRouteByLeg\s*=\s*(\{[\s\S]*?\});/);
        const takenRouteByLeg = takenMatch ? JSON.parse(takenMatch[1]) : {};

        const paceMatch = content.match(/const runningPace\s*=\s*([0-9.]+);/);
        const runningPace = paceMatch ? parseFloat(paceMatch[1]) : 4.0;

        const notesMatch = content.match(/const legNotes\s*=\s*(\{[\s\S]*?\});/);
        const legNotes = notesMatch ? JSON.parse(notesMatch[1]) : {};

        const mapWMatch = content.match(/const mapW\s*=\s*([0-9.]+);/);
        const mapHMatch = content.match(/const mapH\s*=\s*([0-9.]+);/);
        const scaleMatch = content.match(/const scale\s*=\s*([0-9.]+);/);
        const dpiMatch = content.match(/const dpi\s*=\s*([0-9.]+);/);
        const titleMatch = content.match(/<title>(.*?)(?:\s*—|\s*-|\s*\||<\/title>)/i);

        // Reconstruct controls from legs
        const controls = [];
        if (legs.length > 0) {
          const firstLeg = legs[0];
          const firstIndex = typeof firstLeg.index === 'number' ? firstLeg.index : 0;
          let startCtrlNum = 0;
          if (firstLeg.label) {
            const m = firstLeg.label.match(/^Leg\s+(\d+)\s*→/i);
            if (m) startCtrlNum = parseInt(m[1], 10);
          }
          const neededPreceding = Math.max(firstIndex, startCtrlNum);

          if (neededPreceding > 0) {
            // Legs before this were deselected during export.
            // Synthesize preceding controls backwards from firstLeg.start so that
            // control numbers and leg indices align 1:1 with the original course!
            const dx = firstLeg.end.x - firstLeg.start.x;
            const dy = firstLeg.end.y - firstLeg.start.y;
            const len = Math.hypot(dx, dy) || 100;
            const ux = dx / len;
            const uy = dy / len;
            for (let k = neededPreceding; k >= 1; k--) {
              controls.push({
                id: Date.now() - 10000 - k * 10,
                x: Math.round(firstLeg.start.x - ux * 70 * k),
                y: Math.round(firstLeg.start.y - uy * 70 * k),
                isStart: k === neededPreceding
              });
            }
          }

          // Push the first leg's start point
          controls.push({
            id: firstLeg.start.id || Date.now() - 5000,
            x: firstLeg.start.x,
            y: firstLeg.start.y,
            isStart: neededPreceding === 0
          });

          for (let i = 0; i < legs.length; i++) {
            const curLeg = legs[i];
            if (i > 0) {
              const prevEnd = legs[i - 1].end;
              const curStart = curLeg.start;
              const gapDist = Math.hypot(curStart.x - prevEnd.x, curStart.y - prevEnd.y);
              if (gapDist > 15) {
                // Leg omitted in the middle: insert start of current leg
                controls.push({
                  id: curStart.id || Date.now() + i * 10,
                  x: curStart.x,
                  y: curStart.y,
                  isFinish: false
                });
              }
            }

            const isFinish = (i === legs.length - 1) && (curLeg.end.isFinish || (curLeg.label && /→\s*F\b/i.test(curLeg.label)));
            controls.push({
              id: curLeg.end.id || Date.now() + i * 10 + 1,
              x: curLeg.end.x,
              y: curLeg.end.y,
              isFinish: !!isFinish
            });
          }
        }

        return {
          version: '1.4.0-legacy-extracted',
          eventName: titleMatch ? titleMatch[1].trim() : (fileName ? fileName.replace(/\.[^.]+$/, '') : 'Orienteering Course'),
          scale: scaleMatch ? parseFloat(scaleMatch[1]) : 4000,
          dpi: dpiMatch ? parseFloat(dpiMatch[1]) : 150,
          mapFileName: 'imported_map.png',
          mapDataUrl: mapDataUrl,
          mapWidth: mapWMatch ? parseFloat(mapWMatch[1]) : 0,
          mapHeight: mapHMatch ? parseFloat(mapHMatch[1]) : 0,
          controls: controls,
          markLastAsFinish: true,
          showOverprint: true,
          showLegLines: true,
          variants: variants,
          takenRouteByLeg: takenRouteByLeg,
          runningPace: runningPace,
          legNotes: legNotes
        };
      } catch (err) {
        console.warn('Failed legacy HTML parse:', err);
      }
    }

    throw new Error('Unrecognized file format. Please upload a valid course JSON or exported presentation HTML file.');
  }

  /**
   * Geometrically verifies and realigns state.variants and state.takenRouteByLeg to the correct state.legs.
   * This guarantees 100% accurate leg association even when legs were deselected during export,
   * or when importing legacy HTML files where control numbering shifted.
   */
  function realignVariantsToLegs() {
    if (!state.legs || state.legs.length === 0 || !state.variants || state.variants.length === 0) {
      return;
    }

    const oldTaken = { ...state.takenRouteByLeg };
    const newTaken = {};

    state.variants.forEach((v) => {
      if (!v.points || v.points.length < 2) return;
      const pStart = v.points[0];
      const pEnd = v.points[v.points.length - 1];

      let bestLegIndex = v.legIndex;
      let minErr = Infinity;

      state.legs.forEach((leg) => {
        const dDirect = Math.hypot(pStart.x - leg.start.x, pStart.y - leg.start.y) +
                        Math.hypot(pEnd.x - leg.end.x, pEnd.y - leg.end.y);
        const dRev = Math.hypot(pStart.x - leg.end.x, pStart.y - leg.end.y) +
                     Math.hypot(pEnd.x - leg.start.x, pEnd.y - leg.start.y);
        const err = Math.min(dDirect, dRev);
        if (err < minErr) {
          minErr = err;
          bestLegIndex = leg.index;
        }
      });

      // Snap legIndex if best matching leg endpoints are within tolerance (or it's clearly a better match)
      if (minErr < 120 || (v.legIndex !== bestLegIndex && minErr < 200)) {
        const wasTaken = Object.keys(oldTaken).some((k) => oldTaken[k] === v.id) || oldTaken[v.legIndex] === v.id;
        v.legIndex = bestLegIndex;
        if (wasTaken) {
          newTaken[bestLegIndex] = v.id;
        }
      }
    });

    if (Object.keys(newTaken).length > 0) {
      state.takenRouteByLeg = { ...oldTaken, ...newTaken };
    }
  }

  function applyLoadedProject(project) {
    if (!project) return;

    if (project.eventName) {
      state.eventName = project.eventName;
      if (eventNameInput) eventNameInput.value = project.eventName;
    }
    if (project.scale) {
      state.scale = project.scale;
      if (scaleSelect) scaleSelect.value = project.scale.toString();
    }
    if (project.dpi) {
      state.dpi = project.dpi;
      if (dpiInput) dpiInput.value = project.dpi;
    }
    if (project.controls && Array.isArray(project.controls)) {
      state.controls = project.controls;
    }
    if (typeof project.markLastAsFinish === 'boolean') {
      state.markLastAsFinish = project.markLastAsFinish;
      if (markFinishCheckbox) markFinishCheckbox.checked = project.markLastAsFinish;
    }
    if (typeof project.showOverprint === 'boolean') {
      setOverprintVisibility(project.showOverprint);
    }
    if (typeof project.showLegLines === 'boolean') {
      setLegLinesVisibility(project.showLegLines);
    }
    if (typeof project.showRouteLabels === 'boolean') {
      setRouteLabelsVisibility(project.showRouteLabels);
    }
    if (project.variants && Array.isArray(project.variants)) {
      state.variants = project.variants;
    }
    if (project.takenRouteByLeg) {
      state.takenRouteByLeg = project.takenRouteByLeg;
    }
    if (project.runningPace) {
      state.runningPace = Number(project.runningPace);
      if (runningPaceSelect) runningPaceSelect.value = state.runningPace.toFixed(1);
    }
    if (project.legNotes) {
      state.legNotes = project.legNotes;
    }
    if (project.stitchedInfo) {
      state.map.stitchedInfo = project.stitchedInfo;
      updateStitchUi(true, project.stitchedInfo.layout, project.stitchedInfo.parts ? project.stitchedInfo.parts.length : 1);
    }

    const finalize = () => {
      // Automatic coordinate scaling if map resolution differs from course creation resolution
      if (project.mapWidth && state.map.width > 0 && Math.abs(project.mapWidth - state.map.width) > 1) {
        const ratio = state.map.width / project.mapWidth;
        rescaleCoursePoints(ratio);
      } else if (!project.mapWidth && state.map.width > 1800) {
        // Legacy projects created on scale 2.5 (~1488.19px width) loaded on a higher-res map
        const maxCtrlX = (state.controls && state.controls.length > 0) ? Math.max(...state.controls.map(c => c.x)) : 0;
        if (maxCtrlX > 0 && maxCtrlX < 1550) {
          const legacyRatio = state.map.width / 1488.188925;
          rescaleCoursePoints(legacyRatio);
        }
      }

      updateLegs();
      realignVariantsToLegs();
      setStep(state.controls.length > 1 ? 3 : (state.map.image ? 2 : 1));
      recalculateRunStats();
      render();
      alert('Course and routechoices loaded successfully! Ready to edit.');
    };

    if (project.mapDataUrl) {
      setMapImage(project.mapDataUrl, project.mapFileName || 'map.png', project.mapWidth || 0, project.mapHeight || 0, true, finalize);
    } else {
      finalize();
    }
  }

  function loadProjectFile(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const project = parseProjectFromText(evt.target.result, file.name);
        applyLoadedProject(project);
      } catch (err) {
        alert('Failed to load project: ' + err.message);
      }
      if (projectFileInput) projectFileInput.value = '';
      if (mapFileInput) mapFileInput.value = '';
    };
    reader.readAsText(file);
  }

  projectFileInput.addEventListener('change', (e) => {
    const file = e.target.files && e.target.files[0];
    if (file) loadProjectFile(file);
  });

  // Pace selector listener
  if (runningPaceSelect) {
    runningPaceSelect.addEventListener('change', (e) => {
      state.runningPace = parseFloat(e.target.value) || 4.0;
      recalculateRunStats();
    });
  }

  // --- EXPORT CUSTOMISATION SETTINGS MODAL & SLIDE DECK GENERATOR ---

  const exportModal = document.getElementById('exportModal');
  const closeExportModalBtn = document.getElementById('closeExportModalBtn');
  const cancelExportModalBtn = document.getElementById('cancelExportModalBtn');
  const confirmExportBtn = document.getElementById('confirmExportBtn');
  const exportTitleInput = document.getElementById('exportTitleInput');
  const exportSubtitleInput = document.getElementById('exportSubtitleInput');
  const exportThemeSelect = document.getElementById('exportThemeSelect');
  const exportOrientationSelect = document.getElementById('exportOrientationSelect');
  const exportOptDiff = document.getElementById('exportOptDiff');
  const exportOptBadges = document.getElementById('exportOptBadges');
  const exportOptOverprint = document.getElementById('exportOptOverprint');
  const exportOptLegLines = document.getElementById('exportOptLegLines');
  const exportOptNotes = document.getElementById('exportOptNotes');
  const exportOptSummarySlide = document.getElementById('exportOptSummarySlide');
  const exportHideOptionLabels = document.getElementById('exportHideOptionLabels');
  const exportQualitySelect = document.getElementById('exportQualitySelect');
  const exportQualityBadge = document.getElementById('exportQualityBadge');
  const exportSelectAllLegsBtn = document.getElementById('exportSelectAllLegsBtn');
  const exportDeselectAllLegsBtn = document.getElementById('exportDeselectAllLegsBtn');
  const exportLegsCheckboxList = document.getElementById('exportLegsCheckboxList');

  if (exportQualitySelect && exportQualityBadge) {
    exportQualitySelect.addEventListener('change', () => {
      const val = exportQualitySelect.value;
      if (val === 'ultra') {
        exportQualityBadge.textContent = 'Ultra Sharp (~400 DPI)';
      } else if (val === 'high') {
        exportQualityBadge.textContent = 'High Quality (~300 DPI)';
      } else if (val === 'jpg-high') {
        exportQualityBadge.textContent = 'Optimized JPEG (92%)';
      } else if (val === 'jpg-compact') {
        exportQualityBadge.textContent = 'Compact JPEG (80%)';
      }
    });
  }

  // Open Export Modal
  exportHtmlBtn.addEventListener('click', () => {
    if (state.legs.length === 0) {
      alert('Please create a course with at least one leg before exporting.');
      return;
    }

    // Populate default fields
    exportTitleInput.value = state.eventName || 'Orienteering Routechoice Analysis';
    exportSubtitleInput.value = `Scale 1:${state.scale} • ${state.legs.length} Legs • Generated with Sprint RC Analyser`;

    // Populate Legs Checkbox List
    exportLegsCheckboxList.innerHTML = '';
    state.legs.forEach((leg, idx) => {
      const legVars = state.variants.filter((v) => v.legIndex === idx);
      const row = document.createElement('label');
      row.className = 'flex items-center justify-between p-1.5 rounded hover:bg-slate-100 cursor-pointer';

      row.innerHTML = `
        <div class="flex items-center gap-2">
          <input type="checkbox" class="export-leg-checkbox accent-emerald-600 rounded" data-index="${idx}" checked>
          <span class="font-bold text-slate-800">${leg.label}</span>
          <span class="font-mono text-slate-500 text-[11px]">(${leg.straightDistMeters.toFixed(0)}m)</span>
        </div>
        <span class="text-[10px] font-semibold px-1.5 py-0.5 rounded ${
          legVars.length > 0 ? 'bg-blue-100 text-blue-700' : 'bg-slate-200 text-slate-500'
        }">
          ${legVars.length} route${legVars.length === 1 ? '' : 's'}
        </span>
      `;
      exportLegsCheckboxList.appendChild(row);
    });

    if (exportOptOverprint) exportOptOverprint.checked = state.showOverprint;
    if (exportOptLegLines) exportOptLegLines.checked = state.showLegLines;

    loadSavedGhCreds();
    if (ghStatusBox) ghStatusBox.classList.add('hidden');
    if (ghResultBox) ghResultBox.classList.add('hidden');

    exportModal.classList.remove('hidden');
  });

  // Close Export Modal
  function closeExportModal() {
    exportModal.classList.add('hidden');
  }
  closeExportModalBtn.addEventListener('click', closeExportModal);
  cancelExportModalBtn.addEventListener('click', closeExportModal);

  if (exportOptOverprint) {
    exportOptOverprint.addEventListener('change', (e) => {
      setOverprintVisibility(e.target.checked);
    });
  }
  if (exportOptLegLines) {
    exportOptLegLines.addEventListener('change', (e) => {
      setLegLinesVisibility(e.target.checked);
    });
  }

  // Select / Deselect All Legs
  exportSelectAllLegsBtn.addEventListener('click', () => {
    exportLegsCheckboxList.querySelectorAll('.export-leg-checkbox').forEach((cb) => (cb.checked = true));
  });
  exportDeselectAllLegsBtn.addEventListener('click', () => {
    exportLegsCheckboxList.querySelectorAll('.export-leg-checkbox').forEach((cb) => (cb.checked = false));
  });

  // Extract Presentation Config from Modal
  function getExportConfig() {
    const selectedIndices = [];
    exportLegsCheckboxList.querySelectorAll('.export-leg-checkbox').forEach((cb) => {
      if (cb.checked) {
        selectedIndices.push(Number(cb.dataset.index));
      }
    });

    if (selectedIndices.length === 0) {
      alert('Please select at least one leg to include in the presentation.');
      return null;
    }

    return {
      title: exportTitleInput.value.trim() || 'Orienteering Routechoice Analysis',
      subtitle: exportSubtitleInput.value.trim(),
      theme: exportThemeSelect.value, // 'dark' or 'light'
      orientation: exportOrientationSelect.value, // 'vertical' or 'north'
      mapQuality: exportQualitySelect ? exportQualitySelect.value : 'high',
      showDiff: exportOptDiff.checked,
      showBadges: exportOptBadges.checked,
      showOverprint: exportOptOverprint ? exportOptOverprint.checked : state.showOverprint,
      showLegLines: exportOptLegLines ? exportOptLegLines.checked : state.showLegLines,
      showNotes: exportOptNotes.checked,
      showSummarySlide: exportOptSummarySlide ? exportOptSummarySlide.checked : true,
      hideOptionLabels: exportHideOptionLabels ? exportHideOptionLabels.checked : false,
      selectedIndices
    };
  }

  // Generate complete self-contained HTML presentation
  function buildPresentationHtml(config, exportMapSrc, exportW, exportH) {
    const {
      title,
      subtitle,
      theme,
      orientation,
      showDiff,
      showBadges,
      showOverprint,
      showLegLines,
      showNotes,
      hideOptionLabels,
      showSummarySlide = true,
      selectedIndices
    } = config;

    const filteredLegs = state.legs.filter((_, idx) => selectedIndices.includes(idx));
    const filteredVariants = state.variants.filter((v) => selectedIndices.includes(v.legIndex));

    const expW = exportW || state.map.width;
    const expH = exportH || state.map.height;
    const scaleRatioX = expW > 0 && state.map.width > 0 ? expW / state.map.width : 1;
    const scaleRatioY = expH > 0 && state.map.height > 0 ? expH / state.map.height : 1;

    // Rescale leg control coordinates to match the exported map's pixel dimensions with 100% precision
    const scaledLegs = filteredLegs.map((leg) => ({
      ...leg,
      start: {
        ...leg.start,
        x: leg.start.x * scaleRatioX,
        y: leg.start.y * scaleRatioY
      },
      end: {
        ...leg.end,
        x: leg.end.x * scaleRatioX,
        y: leg.end.y * scaleRatioY
      }
    }));

    // Rescale route choice polyline coordinates for presentation slides (filtered legs only)
    const scaledVariants = filteredVariants.map((v) => ({
      ...v,
      points: (v.points || []).map((p) => ({
        x: p.x * scaleRatioX,
        y: p.y * scaleRatioY
      }))
    }));

    // Rescale route choice polyline coordinates for ALL variants (preserves full course for roundtrip re-editing)
    const allScaledVariants = (state.variants || []).map((v) => ({
      ...v,
      points: (v.points || []).map((p) => ({
        x: p.x * scaleRatioX,
        y: p.y * scaleRatioY
      }))
    }));

    const isDark = theme === 'dark';
    const bgBody = isDark ? '#0f172a' : '#f8fafc';
    const bgHeader = isDark ? '#1e293b' : '#ffffff';
    const bgSidebar = isDark ? '#1e293b' : '#ffffff';
    const bgCanvasArea = isDark ? '#020617' : '#e2e8f0';
    const borderCol = isDark ? '#334155' : '#e2e8f0';
    const textMain = isDark ? '#f8fafc' : '#0f172a';
    const textMuted = isDark ? '#94a3b8' : '#64748b';
    const cardBg = isDark ? '#0f172a' : '#f1f5f9';

    // Embedded course project configuration for seamless round-trip editing
    const embeddedProject = {
      version: '1.4.0',
      exportedAt: new Date().toISOString(),
      eventName: state.eventName || title,
      scale: state.scale,
      dpi: state.dpi * scaleRatioX,
      mapFileName: state.map.fileName || 'map.png',
      mapDataUrl: exportMapSrc,
      mapWidth: expW,
      mapHeight: expH,
      controls: (state.controls || []).map(c => ({
        ...c,
        x: c.x * scaleRatioX,
        y: c.y * scaleRatioY
      })),
      markLastAsFinish: !!state.markLastAsFinish,
      showOverprint: typeof state.showOverprint === 'boolean' ? state.showOverprint : true,
      showLegLines: typeof state.showLegLines === 'boolean' ? state.showLegLines : true,
      showRouteLabels: typeof state.showRouteLabels === 'boolean' ? state.showRouteLabels : true,
      variants: allScaledVariants,
      takenRouteByLeg: state.takenRouteByLeg || {},
      runningPace: state.runningPace || 4.0,
      legNotes: state.legNotes || {}
    };

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>${title}</title>
  <!-- Course Project Data (allows re-importing this HTML file into the editor) -->
  <script id="sprint-course-data" type="application/json">
${JSON.stringify(embeddedProject).replace(/<\/script/gi, '<\\/script')}
  </script>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background-color: ${bgBody};
      color: ${textMain};
      font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      height: 100vh;
      height: 100dvh;
      width: 100vw;
      display: flex;
      overflow: hidden;
      user-select: none;
      -webkit-user-select: none;
      -webkit-tap-highlight-color: transparent;
    }
    ::-webkit-scrollbar { width: 4px; height: 4px; }
    ::-webkit-scrollbar-thumb { background: ${isDark ? '#334155' : '#cbd5e1'}; border-radius: 2px; }

    main {
      flex: 1;
      width: 100vw;
      height: 100vh;
      height: 100dvh;
      overflow: hidden;
      position: relative;
    }
    .viewport {
      width: 100%;
      height: 100%;
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
      background-color: ${bgCanvasArea};
      touch-action: none;
    }
    canvas {
      width: 100%;
      height: 100%;
      display: block;
      cursor: grab;
      touch-action: none;
    }

    /* Floating Viewport Controls (Top-Right) */
    .float-tools {
      position: absolute;
      top: 14px;
      right: 14px;
      display: flex;
      align-items: center;
      gap: 3px;
      padding: 3px;
      border-radius: 12px;
      border: 1px solid ${isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.08)'};
      background-color: ${isDark ? 'rgba(15, 23, 42, 0.82)' : 'rgba(255, 255, 255, 0.88)'};
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      z-index: 25;
      box-shadow: 0 6px 20px rgba(0, 0, 0, ${isDark ? '0.4' : '0.12'});
    }
    .btn-tool {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 32px;
      height: 32px;
      padding: 0 6px;
      font-size: 12px;
      font-weight: 700;
      color: ${textMain};
      background: transparent;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      touch-action: manipulation;
      transition: background-color 0.12s, transform 0.08s;
    }
    .btn-tool:hover { background-color: rgba(125,125,125,0.18); }
    .btn-tool:active { transform: scale(0.92); }

    /* Mobile touch target sizing */
    @media (max-width: 680px) {
      .float-tools {
        top: 10px;
        right: 10px;
        gap: 4px;
        padding: 4px;
      }
      .btn-tool {
        min-width: 36px;
        height: 36px;
      }
    }

    /* Fallback / Pseudo-Fullscreen for Mobile Devices (iOS Safari / Iframe constraints) */
    html.is-pseudo-fullscreen,
    body.is-pseudo-fullscreen {
      position: fixed !important;
      top: 0 !important;
      left: 0 !important;
      right: 0 !important;
      bottom: 0 !important;
      width: 100vw !important;
      width: 100dvw !important;
      height: 100vh !important;
      height: 100dvh !important;
      margin: 0 !important;
      padding: 0 !important;
      overflow: hidden !important;
      z-index: 9999999 !important;
    }
    html.is-pseudo-fullscreen main,
    body.is-pseudo-fullscreen main {
      width: 100vw !important;
      width: 100dvw !important;
      height: 100vh !important;
      height: 100dvh !important;
    }

    /* Floating Glass HUD Card (Bottom / Bottom-Left) */
    .glass-hud {
      position: absolute;
      bottom: 16px;
      left: 16px;
      width: 340px;
      max-width: calc(100vw - 32px);
      max-height: calc(100vh - 32px);
      border-radius: 16px;
      background-color: ${isDark ? 'rgba(15, 23, 42, 0.85)' : 'rgba(255, 255, 255, 0.90)'};
      backdrop-filter: blur(24px) saturate(180%);
      -webkit-backdrop-filter: blur(24px) saturate(180%);
      border: 1px solid ${isDark ? 'rgba(255, 255, 255, 0.14)' : 'rgba(0, 0, 0, 0.08)'};
      box-shadow: 0 16px 40px -4px rgba(0, 0, 0, ${isDark ? '0.65' : '0.18'}),
                  0 0 0 1px ${isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(255, 255, 255, 0.8)'} inset;
      z-index: 30;
      display: flex;
      flex-direction: column;
      padding: 8px;
      gap: 6px;
      touch-action: auto;
      transition: transform 0.22s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.18s ease;
    }

    /* Sleek Compact Leg Navigation Bar */
    .leg-nav-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 6px;
      padding: 6px 8px;
      border-radius: 11px;
      background-color: ${isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)'};
      border: 1px solid ${isDark ? 'rgba(255, 255, 255, 0.07)' : 'rgba(0, 0, 0, 0.06)'};
      flex-shrink: 0;
    }
    .btn-step {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 28px;
      height: 28px;
      border-radius: 7px;
      border: 1px solid ${isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)'};
      background-color: ${isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(255, 255, 255, 0.7)'};
      color: ${textMain};
      cursor: pointer;
      touch-action: manipulation;
      transition: background-color 0.12s, transform 0.08s, opacity 0.12s;
    }
    .btn-step:hover:not(:disabled) {
      background-color: rgba(125,125,125,0.22);
    }
    .btn-step:active:not(:disabled) {
      transform: scale(0.92);
    }
    .btn-step:disabled {
      opacity: 0.25;
      cursor: not-allowed;
    }
    .btn-toggle {
      opacity: 0.7;
    }
    .btn-toggle:hover {
      opacity: 1;
    }
    .leg-nav-center {
      display: flex;
      align-items: center;
      justify-content: center;
      text-align: center;
      min-width: 0;
      flex: 1;
      cursor: pointer;
      padding: 0 6px;
      height: 28px;
    }
    .leg-title {
      font-size: 13px;
      font-weight: 800;
      color: ${textMain};
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 100%;
      letter-spacing: -0.01em;
    }

    /* Collapsible Body */
    .hud-body {
      display: flex;
      flex-direction: column;
      gap: 6px;
      overflow-y: auto;
      max-height: 220px;
      -webkit-overflow-scrolling: touch;
      transition: opacity 0.18s ease;
    }
    .glass-hud.collapsed .hud-body {
      display: none !important;
    }
    .glass-hud.collapsed {
      padding-bottom: 8px;
    }

    /* Routes List */
    .routes-list {
      display: flex;
      flex-direction: column;
      gap: 5px;
    }
    .card-route {
      padding: 7px 10px;
      border-radius: 9px;
      border: 1px solid ${isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)'};
      background-color: ${isDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.03)'};
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      cursor: pointer;
      transition: background-color 0.12s, border-color 0.12s, transform 0.08s, box-shadow 0.12s;
    }
    .card-route:hover {
      background-color: ${isDark ? 'rgba(255, 255, 255, 0.09)' : 'rgba(0, 0, 0, 0.06)'};
    }
    .card-route:active { transform: scale(0.99); }
    .card-route.taken {
      border-color: #6366f1;
      box-shadow: 0 0 0 1px #6366f1;
      background-color: ${isDark ? 'rgba(99, 102, 241, 0.12)' : 'rgba(99, 102, 241, 0.07)'};
    }
    .card-route.focused {
      border-color: #ec4899;
      box-shadow: 0 0 0 2px #ec4899;
    }
    .route-left {
      display: flex;
      align-items: center;
      gap: 8px;
      min-width: 0;
    }
    .route-dot {
      width: 10px;
      height: 10px;
      border-radius: 9999px;
      flex-shrink: 0;
      box-shadow: 0 0 6px rgba(0,0,0,0.3);
    }
    .route-name {
      font-size: 12px;
      font-weight: 700;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .route-right {
      display: flex;
      align-items: center;
      gap: 6px;
      flex-shrink: 0;
    }
    .route-dist {
      font-size: 12px;
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-weight: 700;
      color: ${textMain};
    }
    .pill-taken {
      font-size: 9px;
      font-weight: 700;
      padding: 1px 5px;
      border-radius: 4px;
      background-color: rgba(99,102,241,0.2);
      color: #818cf8;
    }
    .pill-fastest {
      font-size: 9px;
      font-weight: 700;
      padding: 1px 5px;
      border-radius: 4px;
      background-color: rgba(34,197,94,0.18);
      color: #4ade80;
    }
    .pill-diff {
      font-size: 9px;
      font-weight: 700;
      padding: 1px 5px;
      border-radius: 4px;
      background-color: rgba(239,68,68,0.16);
      color: #f87171;
    }

    /* Notes Box */
    .notes-section {
      margin-top: 2px;
      padding-top: 4px;
      border-top: 1px solid ${isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)'};
    }
    .notes-box {
      padding: 6px 8px;
      border-radius: 8px;
      border: 1px solid ${isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)'};
      font-size: 11px;
      line-height: 1.4;
      white-space: pre-wrap;
      background-color: ${isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)'};
      color: ${textMuted};
      max-height: 80px;
      overflow-y: auto;
    }

    /* Mobile / Narrow Iframes: Floating Bottom Sheet */
    @media (max-width: 680px) {
      .glass-hud {
        left: 10px;
        right: 10px;
        bottom: 10px;
        width: auto;
        max-width: 480px;
        margin: 0 auto;
        max-height: 48vh;
      }
    }

    body.is-narrow .glass-hud {
      left: 10px !important;
      right: 10px !important;
      bottom: 10px !important;
      width: auto !important;
      max-width: 480px !important;
      margin: 0 auto !important;
      max-height: 48vh !important;
    }

    /* Summary Slide Styling */
    .summary-slide {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      background-color: ${bgBody};
      display: flex;
      align-items: center;
      justify-content: center;
      overflow-y: auto;
      padding: 16px;
      z-index: 25;
      -webkit-overflow-scrolling: touch;
    }
    .summary-card {
      width: 100%;
      max-width: 760px;
      background: ${isDark ? 'rgba(23, 32, 51, 0.94)' : 'rgba(255, 255, 255, 0.96)'};
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border: 1px solid ${borderCol};
      border-radius: 20px;
      padding: 22px 24px;
      box-shadow: 0 24px 48px rgba(0,0,0,${isDark ? '0.55' : '0.08'});
      display: flex;
      flex-direction: column;
      gap: 16px;
      margin: auto;
    }
    .summary-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 14px;
      flex-wrap: wrap;
      border-bottom: 1px solid ${borderCol};
      padding-bottom: 12px;
    }
    .summary-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 10px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      padding: 3px 8px;
      border-radius: 6px;
      background: ${isDark ? 'rgba(99, 102, 241, 0.22)' : 'rgba(99, 102, 241, 0.12)'};
      color: ${isDark ? '#a5b4fc' : '#4f46e5'};
      margin-bottom: 4px;
    }
    .summary-badge-dot {
      width: 6px;
      height: 6px;
      border-radius: 9999px;
      background: ${isDark ? '#818cf8' : '#4f46e5'};
    }
    .summary-title {
      font-size: 20px;
      font-weight: 800;
      color: ${textMain};
      line-height: 1.2;
      letter-spacing: -0.01em;
    }
    .summary-subtitle {
      font-size: 11px;
      color: ${textMuted};
      margin-top: 2px;
    }
    .summary-header-actions {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .btn-summary-action {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 11px;
      border-radius: 8px;
      background: ${isDark ? '#334155' : '#f1f5f9'};
      color: ${textMain};
      font-size: 11px;
      font-weight: 700;
      border: 1px solid ${borderCol};
      cursor: pointer;
      transition: all 0.15s ease;
    }
    .btn-summary-action:hover {
      background: ${isDark ? '#475569' : '#e2e8f0'};
      transform: translateY(-1px);
    }
    .summary-metrics-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
      gap: 10px;
    }
    .summary-kpi-card {
      background: ${isDark ? 'rgba(15, 23, 42, 0.65)' : 'rgba(248, 250, 252, 0.9)'};
      border: 1px solid ${borderCol};
      border-radius: 14px;
      padding: 12px 14px;
      display: flex;
      flex-direction: column;
      gap: 4px;
      position: relative;
    }
    .summary-kpi-label {
      font-size: 9px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: ${textMuted};
    }
    .summary-kpi-val {
      font-size: 22px;
      font-weight: 900;
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      line-height: 1.1;
      color: ${textMain};
    }
    .summary-kpi-val.green, .summary-kpi-val .green { color: #22c55e; }
    .summary-kpi-val.orange { color: #f59e0b; }
    .summary-kpi-val.red { color: #ef4444; }
    .summary-kpi-denom {
      font-size: 15px;
      font-weight: 600;
      color: ${textMuted};
      opacity: 0.65;
    }
    .summary-kpi-progress {
      width: 100%;
      height: 4px;
      background: ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'};
      border-radius: 9999px;
      overflow: hidden;
      margin: 2px 0 1px 0;
    }
    .summary-kpi-progress-fill {
      height: 100%;
      background: linear-gradient(90deg, #22c55e, #10b981);
      border-radius: 9999px;
      transition: width 0.5s ease;
    }
    .summary-kpi-sub {
      font-size: 10px;
      color: ${textMuted};
      font-weight: 500;
    }
    .summary-kpi-splits {
      display: flex;
      align-items: center;
      gap: 5px;
      flex-wrap: wrap;
      margin-top: 2px;
    }
    .kpi-split-pill {
      font-size: 9px;
      font-weight: 700;
      padding: 2px 6px;
      border-radius: 9999px;
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }
    .kpi-split-pill.green { background: rgba(34, 197, 94, 0.16); color: #22c55e; }
    .kpi-split-pill.orange { background: rgba(245, 158, 11, 0.16); color: #f59e0b; }
    .kpi-split-pill.red { background: rgba(239, 68, 68, 0.16); color: #ef4444; }

    .summary-track-box {
      background: ${isDark ? 'rgba(15, 23, 42, 0.5)' : 'rgba(248, 250, 252, 0.8)'};
      border: 1px solid ${borderCol};
      border-radius: 16px;
      padding: 16px 18px;
      display: flex;
      flex-direction: column;
      gap: 12px;
      overflow: visible;
    }
    .summary-track-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 8px;
    }
    .summary-track-title {
      font-size: 11px;
      font-weight: 800;
      text-transform: uppercase;
      color: ${textMain};
      letter-spacing: 0.04em;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .summary-track-legend {
      display: flex;
      align-items: center;
      gap: 12px;
      font-size: 11px;
      font-weight: 600;
      color: ${textMuted};
      flex-wrap: wrap;
    }
    .summary-track-legend-item {
      display: inline-flex;
      align-items: center;
      gap: 5px;
    }
    .dot-badge {
      width: 9px;
      height: 9px;
      border-radius: 9999px;
      flex-shrink: 0;
      display: inline-block;
    }
    .dot-badge.green { background-color: #22c55e; box-shadow: 0 0 6px rgba(34, 197, 94, 0.5); }
    .dot-badge.orange { background-color: #f59e0b; box-shadow: 0 0 6px rgba(245, 158, 11, 0.5); }
    .dot-badge.red { background-color: #ef4444; box-shadow: 0 0 6px rgba(239, 68, 68, 0.5); }
    .dot-badge.gray { background-color: #94a3b8; }

    .summary-dots-timeline {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: center;
      gap: 12px 14px;
      padding: 14px 4px 6px 4px;
    }
    .leg-dot-node {
      display: inline-flex;
      flex-direction: column;
      align-items: center;
      gap: 5px;
      background: transparent;
      border: none;
      padding: 0;
      cursor: pointer;
      position: relative;
      transition: transform 0.18s ease;
    }
    .leg-dot-node:hover {
      transform: translateY(-3px);
      z-index: 50;
    }
    .leg-dot-circle {
      width: 44px;
      height: 44px;
      border-radius: 9999px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 13px;
      font-weight: 800;
      color: #ffffff;
      border: 2.5px solid transparent;
      box-shadow: 0 3px 8px rgba(0,0,0,0.22);
      transition: all 0.18s ease;
    }
    .leg-dot-node:hover .leg-dot-circle {
      box-shadow: 0 6px 18px rgba(0,0,0,0.4);
      border-color: ${isDark ? '#ffffff' : '#0f172a'};
      transform: scale(1.06);
    }
    .leg-dot-circle.green {
      background: linear-gradient(135deg, #22c55e, #16a34a);
    }
    .leg-dot-circle.orange {
      background: linear-gradient(135deg, #f59e0b, #d97706);
    }
    .leg-dot-circle.red {
      background: linear-gradient(135deg, #ef4444, #dc2626);
    }
    .leg-dot-circle.gray {
      background: ${isDark ? '#475569' : '#94a3b8'};
      color: ${isDark ? '#cbd5e1' : '#ffffff'};
    }
    .leg-dot-sub {
      font-size: 10px;
      font-weight: 700;
      letter-spacing: -0.02em;
      white-space: nowrap;
    }
    .leg-dot-sub.green { color: #22c55e; }
    .leg-dot-sub.orange { color: #f59e0b; }
    .leg-dot-sub.red { color: #ef4444; }
    .leg-dot-sub.gray { color: ${textMuted}; }

    /* Rich Tooltip */
    .leg-dot-tooltip {
      position: absolute;
      bottom: calc(100% + 10px);
      left: 50%;
      transform: translateX(-50%) translateY(4px);
      background: ${isDark ? 'rgba(15, 23, 42, 0.96)' : 'rgba(255, 255, 255, 0.98)'};
      border: 1px solid ${isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)'};
      box-shadow: 0 12px 28px rgba(0, 0, 0, ${isDark ? '0.6' : '0.15'});
      border-radius: 10px;
      padding: 8px 11px;
      min-width: 175px;
      pointer-events: none;
      opacity: 0;
      visibility: hidden;
      transition: opacity 0.15s ease, transform 0.15s ease, visibility 0.15s;
      z-index: 100;
      text-align: left;
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
    }
    .leg-dot-tooltip::after {
      content: '';
      position: absolute;
      top: 100%;
      left: 50%;
      transform: translateX(-50%);
      border-width: 5px;
      border-style: solid;
      border-color: ${isDark ? 'rgba(15, 23, 42, 0.96)' : 'rgba(255, 255, 255, 0.98)'} transparent transparent transparent;
    }
    .leg-dot-node:hover .leg-dot-tooltip,
    .leg-dot-node:focus-visible .leg-dot-tooltip {
      opacity: 1;
      visibility: visible;
      transform: translateX(-50%) translateY(0);
    }
    .tt-header {
      font-size: 11px;
      font-weight: 800;
      color: ${textMain};
      border-bottom: 1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'};
      padding-bottom: 4px;
      margin-bottom: 4px;
      white-space: nowrap;
    }
    .tt-row {
      display: flex;
      justify-content: space-between;
      gap: 8px;
      font-size: 10px;
      line-height: 1.45;
      white-space: nowrap;
    }
    .tt-label {
      color: ${textMuted};
      font-weight: 600;
    }
    .tt-val {
      color: ${textMain};
      font-weight: 700;
    }
    .tt-loss.green { color: #22c55e; font-weight: 800; }
    .tt-loss.orange { color: #f59e0b; font-weight: 800; }
    .tt-loss.red { color: #ef4444; font-weight: 800; }

    /* Footer & Back Button */
    .summary-footer {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      margin-top: 4px;
      text-align: center;
    }
    .btn-summary-back {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      width: 100%;
      max-width: 320px;
      padding: 10px 20px;
      border-radius: 10px;
      background: ${isDark ? '#334155' : '#e2e8f0'};
      color: ${textMain};
      font-size: 12px;
      font-weight: 700;
      border: 1px solid ${borderCol};
      cursor: pointer;
      box-shadow: 0 2px 6px rgba(0,0,0,0.1);
      transition: all 0.15s ease;
    }
    .btn-summary-back:hover {
      background: ${isDark ? '#475569' : '#cbd5e1'};
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    }
    .summary-footer-tip {
      font-size: 11px;
      color: ${textMuted};
      font-weight: 500;
      margin: 0;
    }
  </style>
</head>
<body>
  <main id="mainContainer">
    <!-- Fullscreen Map Viewport -->
    <div class="viewport" id="viewportContainer">
      <canvas id="deckCanvas"></canvas>
    </div>

    <!-- Summary Slide -->
    ${
      showSummarySlide
        ? `
    <div id="deckSummarySlide" class="summary-slide" style="display: none;">
      <div class="summary-card">
        <div class="summary-header">
          <div class="summary-title-group">
            <span class="summary-badge"><span class="summary-badge-dot"></span> Performance Summary</span>
            <h1 class="summary-title">${title}</h1>
            ${subtitle ? `<p class="summary-subtitle">${subtitle}</p>` : `<p class="summary-subtitle">${legs.length} Legs &bull; Sprint RC Analyser</p>`}
          </div>
          <div class="summary-header-actions">
            <button id="summaryFullscreenBtn" class="btn-summary-action" title="Toggle Fullscreen (F)">
              <svg id="summaryFsIcon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>
              <span id="summaryFsText">Fullscreen</span>
            </button>
            <button id="summaryRestartBtn" class="btn-summary-action" title="Restart from Leg 1">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>
              <span>Restart</span>
            </button>
          </div>
        </div>

        <!-- Top Metric KPI Cards -->
        <div class="summary-metrics-grid">
          <div class="summary-kpi-card">
            <div class="summary-kpi-label">Optimal Routechoices</div>
            <div class="summary-kpi-val"><span class="green" id="metricOptimalNum">--</span> <span class="summary-kpi-denom" id="metricOptimalDenom">/ --</span></div>
            <div class="summary-kpi-progress"><div class="summary-kpi-progress-fill" id="metricOptimalBar" style="width: 0%;"></div></div>
            <div class="summary-kpi-sub" id="metricOptimalSub">--% optimal choices</div>
          </div>
          <div class="summary-kpi-card">
            <div class="summary-kpi-label">Estimated Time Loss</div>
            <div class="summary-kpi-val orange" id="metricTimeLoss">+0.0s</div>
            <div class="summary-kpi-sub" id="metricDistLoss">+0m extra distance</div>
          </div>
          <div class="summary-kpi-card">
            <div class="summary-kpi-label">Average Error / Leg</div>
            <div class="summary-kpi-val orange" id="metricAvgError">+0.0%</div>
            <div class="summary-kpi-sub" id="metricAvgMeters">+0.0m / leg average</div>
          </div>
          <div class="summary-kpi-card">
            <div class="summary-kpi-label">Evaluation Breakdown</div>
            <div class="summary-kpi-splits" id="metricSplitsPills">
              <span class="kpi-split-pill green" id="metricSplitOpt">0 Optimal</span>
              <span class="kpi-split-pill orange" id="metricSplitWithin5">0 &le; 5%</span>
              <span class="kpi-split-pill red" id="metricSplitOver5">0 &gt; 5%</span>
            </div>
            <div class="summary-kpi-sub" id="metricEvaluatedTotal">0 legs evaluated</div>
          </div>
        </div>

        <!-- Dot Timeline Breakdown Section -->
        <div class="summary-track-box">
          <div class="summary-track-header">
            <div class="summary-track-title">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              <span>Routechoice Evaluation Track</span>
            </div>
            <div class="summary-track-legend">
              <span class="summary-track-legend-item"><span class="dot-badge green"></span> Optimal (0%)</span>
              <span class="summary-track-legend-item"><span class="dot-badge orange"></span> &le; +5%</span>
              <span class="summary-track-legend-item"><span class="dot-badge red"></span> &gt; +5%</span>
            </div>
          </div>
          <div class="summary-dots-timeline" id="summaryDotsTimeline"></div>
        </div>

        <!-- Bottom Actions on Summary Slide -->
        <div class="summary-footer">
          <button id="summaryBackBtn" class="btn-summary-back" title="Return to interactive map">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
            <span>Back to Map (<span id="lastLegLabel"></span>)</span>
          </button>
          <p class="summary-footer-tip">Tip: Hover over or click any leg circle to inspect on map</p>
        </div>
      </div>
    </div>`
        : ''
    }

    <!-- Floating Viewport Controls (Top-Right) -->
    <div class="float-tools" id="deckFloatTools">
      <button id="deckZoomIn" class="btn-tool" title="Zoom In (+)" aria-label="Zoom In">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
      </button>
      <button id="deckZoomOut" class="btn-tool" title="Zoom Out (-)" aria-label="Zoom Out">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>
      </button>
      <div style="width: 1px; height: 16px; background-color: ${borderCol}; margin: 0 2px;"></div>
      <button id="deckResetView" class="btn-tool" title="Fit to Leg" aria-label="Fit to Leg" style="font-size: 11px; font-weight: 700; gap: 4px; padding: 0 6px;">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
        <span>Fit Leg</span>
      </button>
      <div style="width: 1px; height: 16px; background-color: ${borderCol}; margin: 0 2px;"></div>
      <button id="deckFullscreenBtn" class="btn-tool" title="Fullscreen (F)" aria-label="Toggle Fullscreen">
        <svg id="deckFsIcon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>
      </button>
    </div>

    <!-- Floating Glass HUD Panel (Bottom / Bottom-Left) -->
    <aside id="hudPanel" class="glass-hud">
      <!-- Collapsible Body (Route choices & Planner Notes) -->
      <div id="hudBody" class="hud-body">
        <!-- Route Choices Feed -->
        <div id="deckVariantsList" class="routes-list"></div>

        <!-- Planner Commentary (if any) -->
        ${
          showNotes
            ? `
        <div id="deckNotesSection" class="notes-section" style="display: none;">
          <div id="deckNotesBox" class="notes-box"></div>
        </div>`
            : ''
        }
      </div>

      <!-- Sleek Compact Leg Nav Bar (Fixed at HUD bottom) -->
      <div class="leg-nav-bar" id="legNavBar">
        <button id="deckPrevBtn" class="btn-step" title="Previous Leg (←)" aria-label="Previous Leg">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <div class="leg-nav-center" id="legNavCenter" title="Click to minimize or expand routes">
          <div id="legTitle" class="leg-title"></div>
        </div>
        <button id="deckNextBtn" class="btn-step" title="Next Leg (→)" aria-label="Next Leg">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
        </button>
        <button id="hudToggleBtn" class="btn-step btn-toggle" title="Minimize / Expand routes (C)" aria-label="Toggle HUD">
          <svg id="toggleIcon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
        </button>
      </div>
    </aside>
  </main>

  <script>
    const legs = ${JSON.stringify(scaledLegs)};
    const variants = ${JSON.stringify(scaledVariants)};
    const takenRouteByLeg = ${JSON.stringify(state.takenRouteByLeg)};
    const runningPace = ${state.runningPace};
    const legNotes = ${JSON.stringify(state.legNotes)};
    const mapSrc = "${exportMapSrc}";
    const mapW = ${expW};
    const mapH = ${expH};
    const scale = ${state.scale};
    const dpi = ${state.dpi * scaleRatioX};
    const orientationSetting = "${orientation}";
    const showDiff = ${showDiff};
    const showBadges = ${showBadges};
    const showOverprint = ${showOverprint};
    const showLegLines = ${showLegLines};
    const hideOptionLabels = ${hideOptionLabels};
    const showSummarySlide = ${showSummarySlide};
    const totalSlides = showSummarySlide ? legs.length + 1 : legs.length;

    let activeLegIdx = 0;
    let activeRouteId = null;
    const canvas = document.getElementById('deckCanvas');
    const ctx = canvas.getContext('2d');

    const img = new Image();
    img.src = mapSrc;

    // Viewport state
    let viewZoom = 1;
    let viewPanX = 0;
    let viewPanY = 0;
    let viewRotation = 0;
    let midX = 0;
    let midY = 0;
    let targetScreenX = 0;
    let targetScreenY = 0;

    function dist(p1, p2) {
      return Math.sqrt((p2.x - p1.x)**2 + (p2.y - p1.y)**2);
    }
    function polyMeters(pts) {
      if (!pts || pts.length < 2) return 0;
      let px = 0;
      for (let i = 0; i < pts.length - 1; i++) px += dist(pts[i], pts[i+1]);
      return (px / dpi) * 0.0254 * scale;
    }

    function getViewportLayout() {
      const W = canvas.width;
      const H = canvas.height;
      const hudEl = document.getElementById('hudPanel');
      const isCollapsed = hudEl && hudEl.classList.contains('collapsed');

      let safeTop = 60; // Room for top-right float tools
      let safeBottom = H - 25;
      let safeLeft = 30;
      let safeRight = W - 30;

      if (hudEl) {
        const hudH = hudEl.offsetHeight || 100;
        // Keep generous safe clearance (35px) so the control circle is never under or clipped by the HUD
        safeBottom = H - (isCollapsed ? 55 : hudH) - 35;
      }

      // Guarantee minimum height for safe viewing area
      if (safeBottom < safeTop + 140) {
        safeBottom = safeTop + 140;
      }

      const safeWidth = Math.max(100, safeRight - safeLeft);
      const safeHeight = Math.max(100, safeBottom - safeTop);

      return {
        targetScreenX: W / 2,
        targetScreenY: safeTop + safeHeight / 2,
        safeWidth,
        safeHeight,
        safeTop,
        safeBottom
      };
    }

    function initLegView() {
      const leg = legs[activeLegIdx];
      if (!leg) return;
      activeRouteId = null;

      updateSidebar();

      // Midpoint of the straight leg line is our solid, stable anchor across all legs
      midX = (leg.start.x + leg.end.x) / 2;
      midY = (leg.start.y + leg.end.y) / 2;

      // Vertical orientation: leg points straight UP (Start at bottom, End at top)
      if (orientationSetting === 'vertical') {
        const dx = leg.end.x - leg.start.x;
        const dy = leg.end.y - leg.start.y;
        viewRotation = -(Math.atan2(dy, dx) * 180 / Math.PI + 90);
      } else {
        viewRotation = 0;
      }

      const legVars = variants.filter(v => v.legIndex === leg.index);
      const allPts = [leg.start, leg.end];
      legVars.forEach(v => allPts.push(...v.points));

      // Calculate rotated bounding extents relative to midpoint
      const rad = (viewRotation * Math.PI) / 180;
      const cosR = Math.cos(rad);
      const sinR = Math.sin(rad);

      let maxDistX = 0;
      let maxDistY = 0;

      allPts.forEach(p => {
        const dx = p.x - midX;
        const dy = p.y - midY;
        const rx = dx * cosR - dy * sinR;
        const ry = dx * sinR + dy * cosR;
        if (Math.abs(rx) > maxDistX) maxDistX = Math.abs(rx);
        if (Math.abs(ry) > maxDistY) maxDistY = Math.abs(ry);
      });

      // Padding around extreme points for control circle radius (25px) + labels + margin
      const padX = maxDistX + 40;
      const padY = maxDistY + 40;

      const layout = getViewportLayout();
      targetScreenX = layout.targetScreenX;
      targetScreenY = layout.targetScreenY;

      // Fit zoom so that 2 * padX fits inside safeWidth and 2 * padY fits inside safeHeight
      const fitZoomX = layout.safeWidth / (padX * 2);
      const fitZoomY = layout.safeHeight / (padY * 2);
      viewZoom = Math.max(0.08, Math.min(Math.min(fitZoomX, fitZoomY), 4.5));

      // Reset pan offsets so the leg is perfectly anchored at targetScreenX, targetScreenY
      viewPanX = 0;
      viewPanY = 0;

      draw();
    }

    function updateSidebar() {
      const leg = legs[activeLegIdx];
      if (!leg) return;

      document.getElementById('legTitle').textContent = leg.label;

      const prevDisabled = activeLegIdx <= 0;
      const nextDisabled = activeLegIdx >= totalSlides - 1;
      const pBtn = document.getElementById('deckPrevBtn');
      const nBtn = document.getElementById('deckNextBtn');
      if (pBtn) pBtn.disabled = prevDisabled;
      if (nBtn) {
        nBtn.disabled = nextDisabled;
        if (showSummarySlide && activeLegIdx === legs.length - 1) {
          nBtn.title = 'View Summary (→)';
        } else {
          nBtn.title = 'Next Leg (→)';
        }
      }

      // Variants
      const list = document.getElementById('deckVariantsList');
      list.innerHTML = '';
      const legVars = variants.filter(v => v.legIndex === leg.index);

      if (legVars.length === 0) {
        list.innerHTML = '<p style="font-size: 11px; opacity: 0.5; padding: 12px; text-align: center;">No routes drawn</p>';
      } else {
        const lengths = legVars.map(v => polyMeters(v.points));
        const minLen = Math.min(...lengths);
        const takenId = takenRouteByLeg[leg.index];

        legVars.forEach((v, idx) => {
          const m = lengths[idx];
          const diff = minLen > 0 ? ((m - minLen) / minLen) * 100 : 0;
          const isFastest = Math.abs(m - minLen) < 0.1;
          const isTaken = takenId === v.id;
          const isFocused = activeRouteId === v.id;

          const card = document.createElement('div');
          card.className = 'card-route' + (isTaken ? ' taken' : '') + (isFocused ? ' focused' : '');

          const displayName = hideOptionLabels ? ('Route ' + (idx + 1)) : v.name;

          card.innerHTML = 
            '<div class="route-left">' +
              '<span class="route-dot" style="background-color: ' + v.color + ';"></span>' +
              '<span class="route-name">' + displayName + '</span>' +
              (isTaken ? '<span class="pill-taken">You</span>' : '') +
            '</div>' +
            '<div class="route-right">' +
              '<span class="route-dist">' + m.toFixed(0) + 'm</span>' +
              (isFastest ? '<span class="pill-fastest">Fastest</span>' : (showDiff ? '<span class="pill-diff">+' + diff.toFixed(1) + '%</span>' : '')) +
            '</div>';

          card.onclick = () => {
            activeRouteId = (activeRouteId === v.id ? null : v.id);
            updateSidebar();
            draw();
          };

          list.appendChild(card);
        });
      }

      // Notes
      const notesBox = document.getElementById('deckNotesBox');
      const notesSection = document.getElementById('deckNotesSection');
      if (notesBox && notesSection) {
        const text = legNotes[leg.index] || '';
        if (text.trim()) {
          notesBox.textContent = text;
          notesSection.style.display = 'block';
        } else {
          notesSection.style.display = 'none';
        }
      }
    }

    function draw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.save();
      ctx.translate(targetScreenX + viewPanX, targetScreenY + viewPanY);
      ctx.rotate((viewRotation * Math.PI) / 180);
      ctx.scale(viewZoom, viewZoom);
      ctx.translate(-midX, -midY);

      // Draw Map
      if (img.complete && img.naturalWidth !== 0) {
        ctx.drawImage(img, 0, 0, mapW, mapH);
      } else {
        ctx.fillStyle = '${isDark ? '#1e293b' : '#cbd5e1'}';
        ctx.fillRect(0, 0, mapW, mapH);
        ctx.fillStyle = '${isDark ? '#475569' : '#94a3b8'}';
        ctx.font = '24px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Map Image Loading...', midX, midY);
      }

      const leg = legs[activeLegIdx];
      if (!leg) {
        ctx.restore();
        return;
      }

      const r = Math.max(14, (0.003 / 0.0254) * dpi);
      const lw = Math.max(2.5, 3.5 / viewZoom);

      // Draw Straight Connecting Course Line
      if (showLegLines && dist(leg.start, leg.end) > r * 2) {
        const angL = Math.atan2(leg.end.y - leg.start.y, leg.end.x - leg.start.x);
        const startX = leg.start.x + r * Math.cos(angL);
        const startY = leg.start.y + r * Math.sin(angL);
        const endX = leg.end.x - r * Math.cos(angL);
        const endY = leg.end.y - r * Math.sin(angL);

        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.lineTo(endX, endY);
        ctx.strokeStyle = '#c026d3';
        ctx.lineWidth = lw;
        ctx.stroke();
      }

      // Draw Purple Control Circles (Start Triangle, Controls, Finish)
      if (showOverprint) {
        const angL = Math.atan2(leg.end.y - leg.start.y, leg.end.x - leg.start.x);
        ctx.strokeStyle = '#c026d3';
        ctx.lineWidth = lw;

        if (leg.index === 0) {
          ctx.save();
          ctx.translate(leg.start.x, leg.start.y);
          ctx.rotate(angL);
          const tSize = r * 1.35;
          ctx.beginPath();
          ctx.moveTo(tSize, 0);
          ctx.lineTo(tSize * Math.cos(2 * Math.PI / 3), tSize * Math.sin(2 * Math.PI / 3));
          ctx.lineTo(tSize * Math.cos(4 * Math.PI / 3), tSize * Math.sin(4 * Math.PI / 3));
          ctx.closePath();
          ctx.stroke();
          ctx.restore();
        } else {
          ctx.beginPath();
          ctx.arc(leg.start.x, leg.start.y, r, 0, Math.PI * 2);
          ctx.stroke();
        }

        if (leg.end && leg.end.isFinish) {
          ctx.beginPath();
          ctx.arc(leg.end.x, leg.end.y, r * 1.25, 0, Math.PI * 2);
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(leg.end.x, leg.end.y, r * 0.8, 0, Math.PI * 2);
          ctx.stroke();
        } else {
          ctx.beginPath();
          ctx.arc(leg.end.x, leg.end.y, r, 0, Math.PI * 2);
          ctx.stroke();
        }
      }

      // Draw Routechoices for this leg
      const legVars = variants.filter(v => v.legIndex === leg.index);
      const rlw = Math.max(4, 5 / viewZoom);

      legVars.forEach(v => {
        if (!v.points || v.points.length < 2) return;
        const isFocused = activeRouteId === v.id;

        // Glowing outer halo if focused
        if (isFocused) {
          ctx.beginPath();
          ctx.moveTo(v.points[0].x, v.points[0].y);
          for (let i = 1; i < v.points.length; i++) ctx.lineTo(v.points[i].x, v.points[i].y);
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = rlw + Math.max(5, 7 / viewZoom);
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          ctx.stroke();
        }

        ctx.beginPath();
        ctx.moveTo(v.points[0].x, v.points[0].y);
        for (let i = 1; i < v.points.length; i++) ctx.lineTo(v.points[i].x, v.points[i].y);
        ctx.strokeStyle = v.color;
        ctx.lineWidth = isFocused ? rlw * 1.4 : rlw;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.stroke();

        // Distance label pill on map
        if (showBadges) {
          const mid = v.points[Math.floor(v.points.length / 2)];
          const distM = polyMeters(v.points).toFixed(0) + 'm';
          const txt = hideOptionLabels ? distM : (v.name + ' (' + distM + ')');
          const fSize = Math.max(13, 16 / viewZoom);
          ctx.font = 'bold ' + fSize + 'px sans-serif';
          const tw = ctx.measureText(txt).width;
          const pw = tw + 10 / viewZoom;
          const ph = fSize + 6 / viewZoom;

          ctx.fillStyle = v.color;
          ctx.beginPath();
          ctx.roundRect(mid.x - pw/2, mid.y - ph/2 - 14 / viewZoom, pw, ph, 4 / viewZoom);
          ctx.fill();

          ctx.fillStyle = '#ffffff';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(txt, mid.x, mid.y - 14 / viewZoom);
        }
      });

      ctx.restore();
    }

    const hudPanel = document.getElementById('hudPanel');
    const hudToggleBtn = document.getElementById('hudToggleBtn');
    const legNavCenter = document.getElementById('legNavCenter');
    const toggleIcon = document.getElementById('toggleIcon');

    function toggleHud() {
      if (!hudPanel) return;
      hudPanel.classList.toggle('collapsed');
      const isCollapsed = hudPanel.classList.contains('collapsed');
      if (toggleIcon) {
        toggleIcon.innerHTML = isCollapsed
          ? '<polyline points="18 15 12 9 6 15"/>'
          : '<polyline points="6 9 12 15 18 9"/>';
      }
      initLegView();
    }

    if (hudToggleBtn) {
      hudToggleBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleHud();
      });
    }
    if (legNavCenter) {
      legNavCenter.addEventListener('click', toggleHud);
    }

    if (hudPanel) {
      ['pointerdown', 'mousedown', 'touchstart', 'wheel'].forEach(evt => {
        hudPanel.addEventListener(evt, (e) => e.stopPropagation(), { passive: true });
      });
    }

    function checkResponsive() {
      const isNarrow = window.innerWidth <= 680;
      document.body.classList.toggle('is-narrow', isNarrow);
    }

    function showSlide() {
      const canvasEl = document.getElementById('deckCanvas');
      const hudEl = document.getElementById('hudPanel');
      const floatTools = document.getElementById('deckFloatTools');
      const sumSlide = document.getElementById('deckSummarySlide');

      if (showSummarySlide && activeLegIdx === legs.length) {
        // Show summary slide
        if (canvasEl) canvasEl.style.display = 'none';
        if (hudEl) hudEl.style.display = 'none';
        if (floatTools) floatTools.style.display = 'none';
        if (sumSlide) {
          sumSlide.style.display = 'flex';
          renderSummaryContent();
        }
      } else {
        // Show leg map slide
        if (sumSlide) sumSlide.style.display = 'none';
        if (canvasEl) canvasEl.style.display = 'block';
        if (hudEl) hudEl.style.display = 'flex';
        if (floatTools) floatTools.style.display = 'flex';
        initLegView();
      }
    }

    function renderSummaryContent() {
      const metricOptimalNum = document.getElementById('metricOptimalNum');
      const metricOptimalDenom = document.getElementById('metricOptimalDenom');
      const metricOptimalBar = document.getElementById('metricOptimalBar');
      const metricOptimalSub = document.getElementById('metricOptimalSub');
      const metricTimeLoss = document.getElementById('metricTimeLoss');
      const metricDistLoss = document.getElementById('metricDistLoss');
      const metricAvgError = document.getElementById('metricAvgError');
      const metricAvgMeters = document.getElementById('metricAvgMeters');
      const metricSplitOpt = document.getElementById('metricSplitOpt');
      const metricSplitWithin5 = document.getElementById('metricSplitWithin5');
      const metricSplitOver5 = document.getElementById('metricSplitOver5');
      const metricEvaluatedTotal = document.getElementById('metricEvaluatedTotal');

      const dotsTimeline = document.getElementById('summaryDotsTimeline');
      const lastLegLabel = document.getElementById('lastLegLabel');

      if (lastLegLabel && legs.length > 0) {
        lastLegLabel.textContent = legs[legs.length - 1].label;
      }

      let totalEvaluated = 0;
      let correctCount = 0;
      let within5Count = 0;
      let over5Count = 0;
      let totalExtraMeters = 0;
      let totalPctDiff = 0;
      let totalTimeLossSec = 0;

      const legStats = legs.map((leg, idx) => {
        const legVars = variants.filter(v => v.legIndex === leg.index);
        if (legVars.length === 0) {
          return { leg, idx, hasRoutes: false };
        }
        const lengths = legVars.map(v => polyMeters(v.points));
        const minLen = Math.min(...lengths);
        const fastestVar = legVars[lengths.indexOf(minLen)];
        const takenId = takenRouteByLeg[leg.index];
        const takenVar = legVars.find(v => v.id === takenId);

        if (!takenVar) {
          return {
            leg,
            idx,
            hasRoutes: true,
            hasTaken: false,
            minLen,
            fastestVar
          };
        }

        const takenLen = polyMeters(takenVar.points);
        const extraMeters = Math.max(0, takenLen - minLen);
        const pctDiff = minLen > 0 ? ((takenLen - minLen) / minLen) * 100 : 0;
        const roundedPct = Math.round(pctDiff * 10) / 10;
        const isOptimal = pctDiff < 0.1 || extraMeters < 0.2;
        const isWithin5 = !isOptimal && roundedPct <= 5.0;
        const isOver5 = !isOptimal && !isWithin5;
        const timeLossSec = (extraMeters / 1000) * runningPace * 60;

        totalEvaluated++;
        if (isOptimal) correctCount++;
        else if (isWithin5) within5Count++;
        else over5Count++;

        totalExtraMeters += extraMeters;
        totalPctDiff += pctDiff;
        totalTimeLossSec += timeLossSec;

        let statusColor = 'green';
        let statusText = 'Optimal (0%)';
        if (isWithin5) {
          statusColor = 'orange';
          statusText = '<= +5%';
        } else if (isOver5) {
          statusColor = 'red';
          statusText = '> +5%';
        }

        return {
          leg,
          idx,
          hasRoutes: true,
          hasTaken: true,
          takenVar,
          takenLen,
          minLen,
          fastestVar,
          extraMeters,
          pctDiff,
          roundedPct,
          timeLossSec,
          statusColor,
          statusText
        };
      });

      // Update KPI cards
      const accPct = totalEvaluated > 0 ? Math.round((correctCount / totalEvaluated) * 100) : 0;
      if (metricOptimalNum && metricOptimalDenom) {
        if (totalEvaluated > 0) {
          metricOptimalNum.textContent = '' + correctCount;
          metricOptimalDenom.textContent = '/ ' + totalEvaluated;
        } else {
          metricOptimalNum.textContent = '0';
          metricOptimalDenom.textContent = '/ 0';
        }
      }
      if (metricOptimalBar) {
        metricOptimalBar.style.width = accPct + '%';
      }
      if (metricOptimalSub) {
        metricOptimalSub.textContent = totalEvaluated > 0 ? (accPct + '% optimal choices') : 'No routes marked as You';
      }

      if (metricTimeLoss && metricDistLoss) {
        if (totalEvaluated > 0) {
          metricTimeLoss.textContent = '+' + totalTimeLossSec.toFixed(1) + 's';
          metricDistLoss.textContent = '+' + totalExtraMeters.toFixed(0) + 'm extra distance';
        } else {
          metricTimeLoss.textContent = '+0.0s';
          metricDistLoss.textContent = '0m extra distance';
        }
      }

      if (metricAvgError && metricAvgMeters) {
        if (totalEvaluated > 0) {
          const avgPct = (totalPctDiff / totalEvaluated).toFixed(1);
          const avgM = (totalExtraMeters / totalEvaluated).toFixed(1);
          metricAvgError.textContent = '+' + avgPct + '%';
          metricAvgMeters.textContent = '+' + avgM + 'm / leg average';
          metricAvgError.className = 'summary-kpi-val ' + (parseFloat(avgPct) === 0 ? 'green' : 'orange');
        } else {
          metricAvgError.textContent = '+0.0%';
          metricAvgMeters.textContent = '+0.0m / leg average';
          metricAvgError.className = 'summary-kpi-val orange';
        }
      }

      if (metricSplitOpt) metricSplitOpt.textContent = correctCount + ' Optimal';
      if (metricSplitWithin5) metricSplitWithin5.textContent = within5Count + ' \u2264 5%';
      if (metricSplitOver5) metricSplitOver5.textContent = over5Count + ' > 5%';
      if (metricEvaluatedTotal) {
        metricEvaluatedTotal.textContent = totalEvaluated + ' of ' + legs.length + ' legs evaluated';
      }

      // Populate Dots Timeline Track with Rich Tooltips
      if (dotsTimeline) {
        dotsTimeline.innerHTML = '';
        legStats.forEach(st => {
          const btn = document.createElement('button');
          btn.className = 'leg-dot-node';
          const legNameClean = st.leg.label.replace(/^Leg\s+/i, '');

          let subText = '\u2014';
          let colorClass = 'gray';

          if (st.hasTaken) {
            colorClass = st.statusColor;
            if (st.statusColor === 'green') {
              subText = '\u2713';
            } else {
              subText = '+' + st.pctDiff.toFixed(1) + '%';
            }
          }

          const circle = document.createElement('div');
          circle.className = 'leg-dot-circle ' + colorClass;

          let displayNum = '' + (st.idx + 1);
          if (legNameClean.length <= 4) {
            displayNum = legNameClean;
          }
          circle.textContent = displayNum;

          const sub = document.createElement('span');
          sub.className = 'leg-dot-sub ' + colorClass;
          sub.textContent = subText;

          // Build Rich Tooltip
          const tooltip = document.createElement('div');
          tooltip.className = 'leg-dot-tooltip';

          let ttContent = '<div class="tt-header">' + st.leg.label + '</div>';
          if (!st.hasRoutes) {
            ttContent += '<div class="tt-row"><span class="tt-label">Status:</span> <span class="tt-val">No routes</span></div>';
          } else if (!st.hasTaken) {
            ttContent += '<div class="tt-row"><span class="tt-label">Choice:</span> <span class="tt-val" style="opacity: 0.6;">Not marked</span></div>';
            ttContent += '<div class="tt-row"><span class="tt-label">Fastest:</span> <span class="tt-val">' + (st.fastestVar ? st.fastestVar.name : 'Option') + ' (' + st.minLen.toFixed(0) + 'm)</span></div>';
          } else {
            ttContent += '<div class="tt-row"><span class="tt-label">Choice:</span> <span class="tt-val">' + st.takenVar.name + ' (' + st.takenLen.toFixed(0) + 'm)</span></div>';
            ttContent += '<div class="tt-row"><span class="tt-label">Fastest:</span> <span class="tt-val">' + (st.fastestVar ? st.fastestVar.name : 'Option') + ' (' + st.minLen.toFixed(0) + 'm)</span></div>';

            let lossFormatted = '';
            if (st.statusColor === 'green') {
              lossFormatted = '<span class="tt-loss green">0.0s (Fastest)</span>';
            } else {
              const lossClass = st.statusColor === 'red' ? 'red' : 'orange';
              lossFormatted = '<span class="tt-loss ' + lossClass + '">+' + st.timeLossSec.toFixed(1) + 's (+' + st.pctDiff.toFixed(1) + '%)</span>';
            }
            ttContent += '<div class="tt-row"><span class="tt-label">Time Loss:</span> ' + lossFormatted + '</div>';
          }
          tooltip.innerHTML = ttContent;

          btn.appendChild(circle);
          btn.appendChild(sub);
          btn.appendChild(tooltip);

          let dotTouch = 0;
          btn.ontouchend = (e) => {
            e.preventDefault();
            e.stopPropagation();
            dotTouch = Date.now();
            activeLegIdx = st.idx;
            showSlide();
          };
          btn.onclick = () => {
            if (Date.now() - dotTouch < 450) return;
            activeLegIdx = st.idx;
            showSlide();
          };

          dotsTimeline.appendChild(btn);
        });
      }

      // Hook up summary slide navigation buttons
      function bindSimpleBtn(el, action) {
        if (!el) return;
        let lastT = 0;
        el.ontouchend = (e) => {
          e.preventDefault();
          e.stopPropagation();
          lastT = Date.now();
          action();
        };
        el.onclick = (e) => {
          e.stopPropagation();
          if (Date.now() - lastT < 450) return;
          action();
        };
      }

      bindSimpleBtn(document.getElementById('summaryBackBtn'), () => {
        activeLegIdx = legs.length - 1;
        showSlide();
      });
      bindSimpleBtn(document.getElementById('summaryRestartBtn'), () => {
        activeLegIdx = 0;
        showSlide();
      });
      bindSimpleBtn(document.getElementById('summaryFullscreenBtn'), () => {
        toggleFullscreen();
      });
    }

    let isPseudoFs = false;

    function isFullscreen() {
      if (isPseudoFs) return true;
      return !!(
        document.fullscreenElement ||
        document.webkitFullscreenElement ||
        document.mozFullScreenElement ||
        document.msFullscreenElement
      );
    }

    function togglePseudoFullscreen(enable) {
      if (typeof enable !== 'boolean') {
        isPseudoFs = !isPseudoFs;
      } else {
        isPseudoFs = enable;
      }
      document.documentElement.classList.toggle('is-pseudo-fullscreen', isPseudoFs);
      document.body.classList.toggle('is-pseudo-fullscreen', isPseudoFs);
      updateFullscreenUi();
      setTimeout(resize, 60);
    }

    function handleFullscreenFallback() {
      const isInIframe = window.self !== window.top;
      if (isInIframe) {
        try {
          const opened = window.open(window.location.href, '_blank');
          if (!opened) {
            togglePseudoFullscreen(true);
          }
        } catch (e) {
          togglePseudoFullscreen(true);
        }
      } else {
        togglePseudoFullscreen(true);
      }
    }

    function toggleFullscreen() {
      if (isPseudoFs) {
        togglePseudoFullscreen(false);
        return;
      }

      if (!isFullscreen()) {
        const el = document.documentElement;
        let reqPromise = null;
        try {
          if (el.requestFullscreen) {
            reqPromise = el.requestFullscreen();
          } else if (el.webkitRequestFullscreen) {
            reqPromise = el.webkitRequestFullscreen();
          } else if (el.mozRequestFullScreen) {
            reqPromise = el.mozRequestFullScreen();
          } else if (el.msRequestFullscreen) {
            reqPromise = el.msRequestFullscreen();
          } else {
            handleFullscreenFallback();
            return;
          }
        } catch (err) {
          reqPromise = Promise.reject(err);
        }

        if (reqPromise && typeof reqPromise.then === 'function') {
          reqPromise.catch(() => {
            handleFullscreenFallback();
          });
        }
      } else {
        try {
          if (document.exitFullscreen) {
            document.exitFullscreen().catch(() => {});
          } else if (document.webkitExitFullscreen) {
            document.webkitExitFullscreen();
          } else if (document.mozCancelFullScreen) {
            document.mozCancelFullScreen();
          } else if (document.msExitFullscreen) {
            document.msExitFullscreen();
          }
        } catch (err) {}
        if (isPseudoFs) {
          togglePseudoFullscreen(false);
        }
      }
    }

    function updateFullscreenUi() {
      const active = isFullscreen();
      const expandPath = 'M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3';
      const compressPath = 'M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3';

      const deckFsBtn = document.getElementById('deckFullscreenBtn');
      const deckFsIcon = document.getElementById('deckFsIcon');
      if (deckFsBtn && deckFsIcon) {
        const pathEl = deckFsIcon.querySelector('path');
        if (pathEl) pathEl.setAttribute('d', active ? compressPath : expandPath);
        deckFsBtn.title = active ? 'Exit Fullscreen (F)' : 'Fullscreen (F)';
      }

      const sumFsIcon = document.getElementById('summaryFsIcon');
      const sumFsText = document.getElementById('summaryFsText');
      const sumFsBtn = document.getElementById('summaryFullscreenBtn');
      if (sumFsIcon && sumFsText && sumFsBtn) {
        const pathEl = sumFsIcon.querySelector('path');
        if (pathEl) pathEl.setAttribute('d', active ? compressPath : expandPath);
        sumFsText.textContent = active ? 'Exit Fullscreen' : 'Fullscreen';
        sumFsBtn.title = active ? 'Exit Fullscreen (F)' : 'Fullscreen (F)';
      }
    }

    function handleFsChange() {
      if (!isFullscreen() && isPseudoFs) {
        isPseudoFs = false;
      }
      updateFullscreenUi();
      setTimeout(resize, 60);
    }

    document.addEventListener('fullscreenchange', handleFsChange);
    document.addEventListener('webkitfullscreenchange', handleFsChange);
    document.addEventListener('mozfullscreenchange', handleFsChange);
    document.addEventListener('MSFullscreenChange', handleFsChange);

    function resize() {
      checkResponsive();
      const parent = canvas.parentElement;
      if (!parent) return;
      canvas.width = parent.clientWidth;
      canvas.height = parent.clientHeight;
      if (activeLegIdx < legs.length) {
        initLegView();
      }
    }
    window.addEventListener('resize', resize);

    img.onload = () => { if (activeLegIdx < legs.length) draw(); };

    // Initial setup on DOM ready
    setTimeout(() => {
      resize();
      showSlide();
    }, 50);

    // Navigation Events
    function prevLeg() {
      if (activeLegIdx > 0) {
        activeLegIdx--;
        showSlide();
      }
    }
    function nextLeg() {
      if (activeLegIdx < totalSlides - 1) {
        activeLegIdx++;
        showSlide();
      }
    }

    // Keyboard Shortcuts
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && isPseudoFs) {
        togglePseudoFullscreen(false);
      }
      if (e.key === 'ArrowLeft') prevLeg();
      if (e.key === 'ArrowRight' || e.key === ' ') {
        e.preventDefault();
        if (showSummarySlide && activeLegIdx === totalSlides - 1) {
          activeLegIdx = 0;
          showSlide();
        } else {
          nextLeg();
        }
      }
      if (e.key === 'h' || e.key === 'H' || e.key === 'c' || e.key === 'C') {
        if (activeLegIdx < legs.length) toggleHud();
      }
      if (e.key === 'f' || e.key === 'F') {
        toggleFullscreen();
      }
    });

    // Zoom centered on viewport center
    function zoomByFactor(factor) {
      const oldZoom = viewZoom;
      const newZoom = Math.max(0.05, Math.min(15.0, oldZoom * factor));
      if (newZoom === oldZoom) return;
      const scaleChange = newZoom / oldZoom;
      viewZoom = newZoom;
      viewPanX *= scaleChange;
      viewPanY *= scaleChange;
      draw();
    }

    // Bind tool buttons safely with immediate touch and click handlers
    function bindToolBtn(btnId, action) {
      const btn = document.getElementById(btnId);
      if (!btn) return;
      let lastTouch = 0;
      btn.addEventListener('touchend', (e) => {
        e.preventDefault();
        e.stopPropagation();
        lastTouch = Date.now();
        action();
      }, { passive: false });
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (Date.now() - lastTouch < 450) return;
        action();
      });
    }

    bindToolBtn('deckZoomIn', () => zoomByFactor(1.25));
    bindToolBtn('deckZoomOut', () => zoomByFactor(1 / 1.25));
    bindToolBtn('deckResetView', () => initLegView());
    bindToolBtn('deckFullscreenBtn', toggleFullscreen);
    bindToolBtn('deckPrevBtn', prevLeg);
    bindToolBtn('deckNextBtn', nextLeg);

    // Mouse Pan
    let isPan = false, pStartX = 0, pStartY = 0;
    canvas.onmousedown = (e) => {
      isPan = true;
      pStartX = e.clientX;
      pStartY = e.clientY;
      canvas.style.cursor = 'grabbing';
    };
    window.onmousemove = (e) => {
      if (!isPan) return;
      const dx = e.clientX - pStartX;
      const dy = e.clientY - pStartY;
      pStartX = e.clientX;
      pStartY = e.clientY;
      viewPanX += dx;
      viewPanY += dy;
      draw();
    };
    window.onmouseup = () => {
      isPan = false;
      canvas.style.cursor = 'grab';
    };

    // Wheel Zoom (anchored to cursor position)
    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;

      const factor = e.deltaY < 0 ? 1.15 : (1 / 1.15);
      const oldZoom = viewZoom;
      const newZoom = Math.max(0.05, Math.min(15.0, oldZoom * factor));
      if (newZoom === oldZoom) return;

      const scaleChange = newZoom / oldZoom;
      viewZoom = newZoom;
      const curX = targetScreenX + viewPanX;
      const curY = targetScreenY + viewPanY;
      viewPanX = (cx - targetScreenX) - (cx - curX) * scaleChange;
      viewPanY = (cy - targetScreenY) - (cy - curY) * scaleChange;
      draw();
    }, { passive: false });

    // Touch Handling (1-finger Pan, 2-finger Pinch Zoom anchored to pinch center)
    let isTouchPan = false;
    let touchStartDist = 0;
    let touchStartZoom = 1;
    let touchStartMidX = 0;
    let touchStartMidY = 0;
    let touchStartPanX = 0;
    let touchStartPanY = 0;

    canvas.addEventListener('touchstart', (e) => {
      if (e.touches.length === 1) {
        isTouchPan = true;
        pStartX = e.touches[0].clientX;
        pStartY = e.touches[0].clientY;
      } else if (e.touches.length === 2) {
        isTouchPan = false;
        touchStartDist = Math.hypot(
          e.touches[1].clientX - e.touches[0].clientX,
          e.touches[1].clientY - e.touches[0].clientY
        );
        touchStartZoom = viewZoom;
        touchStartPanX = viewPanX;
        touchStartPanY = viewPanY;

        const rect = canvas.getBoundingClientRect();
        touchStartMidX = (e.touches[0].clientX + e.touches[1].clientX) / 2 - rect.left;
        touchStartMidY = (e.touches[0].clientY + e.touches[1].clientY) / 2 - rect.top;
      }
    }, { passive: false });

    canvas.addEventListener('touchmove', (e) => {
      e.preventDefault();
      if (e.touches.length === 1 && isTouchPan) {
        const dx = e.touches[0].clientX - pStartX;
        const dy = e.touches[0].clientY - pStartY;
        pStartX = e.touches[0].clientX;
        pStartY = e.touches[0].clientY;
        viewPanX += dx;
        viewPanY += dy;
        draw();
      } else if (e.touches.length === 2 && touchStartDist > 0) {
        const distNow = Math.hypot(
          e.touches[1].clientX - e.touches[0].clientX,
          e.touches[1].clientY - e.touches[0].clientY
        );
        const factor = distNow / touchStartDist;
        const newZoom = Math.max(0.05, Math.min(15.0, touchStartZoom * factor));
        const scaleChange = newZoom / touchStartZoom;
        viewZoom = newZoom;

        const curX = targetScreenX + touchStartPanX;
        const curY = targetScreenY + touchStartPanY;
        viewPanX = (touchStartMidX - targetScreenX) - (touchStartMidX - curX) * scaleChange;
        viewPanY = (touchStartMidY - targetScreenY) - (touchStartMidY - curY) * scaleChange;
        draw();
      }
    }, { passive: false });

    canvas.addEventListener('touchend', (e) => {
      if (e.touches.length === 0) {
        isTouchPan = false;
        touchStartDist = 0;
      } else if (e.touches.length === 1) {
        isTouchPan = true;
        pStartX = e.touches[0].clientX;
        pStartY = e.touches[0].clientY;
        touchStartDist = 0;
      }
    });
  </script>
</body>
</html>`;
  }

  // Generate map image at selected quality/resolution
  async function getExportMapDataUrl(qualityOption) {
    if (!state.map.image) {
      return { dataUrl: state.map.dataUrl, width: state.map.width || 0, height: state.map.height || 0 };
    }

    // If stitched map source is available with multiple parts, render each at requested DPI scale and re-stitch!
    if (state.map.stitchedInfo && state.map.stitchedInfo.isStitched && state.map.stitchedInfo.parts && state.map.stitchedInfo.parts.length > 1) {
      try {
        let renderScale = 3.5; // High: ~252 DPI
        if (qualityOption === 'ultra') {
          renderScale = 5.0; // Ultra: ~360-400 DPI
        } else if (qualityOption === 'jpg-compact') {
          renderScale = 2.5; // Compact: ~180 DPI
        }

        const renderedParts = [];
        for (const p of state.map.stitchedInfo.parts) {
          if (p.type === 'pdf' && p.pdfBytes && window.pdfjsLib) {
            const pdf = await window.pdfjsLib.getDocument({ data: p.pdfBytes }).promise;
            const page = await pdf.getPage(p.pageNum);
            const viewport = page.getViewport({ scale: renderScale });
            const offCanvas = document.createElement('canvas');
            offCanvas.width = viewport.width;
            offCanvas.height = viewport.height;
            const offCtx = offCanvas.getContext('2d');
            await page.render({ canvasContext: offCtx, viewport: viewport }).promise;
            renderedParts.push({
              name: p.name,
              type: 'pdf',
              canvas: offCanvas,
              width: viewport.width,
              height: viewport.height
            });
          } else {
            renderedParts.push(p);
          }
        }

        const stitched = stitchCanvases(renderedParts, state.map.stitchedInfo.layout);
        if (stitched) {
          if (qualityOption === 'jpg-high' || qualityOption === 'jpg-compact') {
            const q = qualityOption === 'jpg-high' ? 0.92 : 0.80;
            return {
              dataUrl: stitched.canvas.toDataURL('image/jpeg', q),
              width: stitched.width,
              height: stitched.height
            };
          }
          return {
            dataUrl: stitched.dataUrl,
            width: stitched.width,
            height: stitched.height
          };
        }
      } catch (err) {
        console.warn('Stitched map quality render error, falling back to cached map:', err);
      }
    }

    // If PDF source is available, render at requested DPI scale
    if (state.map.pdfBytes && window.pdfjsLib) {
      try {
        let renderScale = 3.5; // High: ~252 DPI
        if (qualityOption === 'ultra') {
          renderScale = 5.0; // Ultra: ~360-400 DPI
        } else if (qualityOption === 'jpg-compact') {
          renderScale = 2.5; // Compact: ~180 DPI
        }

        const pdf = await window.pdfjsLib.getDocument({ data: state.map.pdfBytes }).promise;
        const page = await pdf.getPage(1);
        const viewport = page.getViewport({ scale: renderScale });
        const offCanvas = document.createElement('canvas');
        offCanvas.width = viewport.width;
        offCanvas.height = viewport.height;
        const offCtx = offCanvas.getContext('2d');
        await page.render({ canvasContext: offCtx, viewport: viewport }).promise;

        if (qualityOption === 'jpg-high' || qualityOption === 'jpg-compact') {
          const q = qualityOption === 'jpg-high' ? 0.92 : 0.80;
          return {
            dataUrl: offCanvas.toDataURL('image/jpeg', q),
            width: viewport.width,
            height: viewport.height
          };
        }
        return {
          dataUrl: offCanvas.toDataURL('image/png'),
          width: viewport.width,
          height: viewport.height
        };
      } catch (err) {
        console.warn('PDF quality render error, falling back to cached map:', err);
      }
    }

    // For raster images (or PDF fallback), convert to optimized JPEG if requested
    const naturalW = state.map.image.naturalWidth || state.map.width;
    const naturalH = state.map.image.naturalHeight || state.map.height;

    if (qualityOption === 'jpg-high' || qualityOption === 'jpg-compact') {
      try {
        const q = qualityOption === 'jpg-high' ? 0.92 : 0.80;
        const offCanvas = document.createElement('canvas');
        offCanvas.width = naturalW;
        offCanvas.height = naturalH;
        const offCtx = offCanvas.getContext('2d');
        offCtx.fillStyle = '#ffffff';
        offCtx.fillRect(0, 0, naturalW, naturalH);
        offCtx.drawImage(state.map.image, 0, 0, naturalW, naturalH);
        return {
          dataUrl: offCanvas.toDataURL('image/jpeg', q),
          width: naturalW,
          height: naturalH
        };
      } catch (err) {
        console.warn('JPEG compression error, using original map:', err);
      }
    }

    // Default 'high' or 'ultra' on raster image: return current lossless dataUrl
    return {
      dataUrl: state.map.dataUrl,
      width: naturalW,
      height: naturalH
    };
  }

  // --- 1. DOWNLOAD LOCAL PRESENTATION & MAP ---
  confirmExportBtn.addEventListener('click', async () => {
    const config = getExportConfig();
    if (!config) return;

    const originalBtnHtml = confirmExportBtn.innerHTML;
    confirmExportBtn.disabled = true;
    confirmExportBtn.innerHTML = '<span>Rendering Map...</span>';

    try {
      // Get map image at requested quality and its actual pixel dimensions
      const exportMap = await getExportMapDataUrl(config.mapQuality);

      // Embed map image directly into the HTML (self-contained) with normalized coordinate scaling
      const htmlContent = buildPresentationHtml(config, exportMap.dataUrl, exportMap.width, exportMap.height);

      // Download single self-contained HTML file
      const blob = new Blob([htmlContent], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = (config.title ? config.title.replace(/[^a-zA-Z0-9_\-]+/g, '_') : 'routechoice_presentation') + '.html';
      a.click();
      URL.revokeObjectURL(url);

      closeExportModal();
    } catch (err) {
      console.error('Export Error:', err);
      alert('Failed to generate presentation: ' + err.message);
    } finally {
      confirmExportBtn.disabled = false;
      confirmExportBtn.innerHTML = originalBtnHtml;
    }
  });

  // --- 2. GITHUB PAGES PUBLISH & EMBED CODE ---
  const exportTabDownload = document.getElementById('exportTabDownload');
  const exportTabGitHub = document.getElementById('exportTabGitHub');
  const tabContentDownload = document.getElementById('tabContentDownload');
  const tabContentGitHub = document.getElementById('tabContentGitHub');
  const cancelExportModalBtn2 = document.getElementById('cancelExportModalBtn2');

  const ghUsernameInput = document.getElementById('ghUsernameInput');
  const ghRepoInput = document.getElementById('ghRepoInput');
  const ghTokenInput = document.getElementById('ghTokenInput');
  const ghSaveCredsCheckbox = document.getElementById('ghSaveCredsCheckbox');
  const ghClearCredsBtn = document.getElementById('ghClearCredsBtn');
  const ghStatusBox = document.getElementById('ghStatusBox');
  const ghResultBox = document.getElementById('ghResultBox');
  const ghLiveLink = document.getElementById('ghLiveLink');
  const ghEmbedCodeArea = document.getElementById('ghEmbedCodeArea');
  const ghCopyEmbedBtn = document.getElementById('ghCopyEmbedBtn');
  const ghCopyBtnText = document.getElementById('ghCopyBtnText');
  const ghPublishBtn = document.getElementById('ghPublishBtn');

  // Tab switching
  if (exportTabDownload && exportTabGitHub) {
    exportTabDownload.addEventListener('click', () => {
      tabContentDownload.classList.remove('hidden');
      tabContentGitHub.classList.add('hidden');
      exportTabDownload.classList.add('bg-white', 'text-slate-800', 'shadow-sm');
      exportTabDownload.classList.remove('text-slate-500');
      exportTabGitHub.classList.remove('bg-white', 'text-slate-800', 'shadow-sm');
      exportTabGitHub.classList.add('text-slate-500');
    });

    exportTabGitHub.addEventListener('click', () => {
      tabContentGitHub.classList.remove('hidden');
      tabContentDownload.classList.add('hidden');
      exportTabGitHub.classList.add('bg-white', 'text-slate-800', 'shadow-sm');
      exportTabGitHub.classList.remove('text-slate-500');
      exportTabDownload.classList.remove('bg-white', 'text-slate-800', 'shadow-sm');
      exportTabDownload.classList.add('text-slate-500');
    });
  }

  if (cancelExportModalBtn2) {
    cancelExportModalBtn2.addEventListener('click', closeExportModal);
  }

  // Credentials load / clear
  function loadSavedGhCreds() {
    try {
      const saved = localStorage.getItem('sprint_rc_gh_creds');
      if (saved) {
        const creds = JSON.parse(saved);
        if (creds.username && ghUsernameInput) ghUsernameInput.value = creds.username;
        if (creds.repo && ghRepoInput) ghRepoInput.value = creds.repo;
        if (creds.token && ghTokenInput) ghTokenInput.value = creds.token;
      }
    } catch (e) {}
  }

  if (ghClearCredsBtn) {
    ghClearCredsBtn.addEventListener('click', () => {
      localStorage.removeItem('sprint_rc_gh_creds');
      if (ghUsernameInput) ghUsernameInput.value = '';
      if (ghRepoInput) ghRepoInput.value = '';
      if (ghTokenInput) ghTokenInput.value = '';
      alert('Saved GitHub credentials cleared.');
    });
  }

  // Copy embed code
  if (ghCopyEmbedBtn && ghEmbedCodeArea) {
    ghCopyEmbedBtn.addEventListener('click', () => {
      if (!ghEmbedCodeArea.value) return;
      navigator.clipboard.writeText(ghEmbedCodeArea.value).then(() => {
        if (ghCopyBtnText) ghCopyBtnText.textContent = 'Copied!';
        setTimeout(() => {
          if (ghCopyBtnText) ghCopyBtnText.textContent = 'Copy Embed Code';
        }, 2500);
      }).catch(() => {
        ghEmbedCodeArea.select();
        document.execCommand('copy');
        if (ghCopyBtnText) ghCopyBtnText.textContent = 'Copied!';
        setTimeout(() => {
          if (ghCopyBtnText) ghCopyBtnText.textContent = 'Copy Embed Code';
        }, 2500);
      });
    });
  }

  function setGhStatus(msg, type) {
    if (!ghStatusBox) return;
    ghStatusBox.classList.remove('hidden', 'bg-red-50', 'text-red-700', 'border-red-200', 'bg-blue-50', 'text-blue-700', 'border-blue-200', 'bg-emerald-50', 'text-emerald-700', 'border-emerald-200');
    ghStatusBox.classList.add('border');
    if (type === 'error') {
      ghStatusBox.classList.add('bg-red-50', 'text-red-700', 'border-red-200');
    } else if (type === 'success') {
      ghStatusBox.classList.add('bg-emerald-50', 'text-emerald-700', 'border-emerald-200');
    } else {
      ghStatusBox.classList.add('bg-blue-50', 'text-blue-700', 'border-blue-200');
    }
    ghStatusBox.textContent = msg;
  }

  async function uploadFileToGitHub({ username, repo, token, branch, path, base64Content, message }) {
    const url = `https://api.github.com/repos/${encodeURIComponent(username)}/${encodeURIComponent(repo)}/contents/${encodeURIComponent(path)}`;

    // Check if file already exists to obtain SHA for overwrite
    let sha = null;
    try {
      const getRes = await fetch(`${url}?ref=${encodeURIComponent(branch)}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/vnd.github+json'
        }
      });
      if (getRes.ok) {
        const getData = await getRes.json();
        sha = getData.sha;
      }
    } catch (e) {}

    const putRes = await fetch(url, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message,
        content: base64Content,
        sha: sha || undefined,
        branch
      })
    });

    if (!putRes.ok) {
      const errData = await putRes.json().catch(() => ({}));
      throw new Error(errData.message || `GitHub returned error ${putRes.status}`);
    }

    return await putRes.json();
  }

  // Publish to GitHub Button Handler
  if (ghPublishBtn) {
    ghPublishBtn.addEventListener('click', async () => {
      const config = getExportConfig();
      if (!config) return;

      const username = ghUsernameInput ? ghUsernameInput.value.trim() : '';
      const repo = ghRepoInput ? ghRepoInput.value.trim() : '';
      const token = ghTokenInput ? ghTokenInput.value.trim() : '';

      if (!username || !repo || !token) {
        setGhStatus('Please provide your GitHub Username, Repository Name, and Personal Access Token.', 'error');
        return;
      }

      if (ghSaveCredsCheckbox && ghSaveCredsCheckbox.checked) {
        localStorage.setItem('sprint_rc_gh_creds', JSON.stringify({ username, repo, token }));
      }

      ghPublishBtn.disabled = true;
      ghPublishBtn.classList.add('opacity-50', 'cursor-not-allowed');
      if (ghResultBox) ghResultBox.classList.add('hidden');

      try {
        setGhStatus('Step 1/3: Checking repository on GitHub...', 'info');

        // Check repository & get default branch
        const repoRes = await fetch(`https://api.github.com/repos/${encodeURIComponent(username)}/${encodeURIComponent(repo)}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/vnd.github+json'
          }
        });

        if (repoRes.status === 401) {
          throw new Error('Invalid Personal Access Token. Please verify your token has "repo" permissions.');
        }
        if (repoRes.status === 404) {
          throw new Error(`Repository "${username}/${repo}" not found. Please create it on GitHub first.`);
        }
        if (!repoRes.ok) {
          const errData = await repoRes.json().catch(() => ({}));
          throw new Error(errData.message || `GitHub error (${repoRes.status})`);
        }

        const repoData = await repoRes.json();
        const branch = repoData.default_branch || 'main';

        const slug = (config.title || 'routechoice_presentation').toLowerCase().replace(/[^a-z0-9_\-]+/g, '_');
        const htmlFileName = `${slug}.html`;

        // Generate and upload self-contained HTML presentation
        setGhStatus(`Preparing map and presentation (${htmlFileName})...`, 'info');
        const exportMap = await getExportMapDataUrl(config.mapQuality);
        const htmlContent = buildPresentationHtml(config, exportMap.dataUrl, exportMap.width, exportMap.height);
        const htmlBase64 = window.btoa(unescape(encodeURIComponent(htmlContent)));

        await uploadFileToGitHub({
          username,
          repo,
          token,
          branch,
          path: htmlFileName,
          base64Content: htmlBase64,
          message: `Publish ${config.title} via Sprint RC Analyser`
        });

        const liveUrl = `https://${username}.github.io/${repo}/${htmlFileName}`;
        const cacheBustedUrl = `${liveUrl}?v=${Date.now()}`;
        const embedCode = `<iframe src="${liveUrl}" width="97%" height="600px" style="border: 1px solid #334155; border-radius: 12px; margin: 0 auto; display: block;" allowfullscreen="true" allow="fullscreen"></iframe>`;

        setGhStatus('🎉 Successfully published to GitHub Pages! (Note: GitHub takes ~30–60s to rebuild; link below includes cache-bypass)', 'success');
        if (ghLiveLink) ghLiveLink.href = cacheBustedUrl;
        if (ghEmbedCodeArea) ghEmbedCodeArea.value = embedCode;
        if (ghResultBox) ghResultBox.classList.remove('hidden');

      } catch (err) {
        console.error('GitHub Publish Error:', err);
        setGhStatus('Error publishing: ' + err.message, 'error');
      } finally {
        ghPublishBtn.disabled = false;
        ghPublishBtn.classList.remove('opacity-50', 'cursor-not-allowed');
      }
    });
  }

  // --- 3. PULL / IMPORT PRESENTATION FROM GITHUB ---
  const pullGhBtnStep1 = document.getElementById('pullGhBtnStep1');
  const pullGhBtnStep3 = document.getElementById('pullGhBtnStep3');
  const pullGitHubModal = document.getElementById('pullGitHubModal');
  const closePullGitHubModalBtn = document.getElementById('closePullGitHubModalBtn');
  const ghRefreshRepoBtn = document.getElementById('ghRefreshRepoBtn');
  const ghRepoStatusMsg = document.getElementById('ghRepoStatusMsg');
  const ghFilesListContainer = document.getElementById('ghFilesListContainer');
  const ghDirectUrlInput = document.getElementById('ghDirectUrlInput');
  const ghFetchUrlBtn = document.getElementById('ghFetchUrlBtn');
  const ghPullStatusBox = document.getElementById('ghPullStatusBox');
  const ghPullUsernameInput = document.getElementById('ghPullUsernameInput');
  const ghPullRepoInput = document.getElementById('ghPullRepoInput');
  const ghPullTokenInput = document.getElementById('ghPullTokenInput');
  const ghSavePullCredsBtn = document.getElementById('ghSavePullCredsBtn');

  function openPullGitHubModal() {
    if (!pullGitHubModal) return;
    pullGitHubModal.classList.remove('hidden');
    syncPullCredsFromStorage();
    fetchGitHubRepoFiles();
  }

  function closePullGitHubModal() {
    if (!pullGitHubModal) return;
    pullGitHubModal.classList.add('hidden');
    if (ghPullStatusBox) ghPullStatusBox.classList.add('hidden');
  }

  if (pullGhBtnStep1) pullGhBtnStep1.addEventListener('click', openPullGitHubModal);
  if (pullGhBtnStep3) pullGhBtnStep3.addEventListener('click', openPullGitHubModal);
  if (closePullGitHubModalBtn) closePullGitHubModalBtn.addEventListener('click', closePullGitHubModal);

  if (pullGitHubModal) {
    pullGitHubModal.addEventListener('click', (e) => {
      if (e.target === pullGitHubModal) closePullGitHubModal();
    });
  }

  function syncPullCredsFromStorage() {
    try {
      const saved = localStorage.getItem('sprint_rc_gh_creds');
      if (saved) {
        const creds = JSON.parse(saved);
        if (creds.username && ghPullUsernameInput) ghPullUsernameInput.value = creds.username;
        if (creds.repo && ghPullRepoInput) ghPullRepoInput.value = creds.repo;
        if (creds.token && ghPullTokenInput) ghPullTokenInput.value = creds.token;
      }
    } catch (e) {}
  }

  function getActiveGhCreds() {
    let username = ghPullUsernameInput ? ghPullUsernameInput.value.trim() : '';
    let repo = ghPullRepoInput ? ghPullRepoInput.value.trim() : '';
    let token = ghPullTokenInput ? ghPullTokenInput.value.trim() : '';

    if (!username || !repo) {
      try {
        const saved = localStorage.getItem('sprint_rc_gh_creds');
        if (saved) {
          const creds = JSON.parse(saved);
          username = username || creds.username || '';
          repo = repo || creds.repo || '';
          token = token || creds.token || '';
        }
      } catch (e) {}
    }
    return { username, repo, token };
  }

  if (ghSavePullCredsBtn) {
    ghSavePullCredsBtn.addEventListener('click', () => {
      const username = ghPullUsernameInput ? ghPullUsernameInput.value.trim() : '';
      const repo = ghPullRepoInput ? ghPullRepoInput.value.trim() : '';
      const token = ghPullTokenInput ? ghPullTokenInput.value.trim() : '';
      localStorage.setItem('sprint_rc_gh_creds', JSON.stringify({ username, repo, token }));
      if (ghUsernameInput) ghUsernameInput.value = username;
      if (ghRepoInput) ghRepoInput.value = repo;
      if (ghTokenInput) ghTokenInput.value = token;
      fetchGitHubRepoFiles();
    });
  }

  if (ghRefreshRepoBtn) {
    ghRefreshRepoBtn.addEventListener('click', fetchGitHubRepoFiles);
  }

  function setPullStatus(msg, type) {
    if (!ghPullStatusBox) return;
    ghPullStatusBox.classList.remove('hidden', 'bg-red-50', 'text-red-700', 'border-red-200', 'bg-blue-50', 'text-blue-700', 'border-blue-200', 'bg-emerald-50', 'text-emerald-700', 'border-emerald-200');
    ghPullStatusBox.classList.add('border');
    if (type === 'error') {
      ghPullStatusBox.classList.add('bg-red-50', 'text-red-700', 'border-red-200');
    } else if (type === 'success') {
      ghPullStatusBox.classList.add('bg-emerald-50', 'text-emerald-700', 'border-emerald-200');
    } else {
      ghPullStatusBox.classList.add('bg-blue-50', 'text-blue-700', 'border-blue-200');
    }
    ghPullStatusBox.textContent = msg;
  }

  async function fetchGitHubRepoFiles() {
    if (!ghFilesListContainer || !ghRepoStatusMsg) return;
    ghFilesListContainer.innerHTML = '';
    const { username, repo, token } = getActiveGhCreds();

    if (!username || !repo) {
      ghRepoStatusMsg.textContent = 'Please enter your GitHub Username and Repository Name below.';
      const details = pullGitHubModal.querySelector('details');
      if (details) details.open = true;
      return;
    }

    ghRepoStatusMsg.textContent = `Scanning repository ${username}/${repo} for presentations...`;

    try {
      const url = `https://api.github.com/repos/${encodeURIComponent(username)}/${encodeURIComponent(repo)}/contents`;
      const headers = { 'Accept': 'application/vnd.github+json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(url, { headers });
      if (!res.ok) {
        if (res.status === 404) {
          throw new Error(`Repository "${username}/${repo}" not found or private (add token below).`);
        }
        if (res.status === 401) {
          throw new Error('Invalid token. Please update your token in settings below.');
        }
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || `GitHub error ${res.status}`);
      }

      const files = await res.json();
      if (!Array.isArray(files)) {
        throw new Error('Unexpected GitHub response format.');
      }

      const htmlFiles = files.filter(f => f.type === 'file' && /\.html?$/i.test(f.name));

      if (htmlFiles.length === 0) {
        ghRepoStatusMsg.textContent = `Connected to ${username}/${repo} — No .html presentation files found in the root directory.`;
        return;
      }

      ghRepoStatusMsg.textContent = `Found ${htmlFiles.length} presentation(s) in ${username}/${repo}:`;

      htmlFiles.forEach((file) => {
        const item = document.createElement('div');
        item.className = 'flex items-center justify-between p-2.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 transition-colors text-xs';
        
        const sizeKb = file.size ? (file.size > 1024 * 1024 ? (file.size / (1024 * 1024)).toFixed(1) + ' MB' : (file.size / 1024).toFixed(0) + ' KB') : '';

        item.innerHTML = `
          <div class="flex items-center gap-2 min-w-0 pr-2">
            <svg class="w-4 h-4 text-purple-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
            <span class="font-semibold text-slate-800 truncate" title="${file.name}">${file.name}</span>
            ${sizeKb ? `<span class="text-[10px] text-slate-400 shrink-0">(${sizeKb})</span>` : ''}
          </div>
          <button class="gh-load-file-btn shrink-0 py-1 px-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer shadow-xs">
            Load & Edit
          </button>
        `;

        const btn = item.querySelector('.gh-load-file-btn');
        btn.onclick = async () => {
          btn.disabled = true;
          btn.textContent = 'Loading...';
          setPullStatus(`Downloading "${file.name}" from GitHub...`, 'info');
          try {
            const content = await fetchFileContentFromGitHub({
              username,
              repo,
              token,
              path: file.path,
              directUrl: file.download_url
            });
            const project = parseProjectFromText(content, file.name);
            applyLoadedProject(project);
            closePullGitHubModal();
          } catch (err) {
            console.error('Failed to load file from GitHub:', err);
            setPullStatus('Failed to load: ' + err.message, 'error');
            btn.disabled = false;
            btn.textContent = 'Load & Edit';
          }
        };

        ghFilesListContainer.appendChild(item);
      });

    } catch (err) {
      console.warn('GitHub list files error:', err);
      ghRepoStatusMsg.textContent = 'Could not load files: ' + err.message;
      const details = pullGitHubModal.querySelector('details');
      if (details) details.open = true;
    }
  }

  function parseGitHubUrl(urlStr) {
    try {
      const url = new URL(urlStr.trim());
      // 1. Pages: username.github.io/repo/filename.html
      if (url.hostname.endsWith('.github.io')) {
        const username = url.hostname.replace('.github.io', '');
        const pathParts = url.pathname.split('/').filter(Boolean);
        const repo = pathParts[0] || '';
        const filePath = pathParts.slice(1).join('/');
        return { username, repo, filePath };
      }
      // 2. github.com/username/repo/blob/branch/filename.html
      if (url.hostname === 'github.com') {
        const pathParts = url.pathname.split('/').filter(Boolean);
        if (pathParts.length >= 4 && (pathParts[2] === 'blob' || pathParts[2] === 'raw')) {
          const username = pathParts[0];
          const repo = pathParts[1];
          const filePath = pathParts.slice(4).join('/');
          return { username, repo, filePath };
        }
      }
      // 3. raw.githubusercontent.com/username/repo/branch/filename.html
      if (url.hostname === 'raw.githubusercontent.com') {
        const pathParts = url.pathname.split('/').filter(Boolean);
        if (pathParts.length >= 3) {
          const username = pathParts[0];
          const repo = pathParts[1];
          const filePath = pathParts.slice(3).join('/');
          return { username, repo, filePath };
        }
      }
    } catch (e) {}
    return null;
  }

  async function fetchFileContentFromGitHub({ username, repo, token, path, directUrl }) {
    // Attempt 1: Fetch via GitHub Contents API
    if (username && repo && path) {
      try {
        const apiUrl = `https://api.github.com/repos/${encodeURIComponent(username)}/${encodeURIComponent(repo)}/contents/${encodeURIComponent(path)}`;
        const headers = { 'Accept': 'application/vnd.github+json' };
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const res = await fetch(apiUrl, { headers });
        if (res.ok) {
          const data = await res.json();
          if (data.content && data.encoding === 'base64') {
            const binary = window.atob(data.content.replace(/\s/g, ''));
            const bytes = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
            return new TextDecoder('utf-8').decode(bytes);
          } else if (data.download_url) {
            const rawRes = await fetch(data.download_url, token ? { headers: { 'Authorization': `Bearer ${token}` } } : {});
            if (rawRes.ok) return await rawRes.text();
          }
        }
      } catch (err) {
        console.warn('API content fetch attempt failed:', err);
      }
    }

    // Attempt 2: Direct URL fetch
    if (directUrl) {
      const res = await fetch(directUrl);
      if (!res.ok) throw new Error(`HTTP Error ${res.status} when fetching URL`);
      return await res.text();
    }

    throw new Error('Unable to retrieve file from GitHub. Check your repository name and token.');
  }

  if (ghFetchUrlBtn && ghDirectUrlInput) {
    ghFetchUrlBtn.addEventListener('click', async () => {
      const inputUrl = ghDirectUrlInput.value.trim();
      if (!inputUrl) {
        setPullStatus('Please enter a GitHub URL.', 'error');
        return;
      }

      ghFetchUrlBtn.disabled = true;
      ghFetchUrlBtn.textContent = 'Loading...';
      setPullStatus('Fetching presentation from URL...', 'info');

      try {
        const parsed = parseGitHubUrl(inputUrl);
        const { token } = getActiveGhCreds();
        let content = '';

        if (parsed && parsed.username && parsed.repo && parsed.filePath) {
          content = await fetchFileContentFromGitHub({
            username: parsed.username,
            repo: parsed.repo,
            token,
            path: parsed.filePath,
            directUrl: inputUrl
          });
        } else {
          content = await fetchFileContentFromGitHub({ directUrl: inputUrl });
        }

        const project = parseProjectFromText(content, inputUrl);
        applyLoadedProject(project);
        closePullGitHubModal();
      } catch (err) {
        console.error('Failed to load from URL:', err);
        setPullStatus('Failed to load presentation: ' + err.message, 'error');
      } finally {
        ghFetchUrlBtn.disabled = false;
        ghFetchUrlBtn.textContent = 'Load & Edit';
      }
    });
  }

  // --- INITIALIZATION ---
  resizeCanvas();
  render();

})();
