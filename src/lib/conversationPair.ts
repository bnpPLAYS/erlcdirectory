/** Stable ordering for conversation participants — matches UNIQUE(participant_one, participant_two). */
export function orderedParticipantIds(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}
