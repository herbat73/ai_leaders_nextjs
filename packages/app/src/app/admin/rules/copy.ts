/** Polish copy for the rules screen (brief D07), one constant colocated with the page. */
export const rulesCopy = {
  title: "Reguły",
  description: "Aktywne reguły rozstrzygania spraw (tylko do odczytu). Zmiana progu poniżej nic nie zapisuje.",
  forbiddenTitle: "Brak dostępu",
  forbidden: "Ta strona jest dostępna tylko dla agentów z uprawnieniem do zarządzania regułami.",
  ruleLabels: { settles: "Rozstrzyga", routes: "Kieruje", disabled: "Wyłączona", when: "Gdy", then: "Wtedy" },
  whatIf: {
    title: "Symulacja progów",
    description: "Sprawdź, ile obecnych spraw rozstrzygnęłyby reguły przy innych progach. Puste pole oznacza próg obecny.",
    thresholdLabel: (id: string) => `Próg ${id} (zł)`,
    placeholder: (current: string) => `obecnie ${current}`,
    run: "Przelicz",
    running: "Liczenie…",
    ready: "Wynik symulacji jest gotowy.",
    invalid: "Niepoprawny próg",
    errors: {
      validation_error: "Niepoprawny próg. Podaj kwotę od 0 do 1 000 000 zł, np. 200,00.",
      forbidden: "Brak uprawnień do symulacji.",
      unauthorized: "Sesja wygasła. Zaloguj się ponownie.",
      fallback: "Nie udało się przeliczyć. Spróbuj ponownie.",
    } as Record<string, string>,
    summary: (total: number, skipped: number) =>
      `Ocenione sprawy: ${total}. Pominięte (bez kwoty, np. wymiana): ${skipped}.`,
    truncated: "Jest więcej spraw niż limit symulacji; oceniono tylko pierwsze z nich.",
    caption: "Wynik symulacji",
    columns: { rule: "Reguła", now: "Obecnie", tried: "Po zmianie" },
    settledRow: "Rozstrzygnięte sprawy",
    shareOf: (count: number, share: number | null) => (share === null ? `${count}` : `${count} (${Math.round(share * 100)}%)`),
    empty: "Brak spraw z kwotą do oceny.",
  },
};
