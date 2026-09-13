import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "CapitalLens | Portfolio Dashboard",
  description:
    "Live portfolio dashboard with sector performance, market prices from Yahoo Finance and fundamentals from Google Finance.",
};

/**
 * Applies the saved theme before first paint.
 *
 * Without this the page would render in the default dark palette and then snap
 * to light for a reader who chose light -- a visible flash on every load. It
 * has to be inline and synchronous in <head> to land ahead of paint.
 */
const themeScript = `
(function () {
  try {
    var saved = localStorage.getItem("capitallens-theme");
    if (saved === "light" || saved === "dark") {
      document.documentElement.setAttribute("data-theme", saved);
    }
  } catch (e) {
    /* Private mode or blocked storage: fall through to the dark default. */
  }
})();
`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      data-theme="dark"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
