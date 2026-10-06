/* ============================================
   🎯 dk.llyric — Editor Logic
   ============================================ */

// ===== State =====
const state = {
  coverUrl: null,
  coverName: '',
  audioUrl: null,
  audioName: '',
  songName: 'اسم الأغنية',
  artistName: 'اسم الفنان',
  lyrics: [
    { text: 'راجع بتقولي اللي ما بينا', time: 0 }
  ]
};

// ===== Init =====
document.addEventListener('DOMContentLoaded', () => {
  initCoverUpload();
  initAudioUpload();
  initTextInputs();
  renderLyrics();
  renderPreview();
});

/* ============================================
   📸 صورة الغلاف
   ============================================ */
function initCoverUpload() {
  const input = document.getElementById('coverInput');
  if (!input) return;
  
  input.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    // تحقق من الحجم (5 ميجا max)
    if (file.size > 5 * 1024 * 1024) {
      alert('الصورة كبيرة بزاف (الأقصى 5MB)');
      return;
    }
    
    // نظف القديم
    if (state.coverUrl) URL.revokeObjectURL(state.coverUrl);
    
    // أنشئ URL جديد
    state.coverUrl = URL.createObjectURL(file);
    state.coverName = file.name;
    
    // حدّث الـ UI
    showCoverPreview(state.coverUrl, file.name);
    renderPreview();
    updateAmbient();
  });
}

function showCoverPreview(url, name) {
  document.getElementById('coverUploadBtn').classList.add('hidden');
  const preview = document.getElementById('coverPreview');
  preview.classList.remove('hidden');
  document.getElementById('coverPreviewImg').src = url;
  document.getElementById('coverPreviewName').textContent = name;
}

function removeCover() {
  if (state.coverUrl) URL.revokeObjectURL(state.coverUrl);
  state.coverUrl = null;
  state.coverName = '';
  
  document.getElementById('coverUploadBtn').classList.remove('hidden');
  document.getElementById('coverPreview').classList.add('hidden');
  document.getElementById('coverInput').value = '';
  
  renderPreview();
  updateAmbient();
}

/* ============================================
   🎵 الأغنية
   ============================================ */
function initAudioUpload() {
  const input = document.getElementById('audioInput');
  if (!input) return;
  
  input.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    // تحقق من الحجم (20 ميجا max)
    if (file.size > 20 * 1024 * 1024) {
      alert('الملف كبير بزاف (الأقصى 20MB)');
      return;
    }
    
    // نظف القديم
    if (state.audioUrl) URL.revokeObjectURL(state.audioUrl);
    
    state.audioUrl = URL.createObjectURL(file);
    state.audioName = file.name;
    
    // عرض الملف
    showAudioPreview(file);
    
    // شغّل الصوت
    const player = document.getElementById('audioPlayer');
    player.src = state.audioUrl;
    player.classList.remove('hidden');
  });
}

function showAudioPreview(file) {
  document.getElementById('audioUploadBtn').classList.add('hidden');
  const preview = document.getElementById('audioPreview');
  preview.classList.remove('hidden');
  
  const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
  document.getElementById('audioPreviewName').textContent = file.name;
  document.getElementById('audioPreviewMeta').textContent = sizeMB + ' MB';
}

function removeAudio() {
  if (state.audioUrl) URL.revokeObjectURL(state.audioUrl);
  state.audioUrl = null;
  state.audioName = '';
  
  document.getElementById('audioUploadBtn').classList.remove('hidden');
  document.getElementById('audioPreview').classList.add('hidden');
  document.getElementById('audioPlayer').classList.add('hidden');
  document.getElementById('audioInput').value = '';
  document.getElementById('audioPlayer').src = '';
}

/* ============================================
   ✏️ Inputs (اسم الأغنية، الفنان)
   ============================================ */
function initTextInputs() {
  const songInput = document.getElementById('songNameInput');
  const artistInput = document.getElementById('artistNameInput');
  
  songInput.addEventListener('input', (e) => {
    state.songName = e.target.value || 'اسم الأغنية';
    renderPreview();
  });
  
  artistInput.addEventListener('input', (e) => {
    state.artistName = e.target.value || 'اسم الفنان';
    renderPreview();
  });
}

/* ============================================
   📝 الكلمات
   ============================================ */
function addLyricLine() {
  state.lyrics.push({ text: '', time: 0 });
  renderLyrics();
}

function removeLyricLine(index) {
  if (state.lyrics.length <= 1) {
    alert('خاصك على الأقل سطر واحد');
    return;
  }
  state.lyrics.splice(index, 1);
  renderLyrics();
  renderPreview();
}

function updateLyricText(index, text) {
  state.lyrics[index].text = text;
  renderPreview();
}

function updateLyricTime(index, time) {
  state.lyrics[index].time = parseFloat(time) || 0;
}

function renderLyrics() {
  const container = document.getElementById('lyricsList');
  if (!container) return;
  
  container.innerHTML = '';
  
  state.lyrics.forEach((lyric, index) => {
    const row = document.createElement('div');
    row.className = 'lyric-row';
    
    // حقل النص
    const textInput = document.createElement('input');
    textInput.type = 'text';
    textInput.className = 'lyric-text-input';
    textInput.placeholder = 'السطر ' + (index + 1);
    textInput.value = lyric.text;
    textInput.addEventListener('input', (e) => updateLyricText(index, e.target.value));
    
    // حقل الوقت
    const timeInput = document.createElement('input');
    timeInput.type = 'number';
    timeInput.className = 'lyric-time-input';
    timeInput.placeholder = 'ثانية';
    timeInput.min = '0';
    timeInput.step = '0.1';
    timeInput.value = lyric.time;
    timeInput.addEventListener('input', (e) => updateLyricTime(index, e.target.value));
    
    // زر الحذف
    const removeBtn = document.createElement('button');
    removeBtn.className = 'lyric-remove-btn';
    removeBtn.textContent = '×';
    removeBtn.onclick = () => removeLyricLine(index);
    
    row.appendChild(textInput);
    row.appendChild(timeInput);
    row.appendChild(removeBtn);
    container.appendChild(row);
  });
}

/* ============================================
   👁️ المعاينة
   ============================================ */
function renderPreview() {
  // اسم الأغنية
  document.getElementById('previewSong').textContent = state.songName;
  document.getElementById('previewArtist').textContent = state.artistName;
  
  // صورة الغلاف
  const cover = document.getElementById('previewCover');
  if (state.coverUrl) {
    cover.src = state.coverUrl;
  } else {
    cover.src = 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=200&q=80';
  }
  
  // أول سطر من الكلمات
  const firstLyric = state.lyrics.find(l => l.text.trim() !== '');
  document.getElementById('previewLyric').textContent = 
    firstLyric ? firstLyric.text : 'اكتب الكلمات...';
}

/* ============================================
   🌫️ الخلفية (تتبع صورة الغلاف)
   ============================================ */
function updateAmbient() {
  const ambient = document.getElementById('ambientBg');
  if (!ambient) return;
  
  if (state.coverUrl) {
    ambient.style.setProperty('--ambient-image', `url('${state.coverUrl}')`);
  } else {
    ambient.style.removeProperty('--ambient-image');
  }
}
