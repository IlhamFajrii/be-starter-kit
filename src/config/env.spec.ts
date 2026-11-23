import { validateEnv } from './env';

describe('validateEnv', () => {
  const ok = { DATABASE_URL: 'postgresql://x', JWT_SECRET: 'a'.repeat(32) };

  it('lolos bila variabel wajib ada, dengan atau tanpa opsional', () => {
    expect(validateEnv(ok)).toBe(ok);
    const full = { ...ok, JWT_EXPIRES_IN: '15m', REFRESH_EXPIRES_DAYS: '7', PORT: '3000' };
    expect(validateEnv(full)).toBe(full);
  });

  it('gagal bila DATABASE_URL hilang', () => {
    expect(() => validateEnv({ JWT_SECRET: ok.JWT_SECRET })).toThrow(/DATABASE_URL/);
  });

  it('gagal bila JWT_SECRET terlalu pendek', () => {
    expect(() => validateEnv({ ...ok, JWT_SECRET: 'pendek' })).toThrow(/minimal 32/);
  });

  it.each(['3600', '', '15', '0m', '-5m', '1 jam'])('menolak JWT_EXPIRES_IN %j', (v) => {
    expect(() => validateEnv({ ...ok, JWT_EXPIRES_IN: v })).toThrow(/JWT_EXPIRES_IN/);
  });

  it.each(['', 'abc', '7d', '0', '-1', '1.5'])('menolak REFRESH_EXPIRES_DAYS %j', (v) => {
    expect(() => validateEnv({ ...ok, REFRESH_EXPIRES_DAYS: v })).toThrow(/REFRESH_EXPIRES_DAYS/);
  });

  it('menolak PORT yang bukan angka', () => {
    expect(() => validateEnv({ ...ok, PORT: 'http' })).toThrow(/PORT/);
  });
});
