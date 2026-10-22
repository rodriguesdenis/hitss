import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { IdGenerator } from '../application/ports/id-generator';

@Injectable()
export class UuidGenerator extends IdGenerator {
  next(): string {
    return randomUUID();
  }
}
