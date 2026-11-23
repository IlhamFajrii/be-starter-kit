# REST API Starter Kit

Fondasi REST API yang bisa dipakai ulang: arsitektur modular NestJS, autentikasi JWT dengan refresh token yang bisa dicabut, guard peran, validasi DTO, dan format error yang seragam. Sengaja generik (hanya `auth` dan `users`), tanpa domain bisnis.

Stack: NestJS, TypeScript (strict), Prisma, MySQL, JWT, Docker Compose. Status: `Active` (belum ada pengguna nyata).

## Menjalankan

Prasyarat: Docker dengan Compose.

```bash
docker compose up --build
```

- API: http://localhost:3000
- Swagger: http://localhost:3000/docs

Saat start, container API menjalankan migrasi. Seed akun demo (idempoten) hanya berjalan bila `SEED_DEMO=true`. `docker-compose.yml` menyalakannya untuk demo lokal, sedangkan image-nya sendiri **tidak** men-seed apa pun secara bawaan. Di deployment nyata jangan nyalakan `SEED_DEMO`, karena kredensial demo di bawah bersifat publik.

### Akun demo (fiktif)

| Peran | Email | Password |
|---|---|---|
| ADMIN | `admin@demo.test` | `Admin123!demo` |
| USER | `user@demo.test` | `User123!demo` |

## Endpoint

| Method | Path | Akses |
|---|---|---|
| POST | `/auth/login` | publik. Mengembalikan `accessToken` dan `refreshToken` |
| POST | `/auth/refresh` | publik. Menukar refresh token dengan pasangan baru (rotasi) |
| POST | `/auth/logout` | publik. Mencabut refresh token (204) |
| GET | `/users/me` | login |
| GET, POST | `/users` | ADMIN |
| DELETE | `/users/:id` | ADMIN |

Kirim `Authorization: Bearer <accessToken>`. Semua error berbentuk `{ "statusCode": 401, "error": "Unauthorized", "message": "..." }`. Error validasi memuat `message` berupa daftar, satu entri per field. Respons tidak pernah memuat `passwordHash`.

## Keputusan desain

**Penyimpanan refresh token: tabel database, bukan stateless.** Alasannya: token bisa dicabut (logout, pencurian) dan kita bisa mendeteksi pemakaian ulang. Token acak 48 byte disimpan sebagai hash SHA-256, jadi kebocoran database tidak membocorkan token yang berlaku. Konsekuensinya satu query database per refresh, dan baris token perlu dibersihkan berkala (belum ada job pembersih).

**Rotasi.** Setiap refresh mencabut token lama dan menerbitkan yang baru dalam satu transaksi, lewat `UPDATE ... WHERE revokedAt IS NULL`. Kalau penerbitan token baru gagal, pencabutan ikut dibatalkan. Dua refresh serentak dengan token yang sama: hanya satu berhasil.

**Deteksi pemakaian ulang.** Token yang sudah dicabut lalu dipakai lagi **lebih dari 10 detik** kemudian dianggap kemungkinan dicuri, dan semua sesi pemiliknya dicabut. Dalam 10 detik pertama dianggap balapan wajar (dua tab, retry jaringan): ditolak 401 tanpa mencabut sesi yang baru diterbitkan. Klien yang kalah balapan perlu memakai token hasil rotasi pemenangnya (mis. lewat penyimpanan bersama antar tab).

**Peran dibaca dari database di setiap request**, bukan dari token. User yang dihapus atau diturunkan perannya langsung kehilangan akses. Harganya satu query ringan per request.

**Pesan login seragam.** "Email tidak ada" dan "password salah" menghasilkan respons dan waktu yang sama (bcrypt tetap dijalankan terhadap hash cadangan).

## Variabel lingkungan

Salin `.env.example` ke `.env` untuk menjalankan tanpa Docker. Aplikasi gagal start bila variabel wajib hilang.

| Variabel | Wajib | Keterangan |
|---|---|---|
| `DATABASE_URL` | ya | URL MySQL |
| `JWT_SECRET` | ya | Minimal 32 karakter |
| `JWT_EXPIRES_IN` | tidak | Umur access token, bawaan `15m` |
| `REFRESH_EXPIRES_DAYS` | tidak | Umur refresh token, bawaan `7` |
| `PORT` | tidak | Bawaan `3000` |
| `SEED_DEMO` | tidak | `true` = seed akun demo saat container start. Bawaan image: mati |

`JWT_EXPIRES_IN` harus berbentuk `15m`, `1h`, atau `7d`, dan `REFRESH_EXPIRES_DAYS` bilangan bulat positif. Nilai yang salah bentuk membuat aplikasi gagal start, bukan gagal saat login.

Compose memakai nilai demo palsu untuk `JWT_SECRET`. Untuk deployment nyata, setel `JWT_SECRET` sendiri.

## Pengembangan

```bash
docker compose up -d db        # hanya database
npm install
npx prisma migrate dev         # butuh user root (shadow database), lihat .env.example
npm run start:dev
npm run build
```

## Test

```bash
npm run test       # unit
npm run test:e2e   # e2e, butuh database dari `docker compose up -d db`
```

E2E membuat database MySQL baru yang kosong di setiap run (`starter_e2e_<timestamp>`), memigrasi dan men-seed-nya, lalu menghapusnya. Database dev tidak tersentuh. Ubah target dengan `E2E_ADMIN_URL`.

Yang diuji: login salah dan format error, respons identik untuk email tidak ada dan password salah, endpoint terproteksi, access token kedaluwarsa ditolak, refresh menghasilkan token baru dan token lama ditolak, pemakaian ulang token lama mencabut seluruh sesi, pemakaian ulang sesaat setelah rotasi tidak mencabut sesi baru, refresh serentak (tepat satu berhasil), refresh token kedaluwarsa, logout, peran (USER ditolak 403), peran dibaca ulang dari database (user dihapus atau diturunkan langsung ditolak), dan validasi DTO termasuk `null` dan id di luar rentang.

## Postman

Koleksi dan environment ada di `postman/` (`local`, `demo`). Environment `demo` belum berisi URL dan password karena hosting belum diputuskan.

```bash
npx newman run postman/starter-kit.postman_collection.json -e postman/local.postman_environment.json
```

## Batasan yang diketahui

- Belum ada pembersihan baris refresh token yang kedaluwarsa.
- Belum ada pembatasan percobaan login (rate limiting, di luar lingkup MVP) dan header keamanan (helmet). Untuk deployment publik, pasang di depan API (reverse proxy) atau tambahkan sendiri.
- `/docs` terbuka tanpa autentikasi.
- `npm audit --omit=dev` melaporkan 4 temuan severity tinggi, semuanya pada rantai CLI Prisma 6 (`prisma` → `@prisma/config` → `effect`, `deepmerge-ts`). Itu berjalan saat build dan `migrate deploy` dengan konfigurasi milik sendiri, bukan pada request HTTP, dan `@prisma/client` tidak terdampak. Perbaikannya hanya lewat Prisma 7 (perubahan besar), belum dikerjakan.
- Aplikasi menolak start dengan `JWT_SECRET` contoh dari repo ini, kecuali `SEED_DEMO=true`. Port database di Compose hanya terikat ke `127.0.0.1`.
- Password dibatasi 8 sampai 72 karakter karena bcrypt hanya membaca 72 byte pertama.
- Tidak ada pendaftaran mandiri. Akun dibuat ADMIN lewat `POST /users`.
- Di luar lingkup: OAuth pihak ketiga, email, upload file, rate limiting.

## Lisensi

MIT, lihat `LICENSE`.
