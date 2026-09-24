import "./globals.css";

export const metadata = {
  title: {
    default: "Founda CRM — Persistent AI Agent Workspace",
    template: "%s | Founda CRM",
  },
  description:
    "ChatGPT-style persistent workspace for opencode agents. Free agents, voice input, image upload, session export/import. Installable as an app.",
  icons: {
    icon: "/favicon.svg",
    apple: "/apple-touch-icon.svg",
  },
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Founda CRM",
  },
  openGraph: {
    title: "Founda CRM — Persistent AI Agent Workspace",
    description: "ChatGPT-style persistent workspace for opencode agents.",
    type: "website",
    siteName: "Founda CRM",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#09090b",
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-[#09090b] text-zinc-100 antialiased">
        {children}
      </body>
    </html>
  );
}