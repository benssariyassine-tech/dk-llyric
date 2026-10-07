/* ============================================================
   dk.llyric Editor — Dynamic Karaoke Lyrics Edition
   ============================================================ */
const DESIGN_W = 360;
const DESIGN_H = 640;
const PX_PER_SEC = 30;
const LONG_PRESS_MS = 600;
const WORD_SPACING = 10;
const WORD_ANIM_MS = 350;

const state = {
  audioUrl: null, duration: 0,
  audioStart: 0, audioEnd: 15,
  trimIn: 0, trimOut: 15,
  currentTime: 0, isPlaying: false,
  songName: '', artistName: '', igName: 'dk.llyric',
  bgImg: null, coverImg: null, bgImgVersion: 0,
  bgFilters: { blur: 0, bright: 100, sat: 100, con: 100, op: 100 },
  card: { scale: 1, opacity: 0.65, radius: 26, coverSize: 68 },
  font: { family: 'Cairo', size: 28, color: '#ffffff' },
  lyrics: [
    { text: 'كلمات الأغنية هنا تجرب', start: 0, duration: 4 },
    { text: 'السطر الثاني من الأغنية', start: 4, duration: 4 }
  ],
  selected: { type: null, index: -1 }
};

let currentTab = null;
let previewCanvas = null;
let previewCtx = null;
let renderRAF = null;
let _resize = null;
let _lpTimer = null;
let _bgCache = { key: '', imgVersion: -1, canvas: null };
let _wordAnim = { lastLineIdx: -1, lastWordIdx: -1, startTime: 0 };

const $ = id => document.getElementById(id);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const round1 = v => Math.round(v * 10) / 10;
const fmtTime = s => {
  s = Math.max(0, Math.floor(s));
  return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
};

window.addEventListener('load', function() {
  const fontsToLoad = [
    '700 28px Cairo','500 28px Cairo','700 28px Tajawal','500 28px Tajawal',
    '700 28px Almarai','500 28px Almarai','700 28px "Reem Kufi"','500 28px "Reem Kufi"',
    '700 28px "IBM Plex Sans Arabic"','500 28px "IBM Plex Sans Arabic"',
    '700 28px Inter','500 28px Inter'
  ];
  function init() {
    try {
      setupCanvas(); bindAudio(); bindSliders(); bindFontButtons();
      bindColorButtons(); bindTextInputs(); bindUploads(); bindAudioSegment();
      setupTimelineClick(); setupPlayheadDrag(); bindExportOptions();
      renderLyricsList(); renderTimeline(); renderRuler();
      updateTimeDisplay(); startRenderLoop();
      console.log('✅ dk.llyric loaded');
    } catch (err) {
      console.error('❌ Init error:', err);
      alert('خطأ: ' + err.message);
    }
  }
  if (document.fonts && document.fonts.load) {
    Promise.all(fontsToLoad.map(f => document.fonts.load(f).catch(() => {})))
      .then(() => { console.log('✅ Fonts loaded'); init(); })
      .catch(() => init());
    setTimeout(() => { if (!previewCtx) init(); }, 3000);
  } else { init(); }
});

function setupCanvas() {
  previewCanvas = $('previewCanvas');
  if (!previewCanvas) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  previewCanvas.width = DESIGN_W * dpr;
  previewCanvas.height = DESIGN_H * dpr;
  previewCtx = previewCanvas.getContext('2d');
  previewCtx.scale(dpr, dpr);
}

function startRenderLoop() {
  function loop() {
    if (previewCtx) drawFrame(previewCtx, DESIGN_W, DESIGN_H, state.currentTime);
    renderRAF = requestAnimationFrame(loop);
  }
  loop();
}

function boxBlurCanvas(canvas, radius) {
  const w = canvas.width, h = canvas.height;
  if (w < 2 || h < 2) return;
  const ctx = canvas.getContext('2d');
  const imgData = ctx.getImageData(0, 0, w, h);
  const data = imgData.data;
  const tmp = new Uint8ClampedArray(data.length);
  const r = Math.max(1, Math.min(Math.round(radius), Math.floor(w / 4), Math.floor(h / 4)));
  const count = 2 * r + 1;
  for (let y = 0; y < h; y++) {
    let rs = 0, gs = 0, bs = 0, as = 0;
    for (let dx = -r; dx <= r; dx++) {
      const xx = Math.min(w - 1, Math.max(0, dx));
      const idx = (y * w + xx) * 4;
      rs += data[idx]; gs += data[idx+1]; bs += data[idx+2]; as += data[idx+3];
    }
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      tmp[idx] = rs / count; tmp[idx+1] = gs / count;
      tmp[idx+2] = bs / count; tmp[idx+3] = as / count;
      const xOut = Math.max(0, x - r);
      const xIn = Math.min(w - 1, x + r + 1);
      const iO = (y * w + xOut) * 4;
      const iI = (y * w + xIn) * 4;
      rs += data[iI] - data[iO];
      gs += data[iI+1] - data[iO+1];
      bs += data[iI+2] - data[iO+2];
      as += data[iI+3] - data[iO+3];
    }
  }
  for (let x = 0; x < w; x++) {
    let rs = 0, gs = 0, bs = 0, as = 0;
    for (let dy = -r; dy <= r; dy++) {
      const yy = Math.min(h - 1, Math.max(0, dy));
      const idx = (yy * w + x) * 4;
      rs += tmp[idx]; gs += tmp[idx+1]; bs += tmp[idx+2]; as += tmp[idx+3];
    }
    for (let y = 0; y < h; y++) {
      const idx = (y * w + x) * 4;
      data[idx] = rs / count; data[idx+1] = gs / count;
      data[idx+2] = bs / count; data[idx+3] = as / count;
      const yOut = Math.max(0, y - r);
      const yIn = Math.min(h - 1, y + r + 1);
      const iO = (yOut * w + x) * 4;
      const iI = (yIn * w + x) * 4;
      rs += tmp[iI] - tmp[iO];
      gs += tmp[iI+1] - tmp[iO+1];
      bs += tmp[iI+2] - tmp[iO+2];
      as += tmp[iI+3] - tmp[iO+3];
    }
  }
  ctx.putImageData(imgData, 0, 0);
}

function generateFilteredBg(W, H) {
  if (!state.bgImg || !state.bgImg.complete) return null;
  const f = state.bgFilters;
  const scale = 1 / 3;
  const tw = Math.max(8, Math.round(W * scale));
  const th = Math.max(8, Math.round(H * scale));
  const tmp = document.createElement('canvas');
  tmp.width = tw; tmp.height = th;
  const tctx = tmp.getContext('2d');
  drawCover(tctx, state.bgImg, 0, 0, tw, th);

  let usedCtxFilter = false;
  if (typeof tctx.filter !== 'undefined') {
    try {
      tctx.clearRect(0, 0, tw, th);
      tctx.filter = 'brightness(' + f.bright + '%) saturate(' + f.sat + '%) contrast(' + f.con + '%)';
      drawCover(tctx, state.bgImg, 0, 0, tw, th);
      tctx.filter = 'none';
      usedCtxFilter = true;
    } catch (e) { tctx.filter = 'none'; }
  }

  if (!usedCtxFilter) {
    try {
      const imgData = tctx.getImageData(0, 0, tw, th);
      const data = imgData.data;
      const b = f.bright / 100, c = f.con / 100, s = f.sat / 100;
      for (let i = 0; i < data.length; i += 4) {
        let r = data[i] * b, g = data[i+1] * b, bl = data[i+2] * b;
        r = (r - 128) * c + 128; g = (g - 128) * c + 128; bl = (bl - 128) * c + 128;
        const gray = r * 0.299 + g * 0.587 + bl * 0.114;
        r = gray + (r - gray) * s; g = gray + (g - gray) * s; bl = gray + (bl - gray) * s;
        data[i] = r < 0 ? 0 : (r > 255 ? 255 : r);
        data[i+1] = g < 0 ? 0 : (g > 255 ? 255 : g);
        data[i+2] = bl < 0 ? 0 : (bl > 255 ? 255 : bl);
      }
      tctx.putImageData(imgData, 0, 0);
    } catch (e) {}
  }

  if (f.blur > 0) {
    const blurR = Math.max(1, Math.round(f.blur / 3));
    boxBlurCanvas(tmp, blurR);
  }

  const out = document.createElement('.bcanvas');
  out.width = W; out.height = H;
  const octx = out.getContext('2d');
  octx.imageSmoothingEnabled = true;
  octx.imageSmoothingQuality = 'high';
  octx.globalAlpha = f.op / 100;
  octx.drawImage(tmp, 0, 0, tw, th, 0, 0, W, H);
  return out;
}

function getFilteredBg(W, H) {
  const f = state.bgFilters;
  const key = W + 'x' + H + '|' + f.blur + ',' + fright + ',' + f.sat + ',' + f.con + ',' + f.op;
  if (_bgCache.canvas && _bgCache.key === key && _bgCache.imgVersion === state.bgImgVersion) return _bgCache.canvas;
  const canvas = generateFilteredBg(W, H);
  _bgCache = { key, imgVersion: state.bgImgVersion, canvas };
  return canvas;
}

function invalidateBgCache() { _bgCache = { key: '', imgVersion: -1, canvas: null }; }

function renderKaraoke(ctx, line, currentTime, cardX, cardY, cardW, cardH, padX, padY, gap, s) {
  const words = line.text.split(/\s+/).filter(w => w.length > 0);
  if (words.length === 0) return;

  const elapsed = currentTime - line.start;
  const wordDur = line.duration / words.length;
  let activeWordIdx = Math.floor(elapsed / wordDur);
  activeWordIdx = Math.max(0, Math.min(words.length - 1, activeWordIdx));

  if (activeWordIdx !== _wordAnim.lastWordIdx) {
    _wordAnim.lastWordIdx = activeWordIdx;
    _wordAnim.startTime = performance.now();
  }

  const fontSize = state.font.size * s * state.card.scale;
  const font = '"' + state.font.family + '", "Cairo", "Inter", sans-serif';
  const spaceW = WORD_SPACING * s;

  ctx.save();
  ctx.font = '700 ' + fontSize + 'px ' + font;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';

  const widths = words.map(w => ctx.measureText(w).width);
  const startX = cardX + padX;
  const footerH = 20 * s;
  const div1Y = cardY + padY + 68 * s * state.card.scale + gap;
  const div2Y = cardY + cardH - padY - footerH - gap;
  const lyricsCenterY = (div1Y + div2Y) / 2;

  let x = startX;
  const animElapsed = performance.now() - _wordAnim.startTime;
  const wordAnimP = Math.min(1, animElapsed / WORD_ANIM_MS);

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const wW = widths[i];
    let opacity = 1, scale = 1, glowBlur = 0, glowColor = null;

    if (i < activeWordIdx) {
      opacity = 1;
    } else if (i === activeWordIdx) {
      const animP = (i === _wordAnim.lastWordIdx) ? wordAnimP : 1;
      const easeOut = 1 - Math.pow(1 - animP, 3);
      opacity = 1;
      scale = 0.85 + easeOut * 0.15;
      glowBlur = 25 * s * (0.5 + 0.5 * Math.sin(performance.now() / 200));
      glowColor = state.font.color;
    } else {
      opacity = 0.2;
    }

    ctx.save();
    ctx.globalAlpha = opacity;
    if (scale !== 1) {
      const cx = x + wW / 2;
      ctx.translate(cx, lyricsCenterY);
      ctx.scale(scale, scale);
      ctx.translate(-cx, -lyricsCenterY);
    }
    if (glowColor) {
      ctx.shadowColor = glowColor;
      ctx.shadowBlur = glowBlur;
    } else {
      ctx.shadowColor = 'rgba(0,0,0,0.6)';
      ctx.shadowBlur = 12 * s;
    }
    ctx.fillStyle = state.font.color;
    ctx.fillText(word, x, lyricsCenterY);
    ctx.restore();
    x += wW + spaceW;
  }
  ctx.restore();
}

function drawFrame(ctx, W, H, t) {
  const s = W / DESIGN_W;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);

  if (state.bgImg) {
    const filtered = getFilteredBg(W, H);
    if (filtered) ctx.drawImage(filtered, 0, 0, W, H);
  }

  const cardW = 320 * s * state.card.scale;
  const cardH = cardW;
  const cardX = (W - cardW) / 2;
  const cardY = (H - cardH) / 2;
  const radius = state.card.radius * s;

  if (state.bgImg) {
    const filtered = getFilteredBg(W, H);
    if (filtered) {
      ctx.save();
      roundRect(ctx, cardX, cardY, cardW, cardH, radius);
      ctx.clip();
      ctx.globalAlpha = 0.6;
      ctx.drawImage(filtered, 0, 0, W, H);
      ctx.restore();
    }
  }

  ctx.save();
  ctx.fillStyle = 'rgba(15,15,15,' + state.card.opacity + ')';
  roundRect(ctx, cardX, cardY, cardW, cardH, radius);
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.lineWidth = 1 * s;
  roundRect(ctx, cardX, cardY, cardW, cardH, radius);
  ctx.stroke();
  ctx.restore();

  const padX = 22 * s;
  const padY = 20 * s;

  const artSize = state.card.coverSize * s * state.card.scale;
  const artX = cardX + cardW - padX - artSize;
  const artY = cardY + padY;
  const artR = 10 * s;

  if (state.coverImg && state.coverImg.complete) {
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

  const textRight = artX - 14 * s;
  ctx.save();
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  if (state.songName) {
    ctx.fillStyle = '#fff';
    ctx.font = '700 ' + (18 * s) + 'px "Cairo", "Inter", sans-serif';
    ctx.fillText(state.songName, textRight, artY + artSize * 0.35);
  }
  if (state.artistName) {
    ctx.fillStyle = '#b3b3b3';
    ctx.font = '500 ' + (14 * s) + 'px "Cairo", "Inter", sans-serif';
    ctx.fillText(state.artistName, textRight, artY + artSize * 0.7);
  }
  ctx.restore();

  const gap = 16 * s;
  const div1Y = artY + artSize + gap;
  drawDivider(ctx, cardX + padX, div1Y, cardW - padX * 2, s);

  const footerH = 20 * s;
  const div2Y = cardY + cardH - padY - footerH - gap;

  const idx = findActiveLyric(t);
  let prev = '', next = '';
  if (idx >= 0) {
    prev = idx > 0 ? (state.lyrics[idx - 1].text || '') : '';
    next = idx < state.lyrics.length - 1 ? (state.lyrics[idx + 1].text || '') : '';
  }

  const fontSize = state.font.size * s * state.card.scale;
  const smallSize = 15 * s * state.card.scale;
  const font = '"' + state.font.family + '", "Cairo", "Inter", sans-serif';
  const cx = cardX + cardW / 2;
  const lyricsCenterY = (div1Y + div2Y) / 2;

  if (prev) {
    ctx.save();
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = '#fff';
    ctx.font = '500 ' + smallSize + 'px ' + font;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(prev, cx, lyricsCenterY - fontSize * 1.5);
    ctx.restore();
  }

  if (idx >= 0 && state.lyrics[idx]) {
    const lineElapsed = t - state.lyrics[idx].start;
    if (lineElapsed >= 0) {
      renderKaraoke(ctx, state.lyrics[idx], t, cardX, cardY, cardW, cardH, padX, padY, gap, s);
    }
  } else if (state.lyrics.length > 0 && state.lyrics[0].text) {
    renderKaraoke(ctx, state.lyrics[0], t, cardX, cardY, cardW, cardH, padX, padY, gap, s);
  }

  if (next) {
    ctx.save();
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = '#fff';
    ctx.font = '500 ' + smallSize + 'px ' + font;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(next, cx, lyricsCenterY + fontSize * 1.5);
    ctx.restore();
  }

  drawDivider(ctx, cardX + padX, div2Y, cardW - padX * 2, s);

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
  ctx.font = '500 ' + (14 * s) + 'px "Inter", "Cairo", sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(state.igName, igX + iconSize + 6 * s, footerY);
  ctx.restore();
}

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
  if (ir > cr) { h = dh; w = dh * ir; x = dx + (dw - w) / 2; y = dy; }
  else { w = dw; h = dw / ir; x = dx; y = dy + (dh - h) / 2; }
  ctx.drawImage(img, x, y, w, h);
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

function bindAudio() {
  const input = $('audioInput');
  const player = $('audioPlayer');
  input.addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    if (state.audioUrl) URL.revokeObjectURL(state.audioUrl);
    state.audioUrl = URL.createObjectURL(file);
    player.src = state.audioUrl;
    player.load();
    player.onloadedmetadata = () => {
      state.duration = player.duration;
      state.audioStart = 0;
      state.audioEnd = player.duration;
      state.trimIn = 0;
      state.trimOut = player.duration;
      updateAudioSegmentUI();
      renderRuler(); renderTimeline(); updateTimeDisplay();
    };
    player.addEventListener('timeupdate', () => {
      if (!state.isPlaying) return;
      const fileT = player.currentTime;
      state.currentTime = state.audioStart + (fileT - state.trimIn);
      if (state.currentTime > state.audioEnd) state.currentTime = state.audioEnd;
      seekPlayhead(state.currentTime);
      updateTimeDisplay();
    });
    player.addEventListener('pause', () => {
      if (state.isPlaying) { state.isPlaying = false; updatePlayIcon(); }
    });
    player.addEventListener('stalled', () => {
      if (state.isPlaying) setTimeout(() => player.play().catch(() => {}), 200);
    });
    $('audioUploadBtn').classList.add('hidden');
    $('audioPreview').classList.remove('hidden');
    $('audioPreviewName').textContent = file.name;
    $('audioPreviewMeta').textContent = (file.size / 1024 / 1024).toFixed(1) + ' MB';
  });
}

function openAudioPicker() { $('audioInput').click(); }

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
  updateTimeDisplay(); renderRuler();
}

function updateAudioSegmentUI() {
  const seg = $('audioSegment');
  seg.classList.remove('hidden');
  $('audioAddBtn').classList.add('hidden');
  seg.style.left = (state.audioStart * PX_PER_SEC) + 'px';
  seg.style.width = ((state.audioEnd - state.audioStart) * PX_PER_SEC) + 'px';
}

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
    const p = el.play();
    if (p && p.catch) p.catch(err => console.error('Play failed:', err));
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
  } else if (!state.audioUrl) {
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

function getTimelineDuration() {
  const last = state.lyrics.reduce((m, l) => Math.max(m, l.start + l.duration), 0);
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
  state.lyrics.forEach((l, i) => {
    const seg = document.createElement('div');
    seg.className = 'text-segment';
    if (state.selected.type === 'text' && state.selected.index === i) seg.classList.add('selected');
    seg.style.left = (l.start * PX_PER_SEC) + 'px';
    seg.style.width = (l.duration * PX_PER_SEC) + 'px';
    seg.textContent = l.text || ('السطر ' + (i + 1));
    const hL = document.createElement('div');
    hL.className = 'seg-handle handle-left';
    hL.addEventListener('mousedown', e => { state.selected = { type: 'text', index: i }; startResize(e, i, 'left'); });
    hL.addEventListener('touchstart', e => { state.selected = { type: 'text', index: i }; startResize(e, i, 'left'); }, { passive: false });
    seg.appendChild(hL);
    const hR = document.createElement('div');
    hR.className = 'seg-handle handle-right';
    hR.addEventListener('mousedown', e => { state.selected = { type: 'text', index: i }; startResize(e, i, 'right'); });
    hR.addEventListener('touchstart', e => { state.selected = { type: 'text', index: i }; startResize(e, i, 'right'); }, { passive: false });
    seg.appendChild(hR);
    seg.addEventListener('click', e => {
      if (e.target.classList.contains('seg-handle')) return;
      selectText(i);
    });
    seg.addEventListener('mousedown', e => {
      if (!e.target.classList.contains('seg-handle')) startLongPress(e, i, seg);
    });
    seg.addEventListener('touchstart', e => {
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

function startResize(e, index, side) {
  e.preventDefault(); e.stopPropagation();
  const cx = e.touches ? e.touches[0].clientX : e.clientX;
  const l = state.lyrics[index];
  _resize = { index, side, startX: cx, startStart: l.start, startDur: l.duration };
  function move(ev) { onResizeMove(ev); }
  function end() {
    document.removeEventListener('mousemove', move);
    document.removeEventListener('mouseup', end);
    document.removeEventListener('touchmove', move);
    document.removeEventListener('touchend', end);
    _resize = null;
    renderRuler(); renderTimeline();
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
    if (Math.abs(mx - cx) > 8) { cancelled = true; clearTimeout(_lpTimer); }
  }
  document.addEventListener('mousemove', cancelIfMove, { passive: true });
  document.addEventListener('touchmove', cancelIfMove, { passive: true });
  _lpTimer = setTimeout(() => {
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
  if (!cap) return;
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
  $('timelineViewport').addEventListener('click', e => {
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

function bindAudioSegment() {
  const seg = $('audioSegment');
  seg.addEventListener('mousedown', e => {
    if (e.target.classList.contains('seg-handle')) return;
    startAudioDrag(e);
  });
  seg.addEventListener('touchstart', e => {
    if (e.target.classList.contains('seg-handle')) return;
    startAudioDrag(e);
  }, { passive: false });
  const hL = document.createElement('div');
  hL.className = 'seg-handle handle-left';
  hL.addEventListener('mousedown', e => { state.selected = { type: 'audio', index: -1 }; startAudioResize(e, 'left'); });
  hL.addEventListener('touchstart', e => { state.selected = { type: 'audio', index: -1 }; startAudioResize(e, 'left'); }, { passive: false });
  seg.appendChild(hL);
  const hR = document.createElement('div');
  hR.className = 'seg-handle handle-right';
  hR.addEventListener('mousedown', e => { state.selected = { type: 'audio', index: -1 }; startAudioResize(e, 'right'); });
  hR.addEventListener('touchstart', e => { state.selected = { type: 'audio', index: -1 }; startAudioResize(e, 'right'); }, { passive: false });
  seg.appendChild(hR);
}

function startAudioDrag(e) {
  e.preventDefault(); e.stopPropagation();
  const startX = e.touches ? e.touches[0].clientX : e.clientX;
  const snapStart = state.audioStart;
  const width = state.audioEnd - state.audioStart;
  let moved = false;
  const seg = $('audioSegment');
  seg.classList.add('dragging');
  function move(ev) {
    const cx = ev.touches ? ev.touches[0].clientX : ev.clientX;
    const dx = (cx - startX) / PX_PER_SEC;
    if (Math.abs(dx) > 0.05) moved = true;
    const newStart = Math.max(0, snapStart + dx);
    state.audioStart = round1(newStart);
    state.audioEnd = round1(newStart + width);
    updateAudioSegmentUI();
  }
  function end() {
    document.removeEventListener('mousemove', move);
    document.removeEventListener('mouseup', end);
    document.removeEventListener('touchmove', move);
    document.removeEventListener('touchend', end);
    seg.classList.remove('dragging');
    renderRuler(); updateTimeDisplay();
    if (!moved) {
      state.selected = { type: 'audio', index: -1 };
      renderTimeline();
      showCapcutMenu();
    }
  }
  document.addEventListener('mousemove', move);
  document.addEventListener('mouseup', end);
  document.addEventListener('touchmove', move, { passive: false });
  document.addEventListener('touchend', end);
}

function startAudioResize(e, side) {
  e.preventDefault(); e.stopPropagation();
  const startX = e.touches ? e.touches[0].clientX : e.clientX;
  const snap = { startStart: state.audioStart, startEnd: state.audioEnd, trimIn: state.trimIn, trimOut: state.trimOut };
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
    updateAudioSegmentUI(); renderRuler();
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

function openTab(name, btn) {
  if (currentTab === name) { closeSheet(); return; }
  currentTab = name;
  document.querySelectorAll('.editor-nav-item').forEach(el => el.classList.remove('active'));
  if (btn) btn.classList.add('active');
  document.querySelectorAll('.sheet-content').forEach(el => el.classList.remove('active'));
  const t = document.querySelector('[data-sheet="' + name + '"]');
  if (t) t.classList.add('active');
  $('bottomSheet').classList.add('open');
  $('sheetBackdrop').classList.add('open');
}

function closeSheet() {
  currentTab = null;
  document.querySelectorAll('.editor-nav-item').forEach(el => el.classList.remove('active'));
  $('bottomSheet').classList.remove('open');
  $('sheetBackdrop').classList.remove('open');
}

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
      renderTimeline(); renderLyricsList(); renderRuler();
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
        renderTimeline(); renderLyricsList(); renderRuler();
      }
    }
    hideCapcutMenu();
  } else if (action === 'edit') {
    hideCapcutMenu();
    openTab('text', document.querySelector('[data-tab="text"]'));
  }
}

function addLyric() {
  const t = round1(state.currentTime);
  state.lyrics.push({ text: '', start: t, duration: 3 });
  renderLyricsList(); renderTimeline(); renderRuler();
}

function removeLyricAt(i) {
  if (state.lyrics.length <= 1) return;
  state.lyrics.splice(i, 1);
  renderLyricsList(); renderTimeline(); renderRuler();
}

function renderLyricsList() {
  const c = $('lyricsList');
  c.innerHTML = '';
  state.lyrics.forEach((l, i) => {
    const row = document.createElement('div');
    row.className = 'lyric-row';
    const inp = document.createElement('input');
    inp.type = 'text';
    inp.className = 'lyric-text-input';
    inp.placeholder = 'السطر ' + (i + 1);
    inp.value = l.text;
    inp.addEventListener('input', () => {
      state.lyrics[i].text = inp.value;
      renderTimeline();
    });
    const btn = document.createElement('button');
    btn.className = 'lyric-remove-btn';
    btn.textContent = '×';
    btn.onclick = () => removeLyricAt(i);
    row.appendChild(inp); row.appendChild(btn);
    c.appendChild(row);
  });
}

function bindTextInputs() {
  $('songNameInput').addEventListener('input', e => state.songName = e.target.value);
  $('artistNameInput').addEventListener('input', e => state.artistName = e.target.value);
  $('igNameInput').addEventListener('input', e => {
    state.igName = e.target.value.trim() || 'dk.llyric';
  });
}

function bindUploads() {
  $('bgInput').addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      state.bgImg = img;
      state.bgImgVersion++;
      invalidateBgCache();
      $('bgPreview').classList.remove('hidden');
      $('bgPreviewImg').src = url;
      $('bgPreviewName').textContent = file.name;
      $('bgUploadBtn').classList.add('hidden');
      $('bgFiltersBox').style.display = 'block';
    };
    img.src = url;
  });
  $('coverInput').addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
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
  state.bgImgVersion++;
  invalidateBgCache();
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
  invalidateBgCache();
}

function bindSliders() {
  function bind(rangeId, valId, cb, fmt) {
    const r = $(rangeId);
    const v = $(valId);
    if (!r) return;
    r.addEventListener('input', () => {
      const val = parseFloat(r.value);
      cb(val);
      if (v) v.textContent = fmt ? fmt(val) : val;
    });
  }
  bind('cardScaleRange', 'cardScaleVal', v => state.card.scale = v, v => v.toFixed(2));
  bind('cardOpRange', 'cardOpVal', v => state.card.opacity = v / 100);
  bind('cardRadRange', 'cardRadVal', v => state.card.radius = v);
  bind('coverSizeRange', 'coverSizeVal', v => state.card.coverSize = v);
  bind('fontSizeRange', 'fontSizeVal', v => state.font.size = v);
  bind('bgBlurRange', 'bgBlurVal', v => { state.bgFilters.blur = v; invalidateBgCache(); });
  bind('bgBrightRange', 'bgBrightVal', v => { state.bgFilters.bright = v; invalidateBgCache(); });
  bind('bgSatRange', 'bgSatVal', v => { state.bgFilters.sat = v; invalidateBgCache(); });
  bind('bgConRange', 'bgConVal', v => { state.bgFilters.con = v; invalidateBgCache(); });
  bind('bgOpRange', 'bgOpVal', v => { state.bgFilters.op = v; invalidateBgCache(); });
}

function bindFontButtons() {
  document.querySelectorAll('.font-family-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.font-family-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.font.family = btn.dataset.font;
      const family = state.font.family;
      if (document.fonts && document.fonts.load) {
        Promise.all([
          document.fonts.load('700 28px "' + family + '"').catch(() => {}),
          document.fonts.load('500 28px "' + family + '"').catch(() => {})
        ]).then(() => {
          if (previewCtx) drawFrame(previewCtx, DESIGN_W, DESIGN_H, state.currentTime);
        });
      }
    });
  });
}

function bindColorButtons() {
  document.querySelectorAll('.color-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.color-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.font.color = btn.dataset.color;
    });
  });
}

function setFontFilter(filter, btn) {
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  document.querySelectorAll('.font-family-btn').forEach(b => {
    const lang = b.dataset.lang || 'ar';
    if (filter === 'all' || filter === lang) b.classList.remove('hidden');
    else b.classList.add('hidden');
  });
}

let exportSettings = { quality: 1080, fps: 30 };
let _audioCtx = null, _audioSource = null, _audioDest = null;

function bindExportOptions() {
  document.querySelectorAll('#exportQuality .export-opt').forEach(b => {
    b.onclick = () => {
      document.querySelectorAll('#exportQuality .export-opt').forEach(x => x.classList.remove('active'));
      b.classList.add('active');
      exportSettings.quality = parseInt(b.dataset.value);
    };
  });
  document.querySelectorAll('#exportFps .export-opt').forEach(b => {
    b.onclick = () => {
      document.querySelectorAll('#exportFps .export-opt').forEach(x => x.classList.remove('active'));
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

function closeExportModal() { $('exportModal').classList.remove('open'); }

async function startExport() {
  const btn = $('exportStartBtn');
  const progress = $('exportProgress');
  const fill = $('exportProgressFill');
  const txt = $('exportProgressText');
  btn.disabled = true;
  progress.style.display = 'block';
  fill.style.width = '0%';
  txt.textContent = 'جاري التحضير...';
  let heartbeat = null;
  let recorder = null;
  try {
    const W = exportSettings.quality === 1080 ? 1080 : 720;
    const H = Math.round(W * DESIGN_H / DESIGN_W);
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d', { alpha: false });
    const stream = canvas.captureStream(exportSettings.fps);
    const player = $('audioPlayer');
    if (!_audioCtx) {
      _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      _audioSource = _audioCtx.createMediaElementSource(player);
      _audioDest = _audioCtx.createMediaStreamDestination();
      _audioSource.connect(_audioDest);
      _audioSource.connect(_audioCtx.destination);
    }
    if (_audioCtx.state === 'suspended') await _audioCtx.resume();
    stream.getAudioTracks().forEach(t => stream.removeTrack(t));
    _audioDest.stream.getAudioTracks().forEach(t => stream.addTrack(t));
    let mimeType = 'video/webm';
    const prefs = [
      'video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/mp4',
      'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'
    ];
    for (let i = 0; i < prefs.length; i++) {
      if (MediaRecorder.isTypeSupported(prefs[i])) { mimeType = prefs[i]; break; }
    }
    recorder = new MediaRecorder(stream, {
      mimeType,
      videoBitsPerSecond: exportSettings.quality === 1080 ? 8000000 : 4000000,
      audioBitsPerSecond: 128000
    });
    const chunks = [];
    recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };
    const stopped = new Promise(r => recorder.onstop = r);
    recorder.start(200);
    player.currentTime = state.trimIn;
    await new Promise(r => {
      const h = () => { player.removeEventListener('seeked', h); r(); };
      player.addEventListener('seeked', h);
      setTimeout(r, 400);
    });
    try {
      const p = player.play();
      if (p && p.catch) await p;
    } catch (playErr) {
      try { recorder.stop(); } catch (e) {}
      throw new Error('المتصفح رفض تشغيل الصوت. اضغط على الصفحة ثم أعد المحاولة.');
    }
    heartbeat = setInterval(() => {
      if (player.paused && !player.ended) player.play().catch(() => {});
      if (_audioCtx && _audioCtx.state === 'suspended') _audioCtx.resume().catch(() => {});
      if (recorder && recorder.state === 'paused') { try { recorder.resume(); } catch (e) {} }
    }, 300);
    await new Promise(resolve => {
      function render() {
        const audioT = player.currentTime;
        if (audioT >= state.trimOut - 0.02 || player.ended) {
          if (recorder && recorder.state !== 'inactive') {
            try { recorder.stop(); } catch (e) {}
          }
          resolve();
          return;
        }
        const videoT = state.audioStart + (audioT - state.trimIn);
        const safeT = Math.max(state.audioStart, Math.min(videoT, state.audioEnd));
        drawFrame(ctx, W, H, safeT);
        const total = state.trimOut - state.trimIn;
        const done = audioT - state.trimIn;
        const pct = Math.min(100, Math.round((done / total) * 100));
        fill.style.width = pct + '%';
        txt.textContent = 'جاري التصدير: ' + pct + '%';
        requestAnimationFrame(render);
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
    setTimeout(() => URL.revokeObjectURL(url), 15000);
    fill.style.width = '100%';
    txt.textContent = '✅ تم التصدير بنجاح!';
    setTimeout(() => {
      closeExportModal();
      btn.disabled = false;
    }, 1500);
  } catch (err) {
    console.error(err);
    alert('خطأ في التصدير: ' + err.message);
    btn.disabled = false;
    progress.style.display = 'none';
  } finally {
    if (heartbeat) clearInterval(heartbeat);
  }
}

function closeEditor() {
  if (confirm('إغلاق المشروع؟')) location.href = 'index.html';
}

document.addEventListener('click', e => {
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
