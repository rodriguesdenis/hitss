import { DomainError } from '../../../../shared/domain/domain-error';

export class InvalidTaskTitle extends DomainError {
  readonly field = 'title';

  constructor() {
    super(
      'Title must be 3 to 120 characters long and contain no control characters.',
    );
  }
}

export class InvalidTaskDescription extends DomainError {
  readonly field = 'description';

  constructor() {
    super(
      'Description must be at most 2000 characters long and contain no control characters other than line breaks.',
    );
  }
}

export class InvalidTaskStatus extends DomainError {
  readonly field = 'status';

  constructor() {
    super('Status must be one of PENDING, IN_PROGRESS or DONE.');
  }
}

export class InvalidDueDate extends DomainError {
  readonly field = 'dueDate';

  constructor() {
    super('Due date must be a real calendar date in the form YYYY-MM-DD.');
  }
}

export class TooManyTeams extends DomainError {
  constructor(
    readonly max: number,
    readonly received: number,
  ) {
    super(`A task can have at most ${max} teams.`);
  }
}

export class UnknownTeams extends DomainError {
  readonly teamIds: readonly string[];

  constructor(teamIds: readonly string[]) {
    super('Some teams do not exist.');
    this.teamIds = [...teamIds];
  }
}

export class TaskNotFound extends DomainError {
  constructor() {
    super('Task not found.');
  }
}
