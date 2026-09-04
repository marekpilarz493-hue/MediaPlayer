# Testy projektu MediaPlayer

## Testy sprawdzone podczas przygotowania projektu

| Nr | Scenariusz | Oczekiwany wynik | Wynik |
|---|---|---|---|
| 1 | Załadowanie komponentu z filmem demonstracyjnym | Widać film, kolejkę i 2 sekcje | OK |
| 2 | Odczyt metadanych filmu | `duration` jest dostępne i oś czasu może zostać narysowana | OK |
| 3 | Dodanie komentarza do sekcji | Komentarz pojawia się na karcie sekcji | OK |
| 4 | Przejście do drugiego filmu w kolejce | Zmienia się tytuł i źródło filmu | OK |
| 5 | Usunięcie filmu z kolejki | Pozycja znika, aktywny film jest aktualizowany | OK |
| 6 | Eksport danych przez `exportDescription()` | Obiekt ma `version`, `exportedAt` i `playlist` | OK |
| 7 | Uruchomienie wersji osadzanej | Player działa bez `app.js` | OK |
| 8 | Sprawdzenie składni plików JS przez `node --check` | Brak błędów składni | OK |

## Testy do wykonania po `npm install`

Te testy wymagają uruchomienia serwera Node.js z zależnościami Express i Multer:

1. `npm install` i `npm start`.
2. Upload pliku MP4 przez formularz.
3. Sprawdzenie, czy plik pojawił się w `public/uploads`.
4. Sprawdzenie, czy zwrócony adres filmu działa w `<video>`.
5. Próba uploadu niedozwolonego pliku, np. TXT - serwer powinien odrzucić plik.
6. Eksport JSON, wyczyszczenie danych i ponowny import.
7. Odświeżenie strony i sprawdzenie danych z `localStorage`.
8. Otworzenie `/embed-demo.html` z działającego serwera.

## Testy rozszerzonej kompatybilności FFmpeg

1. Sprawdzenie `ffmpeg -version` przed uruchomieniem serwera.
2. Upload pliku AVI z kodekiem Xvid/DivX - serwer powinien utworzyć plik MP4 w `public/uploads`.
3. Upload pliku MKV - wynik powinien być MP4 H.264/AAC i odtwarzać się w `<video>`.
4. Upload pliku WMV lub MPEG - oczekiwany taki sam proces konwersji.
5. Sprawdzenie, czy oryginalny plik po udanej konwersji nie zostaje w `temp-uploads`.
6. Próba pliku z dozwolonym rozszerzeniem, ale uszkodzoną zawartością - serwer powinien zwrócić czytelny błąd FFmpeg.
7. Otworzenie `index.html` przez `file://` i wybranie AVI - strona powinna poinformować, że ten format wymaga trybu serwerowego.
8. Wejście na `/api/status` - `ffmpeg` powinno mieć wartość `true` na poprawnie skonfigurowanym komputerze.
