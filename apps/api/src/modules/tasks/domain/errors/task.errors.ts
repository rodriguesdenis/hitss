import {
  DomainError,
  InvalidField,
} from '../../../../shared/domain/domain-error';

export class InvalidTaskTitle extends InvalidField {
  constructor() {
    super(
      'title',
      'title must be 3 to 120 characters with no control characters',
    );
  }
}

export class InvalidTaskDescription extends InvalidField {
  constructor() {
    super(
      'description',
      'description must be at most 2000 characters with no control characters other than line breaks',
    );
  }
}

export class InvalidTaskStatus extends InvalidField {
  constructor() {
    super('status', 'status must be one of PENDING, IN_PROGRESS, DONE');
  }
}

export class InvalidDueDate extends InvalidField {
  constructor() {
    super(
      'dueDate',
      'dueDate must be a real calendar date in the form YYYY-MM-DD',
    );
  }
}

export class TooManyTeams extends DomainError {
  readonly code = 'TOO_MANY_TEAMS';
  readonly kind = 'rule';

  constructor(
    readonly max: number,
    readonly received: number,
  ) {
    super('A task can have at most 10 teams.', { max, received });
  }
}

export class UnknownTeams extends DomainError {
  readonly code = 'UNKNOWN_TEAMS';
  readonly kind = 'rule';
  readonly teamIds: readonly string[];

  constructor(teamIds: readonly string[]) {
    super('Some teams do not exist.', { teamIds: [...teamIds] });
    this.teamIds = [...teamIds];
  }
}

export class TaskNotFound extends DomainError {
  readonly code = 'TASK_NOT_FOUND';
  readonly kind = 'not_found';

  constructor() {
    super('Task not found.');
  }
}
