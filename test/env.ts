// Dijalankan di tiap worker. E2E_DATABASE_URL diisi global-setup (database baru per run).
if (process.env.E2E_DATABASE_URL) process.env.DATABASE_URL = process.env.E2E_DATABASE_URL;
process.env.JWT_SECRET = 'e2e-secret-0123456789abcdefghijklmnopqrstuv';
process.env.JWT_EXPIRES_IN = '15m';
