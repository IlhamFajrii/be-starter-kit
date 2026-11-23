import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Response } from 'express';
import { STATUS_CODES } from 'node:http';

// Semua error berbentuk { statusCode, error, message }.
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exceptions');

  catch(exception: unknown, host: ArgumentsHost) {
    const { statusCode, message } = this.normalize(exception);
    if (statusCode >= 500) this.logger.error(exception);
    host.switchToHttp().getResponse<Response>().status(statusCode).json({
      statusCode,
      error: STATUS_CODES[statusCode] ?? 'Error',
      message,
    });
  }

  private normalize(e: unknown): { statusCode: number; message: string | string[] } {
    if (e instanceof HttpException) {
      const r = e.getResponse();
      const message =
        typeof r === 'string' ? r : ((r as { message?: string | string[] }).message ?? e.message);
      return { statusCode: e.getStatus(), message };
    }
    if (e instanceof Prisma.PrismaClientKnownRequestError) {
      if (e.code === 'P2002') return { statusCode: 409, message: 'Data sudah ada (duplikat)' };
      if (e.code === 'P2025') return { statusCode: 404, message: 'Data tidak ditemukan' };
      if (e.code === 'P2003') return { statusCode: 409, message: 'Data masih dipakai data lain' };
    }
    return { statusCode: HttpStatus.INTERNAL_SERVER_ERROR, message: 'Terjadi kesalahan pada server' };
  }
}
