import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Clawlive - Every Voice Deserves a Lobster',
  description:
    'AI-powered meeting assistant where every participant gets a personal lobster advisor.',
  icons: {
    icon: '/favicon.ico',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen font-sans">
        <div className="flex min-h-screen flex-col">{children}</div>
      </body>
    </html>
  );
}
