import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { bearer, createApp, loginAs } from './helpers';

describe('Users dan peran', () => {
  let app: INestApplication;
  let admin: string;
  let user: string;
  beforeAll(async () => {
    ({ app } = await createApp());
    admin = bearer((await loginAs(app, 'admin')).accessToken);
    user = bearer((await loginAs(app, 'user')).accessToken);
  });
  afterAll(() => app.close());

  const http = () => request(app.getHttpServer());

  it('user biasa memanggil endpoint admin -> 403', async () => {
    const res = await http().get('/users').set('Authorization', user).expect(403);
    expect(res.body.statusCode).toBe(403);
    await http()
      .post('/users')
      .set('Authorization', user)
      .send({ email: 'x@demo.test', name: 'X', password: 'password123' })
      .expect(403);
  });

  it('admin melihat daftar user tanpa passwordHash', async () => {
    const res = await http().get('/users').set('Authorization', admin).expect(200);
    expect(res.body.length).toBeGreaterThanOrEqual(2);
    expect(JSON.stringify(res.body)).not.toMatch(/passwordHash/);
  });

  it('admin membuat user, user baru bisa login, email duplikat -> 409', async () => {
    const body = { email: 'baru@demo.test', name: 'User Baru', password: 'password-baru-1' };
    const created = await http().post('/users').set('Authorization', admin).send(body).expect(201);
    expect(created.body).toMatchObject({ email: body.email, role: 'USER' });
    await http().post('/auth/login').send({ email: body.email, password: body.password }).expect(200);
    await http().post('/users').set('Authorization', admin).send(body).expect(409);
  });

  it('validasi DTO: pesan per field, field asing ditolak', async () => {
    const res = await http()
      .post('/users')
      .set('Authorization', admin)
      .send({ email: 'bukan-email', name: '', password: 'pendek' })
      .expect(400);
    const msgs: string[] = res.body.message;
    for (const f of ['email', 'name', 'password']) {
      expect(msgs.some((m) => m.startsWith(f))).toBe(true);
    }
    const extra = await http()
      .post('/users')
      .set('Authorization', admin)
      .send({ email: 'a@demo.test', name: 'A', password: 'password123', isSuper: true })
      .expect(400);
    expect(extra.body.message).toContain('property isSuper should not exist');
  });

  it('nilai null ditolak 400 per field, bukan 500', async () => {
    const res = await http()
      .post('/users')
      .set('Authorization', admin)
      .send({ email: 'n@demo.test', name: 'N', password: 'password123', role: null })
      .expect(400);
    expect(res.body.message).toEqual(['role tidak boleh null']);
  });

  it('id di luar rentang int32 atau bukan angka -> 400, bukan 500', async () => {
    for (const id of ['99999999999', '0', 'abc']) {
      await http().delete(`/users/${id}`).set('Authorization', admin).expect(400);
    }
  });

  it('admin menghapus user -> 204, lalu 404', async () => {
    const created = await http()
      .post('/users')
      .set('Authorization', admin)
      .send({ email: 'hapus@demo.test', name: 'Hapus', password: 'password-hapus-1' })
      .expect(201);
    await http().delete(`/users/${created.body.id}`).set('Authorization', admin).expect(204);
    await http().delete(`/users/${created.body.id}`).set('Authorization', admin).expect(404);
  });
});
