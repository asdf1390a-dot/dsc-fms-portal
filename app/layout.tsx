import type { Metadata } from 'next'

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
      <body>{children}</body>
    </html>
  )
}
