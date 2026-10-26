import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Sharad Utsav 2026 Ticketing | Radha Krishna Temple',
  description: 'Official general admission passes, workshops, and catering for Sharad Utsav 2026.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-primaryDark text-white font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
