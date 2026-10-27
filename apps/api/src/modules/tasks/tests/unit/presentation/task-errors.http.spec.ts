import { httpErrorOf } from '@test/support/http-error';
import {
  InvalidDueDate,
  InvalidTaskDescription,
  InvalidTaskStatus,
  InvalidTaskTitle,
  TaskNotFound,
  TooManyTeams,
  UnknownTeams,
} from '../../../domain/errors/task.errors';

const VALIDATION_FAILED = {
  code: 'VALIDATION_FAILED',
  message: 'Request validation failed.',
};

describe('Task errors over HTTP', () => {
  it.each([
    [
      new InvalidTaskTitle(),
      'title',
      'title must be 3 to 120 characters with no control characters',
    ],
    [
      new InvalidTaskDescription(),
      'description',
      'description must be at most 2000 characters with no control characters other than line breaks',
    ],
    [
      new InvalidTaskStatus(),
      'status',
      'status must be one of PENDING, IN_PROGRESS, DONE',
    ],
    [
      new InvalidDueDate(),
      'dueDate',
      'dueDate must be a real calendar date in the form YYYY-MM-DD',
    ],
  ])(
    'AC-09.6 %p → 400 VALIDATION_FAILED naming its field',
    (error, field, message) => {
      expect(httpErrorOf(error)).toEqual({
        status: 400,
        error: { ...VALIDATION_FAILED, details: [{ field, message }] },
      });
    },
  );

  it('AC-03.8.2 AC-09.6 TaskNotFound → 404 TASK_NOT_FOUND without details', () => {
    expect(httpErrorOf(new TaskNotFound())).toEqual({
      status: 404,
      error: { code: 'TASK_NOT_FOUND', message: 'Task not found.' },
    });
  });

  it('AC-03.1.6 AC-09.6 TooManyTeams → 422 TOO_MANY_TEAMS with max and received', () => {
    expect(httpErrorOf(new TooManyTeams(10, 11))).toEqual({
      status: 422,
      error: {
        code: 'TOO_MANY_TEAMS',
        message: 'A task can have at most 10 teams.',
        details: { max: 10, received: 11 },
      },
    });
  });

  it('AC-03.1.6 AC-09.6 UnknownTeams → 422 UNKNOWN_TEAMS with exactly its ids', () => {
    const ids = ['a', 'b'];
    const error = new UnknownTeams(ids);
    ids.push('c');

    expect(httpErrorOf(error)).toEqual({
      status: 422,
      error: {
        code: 'UNKNOWN_TEAMS',
        message: 'Some teams do not exist.',
        details: { teamIds: ['a', 'b'] },
      },
    });
  });

  it('the message never echoes the input', () => {
    expect(httpErrorOf(new UnknownTeams(['secret-id'])).error.message).toBe(
      'Some teams do not exist.',
    );
  });
});
