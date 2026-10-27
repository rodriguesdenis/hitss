import {
  Controller,
  Delete,
  Get,
  HttpCode,
  Module,
  NotFoundException,
  Param,
  Patch,
  Post,
  Put,
} from '@nestjs/common';
import type { Owner } from '../../src/shared/domain/owner';
import { CurrentOwner } from '../../src/shared/presentation/decorators/current-owner.decorator';
import { IdParamDto } from '../../src/shared/presentation/dto/id-param.dto';

export const KNOWN_ID = '7d0c5e2a-3f1b-4c8e-9a6d-2b4f8e1c0a93';

export const writes = { count: 0 };

@Controller('owner-probe')
class OwnerProbeController {
  @Get()
  whoAmI(@CurrentOwner() owner: Owner): Owner {
    return owner;
  }

  @Get('items/:id')
  item(@Param() { id }: IdParamDto, @CurrentOwner() owner: Owner) {
    if (id !== KNOWN_ID) {
      throw new NotFoundException();
    }
    return { id, ownerId: owner.ownerId };
  }

  @Post()
  create(@CurrentOwner() owner: Owner): Owner {
    writes.count++;
    return owner;
  }

  @Put()
  replace(@CurrentOwner() owner: Owner): Owner {
    writes.count++;
    return owner;
  }

  @Patch()
  update(@CurrentOwner() owner: Owner): Owner {
    writes.count++;
    return owner;
  }

  @Delete()
  @HttpCode(204)
  remove(): void {
    writes.count++;
  }
}

@Module({ controllers: [OwnerProbeController] })
export class OwnerProbeModule {}
