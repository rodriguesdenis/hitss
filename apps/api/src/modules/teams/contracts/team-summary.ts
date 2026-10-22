/** A live team as other contexts may see it (public contract of Team Management). */
export interface TeamSummary {
  readonly id: string;
  readonly name: string;
  readonly colorHex: string;
}
