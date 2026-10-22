import { Query } from '@nestjs/cqrs';

/** Active-task count per team id; every requested id is a key (0 when it has none). */
export type TaskCountsByTeam = ReadonlyMap<string, number>;

/**
 * Public query of Task Management (contracts/, rule A5): how many of the owner's active tasks are
 * assigned to each team. Team Management sends it on the QueryBus for `taskCount` (AC-02.8.1);
 * unknown, foreign and malformed ids count 0.
 */
export class CountTasksByTeamQuery extends Query<TaskCountsByTeam> {
  constructor(
    readonly ownerId: string,
    readonly teamIds: readonly string[],
  ) {
    super();
  }
}
