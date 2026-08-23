/**
 * Normalisation des dates renvoyées par l'API : ISO-8601 en UTC, partout.
 *
 * Le pool est configuré avec `timezone: 'Z'` et sans `dateStrings`, donc mysql2 rend
 * des objets Date corrects. Le helper accepte quand même une chaîne MySQL brute
 * (`YYYY-MM-DD HH:MM:SS`), qu'il interprète en UTC : `new Date()` la lirait sinon en
 * heure locale, ce qui décalerait la valeur sur tout hôte hors UTC.
 */
/**
 * Tronque à la seconde. Les colonnes sont des DATETIME sans précision fractionnaire
 */
export function toSecondPrecision(date: Date): Date {
  const truncated = new Date(date.getTime());
  truncated.setMilliseconds(0);
  return truncated;
}

export function toIso(value: Date | string | null | undefined): string | null {
  if (value === null || value === undefined) return null;

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString();
  }

  const trimmed = String(value).trim();
  if (!trimmed) return null;

  // Une chaîne déjà pourvue d'un offset ou d'un 'Z' est sans ambiguïté.
  const hasZone = /(?:[Zz]|[+-]\d{2}:?\d{2})$/.test(trimmed);
  const parsed = new Date(hasZone ? trimmed : `${trimmed.replace(' ', 'T')}Z`);

  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}
