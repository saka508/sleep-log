export type OptionalScoreChoice = "none" | "record";

/**
 * Selecting "record" only opens the score control. It must not manufacture
 * a zero: zero is an observation only after the user selects it explicitly.
 */
export function optionalScoreValueForChoice(
  choice: OptionalScoreChoice,
  currentValue: number | undefined,
) {
  return choice === "none" ? undefined : currentValue;
}
