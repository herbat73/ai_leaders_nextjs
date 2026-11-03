import type { Metadata } from "next";
import type { ReactNode } from "react";

import { ThemeToggle } from "@easyrms/ui";

import "./globals.css";

// Runs before first paint: stored choice, else the OS preference.
const themeScript = `try{var t=localStorage.getItem("theme");if(t?t==="dark":matchMedia("(prefers-color-scheme: dark)").matches)document.documentElement.classList.add("dark")}catch(e){}`;

export const metadata: Metadata = {
  title: "EasyRMS",
  description: "Easy Return Management System",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="pl" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <ThemeToggle />
        {children}
      </body>
    </html>
  );
}
