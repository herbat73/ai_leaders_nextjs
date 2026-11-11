# RET-012: Zgłoszenie braku elementu, okno 14 dni i rozwiązania zależne od rodzaju

- **ID:** RET-012
- **Kategoria:** brak elementu / API i panel agenta
- **Priorytet:** High
- **Typ:** API z krokiem UI agenta
- **Rola:** gość (klient), potem agent (konto QA z `MANAGE_RULES`)
- **Specyfikacja:** [2026-11-10-transport-damage-and-missing-items](../../specs/2026-11-10-transport-damage-and-missing-items.md) (Faza 1)

## Test implementation

- [RET-012-missing-item-and-window.sh](RET-012-missing-item-and-window.sh) (curl + agent-browser, POSIX sh; wersji PowerShell nie ma)

## Warunki wstępne

- Środowisko jak w RET-011. Dane: PL-10001 (dostarczone 3 dni temu) i PL-10003 (dostarczone 120 dni temu).

## Scenariusz

```gherkin
Given okno zgłoszeń uszkodzeń i braków wynosi 14 dni
When klient zgłasza brak elementu dla zamówienia sprzed 120 dni
Then zgłoszenie jest odrzucone jako „outside_window”
And „resend_part” jest dozwolone dla braku, a dla uszkodzenia w transporcie daje błąd walidacji
And ta sama pozycja nie może być zgłoszona dwa razy, a agent widzi rodzaj i prowadzi zgłoszenie do „Zakończone”
```

| Krok | Akcja | Oczekiwany rezultat |
|---|---|---|
| 1 | PL-10003, `kind: missing` (negatywny) | `outside_window` |
| 2 | PL-10001, `kind: transport`, `resend_part` (negatywny) | `validation_error` |
| 3 | PL-10001, `kind: missing`, `resend_part` | 201, RMA, rozwiązanie `resend_part` |
| 4 | Ta sama pozycja jeszcze raz (negatywny) | `already_claimed` |
| 5 | Agent: karta, „Zatwierdź”, „Zakończ” | „Zakończone” |
| 6 | `/admin/returns?kind=missing` | RMA na liście |

## Stan wykonania

Jak w RET-011: napisany, nie uruchomiony przez agenta autonomicznego; uruchomić ręcznie przed scaleniem.
