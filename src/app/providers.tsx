'use client';

import { ThemeProvider } from "@/components/theme-provider";
import { AuthProvider } from "@/hooks/useSupabaseAuth";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <ThemeProvider defaultTheme="system" storageKey="theme">
        {children}
      </ThemeProvider>
    </AuthProvider>
  );
}