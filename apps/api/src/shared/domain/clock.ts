/** The current time, injected so handlers stay deterministic in tests (plan 002). */
export abstract class Clock {
  abstract now(): Date;
}
