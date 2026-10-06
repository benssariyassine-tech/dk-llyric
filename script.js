/* ============================================
   dk.llyric Editor — Part 1/3
   Constants + State + Init + Helpers + Tabs + Audio + Lyrics
   ============================================ */
const PX_PER_SEC = 30;
const LONG_PRESS_MS = 1000;
const MIN_TIMELINE_SEC = 15;

const state = {
  audioUrl: null,
  audioDuration: 0,
  audioStart: 0,
  audioEnd: 0,
  audioTrimIn: 0,
  audioTrimOut: 0,
  bgStart: 0,
  bgEnd: 15,
  currentTime: 0,
  isPlaying: false,
  songName: 'راجع',
  artistName: 'عمرو دياب',
  igName: 'dk.llyric',
  bgUrl: null,
  lyrics: [
    { text: 'راجع بتقولي اللي ما بينا', start: 0, duration: 4, glass: false },
    { text: 'راجع', start: 5, duration: 3, glass: false }
  ],
  selectedType: null,
  selectedIndex: -1,
  activeSegment: -1,
  font: { family: 'Cairo', size: 20, weight: 700, color: '#ffffff' }
};

let currentTab = null;
let _playheadRAF = null;
let _lastRAFTime = 0;
let _resize = null;
let _move = null;
let _longPressTimer = null;

document.addEventListener('DOMContentLoaded', () => {
  initAudioUpload();
  initAudioSegmentListeners();
  initBgUpload();
  initBgFilters();
  initBgSegmentListeners();
  initIgInput();
  initCardControls();
  renderAll();
  applyFont();
  setupPlayheadDrag();
  setupFontControls();
  updateTimeDisplay();

  requestAnimationFrame(() => {
    state.currentTime = 0;
    setPlayheadPosition(0);
    updateTimeDisplay();
    renderLyricFromPlayhead(0);
    state.activeSegment = 0;
    playCardAnimation();
  });
});

function renderAll() {
  renderRuler();
  renderTimeline();
  renderLyricsList();
}

/* ============================================
   Card Entry Animation
   ============================================ */
function playCardAnimation() {
  const card = document.getElementById('mainCard');
  const header = document.querySelector('.card-header');
  const lyrics = document.querySelector('.card-lyrics');
  const footer = document.querySelector('.card-footer');
  if (!card) return;

  if (header) {
    header.style.opacity = '0';
    header.style.transition = 'opacity 0.6s ease';
    setTimeout(() => { header.style.opacity = '1'; }, 400);
  }
  if (lyrics) {
    lyrics.style.opacity = '0';
    lyrics.style.transition = 'opacity 0.6s ease';
    setTimeout(() => { lyrics.style.opacity = '1'; }, 700);
  }
  if (footer) {
    footer.style.opacity = '0';
    footer.style.transition = 'opacity 0.6s ease';
    setTimeout(() => { footer.style.opacity = '1'; }, 1000);
  }
}

/* ============================================
   Card Controls
   ============================================ */
function initCardControls() {
  const scaleRange = document.getElementById('cardScaleRange');
  const scaleVal = document.getElementById('cardScaleVal');
  if (scaleRange) {
    scaleRange.addEventListener('input', (e) => {
      const v = parseFloat(e.target.value);
      document.documentElement.style.setProperty('--card-scale', v);
      if (scaleVal) scaleVal.textContent = v.toFixed(2);
    });
  }

  const opRange = document.getElementById('cardOpacityRange');
  const opVal = document.getElementById('cardOpacityVal');
  if (opRange) {
    opRange.addEventListener('input', (e) => {
      const v = parseInt(e.target.value);
      document.documentElement.style.setProperty('--card-opacity', (v / 100).toFixed(2));
      if (opVal) opVal.textContent = v;
    });
  }

  const rRange = document.getElementById('cardRadiusRange');
  const rVal = document.getElementById('cardRadiusVal');
  if (rRange) {
    rRange.addEventListener('input', (e) => {
      const v = parseInt(e.target.value);
      document.documentElement.style.setProperty('--card-radius', v + 'px');
      if (rVal) rVal.textContent = v;
    });
  }

  const cRange = document.getElementById('coverSizeRange');
  const cVal = document.getElementById('coverSizeVal');
  if (cRange) {
    cRange.addEventListener('input', (e) => {
      const v = parseInt(e.target.value);
      document.documentElement.style.setProperty('--cover-size', v + 'px');
      if (cVal) cVal.textContent = v;
    });
  }

  initCardPinch();
}

function initCardPinch() {
  const card = document.getElementById('mainCard');
  if (!card) return;

  let startDist = 0;
  let startScale = 1;

  const getDist = (touches) => {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.hypot(dx, dy);
  };

  card.addEventListener('touchstart', (e) => {
    if (e.touches.length === 2) {
      startDist = getDist(e.touches);
      startScale = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--card-scale')) || 1;
      e.preventDefault();
    }
  }, { passive: false });

  card.addEventListener('touchmove', (e) => {
    if (e.touches.length === 2 && startDist > 0) {
      const dist = getDist(e.touches);
      const ratio = dist / startDist;
      let newScale = Math.max(0.5, Math.min(1.5, startScale * ratio));
      document.documentElement.style.setProperty('--card-scale', newScale.toFixed(2));
      const range = document.getElementById('cardScaleRange');
      const val = document.getElementById('cardScaleVal');
      if (range) range.value = newScale.toFixed(2);
      if (val) val.textContent = newScale.toFixed(2);
      e.preventDefault();
    }
  }, { passive: false });

  card.addEventListener('touchend', () => {
    startDist = 0;
  });
}

/* ============================================
   Helpers
   ============================================ */
function hasAudio() {
  return state.audioUrl && state.audioDuration > 0;
}

function timelineToFile(timelineSec) {
  return state.audioTrimIn + (timelineSec - state.audioStart);
}

function fileToTimeline(fileSec) {
  return state.audioStart + (fileSec - state.audioTrimIn);
}

/* ============================================
   Tabs
   ============================================ */
function openTab(tabName, btnEl) {
  if (currentTab === tabName) { closeSheet(); return; }
  currentTab = tabName;
  document.querySelectorAll('.editor-nav-item').forEach(el => el.classList.remove('active'));
  if (btnEl) btnEl.classList.add('active');
  document.querySelectorAll('.sheet-content').forEach(el => el.classList.remove('active'));
  const target = document.querySelector('[data-sheet="' + tabName + '"]');
  if (target) target.classList.add('active');
  document.getElementById('bottomSheet').classList.add('open');
  document.getElementById('sheetBackdrop').classList.add('open');
  if (navigator.vibrate) try { navigator.vibrate(8); } catch (e) {}
}

function closeSheet() {
  currentTab = null;
  document.querySelectorAll('.editor-nav-item').forEach(el => el.classList.remove('active'));
  const bs = document.getElementById('bottomSheet');
  const sb = document.getElementById('sheetBackdrop');
  if (bs) bs.classList.remove('open');
  if (sb) sb.classList.remove('open');
}

/* ============================================
   Audio Upload
   ============================================ */
function initAudioUpload() {
  const input = document.getElementById('audioInput');
  if (!input) return;
  input.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (state.audioUrl) URL.revokeObjectURL(state.audioUrl);
    state.audioUrl = URL.createObjectURL(file);
    const player = document.getElementById('audioPlayer');
    player.src = state.audioUrl;
    player.onloadedmetadata = () => {
      state.audioDuration = player.duration;
      state.audioStart = 0;
      state.audioEnd = player.duration;
      state.audioTrimIn = 0;
      state.audioTrimOut = player.duration;
      updateAudioSegment();
      updateTimeDisplay();
      renderAll();
      setPlayheadPosition(0);
    };
    document.getElementById('audioUploadBtn').classList.add('hidden');
    document.getElementById('audioPreview').classList.remove('hidden');
    document.getElementById('audioPreviewName').textContent = file.name;
    document.getElementById('audioPreviewMeta').textContent = (file.size / (1024 * 1024)).toFixed(1) + ' MB';
  });
}

function updateAudioSegment() {
  const seg = document.getElementById('audioSegment');
  if (!seg) return;
  seg.classList.remove('hidden');
  document.getElementById('audioAddBtn').classList.add('hidden');
  seg.style.left = (state.audioStart * PX_PER_SEC) + 'px';
  seg.style.width = ((state.audioEnd - state.audioStart) * PX_PER_SEC) + 'px';
}

function removeAudio() {
  if (state.audioUrl) URL.revokeObjectURL(state.audioUrl);
  state.audioUrl = null;
  state.audioDuration = 0;
  state.audioStart = 0;
  state.audioEnd = 0;
  state.audioTrimIn = 0;
  state.audioTrimOut = 0;
  const player = document.getElementById('audioPlayer');
  player.src = '';
  document.getElementById('audioUploadBtn').classList.remove('hidden');
  document.getElementById('audioPreview').classList.add('hidden');
  document.getElementById('audioSegment').classList.add('hidden');
  document.getElementById('audioAddBtn').classList.remove('hidden');
  updateTimeDisplay();
  renderAll();
  setPlayheadPosition(0);
}

function openAudioPicker() {
  document.getElementById('audioInput').click();
}

function initAudioSegmentListeners() {
  const audioSeg = document.getElementById('audioSegment');
  if (!audioSeg) return;

  audioSeg.addEventListener('click', (e) => {
    if (e.target.classList.contains('seg-handle')) return;
    selectAudio();
  });

  const hL = document.createElement('div');
  hL.className = 'seg-handle handle-left';
  hL.addEventListener('mousedown', e => startResize(e, 0, 'left'));
  hL.addEventListener('touchstart', e => startResize(e, 0, 'left'), { passive: false });
  audioSeg.appendChild(hL);

  const hR = document.createElement('div');
  hR.className = 'seg-handle handle-right';
  hR.addEventListener('mousedown', e => startResize(e, 0, 'right'));
  hR.addEventListener('touchstart', e => startResize(e, 0, 'right'), { passive: false });
  audioSeg.appendChild(hR);

  const lp = (e) => {
    if (e.target.classList.contains('seg-handle')) return;
    startLongPressAudio(e, audioSeg);
  };
  audioSeg.addEventListener('mousedown', lp);
  audioSeg.addEventListener('touchstart', lp, { passive: true });
}

/* ============================================
   Lyrics List
   ============================================ */
function addLyricLine() {
  const startAt = Math.round(state.currentTime * 10) / 10;
  state.lyrics.push({ text: '', start: startAt, duration: 3, glass: false });
  renderAll();
}

function removeLyricLine(index) {
  if (state.lyrics.length <= 1) return;
  state.lyrics.splice(index, 1);
  renderAll();
}

function updateLyricText(index, text) {
  state.lyrics[index].text = text;
  renderTimeline();
  if (index === state.activeSegment) renderLyricFromPlayhead(index);
}

function renderLyricsList() {
  const container = document.getElementById('lyricsList');
  if (!container) return;
  container.innerHTML = '';
  state.lyrics.forEach((lyric, index) => {
    const row = document.createElement('div');
    row.className = 'lyric-row';
    const inp = document.createElement('input');
    inp.type = 'text';
    inp.className = 'lyric-text-input';
    inp.placeholder = 'السطر ' + (index + 1);
    inp.value = lyric.text;
    inp.addEventListener('input', e => updateLyricText(index, e.target.value));
    const btn = document.createElement('button');
    btn.className = 'lyric-remove-btn';
    btn.textContent = '×';
    btn.onclick = () => removeLyricLine(index);
    row.appendChild(inp);
    row.appendChild(btn);
    container.appendChild(row);
  });
}
/* ============================================
   dk.llyric Editor — Part 2/3
   Timeline + Selection + Menu + Resize + Long Press
   ============================================ */

/* ============================================
   Timeline Duration
   ============================================ */
function getTimelineDuration() {
  const lastLyricEnd = state.lyrics.reduce((m, l) => Math.max(m, l.start + l.duration), 0);
  if (hasAudio()) {
    return Math.max(state.audioEnd, lastLyricEnd, MIN_TIMELINE_SEC);
  }
  return Math.max(lastLyricEnd, MIN_TIMELINE_SEC);
}

/* ============================================
   Ruler
   ============================================ */
function renderRuler() {
  const ruler = document.getElementById('timelineRuler');
  if (!ruler) return;
  const total = getTimelineDuration();
  ruler.innerHTML = '';
  ruler.style.width = (total * PX_PER_SEC) + 'px';
  for (let s = 0; s <= total; s++) {
    const tick = document.createElement('div');
    tick.className = 'ruler-tick';
    tick.style.left = (s * PX_PER_SEC) + 'px';
    tick.innerHTML = '<span>' + s + 's</span><i></i>';
    ruler.appendChild(tick);
  }
}

/* ============================================
   Timeline
   ============================================ */
function renderTimeline() {
  const trackText = document.getElementById('trackText');
  if (!trackText) return;
  const total = getTimelineDuration();
  trackText.innerHTML = '';
  trackText.style.width = (total * PX_PER_SEC) + 'px';

  state.lyrics.forEach((lyric, index) => {
    const seg = document.createElement('div');
    seg.className = 'text-segment';
    if (state.selectedType === 'text' && state.selectedIndex === index) seg.classList.add('selected');
    if (lyric.glass) seg.classList.add('glass');
    seg.style.left = (lyric.start * PX_PER_SEC) + 'px';
    seg.style.width = (lyric.duration * PX_PER_SEC) + 'px';
    seg.textContent = lyric.text || ('السطر ' + (index + 1));
    seg.dataset.index = index;

    const hL = document.createElement('div');
    hL.className = 'seg-handle handle-left';
    hL.addEventListener('mousedown', e => startResize(e, index, 'left'));
    hL.addEventListener('touchstart', e => startResize(e, index, 'left'), { passive: false });
    seg.appendChild(hL);

    const hR = document.createElement('div');
    hR.className = 'seg-handle handle-right';
    hR.addEventListener('mousedown', e => startResize(e, index, 'right'));
    hR.addEventListener('touchstart', e => startResize(e, index, 'right'), { passive: false });
    seg.appendChild(hR);

    seg.addEventListener('click', (e) => {
      if (e.target.classList.contains('seg-handle')) return;
      selectText(index);
    });

    seg.addEventListener('mousedown', e => {
      if (e.target.classList.contains('seg-handle')) return;
      startLongPressText(e, index, seg);
    });
    seg.addEventListener('touchstart', e => {
      if (e.target.classList.contains('seg-handle')) return;
      startLongPressText(e, index, seg);
    }, { passive: true });

    trackText.appendChild(seg);
  });

  setTimeout(checkAllTextOverlaps, 10);
}

/* ============================================
   Selection
   ============================================ */
function selectText(index) {
  state.selectedType = 'text';
  state.selectedIndex = index;
  renderTimeline();
  showCapcutMenu('text');
  if (navigator.vibrate) try { navigator.vibrate(10); } catch (e) {}
}

function selectAudio() {
  state.selectedType = 'audio';
  state.selectedIndex = -1;
  renderTimeline();
  renderAudioSelection();
  showCapcutMenu('audio');
  if (navigator.vibrate) try { navigator.vibrate(10); } catch (e) {}
}

function renderAudioSelection() {
  const seg = document.getElementById('audioSegment');
  if (!seg) return;
  seg.classList.toggle('selected', state.selectedType === 'audio');
}

function clearSelection() {
  state.selectedType = null;
  state.selectedIndex = -1;
  renderTimeline();
  renderAudioSelection();
  renderBgSelection();
  hideCapcutMenu();
}

function showCapcutMenu(type) {
  const menu = document.getElementById('capcutMenu');
  if (!menu) return;
  menu.classList.add('open');
  document.body.classList.add('menu-open');

  if (type === 'bg') {
    // For background: hide glass + edit
    menu.querySelectorAll('.cm-item').forEach(function(item) {
      const svg = item.querySelector('svg');
      if (!svg) return;
      const svgData = svg.outerHTML;
      if (svgData.indexOf('M11 4H4') !== -1 || svgData.indexOf('rx="4"') !== -1) {
        item.style.display = 'none';
      } else {
        item.style.display = '';
      }
    });
    return;
  }

  if (type === 'audio') {
    menu.querySelectorAll('.cm-item').forEach(item => {
      const svg = item.querySelector('svg');
      if (!svg) return;
      const svgData = svg.outerHTML;
      if (svgData.indexOf('M11 4H4') !== -1 || svgData.indexOf('rx="4"') !== -1) {
        item.style.display = 'none';
      } else {
        item.style.display = '';
      }
    });
  } else {
    menu.querySelectorAll('.cm-item').forEach(item => item.style.display = '');
  }
}

function hideCapcutMenu() {
  const menu = document.getElementById('capcutMenu');
  if (menu) menu.classList.remove('open');
  document.body.classList.remove('menu-open');
}

function cmAction(action) {
  if (action === 'delete') {
    if (state.selectedType === 'text') removeLyricLine(state.selectedIndex);
    else if (state.selectedType === 'audio') removeAudio();
    clearSelection();
    hideCapcutMenu();
  } else if (action === 'copy' || action === 'duplicate') {
    if (state.selectedType === 'text') {
      const src = state.lyrics[state.selectedIndex];
      const newLine = {
        text: src.text,
        start: src.start + src.duration,
        duration: src.duration,
        glass: src.glass
      };
      state.lyrics.splice(state.selectedIndex + 1, 0, newLine);
      renderAll();
    }
    hideCapcutMenu();
  } else if (action === 'glass') {
    if (state.selectedType === 'text') {
      state.lyrics[state.selectedIndex].glass = !state.lyrics[state.selectedIndex].glass;
      renderTimeline();
      renderLyricFromPlayhead(state.selectedIndex);
    }
    hideCapcutMenu();
  } else if (action === 'edit') {
    hideCapcutMenu();
    openTab('text', document.querySelector('.editor-nav-item[data-tab="text"]'));
  } else if (action === 'split') {
    const curT = state.currentTime;

    if (state.selectedType === 'text') {
      const idx = state.selectedIndex;
      const l = state.lyrics[idx];
      if (curT > l.start && curT < l.start + l.duration) {
        const first = { text: l.text, start: l.start, duration: Math.round((curT - l.start) * 10) / 10, glass: l.glass };
        const second = { text: l.text, start: Math.round(curT * 10) / 10, duration: Math.round((l.start + l.duration - curT) * 10) / 10, glass: l.glass };
        state.lyrics.splice(idx, 1, first, second);
        renderAll();
      }
    }

    if (state.selectedType === 'audio') {
      if (hasAudio() && curT > state.audioStart && curT < state.audioEnd) {
        const fileAtCursor = timelineToFile(curT);
        state.audioTrimOut = Math.round(fileAtCursor * 10) / 10;
        state.audioEnd = Math.round(curT * 10) / 10;
        updateAudioSegment();
        renderRuler();
        if (state.currentTime > state.audioEnd) {
          state.currentTime = state.audioEnd;
          setPlayheadPosition(state.currentTime);
        }
      }
    }
    hideCapcutMenu();
  }
}

/* ============================================
   Resize
   ============================================ */
function startResize(e, index, side) {
  e.preventDefault();
  e.stopPropagation();
  const cx = e.touches ? e.touches[0].clientX : e.clientX;
_resize = {
    active: true,
    index: index,
    side: side,
    startX: cx,
    isAudio: state.selectedType === 'audio',
    isBg: state.selectedType === 'bg',
    startDur: state.selectedType === 'bg' ? state.bgEnd : (state.lyrics[index] ? state.lyrics[index].duration : 0),
    startStart: state.selectedType === 'bg' ? state.bgStart : (state.lyrics[index] ? state.lyrics[index].start : 0),
    startBlockStart: state.audioStart,
    startBlockEnd: state.audioEnd,
    startTrimIn: state.audioTrimIn,
    startTrimOut: state.audioTrimOut
  };
  if (e.touches) {
    document.addEventListener('touchmove', onResizeMove, { passive: false });
    document.addEventListener('touchend', onResizeEnd);
  } else {
    document.addEventListener('mousemove', onResizeMove);
    document.addEventListener('mouseup', onResizeEnd);
  }
}

function onResizeMove(e) {
  if (!_resize || !_resize.active) return;
  e.preventDefault();
  const cx = e.touches ? e.touches[0].clientX : e.clientX;
  const dx = cx - _resize.startX;
  const deltaSec = dx / PX_PER_SEC;

  if (_resize.isBg) {
    // Background segment: نفس منطق الصوت
    if (_resize.side === 'left') {
      const newStart = Math.max(0, _resize.startStart + deltaSec);
      state.audioStart = Math.round(newStart * 10) / 10;
    } else {
      const newEnd = Math.max(state.audioStart + 0.5, _resize.startDur + deltaSec);
      state.audioEnd = Math.round(newEnd * 10) / 10;
    }
    updateBgSegment();
    updateAudioSegment();
    return;
  }

  if (_resize.isAudio) {
    if (_resize.side === 'left') {
      let newTrimIn = _resize.startTrimIn + deltaSec;
      let newBlockStart = _resize.startBlockStart + deltaSec;
      if (newTrimIn < 0) {
        newBlockStart -= newTrimIn;
        newTrimIn = 0;
      }
      if (newTrimIn > _resize.startTrimOut - 0.5) {
        newTrimIn = _resize.startTrimOut - 0.5;
        newBlockStart = _resize.startBlockStart + (newTrimIn - _resize.startTrimIn);
      }
      state.audioTrimIn = Math.round(newTrimIn * 10) / 10;
      state.audioStart = Math.round(newBlockStart * 10) / 10;
      state.audioEnd = _resize.startBlockEnd;
      state.audioTrimOut = _resize.startTrimOut;
    } else {
      let newTrimOut = _resize.startTrimOut + deltaSec;
      if (newTrimOut > state.audioDuration) newTrimOut = state.audioDuration;
      if (newTrimOut < state.audioTrimIn + 0.5) newTrimOut = state.audioTrimIn + 0.5;
      state.audioTrimOut = Math.round(newTrimOut * 10) / 10;
      state.audioEnd = Math.round((state.audioStart + (state.audioTrimOut - state.audioTrimIn)) * 10) / 10;
      state.audioStart = _resize.startBlockStart;
      state.audioTrimIn = _resize.startTrimIn;
    }
    const seg = document.getElementById('audioSegment');
    if (seg) {
      seg.style.left = (state.audioStart * PX_PER_SEC) + 'px';
      seg.style.width = ((state.audioEnd - state.audioStart) * PX_PER_SEC) + 'px';
    }
  } else {
    const idx = _resize.index;
    let newStart = _resize.startStart;
    let newDuration = _resize.startDur;

    if (_resize.side === 'right') {
      newDuration = Math.max(0.5, Math.min(300, _resize.startDur + deltaSec));
    } else {
      newStart = Math.max(0, _resize.startStart + deltaSec);
      newDuration = Math.max(0.5, _resize.startDur - deltaSec);
    }

    state.lyrics[idx].start = Math.round(newStart * 10) / 10;
    state.lyrics[idx].duration = Math.round(newDuration * 10) / 10;

    const segs = document.querySelectorAll('.text-segment');
    const seg = segs[idx];
    if (seg) {
      seg.style.left = (state.lyrics[idx].start * PX_PER_SEC) + 'px';
      seg.style.width = (state.lyrics[idx].duration * PX_PER_SEC) + 'px';
    }

    checkTextOverlap();
  }
}

function onResizeEnd() {
  if (!_resize) return;
  const wasText = !_resize.isAudio;
  _resize.active = false;
  _resize = null;
  document.removeEventListener('mousemove', onResizeMove);
  document.removeEventListener('mouseup', onResizeEnd);
  document.removeEventListener('touchmove', onResizeMove);
  document.removeEventListener('touchend', onResizeEnd);

  if (wasText) {
    renderRuler();
    setTimeout(checkAllTextOverlaps, 20);
  } else {
    renderRuler();
  }
}

/* ============================================
   Text Overlap
   ============================================ */
function checkTextOverlap() {
  const segs = document.querySelectorAll('.text-segment');
  segs.forEach(s => s.classList.remove('overlap'));

  for (let i = 0; i < state.lyrics.length; i++) {
    const a = state.lyrics[i];
    const aS = a.start;
    const aE = a.start + a.duration;
    for (let j = i + 1; j < state.lyrics.length; j++) {
      const b = state.lyrics[j];
      const bS = b.start;
      const bE = b.start + b.duration;
      if (aS < bE && aE > bS) {
        if (segs[i]) segs[i].classList.add('overlap');
        if (segs[j]) segs[j].classList.add('overlap');
      }
    }
  }
}

function checkAllTextOverlaps() {
  checkTextOverlap();
}

/* ============================================
   Long Press → Text
   ============================================ */
function startLongPressText(e, index, segEl) {
  const cx = e.touches ? e.touches[0].clientX : e.clientX;
  const cy = e.touches ? e.touches[0].clientY : e.clientY;
  let cancelled = false;

  const cancelIfMove = (ev) => {
    const mx = ev.touches ? ev.touches[0].clientX : ev.clientX;
    const my = ev.touches ? ev.touches[0].clientY : ev.clientY;
    if (Math.abs(mx - cx) > 10 || Math.abs(my - cy) > 10) {
      cancelled = true;
      clearTimeout(_longPressTimer);
    }
  };

  if (e.touches) {
    document.addEventListener('touchmove', cancelIfMove, { passive: true });
    document.addEventListener('touchend', () => { clearTimeout(_longPressTimer); }, { once: true });
  } else {
    document.addEventListener('mousemove', cancelIfMove, { passive: true });
    document.addEventListener('mouseup', () => { clearTimeout(_longPressTimer); }, { once: true });
  }

  _longPressTimer = setTimeout(() => {
    if (cancelled) return;
    selectText(index);
    segEl.classList.add('moving');
    if (navigator.vibrate) try { navigator.vibrate(30); } catch (e) {}

    _move = {
      active: true,
      isAudio: false,
      index: index,
      startX: cx,
      startStart: state.lyrics[index].start,
      segEl: segEl
    };

    const onMoveFn = (ev) => {
      if (!_move || !_move.active) return;
      const mx = ev.touches ? ev.touches[0].clientX : ev.clientX;
      const dx = mx - _move.startX;
      const deltaSec = dx / PX_PER_SEC;
      const ns = Math.max(0, _move.startStart + deltaSec);
      state.lyrics[_move.index].start = Math.round(ns * 10) / 10;
      _move.segEl.style.left = (state.lyrics[_move.index].start * PX_PER_SEC) + 'px';
      checkTextOverlap();
    };

    const onEndFn = () => {
      if (_move && _move.segEl) _move.segEl.classList.remove('moving');
      _move = null;
      document.removeEventListener('mousemove', onMoveFn);
      document.removeEventListener('mouseup', onEndFn);
      document.removeEventListener('touchmove', onMoveFn);
      document.removeEventListener('touchend', onEndFn);
      renderRuler();
      setTimeout(checkAllTextOverlaps, 20);
    };

    if (e.touches) {
      document.addEventListener('touchmove', onMoveFn, { passive: false });
      document.addEventListener('touchend', onEndFn);
    } else {
      document.addEventListener('mousemove', onMoveFn);
      document.addEventListener('mouseup', onEndFn);
    }
  }, LONG_PRESS_MS);
}

/* ============================================
   Long Press → Audio
   ============================================ */
function startLongPressAudio(e, segEl) {
  const cx = e.touches ? e.touches[0].clientX : e.clientX;
  const cy = e.touches ? e.touches[0].clientY : e.clientY;
  let cancelled = false;

  const cancelIfMove = (ev) => {
    const mx = ev.touches ? ev.touches[0].clientX : ev.clientX;
    const my = ev.touches ? ev.touches[0].clientY : ev.clientY;
    if (Math.abs(mx - cx) > 10 || Math.abs(my - cy) > 10) {
      cancelled = true;
      clearTimeout(_longPressTimer);
    }
  };

  if (e.touches) {
    document.addEventListener('touchmove', cancelIfMove, { passive: true });
    document.addEventListener('touchend', () => { clearTimeout(_longPressTimer); }, { once: true });
  } else {
    document.addEventListener('mousemove', cancelIfMove, { passive: true });
    document.addEventListener('mouseup', () => { clearTimeout(_longPressTimer); }, { once: true });
  }

  _longPressTimer = setTimeout(() => {
    if (cancelled) return;
    selectAudio();
    segEl.classList.add('moving');
    if (navigator.vibrate) try { navigator.vibrate(30); } catch (e) {}

    const blockWidth = state.audioEnd - state.audioStart;

    _move = {
      active: true,
      isAudio: true,
      startX: cx,
      startStart: state.audioStart,
      width: blockWidth,
      segEl: segEl
    };

    const onMoveFn = (ev) => {
      if (!_move || !_move.active) return;
      const mx = ev.touches ? ev.touches[0].clientX : ev.clientX;
      const dx = mx - _move.startX;
      const deltaSec = dx / PX_PER_SEC;
      const newStart = Math.max(0, _move.startStart + deltaSec);
      state.audioStart = Math.round(newStart * 10) / 10;
      state.audioEnd = Math.round((newStart + _move.width) * 10) / 10;
      _move.segEl.style.left = (state.audioStart * PX_PER_SEC) + 'px';
      _move.segEl.style.width = ((state.audioEnd - state.audioStart) * PX_PER_SEC) + 'px';
    };

    const onEndFn = () => {
      if (_move && _move.segEl) _move.segEl.classList.remove('moving');
      _move = null;
      document.removeEventListener('mousemove', onMoveFn);
      document.removeEventListener('mouseup', onEndFn);
      document.removeEventListener('touchmove', onMoveFn);
      document.removeEventListener('touchend', onEndFn);
      renderRuler();
    };

    if (e.touches) {
      document.addEventListener('touchmove', onMoveFn, { passive: false });
      document.addEventListener('touchend', onEndFn);
    } else {
      document.addEventListener('mousemove', onMoveFn);
      document.addEventListener('mouseup', onEndFn);
    }
  }, LONG_PRESS_MS);
}
/* ============================================
   dk.llyric Editor — Part 3/3
   Playhead + Sync + Play/Pause + Font + Background + Instagram + Misc
   ============================================ */

/* ============================================
   Playhead Position
   ============================================ */
function setPlayheadPosition(sec) {
  const ph = document.getElementById('playhead');
  if (!ph) return;
  const maxEnd = hasAudio() ? state.audioEnd : getTimelineDuration();
  const clampedSec = Math.max(0, Math.min(sec, maxEnd));
  const x = clampedSec * PX_PER_SEC;
  ph.style.transform = 'translateX(' + x + 'px)';
  state.currentTime = clampedSec;
  updateTimeDisplay();
}

/* ============================================
   Playhead Drag
   ============================================ */
function setupPlayheadDrag() {
  const ph = document.getElementById('playhead');
  const vp = document.getElementById('timelineViewport');
  const content = document.getElementById('timelineContent');
  if (!ph || !vp || !content) return;

  let dragging = false;

  const pxToTime = (clientX) => {
    const rect = content.getBoundingClientRect();
    const x = clientX - rect.left;
    return Math.max(0, x / PX_PER_SEC);
  };

  const seekTo = (sec) => {
    const maxEnd = hasAudio() ? state.audioEnd : getTimelineDuration();
    sec = Math.max(0, Math.min(sec, maxEnd));
    const player = document.getElementById('audioPlayer');
    if (player && hasAudio()) {
      const fileSec = timelineToFile(sec);
      try { player.currentTime = Math.max(0, Math.min(fileSec, state.audioDuration)); } catch (err) {}
    }
    setPlayheadPosition(sec);
    syncPlayheadToLyric();
  };

  const onMove = (e) => {
    if (!dragging) return;
    e.preventDefault();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    seekTo(pxToTime(clientX));
  };

  const onUp = () => {
    dragging = false;
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
    document.removeEventListener('touchmove', onMove);
    document.removeEventListener('touchend', onUp);
  };

  const onDown = (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragging = true;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    seekTo(pxToTime(clientX));
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    document.addEventListener('touchmove', onMove, { passive: false });
    document.addEventListener('touchend', onUp);
  };

  const cap = ph.querySelector('.playhead-cap');
  if (cap) {
    cap.addEventListener('mousedown', onDown);
    cap.addEventListener('touchstart', onDown, { passive: false });
  }

  const ruler = document.getElementById('timelineRuler');
  if (ruler) {
    const onRulerTouch = (e) => {
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      seekTo(pxToTime(clientX));
      if (navigator.vibrate) try { navigator.vibrate(8); } catch (err) {}
    };
    ruler.addEventListener('mousedown', onRulerTouch);
    ruler.addEventListener('touchstart', onRulerTouch, { passive: true });
  }

  vp.addEventListener('click', (e) => {
    if (e.target.closest('.text-segment')) return;
    if (e.target.closest('.audio-segment')) return;
    if (e.target.closest('.seg-handle')) return;
    if (e.target.closest('.playhead-cap')) return;
    if (e.target.closest('.ruler-tick')) return;
    if (e.target.closest('.audio-add-btn')) return;
    const sec = pxToTime(e.clientX);
    seekTo(sec);
  });
}

/* ============================================
   Playhead Loop
   ============================================ */
function startPlayheadLoop() {
  if (_playheadRAF) cancelAnimationFrame(_playheadRAF);
  _lastRAFTime = performance.now();

  const tick = (now) => {
    const dt = (now - _lastRAFTime) / 1000;
    _lastRAFTime = now;

    const player = document.getElementById('audioPlayer');
    const ph = document.getElementById('playhead');
    const isAudioActive = hasAudio();

    if (isAudioActive && player && !player.paused && !player.ended) {
      const fileTime = player.currentTime;
      const timelineTime = fileToTimeline(fileTime);
      state.currentTime = timelineTime;

      if (fileTime >= state.audioTrimOut) {
        player.pause();
        state.currentTime = state.audioEnd;
        if (ph) ph.style.transform = 'translateX(' + (state.audioEnd * PX_PER_SEC) + 'px)';
        updateTimeDisplay();
        syncPlayheadToLyric();
        state.isPlaying = false;
        updatePlayIcon();
        stopPlayheadLoop();
        return;
      }
    } else {
      state.currentTime += dt;
    }

    const maxEnd = isAudioActive ? state.audioEnd : getTimelineDuration();

    if (state.currentTime >= maxEnd) {
      state.currentTime = maxEnd;
      if (ph) ph.style.transform = 'translateX(' + (maxEnd * PX_PER_SEC) + 'px)';
      updateTimeDisplay();
      syncPlayheadToLyric();
      state.isPlaying = false;
      updatePlayIcon();
      stopPlayheadLoop();
      return;
    }

    if (ph) ph.style.transform = 'translateX(' + (state.currentTime * PX_PER_SEC) + 'px)';
    updateTimeDisplay();
    syncPlayheadToLyric();

    if (isAudioActive && player && !player.paused) {
      autoScrollPlayhead();
    }

    _playheadRAF = requestAnimationFrame(tick);
  };

  _playheadRAF = requestAnimationFrame(tick);
}

function stopPlayheadLoop() {
  if (_playheadRAF) {
    cancelAnimationFrame(_playheadRAF);
    _playheadRAF = null;
  }
}

function autoScrollPlayhead() {
  const vp = document.getElementById('timelineViewport');
  if (!vp) return;
  const phX = state.currentTime * PX_PER_SEC;
  const scrollLeft = vp.scrollLeft;
  const viewportWidth = vp.clientWidth;
  const phScreenX = phX - scrollLeft;

  if (phScreenX > viewportWidth - 100) {
    vp.scrollLeft = phX - viewportWidth + 100;
  } else if (phScreenX < 80) {
    vp.scrollLeft = Math.max(0, phX - 80);
  }
}

/* ============================================
   Sync Playhead → Lyric (3 lines)
   ============================================ */
function syncPlayheadToLyric() {
  const t = state.currentTime;
  let idx = -1;
  for (let i = 0; i < state.lyrics.length; i++) {
    const l = state.lyrics[i];
    if (t >= l.start && t < l.start + l.duration) {
      idx = i;
      break;
    }
  }
  if (idx !== state.activeSegment) {
    state.activeSegment = idx;
    renderLyricFromPlayhead(idx);
  }
}

function renderLyricFromPlayhead(idx) {
  const prevEl = document.getElementById('lyricPrev');
  const currEl = document.getElementById('lyricCurrent');
  const nextEl = document.getElementById('lyricNext');
  if (!currEl) return;

  if (idx < 0 || idx >= state.lyrics.length || !state.lyrics[idx]) {
    if (state.lyrics.length > 0 && state.lyrics[0].text) {
      if (prevEl) prevEl.textContent = '';
      currEl.textContent = state.lyrics[0].text;
      if (nextEl) nextEl.textContent = state.lyrics[1] ? (state.lyrics[1].text || '') : '';
      currEl.style.opacity = '1';
      currEl.classList.remove('animate-in');
      void currEl.offsetWidth;
      currEl.classList.add('animate-in');
      return;
    }
    if (prevEl) prevEl.textContent = '';
    if (nextEl) nextEl.textContent = '';
    currEl.textContent = 'اكتب الكلمات';
    currEl.style.opacity = '0.5';
    return;
  }

  currEl.style.opacity = '1';
  if (prevEl) prevEl.textContent = state.lyrics[idx - 1] ? (state.lyrics[idx - 1].text || '') : '';
  currEl.textContent = state.lyrics[idx].text || 'اكتب الكلمات';
  if (nextEl) nextEl.textContent = state.lyrics[idx + 1] ? (state.lyrics[idx + 1].text || '') : '';

  currEl.classList.remove('animate-in');
  void currEl.offsetWidth;
  currEl.classList.add('animate-in');
}

/* ============================================
   Play / Pause
   ============================================ */
function togglePlay() {
  const player = document.getElementById('audioPlayer');
  const isAudioActive = hasAudio();
  const maxEnd = isAudioActive ? state.audioEnd : getTimelineDuration();

  if (state.isPlaying) {
    if (player && isAudioActive) player.pause();
    state.isPlaying = false;
    stopPlayheadLoop();
  } else {
    let startAt = state.currentTime;

    if (isAudioActive && startAt < state.audioStart) startAt = state.audioStart;
    if (isAudioActive && startAt >= state.audioEnd - 0.05) startAt = state.audioStart;
    if (!isAudioActive && startAt >= maxEnd - 0.05) startAt = 0;

    state.currentTime = startAt;
    setPlayheadPosition(startAt);

    if (player && isAudioActive) {
      const fileStart = timelineToFile(startAt);
      try { player.currentTime = Math.max(0, fileStart); } catch (err) {}
      player.play().catch(err => console.warn('play err:', err));
    }
    state.isPlaying = true;
    startPlayheadLoop();
  }
  updatePlayIcon();
}

function updatePlayIcon() {
  const i = document.getElementById('playIcon');
  if (!i) return;
  i.innerHTML = state.isPlaying
    ? '<rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>'
    : '<polygon points="5 3 19 12 5 21 5 3"/>';
}

function updateTimeDisplay() {
  const el = document.getElementById('timeDisplay');
  if (!el) return;
  const isAudioActive = hasAudio();
  const maxEnd = isAudioActive ? state.audioEnd : getTimelineDuration();
  const cur = Math.max(0, Math.min(state.currentTime, maxEnd));
  el.textContent = fmt(cur) + ' / ' + fmt(maxEnd);
}

function fmt(s) {
  s = Math.max(0, Math.floor(s));
  return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
}

/* ============================================
   Font Controls
   ============================================ */
function setupFontControls() {
  document.querySelectorAll('.font-family-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.font-family-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.font.family = btn.dataset.font;
      applyFont();
    });
  });
  const r = document.getElementById('fontSizeRange');
  if (r) r.addEventListener('input', e => {
    state.font.size = parseInt(e.target.value);
    document.getElementById('fontSizeVal').textContent = state.font.size;
    applyFont();
  });
  document.querySelectorAll('.color-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.color-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.font.color = btn.dataset.color;
      applyFont();
    });
  });
}

function applyFont() {
  const curr = document.getElementById('lyricCurrent');
  if (curr) {
    curr.style.fontFamily = "'" + state.font.family + "', sans-serif";
    curr.style.fontSize = state.font.size + 'px';
    curr.style.fontWeight = state.font.weight;
    curr.style.color = state.font.color;
    curr.style.textShadow = '0 2px 20px rgba(0,0,0,0.5)';
  }
  const prev = document.getElementById('lyricPrev');
  const next = document.getElementById('lyricNext');
  [prev, next].forEach(el => {
    if (el) el.style.fontFamily = "'" + state.font.family + "', sans-serif";
  });
}

function setFontFilter(filter, btnEl) {
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  if (btnEl) btnEl.classList.add('active');
  document.querySelectorAll('.font-family-btn').forEach(btn => {
    const lang = btn.dataset.lang || 'ar';
    if (filter === 'all' || filter === lang) btn.classList.remove('hidden');
    else btn.classList.add('hidden');
  });
}

/* ============================================
   Background Upload
   ============================================ */
function initBgUpload() {
  const bgInput = document.getElementById('bgInput');
  if (!bgInput) return;
  bgInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (state.bgUrl) URL.revokeObjectURL(state.bgUrl);
    state.bgUrl = URL.createObjectURL(file);
    const bgImg = document.getElementById('bgImage');
    if (bgImg) bgImg.src = state.bgUrl;
    document.getElementById('bgUploadBtn').classList.add('hidden');
    document.getElementById('bgPreview').classList.remove('hidden');
    document.getElementById('bgPreviewImg').src = state.bgUrl;
    document.getElementById('bgPreviewName').textContent = file.name;

    // ✅ Update segment + show filters + apply
    const filtersBox = document.getElementById('bgFiltersBox');
    if (filtersBox) filtersBox.style.display = 'block';
    updateBgSegment();
    applyBgFilters();
    renderRuler();
  });
}
/* ============================================
   🎨 BG Segment Listeners
   ============================================ */
function initBgSegmentListeners() {
  const seg = document.getElementById('bgSegment');
  if (!seg) return;

  // Click → Select
  seg.addEventListener('click', function(e) {
    if (e.target.classList.contains('seg-handle')) return;
    selectBg();
  });

  // ✅ فرض selectedType = 'bg' قبل startResize
  const hL = document.createElement('div');
  hL.className = 'seg-handle handle-left';
  hL.addEventListener('mousedown', function(e) {
    state.selectedType = 'bg';
    startResize(e, 0, 'left');
  });
  hL.addEventListener('touchstart', function(e) {
    state.selectedType = 'bg';
    startResize(e, 0, 'left');
  }, { passive: false });
  seg.appendChild(hL);

  const hR = document.createElement('div');
  hR.className = 'seg-handle handle-right';
  hR.addEventListener('mousedown', function(e) {
    state.selectedType = 'bg';
    startResize(e, 0, 'right');
  });
  hR.addEventListener('touchstart', function(e) {
    state.selectedType = 'bg';
    startResize(e, 0, 'right');
  }, { passive: false });
  seg.appendChild(hR);
}
function removeBackground() {
  if (state.bgUrl) URL.revokeObjectURL(state.bgUrl);
  state.bgUrl = null;
  const bgImg = document.getElementById('bgImage');
  if (bgImg) {
    bgImg.removeAttribute('src');
    bgImg.src = '';
  }
  document.getElementById('bgUploadBtn').classList.remove('hidden');
  document.getElementById('bgPreview').classList.add('hidden');
  document.getElementById('bgInput').value = '';

  // ✅ Hide filters + Hide segment
  const filtersBox = document.getElementById('bgFiltersBox');
  if (filtersBox) filtersBox.style.display = 'none';
  updateBgSegment();

  // If bg was selected, clear
  if (state.selectedType === 'bg') {
    clearSelection();
  }
}

/* ============================================
   Instagram
   ============================================ */
function initIgInput() {
  const igInput = document.getElementById('igNameInput');
  if (!igInput) return;
  igInput.addEventListener('input', (e) => {
    const val = e.target.value.trim() || 'dk.llyric';
    const igNameEl = document.getElementById('igName');
    if (igNameEl) igNameEl.textContent = val;
    state.igName = val;
  });
}

function openInstagram() {
  const name = state.igName || 'dk.llyric';
  window.open('https://instagram.com/' + name.replace('@', ''), '_blank');
}

/* ============================================
   Tap → Hide Menu
   ============================================ */
document.addEventListener('click', (e) => {
  if (state.selectedType) {
    if (e.target.closest('.capcut-menu')) return;
    if (e.target.closest('.editor-nav')) return;
    if (e.target.closest('.bottom-sheet')) return;
    if (e.target.closest('.sheet-backdrop')) return;
    if (e.target.closest('.text-segment')) return;
    if (e.target.closest('.audio-segment')) return;
    if (e.target.closest('.playhead')) return;
    if (e.target.closest('.playhead-cap')) return;
    clearSelection();
  }
}, true);

/* ============================================
   Misc
   ============================================ */
function closeEditor() {
  if (confirm('إغلاق المشروع؟')) window.location.href = 'index.html';
}

function exportVideo() {
  alert('التصدير راح يتوفر قريباً!');
}

function undoAction() {}
function redoAction() {}
/* ============================================
   🎨 BACKGROUND SEGMENT + FILTERS
   ============================================ */

// المتغيرات العامة للخلفية
state.bgFilters = {
  blur: 0,
  brightness: 100,
  saturation: 100,
  contrast: 100,
  opacity: 100,
  hue: 0
};

/* ============================================
   🎨 Update BG Segment in Timeline
   ============================================ */
function updateBgSegment() {
  const seg = document.getElementById('bgSegment');
  if (!seg) return;

  if (!state.bgUrl) {
    seg.classList.add('hidden');
    return;
  }

  seg.classList.remove('hidden');

  // نفس طول الأغنية (إذا كاينة)، وإلا كيتبع آخر كلمة
  const start = hasAudio() ? state.audioStart : 0;
  const end = hasAudio() ? state.audioEnd : getTimelineDuration();

  seg.style.left = (start * PX_PER_SEC) + 'px';
  seg.style.width = ((end - start) * PX_PER_SEC) + 'px';
}

/* ============================================
   🎨 Apply BG Filters to Image
   ============================================ */
function applyBgFilters() {
  const bgImg = document.getElementById('bgImage');
  if (!bgImg) return;

  const f = state.bgFilters;
  bgImg.style.filter =
    'blur(' + f.blur + 'px) ' +
    'brightness(' + f.brightness + '%) ' +
    'saturate(' + f.saturation + '%) ' +
    'contrast(' + f.contrast + '%) ' +
    'hue-rotate(' + f.hue + 'deg)';
  bgImg.style.opacity = (f.opacity / 100).toString();
}

/* ============================================
   🎨 Init BG Filters Controls
   ============================================ */
function initBgFilters() {
  const pairs = [
    { range: 'bgBlurRange', val: 'bgBlurVal', key: 'blur' },
    { range: 'bgBrightnessRange', val: 'bgBrightnessVal', key: 'brightness' },
    { range: 'bgSaturationRange', val: 'bgSaturationVal', key: 'saturation' },
    { range: 'bgContrastRange', val: 'bgContrastVal', key: 'contrast' },
    { range: 'bgOpacityRange', val: 'bgOpacityVal', key: 'opacity' },
    { range: 'bgHueRange', val: 'bgHueVal', key: 'hue' }
  ];

  pairs.forEach(function(p) {
    const r = document.getElementById(p.range);
    const v = document.getElementById(p.val);
    if (!r) return;

    r.addEventListener('input', function(e) {
      const value = parseInt(e.target.value);
      state.bgFilters[p.key] = value;
      if (v) v.textContent = value;
      applyBgFilters();
    });
  });
}

/* ============================================
   🎨 Reset BG Filters
   ============================================ */
function resetBgFilters() {
  state.bgFilters = {
    blur: 0,
    brightness: 100,
    saturation: 100,
    contrast: 100,
    opacity: 100,
    hue: 0
  };

  // Reset UI
  const setVal = function(id, value) {
    const el = document.getElementById(id);
    if (el) el.value = value;
  };
  const setText = function(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  };

  setVal('bgBlurRange', 0); setText('bgBlurVal', 0);
  setVal('bgBrightnessRange', 100); setText('bgBrightnessVal', 100);
  setVal('bgSaturationRange', 100); setText('bgSaturationVal', 100);
  setVal('bgContrastRange', 100); setText('bgContrastVal', 100);
  setVal('bgOpacityRange', 100); setText('bgOpacityVal', 100);
  setVal('bgHueRange', 0); setText('bgHueVal', 0);

  applyBgFilters();

  if (navigator.vibrate) try { navigator.vibrate(15); } catch (e) {}
}

/* ============================================
   🎨 Select BG Segment
   ============================================ */
function selectBg() {
  state.selectedType = 'bg';
  state.selectedIndex = -1;
  renderTimeline();
  renderBgSelection();
  showCapcutMenu('bg');
  if (navigator.vibrate) try { navigator.vibrate(10); } catch (e) {}
}

function renderBgSelection() {
  const seg = document.getElementById('bgSegment');
  if (!seg) return;
  seg.classList.toggle('selected', state.selectedType === 'bg');
}
