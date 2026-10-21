import { Team } from '../domain/team';
import { ColorHex } from '../domain/value-objects/color-hex';
import { TeamDescription } from '../domain/value-objects/team-description';
import { TeamName } from '../domain/value-objects/team-name';
import { TeamMapper } from './team.mapper';

const ID = '11111111-1111-4111-8111-111111111111';
const OWNER = '22222222-2222-4222-8222-222222222222';
const CREATED = new Date('2026-10-20T12:00:00.000Z');
const UPDATED = new Date('2026-10-20T13:00:00.000Z');

const row = {
  id: ID,
  ownerId: OWNER,
  name: 'Mobile',
  colorHex: '#7C3AED',
  description: null,
  version: 3,
  createdAt: CREATED,
  updatedAt: UPDATED,
  deletedAt: null,
};

describe('TeamMapper', () => {
  it('rebuilds the aggregate from a row', () => {
    const team = TeamMapper.toDomain(row);

    expect(team.id).toBe(ID);
    expect(team.ownerId).toBe(OWNER);
    expect(team.name.value).toBe('Mobile');
    expect(team.color.value).toBe('#7C3AED');
    expect(team.description.value).toBeNull();
    expect(team.version).toBe(3);
    expect(team.createdAt).toEqual(CREATED);
    expect(team.updatedAt).toEqual(UPDATED);
    expect(team.deletedAt).toBeNull();
    expect(team.pullEvents()).toEqual([]);
  });

  it('round-trips a row through the aggregate', () => {
    const team = TeamMapper.toDomain(row);

    expect({ ...TeamMapper.toInsert(team), version: 3 }).toEqual(row);
  });

  it('inserts at version 1 and never writes id, owner, version or createdAt on update', () => {
    const team = Team.create({
      id: ID,
      ownerId: OWNER,
      name: TeamName.create('Backend'),
      color: ColorHex.create('#0EA5E9'),
      description: TeamDescription.create('APIs'),
      now: CREATED,
    });

    expect(TeamMapper.toInsert(team).version).toBe(1);
    expect(Object.keys(TeamMapper.toUpdate(team)).sort()).toEqual([
      'colorHex',
      'deletedAt',
      'description',
      'name',
      'updatedAt',
    ]);
  });
});
