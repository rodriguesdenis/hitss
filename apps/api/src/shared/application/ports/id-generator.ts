/** New aggregate ids (UUID v4 in production), injected so handlers stay deterministic in tests. */
export abstract class IdGenerator {
  abstract next(): string;
}
