import {DestroyRef, Signal, signal} from '@angular/core';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {AbstractControl} from '@angular/forms';

/** Longueurs maximales d'un secret acceptées par l'API (server/src/modules/links/link.schema.ts). */
export const SECRET_MAX_ANONYMOUS = 64;
export const SECRET_MAX_ACCOUNT = 4096;

/**
 * Suit la longueur d'un champ sous forme de signal.
 *
 * Les champs de secret ne portent pas d'attribut maxlength : le navigateur
 * tronquerait sans prévenir un collage trop long. La limite passe par
 * Validators.maxLength, et le champ est marqué touché dès le dépassement pour
 * qu'Ionic affiche l'erreur sans attendre que l'utilisateur quitte le champ.
 */
export function trackLength(control: AbstractControl<string | null>, destroyRef: DestroyRef): Signal<number> {
  const length = signal(control.value?.length ?? 0);
  control.valueChanges.pipe(takeUntilDestroyed(destroyRef)).subscribe(value => {
    length.set(value?.length ?? 0);
    if (control.hasError('maxlength')) control.markAsTouched();
  });
  return length.asReadonly();
}
