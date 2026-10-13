import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

/** Enforces the AGENTS.md dependency direction and the shared API/UI layer rules. */
const internalPackages = ["@easyrms/app", "@easyrms/core", "@easyrms/db", "@easyrms/ui"];

const forbid = (...patterns) => ({
  "no-restricted-imports": ["error", { patterns: patterns.map(({ group, message }) => ({ group, message })) }],
});

const FRAMEWORK_GROUP = ["next", "next/*", "react", "react/*", "react-dom", "react-dom/*"];

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  { settings: { next: { rootDir: "packages/app" } } },
  {
    files: ["packages/core/**/*.{ts,tsx}"],
    rules: forbid(
      { group: FRAMEWORK_GROUP, message: "core must not import React or Next.js." },
      { group: internalPackages.filter((name) => name !== "@easyrms/core").flatMap((name) => [name, `${name}/*`]), message: "core must not import other internal packages." },
      { group: ["@mikro-orm/*"], message: "Only @easyrms/db may import MikroORM." },
    ),
  },
  {
    files: ["packages/db/**/*.{ts,tsx}"],
    rules: forbid(
      { group: FRAMEWORK_GROUP, message: "db must not import React or Next.js." },
      { group: ["@easyrms/app", "@easyrms/app/*", "@easyrms/ui", "@easyrms/ui/*"], message: "db may only import core (shared types)." },
    ),
  },
  {
    files: ["packages/ui/**/*.{ts,tsx}"],
    rules: forbid(
      { group: internalPackages.filter((name) => name !== "@easyrms/ui").flatMap((name) => [name, `${name}/*`]), message: "ui must not import other internal packages; receive data via props." },
      { group: ["@mikro-orm/*"], message: "Only @easyrms/db may import MikroORM." },
    ),
  },
  {
    files: ["packages/app/**/*.{ts,tsx}"],
    rules: forbid({ group: ["@mikro-orm/*"], message: "Only @easyrms/db may import MikroORM." }),
  },
  {
    files: ["packages/**/*.{ts,tsx}"],
    ignores: ["packages/ui/src/admin/api/api-call.ts"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "CallExpression[callee.name='fetch']",
          message: "Use apiCall from @easyrms/ui/admin; it is the only sanctioned fetch call site.",
        },
      ],
    },
  },
  globalIgnores([".next/**", "**/.next/**", "out/**", "build/**", "next-env.d.ts", "**/next-env.d.ts", "node_modules/**"]),
]);

export default eslintConfig;
