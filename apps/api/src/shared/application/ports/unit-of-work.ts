/**
 * One database transaction around a use case (ADR-0002): every repository called inside `run`
 * joins it, so the writes and the in-transaction reactions commit or roll back together.
 */
export abstract class UnitOfWork {
  /** Runs `work` in a transaction (joining one already open) and returns its result. */
  abstract run<T>(work: () => Promise<T>): Promise<T>;
}
