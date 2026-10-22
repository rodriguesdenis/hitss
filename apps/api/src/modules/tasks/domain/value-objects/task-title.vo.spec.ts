import { InvalidTaskTitle } from '../errors/task.errors';
import { TaskTitle } from './task-title.vo';

const EMOJI = '\u{1F680}'; // rocket emoji, one code point, two UTF-16 units

describe('TaskTitle', () => {
  describe('AC-03.1.2 length boundaries (code points after trimming)', () => {
    it.each([
      [0, false],
      [2, false],
      [3, true],
      [120, true],
      [121, false],
    ])(
      '%i characters padded with spaces → accepted: %s',
      (length, accepted) => {
        const title = 't'.repeat(length);
        const create = () => TaskTitle.create(`   ${title}   `);

        if (accepted) {
          expect(create().value).toBe(title);
        } else {
          expect(create).toThrow(InvalidTaskTitle);
        }
      },
    );

    it('stores the title trimmed', () => {
      expect(TaskTitle.create('   Plan sprint   ').value).toBe('Plan sprint');
    });

    it('counts code points, not UTF-16 units', () => {
      expect(TaskTitle.create(EMOJI.repeat(120)).value).toBe(EMOJI.repeat(120));
      expect(() => TaskTitle.create(EMOJI.repeat(121))).toThrow(
        InvalidTaskTitle,
      );
      expect(() => TaskTitle.create(EMOJI.repeat(2))).toThrow(InvalidTaskTitle);
    });
  });

  describe('AC-03.1.8 control characters', () => {
    it.each([
      ['a newline between two words', 'Plan\nsprint'],
      ['a tab between two words', 'Plan\tsprint'],
      ['a NUL character', 'Plan\u0000'],
      ['an escape character', 'Plan\u001bsprint'],
      ['a DEL character', 'Plan\u007f'],
      ['a trailing newline (checked before trimming)', 'Plan sprint\n'],
    ])('rejects %s', (_label, raw) => {
      expect(() => TaskTitle.create(raw)).toThrow(InvalidTaskTitle);
    });
  });

  it('reports the "title" field with a message that does not echo the input', () => {
    let error: unknown;
    try {
      TaskTitle.create('x');
    } catch (e) {
      error = e;
    }

    expect(error).toBeInstanceOf(InvalidTaskTitle);
    expect(error).toMatchObject({
      field: 'title',
      message:
        'Title must be 3 to 120 characters long and contain no control characters.',
    });
  });

  it('equals compares the exact trimmed value', () => {
    expect(TaskTitle.create(' Plan ').equals(TaskTitle.create('Plan'))).toBe(
      true,
    );
    expect(TaskTitle.create('Plan').equals(TaskTitle.create('plan'))).toBe(
      false,
    );
  });
});
