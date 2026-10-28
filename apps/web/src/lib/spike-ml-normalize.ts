// Candidate search-text normaliser for Malayalam (spike B). Search-index only:
// stored content and slugs are never rewritten (05-MIGRATION-DESIGN.md §6.1.5).
const LEGACY_CHILLU: Array<[RegExp, string]> = [
  [/ണ്‍/g, "ൺ"], // ണ്‍ → ൺ
  [/ന്‍/g, "ൻ"], // ന്‍ → ൻ
  [/ര്‍/g, "ർ"], // ര്‍ → ർ
  [/ല്‍/g, "ൽ"], // ല്‍ → ൽ
  [/ള്‍/g, "ൾ"], // ള്‍ → ൾ
  [/ക്‍/g, "ൿ"], // ക്‍ → ൿ
];

export function normalizeMalayalamForSearch(input: string): string {
  let s = input.normalize("NFC");
  for (const [re, atomic] of LEGACY_CHILLU) s = s.replace(re, atomic);
  // Remaining ZWJ / ZWNJ only change rendering, not the word
  s = s.replace(/[‌‍]/g, "");
  return s.toLowerCase();
}
