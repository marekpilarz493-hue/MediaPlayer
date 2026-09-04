# MediaPlayer

Projekt na przedmiot **Zaawansowane aplikacje internetowe**. Jest to prosty webowy odtwarzacz filmów, który może działać jako samodzielna strona albo jako komponent osadzony na istniejącej stronie.

## Opis projektu

MediaPlayer pozwala odtwarzać filmy z hostingu lub przesłane na serwer. Do każdego filmu można utworzyć sekcje czasowe, dodać komentarze i zobaczyć sekcje na osi czasu. Cały opis playlisty można wyeksportować do JSON i później ponownie zaimportować.

Projekt jest celowo prosty: nie ma bazy danych, logowania ani rozbudowanego panelu administracyjnego.

## Najważniejsze funkcje

- odtwarzanie plików wideo przez HTML5 `<video>`,
- lista / kolejka filmów,
- przechodzenie do poprzedniego i następnego filmu,
- automatyczne przejście do następnego filmu po zakończeniu,
- usuwanie filmu z kolejki,
- sekcje filmu z czasem początku i końca,
- komentarze przypisane do sekcji,
- wizualna oś czasu z zaznaczonymi sekcjami,
- kliknięcie osi czasu lub sekcji przenosi do odpowiedniego momentu,
- import i eksport opisu do JSON,
- zapis opisu w `localStorage`,
- dodawanie filmu po URL lub ścieżce,
- upload filmu na serwer,
- automatyczna konwersja uploadowanych filmów przez FFmpeg do MP4 H.264/AAC,
- wejściowa obsługa m.in. MP4, AVI, MKV, DivX/Xvid, MOV, WebM, WMV, MPEG i FLV,
- możliwość osadzenia playera na innej stronie.

## Stack technologiczny

- HTML5,
- CSS3,
- JavaScript ES6 bez frameworka frontendowego,
- Node.js,
- Express,
- Multer do uploadu plików,
- FFmpeg do konwersji formatów i kodeków wideo,
- JSON i localStorage do przechowywania opisu.

## Uruchomienie lokalne

Projekt można uruchomić na dwa sposoby.

### Wariant 1 - bez serwera

Można wejść do katalogu `public` i po prostu otworzyć plik `index.html` w przeglądarce.
W tym trybie:

- działa player, kolejka, sekcje, komentarze i import/eksport JSON,
- można wybrać film z dysku i odtworzyć go od razu, jeśli format/kodek jest natywnie obsługiwany przez przeglądarkę,
- najlepiej działają MP4 H.264/AAC i WebM,
- AVI, MKV, DivX/Xvid, WMV i podobne formaty wymagają wariantu serwerowego z FFmpeg,
- wybrany plik działa tylko w aktualnie otwartej karcie, ponieważ przeglądarka nie pozwala stronie internetowej zapisać sobie dowolnej ścieżki do pliku z komputera.

### Wariant 2 - z serwerem Node.js

Wymagany jest Node.js 18 lub nowszy oraz program **FFmpeg** dostępny w systemie.

Najpierw sprawdź FFmpeg:

```bash
ffmpeg -version
```

Jeśli polecenie nie działa, trzeba zainstalować FFmpeg. Przykładowo:

```text
Windows: winget install Gyan.FFmpeg
Ubuntu/Debian: sudo apt install ffmpeg
macOS z Homebrew: brew install ffmpeg
```

Następnie:

```bash
npm install
npm start
```

Następnie otwórz:

```text
http://localhost:3000
```

W tym trybie plik jest najpierw wysyłany do katalogu tymczasowego, a następnie FFmpeg konwertuje go do **MP4 z wideo H.264 i audio AAC**. Dopiero wynik trafia do `public/uploads`. Oryginalny plik tymczasowy jest usuwany.
Przykład osadzenia komponentu znajduje się pod adresem:

```text
http://localhost:3000/embed-demo.html
```

## Jak dodać film

### Wariant A - upload przez stronę

1. Wybierz plik w formularzu po lewej stronie.
2. Kliknij **Wyślij i dodaj do kolejki**.
3. Serwer uruchomi FFmpeg i przekonwertuje film do MP4 H.264/AAC.
4. Gotowy plik MP4 zostanie zapisany w `public/uploads`.
5. Serwer zwróci jego adres, a player doda film do kolejki.

### Wariant B - film jest już na hostingu

Można wpisać bezpośredni URL:

```text
https://moja-strona.pl/video/film.mp4
```

albo ścieżkę na tym samym hostingu:

```text
/video/film.mp4
```

Przy zewnętrznym hostingu serwer z filmem musi pozwalać przeglądarce na odtwarzanie zasobu.

## Kompatybilność formatów

W przeglądarce format pliku i kodek to dwie różne rzeczy. Przykładowo `.mkv` jest kontenerem i może zawierać różne kodeki. Sam element HTML5 `<video>` nie daje pewnej obsługi AVI, MKV ani starszych kodeków DivX/Xvid.

Dlatego projekt stosuje prostą normalizację po stronie serwera:

```text
AVI / MKV / DivX / Xvid / MOV / WMV / WebM / MPEG / ...
                         |
                       FFmpeg
                         |
                         v
                  MP4 + H.264 + AAC
                         |
                         v
                  HTML5 <video>
```

Obsługiwane rozszerzenia wejściowe w uploadzie to obecnie: `.mp4`, `.m4v`, `.mov`, `.webm`, `.ogg`, `.ogv`, `.avi`, `.mkv`, `.divx`, `.xvid`, `.mpg`, `.mpeg`, `.wmv`, `.flv`, `.3gp`, `.3g2`, `.ts`, `.mts`, `.m2ts`.

To nie znaczy, że każdy uszkodzony lub bardzo nietypowy plik zostanie poprawnie przekonwertowany. Warunkiem jest to, aby zainstalowany FFmpeg potrafił zdekodować zawartość danego pliku.

**Ważne:** rozszerzona kompatybilność dotyczy uploadu przez `npm start`. Po zwykłym dwukliku `index.html` nie ma procesu FFmpeg, więc strona może odtworzyć tylko formaty obsługiwane bezpośrednio przez daną przeglądarkę.

## Osadzanie na istniejącej stronie

Najprostszy wariant:

```html
<link rel="stylesheet" href="/assets/css/player.css">
<div id="my-player"></div>
<script src="/assets/js/media-player.js"></script>
<script>
  new MediaPlayer('#my-player', {
    playlist: [
      {
        title: 'Mój film',
        src: '/media/film.mp4',
        sections: []
      }
    ]
  });
</script>
```

Komponent nie wymaga `app.js`. Ten plik obsługuje tylko dodatkowe formularze samodzielnej strony.

## Import / eksport

Opis jest zapisywany jako JSON. Zawiera:

- wersję formatu,
- playlistę,
- tytuł i adres każdego filmu,
- sekcje,
- czas początku i końca sekcji,
- komentarze.

Przykładowy plik znajduje się w `public/data/sample-description.json`.

## Wdrożenie

Na hostingu z Node.js należy przesłać projekt, a następnie wykonać:

```bash
npm install --omit=dev
PORT=3000 npm start
```

Na hostingu musi być także zainstalowany FFmpeg (albo należy ustawić zmienną `FFMPEG_PATH` wskazującą jego lokalizację). Katalog `public/uploads` oraz katalog `temp-uploads` muszą mieć możliwość zapisu przez proces Node.js. W większej aplikacji filmy lepiej trzymać w osobnej usłudze plikowej, ale na potrzeby tego projektu zapisywane są bezpośrednio na serwerze.

## Struktura katalogów

```text
MediaPlayer-project/
|-- server.js
|-- package.json
|-- temp-uploads/
|-- README.md
|-- CHECKLIST_ODDANIA.md
|-- public/
|   |-- index.html
|   |-- embed-demo.html
|   |-- assets/
|   |   |-- css/
|   |   `-- js/
|   |-- data/
|   |-- media/
|   `-- uploads/
`-- docs/
```

## Dokumentacja

W katalogu `docs` znajdują się:

- `Dokumentacja_MediaPlayer.pdf` - dokumentacja projektu,
- `NAUKA_PROJEKTU.pdf` i `NAUKA_PROJEKTU.md` - materiał do przygotowania się do odpowiedzi,
- `TESTY_MANUALNE.md` - lista testów.

## Repozytorium

Adres repozytorium GitHub należy uzupełnić po jego utworzeniu:

```text
TODO: https://github.com/.../MediaPlayer
```
