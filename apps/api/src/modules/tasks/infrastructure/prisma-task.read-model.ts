import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service';
import {
  TaskReadModel,
  TaskRecord,
} from '../application/ports/task.read-model';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Query side of Task Management: flat records straight from the tables, never aggregates.
 * Every query is owner-scoped and sees active tasks only (deleted_at IS NULL). Team links are
 * returned as ids; names and colors come from the TeamDirectory (constitution II.2).
 */
@Injectable()
export class PrismaTaskReadModel extends TaskReadModel {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async findById(ownerId: string, id: string): Promise<TaskRecord | null> {
    // A malformed id cannot exist; skip the query (the uuid column would reject the cast).
    if (!UUID.test(id)) return null;
    const row = await this.prisma.task.findFirst({
      where: { id, ownerId, deletedAt: null },
      select: {
        id: true,
        title: true,
        description: true,
        status: true,
        dueDate: true,
        completedAt: true,
        version: true,
        createdAt: true,
        updatedAt: true,
        teams: { select: { teamId: true }, orderBy: { teamId: 'asc' } },
      },
    });
    if (!row) return null;
    const { teams, dueDate, ...columns } = row;
    return {
      ...columns,
      // A `date` column travels as midnight UTC: the UTC day is the calendar day.
      dueDate: dueDate ? dueDate.toISOString().slice(0, 10) : null,
      teamIds: teams.map((link) => link.teamId),
    };
  }
}
