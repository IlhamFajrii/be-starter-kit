import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from './decorators';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      algorithms: ['HS256'], // kunci algoritma, jangan biarkan token memilih sendiri
      secretOrKey: config.getOrThrow<string>('JWT_SECRET'),
    });
  }

  // Peran dibaca ulang dari database, bukan dari token: user yang dihapus atau
  // diturunkan perannya langsung kehilangan akses, tanpa menunggu token kedaluwarsa.
  async validate(payload: { sub: number }): Promise<AuthUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, role: true },
    });
    if (!user) throw new UnauthorizedException();
    return { userId: user.id, role: user.role };
  }
}
