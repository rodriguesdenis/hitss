import { validate } from 'class-validator';
import { IsCalendarDate } from '../../../../../src/shared/presentation/validators/is-calendar-date';

class Probe {
  @IsCalendarDate()
  dueDate!: unknown;
}

const errorsFor = async (dueDate: unknown) => {
  const probe = new Probe();
  probe.dueDate = dueDate;
  return (await validate(probe)).map((error) => error.property);
};

describe('IsCalendarDate', () => {
  it.each(['2026-10-31', '2020-01-15', '2028-02-29', '0099-12-31'])(
    'AC-03.1.5 accepts the real date %s',
    async (value) => {
      expect(await errorsFor(value)).toEqual([]);
    },
  );

  it.each([
    '2026-02-29',
    '0000-01-01',
    '2026-13-01',
    '2026-04-31',
    '31/10/2026',
    '20261031',
    '2026-10-31T10:00:00Z',
    'tomorrow',
    20261031,
  ])('AC-03.1.5 rejects %p', async (value) => {
    expect(await errorsFor(value)).toEqual(['dueDate']);
  });
});
