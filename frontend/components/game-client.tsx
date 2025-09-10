"use client"

import { AbstractWalletProvider, useLoginWithAbstract } from "@abstract-foundation/agw-react"
import { useAccount } from "wagmi"
import { abstractTestnet } from "viem/chains"
import { useState, useEffect, useRef } from "react"

// Environment variable for API URL - uses Vercel env var or falls back to localhost
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:3001'

function LoginButton() {
  const { login, logout } = useLoginWithAbstract()
  const { address, isConnected } = useAccount()
  const [isLoading, setIsLoading] = useState(false)
  const [gameSession, setGameSession] = useState<any>(null)
  const [leaderboard, setLeaderboard] = useState<any[]>([])
  const [showLeaderboard, setShowLeaderboard] = useState(false)
  const [isConnectedToWS, setIsConnectedToWS] = useState(false)
  const wsRef = useRef<WebSocket | null>(null)

  useEffect(() => {
    console.log('Account state changed:', { address, isConnected })
  }, [address, isConnected])

  useEffect(() => {
    // Fetch leaderboard on component mount
    fetchLeaderboard()
    
    // Set up interval to refresh leaderboard every 30 seconds (fallback)
    const interval = setInterval(fetchLeaderboard, 30000)
    
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    // Set up WebSocket connection when component mounts
    if (gameSession) {
      connectWebSocket()
    }
    
    return () => {
      if (wsRef.current) {
        wsRef.current.close()
      }
    }
  }, [gameSession])

  const connectWebSocket = () => {
    try {
      // Convert HTTP URL to WebSocket URL
      const wsUrl = API_BASE_URL.replace('https://', 'wss://').replace('http://', 'ws://')
      
      const ws = new WebSocket(wsUrl)
      wsRef.current = ws

      ws.onopen = () => {
        console.log('WebSocket connected')
        setIsConnectedToWS(true)
      }

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          if (data.type === 'leaderboard_update') {
            setLeaderboard(data.leaderboard)
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error)
        }
      }

      ws.onclose = () => {
        console.log('WebSocket disconnected')
        setIsConnectedToWS(false)
        // Attempt to reconnect after 5 seconds
        setTimeout(connectWebSocket, 5000)
      }

      ws.onerror = (error) => {
        console.error('WebSocket error:', error)
        setIsConnectedToWS(false)
      }
    } catch (error) {
      console.error('Failed to connect WebSocket:', error)
      setIsConnectedToWS(false)
    }
  }

  const fetchLeaderboard = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/leaderboard`)
      const data = await response.json()
      if (data.status === 200) {
        setLeaderboard(data.leaderboard)
      }
    } catch (error) {
      console.error('Error fetching leaderboard:', error)
    }
  }

  const handleLogin = async () => {
    setIsLoading(true)
    try {
      console.log('Starting AGW login...')
      const loginResult = await login()
      console.log('Login completed:', loginResult)
    } catch (error) {
      console.error('Login error:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleLogout = async () => {
    try {
      await logout()
      setGameSession(null)
      if (wsRef.current) {
        wsRef.current.close()
      }
    } catch (error) {
      console.error('Logout error:', error)
    }
  }

  const verifyNFT = async () => {
    if (!address) return
    
    console.log('Attempting to verify NFT for:', address)
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/verify-nft`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress: address })
      })
      
      console.log('Response status:', response.status)
      
      const data = await response.json()
      console.log('Response data:', data)
      
      if (data.status === 200) {
        setGameSession(data)
        alert(`NFT verified! Game session created: ${data.tournament_id}`)
      } else {
        alert(data.message || 'NFT verification failed')
      }
    } catch (error) {
      console.error('NFT verification failed:', error)
      alert(`Verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  const exitGame = () => {
    setGameSession(null)
    if (wsRef.current) {
      wsRef.current.close()
    }
  }

  const formatAddress = (addr: string) => {
    if (!addr) return ''
    return `${addr.substring(0, 6)}...${addr.substring(38)}`
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString()
  }

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Background Image */}
      <div 
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: 'url(/background.png)'
        }}
      >
        {/* Optional overlay for better text readability */}
        <div className="absolute inset-0 bg-black/10"></div>
        
        {/* Floating snowflakes */}
        <div className="absolute inset-0">
          {[...Array(50)].map((_, i) => (
            <div
              key={i}
              className="absolute w-2 h-2 bg-white rounded-full opacity-80 animate-pulse"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 3}s`,
                animationDuration: `${2 + Math.random() * 3}s`
              }}
            ></div>
          ))}
        </div>
      </div>

      <div className="relative z-10 max-w-7xl mx-auto p-8">
        <div className="text-center mb-8">
          <h1 className="text-6xl font-bold mb-4 text-white drop-shadow-lg" 
              style={{ 
                textShadow: '4px 4px 8px rgba(0,0,255,0.6)',
                fontFamily: 'Comic Sans MS, cursive'
              }}>
            🐧 PENGUIN HOP CHALLENGE 🐧
          </h1>
          <p className="text-xl text-blue-900 font-bold drop-shadow-md">
            Adventure awaits in the snowy wonderland!
          </p>
        </div>
        
        {!isConnected ? (
          <div className="text-center">
            <div className="bg-white/90 backdrop-blur-sm rounded-3xl p-8 shadow-2xl border-4 border-blue-400 max-w-md mx-auto">
              <div className="text-6xl mb-4">❄️</div>
              <button 
                onClick={handleLogin}
                disabled={isLoading}
                className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 disabled:from-gray-400 disabled:to-gray-500 text-white font-bold py-4 px-8 rounded-full text-lg shadow-lg transform hover:scale-105 transition-all duration-200 border-2 border-white"
                style={{ fontFamily: 'Comic Sans MS, cursive' }}
              >
                {isLoading ? '🌨️ Connecting...' : '🎮 Start Your Winter Adventure!'}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="bg-white/95 backdrop-blur-sm rounded-3xl p-6 text-center shadow-xl border-4 border-green-400">
              <div className="text-4xl mb-2">🎯</div>
              <p className="text-green-600 mb-2 font-bold text-lg">Connected to Winter Wallet!</p>
              <p className="text-sm text-gray-700 font-mono bg-gray-100 rounded-full px-4 py-2 inline-block">
                {formatAddress(address || '')}
              </p>
            </div>
            
            {!gameSession ? (
              <div className="text-center space-y-4">
                <div className="flex flex-wrap justify-center gap-4">
                  <button 
                    onClick={verifyNFT}
                    className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-bold py-4 px-8 rounded-full text-lg shadow-lg transform hover:scale-105 transition-all duration-200 border-2 border-white"
                    style={{ fontFamily: 'Comic Sans MS, cursive' }}
                  >
                    🎫 Verify Pass & Play!
                  </button>
                  
                  <button 
                    onClick={() => setShowLeaderboard(!showLeaderboard)}
                    className="bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 text-white font-bold py-4 px-8 rounded-full text-lg shadow-lg transform hover:scale-105 transition-all duration-200 border-2 border-white"
                    style={{ fontFamily: 'Comic Sans MS, cursive' }}
                  >
                    {showLeaderboard ? '🙈 Hide' : '🏆 Show'} Champions
                  </button>
                  
                  <button 
                    onClick={handleLogout}
                    className="bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white font-bold py-3 px-6 rounded-full shadow-lg transform hover:scale-105 transition-all duration-200 border-2 border-white"
                    style={{ fontFamily: 'Comic Sans MS, cursive' }}
                  >
                    ❄️ Exit Winter
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex gap-6">
                {/* Game Area */}
                <div className="flex-1">
                  <div className="bg-white/95 backdrop-blur-sm rounded-3xl p-6 shadow-xl border-4 border-blue-400">
                    <div className="flex justify-between items-center mb-4">
                      <div>
                        <h2 className="text-3xl font-bold text-green-600" style={{ fontFamily: 'Comic Sans MS, cursive' }}>
                          🎮 Game Time!
                        </h2>
                        <p className="text-gray-600">Your winter adventure begins now!</p>
                      </div>
                      <button 
                        onClick={exitGame}
                        className="bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white font-bold py-2 px-4 rounded-full shadow-lg transform hover:scale-105 transition-all duration-200"
                        style={{ fontFamily: 'Comic Sans MS, cursive' }}
                      >
                        🚪 Exit Game
                      </button>
                    </div>
                    <div className="bg-gradient-to-b from-sky-100 to-blue-200 rounded-2xl p-4 min-h-[600px] flex items-center justify-center border-4 border-blue-300">
                      <iframe 
                        src={`https://coco-and-bridge.marketjs-cloud2.com/en/coco-and-bridge-penguin-hop/1756889184732/index.html?tournament_id=${gameSession.tournament_id}&game_id=${gameSession.game_id}&user_id=${gameSession.user_id}&user_name=${gameSession.user_name}`}
                        width="800" 
                        height="600"
                        frameBorder="0"
                        title="Penguin Hop Game"
                        className="rounded-xl shadow-lg"
                      />
                    </div>
                  </div>
                </div>
                
                {/* Live Leaderboard */}
                <div className="w-80">
                  <div className="bg-white/95 backdrop-blur-sm rounded-3xl p-6 h-full shadow-xl border-4 border-purple-400">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-2xl font-bold text-purple-600" style={{ fontFamily: 'Comic Sans MS, cursive' }}>
                        🏆 Live Champions
                      </h3>
                      <div className="flex items-center space-x-2">
                        <div className={`w-3 h-3 rounded-full ${isConnectedToWS ? 'bg-green-400' : 'bg-yellow-400'} animate-pulse`}></div>
                        <span className="text-xs text-gray-600 font-bold">
                          {isConnectedToWS ? '⚡ Live' : '🔄 Updating'}
                        </span>
                      </div>
                    </div>
                    
                    {leaderboard.length > 0 ? (
                      <div className="space-y-3 max-h-[500px] overflow-y-auto">
                        {leaderboard.map((entry, index) => (
                          <div 
                            key={entry.id} 
                            className={`p-4 rounded-2xl border-2 shadow-md ${
                              entry.user_id === (address || '') 
                                ? 'border-yellow-400 bg-gradient-to-r from-yellow-100 to-yellow-200' 
                                : 'border-blue-300 bg-gradient-to-r from-blue-50 to-blue-100'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-3">
                                <span className="text-2xl font-bold">
                                  {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `❄️${index + 1}`}
                                </span>
                                <div>
                                  <p className="text-sm font-bold text-gray-800">
                                    {entry.user_id === (address || '') ? '🎭 You' : `🐧 ${formatAddress(entry.user_id)}`}
                                  </p>
                                  <p className="text-xs text-gray-600">{formatDate(entry.created_at)}</p>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="font-bold text-lg text-green-600">{entry.best_score}</p>
                                <p className="text-xs text-gray-500">⏱️ {entry.time}s</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8">
                        <div className="text-6xl mb-4">🌨️</div>
                        <p className="text-gray-500 font-bold">No champions yet!</p>
                        <p className="text-gray-400 text-sm">Be the first to conquer the winter!</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
            
            {/* Leaderboard Section (when not in game) */}
            {showLeaderboard && !gameSession && (
              <div className="bg-white/95 backdrop-blur-sm rounded-3xl p-6 shadow-xl border-4 border-purple-400">
                <h3 className="text-3xl font-bold mb-6 text-purple-600 text-center" style={{ fontFamily: 'Comic Sans MS, cursive' }}>
                  🏆 Hall of Champions 🏆
                </h3>
                {leaderboard.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b-2 border-purple-300">
                          <th className="text-left py-3 font-bold text-purple-700">🏅 Rank</th>
                          <th className="text-left py-3 font-bold text-purple-700">🐧 Player</th>
                          <th className="text-left py-3 font-bold text-purple-700">⭐ Score</th>
                          <th className="text-left py-3 font-bold text-purple-700">⏱️ Time</th>
                          <th className="text-left py-3 font-bold text-purple-700">📅 Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {leaderboard.map((entry, index) => (
                          <tr 
                            key={entry.id} 
                            className={`border-b border-purple-200 hover:bg-purple-50 ${
                              entry.user_id === (address || '') ? 'bg-yellow-100' : ''
                            }`}
                          >
                            <td className="py-3">
                              <span className="text-lg">
                                {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}️⃣`}
                              </span>
                            </td>
                            <td className="py-3 font-bold">
                              {entry.user_id === (address || '') ? '🎭 You' : `🐧 ${formatAddress(entry.user_id)}`}
                            </td>
                            <td className="py-3 font-bold text-green-600">{entry.best_score}</td>
                            <td className="py-3">{entry.time}s</td>
                            <td className="py-3 text-gray-600">{formatDate(entry.created_at)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <div className="text-8xl mb-4">🌨️</div>
                    <p className="text-gray-500 font-bold text-xl">The leaderboard is as empty as a fresh snowfield!</p>
                    <p className="text-gray-400">Be the first brave penguin to make your mark!</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default function GameClient() {
  return (
    <AbstractWalletProvider chain={abstractTestnet}>
      <LoginButton />
    </AbstractWalletProvider>
  )
}
