/** The admin login shortcut on the main page is a development convenience: never shown in production. */
export function showAdminLoginLink(nodeEnv: string | undefined): boolean {
  return nodeEnv !== "production";
}
