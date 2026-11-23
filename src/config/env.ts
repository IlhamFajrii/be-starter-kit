// Dipanggil ConfigModule saat start: aplikasi gagal start bila variabel wajib hilang atau salah bentuk.
export function validateEnv(env: Record<string, unknown>) {
  const missing = ['DATABASE_URL', 'JWT_SECRET'].filter((k) => !env[k]);
  if (missing.length) {
    throw new Error(`Variabel lingkungan wajib hilang: ${missing.join(', ')}`);
  }
  if (String(env.JWT_SECRET).length < 32) {
    throw new Error('JWT_SECRET minimal 32 karakter');
  }
  // Secret contoh di repo publik bisa dibaca siapa saja, jadi hanya boleh dipakai di mode demo.
  if (env.SEED_DEMO !== 'true' && /^(demo-only-secret|ganti-dengan)/.test(String(env.JWT_SECRET))) {
    throw new Error('JWT_SECRET masih berupa contoh dari repo. Setel secret acak sendiri.');
  }
  // Tanpa ini nilai salah baru meledak saat login (mis. "3600" dibaca jsonwebtoken sebagai 3600 ms).
  const { JWT_EXPIRES_IN: exp, REFRESH_EXPIRES_DAYS: days, PORT: port } = env;
  if (exp !== undefined && !/^[1-9]\d*[smhd]$/.test(String(exp))) {
    throw new Error('JWT_EXPIRES_IN harus berupa durasi seperti 15m, 1h, atau 7d');
  }
  if (days !== undefined && !/^[1-9]\d*$/.test(String(days))) {
    throw new Error('REFRESH_EXPIRES_DAYS harus bilangan bulat positif');
  }
  if (port !== undefined && !/^\d{1,5}$/.test(String(port))) {
    throw new Error('PORT harus berupa angka');
  }
  return env;
}
