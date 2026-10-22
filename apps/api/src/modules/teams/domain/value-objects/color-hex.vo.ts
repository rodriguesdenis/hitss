import { InvalidColorHex } from '../errors/team.errors';

const PATTERN = /^#[0-9A-Fa-f]{6}$/;

export class ColorHex {
  private constructor(readonly value: string) {}

  static create(raw: string): ColorHex {
    if (!PATTERN.test(raw)) {
      throw new InvalidColorHex();
    }
    return new ColorHex(raw.toUpperCase());
  }

  equals(other: ColorHex): boolean {
    return this.value === other.value;
  }
}
