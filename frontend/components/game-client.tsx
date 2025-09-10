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
  const [showLeaderboardPopup, setShowLeaderboardPopup] = useState(false)
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

  const getUserPosition = () => {
    if (!address || leaderboard.length === 0) return 'Unranked'
    const userIndex = leaderboard.findIndex(entry => entry.user_id === address)
    return userIndex === -1 ? 'Unranked' : `${userIndex + 1}th`
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

      {/* Top Right Wallet Info - Only when connected but not in game */}
      {isConnected && address && !gameSession && (
        <div className="absolute top-6 right-6 z-30">
          <div className="bg-slate-800/90 backdrop-blur-md rounded-2xl px-4 py-2 border border-slate-600/50 flex items-center space-x-3">
            <div className="w-6 h-6 bg-green-500/20 rounded-lg flex items-center justify-center">
              <span className="text-green-400 text-xs">👤</span>
            </div>
            <span className="text-white font-bold text-sm" style={{ fontFamily: '"Fredoka One", "Nunito", "Comic Sans MS", cursive' }}>
              {formatAddress(address)}
            </span>
            <button 
              onClick={() => window.location.reload()}
              className="text-slate-400 hover:text-red-400 text-xs"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Top Banner - Gaming Style - Only show during game */}
      {gameSession && (
        <div className="relative z-20 bg-slate-900/95 backdrop-blur-md border-b border-slate-700/50 shadow-xl">
          <div className="relative max-w-7xl mx-auto px-6 py-3 flex justify-between items-center">
            {/* Left - Player Stats */}
            <div className="flex items-center space-x-4">
              {/* Leaderboard Position */}
              <button 
                onClick={() => setShowLeaderboardPopup(true)}
                className="bg-slate-800/90 hover:bg-slate-700/90 rounded-2xl px-4 py-2 border border-slate-600/50 transition-all duration-200 flex items-center space-x-3"
              >
                <div className="w-8 h-8 bg-blue-500/20 rounded-lg flex items-center justify-center">
                  <span className="text-blue-400 text-sm font-bold">🏆</span>
                </div>
                <div className="text-left">
                  <p className="text-xs text-slate-400 font-medium">Leaderboard place:</p>
                  <p className="text-white font-bold text-sm" style={{ fontFamily: '"Fredoka One", "Nunito", "Comic Sans MS", cursive' }}>
                    {getUserPosition()}
                  </p>
                </div>
              </button>

              {/* Player Info */}
              <div className="bg-slate-800/90 rounded-2xl px-4 py-2 border border-slate-600/50 flex items-center space-x-3">
                <div className="w-8 h-8 bg-green-500/20 rounded-lg flex items-center justify-center">
                  <span className="text-green-400 text-sm">👤</span>
                </div>
                <div className="text-left">
                  <p className="text-xs text-slate-400 font-medium">Player:</p>
                  <p className="text-white font-bold text-sm" style={{ fontFamily: '"Fredoka One", "Nunito", "Comic Sans MS", cursive' }}>
                    {formatAddress(address)}
                  </p>
                </div>
              </div>
            </div>

            {/* Right - Game Stats & Actions */}
            <div className="flex items-center space-x-4">
              {/* Coins */}
              <div className="bg-slate-800/90 rounded-2xl px-4 py-2 border border-slate-600/50 flex items-center space-x-2">
                <div className="w-6 h-6 bg-yellow-500/20 rounded-lg flex items-center justify-center">
                  <span className="text-yellow-400 text-xs">💰</span>
                </div>
                <span className="text-yellow-400 font-bold text-sm" style={{ fontFamily: '"Fredoka One", "Nunito", "Comic Sans MS", cursive' }}>127</span>
              </div>

              {/* Best Score */}
              <div className="bg-slate-800/90 rounded-2xl px-4 py-2 border border-slate-600/50 flex items-center space-x-2">
                <div className="w-6 h-6 bg-green-500/20 rounded-lg flex items-center justify-center">
                  <span className="text-green-400 text-xs">⭐</span>
                </div>
                <span className="text-green-400 font-bold text-sm" style={{ fontFamily: '"Fredoka One", "Nunito", "Comic Sans MS", cursive' }}>2,500</span>
              </div>

              {/* Disconnect */}
              <button 
                onClick={() => window.location.reload()}
                className="bg-slate-800/90 hover:bg-slate-700/90 rounded-2xl px-4 py-2 border border-slate-600/50 transition-all duration-200 flex items-center space-x-2"
              >
                <div className="w-6 h-6 bg-red-500/20 rounded-lg flex items-center justify-center">
                  <span className="text-red-400 text-xs">🚪</span>
                </div>
                <span className="text-slate-300 font-bold text-sm" style={{ fontFamily: '"Fredoka One", "Nunito", "Comic Sans MS", cursive' }}>Disconnect</span>
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="relative z-10" style={{ height: gameSession ? 'calc(100vh - 64px)' : '100vh' }}>
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
          <div className="w-full h-full relative">
            {/* Game Container - fills entire viewport */}
            <div 
              id="game-container" 
              className="w-full h-full"
            >
              <iframe
                src={`https://coco-and-bridge.marketjs-cloud2.com/en/coco-and-bridge-penguin-hop/1756889184732/index.html?tournament_id=${gameSession.tournament_id}&user_id=${gameSession.user_id}&game_id=${gameSession.game_id}`}
                className="w-full h-full border-0"
                title="Penguin Hop Game"
              />
            </div>

            {/* Floating Ice-themed UI Elements */}
            {/* Top Left - Leaderboard Position */}
            <button 
              onClick={() => setShowLeaderboardPopup(true)}
              className="absolute top-4 left-4 bg-slate-800/90 backdrop-blur-lg rounded-2xl px-4 py-3 border border-slate-600/50 shadow-xl transition-all duration-200 hover:bg-slate-700/90 z-30"
            >
              <div className="flex items-center space-x-2">
                <span className="text-blue-400 text-lg">🏆</span>
                <div className="text-left">
                  <p className="text-xs text-slate-300 font-medium">Rank</p>
                  <p className="text-white font-bold text-sm" style={{ fontFamily: '"Fredoka One", "Nunito", "Comic Sans MS", cursive' }}>
                    {getUserPosition()}
                  </p>
                </div>
              </div>
            </button>

            {/* Top Right - Player & Stats */}
            <div className="absolute top-4 right-4 flex items-center space-x-3 z-30">
              {/* Player Info */}
              <div className="bg-slate-800/90 backdrop-blur-lg rounded-2xl px-4 py-3 border border-slate-600/50 shadow-xl">
                <div className="flex items-center space-x-2">
                  <span className="text-green-400 text-sm">👤</span>
                  <span className="text-white font-bold text-sm" style={{ fontFamily: '"Fredoka One", "Nunito", "Comic Sans MS", cursive' }}>
                    {formatAddress(address)}
                  </span>
                </div>
              </div>

              {/* Coins */}
              <div className="bg-slate-800/90 backdrop-blur-lg rounded-2xl px-4 py-3 border border-slate-600/50 shadow-xl">
                <div className="flex items-center space-x-2">
                  <span className="text-yellow-400 text-sm">💰</span>
                  <span className="text-white font-bold text-sm" style={{ fontFamily: '"Fredoka One", "Nunito", "Comic Sans MS", cursive' }}>127</span>
                </div>
              </div>

              {/* Best Score */}
              <div className="bg-slate-800/90 backdrop-blur-lg rounded-2xl px-4 py-3 border border-slate-600/50 shadow-xl">
                <div className="flex items-center space-x-2">
                  <span className="text-green-400 text-sm">⭐</span>
                  <span className="text-white font-bold text-sm" style={{ fontFamily: '"Fredoka One", "Nunito", "Comic Sans MS", cursive' }}>2,500</span>
                </div>
              </div>

              {/* Disconnect */}
              <button 
                onClick={() => window.location.reload()}
                className="bg-slate-800/90 backdrop-blur-lg rounded-2xl px-3 py-3 border border-slate-600/50 shadow-xl transition-all duration-200 hover:bg-red-500/20"
              >
                <span className="text-red-400 text-sm">🚪</span>
              </button>
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
