/*
  Logika samodzielnej strony.
  Sam komponent playera znajduje się w media-player.js.

  Strona działa w dwóch trybach:
  1. file://  - można po prostu otworzyć index.html i odtwarzać plik wybrany z dysku,
  2. http://  - po uruchomieniu server.js plik jest wysyłany do public/uploads.
*/

const STORAGE_KEY = 'student-mediaplayer-project-v2';
const playerRoot = document.querySelector('#player');
const statusBox = document.querySelector('#status');
const uploadButton = document.querySelector('#upload-button');
const fileModeHeading = document.querySelector('#file-mode-heading');
const modeInfo = document.querySelector('#mode-info');

const isLocalFileMode = window.location.protocol === 'file:';

// Formatow takich jak AVI/MKV przegladarka zwykle nie dekoduje sama.
// W trybie serwerowym przyjmuje je backend i FFmpeg zamienia na MP4 H.264/AAC.
const legacyExtensions = new Set([
  '.avi', '.mkv', '.divx', '.xvid', '.mpg', '.mpeg', '.wmv', '.flv',
  '.3gp', '.3g2', '.ts', '.mts', '.m2ts'
]);

function getFileExtension(name = '') {
  const match = String(name).toLowerCase().match(/\.[^.]+$/);
  return match ? match[0] : '';
}

function canProbablyPlayLocally(file) {
  const ext = getFileExtension(file.name);

  if (legacyExtensions.has(ext)) return false;

  // canPlayType nie daje 100% gwarancji, bo znaczenie ma tez kodek wewnatrz kontenera,
  // ale pozwala odrzucic najbardziej oczywiste przypadki.
  if (file.type) {
    return player.video.canPlayType(file.type) !== '';
  }

  return ['.mp4', '.m4v', '.webm', '.ogg', '.ogv', '.mov'].includes(ext);
}

// Obiektowe adresy URL tworzone dla plików z dysku działają tylko do zamknięcia karty.
// Zapamiętujemy je, aby później móc zwolnić pamięć.
const localObjectUrls = new Set();

function setStatus(message, type = '') {
  statusBox.textContent = message;
  statusBox.className = `status ${type}`.trim();
}

function configureModeDescription() {
  if (isLocalFileMode) {
    fileModeHeading.textContent = '1. Otwórz plik z dysku';
    uploadButton.textContent = 'Otwórz i dodaj do kolejki';
    modeInfo.innerHTML =
      'Tryb <strong>bez serwera</strong>. Wybrany film jest odtwarzany bezpośrednio z dysku i działa do zamknięcia tej karty. ' +
      'Aby zapisywać uploadowane filmy w katalogu <code>public/uploads</code>, uruchom projekt przez <code>npm start</code>. ' +
      'Formaty AVI, MKV, DivX/Xvid, WMV i podobne wymagają trybu serwerowego, ponieważ są wtedy konwertowane przez FFmpeg.';
  } else {
    fileModeHeading.textContent = '1. Wyślij plik na serwer';
    uploadButton.textContent = 'Wyślij i dodaj do kolejki';
    modeInfo.innerHTML =
      'Tryb <strong>serwerowy</strong>. Plik wybrany z dysku jest wysyłany do <code>public/uploads</code>. ' +
      'Kolejka, sekcje i komentarze są dodatkowo zapisywane w <code>localStorage</code>. ' +
      'Serwer przyjmuje m.in. MP4, AVI, MKV, DivX/Xvid, MOV, WebM, WMV i zamienia upload na MP4 H.264/AAC.';
  }
}

function loadSavedData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw);

    // Na wypadek danych ze starszej wersji pomijamy tymczasowe adresy blob:.
    if (Array.isArray(parsed.playlist)) {
      parsed.playlist = parsed.playlist.filter((item) => !String(item.src || '').startsWith('blob:'));
    }

    return parsed;
  } catch (error) {
    console.warn('Nie udało się odczytać localStorage:', error);
    return null;
  }
}

function savePersistentData(data) {
  try {
    // Pliku wybranego lokalnie nie da się sensownie zapisać w localStorage.
    // Adres blob: przestaje działać po zamknięciu karty, dlatego go pomijamy.
    const persistentData = {
      version: data.version || 1,
      playlist: (data.playlist || []).filter((item) => !String(item.src || '').startsWith('blob:'))
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(persistentData));
  } catch (error) {
    // W części przeglądarek localStorage dla file:// może być ograniczony.
    console.warn('Nie udało się zapisać localStorage:', error);
  }
}

const savedData = loadSavedData();

const player = new MediaPlayer(playerRoot, {
  data: savedData || {
    version: 1,
    playlist: [
      {
        title: 'Film demonstracyjny',
        // Ścieżka względna działa zarówno po dwukliku index.html, jak i po npm start.
        src: 'media/sample.mp4',
        sections: [
          {
            title: 'Początek',
            start: 0,
            end: 4,
            comments: ['Przykładowy komentarz do pierwszej sekcji.']
          },
          {
            title: 'Druga część',
            start: 4,
            end: 8,
            comments: ['Sekcje są widoczne także na osi czasu.']
          }
        ]
      }
    ]
  }
});

configureModeDescription();

async function showServerCodecStatus() {
  if (isLocalFileMode) return;

  try {
    const response = await fetch('api/status');
    if (!response.ok) return;

    const info = await response.json();
    if (info.ffmpeg) {
      modeInfo.innerHTML += '<br><strong>FFmpeg wykryty:</strong> rozszerzona konwersja formatów jest gotowa.';
    } else {
      modeInfo.innerHTML += '<br><strong>FFmpeg nie został wykryty.</strong> Zainstaluj go, aby działały AVI/MKV/DivX/Xvid.';
    }
  } catch (error) {
    console.warn('Nie udało się sprawdzić statusu FFmpeg:', error);
  }
}

showServerCodecStatus();

// Czytelny komunikat, gdy przeglądarka nie obsługuje formatu lub kodeka filmu.
player.video.addEventListener('error', () => {
  setStatus(
    'Nie udało się odtworzyć tego filmu bezpośrednio w przeglądarce. W trybie serwerowym użyj uploadu - FFmpeg przekonwertuje AVI/MKV/DivX/Xvid i inne formaty do MP4 H.264/AAC.',
    'error'
  );
});

// Każda zmiana w komponencie jest zapisywana lokalnie w przeglądarce.
playerRoot.addEventListener('mediaplayer:change', (event) => {
  savePersistentData(event.detail);
});

function addLocalFile(file, title) {
  if (!file) {
    setStatus('Wybierz plik wideo.', 'error');
    return;
  }

  const ext = getFileExtension(file.name);

  // W trybie file:// nie mamy FFmpeg. Starsze kontenery trzeba najpierw wyslac do serwera.
  if (!canProbablyPlayLocally(file)) {
    setStatus(
      `Format ${ext || file.type || 'tego pliku'} nie jest pewnie obsługiwany bezpośrednio przez przeglądarkę. ` +
        'Uruchom projekt przez npm start i dodaj plik w trybie serwerowym - zostanie automatycznie przekonwertowany przez FFmpeg.',
      'error'
    );
    return;
  }

  const objectUrl = URL.createObjectURL(file);
  localObjectUrls.add(objectUrl);

  player.addMedia({
    title: title || file.name.replace(/\.[^.]+$/, '') || 'Film lokalny',
    src: objectUrl,
    sections: []
  });

  // addMedia nie przełącza filmu, gdy w kolejce jest już pozycja.
  // Po dodaniu lokalnego pliku od razu przechodzimy na ostatnią pozycję.
  player.loadMedia(player.data.playlist.length - 1);

  setStatus(
    'Film został otwarty z dysku. Jest dostępny w tej karcie, ale nie zostanie zapisany po jej zamknięciu.',
    'ok'
  );
}

// Obsługa pliku z dysku.
document.querySelector('#upload-form').addEventListener('submit', async (event) => {
  event.preventDefault();

  const fileInput = document.querySelector('#video-file');
  const titleInput = document.querySelector('#upload-title');
  const file = fileInput.files[0];
  const title = titleInput.value.trim();

  if (!file) {
    setStatus('Wybierz plik wideo.', 'error');
    return;
  }

  // Przy zwykłym otwarciu index.html nie istnieje serwer /api/upload.
  // Zamiast udawać, że upload działa, korzystamy z URL.createObjectURL().
  if (isLocalFileMode) {
    addLocalFile(file, title);
    event.target.reset();
    return;
  }

  const formData = new FormData();
  formData.append('video', file);
  setStatus('Wysyłanie i przygotowywanie filmu... Przy AVI/MKV konwersja może potrwać chwilę.');

  try {
    const response = await fetch('api/upload', {
      method: 'POST',
      body: formData
    });

    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Nie udało się wysłać filmu.');

    player.addMedia({
      title: title || result.title,
      src: result.src,
      sections: []
    });
    player.loadMedia(player.data.playlist.length - 1);

    event.target.reset();
    const formatInfo = result.transcoded
      ? ` ${result.originalFormat || ''} -> ${result.outputFormat || '.mp4'} (H.264/AAC).`
      : '';
    setStatus(`Film został zapisany na serwerze i dodany do kolejki.${formatInfo}`, 'ok');
  } catch (error) {
    setStatus(`Błąd uploadu: ${error.message}`, 'error');
  }
});

// Dodanie filmu przez gotowy adres URL albo ścieżkę z hostingu.
document.querySelector('#url-form').addEventListener('submit', (event) => {
  event.preventDefault();

  const title = document.querySelector('#url-title').value.trim();
  const src = document.querySelector('#video-url').value.trim();

  if (!src) {
    setStatus('Podaj adres filmu.', 'error');
    return;
  }

  try {
    player.addMedia({
      title: title || 'Film z adresu URL',
      src,
      sections: []
    });
    player.loadMedia(player.data.playlist.length - 1);
    event.target.reset();
    setStatus('Adres filmu został dodany do kolejki.', 'ok');
  } catch (error) {
    setStatus(error.message, 'error');
  }
});

// Eksport całego opisu: kolejka + sekcje + komentarze.
document.querySelector('#export-button').addEventListener('click', () => {
  const hasLocalFile = player.data.playlist.some((item) => String(item.src || '').startsWith('blob:'));

  if (hasLocalFile) {
    setStatus(
      'Uwaga: kolejka zawiera plik otwarty bezpośrednio z dysku. Jego adres blob: działa tylko w tej karcie.',
      'error'
    );
  }

  player.downloadDescription();
  if (!hasLocalFile) setStatus('Wyeksportowano opis do pliku JSON.', 'ok');
});

// Import pliku JSON.
document.querySelector('#import-file').addEventListener('change', async (event) => {
  const file = event.target.files[0];
  if (!file) return;

  try {
    const text = await file.text();
    const data = JSON.parse(text);
    player.loadDescription(data);
    setStatus('Zaimportowano opis playera.', 'ok');
  } catch (error) {
    setStatus(`Błąd importu: ${error.message}`, 'error');
  } finally {
    event.target.value = '';
  }
});

document.querySelector('#clear-button').addEventListener('click', () => {
  if (!confirm('Wyczyścić kolejkę, sekcje i komentarze zapisane w przeglądarce?')) return;

  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.warn('Nie udało się wyczyścić localStorage:', error);
  }

  player.loadDescription({ version: 1, playlist: [] });
  setStatus('Dane lokalne zostały wyczyszczone.', 'ok');
});

// Zwolnienie tymczasowych adresów po zamknięciu strony.
window.addEventListener('beforeunload', () => {
  localObjectUrls.forEach((url) => URL.revokeObjectURL(url));
});
