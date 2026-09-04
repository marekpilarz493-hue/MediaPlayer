// Prosty serwer do projektu MediaPlayer.
// Udostepnia strone, przyjmuje pliki wideo i przez FFmpeg zamienia je na MP4 H.264/AAC.
// Dzieki temu przegladarka nie musi bezposrednio obslugiwac AVI, MKV, DivX/Xvid itd.

const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { spawn, spawnSync } = require('child_process');

const app = express();
const PORT = process.env.PORT || 3000;
const FFMPEG_PATH = process.env.FFMPEG_PATH || 'ffmpeg';

const publicDir = path.join(__dirname, 'public');
const uploadsDir = path.join(publicDir, 'uploads');
const tempUploadsDir = path.join(__dirname, 'temp-uploads');

// Plik najpierw trafia do katalogu tymczasowego, a dopiero po konwersji do public/uploads.
fs.mkdirSync(uploadsDir, { recursive: true });
fs.mkdirSync(tempUploadsDir, { recursive: true });

const allowedExtensions = new Set([
  '.mp4', '.m4v', '.mov', '.webm', '.ogg', '.ogv',
  '.avi', '.mkv', '.divx', '.xvid', '.mpg', '.mpeg',
  '.wmv', '.flv', '.3gp', '.3g2', '.ts', '.mts', '.m2ts'
]);

function safeBaseName(originalName) {
  const ext = path.extname(originalName);
  return (
    path
      .basename(originalName, ext)
      .replace(/[^a-zA-Z0-9-_]/g, '_')
      .slice(0, 60) || 'video'
  );
}

// Multer zapisuje oryginalny plik tylko tymczasowo.
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, tempUploadsDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e6)}-${safeBaseName(file.originalname)}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: {
    // To nadal projekt studencki, wiec nie robimy tutaj serwisu do archiwizacji kina.
    fileSize: 500 * 1024 * 1024
  },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();

    // Nie opieramy sie tylko na MIME, bo starsze AVI/MKV czasem przychodza jako application/octet-stream.
    if (allowedExtensions.has(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`Nieobslugiwane rozszerzenie pliku: ${ext || '(brak)'}.`));
    }
  }
});

function isFfmpegAvailable() {
  const check = spawnSync(FFMPEG_PATH, ['-version'], { stdio: 'ignore' });
  return !check.error && check.status === 0;
}

const ffmpegAvailableAtStart = isFfmpegAvailable();

// FFmpeg normalizuje kazdy upload do jednego formatu przyjaznego przegladarkom.
// Nie uzywamy shell:true, dlatego nazwa pliku nie jest interpretowana jako polecenie systemowe.
function transcodeToMp4(inputPath, outputPath) {
  return new Promise((resolve, reject) => {
    const args = [
      '-hide_banner',
      '-loglevel', 'error',
      '-y',
      '-i', inputPath,
      '-map', '0:v:0',
      '-map', '0:a:0?',
      '-c:v', 'libx264',
      '-preset', 'veryfast',
      '-crf', '23',
      '-pix_fmt', 'yuv420p',
      '-c:a', 'aac',
      '-b:a', '128k',
      '-movflags', '+faststart',
      outputPath
    ];

    const process = spawn(FFMPEG_PATH, args, { windowsHide: true });
    let errorText = '';

    process.stderr.on('data', (chunk) => {
      // Zachowujemy tylko koncowke komunikatu, zeby blad nie mial kilku megabajtow.
      errorText += chunk.toString();
      if (errorText.length > 12000) errorText = errorText.slice(-12000);
    });

    process.on('error', (error) => {
      reject(new Error(`Nie udalo sie uruchomic FFmpeg: ${error.message}`));
    });

    process.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`FFmpeg nie mogl przekonwertowac pliku. ${errorText.trim()}`));
      }
    });
  });
}

app.use(express.json({ limit: '2mb' }));
app.use(express.static(publicDir));

// Frontend moze sprawdzic, czy serwer widzi FFmpeg.
app.get('/api/status', (req, res) => {
  res.json({
    ffmpeg: isFfmpegAvailable(),
    inputExtensions: Array.from(allowedExtensions).sort(),
    output: 'MP4 / H.264 / AAC'
  });
});

// Upload jednego filmu.
// Niezaleznie od formatu wejsciowego wynik trafia do public/uploads jako MP4 H.264/AAC.
app.post('/api/upload', upload.single('video'), async (req, res, next) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Nie przeslano pliku wideo.' });
  }

  const inputPath = req.file.path;
  const originalExt = path.extname(req.file.originalname).toLowerCase();
  const outputFileName = `${Date.now()}-${Math.round(Math.random() * 1e6)}-${safeBaseName(req.file.originalname)}.mp4`;
  const outputPath = path.join(uploadsDir, outputFileName);

  try {
    if (!isFfmpegAvailable()) {
      throw new Error(
        'Na serwerze nie znaleziono FFmpeg. Zainstaluj FFmpeg i sprawdz poleceniem: ffmpeg -version.'
      );
    }

    await transcodeToMp4(inputPath, outputPath);

    const stat = fs.statSync(outputPath);

    res.status(201).json({
      title: path.basename(req.file.originalname, path.extname(req.file.originalname)),
      src: `/uploads/${outputFileName}`,
      size: stat.size,
      originalFormat: originalExt || 'nieznany',
      outputFormat: '.mp4',
      transcoded: true
    });
  } catch (error) {
    // Nie zostawiamy polowicznie utworzonego MP4.
    if (fs.existsSync(outputPath)) fs.rmSync(outputPath, { force: true });
    next(error);
  } finally {
    // Oryginalny plik byl tylko materialem do konwersji.
    if (fs.existsSync(inputPath)) fs.rmSync(inputPath, { force: true });
  }
});

// Pokazuje gotowe filmy, czyli tylko te, ktore player moze bezpiecznie odtwarzac w przegladarce.
app.get('/api/videos', (req, res) => {
  const files = fs
    .readdirSync(uploadsDir)
    .filter((name) => name !== '.gitkeep' && path.extname(name).toLowerCase() === '.mp4')
    .map((name) => ({ name, src: `/uploads/${name}` }));

  res.json(files);
});

app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ error: `Blad uploadu: ${err.message}` });
  }

  if (err) {
    console.error(err.message || err);
    return res.status(400).json({ error: err.message || 'Wystapil blad serwera.' });
  }

  next();
});

app.listen(PORT, () => {
  console.log(`MediaPlayer dziala na http://localhost:${PORT}`);

  if (ffmpegAvailableAtStart) {
    console.log('FFmpeg: wykryty - konwersja AVI/MKV/DivX/Xvid jest dostepna.');
  } else {
    console.warn('FFmpeg: NIE znaleziono. Upload starszych formatow nie bedzie dzialal do czasu instalacji FFmpeg.');
  }
});
