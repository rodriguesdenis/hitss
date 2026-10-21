import { parseResourceAttributes } from './resource-attributes';

describe('parseResourceAttributes', () => {
  it('AC-06.2.6 parses comma separated key=value pairs', () => {
    expect(parseResourceAttributes('a=1, b = two ,c=x=y')).toEqual({
      a: '1',
      b: 'two',
      c: 'x=y',
    });
  });

  it('AC-06.2.6 skips malformed pairs', () => {
    expect(parseResourceAttributes('novalue,=x,k=,ok=1')).toEqual({ ok: '1' });
  });
});
