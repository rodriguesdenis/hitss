import { InvalidColorHex } from '../team.errors';

const PATTERN = /^#[0-9A-Fa-f]{6}$/;

/**
 * A team color in the form `#RRGGBB`, normalized to upper case. Choosing a
 * readable text color for it is a presentation concern of the mobile app
 * (design-spec §3).
 */
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
