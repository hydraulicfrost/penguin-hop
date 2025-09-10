"use client"

import { AbstractWalletProvider, useLoginWithAbstract } from "@abstract-foundation/agw-react"
import { useAccount } from "wagmi"
import { abstractTestnet } from "viem/chains"
import { useState, useEffect, useRef } from "react"

// Environment variable for API URL - uses Vercel env var or falls back to localhost
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:3001'

function LoginButton() {
  const { login } = useLoginWithAbstract()
  const { address, isConnected } = useAccount()
  const [gameSession, setGameSession] = useState<any>(null)
  const [leaderboard, setLeaderboard] = useState<any[]>([])
  const wsRef = useRef<WebSocket | null>(null)

  useEffect(() => {
    console.log('Account state changed:', { address, isConnected })
  }, [address, isConnected])

  useEffect(() => {
    if (isConnected && address) {
      fetchLeaderboard()
      connectWebSocket()
    }
    
    return () => {
      if (wsRef.current) {
        wsRef.current.close()
      }
    }
  }, [isConnected, address])

  const connectWebSocket = () => {
    try {
      const wsUrl = API_BASE_URL.replace('https://', 'wss://').replace('http://', 'ws://')
      const ws = new WebSocket(wsUrl)
      wsRef.current = ws

      ws.onopen = () => {
        console.log('WebSocket connected')
      }

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data)
        if (data.type === 'leaderboard_update') {
          setLeaderboard(data.leaderboard)
        }
      }

      ws.onclose = () => {
        console.log('WebSocket disconnected')
      }

      ws.onerror = (error) => {
        console.error('WebSocket error:', error)
      }
    } catch (error) {
      console.error('Failed to connect WebSocket:', error)
    }
  }

  const fetchLeaderboard = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/leaderboard`)
      if (response.ok) {
        const data = await response.json()
        setLeaderboard(data.leaderboard || [])
      }
    } catch (error) {
      console.error('Failed to fetch leaderboard:', error)
    }
  }

  const verifyNFT = async () => {
    if (!address) return
    
    console.log('Attempting to verify NFT for:', address)
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/verify-nft`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ walletAddress: address }),
      })
      
      const data = await response.json()
      console.log('NFT verification response:', data)
      
      if (data.status === 200) {
        setGameSession(data)
        alert(`NFT verified! Game session created: ${data.tournament_id}`)
      } else {
        alert(`Verification failed: ${data.message}`)
      }
    } catch (error) {
      console.error('NFT verification failed:', error)
      alert(`Verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  const exitGame = () => {
    setGameSession(null)
  }

  const formatAddress = (addr: string | undefined) => {
    if (!addr) return ''
    return `${addr.substring(0, 6)}...${addr.substring(38)}`
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString()
  }

  return (
    <div className="min-h-screen relative overflow-hidden" style={{ fontFamily: '"Fredoka One", "Nunito", "Comic Sans MS", cursive' }}>
      {/* Background Image */}
      <div 
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: `url('/background.png')`,
          minHeight: '100vh'
        }}
      >
        {/* Optional overlay for better text readability */}
        <div className="absolute inset-0 bg-black/10"></div>
      </div>

      {/* Animated Snowflakes */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {[...Array(20)].map((_, i) => (
          <div
            key={i}
            className="absolute text-white opacity-70 animate-pulse"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 3}s`,
              fontSize: `${Math.random() * 10 + 10}px`
            }}
          >
            ❄
          </div>
        ))}
      </div>

      {/* Top Banner */}
      <div className="relative z-20 bg-gradient-to-r from-blue-100/20 via-cyan-100/15 to-blue-100/20 backdrop-blur-md border-b border-blue-200/30 shadow-lg">
        {/* Frosted glass overlay */}
        <div className="absolute inset-0 bg-gradient-to-r from-white/5 via-white/10 to-white/5"></div>
        
        {/* Decorative snowflakes */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-2 left-8 text-white/30 text-xs">❄</div>
          <div className="absolute top-4 right-16 text-white/20 text-sm">❅</div>
          <div className="absolute bottom-2 left-1/3 text-white/25 text-xs">❄</div>
        </div>
        
        <div className="relative max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          {/* Left - Twitter Link */}
          <a 
            href="https://twitter.com" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-white hover:text-blue-200 transition-colors duration-200 text-xl font-bold drop-shadow-lg"
            style={{ fontFamily: '"Fredoka One", "Nunito", "Comic Sans MS", cursive' }}
          >
            🐦 Twitter
          </a>
          
          {/* Right - Wallet Info */}
          {isConnected && address && (
            <div className="flex items-center space-x-6">
              <span className="text-white font-bold drop-shadow-lg" style={{ fontFamily: '"Fredoka One", "Nunito", "Comic Sans MS", cursive' }}>
                {formatAddress(address)}
              </span>
              <div className="bg-yellow-400/90 backdrop-blur-sm px-3 py-1 rounded-full text-black font-bold text-sm border border-yellow-300/50 shadow-lg" style={{ fontFamily: '"Fredoka One", "Nunito", "Comic Sans MS", cursive' }}>
                Coins: 127
              </div>
              <div className="bg-green-400/90 backdrop-blur-sm px-3 py-1 rounded-full text-black font-bold text-sm border border-green-300/50 shadow-lg" style={{ fontFamily: '"Fredoka One", "Nunito", "Comic Sans MS", cursive' }}>
                Best: 2,500
              </div>
              <button 
                onClick={() => window.location.reload()}
                className="bg-red-400/90 backdrop-blur-sm hover:bg-red-500/90 text-white font-bold px-4 py-2 rounded-full transition-all duration-200 border border-red-300/50 shadow-lg text-sm"
                style={{ fontFamily: '"Fredoka One", "Nunito", "Comic Sans MS", cursive' }}
              >
                Disconnect
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="relative z-10 min-h-[calc(100vh-80px)]">
        {!isConnected ? (
          <div className="h-full flex items-center justify-center p-6">
            <div className="bg-white/10 backdrop-blur-md rounded-3xl p-8 text-center border border-white/20 shadow-2xl max-w-md">
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-white drop-shadow-md" style={{ fontFamily: '"Fredoka One", "Nunito", "Comic Sans MS", cursive', fontWeight: '900' }}>Welcome to Penguin Hop</h2>
                <p className="text-gray-600 mb-6" style={{ fontFamily: '"Nunito", sans-serif' }}>Connect your Abstract Global Wallet to start your winter adventure!</p>
              </div>
              
              <button
                onClick={login}
                className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-bold py-4 px-8 rounded-2xl transition-all duration-200 transform hover:scale-105 shadow-xl text-lg"
                style={{ fontFamily: '"Fredoka One", "Nunito", "Comic Sans MS", cursive' }}
              >
                🐧 Connect Winter Wallet
              </button>
            </div>
          </div>
        ) : !gameSession ? (
          <div className="h-full flex items-center justify-center p-6">
            <div className="bg-white/10 backdrop-blur-md rounded-3xl p-8 text-center border border-white/20 shadow-2xl max-w-md">
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-white drop-shadow-md" style={{ fontFamily: '"Fredoka One", "Nunito", "Comic Sans MS", cursive', fontWeight: '900' }}>Ready for Adventure!</h2>
                <p className="text-gray-200 mb-6" style={{ fontFamily: '"Nunito", sans-serif' }}>Verify your NFT ownership to access the Penguin Hop challenge.</p>
              </div>
              
              <button
                onClick={verifyNFT}
                className="bg-gradient-to-r from-green-500 to-blue-600 hover:from-green-600 hover:to-blue-700 text-white font-bold py-4 px-8 rounded-2xl transition-all duration-200 transform hover:scale-105 shadow-xl text-lg"
                style={{ fontFamily: '"Fredoka One", "Nunito", "Comic Sans MS", cursive' }}
              >
                ❄️ Verify NFT & Access Game
              </button>
            </div>
          </div>
        ) : (
          <div className="h-full relative">
            {/* Game Container - fills browser window */}
            <div 
              id="game-container" 
              className="w-full h-full bg-black overflow-hidden"
            >
              <div className="w-full h-full flex items-center justify-center relative">
                <iframe
                  src={`https://coco-and-bridge.marketjs-cloud2.com/en/coco-and-bridge-penguin-hop/1756889184732/index.html?tournament_id=${gameSession.tournament_id}&user_id=${gameSession.user_id}&game_id=${gameSession.game_id}`}
                  className="w-full h-full border-0"
                  title="Penguin Hop Game"
                />
                
                {/* Exit Game Button */}
                <button
                  onClick={exitGame}
                  className="absolute top-4 right-4 bg-red-500/80 hover:bg-red-600/80 text-white font-bold px-4 py-2 rounded-lg transition-all duration-200 z-10"
                  style={{ fontFamily: '"Fredoka One", "Nunito", "Comic Sans MS", cursive' }}
                >
                  🏠 Exit Game
                </button>
              </div>
            </div>

            {/* Hover-out Ice Leaderboard - positioned for browser window */}
            <div className="fixed top-20 right-0 h-[calc(100vh-80px)] z-50 group">
              {/* Hover trigger area */}
              <div className="w-4 h-full bg-transparent"></div>
              
              {/* Leaderboard panel */}
              <div className="absolute top-0 right-0 h-full w-80 transform translate-x-full group-hover:translate-x-0 transition-transform duration-300 ease-out">
                {/* Ice-like background matching banner */}
                <div className="h-full bg-gradient-to-r from-blue-100/20 via-cyan-100/15 to-blue-100/20 backdrop-blur-md border-l border-blue-200/30 shadow-2xl">
                  {/* Frosted glass overlay */}
                  <div className="absolute inset-0 bg-gradient-to-r from-white/5 via-white/10 to-white/5"></div>

                  <div className="relative h-full p-6 overflow-y-auto">
                    <h3 className="text-lg font-bold text-white drop-shadow-lg mb-4" style={{ fontFamily: '"Fredoka One", "Nunito", "Comic Sans MS", cursive' }}>Live Leaderboard</h3>
                    
                    <div className="space-y-3">
                      {leaderboard.length > 0 ? (
                        leaderboard.map((entry, index) => (
                          <div 
                            key={entry.id} 
                            className="bg-white/15 backdrop-blur-sm rounded-xl p-3 border border-white/20 shadow-lg"
                          >
                            <div className="flex justify-between items-center">
                              <div className="flex items-center space-x-3">
                                <div className="text-lg font-bold text-white" style={{ fontFamily: '"Fredoka One", "Nunito", "Comic Sans MS", cursive' }}>
                                  {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `#${index + 1}`}
                                </div>
                                <div>
                                  <p className="text-sm font-medium text-white" style={{ fontFamily: '"Fredoka One", "Nunito", "Comic Sans MS", cursive' }}>
                                    {entry.user_id === (address || '') ? 'You' : formatAddress(entry.user_id)}
                                  </p>
                                  <p className="text-xs text-gray-300" style={{ fontFamily: '"Nunito", sans-serif' }}>
                                    {formatDate(entry.created_at)}
                                  </p>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="text-lg font-bold text-white" style={{ fontFamily: '"Fredoka One", "Nunito", "Comic Sans MS", cursive' }}>
                                  {entry.score}
                                </p>
                                <p className="text-xs text-gray-300" style={{ fontFamily: '"Nunito", sans-serif' }}>
                                  {entry.time}s
                                </p>
                              </div>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="text-center text-gray-300 py-8" style={{ fontFamily: '"Nunito", sans-serif' }}>
                          <p>🏆 No scores yet!</p>
                          <p className="text-sm">Be the first champion!</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Leaderboard Popup Modal */}
      {showLeaderboardPopup && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-gradient-to-r from-blue-100/20 via-cyan-100/15 to-blue-100/20 backdrop-blur-md rounded-3xl p-8 border border-blue-200/30 shadow-2xl max-w-md w-full mx-4">
            {/* Frosted glass overlay */}
            <div className="absolute inset-0 bg-gradient-to-r from-white/5 via-white/10 to-white/5 rounded-3xl"></div>
            
            <div className="relative">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-2xl font-bold text-white drop-shadow-lg" style={{ fontFamily: '"Fredoka One", "Nunito", "Comic Sans MS", cursive' }}>🏆 Live Leaderboard</h3>
                <button 
                  onClick={() => setShowLeaderboardPopup(false)}
                  className="text-white hover:text-red-300 text-2xl font-bold"
                >
                  ✕
                </button>
              </div>
              
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {leaderboard.length > 0 ? (
                  leaderboard.map((entry, index) => (
                    <div 
                      key={entry.id} 
                      className={`bg-white/15 backdrop-blur-sm rounded-xl p-4 border border-white/20 shadow-lg ${
                        entry.user_id === address ? 'ring-2 ring-yellow-400/50 bg-yellow-400/10' : ''
                      }`}
                    >
                      <div className="flex justify-between items-center">
                        <div className="flex items-center space-x-3">
                          <div className="text-xl font-bold text-white" style={{ fontFamily: '"Fredoka One", "Nunito", "Comic Sans MS", cursive' }}>
                            {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `#${index + 1}`}
                          </div>
                          <div>
                            <p className="text-sm font-bold text-white" style={{ fontFamily: '"Fredoka One", "Nunito", "Comic Sans MS", cursive' }}>
                              {entry.user_id === address ? 'You' : formatAddress(entry.user_id)}
                            </p>
                            <p className="text-xs text-gray-300" style={{ fontFamily: '"Nunito", sans-serif' }}>
                              {formatDate(entry.created_at)}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-xl font-bold text-white" style={{ fontFamily: '"Fredoka One", "Nunito", "Comic Sans MS", cursive' }}>
                            {entry.score}
                          </p>
                          <p className="text-xs text-gray-300" style={{ fontFamily: '"Nunito", sans-serif' }}>
                            {entry.time}s
                          </p>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center text-gray-300 py-8">
                    <p className="font-bold text-lg" style={{ fontFamily: '"Fredoka One", "Nunito", "Comic Sans MS", cursive' }}>🏆 No scores yet!</p>
                    <p className="text-sm" style={{ fontFamily: '"Nunito", sans-serif' }}>Be the first champion!</p>
                  </div>
                )}
              </div>
              
              <button 
                onClick={() => setShowLeaderboardPopup(false)}
                className="mt-6 w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-bold py-3 px-6 rounded-2xl transition-all duration-200"
                style={{ fontFamily: '"Fredoka One", "Nunito", "Comic Sans MS", cursive' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function GameClient() {
  return (
    <AbstractWalletProvider chain={abstractTestnet}>
      <link 
        href="https://fonts.googleapis.com/css2?family=Fredoka+One&family=Nunito:wght@400;600;700;800;900&display=swap" 
        rel="stylesheet" 
      />
      <LoginButton />
    </AbstractWalletProvider>
  )
}
