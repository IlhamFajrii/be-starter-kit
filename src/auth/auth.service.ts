import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Prisma, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './login.dto';

// Dibandingkan saat email tidak ada, supaya waktu respons tidak membocorkan keberadaan akun.
const DUMMY_HASH = bcrypt.hashSync('tidak-dipakai', 10);
const DAY_MS = 86_400_000;
const REUSE_GRACE_MS = 10_000;
const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private config: ConfigService,
  ) {}

  async login({ email, password }: LoginDto) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    const ok = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
    // Pesan sama untuk "email tidak ada" dan "password salah".
    if (!user || !ok) throw new UnauthorizedException('Email atau password salah');
    return this.issue(user.id, user.role);
  }

  /** Rotasi: token lama dicabut, pasangan baru diterbitkan, dalam satu transaksi. */
  async refresh(token: string) {
    const invalid = () => new UnauthorizedException('Refresh token tidak valid');
    const tokenHash = sha256(token);
    const row = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });
    if (!row || row.expiresAt <= new Date()) throw invalid();

    if (row.revokedAt) {
      // Dipakai ulang jauh setelah dicabut: kemungkinan dicuri, cabut semua sesi pemiliknya.
      // Dalam jendela singkat dianggap balapan wajar (dua tab, retry): ditolak saja, sesi lain aman.
      if (Date.now() - row.revokedAt.getTime() > REUSE_GRACE_MS) {
        await this.prisma.refreshToken.updateMany({
          where: { userId: row.userId, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      }
      throw invalid();
    }

    return this.prisma.$transaction(async (tx) => {
      // UPDATE bersyarat: dua refresh serentak dengan token sama, hanya satu yang lolos.
      // Bila penerbitan token baru gagal, pencabutan ikut dibatalkan (sesi tidak hilang).
      const { count } = await tx.refreshToken.updateMany({
        where: { id: row.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      if (count === 0) throw invalid();
      return this.issue(row.userId, row.user.role, tx);
    });
  }

  async logout(token: string) {
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash: sha256(token), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private async issue(userId: number, role: Role, db: Prisma.TransactionClient | PrismaService = this.prisma) {
    const refreshToken = randomBytes(48).toString('base64url');
    const days = Number(this.config.get('REFRESH_EXPIRES_DAYS') ?? 7); // divalidasi validateEnv
    await db.refreshToken.create({
      data: { userId, tokenHash: sha256(refreshToken), expiresAt: new Date(Date.now() + days * DAY_MS) },
    });
    return {
      accessToken: await this.jwt.signAsync({ sub: userId, role }),
      refreshToken,
    };
  }
}
