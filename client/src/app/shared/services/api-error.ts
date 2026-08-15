import {HttpErrorResponse} from '@angular/common/http';

/**
 * Traduction des codes d'erreur de l'API en messages utilisateur.
 *
 * Les messages renvoyés par l'API sont en anglais et destinés aux logs, pas à
 * l'affichage : on ne se sert que du `code`, qui lui fait partie du contrat.
 */
const DEFAULT_MESSAGES: { [code: string]: string } = {
  VALIDATION_ERROR: 'Les informations fournies ne sont pas valides. Veuillez vérifier les champs et réessayer.',
  RATE_LIMITED: 'Trop de tentatives. Veuillez patienter quelques minutes avant de réessayer.',
  PAYLOAD_TOO_LARGE: 'L\'envoi est trop volumineux (1 Mo maximum). Découpez-le en plusieurs lots.',
  MAINTENANCE_MODE: 'Maintenance en cours. Veuillez réessayer dans quelques minutes.',
  NOT_FOUND: 'La ressource demandée est introuvable.',
  FORBIDDEN: 'Vous n\'avez pas les droits nécessaires pour cette action.',
  INTERNAL_SERVER_ERROR: 'Une erreur serveur est survenue. Veuillez réessayer plus tard.',
};

/**
 * Angular met `status` à 0 quand aucune réponse n'a été reçue : réseau coupé, DNS,
 * CORS, timeout. Ce n'est pas une erreur serveur, et le dire à l'utilisateur lui
 * évite de croire que le service est en panne.
 */
const NETWORK_ERROR = 'Impossible de joindre le serveur. Vérifiez votre connexion.';

export function apiErrorText(
  error: unknown,
  opts?: { fallback?: string; overrides?: { [code: string]: string } },
): string {
  const err = error as HttpErrorResponse;

  if (err?.status === 0) return NETWORK_ERROR;

  const code: string = err?.error?.error?.code;
  return (
    opts?.overrides?.[code] ??
    DEFAULT_MESSAGES[code] ??
    opts?.fallback ??
    'Une erreur est survenue. Veuillez réessayer.'
  );
}
