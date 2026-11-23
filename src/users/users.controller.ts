import { Body, Controller, Delete, Get, HttpCode, Param, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { AuthUser, Roles } from '../auth/decorators';
import { IdPipe } from '../common/pipes';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './user.dto';

// passwordHash tidak pernah ikut di respons.
const publicFields = { id: true, email: true, name: true, role: true, createdAt: true } as const;

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private prisma: PrismaService) {}

  @Get('me')
  me(@Req() req: { user: AuthUser }) {
    return this.prisma.user.findUniqueOrThrow({ where: { id: req.user.userId }, select: publicFields });
  }

  @Roles(Role.ADMIN)
  @Get()
  findAll() {
    return this.prisma.user.findMany({ select: publicFields, orderBy: { id: 'asc' } });
  }

  @Roles(Role.ADMIN)
  @Post()
  async create(@Body() { password, ...data }: CreateUserDto) {
    return this.prisma.user.create({
      data: { ...data, passwordHash: await bcrypt.hash(password, 10) },
      select: publicFields,
    });
  }

  @Roles(Role.ADMIN)
  @HttpCode(204)
  @Delete(':id')
  async remove(@Param('id', IdPipe) id: number) {
    await this.prisma.user.delete({ where: { id } });
  }
}
