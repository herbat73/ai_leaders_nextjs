/** Polish copy for the invite page (brief D07), one constant colocated with the page. */
export const inviteCopy = {
  title: "Ustaw hasło",
  description: "Zaproszenie do panelu EasyRMS. Ustaw hasło, aby zalogować się po raz pierwszy.",
  password: "Hasło",
  passwordHint: "Co najmniej 12 znaków, bez innych wymagań.",
  submit: "Ustaw hasło i zaloguj się",
  pending: "Zapisywanie…",
  showPassword: "Pokaż hasło",
  hidePassword: "Ukryj hasło",
  tooShort: (minimum: number) => `Hasło musi mieć co najmniej ${minimum} znaków.`,
  tooLong: (maximum: number) => `Hasło może mieć najwyżej ${maximum} znaków.`,
  invalidTitle: "Link jest nieprawidłowy lub wygasł",
  invalid: "Link zaproszenia jest nieprawidłowy, wygasł albo został już użyty. Poproś koleżankę lub kolegę z uprawnieniem do zarządzania agentami o nowe zaproszenie.",
  busy: "Serwer jest chwilowo zajęty. Spróbuj ponownie za chwilę.",
  genericError: "Nie udało się ustawić hasła. Spróbuj ponownie.",
  toLogin: "Przejdź do logowania",
};
