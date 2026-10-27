import { INTERCEPTORS_METADATA } from '@nestjs/common/constants';
import { LocationInterceptor } from '../../../../../shared/presentation/interceptors/location.interceptor';
import type { TeamView } from '../../../application/interfaces/team-read-model.interface';
import type { CreateTeamUseCase } from '../../../application/use-cases/create-team.use-case';
import type { DeleteTeamUseCase } from '../../../application/use-cases/delete-team.use-case';
import type { GetTeamUseCase } from '../../../application/use-cases/get-team.use-case';
import type { ListTeamsUseCase } from '../../../application/use-cases/list-teams.use-case';
import type { UpdateTeamUseCase } from '../../../application/use-cases/update-team.use-case';
import { TeamResponseDto } from '../../../presentation/dto/team-response.dto';
import { TeamsController } from '../../../presentation/teams.controller';

const OWNER = { ownerId: 'owner-1' };
const ID = '11111111-1111-4111-8111-111111111111';
const VIEW: TeamView = {
  id: ID,
  name: 'Mobile',
  colorHex: '#7C3AED',
  description: null,
  taskCount: 3,
  version: 1,
  createdAt: new Date('2026-10-20T13:00:00.000Z'),
  updatedAt: new Date('2026-10-20T13:00:00.000Z'),
};

describe('TeamsController', () => {
  const create = jest.fn().mockResolvedValue(VIEW);
  const update = jest.fn().mockResolvedValue(VIEW);
  const get = jest.fn();
  const controller = new TeamsController(
    { execute: create } as unknown as CreateTeamUseCase,
    { execute: update } as unknown as UpdateTeamUseCase,
    { execute: jest.fn() } as unknown as DeleteTeamUseCase,
    { execute: get } as unknown as GetTeamUseCase,
    { execute: jest.fn() } as unknown as ListTeamsUseCase,
  );
  const body = { name: 'Mobile', colorHex: '#7C3AED' };

  it('AC-10.6 create maps the view (with taskCount) and is marked @Location()', async () => {
    const result = await controller.create(OWNER, body);

    expect(create).toHaveBeenCalledWith({ ...body, ownerId: 'owner-1' });
    expect(
      Reflect.getMetadata(
        INTERCEPTORS_METADATA,
        Object.getOwnPropertyDescriptor(TeamsController.prototype, 'create')
          ?.value as object,
      ),
    ).toEqual([LocationInterceptor]);
    expect(result).toEqual(TeamResponseDto.from(VIEW));
    expect(result.taskCount).toBe(3);
    expect(get).not.toHaveBeenCalled();
  });

  it('AC-10.6 replace maps the view without reading it again', async () => {
    const result = await controller.replace(OWNER, { id: ID }, body);

    expect(update).toHaveBeenCalledWith({
      ...body,
      ownerId: 'owner-1',
      id: ID,
    });
    expect(result).toEqual(TeamResponseDto.from(VIEW));
    expect(get).not.toHaveBeenCalled();
  });
});
