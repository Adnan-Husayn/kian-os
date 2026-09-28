"use client";

import * as React from "react";
import { ThemeProvider } from "next-themes";

/** next-themes provider: class-based dark mode, follows the OS by default. */
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      {children}
    </ThemeProvider>
  );
}
