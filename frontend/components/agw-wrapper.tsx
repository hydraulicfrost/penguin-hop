"use client"

import { AbstractWalletProvider } from "@abstract-foundation/agw-react"
import { abstractTestnet } from "viem/chains"
import { useEffect, useState } from 'react'

interface AGWWrapperProps {
  children: React.ReactNode
}

export default function AGWWrapper({ children }: AGWWrapperProps) {
  const [isClient, setIsClient] = useState(false)

  useEffect(() => {
    setIsClient(true)
  }, [])

  if (!isClient) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-4"></div>
          <p>Loading Abstract Global Wallet...</p>
        </div>
      </div>
    )
  }

  return (
    <AbstractWalletProvider chain={abstractTestnet}>
      {children}
    </AbstractWalletProvider>
  )
}