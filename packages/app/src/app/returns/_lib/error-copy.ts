import { customerErrorKey, type CustomerErrorKey } from "@easyrms/core";

/** Polish copy per customer-facing error key (N3); shared by the lookup page and the wizard. */
export const errorCopy = {
  not_found: "Nie znaleźliśmy zamówienia pasującego do podanych danych. Sprawdź numer zamówienia i adres e-mail.",
  rate_limited: "Zbyt wiele prób. Odczekaj chwilę i spróbuj ponownie.",
  service_unavailable: "Nie możemy teraz sprawdzić zamówienia, spróbuj za chwilę.",
  csrf_rejected: "Nie udało się zweryfikować żądania. Odśwież stronę i spróbuj ponownie.",
  network_error: "Brak połączenia z serwerem. Sprawdź internet i spróbuj ponownie.",
  unexpected_response: "Otrzymaliśmy nieoczekiwaną odpowiedź serwera. Spróbuj ponownie za chwilę.",
  unauthorized: "Sesja wygasła. Sprawdź zamówienie ponownie.",
  validation_error: "Popraw zaznaczone pola i spróbuj ponownie.",
  generic: "Coś poszło nie tak. Spróbuj ponownie za chwilę.",
} as const satisfies Record<CustomerErrorKey, string>;

/** Polish message for a failed `apiCall`; field errors are shown by the form itself. */
export function errorMessage(error: { code: string }, status?: number): { key: CustomerErrorKey; message: string } {
  const key = customerErrorKey(error.code, status);
  return { key, message: errorCopy[key] };
}
