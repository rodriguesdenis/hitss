import { InvalidTaskDescription } from './errors/invalid-task-description.error';
import { TaskDescription } from './task-description';

const EMOJI = '\u{1F680}';

describe('TaskDescription', () => {
  describe('AC-03.1.3 length boundaries (code points after trimming)', () => {
    it('accepts 2000 characters', () => {
      expect(TaskDescription.create('d'.repeat(2000)).value).toBe(
        'd'.repeat(2000),
      );
    });

    it('rejects 2001 characters', () => {
      expect(() => TaskDescription.create('d'.repeat(2001))).toThrow(
        InvalidTaskDescription,
      );
    });

    it('trims before measuring, and trimming never forgives length', () => {
      expect(TaskDescription.create(`  ${'d'.repeat(2000)}  `).value).toBe(
        'd'.repeat(2000),
      );
      expect(() => TaskDescription.create(`  ${'d'.repeat(2001)}  `)).toThrow(
        InvalidTaskDescription,
      );
    });

    it('counts code points, not UTF-16 units', () => {
      expect(TaskDescription.create(EMOJI.repeat(2000)).value).toBe(
        EMOJI.repeat(2000),
      );
      expect(() => TaskDescription.create(EMOJI.repeat(2001))).toThrow(
        InvalidTaskDescription,
      );
    });
  });

  describe('AC-03.1.3 blank descriptions become no description', () => {
    it.each([undefined, null, '', '   ', '\n\r\n '])('%j → null', (raw) => {
      expect(TaskDescription.create(raw).value).toBeNull();
    });
  });

  describe('AC-03.1.8 control characters other than line breaks', () => {
    it.each([
      ['LF', 'line 1\nline 2'],
      ['CRLF', 'line 1\r\nline 2'],
      ['CR', 'line 1\rline 2'],
    ])('keeps %s line breaks inside', (_label, raw) => {
      expect(TaskDescription.create(raw).value).toBe(raw);
    });

    it.each([
      ['a tab', 'col 1\tcol 2'],
      ['a NUL character', 'text\u0000'],
      ['an escape character', 'text\u001b[31m'],
      ['a DEL character', 'text\u007f'],
      ['a C1 control character', 'text\u0085'],
      ['a trailing tab (checked before trimming)', 'text\t'],
    ])('rejects %s', (_label, raw) => {
      expect(() => TaskDescription.create(raw)).toThrow(InvalidTaskDescription);
    });
  });

  it('reports the "description" field', () => {
    let error: unknown;
    try {
      TaskDescription.create('d'.repeat(2001));
    } catch (e) {
      error = e;
    }

    expect(error).toBeInstanceOf(InvalidTaskDescription);
    expect(error).toMatchObject({
      field: 'description',
      message:
        'Description must be at most 2000 characters long and contain no control characters other than line breaks.',
    });
  });

  it.each([
    ['Notes', ' Notes ', true],
    [null, '  ', true],
    ['Notes', 'notes', false],
    ['Notes', null, false],
  ])('%j equals %j: %s', (a, b, expected) => {
    expect(TaskDescription.create(a).equals(TaskDescription.create(b))).toBe(
      expected,
    );
  });
});
