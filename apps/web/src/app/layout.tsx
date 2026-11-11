import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/hooks/useAuth';

export const metadata: Metadata = {
  title: 'SIS Cyber Fortress | 12-in-1 Enterprise Cybersecurity Ecosystem',
  description:
    'Enterprise Cybersecurity Command Center — Secure, Monitor, Protect across Android, Web, and SOC operations.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-[#050B18] text-[#F3F7FF] antialiased">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
