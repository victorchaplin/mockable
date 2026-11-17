import type { Metadata } from "next";
import { assertDatabaseUrl } from "@/lib/env";
import "./globals.css";

// Fail fast with an actionable message when the required env is missing.
assertDatabaseUrl();

export const metadata: Metadata = {
  title: "mockable",
  description:
    "Generate five layout-divergent mock proposals from a prompt, refine the pick into a clickable prototype, and share it.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="min-h-full antialiased">{children}</body>
    </html>
  );
}
