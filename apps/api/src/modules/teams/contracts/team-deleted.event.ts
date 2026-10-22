/**
 * Public contract of Team Management: Task Management reacts to it in the same transaction
 * (`@InTransactionHandler(TeamDeleted)`, T-003-13). A re-export of the domain class, never a copy:
 * the publisher finds handlers by `event.constructor`, so both sides must hold the same class.
 */
export { TeamDeleted } from '../domain/team.events';
