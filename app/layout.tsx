import type { Metadata } from 'next'
import { LanguageProvider } from '@/lib/i18n/context'
import BottomNavApp from '@/components/BottomNavApp'
import './globals.css'

export const metadata: Metadata = {
  title: 'DSC FMS Portal',
  description: 'DSC Mannur Facility Management System',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body style={{ paddingBottom: 'calc(60px + env(safe-area-inset-bottom, 0))' }}>
        <LanguageProvider>
          {children}
          <BottomNavApp />
        </LanguageProvider>
      </body>
    </html>
  )
}
