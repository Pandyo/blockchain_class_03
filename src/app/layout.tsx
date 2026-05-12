import type { Metadata } from 'next'
import './globals.css'
import { Providers } from './providers'

export const metadata: Metadata = {
  title: 'My Token DApp',
  description: 'Sepolia ERC-20 테스트 페이지',
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-white text-zinc-900">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
