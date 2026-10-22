/**
 * How many active tasks each team has, answered by Task Management (plan 002 → cross-context
 * seams). Every requested id is in the map; a team without active tasks counts 0.
 */
export abstract class TeamTaskCounts {
  abstract countByTeam(
    ownerId: string,
    teamIds: readonly string[],
  ): Promise<ReadonlyMap<string, number>>;
}
