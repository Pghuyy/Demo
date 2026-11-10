(() => {
  'use strict';
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];
  const gradeKeys = ['10', '11', '12'];
  const letters = gradeKeys.flatMap(grade => (HEART_DATA[grade] || []).map((entry, index) => ({
    ...entry, grade, index, title: entry.name, content: LETTER_CONTENT[entry.id] || ''
  })));
  const state = { grade: 'all', query: '' };
  const heartRows = [4, 6, 7, 7, 6, 4, 2];
  const safeMedia = Array.isArray(MEDIA_ITEMS) ? MEDIA_ITEMS.filter(x => x && typeof x.title === 'string' && typeof x.src === 'string' && x.src.trim()) : [];
  let typingTimer = 0, typingToken = 0, toastTimer = 0;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function normalize(value) {
    return String(value).toLocaleLowerCase('vi').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd');
  }
  function getFiltered() {
    const q = normalize(state.query);
    return letters.filter(x => (state.grade === 'all' || x.grade === state.grade) &&
      (!q || normalize(`${x.title} ${x.specialty} khối ${x.grade}`).includes(q)));
  }
  function showToast(message) {
    const el = $('#toast'); el.textContent = message; el.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('show'), 2200);
  }
  function createHeart(item, order) {
    const button = document.createElement('button');
    button.type = 'button'; button.className = `heart-node grade-${item.grade}`;
    button.dataset.id = item.id; button.style.setProperty('--delay', `${(order % 18) * 24}ms`);
    button.setAttribute('aria-label', `Mở thư ${item.title}`);
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 100 100'); svg.setAttribute('aria-hidden', 'true');
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', 'M50 88 C43 81 12 60 8 39 C4 18 29 5 46 22 C48 24 49 26 50 28 C51 26 52 24 54 22 C71 5 96 18 92 39 C88 60 57 81 50 88 Z');
    svg.append(path);
    const label = document.createElement('span'); label.className = 'node-label';
    label.textContent = item.title.replace(/^(\d+)\s+/, '$1\n');
    button.append(svg, label);
    button.addEventListener('click', () => openLetter(item));
    return button;
  }
  function renderHearts() {
    const canvas = $('#heartCanvas'), filtered = getFiltered();
    canvas.replaceChildren();
    const ids = new Set(filtered.map(x => x.id));
    let index = 0, order = 0;
    heartRows.forEach((count, rowIndex) => {
      const row = document.createElement('div'); row.className = `heart-row row-${rowIndex + 1}`;
      for (let j = 0; j < count; j++) {
        const item = letters[index++];
        if (item && ids.has(item.id)) row.append(createHeart(item, order++));
      }
      if (row.childElementCount) canvas.append(row);
    });
    canvas.classList.toggle('filtered', state.grade !== 'all' || !!state.query);
    $('#searchEmpty').hidden = filtered.length > 0;
    $('#resultCount')?.replaceChildren(document.createTextNode(`${filtered.length} lớp`));
  }
  function stopTyping() {
    typingToken++; clearTimeout(typingTimer); typingTimer = 0;
  }
  function typeLetter(text) {
    stopTyping();
    const token = typingToken, target = $('#dialogCopy');
    target.textContent = '';
    if (reduceMotion) { target.textContent = text; return; }
    const chars = Array.from(text);
    // Adaptive pacing: longer letters move faster, punctuation still gets a small pause.
    const base = Math.max(9, Math.min(23, 7600 / Math.max(chars.length, 1)));
    let index = 0;
    const tick = () => {
      if (token !== typingToken || !$('#letterDialog').open) return;
      const batch = chars.length > 500 ? 2 : 1;
      target.textContent += chars.slice(index, index + batch).join('');
      index += batch;
      if (index >= chars.length) return;
      const previous = chars[index - 1] || '';
      const pause = /[.!?。！？]/u.test(previous) ? 115 : /[,;:，；：]/u.test(previous) ? 55 : 0;
      typingTimer = setTimeout(tick, base + pause);
    };
    typingTimer = setTimeout(tick, 180);
  }
  function openLetter(item) {
    stopTyping();
    $('#dialogGrade').textContent = `KHỐI ${item.grade} · CHUYÊN ${item.specialty.toLocaleUpperCase('vi')}`;
    $('#dialogTitle').textContent = item.title;
    const dialog = $('#letterDialog');
    if (!dialog.open) dialog.showModal();
    typeLetter(item.content || 'Lời nhắn của lớp này sẽ được cập nhật.');
  }
  $('#closeDialog').addEventListener('click', () => { stopTyping(); $('#letterDialog').close(); });
  $('#letterDialog').addEventListener('close', stopTyping);
  $('#letterDialog').addEventListener('click', e => {
    if (e.target === $('#letterDialog')) { stopTyping(); $('#letterDialog').close(); }
  });

  $$('.grade-tab').forEach(button => button.addEventListener('click', () => {
    state.grade = button.dataset.grade;
    $$('.grade-tab').forEach(tab => {
      const active = tab === button; tab.classList.toggle('active', active);
      tab.setAttribute('aria-pressed', String(active));
    });
    renderHearts();
  }));
  $('#heartSearch').addEventListener('input', e => {
    state.query = e.target.value.trim(); $('#clearSearch').hidden = !state.query; renderHearts();
  });
  $('#clearSearch').addEventListener('click', () => {
    $('#heartSearch').value = ''; state.query = ''; $('#clearSearch').hidden = true;
    renderHearts(); $('#heartSearch').focus();
  });
  $('#randomLetter').addEventListener('click', () => {
    const options = getFiltered();
    if (!options.length) return showToast('Chưa tìm thấy lớp phù hợp.');
    openLetter(options[Math.floor(Math.random() * options.length)]);
  });

  function mediaType(item) {
    if (item.type === 'video' || item.type === 'image') return item.type;
    return /\.(mp4|webm|mov|m4v|ogv)(?:\?|$)/i.test(item.src) ? 'video' : 'image';
  }
  function selectMedia(item) {
    const kind = mediaType(item), video = $('#memoryPlayer'), image = $('#memoryImage');
    video.pause(); video.removeAttribute('src'); video.removeAttribute('poster'); video.load();
    image.removeAttribute('src'); video.hidden = kind !== 'video'; image.hidden = kind !== 'image';
    if (kind === 'video') {
      video.src = item.src; if (item.poster) video.poster = item.poster; video.load();
    } else { image.src = item.src; image.alt = item.title; }
    $('#memoryEmpty').hidden = true;
    $('#mediaName').textContent = item.title;
    $('#mediaMeta').textContent = kind === 'video' ? 'Video · Nhấn phát để xem' : 'Ảnh · Khoảnh khắc được lưu lại';
    $$('.media-card').forEach(card => {
      const active = card.dataset.src === item.src;
      card.classList.toggle('active', active); card.setAttribute('aria-pressed', String(active));
    });
  }
  function renderMedia() {
    const gallery = $('#sharedGallery'); gallery.replaceChildren();
    $('#sharedMediaCount').textContent = `${safeMedia.length} nội dung`;
    $('#mediaCount').textContent = `${safeMedia.length} mục`;
    if (!safeMedia.length) {
      const empty = document.createElement('p'); empty.className = 'empty-library';
      empty.textContent = 'Video và hình ảnh sẽ được cập nhật tại đây.'; gallery.append(empty);
      $('#mediaMeta').textContent = 'Đang chờ video nổi bật của các lớp.';
      return;
    }
    safeMedia.forEach(item => {
      const kind = mediaType(item), card = document.createElement('button');
      card.type = 'button'; card.className = 'media-card'; card.dataset.src = item.src;
      card.setAttribute('aria-pressed', 'false'); card.setAttribute('aria-label', `Xem ${item.title}`);
      let preview;
      if (kind === 'video') {
        preview = document.createElement('video'); preview.muted = true; preview.playsInline = true; preview.preload = 'none';
        if (item.poster) preview.poster = item.poster;
      } else { preview = document.createElement('img'); preview.alt = item.title; preview.loading = 'lazy'; }
      preview.src = item.src;
      const caption = document.createElement('span'); caption.textContent = item.title;
      const type = document.createElement('small'); type.textContent = kind === 'video' ? '▶ VIDEO' : '✧ ẢNH';
      card.append(preview, type, caption); card.addEventListener('click', () => selectMedia(item)); gallery.append(card);
    });
    selectMedia(safeMedia.find(x => mediaType(x) === 'video') || safeMedia[0]);
  }

  let dark = true;
  try { dark = localStorage.getItem('chuyenHaLongV5Theme') !== 'light'; } catch {}
  function applyTheme() {
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    $('#themeToggle').textContent = dark ? '☼' : '☾';
    $('#themeToggle').setAttribute('aria-label', dark ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối');
    document.querySelector('meta[name="theme-color"]').content = dark ? '#071521' : '#edf4f7';
  }
  $('#themeToggle').addEventListener('click', () => {
    dark = !dark; applyTheme();
    try { localStorage.setItem('chuyenHaLongV5Theme', dark ? 'dark' : 'light'); } catch {}
  });
  applyTheme();

  if (!reduceMotion) {
    const stars = $('#stars'), count = matchMedia('(max-width:650px)').matches ? 22 : 46;
    for (let i = 0; i < count; i++) {
      const star = document.createElement('i'); star.className = 'star';
      star.style.left = `${(i * 67 + 13) % 100}%`; star.style.top = `${(i * 43 + 7) % 100}%`;
      star.style.setProperty('--duration', `${5 + (i % 5)}s`);
      star.style.setProperty('--delay', `${-(i % 8)}s`); stars.append(star);
    }
  }
  if (!reduceMotion && 'IntersectionObserver' in window) {
    document.documentElement.classList.add('reveal-ready');
    const targets = [$('.heart-section'), $('.footer')].filter(Boolean);
    targets.forEach(node => node.classList.add('reveal'));
    const observer = new IntersectionObserver(entries => entries.forEach(entry => {
      if (entry.isIntersecting) { entry.target.classList.add('is-visible'); observer.unobserve(entry.target); }
    }), { threshold: .08, rootMargin: '0px 0px -35px 0px' });
    targets.forEach(node => observer.observe(node));
  }
  $('#memoryPlayer').addEventListener('ended', () => $('#gardenInvite').classList.add('is-highlighted'));
  renderHearts(); renderMedia();
})();