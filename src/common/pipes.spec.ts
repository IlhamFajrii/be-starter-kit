import { BadRequestException } from '@nestjs/common';
import { IdPipe, NoNullsPipe } from './pipes';

const body = { type: 'body' } as never;

describe('NoNullsPipe', () => {
  it('menolak null dengan pesan per field', () => {
    expect(() => new NoNullsPipe().transform({ name: null, price: 1, sku: null }, body)).toThrow(
      new BadRequestException(['name tidak boleh null', 'sku tidak boleh null']),
    );
  });

  it('meloloskan body tanpa null dan input non-body', () => {
    const ok = { name: 'a', minStock: 0 };
    expect(new NoNullsPipe().transform(ok, body)).toBe(ok);
    expect(new NoNullsPipe().transform(null, { type: 'query' } as never)).toBeNull();
  });
});

describe('IdPipe', () => {
  const pipe = new IdPipe();
  it('menerima integer positif dalam rentang int32', () => {
    expect(pipe.transform('1')).toBe(1);
    expect(pipe.transform('2147483647')).toBe(2147483647);
  });
  it.each(['0', '-1', '1.5', 'abc', '', '2147483648', '99999999999'])('menolak %j', (v) => {
    expect(() => pipe.transform(v)).toThrow(BadRequestException);
  });
});
