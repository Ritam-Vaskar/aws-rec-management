import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ThemeProvider } from "@/lib/theme";
import { DashboardShell } from "./components/DashboardShell";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "AWS Dash — Resource Governance",
  description: "Cross-account AWS resource inventory and governance dashboard",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider>
          <DashboardShell>
            {children}
          </DashboardShell>
        </ThemeProvider>
      </body>
    </html>
  );
}
