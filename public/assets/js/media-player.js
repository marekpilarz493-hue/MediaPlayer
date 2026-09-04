/*
  MediaPlayer - glowny, wielokrotnego uzytku komponent projektu.
  Nie korzysta z frameworka. To zwykła klasa JavaScript, ktora tworzy player w podanym elemencie.
*/

class MediaPlayer {
  constructor(root, options = {}) {
    this.root = typeof root === 'string' ? document.querySelector(root) : root;

    if (!this.root) {
      throw new Error('Nie znaleziono elementu, w którym ma działać MediaPlayer.');
    }

    this.data = {
      version: 1,
      playlist: []
    };

    this.currentIndex = -1;
    this.activeSectionIndex = -1;

    this.renderLayout();
    this.bindEvents();

    if (options.data) {
      this.loadDescription(options.data);
    } else if (Array.isArray(options.playlist)) {
      options.playlist.forEach((item) => this.addMedia(item, false));
      if (this.data.playlist.length > 0) this.loadMedia(0);
      this.emitChange();
    } else {
      this.renderAll();
    }
  }

  // ---------- Widok komponentu ----------

  renderLayout() {
    this.root.classList.add('media-player');
    this.root.innerHTML = `
      <div class="mp-main">
        <section class="mp-video-column">
          <div class="mp-title-row">
            <h2 class="mp-title">Brak filmu w kolejce</h2>
            <span class="mp-counter">0 / 0</span>
          </div>

          <div class="mp-video-wrap">
            <video class="mp-video" controls preload="metadata"></video>
          </div>

          <div class="mp-nav-controls">
            <button class="mp-button" type="button" data-action="previous">Poprzedni</button>
            <button class="mp-button" type="button" data-action="next">Następny</button>
          </div>

          <div class="mp-timeline-block">
            <h3 class="mp-block-heading">Oś czasu i sekcje</h3>
            <div class="mp-timeline" title="Kliknij, aby przejść do miejsca filmu">
              <div class="mp-progress-marker"></div>
            </div>
          </div>

          <div class="mp-sections-block">
            <h3 class="mp-block-heading">Dodaj sekcję</h3>
            <form class="mp-section-form">
              <div class="mp-form-grid">
                <input name="title" type="text" placeholder="Nazwa sekcji" required>
                <input name="start" type="number" step="0.1" min="0" placeholder="Start [s]" required>
                <input name="end" type="number" step="0.1" min="0" placeholder="Koniec [s]" required>
              </div>
              <div class="mp-form-actions">
                <button class="mp-small-button" type="button" data-action="set-start">Start = teraz</button>
                <button class="mp-small-button" type="button" data-action="set-end">Koniec = teraz</button>
                <button class="mp-small-button" type="submit">Dodaj sekcję</button>
              </div>
            </form>

            <div class="mp-sections-list"></div>
          </div>
        </section>

        <aside class="mp-queue">
          <h3 class="mp-queue-heading">Kolejka odtwarzania</h3>
          <div class="mp-queue-list"></div>
        </aside>
      </div>
    `;

    this.video = this.root.querySelector('.mp-video');
    this.titleElement = this.root.querySelector('.mp-title');
    this.counterElement = this.root.querySelector('.mp-counter');
    this.timelineElement = this.root.querySelector('.mp-timeline');
    this.markerElement = this.root.querySelector('.mp-progress-marker');
    this.queueElement = this.root.querySelector('.mp-queue-list');
    this.sectionsElement = this.root.querySelector('.mp-sections-list');
    this.sectionForm = this.root.querySelector('.mp-section-form');
  }

  bindEvents() {
    this.video.addEventListener('loadedmetadata', () => {
      this.renderTimeline();
    });

    this.video.addEventListener('timeupdate', () => {
      this.updateProgressMarker();
      this.updateActiveSection();
    });

    this.video.addEventListener('ended', () => {
      this.next();
    });

    this.sectionForm.addEventListener('submit', (event) => {
      event.preventDefault();

      const formData = new FormData(this.sectionForm);
      this.addSection({
        title: String(formData.get('title') || '').trim(),
        start: Number(formData.get('start')),
        end: Number(formData.get('end')),
        comments: []
      });

      this.sectionForm.reset();
    });

    // Delegacja zdarzen upraszcza obsluge przyciskow tworzonych dynamicznie.
    this.root.addEventListener('click', (event) => {
      const button = event.target.closest('[data-action]');
      if (!button) return;

      const action = button.dataset.action;

      if (action === 'previous') this.previous();
      if (action === 'next') this.next();
      if (action === 'set-start') this.setSectionTimeField('start');
      if (action === 'set-end') this.setSectionTimeField('end');

      if (action === 'queue-select') {
        this.loadMedia(Number(button.dataset.index));
      }

      if (action === 'queue-remove') {
        this.removeMedia(Number(button.dataset.index));
      }

      if (action === 'jump-section') {
        const section = this.getCurrentMedia()?.sections[Number(button.dataset.index)];
        if (section) {
          this.video.currentTime = section.start;
          this.video.play().catch(() => {});
        }
      }

      if (action === 'delete-section') {
        this.deleteSection(Number(button.dataset.index));
      }

      if (action === 'add-comment') {
        this.addCommentFromInput(Number(button.dataset.index));
      }

      if (action === 'delete-comment') {
        this.deleteComment(Number(button.dataset.sectionIndex), Number(button.dataset.commentIndex));
      }
    });

    this.timelineElement.addEventListener('click', (event) => {
      if (!Number.isFinite(this.video.duration) || this.video.duration <= 0) return;

      const rect = this.timelineElement.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
      this.video.currentTime = ratio * this.video.duration;
    });
  }

  // ---------- Dane playlisty ----------

  createId(prefix = 'item') {
    return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
  }

  normalizeMedia(media) {
    return {
      id: media.id || this.createId('media'),
      title: media.title || 'Film bez tytułu',
      src: media.src || '',
      sections: Array.isArray(media.sections)
        ? media.sections.map((section) => ({
            id: section.id || this.createId('section'),
            title: section.title || 'Sekcja',
            start: Number(section.start) || 0,
            end: Number(section.end) || 0,
            comments: Array.isArray(section.comments) ? section.comments.map(String) : []
          }))
        : []
    };
  }

  addMedia(media, emit = true) {
    if (!media || !media.src) {
      throw new Error('Film musi mieć pole src z adresem pliku.');
    }

    const normalized = this.normalizeMedia(media);
    this.data.playlist.push(normalized);

    if (this.currentIndex === -1) {
      this.loadMedia(0, false);
    } else {
      this.renderQueue();
      this.updateHeader();
    }

    if (emit) this.emitChange();
    return normalized;
  }

  loadMedia(index, emit = false) {
    if (index < 0 || index >= this.data.playlist.length) return;

    this.currentIndex = index;
    this.activeSectionIndex = -1;
    const media = this.getCurrentMedia();

    this.video.src = media.src;
    this.video.load();

    this.renderAll();
    if (emit) this.emitChange();
  }

  next() {
    if (this.data.playlist.length === 0) return;
    const nextIndex = (this.currentIndex + 1) % this.data.playlist.length;
    this.loadMedia(nextIndex);
  }

  previous() {
    if (this.data.playlist.length === 0) return;
    const previousIndex = (this.currentIndex - 1 + this.data.playlist.length) % this.data.playlist.length;
    this.loadMedia(previousIndex);
  }

  getCurrentMedia() {
    return this.data.playlist[this.currentIndex] || null;
  }

  removeMedia(index) {
    if (index < 0 || index >= this.data.playlist.length) return;

    const media = this.data.playlist[index];
    if (!confirm(`Usunąć film \"${media.title}\" z kolejki?`)) return;

    this.data.playlist.splice(index, 1);

    if (this.data.playlist.length === 0) {
      this.currentIndex = -1;
      this.video.removeAttribute('src');
      this.video.load();
      this.renderAll();
    } else {
      if (index < this.currentIndex) this.currentIndex -= 1;
      if (index === this.currentIndex && this.currentIndex >= this.data.playlist.length) {
        this.currentIndex = this.data.playlist.length - 1;
      }

      const current = this.getCurrentMedia();
      this.video.src = current.src;
      this.video.load();
      this.renderAll();
    }

    this.emitChange();
  }

  // ---------- Sekcje i komentarze ----------

  setSectionTimeField(fieldName) {
    const input = this.sectionForm.elements[fieldName];
    if (!input) return;
    input.value = this.video.currentTime.toFixed(1);
  }

  addSection(section) {
    const media = this.getCurrentMedia();
    if (!media) {
      alert('Najpierw dodaj film do kolejki.');
      return;
    }

    if (!section.title || !Number.isFinite(section.start) || !Number.isFinite(section.end)) {
      alert('Uzupełnij nazwe, początek i koniec sekcji.');
      return;
    }

    if (section.start < 0 || section.end <= section.start) {
      alert('Koniec sekcji musi być większy od początku.');
      return;
    }

    if (Number.isFinite(this.video.duration) && section.end > this.video.duration + 0.5) {
      alert('Koniec sekcji wykracza poza długość filmu.');
      return;
    }

    media.sections.push({
      id: this.createId('section'),
      title: section.title,
      start: section.start,
      end: section.end,
      comments: Array.isArray(section.comments) ? section.comments : []
    });

    media.sections.sort((a, b) => a.start - b.start);
    this.renderSections();
    this.renderTimeline();
    this.emitChange();
  }

  deleteSection(index) {
    const media = this.getCurrentMedia();
    if (!media || !media.sections[index]) return;

    if (!confirm(`Usunąć sekcję "${media.sections[index].title}"?`)) return;

    media.sections.splice(index, 1);
    this.activeSectionIndex = -1;
    this.renderSections();
    this.renderTimeline();
    this.emitChange();
  }

  addCommentFromInput(sectionIndex) {
    const media = this.getCurrentMedia();
    const section = media?.sections[sectionIndex];
    if (!section) return;

    const input = this.sectionsElement.querySelector(`[data-comment-input="${sectionIndex}"]`);
    const value = input?.value.trim();
    if (!value) return;

    section.comments.push(value);
    this.renderSections();
    this.emitChange();
  }

  deleteComment(sectionIndex, commentIndex) {
    const section = this.getCurrentMedia()?.sections[sectionIndex];
    if (!section || !section.comments[commentIndex]) return;

    section.comments.splice(commentIndex, 1);
    this.renderSections();
    this.emitChange();
  }

  updateActiveSection() {
    const media = this.getCurrentMedia();
    if (!media) return;

    const time = this.video.currentTime;
    const newIndex = media.sections.findIndex((section) => time >= section.start && time <= section.end);

    if (newIndex !== this.activeSectionIndex) {
      this.activeSectionIndex = newIndex;
      this.renderSections();
    }
  }

  // ---------- Renderowanie danych ----------

  renderAll() {
    this.updateHeader();
    this.renderQueue();
    this.renderSections();
    this.renderTimeline();
    this.updateProgressMarker();
  }

  updateHeader() {
    const media = this.getCurrentMedia();
    this.titleElement.textContent = media ? media.title : 'Brak filmu w kolejce';
    this.counterElement.textContent = media
      ? `${this.currentIndex + 1} / ${this.data.playlist.length}`
      : `0 / ${this.data.playlist.length}`;
  }

  renderQueue() {
    if (this.data.playlist.length === 0) {
      this.queueElement.innerHTML = '<div class="mp-empty">Kolejka jest pusta.</div>';
      return;
    }

    this.queueElement.innerHTML = this.data.playlist
      .map((media, index) => `
        <div class="mp-queue-row">
          <button
            class="mp-queue-item ${index === this.currentIndex ? 'active' : ''}"
            type="button"
            data-action="queue-select"
            data-index="${index}"
          >
            <span class="mp-queue-index">Pozycja ${index + 1}</span>
            ${this.escapeHtml(media.title)}
          </button>
          <button
            class="mp-queue-remove"
            type="button"
            data-action="queue-remove"
            data-index="${index}"
            title="Usuń film z kolejki"
          >x</button>
        </div>
      `)
      .join('');
  }

  renderSections() {
    const media = this.getCurrentMedia();

    if (!media) {
      this.sectionsElement.innerHTML = '<div class="mp-empty">Dodaj film, aby tworzyć sekcje.</div>';
      return;
    }

    if (media.sections.length === 0) {
      this.sectionsElement.innerHTML = '<div class="mp-empty">Ten film nie ma jeszcze sekcji.</div>';
      return;
    }

    this.sectionsElement.innerHTML = media.sections
      .map((section, sectionIndex) => {
        const comments = section.comments.length
          ? `<ul class="mp-comments">${section.comments
              .map((comment, commentIndex) => `
                <li>
                  ${this.escapeHtml(comment)}
                  <button
                    class="mp-small-button danger"
                    type="button"
                    data-action="delete-comment"
                    data-section-index="${sectionIndex}"
                    data-comment-index="${commentIndex}"
                    title="Usuń komentarz"
                  >x</button>
                </li>
              `)
              .join('')}</ul>`
          : '<div class="mp-empty">Brak komentarzy do tej sekcji.</div>';

        return `
          <article class="mp-section-card ${sectionIndex === this.activeSectionIndex ? 'active' : ''}">
            <div class="mp-section-header">
              <div>
                <h4 class="mp-section-title">${this.escapeHtml(section.title)}</h4>
                <div class="mp-section-time">${this.formatTime(section.start)} - ${this.formatTime(section.end)}</div>
              </div>
            </div>

            <div class="mp-section-actions">
              <button class="mp-small-button" type="button" data-action="jump-section" data-index="${sectionIndex}">
                Odtwórz od sekcji
              </button>
              <button class="mp-small-button danger" type="button" data-action="delete-section" data-index="${sectionIndex}">
                Usuń sekcję
              </button>
            </div>

            ${comments}

            <div class="mp-comment-row">
              <input type="text" data-comment-input="${sectionIndex}" placeholder="Komentarz do sekcji">
              <button class="mp-small-button" type="button" data-action="add-comment" data-index="${sectionIndex}">Dodaj</button>
            </div>
          </article>
        `;
      })
      .join('');
  }

  renderTimeline() {
    // Zachowujemy marker, ale sekcje za każdym razem budujemy od nowa.
    this.timelineElement.querySelectorAll('.mp-timeline-section').forEach((el) => el.remove());

    const media = this.getCurrentMedia();
    const duration = this.video.duration;

    if (!media || !Number.isFinite(duration) || duration <= 0) return;

    media.sections.forEach((section, index) => {
      const segment = document.createElement('div');
      segment.className = 'mp-timeline-section';
      segment.style.left = `${Math.max(0, (section.start / duration) * 100)}%`;
      segment.style.width = `${Math.max(0.5, ((section.end - section.start) / duration) * 100)}%`;
      segment.title = `${section.title}: ${this.formatTime(section.start)} - ${this.formatTime(section.end)}`;

      segment.addEventListener('click', (event) => {
        event.stopPropagation();
        this.video.currentTime = section.start;
        this.video.play().catch(() => {});
      });

      segment.dataset.index = index;
      this.timelineElement.appendChild(segment);
    });

    // Marker ma byc nad sekcjami, więc dołączamy go ponownie na koncu.
    this.timelineElement.appendChild(this.markerElement);
  }

  updateProgressMarker() {
    const duration = this.video.duration;
    if (!Number.isFinite(duration) || duration <= 0) {
      this.markerElement.style.left = '0%';
      return;
    }

    const ratio = Math.max(0, Math.min(1, this.video.currentTime / duration));
    this.markerElement.style.left = `${ratio * 100}%`;
  }

  // ---------- Import / export ----------

  exportDescription() {
    return {
      version: 1,
      exportedAt: new Date().toISOString(),
      playlist: this.data.playlist
    };
  }

  downloadDescription(filename = 'mediaplayer-opis.json') {
    const json = JSON.stringify(this.exportDescription(), null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  loadDescription(input) {
    if (!input || !Array.isArray(input.playlist)) {
      throw new Error('Plik opisu nie zawiera poprawnej tablicy playlist.');
    }

    this.data = {
      version: Number(input.version) || 1,
      playlist: input.playlist.map((media) => this.normalizeMedia(media))
    };

    this.currentIndex = this.data.playlist.length > 0 ? 0 : -1;
    this.activeSectionIndex = -1;

    if (this.currentIndex >= 0) {
      const media = this.getCurrentMedia();
      this.video.src = media.src;
      this.video.load();
    } else {
      this.video.removeAttribute('src');
      this.video.load();
    }

    this.renderAll();
    this.emitChange();
  }

  // ---------- Pomocnicze ----------

  emitChange() {
    this.root.dispatchEvent(
      new CustomEvent('mediaplayer:change', {
        detail: this.exportDescription()
      })
    );
  }

  formatTime(seconds) {
    const safe = Number.isFinite(Number(seconds)) ? Math.max(0, Number(seconds)) : 0;
    const minutes = Math.floor(safe / 60);
    const secs = Math.floor(safe % 60).toString().padStart(2, '0');
    return `${minutes}:${secs}`;
  }

  escapeHtml(value) {
    return String(value)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }
}

// Udostępniamy klase globalnie, żeby można bylo jej użyć po zwykłym <script src="...">.
window.MediaPlayer = MediaPlayer;
