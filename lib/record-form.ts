export type NapInputChoice = "unknown" | "no" | "yes";

export type ParsedNapDuration =
  | { valid: true; value: number | undefined }
  | { valid: false; value: undefined };

/**
 * Converts the three-state nap control into the optional stored value.
 * Unknown stays absent, while an explicit "no" is the observed value zero.
 */
export function parseNapDuration(
  choice: NapInputChoice,
  rawMinutes: string,
): ParsedNapDuration {
  if (choice === "unknown") return { valid: true, value: undefined };
  if (choice === "no") return { valid: true, value: 0 };
  const parsed = Number(rawMinutes);
  return Number.isFinite(parsed) && parsed > 0
    ? { valid: true, value: parsed }
    : { valid: false, value: undefined };
}
