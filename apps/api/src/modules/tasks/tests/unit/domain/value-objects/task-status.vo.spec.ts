import { InvalidTaskStatus } from '../../../../domain/errors/task.errors';
import {
  isTaskStatus,
  parseTaskStatus,
  TaskStatus,
} from '../../../../domain/value-objects/task-status.vo';

const INVALID = [
  'pending',
  'done',
  'Done',
  ' DONE',
  'BLOCKED',
  'ARCHIVED',
  'CANCELLED',
  'FINISHED',
  '',
  'toString',
  '__proto__',
];

describe('TaskStatus', () => {
  it('AC-03.1.4 has exactly the three contract values', () => {
    expect(Object.values(TaskStatus)).toEqual([
      'PENDING',
      'IN_PROGRESS',
      'DONE',
    ]);
  });

  describe('isTaskStatus', () => {
    it.each(Object.values(TaskStatus))('accepts %s', (value) => {
      expect(isTaskStatus(value)).toBe(true);
    });

    it.each([...INVALID, null, undefined, 1, {}])('rejects %j', (value) => {
      expect(isTaskStatus(value)).toBe(false);
    });
  });

  describe('parseTaskStatus (defense in depth; the DTO uses @IsEnum)', () => {
    it.each(Object.values(TaskStatus))('parses %s', (value) => {
      expect(parseTaskStatus(value)).toBe(value);
    });

    it.each(INVALID)(
      'AC-03.1.4 AC-03.9.3 AC-03.10.4 rejects %j with InvalidTaskStatus',
      (value) => {
        expect(() => parseTaskStatus(value)).toThrow(InvalidTaskStatus);
      },
    );

    it('reports the "status" field', () => {
      let error: unknown;
      try {
        parseTaskStatus('FINISHED');
      } catch (e) {
        error = e;
      }

      expect(error).toMatchObject({
        field: 'status',
        details: [
          {
            field: 'status',
            message: 'status must be one of PENDING, IN_PROGRESS, DONE',
          },
        ],
      });
    });
  });
});
