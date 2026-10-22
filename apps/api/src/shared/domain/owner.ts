/**
 * The authenticated caller as every bounded context sees it: an opaque id, never a Better Auth
 * type (plan 001 → CurrentOwner, decision CO-1). Owned resources store it as `ownerId`.
 */
export type Owner = Readonly<{ ownerId: string }>;
