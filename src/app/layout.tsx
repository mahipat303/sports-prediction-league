import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { SessionProvider } from "next-auth/react";
import { auth } from "@/lib/auth";
import { getSettings, rulesValuesFrom } from "@/lib/scoring";
import { Navbar } from "@/components/navbar";
import { WelcomePopup } from "@/components/welcome-popup";
import { RulesButton } from "@/components/rules-button";
import { OpsHubLogo } from "@/components/opshub-logo";
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
  title: "OpsHub Sports Day League",
  description:
    "Predict match winners in the office Sports Day and climb the leaderboard. Virtual points only — no real money.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();
  const rulesValues = rulesValuesFrom(await getSettings());
  return (
    <html
      lang="en"
      className={`dark ${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        <script
          dangerouslySetInnerHTML={{
            __html: `try{const t=localStorage.getItem('theme');if(t==='light')document.documentElement.classList.remove('dark')}catch(e){}`,
          }}
        />
        <div className="app-backdrop" />
        <SessionProvider session={session}>
          {session?.user && <WelcomePopup name={session.user.name ?? ""} />}
          <Navbar session={session} />
          <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6">
            {children}
          </main>
          <footer className="border-t border-border/50 py-6">
            <div className="mx-auto flex max-w-6xl flex-col items-center gap-3 px-4">
              <div className="flex flex-col items-center gap-2">
                <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
                  An initiative by
                </span>
                <OpsHubLogo width={150} />
              </div>
              <p className="text-center text-xs text-muted-foreground">
                OpsHub Sports Day League · Virtual points only · Not a
                gambling app 🏆
              </p>
            </div>
          </footer>
          <RulesButton values={rulesValues} variant="floating" />
        </SessionProvider>
      </body>
    </html>
  );
}
