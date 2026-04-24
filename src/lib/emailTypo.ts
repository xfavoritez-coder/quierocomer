const CORRECTIONS: [RegExp, string][] = [
  [/@gmial\.com$/i, "@gmail.com"],
  [/@gmal\.com$/i, "@gmail.com"],
  [/@gamil\.com$/i, "@gmail.com"],
  [/@gmaill\.com$/i, "@gmail.com"],
  [/@gmail\.co$/i, "@gmail.com"],
  [/@gmail\.cm$/i, "@gmail.com"],
  [/@gmail\.cmo$/i, "@gmail.com"],
  [/@gmail\.con$/i, "@gmail.com"],
  [/@gmaik\.com$/i, "@gmail.com"],
  [/@hotmal\.com$/i, "@hotmail.com"],
  [/@homail\.com$/i, "@hotmail.com"],
  [/@hotmial\.com$/i, "@hotmail.com"],
  [/@hotmail\.co$/i, "@hotmail.com"],
  [/@hotmail\.con$/i, "@hotmail.com"],
  [/@outlok\.com$/i, "@outlook.com"],
  [/@outook\.com$/i, "@outlook.com"],
  [/@outlook\.con$/i, "@outlook.com"],
  [/@yaho\.com$/i, "@yahoo.com"],
  [/@yahooo\.com$/i, "@yahoo.com"],
  [/\.ccom$/i, ".com"],
  [/\.comm$/i, ".com"],
  [/\.ocm$/i, ".com"],
  [/\.coml$/i, ".com"],
  [/\.con$/i, ".com"],
];

export function checkEmailTypo(email: string): string {
  const lower = email.toLowerCase().trim();
  if (!lower.includes("@") || !lower.includes(".")) return "";
  for (const [pattern, fix] of CORRECTIONS) {
    if (pattern.test(lower)) {
      const suggested = lower.replace(pattern, fix);
      if (suggested === lower) return "";
      return suggested;
    }
  }
  return "";
}
