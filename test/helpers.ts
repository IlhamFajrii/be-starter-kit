import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { PrismaService } from '../src/prisma/prisma.service';

export const CREDS = {
  admin: { email: 'admin@demo.test', password: 'Admin123!demo' },
  user: { email: 'user@demo.test', password: 'User123!demo' },
};

export async function createApp() {
  const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app: INestApplication = mod.createNestApplication();
  configureApp(app);
  await app.init();
  return { app, prisma: app.get(PrismaService) };
}

export async function loginAs(app: INestApplication, who: keyof typeof CREDS) {
  const res = await request(app.getHttpServer()).post('/auth/login').send(CREDS[who]).expect(200);
  return res.body as { accessToken: string; refreshToken: string };
}

export const bearer = (token: string) => `Bearer ${token}`;
