import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Module,
  Post,
} from '@nestjs/common';
import { IsString, Length } from 'class-validator';
import { Public } from '../../src/shared/presentation/decorators/public.decorator';
import { RawResponse } from '../../src/shared/presentation/decorators/raw-response.decorator';

export const DB_DETAIL =
  'Key (email)=(marina@example.test) already exists. DETAIL: secret-value';

class ProbeDto {
  @IsString()
  @Length(2, 20)
  name!: string;
}

@Public()
@Controller('probe')
class ProbeController {
  @Get()
  get() {
    return { hello: 'world' };
  }

  @Get('page')
  page() {
    return {
      data: [{ id: 1 }],
      meta: { total: 1, limit: 20, offset: 0, hasNextPage: false },
    };
  }

  @Get('raw')
  @RawResponse()
  raw() {
    return { status: 'ok' };
  }

  @Post()
  create(@Body() body: ProbeDto) {
    return body;
  }

  @Delete()
  @HttpCode(204)
  remove(): void {}

  @Get('boom')
  boom() {
    throw Object.assign(
      new Error(
        `Unique constraint failed on the fields: (\`email\`)\n${DB_DETAIL}`,
      ),
      {
        name: 'PrismaClientKnownRequestError',
        code: 'P2002',
        meta: { driverAdapterError: { cause: { message: DB_DETAIL } } },
      },
    );
  }
}

@Module({ controllers: [ProbeController] })
export class ProbeModule {}
