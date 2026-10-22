import { ArgumentMetadata, Injectable, ParseUUIDPipe } from '@nestjs/common';
import { RequestValidationException } from '../filters/api-exception';

@Injectable()
export class ParseUuidPipe extends ParseUUIDPipe {
  override async transform(
    value: string,
    metadata: ArgumentMetadata,
  ): Promise<string> {
    const field = metadata.data ?? 'id';
    try {
      return await super.transform(value, metadata);
    } catch {
      throw new RequestValidationException([
        { field, message: `${field} must be a UUID` },
      ]);
    }
  }
}
