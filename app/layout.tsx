import type { Metadata } from 'next'
import { LanguageProvider } from '@/lib/i18n/context'
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
      <body>
        <LanguageProvider>
          {children}
        </LanguageProvider>
      </body>
    </html>
  )
}
