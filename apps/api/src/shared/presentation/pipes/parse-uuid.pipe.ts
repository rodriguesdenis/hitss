import { ArgumentMetadata, Injectable, ParseUUIDPipe } from '@nestjs/common';
import { RequestValidationException } from '../filters/api-exception';

/**
 * `ParseUUIDPipe` with the contract's error: a malformed path id is
 * `400 VALIDATION_FAILED`, `details: [{ field: "id" }]` (api-contracts → Naming), never echoing
 * the value. Use as `@Param('id', ParseUuidPipe) id: string`.
 */
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
