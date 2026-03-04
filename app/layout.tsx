import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { TooltipProvider } from "@/components/ui/tooltip";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SACCOFlow",
  description: "SACCO digitization platform",
};

const themeBootScript = `
(() => {
  try {
    const palettes = {
      light: {
        "--background": "#f2f5fb",
        "--foreground": "#172033",
        "--surface": "#ffffff",
        "--surface-soft": "#f5f8ff",
        "--border": "#d8dfed",
        "--accent": "#f0c619",
        "--accent-strong": "#d8b110",
        "--ring": "#f0c61966",
        "--muted": "#4f5d78",
        "--muted-soft": "#70819c",
        "--cta-text": "#1a2334",
      },
      dark: {
        "--background": "#131a2a",
        "--foreground": "#eef2fb",
        "--surface": "#1d2738",
        "--surface-soft": "#243042",
        "--border": "#2f3d52",
        "--accent": "#f4cc1f",
        "--accent-strong": "#deba13",
        "--ring": "#f4cc1f66",
        "--muted": "#b7c2d8",
        "--muted-soft": "#95a3bc",
        "--cta-text": "#1a2334",
      },
    };
    const key = "saccoflow-theme";
    const stored = localStorage.getItem(key);
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const theme =
      stored === "light" || stored === "dark"
        ? stored
        : (prefersDark ? "dark" : "light");
    const tokens = palettes[theme];
    for (const token in tokens) {
      document.documentElement.style.setProperty(token, tokens[token]);
    }
    document.documentElement.classList.toggle("dark", theme === "dark");
    document.documentElement.setAttribute("data-theme", theme);
    document.documentElement.style.colorScheme = theme;
  } catch {}
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <TooltipProvider>{children}</TooltipProvider>
      </body>
    </html>
  );
}
