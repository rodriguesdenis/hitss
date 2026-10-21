import { InvalidColorHex } from '../team.errors';

const PATTERN = /^#[0-9A-Fa-f]{6}$/;
const BLACK = '#000000';
const WHITE = '#FFFFFF';

/** A team color in the form `#RRGGBB`, normalized to upper case. */
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

  /**
   * Black or white, whichever has the higher WCAG contrast ratio with this
   * color (black wins ties). Same rule as the app's chip text (design-spec §3).
   */
  contrastingTextColor(): typeof BLACK | typeof WHITE {
    const luminance = this.relativeLuminance();
    const contrastWithBlack = (luminance + 0.05) / 0.05;
    const contrastWithWhite = 1.05 / (luminance + 0.05);
    return contrastWithBlack >= contrastWithWhite ? BLACK : WHITE;
  }

  private relativeLuminance(): number {
    const [r, g, b] = [1, 3, 5].map((start) =>
      linearize(parseInt(this.value.slice(start, start + 2), 16) / 255),
    ) as [number, number, number];
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }
}

function linearize(channel: number): number {
  return channel <= 0.03928
    ? channel / 12.92
    : ((channel + 0.055) / 1.055) ** 2.4;
}
