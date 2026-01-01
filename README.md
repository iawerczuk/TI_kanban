
# Kanban API – tablica zadań

Aplikacja realizująca prostą tablicę Kanban z trzema kolumnami (Todo, Doing, Done) oraz zarządzaniem kolejnością zadań.

---

## Technologia

- **Backend:** Node.js (Express)
- **Baza danych:** SQLite
- **Interfejs:** katalog `public/`

---

## Uruchomienie

1. Zainstaluj zależności:
   ```bash
   npm install

```

2. Uruchom serwer:
```bash
node server.js

```


3. Adres aplikacji: [http://localhost:5052](https://www.google.com/search?q=http://localhost:5052)

---

## Zakres funkcjonalny

### Kolumny

* Predefiniowane kolumny: **Todo, Doing, Done**.
* Każda kolumna posiada pole `ord` określające kolejność wyświetlania.

### Zadania

* Dodawanie zadań (tytuł).
* Przypisanie zadania do konkretnej kolumny.
* Automatyczne ustawianie `ord` (pozycji) wewnątrz kolumny.
* Przenoszenie zadania do innej kolumny (zmiana `col_id` oraz `ord`).
* Zachowanie stabilnej kolejności elementów po przeniesieniu.

---

## Model danych

* `columns(id, name, ord)`
* `tasks(id, title, col_id → columns.id, ord)`

---

## API

* `GET /api/board` – zwraca pełną strukturę tablicy (kolumny i zadania posortowane według `ord`).
* `POST /api/tasks` – dodanie nowego zadania (przypisuje `ord = MAX + 1`).
* `POST /api/tasks/{id}/move` – przeniesienie zadania do innej kolumny lub zmiana pozycji.

---

## Walidacja i statusy HTTP

* **201 Created** – poprawne utworzenie zadania.
* **200 OK** – poprawna operacja.
* **400 Bad Request** – błędne dane wejściowe.
* **404 Not Found** – brak zasobu (np. nieistniejące zadanie).
* **500 Internal Server Error** – błąd serwera.

---

## Bezpieczeństwo

* Nagłówek `X-Content-Type-Options: nosniff`.
* Nagłówek `Referrer-Policy: no-referrer`.
* Nagłówek `Cache-Control: no-store` dla endpointów API.
* Wyłączony nagłówek `X-Powered-By`.

---

## Testowanie

Plik `tests.http` lub `tests.rest` zawiera przykładowe wywołania endpointów API. Testy zostały przeprowadzone przy użyciu rozszerzenia **REST Client** dla Visual Studio Code.
