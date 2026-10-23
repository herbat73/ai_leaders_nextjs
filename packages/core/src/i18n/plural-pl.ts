/** Forms for a Polish noun: `[one, few, many]`, e.g. `["dzień", "dni", "dni"]` or `["rzecz", "rzeczy", "rzeczy"]`. */
export type PluralFormsPl = readonly [one: string, few: string, many: string];

/**
 * Picks the Polish plural form for an integer count: 1 is `one`; 2-4 except 12-14 (by the last two digits) is `few`;
 * everything else, including 0, is `many`. Fractions and negatives use the absolute integer part.
 */
export function pluralPl(n: number, forms: PluralFormsPl): string {
  const abs = Math.trunc(Math.abs(n));
  if (abs === 1) return forms[0];
  const lastTwo = abs % 100;
  const last = abs % 10;
  if (last >= 2 && last <= 4 && !(lastTwo >= 12 && lastTwo <= 14))
    return forms[1];
  return forms[2];
}
