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
import { ParseUuidPipe } from '../../src/shared/presentation/pipes/parse-uuid.pipe';

/** The id the probe "knows": a lookup with any other id is a 404 (AC-01.5.5). */
export const KNOWN_ID = '7d0c5e2a-3f1b-4c8e-9a6d-2b4f8e1c0a93';

/** Counts the writes that reached a handler, so a rejected request provably changed nothing. */
export const writes = { count: 0 };

/** Test-only private routes (no @Public()): what an owned business endpoint looks like. */
@Controller('owner-probe')
class OwnerProbeController {
  @Get()
  whoAmI(@CurrentOwner() owner: Owner): Owner {
    return owner;
  }

  @Get('items/:id')
  item(@Param('id', ParseUuidPipe) id: string, @CurrentOwner() owner: Owner) {
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
