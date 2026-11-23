import { ArgumentMetadata, BadRequestException, Injectable, PipeTransform } from '@nestjs/common';

const INT4_MAX = 2_147_483_647;

/**
 * `@IsOptional()` meloloskan `null`, lalu Prisma menolaknya dengan 500.
 * Body dengan nilai `null` ditolak di sini dengan 400 per field.
 */
@Injectable()
export class NoNullsPipe implements PipeTransform {
  transform(value: unknown, { type }: ArgumentMetadata) {
    if (type === 'body' && value && typeof value === 'object') {
      const nulls = Object.entries(value)
        .filter(([, v]) => v === null)
        .map(([k]) => `${k} tidak boleh null`);
      if (nulls.length) throw new BadRequestException(nulls);
    }
    return value;
  }
}

/** Id integer 32-bit positif. Di luar rentang itu Prisma melempar error yang berujung 500. */
@Injectable()
export class IdPipe implements PipeTransform<string, number> {
  transform(value: string) {
    const n = Number(value);
    if (!/^\d+$/.test(value) || n < 1 || n > INT4_MAX) {
      throw new BadRequestException('id harus bilangan bulat positif');
    }
    return n;
  }
}
