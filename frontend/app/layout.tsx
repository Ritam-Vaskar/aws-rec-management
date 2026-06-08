import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "AWS Resource Governance Dashboard",
  description: "Prototype dashboard for multi-account AWS resource governance.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}