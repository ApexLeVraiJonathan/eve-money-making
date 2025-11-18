import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@eve/ui";
import { QueryProvider } from "@/components/query-provider";
import { SessionProvider } from "@/components/session-provider";
import { AuthLoadingBoundary } from "@/components/auth-loading-boundary";
import { SessionRefreshBoundary } from "@/components/session-refresh-boundary";
import { AppSidebar } from "@/components/sidebar/app-sidebar";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@eve/ui";
import { ActiveAppName } from "@/components/active-app-name";
import { DynamicBreadcrumbs } from "@/components/dynamic-breadcrumbs";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: { default: "EVE Money Making", template: "%s | EVE Money Making" },
  description: "Apex EVE Online Money Making Platform",
  icons: { icon: "/icon.svg", apple: "/icon.svg", shortcut: "/icon.svg" },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem={false}
          disableTransitionOnChange
        >
          <SessionProvider>
            <AuthLoadingBoundary>
              <SessionRefreshBoundary>
                <QueryProvider>
                  <SidebarProvider>
                    <AppSidebar />
                    <SidebarInset>
                      <header className="border-b">
                        <div className="mx-auto max-w-8xl p-4 flex items-center gap-3">
                          <SidebarTrigger />
                          <ActiveAppName />
                          <DynamicBreadcrumbs />
                        </div>
                      </header>
                      {children}
                    </SidebarInset>
                  </SidebarProvider>
                </QueryProvider>
              </SessionRefreshBoundary>
            </AuthLoadingBoundary>
          </SessionProvider>
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
