# Best practices pisania scenariuszy testów integracyjnych

## 1. Testuj zachowanie systemu, a nie szczegóły implementacji

Test powinien opisywać rezultat widoczny dla użytkownika lub innego systemu.

**Dobrze:**

> Po poprawnym opłaceniu zamówienia jego status zmienia się na „Opłacone”.

**Źle:**

> Metoda `updateOrderStatus()` została wywołana dokładnie jeden raz.

Drugi przykład bada implementację, więc test może przestać działać po poprawnym refaktoringu.

## 2. Jeden scenariusz powinien sprawdzać jeden przypadek biznesowy

Scenariusz może zawierać wiele kroków, ale powinien mieć jeden jasno określony cel.

```gherkin
Scenariusz: Użytkownik opłaca zamówienie kartą

Given użytkownik ma nieopłacone zamówienie
When dokonuje poprawnej płatności
Then zamówienie otrzymuje status „Opłacone”
And użytkownik widzi potwierdzenie płatności
```

Nie należy w tym samym scenariuszu dodatkowo testować anulowania, zwrotu i pobierania faktury.

## 3. Używaj struktury Given–When–Then

- **Given** – stan początkowy,
- **When** – wykonywana akcja,
- **Then** – oczekiwany rezultat.

```gherkin
Given klient posiada aktywne konto
And produkt jest dostępny
When klient składa zamówienie
Then zamówienie zostaje utworzone
And stan magazynowy produktu zmniejsza się o 1
```

## 4. Scenariusze muszą być deterministyczne

Ten sam test uruchomiony w tych samych warunkach powinien zawsze dawać ten sam wynik.

Unikaj:

- losowych danych bez zapisanego ziarna,
- zależności od aktualnej daty i godziny,
- współdzielonych danych pomiędzy testami,
- arbitralnego oczekiwania typu `wait(5000)`,
- zależności od kolejności uruchamiania testów,
- niestabilnych zewnętrznych usług.

Zamiast `wait(5000)` czekaj na konkretny stan:

```ts
await expect(page.getByText('Zamówienie opłacone')).toBeVisible();
```

## 5. Każdy test powinien działać niezależnie

Test powinien sam:

1. utworzyć potrzebne dane,
2. wykonać scenariusz,
3. zweryfikować wynik,
4. posprzątać dane, jeśli jest to konieczne.

Nie zakładaj, że wcześniejszy test utworzył użytkownika lub zamówienie.

## 6. Przygotowuj dane przez API lub bezpośrednią warstwę testową

Jeżeli testujesz ekran płatności, nie musisz za każdym razem przechodzić przez rejestrację, logowanie i budowanie koszyka.

```ts
const order = await testApi.createOrder({
  status: 'pending',
  total: 100,
});
```

Następnie przez interfejs testujesz wyłącznie interesujący przepływ. Wyjątkiem jest scenariusz, którego celem jest sprawdzenie całej ścieżki użytkownika.

## 7. Sprawdzaj rezultat na właściwych poziomach

Test integracyjny może weryfikować jednocześnie kilka współpracujących elementów:

- odpowiedź API,
- zmianę widoczną w interfejsie,
- zapis w bazie,
- publikację zdarzenia,
- wywołanie kontrolowanej integracji zewnętrznej.

Nie sprawdzaj jednak wszystkiego w każdym teście. Weryfikuj tylko rezultaty istotne dla danego scenariusza.

## 8. Integracje zewnętrzne zastępuj kontrolowanymi odpowiednikami

Stripe, system pocztowy lub zewnętrzne API nie powinny powodować losowych awarii testów.

Można wykorzystać:

- środowisko testowe dostawcy,
- mock server,
- fake adapter,
- przechwytywanie żądań,
- zapisane odpowiedzi kontraktowe.

Test powinien jednak sprawdzić, czy system wysłał właściwe żądanie:

```gherkin
Then do Stripe zostało wysłane żądanie płatności
And zawierało kwotę 100 PLN
And identyfikator testowanego zamówienia
```

Nie mockuj natomiast własnych komponentów, których współpracę dany test ma zweryfikować.

## 9. Testuj przypadki pozytywne, negatywne i graniczne

Dla każdej ważnej funkcji uwzględnij:

- poprawny przebieg,
- niepoprawne dane,
- brak uprawnień,
- brak wymaganego zasobu,
- konflikt lub powtórzenie operacji,
- timeout integracji,
- błąd zewnętrznego systemu,
- wartości graniczne.

Przykład dla płatności:

1. Płatność zakończona sukcesem.
2. Płatność odrzucona.
3. Brak odpowiedzi operatora.
4. Ponowne wysłanie tego samego webhooka.
5. Webhook z niepoprawnym podpisem.

## 10. Weryfikuj idempotencję

Powtórzenie komunikatu, webhooka albo żądania nie powinno wykonywać operacji drugi raz.

```gherkin
Given zamówienie zostało już opłacone
When system ponownie otrzymuje ten sam webhook
Then status zamówienia pozostaje „Opłacone”
And druga płatność nie zostaje zaksięgowana
```

## 11. Używaj stabilnych selektorów UI

Preferowana kolejność:

1. rola i dostępna nazwa,
2. etykieta pola,
3. tekst widoczny dla użytkownika,
4. `data-testid`, gdy nie ma stabilnego selektora semantycznego.

```ts
page.getByRole('button', { name: 'Zapłać' });
page.getByLabel('Adres e-mail');
page.getByTestId('payment-status');
```

Unikaj selektorów zależnych od struktury i wyglądu:

```css
div.container > div:nth-child(3) > button.primary
```

## 12. Asercje powinny być konkretne

**Za słabo:**

```ts
expect(response.ok()).toBeTruthy();
```

**Lepiej:**

```ts
expect(response.status()).toBe(201);
expect(body).toMatchObject({
  status: 'paid',
  currency: 'PLN',
  amount: 10000,
});
```

Po awarii powinno być od razu wiadomo, co się nie zgadza.

## 13. Nie ukrywaj ważnych kroków w nadmiernie ogólnych helperach

Helper:

```ts
await completeCheckout(page, order);
```

jest wygodny, ale może ukrywać połowę testowanego zachowania. Lepsze są małe funkcje o jednoznacznej odpowiedzialności:

```ts
await openCheckout(page, order.id);
await enterPaymentDetails(page, validCard);
await confirmPayment(page);
```

## 14. Nazwa testu powinna opisywać warunek i rezultat

**Dobrze:**

```text
odrzuca płatność, gdy podpis webhooka jest niepoprawny
```

**Źle:**

```text
test płatności 3
```

Dobry schemat:

```text
[akcja] + [warunek] + [oczekiwany rezultat]
```

## 15. Pisz scenariusze ręcznie i przeglądaj te wygenerowane przez AI

AI może pomóc utworzyć szkic lub wskazać brakujące przypadki, ale ostateczny scenariusz powinien być:

- oparty na wymaganiu biznesowym,
- jednoznaczny,
- deterministyczny,
- zrozumiały dla zespołu,
- sprawdzony przez człowieka.

Najważniejsza zasada:

> **AI może pomóc napisać test, ale oczekiwany rezultat musi wynikać ze specyfikacji, a nie z przypuszczenia modelu.**
