import { RequestValidationException } from '../../../../../src/shared/presentation/filters/api-exception';

describe('RequestValidationException', () => {
  it('keeps at most 50 details', () => {
    const details = Array.from({ length: 60 }, (_, i) => ({
      field: `f${i}`,
      message: `property f${i} should not exist`,
    }));

    const kept = new RequestValidationException(details).details;

    expect(kept).toHaveLength(50);
    expect(kept[0]).toEqual(details[0]);
    expect(kept[49]).toEqual(details[49]);
  });

  it('caps each field and message to 100 characters', () => {
    const [detail] = new RequestValidationException([
      { field: 'f'.repeat(150), message: 'm'.repeat(150) },
    ]).details;

    expect(detail).toEqual({
      field: 'f'.repeat(100),
      message: 'm'.repeat(100),
    });
  });

  it('counts characters, never splitting an emoji', () => {
    const rocket = '\u{1F680}';
    const [detail] = new RequestValidationException([
      { field: rocket.repeat(150), message: 'ok' },
    ]).details;

    expect([...detail!.field]).toHaveLength(100);
    expect(detail!.field).toBe(rocket.repeat(100));
  });
});
