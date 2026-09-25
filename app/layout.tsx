import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import Link from "next/link";
import "./globals.css";

// Schriften liegen im Projekt: keine Anfragen an Google, gut für den Datenschutz.
const syne = localFont({ src: "./fonts/Syne.ttf", variable: "--font-display", weight: "400 800", display: "swap" });
const arimo = localFont({ src: "./fonts/Arimo.ttf", variable: "--font-body", weight: "400 700", display: "swap" });

export const metadata: Metadata = {
  title: { default: "KI-AG · PROVOID", template: "%s · KI-AG PROVOID" },
  description: "Die Plattform der KI-AG von PROVOID: eigene Ziele finden, KI-News, Projekte bauen.",
  robots: { index: false, follow: false },
};
export const viewport: Viewport = { themeColor: "#0B0A2E" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de" className={`${syne.variable} ${arimo.variable}`}>
      <body>
        {children}
        <footer className="footer">
          <div className="container">
            <span>PROVOID · Neuroscience-Startup aus Hamburg · NO BRAIN. NO GAIN.</span>
            <nav>
              <Link href="/datenschutz">Datenschutz</Link>
              <a href="https://provoid.de/impressum" target="_blank" rel="noreferrer">Impressum</a>
            </nav>
          </div>
        </footer>
      </body>
    </html>
  );
}
