# REST API Starter Kit

![Node.js 22](https://img.shields.io/badge/Node.js-22-5FA04E?logo=nodedotjs&logoColor=white)
![TypeScript 5](https://img.shields.io/badge/TypeScript-5_strict-3178C6?logo=typescript&logoColor=white)
![NestJS 11](https://img.shields.io/badge/NestJS-11-E0234E?logo=nestjs&logoColor=white)
![Prisma 6](https://img.shields.io/badge/Prisma-6-2D3748?logo=prisma&logoColor=white)
![MySQL 8.4](https://img.shields.io/badge/MySQL-8.4-4479A1?logo=mysql&logoColor=white)
![JWT](https://img.shields.io/badge/JWT-auth-000000?logo=jsonwebtokens&logoColor=white)
![Swagger](https://img.shields.io/badge/Swagger-docs-85EA2D?logo=swagger&logoColor=black)
![Jest 30](https://img.shields.io/badge/Jest-30-C21325?logo=jest&logoColor=white)
![Docker Compose](https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker&logoColor=white)
[![Lisensi MIT](https://img.shields.io/badge/Lisensi-MIT-green)](LICENSE)

Fondasi REST API yang dapat dipakai ulang, dibangun dengan arsitektur modular NestJS. Proyek ini menyediakan autentikasi JWT dengan refresh token yang bisa dicabut, otorisasi berbasis peran, validasi DTO, dan format error yang seragam.

Cakupannya sengaja generik: hanya modul `auth` dan `users`, tanpa domain bisnis, sehingga domain Anda bisa ditambahkan di atasnya. Status proyek: `Active`, belum ada pengguna nyata.

## Menjalankan

Prasyarat: Docker dengan Compose.

```bash
docker compose up --build
```

- API: http://localhost:3000
- Swagger: http://localhost:3000/docs

Saat start, container API menjalankan migrasi database. Seed akun demo bersifat idempoten dan hanya berjalan bila `SEED_DEMO=true`. `docker-compose.yml` menyalakannya untuk demo lokal, sedangkan image-nya sendiri secara bawaan tidak men-seed apa pun. Jangan nyalakan `SEED_DEMO` di deployment nyata karena kredensial demo di bawah bersifat publik.

Port database di Compose hanya terikat ke `127.0.0.1`.

### Akun demo (fiktif)

| Peran | Email | Password |
|---|---|---|
| ADMIN | `admin@demo.test` | `Admin123!demo` |
| USER | `user@demo.test` | `User123!demo` |

## Endpoint

| Method | Path | Akses | Keterangan |
|---|---|---|---|
| POST | `/auth/login` | Publik | Mengembalikan `accessToken` dan `refreshToken` |
| POST | `/auth/refresh` | Publik | Menukar refresh token dengan pasangan baru (rotasi) |
| POST | `/auth/logout` | Publik | Mencabut refresh token (204) |
| GET | `/users/me` | Login | Data pengguna yang sedang login |
| GET, POST | `/users` | ADMIN | Melihat daftar dan membuat pengguna |
| DELETE | `/users/:id` | ADMIN | Menghapus pengguna |

Endpoint terproteksi membutuhkan header `Authorization: Bearer <accessToken>`.

Semua error berbentuk `{ "statusCode": 401, "error": "Unauthorized", "message": "..." }`. Pada error validasi, `message` berupa daftar dengan satu entri per field. Respons tidak pernah memuat `passwordHash`.

## Keputusan desain

### Refresh token disimpan di database

Dengan tabel database (alih-alih token stateless), token bisa dicabut saat logout atau pencurian, dan pemakaian ulang bisa dideteksi. Token berupa 48 byte acak yang disimpan sebagai hash SHA-256, jadi kebocoran database tidak membocorkan token yang berlaku. Konsekuensinya, setiap refresh memerlukan satu query database dan baris token perlu dibersihkan berkala (job pembersih belum ada).

### Rotasi token

Setiap refresh mencabut token lama dan menerbitkan token baru dalam satu transaksi, lewat `UPDATE ... WHERE revokedAt IS NULL`. Kalau penerbitan token baru gagal, pencabutan ikut dibatalkan. Dari dua refresh serentak dengan token yang sama, hanya satu yang berhasil.

### Deteksi pemakaian ulang

Token yang sudah dicabut lalu dipakai lagi lebih dari 10 detik kemudian dianggap kemungkinan dicuri, dan semua sesi pemiliknya dicabut. Pemakaian ulang dalam 10 detik pertama dianggap balapan wajar (dua tab, retry jaringan): permintaan ditolak dengan 401 tanpa mencabut sesi yang baru diterbitkan. Klien yang kalah balapan perlu memakai token hasil rotasi pemenangnya, misalnya lewat penyimpanan bersama antar tab.

### Peran dibaca dari database

Peran diambil dari database di setiap request, bukan dari token. Pengguna yang dihapus atau diturunkan perannya langsung kehilangan akses, dengan biaya satu query ringan per request.

### Pesan login seragam

Email yang tidak terdaftar dan password yang salah menghasilkan respons dan waktu yang sama, karena bcrypt tetap dijalankan terhadap hash cadangan.

## Variabel lingkungan

Untuk menjalankan tanpa Docker, salin `.env.example` ke `.env`.

| Variabel | Wajib | Keterangan |
|---|---|---|
| `DATABASE_URL` | ya | URL MySQL |
| `JWT_SECRET` | ya | Minimal 32 karakter |
| `JWT_EXPIRES_IN` | tidak | Umur access token, bawaan `15m` |
| `REFRESH_EXPIRES_DAYS` | tidak | Umur refresh token, bawaan `7` |
| `PORT` | tidak | Bawaan `3000` |
| `SEED_DEMO` | tidak | `true` = seed akun demo saat container start. Bawaan image: mati |

Aplikasi gagal start bila variabel wajib hilang. `JWT_EXPIRES_IN` harus berbentuk `15m`, `1h`, atau `7d`, dan `REFRESH_EXPIRES_DAYS` harus bilangan bulat positif. Nilai yang salah bentuk menggagalkan start, sehingga kesalahan tidak baru muncul saat login.

Compose memakai nilai demo palsu untuk `JWT_SECRET`. Aplikasi menolak start dengan `JWT_SECRET` contoh dari repo ini kecuali `SEED_DEMO=true`, jadi setel nilai Anda sendiri untuk deployment nyata.

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

Setiap run E2E membuat database MySQL kosong (`starter_e2e_<timestamp>`), memigrasi dan men-seed-nya, lalu menghapusnya. Database dev tidak tersentuh. Ubah target dengan `E2E_ADMIN_URL`.

Cakupan pengujian:

- Login: kredensial salah, format error, dan respons identik untuk email tidak terdaftar maupun password salah.
- Akses: endpoint terproteksi, access token kedaluwarsa ditolak, dan USER ditolak dengan 403.
- Refresh token: rotasi (token lama ditolak), pemakaian ulang token lama mencabut seluruh sesi, pemakaian ulang sesaat setelah rotasi tidak mencabut sesi baru, refresh serentak (tepat satu berhasil), token kedaluwarsa, dan logout.
- Peran: dibaca ulang dari database, sehingga pengguna yang dihapus atau diturunkan langsung ditolak.
- Validasi DTO, termasuk `null` dan id di luar rentang.

## Postman

Koleksi dan environment (`local`, `demo`) ada di `postman/`. Environment `demo` belum berisi URL dan password karena hosting belum diputuskan.

```bash
npx newman run postman/starter-kit.postman_collection.json -e postman/local.postman_environment.json
```

## Batasan yang diketahui

- Baris refresh token yang kedaluwarsa belum dibersihkan.
- Belum ada pembatasan percobaan login (rate limiting, di luar lingkup MVP) maupun header keamanan (helmet). Untuk deployment publik, pasang reverse proxy di depan API atau tambahkan sendiri.
- `/docs` terbuka tanpa autentikasi.
- `npm audit --omit=dev` melaporkan 4 temuan severity tinggi, semuanya pada rantai CLI Prisma 6 (`prisma`, `@prisma/config`, lalu `effect` dan `deepmerge-ts`). Kode tersebut berjalan saat build dan `migrate deploy` dengan konfigurasi milik sendiri, bukan pada request HTTP, dan `@prisma/client` tidak terdampak. Perbaikannya hanya lewat Prisma 7 (perubahan besar) yang belum dikerjakan.
- Password dibatasi 8 sampai 72 karakter karena bcrypt hanya membaca 72 byte pertama.
- Tidak ada pendaftaran mandiri. Akun dibuat ADMIN lewat `POST /users`.
- OAuth pihak ketiga, email, dan upload file berada di luar lingkup.

## Lisensi

MIT, lihat [`LICENSE`](LICENSE).
