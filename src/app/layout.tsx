import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Sidebar from "@/components/Sidebar";
import { getFileTree } from "@/lib/markdown";
import { headers } from 'next/headers';
import { siteTitle, siteDescription } from '@/lib/config';

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: siteTitle,
  description: siteDescription,
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const tree = getFileTree();
  const headersList = await headers();
  const pathname = headersList.get('x-pathname') || '';
  const isLoginPage = pathname === '/login';
  
  const recentDays = process.env.RECENT_DAYS_THRESHOLD ? parseInt(process.env.RECENT_DAYS_THRESHOLD) : 7;
  const accentColor = process.env.NEXT_PUBLIC_ACCENT_COLOR;

  return (
    <html lang="en" className="dark" style={accentColor ? { '--color-accent': accentColor } as React.CSSProperties : undefined}>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased bg-black`}>
        <div className="flex h-screen overflow-hidden">
          {!isLoginPage && <Sidebar tree={tree} recentDays={recentDays} />}
          <main className="flex-1 overflow-y-auto bg-black">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
