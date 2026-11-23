import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import { bearer, CREDS, createApp, loginAs } from './helpers';

describe('Auth', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  beforeAll(async () => ({ app, prisma } = await createApp()));
  afterAll(() => app.close());

  const http = () => request(app.getHttpServer());

  it('login salah -> 401 dengan format error konsisten', async () => {
    const res = await http()
      .post('/auth/login')
      .send({ email: CREDS.admin.email, password: 'salah' })
      .expect(401);
    expect(res.body).toEqual({
      statusCode: 401,
      error: 'Unauthorized',
      message: 'Email atau password salah',
    });
  });

  it('email tidak ada dan password salah menghasilkan respons identik', async () => {
    const a = await http().post('/auth/login').send({ email: 'tidak-ada@demo.test', password: 'apa-saja' });
    const b = await http().post('/auth/login').send({ email: CREDS.admin.email, password: 'apa-saja' });
    expect(a.status).toBe(401);
    expect(a.body).toEqual(b.body);
  });

  it('login benar -> access dan refresh token, endpoint terproteksi terbuka', async () => {
    const { accessToken, refreshToken } = await loginAs(app, 'user');
    expect(refreshToken.length).toBeGreaterThan(40);
    const me = await http().get('/users/me').set('Authorization', bearer(accessToken)).expect(200);
    expect(me.body).toMatchObject({ email: CREDS.user.email, role: 'USER' });
    expect(me.body).not.toHaveProperty('passwordHash');
  });

  it('tanpa token atau token palsu -> 401', async () => {
    await http().get('/users/me').expect(401);
    await http().get('/users/me').set('Authorization', 'Bearer bukan.token.valid').expect(401);
  });

  it('access token kedaluwarsa ditolak', async () => {
    const { accessToken } = await loginAs(app, 'user');
    const payload = app.get(JwtService).decode(accessToken) as { sub: number; role: string };
    const expired = await app
      .get(JwtService)
      .signAsync({ sub: payload.sub, role: payload.role }, { expiresIn: -60 });
    const res = await http().get('/users/me').set('Authorization', bearer(expired)).expect(401);
    expect(res.body.statusCode).toBe(401);
  });

  it('refresh menghasilkan token baru dan token lama ditolak (rotasi)', async () => {
    const first = await loginAs(app, 'user');
    const second = await http()
      .post('/auth/refresh')
      .send({ refreshToken: first.refreshToken })
      .expect(200);
    expect(second.body.refreshToken).not.toBe(first.refreshToken);
    await http().get('/users/me').set('Authorization', bearer(second.body.accessToken)).expect(200);

    // Token lama sudah dicabut.
    await http().post('/auth/refresh').send({ refreshToken: first.refreshToken }).expect(401);
  });

  it('memakai ulang refresh token yang sudah lama dicabut mencabut seluruh sesi pemilik', async () => {
    const first = await loginAs(app, 'user');
    const second = await http().post('/auth/refresh').send({ refreshToken: first.refreshToken }).expect(200);
    // Simulasikan pencabutan token pertama terjadi 1 menit lalu (di luar jendela toleransi).
    await prisma.refreshToken.updateMany({
      where: { revokedAt: { not: null }, user: { email: CREDS.user.email } },
      data: { revokedAt: new Date(Date.now() - 60_000) },
    });
    await http().post('/auth/refresh').send({ refreshToken: first.refreshToken }).expect(401); // reuse
    await http().post('/auth/refresh').send({ refreshToken: second.body.refreshToken }).expect(401);
  });

  it('pemakaian ulang sesaat setelah rotasi (dua tab, retry) ditolak tanpa mencabut sesi baru', async () => {
    const first = await loginAs(app, 'user');
    const second = await http().post('/auth/refresh').send({ refreshToken: first.refreshToken }).expect(200);
    await http().post('/auth/refresh').send({ refreshToken: first.refreshToken }).expect(401);
    // Token hasil rotasi masih berlaku.
    await http().post('/auth/refresh').send({ refreshToken: second.body.refreshToken }).expect(200);
  });

  it('user yang dihapus: access token lama langsung ditolak', async () => {
    const created = await http()
      .post('/users')
      .set('Authorization', bearer((await loginAs(app, 'admin')).accessToken))
      .send({ email: 'sementara@demo.test', name: 'Sementara', password: 'password-sementara-1' })
      .expect(201);
    const { accessToken } = (
      await http().post('/auth/login').send({ email: 'sementara@demo.test', password: 'password-sementara-1' }).expect(200)
    ).body;
    await http().get('/users/me').set('Authorization', bearer(accessToken)).expect(200);
    await prisma.user.delete({ where: { id: created.body.id } });
    await http().get('/users/me').set('Authorization', bearer(accessToken)).expect(401);
  });

  it('peran dibaca dari database: admin yang diturunkan kehilangan akses admin seketika', async () => {
    const created = await http()
      .post('/users')
      .set('Authorization', bearer((await loginAs(app, 'admin')).accessToken))
      .send({ email: 'turun@demo.test', name: 'Turun', password: 'password-turun-1', role: 'ADMIN' })
      .expect(201);
    const { accessToken } = (
      await http().post('/auth/login').send({ email: 'turun@demo.test', password: 'password-turun-1' }).expect(200)
    ).body;
    await http().get('/users').set('Authorization', bearer(accessToken)).expect(200);
    await prisma.user.update({ where: { id: created.body.id }, data: { role: 'USER' } });
    await http().get('/users').set('Authorization', bearer(accessToken)).expect(403);
  });

  it('dua refresh serentak dengan token sama: tepat satu berhasil', async () => {
    const { refreshToken } = await loginAs(app, 'admin');
    const results = await Promise.all(
      Array.from({ length: 4 }, () => http().post('/auth/refresh').send({ refreshToken })),
    );
    expect(results.filter((r) => r.status === 200)).toHaveLength(1);
  });

  it('refresh token kedaluwarsa ditolak', async () => {
    const { refreshToken } = await loginAs(app, 'user');
    await prisma.refreshToken.updateMany({
      where: { revokedAt: null, user: { email: CREDS.user.email } },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    await http().post('/auth/refresh').send({ refreshToken }).expect(401);
  });

  it('logout mencabut refresh token', async () => {
    const { refreshToken } = await loginAs(app, 'user');
    await http().post('/auth/logout').send({ refreshToken }).expect(204);
    await http().post('/auth/refresh').send({ refreshToken }).expect(401);
  });

  it('token tidak disimpan mentah di database', async () => {
    const { refreshToken } = await loginAs(app, 'user');
    expect(await prisma.refreshToken.count({ where: { tokenHash: refreshToken } })).toBe(0);
  });
});
