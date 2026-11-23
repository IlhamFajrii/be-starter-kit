import { BadRequestException, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AllExceptionsFilter } from './all-exceptions.filter';

function run(error: unknown) {
  const json = jest.fn();
  const status = jest.fn((_code: number) => ({ json }));
  const host = {
    switchToHttp: () => ({ getResponse: () => ({ status }) }),
  } as never;
  new AllExceptionsFilter().catch(error, host);
  return { status: status.mock.calls[0][0], body: json.mock.calls[0][0] };
}

describe('AllExceptionsFilter', () => {
  it('HttpException -> { statusCode, error, message }', () => {
    expect(run(new NotFoundException('hilang'))).toEqual({
      status: 404,
      body: { statusCode: 404, error: 'Not Found', message: 'hilang' },
    });
  });

  it('mempertahankan daftar pesan validasi', () => {
    const { body } = run(new BadRequestException(['price harus >= 0']));
    expect(body.message).toEqual(['price harus >= 0']);
  });

  it('Prisma P2002 -> 409, P2025 -> 404', () => {
    const mk = (code: string) =>
      new Prisma.PrismaClientKnownRequestError('x', { code, clientVersion: 't' });
    expect(run(mk('P2002')).status).toBe(409);
    expect(run(mk('P2025')).status).toBe(404);
  });

  it('error tak dikenal -> 500 tanpa membocorkan detail', () => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const { status, body } = run(new Error('rahasia internal'));
    expect(status).toBe(500);
    expect(body.message).not.toMatch(/rahasia/);
  });
});
