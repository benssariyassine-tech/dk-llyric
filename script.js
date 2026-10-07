/* ============================================================
   dk.llyric Editor — Canvas Edition (Preview + Export = Same Render)
   ============================================================ */

const DESIGN_W = 360;
const DESIGN_H = 640;
const PX_PER_SEC = 30;
const LONG_PRESS_MS = 600;

const state = {
  audioUrl: null,
  duration: 0,
  audioStart: 0,
  audioEnd: 15,
  trimIn: 0,
  trimOut: 15,
  currentTime: 0,
  isPlaying: false,
  songName: '',
  artistName: '',
  igName: 'dk.llyric',
  bgImg: null,
  coverImg: null,
  bgFilters: { blur: 0, bright: 100, sat: 100, con: 100, op: 100 },
  card: { scale: 1, opacity: 0.65, radius: 26, coverSize: 68 },
  font: { family: 'Cairo', size: 28, color: '#ffffff' },
  lyrics: [
    { text: 'كلمات الأغنية هنا', start: 0, duration: 4 },
    { text: 'السطر الثاني', start: 4, duration: 4 }
  ],
  selected: { type: null, index: -1 }
};

let currentTab = null;
let previewCanvas = null;
let previewCtx = null;
let renderRAF = null;
let _resize = null;
let _lpTimer = null;

const $ = function(id) { return document.getElementById(id); };
const clamp = function(v, a, b) { return Math.max(a, Math.min(b, v)); };
const round1 = function(v) { return Math.round(v * 10) / 10; };
const fmtTime = function(s) {
  s = Math.max(0, Math.floor(s));
  return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
};

/* ============================================================
   INIT
   ============================================================ */
document.addEventListener('DOMContentLoaded', function() {
  setupCanvas();
  bindAudio();
  bindSliders();
  bindFontButtons();
  bindColorButtons();
  bindTextInputs();
  bindUploads();
  bindAudioSegment();
  setupTimelineClick();
  setupPlayheadDrag();
  bindExportOptions();
  renderLyricsList();
  renderTimeline();
  renderRuler();
  updateTimeDisplay();
  startRenderLoop();
});

/* ============================================================
   CANVAS SETUP
   ============================================================ */
function setupCanvas() {
  previewCanvas = $('previewCanvas');
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  previewCanvas.width = DESIGN_W * dpr;
  previewCanvas.height = DESIGN_H * dpr;
  previewCtx = previewCanvas.getContext('2d');
  previewCtx.scale(dpr, dpr);
}

function startRenderLoop() {
  function loop() {
    drawFrame(previewCtx, DESIGN_W, DESIGN_H, state.currentTime);
    renderRAF = requestAnimationFrame(loop);
  }
  loop();
}

/* ============================================================
   ⭐ drawFrame — المصدر الوحيد للحقيقة
   ============================================================ */
function drawFrame(ctx, W, H, t) {
  const s = W / DESIGN_W;

  // 1. الخلفية
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);

  if (state.bgImg) {
    ctx.save();
    applyFilters(ctx, state.bgFilters);
    ctx.globalAlpha = state.bgFilters.op / 100;
    drawCover(ctx, state.bgImg, 0, 0, W, H);
    ctx.restore();
  }

  // 2. البطاقة
  const cardW = 320 * s * state.card.scale;
  const cardH = cardW;
  const cardX = (W - cardW) / 2;
  const cardY = (H - cardH) / 2;
  const radius = state.card.radius * s;

  // Glass effect
  if (state.bgImg) {
    ctx.save();
    roundRect(ctx, cardX, cardY, cardW, cardH, radius);
    ctx.clip();
    const gf = Object.assign({}, state.bgFilters, { blur: Math.max(20, state.bgFilters.blur) });
    applyFilters(ctx, gf);
    ctx.globalAlpha = 0.6;
    drawCover(ctx, state.bgImg, 0, 0, W, H);
    ctx.restore();
  }

  // Tint
  ctx.save();
  ctx.fillStyle = 'rgba(15,15,15,' + state.card.opacity + ')';
  roundRect(ctx, cardX, cardY, cardW, cardH, radius);
  ctx.fill();
  ctx.restore();

  // Border
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.lineWidth = 1 * s;
  roundRect(ctx, cardX, cardY, cardW, cardH, radius);
  ctx.stroke();
  ctx.restore();

  const padX = 22 * s;
  const padY = 20 * s;

  // 3. الغلاف
  const artSize = state.card.coverSize * s * state.card.scale;
  const artX = cardX + cardW - padX - artSize;
  const artY = cardY + padY;
  const artR = 10 * s;

  if (state.coverImg) {
    ctx.save();
    roundRect(ctx, artX, artY, artSize, artSize, artR);
    ctx.clip();
    drawCover(ctx, state.coverImg, artX, artY, artSize, artSize);
    ctx.restore();
  } else {
    ctx.save();
    ctx.fillStyle = '#1a1a24';
    roundRect(ctx, artX, artY, artSize, artSize, artR);
    ctx.fill();
    ctx.restore();
  }

  // 4. اسم الأغنية + الفنان
  const textRight = artX - 14 * s;
  ctx.save();
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  if (state.songName) {
    ctx.fillStyle = '#fff';
    ctx.font = '700 ' + (18 * s) + 'px Cairo, Inter, sans-serif';
    ctx.fillText(state.songName, textRight, artY + artSize * 0.35);
  }
  if (state.artistName) {
    ctx.fillStyle = '#b3b3b3';
    ctx.font = '500 ' + (14 * s) + 'px Cairo, Inter, sans-serif';
    ctx.fillText(state.artistName, textRight, artY + artSize * 0.7);
  }
  ctx.restore();

  // 5. Divider 1
  const gap = 16 * s;
  const div1Y = artY + artSize + gap;
  drawDivider(ctx, cardX + padX, div1Y, cardW - padX * 2, s);

  // 6. الكلمات
  const footerH = 20 * s;
  const div2Y = cardY + cardH - padY - footerH - gap;
  const lyricsCenter = (div1Y + div2Y) / 2;

  const idx = findActiveLyric(t);
  let prev = '';
  let curr = '...';
  let next = '';

  if (idx >= 0) {
    prev = idx > 0 ? (state.lyrics[idx - 1].text || '') : '';
    curr = state.lyrics[idx].text || '...';
    next = idx < state.lyrics.length - 1 ? (state.lyrics[idx + 1].text || '') : '';
  } else if (state.lyrics.length > 0 && state.lyrics[0].text) {
    curr = state.lyrics[0].text;
    next = state.lyrics[1] ? (state.lyrics[1].text || '') : '';
  }

  const fontSize = state.font.size * s * state.card.scale;
  const smallSize = 15 * s * state.card.scale;
  const font = state.font.family + ', Cairo, Inter, sans-serif';
  const cx = cardX + cardW / 2;

  if (prev) {
    ctx.save();
    ctx.globalAlpha = 0.4;
    ctx.fillStyle = '#fff';
    ctx.font = '500 ' + smallSize + 'px ' + font;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(prev, cx, lyricsCenter - fontSize * 1.4);
    ctx.restore();
  }

  ctx.save();
  ctx.fillStyle = state.font.color;
  ctx.font = '700 ' + fontSize + 'px ' + font;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(0,0,0,0.5)';
  ctx.shadowBlur = 20 * s;
  ctx.fillText(curr, cx, lyricsCenter);
  ctx.restore();

  if (next) {
    ctx.save();
    ctx.globalAlpha = 0.4;
    ctx.fillStyle = '#fff';
    ctx.font = '500 ' + smallSize + 'px ' + font;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(next, cx, lyricsCenter + fontSize * 1.4);
    ctx.restore();
  }

  // 7. Divider 2
  drawDivider(ctx, cardX + padX, div2Y, cardW - padX * 2, s);

  // 8. Footer
  const footerY = cardY + cardH - padY - footerH / 2;
  const iconSize = 18 * s;
  const igX = cardX + padX;

  ctx.save();
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 1.5 * s;
  roundRect(ctx, igX, footerY - iconSize / 2, iconSize, iconSize, iconSize * 0.28);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(igX + iconSize / 2, footerY, iconSize * 0.22, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(igX + iconSize * 0.72, footerY - iconSize * 0.22, iconSize * 0.06, 0, Math.PI * 2);
  ctx.fillStyle = '#fff';
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.fillStyle = '#fff';
  ctx.font = '500 ' + (14 * s) + 'px Inter, Cairo, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(state.igName, igX + iconSize + 6 * s, footerY);
  ctx.restore();
}

/* ============================================================
   Canvas utilities
   ============================================================ */
function roundRect(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function drawCover(ctx, img, dx, dy, dw, dh) {
  if (!img || !img.naturalWidth || !img.naturalHeight) return;
  const ir = img.naturalWidth / img.naturalHeight;
  const cr = dw / dh;
  let w, h, x, y;
  if (ir > cr) {
    h = dh; w = dh * ir; x = dx + (dw - w) / 2; y = dy;
  } else {
    w = dw; h = dw / ir; x = dx; y = dy + (dh - h) / 2;
  }
  ctx.drawImage(img, x, y, w, h);
}

function applyFilters(ctx, f) {
  if (typeof ctx.filter !== 'undefined') {
    try {
      ctx.filter = 'blur(' + f.blur + 'px) brightness(' + f.bright + '%) saturate(' + f.sat + '%) contrast(' + f.con + '%)';
    } catch (e) {}
  }
}

function drawDivider(ctx, x, y, w, s) {
  const g = ctx.createLinearGradient(x, 0, x + w, 0);
  g.addColorStop(0, 'rgba(180,180,190,0)');
  g.addColorStop(0.25, 'rgba(180,180,190,0.45)');
  g.addColorStop(0.5, 'rgba(220,220,230,0.65)');
  g.addColorStop(0.75, 'rgba(180,180,190,0.45)');
  g.addColorStop(1, 'rgba(180,180,190,0)');
  ctx.save();
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, Math.max(1, s));
  ctx.restore();
}

function findActiveLyric(t) {
  for (let i = 0; i < state.lyrics.length; i++) {
    const l = state.lyrics[i];
    if (t >= l.start && t < l.start + l.duration) return i;
  }
  return -1;
}

/* ============================================================
   Audio
   ============================================================ */
function bindAudio() {
  const input = $('audioInput');
  input.addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (!file) return;
    if (state.audioUrl) URL.revokeObjectURL(state.audioUrl);
    state.audioUrl = URL.createObjectURL(file);
    const player = $('audioPlayer');
    player.src = state.audioUrl;
    player.onloadedmetadata = function() {
      state.duration = player.duration;
      state.audioStart = 0;
      state.audioEnd = Math.min(player.duration, 30);
      state.trimIn = 0;
      state.trimOut = state.audioEnd;
      updateAudioSegmentUI();
      renderRuler();
      renderTimeline();
      updateTimeDisplay();
    };
    $('audioUploadBtn').classList.add('hidden');
    $('audioPreview').classList.remove('hidden');
    $('audioPreviewName').textContent = file.name;
    $('audioPreviewMeta').textContent = (file.size / 1024 / 1024).toFixed(1) + ' MB';
  });
}

function openAudioPicker() {
  $('audioInput').click();
}

function removeAudio() {
  if (state.audioUrl) URL.revokeObjectURL(state.audioUrl);
  state.audioUrl = null;
  state.duration = 0;
  state.audioEnd = 15;
  $('audioPlayer').src = '';
  $('audioUploadBtn').classList.remove('hidden');
  $('audioPreview').classList.add('hidden');
  $('audioSegment').classList.add('hidden');
  $('audioAddBtn').classList.remove('hidden');
  updateTimeDisplay();
  renderRuler();
}

function updateAudioSegmentUI() {
  const seg = $('audioSegment');
  seg.classList.remove('hidden');
  $('audioAddBtn').classList.add('hidden');
  seg.style.left = (state.audioStart * PX_PER_SEC) + 'px';
  seg.style.width = ((state.audioEnd - state.audioStart) * PX_PER_SEC) + 'px';
}

/* ============================================================
   Playback
   ============================================================ */
function togglePlay() {
  const el = $('audioPlayer');
  if (state.isPlaying) {
    el.pause();
    state.isPlaying = false;
    updatePlayIcon();
    return;
  }
  let startAt = state.currentTime;
  if (startAt < state.audioStart || startAt >= state.audioEnd - 0.05) startAt = state.audioStart;
  state.currentTime = startAt;
  seekPlayhead(startAt);
  if (state.audioUrl) {
    el.currentTime = state.trimIn + (startAt - state.audioStart);
    el.play().catch(function() {});
  }
  state.isPlaying = true;
  updatePlayIcon();
  playLoop();
}

function updatePlayIcon() {
  $('playIcon').innerHTML = state.isPlaying
    ? '<rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>'
    : '<polygon points="5 3 19 12 5 21 5 3"/>';
}

function playLoop() {
  if (!state.isPlaying) return;
  const el = $('audioPlayer');
  if (state.audioUrl && el && !el.paused) {
    const fileT = el.currentTime;
    state.currentTime = state.audioStart + (fileT - state.trimIn);
    if (fileT >= state.trimOut) {
      state.currentTime = state.audioEnd;
      el.pause();
      state.isPlaying = false;
      updatePlayIcon();
      seekPlayhead(state.audioEnd);
      updateTimeDisplay();
      return;
    }
  } else {
    state.currentTime += 0.016;
    if (state.currentTime >= state.audioEnd) {
      state.currentTime = state.audioEnd;
      state.isPlaying = false;
      updatePlayIcon();
    }
  }
  seekPlayhead(state.currentTime);
  updateTimeDisplay();
  requestAnimationFrame(playLoop);
}

function seekBy(delta) {
  const t = clamp(state.currentTime + delta, state.audioStart, state.audioEnd);
  state.currentTime = t;
  if (state.audioUrl) $('audioPlayer').currentTime = state.trimIn + (t - state.audioStart);
  seekPlayhead(t);
  updateTimeDisplay();
}

function updateTimeDisplay() {
  $('timeDisplay').textContent = fmtTime(state.currentTime) + ' / ' + fmtTime(state.audioEnd);
}

/* ============================================================
   Timeline
   ============================================================ */
function getTimelineDuration() {
  const last = state.lyrics.reduce(function(m, l) { return Math.max(m, l.start + l.duration); }, 0);
  return Math.max(state.audioEnd, last, 15);
}

function renderRuler() {
  const r = $('timelineRuler');
  const total = getTimelineDuration();
  r.innerHTML = '';
  r.style.width = (total * PX_PER_SEC) + 'px';
  for (let s = 0; s <= total; s++) {
    const tick = document.createElement('div');
    tick.className = 'ruler-tick';
    tick.style.left = (s * PX_PER_SEC) + 'px';
    tick.innerHTML = '<span>' + s + 's</span><i></i>';
    r.appendChild(tick);
  }
  $('timelineContent').style.width = (total * PX_PER_SEC + 60) + 'px';
}

function renderTimeline() {
  const t = $('trackText');
  t.innerHTML = '';
  t.style.width = (getTimelineDuration() * PX_PER_SEC) + 'px';

  state.lyrics.forEach(function(l, i) {
    const seg = document.createElement('div');
    seg.className = 'text-segment';
    if (state.selected.type === 'text' && state.selected.index === i) seg.classList.add('selected');
    seg.style.left = (l.start * PX_PER_SEC) + 'px';
    seg.style.width = (l.duration * PX_PER_SEC) + 'px';
    seg.textContent = l.text || ('السطر ' + (i + 1));

    const hL = document.createElement('div');
    hL.className = 'seg-handle handle-left';
    hL.addEventListener('mousedown', function(e) {
      state.selected = { type: 'text', index: i };
      startResize(e, i, 'left');
    });
    hL.addEventListener('touchstart', function(e) {
      state.selected = { type: 'text', index: i };
      startResize(e, i, 'left');
    }, { passive: false });
    seg.appendChild(hL);

    const hR = document.createElement('div');
    hR.className = 'seg-handle handle-right';
    hR.addEventListener('mousedown', function(e) {
      state.selected = { type: 'text', index: i };
      startResize(e, i, 'right');
    });
    hR.addEventListener('touchstart', function(e) {
      state.selected = { type: 'text', index: i };
      startResize(e, i, 'right');
    }, { passive: false });
    seg.appendChild(hR);

    seg.addEventListener('click', function(e) {
      if (e.target.classList.contains('seg-handle')) return;
      selectText(i);
    });

    seg.addEventListener('mousedown', function(e) {
      if (!e.target.classList.contains('seg-handle')) startLongPress(e, i, seg);
    });
    seg.addEventListener('touchstart', function(e) {
      if (!e.target.classList.contains('seg-handle')) startLongPress(e, i, seg);
    }, { passive: true });

    t.appendChild(seg);
  });
}

function selectText(i) {
  state.selected = { type: 'text', index: i };
  renderTimeline();
  showCapcutMenu();
  if (navigator.vibrate) try { navigator.vibrate(10); } catch (e) {}
}

function clearSelection() {
  state.selected = { type: null, index: -1 };
  renderTimeline();
  hideCapcutMenu();
}

/* ============================================================
   Drag / Resize
   ============================================================ */
function startResize(e, index, side) {
  e.preventDefault();
  e.stopPropagation();
  const cx = e.touches ? e.touches[0].clientX : e.clientX;
  const l = state.lyrics[index];
  _resize = {
    index: index,
    side: side,
    startX: cx,
    startStart: l.start,
    startDur: l.duration
  };

  function move(ev) { onResizeMove(ev); }
  function end() {
    document.removeEventListener('mousemove', move);
    document.removeEventListener('mouseup', end);
    document.removeEventListener('touchmove', move);
    document.removeEventListener('touchend', end);
    _resize = null;
    renderRuler();
    renderTimeline();
  }

  document.addEventListener('mousemove', move);
  document.addEventListener('mouseup', end);
  document.addEventListener('touchmove', move, { passive: false });
  document.addEventListener('touchend', end);
}

function onResizeMove(e) {
  if (!_resize) return;
  e.preventDefault();
  const cx = e.touches ? e.touches[0].clientX : e.clientX;
  const dx = (cx - _resize.startX) / PX_PER_SEC;
  const l = state.lyrics[_resize.index];

  if (_resize.side === 'right') {
    l.duration = Math.max(0.5, _resize.startDur + dx);
  } else {
    const ns = Math.max(0, _resize.startStart + dx);
    const diff = ns - _resize.startStart;
    l.start = round1(ns);
    l.duration = Math.max(0.5, _resize.startDur - diff);
  }
  renderTimeline();
}

function startLongPress(e, index, segEl) {
  const cx = e.touches ? e.touches[0].clientX : e.clientX;
  let cancelled = false;

  function cancelIfMove(ev) {
    const mx = ev.touches ? ev.touches[0].clientX : ev.clientX;
    if (Math.abs(mx - cx) > 8) {
      cancelled = true;
      clearTimeout(_lpTimer);
    }
  }

  document.addEventListener('mousemove', cancelIfMove, { passive: true });
  document.addEventListener('touchmove', cancelIfMove, { passive: true });

  _lpTimer = setTimeout(function() {
    if (cancelled) return;
    selectText(index);
    if (navigator.vibrate) try { navigator.vibrate(20); } catch (e) {}

    const startStart = state.lyrics[index].start;
    const startX = cx;

    function move(ev) {
      const mx = ev.touches ? ev.touches[0].clientX : ev.clientX;
      const dx = (mx - startX) / PX_PER_SEC;
      state.lyrics[index].start = round1(Math.max(0, startStart + dx));
      renderTimeline();
    }
    function end() {
      document.removeEventListener('mousemove', move);
      document.removeEventListener('mouseup', end);
      document.removeEventListener('touchmove', move);
      document.removeEventListener('touchend', end);
      renderRuler();
    }
    document.addEventListener('mousemove', move);
    document.addEventListener('mouseup', end);
    document.addEventListener('touchmove', move, { passive: false });
    document.addEventListener('touchend', end);
  }, LONG_PRESS_MS);
}

/* ============================================================
   Playhead
   ============================================================ */
function seekPlayhead(sec) {
  $('playhead').style.transform = 'translateX(' + (sec * PX_PER_SEC) + 'px)';
}

function setupPlayheadDrag() {
  const ph = $('playhead');
  const content = $('timelineContent');
  let dragging = false;

  function pxToTime(cx) {
    const r = content.getBoundingClientRect();
    return Math.max(0, (cx - r.left) / PX_PER_SEC);
  }

  const cap = ph.querySelector('.playhead-cap');

  function onDown(e) {
    e.preventDefault();
    dragging = true;

    function start(ev) {
      if (!dragging) return;
      const cx = ev.touches ? ev.touches[0].clientX : ev.clientX;
      const t = clamp(pxToTime(cx), state.audioStart, state.audioEnd);
      state.currentTime = t;
      seekPlayhead(t);
      if (state.audioUrl) $('audioPlayer').currentTime = state.trimIn + (t - state.audioStart);
      updateTimeDisplay();
    }
    function end() {
      dragging = false;
      document.removeEventListener('mousemove', start);
      document.removeEventListener('mouseup', end);
      document.removeEventListener('touchmove', start);
      document.removeEventListener('touchend', end);
    }

    document.addEventListener('mousemove', start);
    document.addEventListener('mouseup', end);
    document.addEventListener('touchmove', start, { passive: false });
    document.addEventListener('touchend', end);
    start(e);
  }

  cap.addEventListener('mousedown', onDown);
  cap.addEventListener('touchstart', onDown, { passive: false });
}

function setupTimelineClick() {
  $('timelineViewport').addEventListener('click', function(e) {
    if (e.target.closest('.text-segment')) return;
    if (e.target.closest('.audio-segment')) return;
    if (e.target.closest('.seg-handle')) return;
    if (e.target.closest('.playhead-cap')) return;
    if (e.target.closest('.audio-add-btn')) return;
    const content = $('timelineContent');
    const r = content.getBoundingClientRect();
    const t = clamp(Math.max(0, (e.clientX - r.left) / PX_PER_SEC), state.audioStart, state.audioEnd);
    state.currentTime = t;
    seekPlayhead(t);
    if (state.audioUrl) $('audioPlayer').currentTime = state.trimIn + (t - state.audioStart);
    updateTimeDisplay();
  });
}

/* ============================================================
   Audio segment resize
   ============================================================ */
function bindAudioSegment() {
  const seg = $('audioSegment');
  seg.addEventListener('click', function(e) {
    if (e.target.classList.contains('seg-handle')) return;
    state.selected = { type: 'audio', index: -1 };
    renderTimeline();
    showCapcutMenu();
  });

  const hL = document.createElement('div');
  hL.className = 'seg-handle handle-left';
  hL.addEventListener('mousedown', function(e) { state.selected = { type: 'audio', index: -1 }; startAudioResize(e, 'left'); });
  hL.addEventListener('touchstart', function(e) { state.selected = { type: 'audio', index: -1 }; startAudioResize(e, 'left'); }, { passive: false });
  seg.appendChild(hL);

  const hR = document.createElement('div');
  hR.className = 'seg-handle handle-right';
  hR.addEventListener('mousedown', function(e) { state.selected = { type: 'audio', index: -1 }; startAudioResize(e, 'right'); });
  hR.addEventListener('touchstart', function(e) { state.selected = { type: 'audio', index: -1 }; startAudioResize(e, 'right'); }, { passive: false });
  seg.appendChild(hR);
}

function startAudioResize(e, side) {
  e.preventDefault();
  e.stopPropagation();
  const startX = e.touches ? e.touches[0].clientX : e.clientX;
  const snap = {
    startStart: state.audioStart,
    startEnd: state.audioEnd,
    trimIn: state.trimIn,
    trimOut: state.trimOut
  };

  function move(ev) {
    const cx = ev.touches ? ev.touches[0].clientX : ev.clientX;
    const dx = (cx - startX) / PX_PER_SEC;
    if (side === 'left') {
      let nt = snap.trimIn + dx;
      let ns = snap.startStart + dx;
      if (nt < 0) { ns -= nt; nt = 0; }
      if (nt > snap.trimOut - 0.5) { nt = snap.trimOut - 0.5; ns = snap.startStart + (nt - snap.trimIn); }
      state.trimIn = round1(nt);
      state.audioStart = round1(Math.max(0, ns));
      state.audioEnd = snap.startEnd;
      state.trimOut = snap.trimOut;
    } else {
      let nt = snap.trimOut + dx;
      if (nt > state.duration) nt = state.duration;
      if (nt < snap.trimIn + 0.5) nt = snap.trimIn + 0.5;
      state.trimOut = round1(nt);
      state.audioEnd = round1(state.audioStart + (nt - state.trimIn));
      state.audioStart = snap.startStart;
      state.trimIn = snap.trimIn;
    }
    updateAudioSegmentUI();
    renderRuler();
  }

  function end() {
    document.removeEventListener('mousemove', move);
    document.removeEventListener('mouseup', end);
    document.removeEventListener('touchmove', move);
    document.removeEventListener('touchend', end);
    updateTimeDisplay();
  }

  document.addEventListener('mousemove', move);
  document.addEventListener('mouseup', end);
  document.addEventListener('touchmove', move, { passive: false });
  document.addEventListener('touchend', end);
}

/* ============================================================
   Sheet / Tabs
   ============================================================ */
function openTab(name, btn) {
  if (currentTab === name) { closeSheet(); return; }
  currentTab = name;
  document.querySelectorAll('.editor-nav-item').forEach(function(el) { el.classList.remove('active'); });
  if (btn) btn.classList.add('active');
  document.querySelectorAll('.sheet-content').forEach(function(el) { el.classList.remove('active'); });
  const t = document.querySelector('[data-sheet="' + name + '"]');
  if (t) t.classList.add('active');
  $('bottomSheet').classList.add('open');
  $('sheetBackdrop').classList.add('open');
}

function closeSheet() {
  currentTab = null;
  document.querySelectorAll('.editor-nav-item').forEach(function(el) { el.classList.remove('active'); });
  $('bottomSheet').classList.remove('open');
  $('sheetBackdrop').classList.remove('open');
}

/* ============================================================
   Capcut menu
   ============================================================ */
function showCapcutMenu() {
  $('capcutMenu').classList.add('open');
  document.body.classList.add('menu-open');
}
function hideCapcutMenu() {
  $('capcutMenu').classList.remove('open');
  document.body.classList.remove('menu-open');
}

function cmAction(action) {
  if (action === 'delete') {
    if (state.selected.type === 'text' && state.selected.index >= 0) {
      if (state.lyrics.length <= 1) return;
      state.lyrics.splice(state.selected.index, 1);
      renderTimeline();
      renderLyricsList();
      renderRuler();
    } else if (state.selected.type === 'audio') {
      removeAudio();
    }
    clearSelection();
  } else if (action === 'split') {
    if (state.selected.type === 'text' && state.selected.index >= 0) {
      const i = state.selected.index;
      const l = state.lyrics[i];
      const t = state.currentTime;
      if (t > l.start && t < l.start + l.duration) {
        const first = { text: l.text, start: l.start, duration: round1(t - l.start) };
        const second = { text: l.text, start: round1(t), duration: round1(l.start + l.duration - t) };
        state.lyrics.splice(i, 1, first, second);
        renderTimeline();
        renderLyricsList();
        renderRuler();
      }
    }
    hideCapcutMenu();
  } else if (action === 'edit') {
    hideCapcutMenu();
    openTab('text', document.querySelector('[data-tab="text"]'));
  }
}

/* ============================================================
   Lyrics list
   ============================================================ */
function addLyric() {
  const t = round1(state.currentTime);
  state.lyrics.push({ text: '', start: t, duration: 3 });
  renderLyricsList();
  renderTimeline();
  renderRuler();
}

function removeLyricAt(i) {
  if (state.lyrics.length <= 1) return;
  state.lyrics.splice(i, 1);
  renderLyricsList();
  renderTimeline();
  renderRuler();
}

function renderLyricsList() {
  const c = $('lyricsList');
  c.innerHTML = '';
  state.lyrics.forEach(function(l, i) {
    const row = document.createElement('div');
    row.className = 'lyric-row';
    const inp = document.createElement('input');
    inp.type = 'text';
    inp.className = 'lyric-text-input';
    inp.placeholder = 'السطر ' + (i + 1);
    inp.value = l.text;
    inp.addEventListener('input', function() {
      state.lyrics[i].text = inp.value;
      renderTimeline();
    });
    const btn = document.createElement('button');
    btn.className = 'lyric-remove-btn';
    btn.textContent = '×';
    btn.onclick = function() { removeLyricAt(i); };
    row.appendChild(inp);
    row.appendChild(btn);
    c.appendChild(row);
  });
}

/* ============================================================
   Text/BG/Cover inputs
   ============================================================ */
function bindTextInputs() {
  $('songNameInput').addEventListener('input', function(e) { state.songName = e.target.value; });
  $('artistNameInput').addEventListener('input', function(e) { state.artistName = e.target.value; });
  $('igNameInput').addEventListener('input', function(e) {
    state.igName = e.target.value.trim() || 'dk.llyric';
  });
}

function bindUploads() {
  $('bgInput').addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = function() {
      state.bgImg = img;
      $('bgPreview').classList.remove('hidden');
      $('bgPreviewImg').src = url;
      $('bgPreviewName').textContent = file.name;
      $('bgUploadBtn').classList.add('hidden');
      $('bgFiltersBox').style.display = 'block';
    };
    img.src = url;
  });

  $('coverInput').addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = function() {
      state.coverImg = img;
      $('coverPreview').classList.remove('hidden');
      $('coverPreviewImg').src = url;
      $('coverPreviewName').textContent = file.name;
      $('coverUploadBtn').classList.add('hidden');
    };
    img.src = url;
  });
}

function removeBackground() {
  state.bgImg = null;
  $('bgPreview').classList.add('hidden');
  $('bgUploadBtn').classList.remove('hidden');
  $('bgFiltersBox').style.display = 'none';
  $('bgInput').value = '';
}

function removeCover() {
  state.coverImg = null;
  $('coverPreview').classList.add('hidden');
  $('coverUploadBtn').classList.remove('hidden');
  $('coverInput').value = '';
}

function resetBgFilters() {
  state.bgFilters = { blur: 0, bright: 100, sat: 100, con: 100, op: 100 };
  $('bgBlurRange').value = 0; $('bgBlurVal').textContent = '0';
  $('bgBrightRange').value = 100; $('bgBrightVal').textContent = '100';
  $('bgSatRange').value = 100; $('bgSatVal').textContent = '100';
  $('bgConRange').value = 100; $('bgConVal').textContent = '100';
  $('bgOpRange').value = 100; $('bgOpVal').textContent = '100';
}

/* ============================================================
   Controls (sliders, fonts, colors)
   ============================================================ */
function bindSliders() {
  function bind(rangeId, valId, cb, fmt) {
    const r = $(rangeId);
    const v = $(valId);
    if (!r) return;
    r.addEventListener('input', function() {
      const val = parseFloat(r.value);
      cb(val);
      if (v) v.textContent = fmt ? fmt(val) : val;
    });
  }

  bind('cardScaleRange', 'cardScaleVal', function(v) { state.card.scale = v; }, function(v) { return v.toFixed(2); });
  bind('cardOpRange', 'cardOpVal', function(v) { state.card.opacity = v / 100; });
  bind('cardRadRange', 'cardRadVal', function(v) { state.card.radius = v; });
  bind('coverSizeRange', 'coverSizeVal', function(v) { state.card.coverSize = v; });
  bind('fontSizeRange', 'fontSizeVal', function(v) { state.font.size = v; });
  bind('bgBlurRange', 'bgBlurVal', function(v) { state.bgFilters.blur = v; });
  bind('bgBrightRange', 'bgBrightVal', function(v) { state.bgFilters.bright = v; });
  bind('bgSatRange', 'bgSatVal', function(v) { state.bgFilters.sat = v; });
  bind('bgConRange', 'bgConVal', function(v) { state.bgFilters.con = v; });
  bind('bgOpRange', 'bgOpVal', function(v) { state.bgFilters.op = v; });
}

function bindFontButtons() {
  document.querySelectorAll('.font-family-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      document.querySelectorAll('.font-family-btn').forEach(function(b) { b.classList.remove('active'); });
      btn.classList.add('active');
      state.font.family = btn.dataset.font;
    });
  });
}

function bindColorButtons() {
  document.querySelectorAll('.color-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      document.querySelectorAll('.color-btn').forEach(function(b) { b.classList.remove('active'); });
      btn.classList.add('active');
      state.font.color = btn.dataset.color;
    });
  });
}

function setFontFilter(filter, btn) {
  document.querySelectorAll('.filter-btn').forEach(function(b) { b.classList.remove('active'); });
  if (btn) btn.classList.add('active');
  document.querySelectorAll('.font-family-btn').forEach(function(b) {
    const lang = b.dataset.lang || 'ar';
    if (filter === 'all' || filter === lang) b.classList.remove('hidden');
    else b.classList.add('hidden');
  });
}

/* ============================================================
   Export
   ============================================================ */
let exportSettings = { quality: 1080, fps: 30 };
let _audioCtx = null;
let _audioSource = null;
let _audioDest = null;

function bindExportOptions() {
  document.querySelectorAll('#exportQuality .export-opt').forEach(function(b) {
    b.onclick = function() {
      document.querySelectorAll('#exportQuality .export-opt').forEach(function(x) { x.classList.remove('active'); });
      b.classList.add('active');
      exportSettings.quality = parseInt(b.dataset.value);
    };
  });
  document.querySelectorAll('#exportFps .export-opt').forEach(function(b) {
    b.onclick = function() {
      document.querySelectorAll('#exportFps .export-opt').forEach(function(x) { x.classList.remove('active'); });
      b.classList.add('active');
      exportSettings.fps = parseInt(b.dataset.value);
    };
  });
}

function openExportModal() {
  if (!state.audioUrl) { alert('ارفع أغنية أول'); return; }
  $('exportModal').classList.add('open');
  $('exportProgress').style.display = 'none';
  $('exportStartBtn').disabled = false;
}

function closeExportModal() {
  $('exportModal').classList.remove('open');
}

async function startExport() {
  const btn = $('exportStartBtn');
  const progress = $('exportProgress');
  const fill = $('exportProgressFill');
  const txt = $('exportProgressText');

  btn.disabled = true;
  progress.style.display = 'block';
  fill.style.width = '0%';
  txt.textContent = 'جاري التحضير...';

  try {
    const W = exportSettings.quality === 1080 ? 1080 : 720;
    const H = Math.round(W * DESIGN_H / DESIGN_W);

    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d', { alpha: false });

    const stream = canvas.captureStream(exportSettings.fps);

    // Audio
    const player = $('audioPlayer');
    try {
      if (!_audioCtx) {
        _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        _audioSource = _audioCtx.createMediaElementSource(player);
        _audioDest = _audioCtx.createMediaStreamDestination();
        _audioSource.connect(_audioDest);
        _audioSource.connect(_audioCtx.destination);
      }
      if (_audioCtx.state === 'suspended') await _audioCtx.resume();
      _audioDest.stream.getAudioTracks().forEach(function(t) { stream.addTrack(t); });
    } catch (audioErr) {
      console.warn('Audio setup:', audioErr);
    }

    // MIME
    let mimeType = 'video/webm';
    const prefs = [
      'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
      'video/mp4',
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm'
    ];
    for (let i = 0; i < prefs.length; i++) {
      if (MediaRecorder.isTypeSupported(prefs[i])) { mimeType = prefs[i]; break; }
    }

    const recorder = new MediaRecorder(stream, {
      mimeType: mimeType,
      videoBitsPerSecond: exportSettings.quality === 1080 ? 8000000 : 4000000
    });

    const chunks = [];
    recorder.ondataavailable = function(e) {
      if (e.data.size > 0) chunks.push(e.data);
    };
    const stopped = new Promise(function(r) { recorder.onstop = r; });
    recorder.start(100);

    player.currentTime = state.trimIn;
    await new Promise(function(r) {
      function h() { player.removeEventListener('seeked', h); r(); }
      player.addEventListener('seeked', h);
      setTimeout(r, 300);
    });

    try {
      await player.play();
    } catch (playErr) {
      recorder.stop();
      throw new Error('المتصفح رفض تشغيل الصوت. اضغط على الصفحة ثم أعد المحاولة.');
    }

    const startAt = performance.now();
    const totalDur = state.audioEnd - state.audioStart;
    const frameInterval = 1000 / exportSettings.fps;

    await new Promise(function(resolve) {
      function render() {
        const elapsed = (performance.now() - startAt) / 1000;
        if (elapsed >= totalDur || player.ended) {
          if (recorder.state !== 'inactive') recorder.stop();
          resolve();
          return;
        }
        const t = state.audioStart + elapsed;
        drawFrame(ctx, W, H, t);

        const pct = Math.min(100, Math.round((elapsed / totalDur) * 100));
        fill.style.width = pct + '%';
        txt.textContent = 'جاري التصدير: ' + pct + '%';

        setTimeout(function() { requestAnimationFrame(render); }, frameInterval);
      }
      render();
    });

    await stopped;

    const blob = new Blob(chunks, { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const ext = mimeType.indexOf('mp4') !== -1 ? 'mp4' : 'webm';
    a.href = url;
    a.download = 'dk.llyric-' + Date.now() + '.' + ext;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function() { URL.revokeObjectURL(url); }, 10000);

    fill.style.width = '100%';
    txt.textContent = '✅ تم التصدير بنجاح!';
    setTimeout(function() {
      closeExportModal();
      btn.disabled = false;
    }, 1500);
  } catch (err) {
    console.error(err);
    alert('خطأ في التصدير: ' + err.message);
    btn.disabled = false;
    progress.style.display = 'none';
  }
}

/* ============================================================
   Misc
   ============================================================ */
function closeEditor() {
  if (confirm('إغلاق المشروع؟')) location.href = 'index.html';
}

document.addEventListener('click', function(e) {
  if (!state.selected.type) return;
  if (e.target.closest('.capcut-menu')) return;
  if (e.target.closest('.bottom-sheet')) return;
  if (e.target.closest('.editor-nav')) return;
  if (e.target.closest('.text-segment')) return;
  if (e.target.closest('.audio-segment')) return;
  if (e.target.closest('.seg-handle')) return;
  if (e.target.closest('.playhead')) return;
  clearSelection();
}, true);
