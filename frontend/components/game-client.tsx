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
          backgroundImage: `url('/background.png')`,
          minHeight: '100vh'
        }}
      >
        {/* Optional overlay for better text readability */}
        <div className="absolute inset-0 bg-black/10"></div>
        
        {/* Floating snowflakes */}
        <div className="absolute inset-0">
          {[...Array(30)].map((_, i) => (
            <div
              key={i}
              className="absolute w-2 h-2 bg-white rounded-full opacity-60 animate-pulse"
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

      {/* Top Banner */}
      <div className="relative z-20 bg-black/20 backdrop-blur-sm border-b border-white/20">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          {/* Left - Twitter Link */}
          <a 
            href="https://twitter.com" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-white hover:text-blue-300 transition-colors text-xl"
          >
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
              <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z"/>
            </svg>
          </a>

          {/* Right - User Info */}
          <div className="flex items-center space-x-4">
            {isConnected ? (
              <>
                {/* Wallet Address */}
                <div className="text-white text-sm font-mono bg-white/10 px-3 py-1 rounded-full">
                  {formatAddress(address || '')}
                </div>
                
                {/* In-game Coins - Placeholder for now */}
                <div className="text-white text-sm bg-yellow-500/20 px-3 py-1 rounded-full border border-yellow-400/30">
                  <span className="text-yellow-300">Coins: 127</span>
                </div>
                
                {/* High Score */}
                <div className="text-white text-sm bg-green-500/20 px-3 py-1 rounded-full border border-green-400/30">
                  <span className="text-green-300">Best: 2,500</span>
                </div>
                
                {/* Logout Button */}
                <button 
                  onClick={handleLogout}
                  className="bg-red-500/20 hover:bg-red-500/30 text-white text-sm px-3 py-1 rounded-full border border-red-400/30 transition-all"
                >
                  Disconnect
                </button>
              </>
            ) : (
              <button 
                onClick={handleLogin}
                disabled={isLoading}
                className="bg-blue-500/20 hover:bg-blue-500/30 disabled:bg-gray-500/20 text-white px-4 py-2 rounded-full border border-blue-400/30 transition-all"
              >
                {isLoading ? 'Connecting...' : 'Connect Wallet'}
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="relative z-10 h-[calc(100vh-80px)]">
        {!isConnected ? (
          <div className="flex items-center justify-center h-full">
            <div className="bg-white/90 backdrop-blur-sm rounded-3xl p-8 shadow-2xl border-4 border-blue-400 max-w-md mx-auto text-center">
              <div className="text-6xl mb-4">❄️</div>
              <h2 className="text-2xl font-bold text-gray-800 mb-4">Welcome to Penguin Hop</h2>
              <p className="text-gray-600 mb-6">Connect your wallet to start playing!</p>
              <button 
                onClick={handleLogin}
                disabled={isLoading}
                className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 disabled:from-gray-400 disabled:to-gray-500 text-white font-bold py-4 px-8 rounded-full text-lg shadow-lg transform hover:scale-105 transition-all duration-200 border-2 border-white"
              >
                {isLoading ? 'Connecting...' : 'Connect Wallet'}
              </button>
            </div>
          </div>
        ) : !gameSession ? (
          <div className="flex items-center justify-center h-full">
            <div className="bg-white/90 backdrop-blur-sm rounded-3xl p-8 shadow-2xl border-4 border-green-400 max-w-md mx-auto text-center">
              <div className="text-6xl mb-4">🎫</div>
              <h2 className="text-2xl font-bold text-gray-800 mb-4">Ready to Play?</h2>
              <p className="text-gray-600 mb-6">Verify your NFT ownership to access the game!</p>
              
              <div className="space-y-4">
                <button 
                  onClick={verifyNFT}
                  className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-bold py-4 px-8 rounded-full text-lg shadow-lg transform hover:scale-105 transition-all duration-200 border-2 border-white"
                >
                  Verify NFT & Play
                </button>
                
                <button 
                  onClick={() => setShowLeaderboard(!showLeaderboard)}
                  className="w-full bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 text-white font-bold py-3 px-6 rounded-full shadow-lg transform hover:scale-105 transition-all duration-200 border-2 border-white"
                >
                  {showLeaderboard ? 'Hide' : 'View'} Leaderboard
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="h-full relative">
            {/* Fullscreen Game Container */}
            <div 
              id="game-container" 
              className="w-full h-full bg-black overflow-hidden"
            >
              {/* Game iframe takes full container */}
              <div className="w-full h-full">
                <iframe 
                  src={`https://coco-and-bridge.marketjs-cloud2.com/en/coco-and-bridge-penguin-hop/1756889184732/index.html?tournament_id=${gameSession.tournament_id}&game_id=${gameSession.game_id}&user_id=${gameSession.user_id}&user_name=${gameSession.user_name}`}
                  className="w-full h-full border-0"
                  title="Penguin Hop Game"
                  allowFullScreen
                />
              </div>
              
              {/* Exit instruction overlay */}
              <div className="absolute top-4 left-4 bg-black/50 text-white px-3 py-2 rounded-lg text-sm">
                Press ESC to exit fullscreen
              </div>
            </div>

            {/* Hover-out Ice Leaderboard */}
            <div className="fixed top-0 right-0 h-full z-50 group">
              {/* Hover trigger area */}
              <div className="w-4 h-full bg-transparent"></div>
              
              {/* Leaderboard panel */}
              <div className="absolute top-0 right-0 h-full w-80 transform translate-x-full group-hover:translate-x-0 transition-transform duration-300 ease-out">
                {/* Ice-like translucent background */}
                <div className="h-full bg-gradient-to-l from-blue-100/30 via-cyan-100/20 to-transparent backdrop-blur-md border-l border-blue-200/30 shadow-2xl">
                  {/* Frosted glass overlay */}
                  <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-blue-50/5 to-cyan-50/10"></div>
                  
                  {/* Content */}
                  <div className="relative h-full p-4 overflow-hidden">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-bold text-white drop-shadow-lg">Live Leaderboard</h3>
                      <div className="flex items-center space-x-2">
                        <div className={`w-2 h-2 rounded-full ${isConnectedToWS ? 'bg-green-400' : 'bg-yellow-400'} animate-pulse drop-shadow-sm`}></div>
                        <span className="text-xs text-white/80 drop-shadow-sm">
                          {isConnectedToWS ? 'Live' : 'Updating'}
                        </span>
                      </div>
                    </div>
                    
                    <div className="space-y-2 overflow-y-auto h-[calc(100%-60px)] pr-2">
                      {leaderboard.length > 0 ? (
                        leaderboard.map((entry, index) => (
                          <div 
                            key={entry.id} 
                            className={`p-3 rounded-xl border backdrop-blur-sm ${
                              entry.user_id === (address || '') 
                                ? 'border-yellow-400/60 bg-yellow-500/20 shadow-lg' 
                                : 'border-white/30 bg-white/10 shadow-md'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-2">
                                <span className="text-lg font-bold text-white drop-shadow-md">
                                  {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `#${index + 1}`}
                                </span>
                                <div>
                                  <p className="text-sm font-bold text-white drop-shadow-sm">
                                    {entry.user_id === (address || '') ? 'You' : formatAddress(entry.user_id)}
                                  </p>
                                  <p className="text-xs text-white/70 drop-shadow-sm">{formatDate(entry.created_at)}</p>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="font-bold text-green-300 drop-shadow-sm">{entry.best_score}</p>
                                <p className="text-xs text-white/70 drop-shadow-sm">{entry.time}s</p>
                              </div>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="text-center py-8">
                          <div className="text-4xl mb-2">🌨️</div>
                          <p className="text-white/70 text-sm drop-shadow-sm">No scores yet!</p>
                        </div>
                      )}
                    </div>
                    
                    {/* Ice crystals decoration */}
                    <div className="absolute top-4 left-4 w-6 h-6 text-white/20">❄️</div>
                    <div className="absolute bottom-20 left-6 w-4 h-4 text-white/15">❄️</div>
                    <div className="absolute top-1/2 left-2 w-3 h-3 text-white/10">❄️</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* Leaderboard Section (when not in game) */}
        {showLeaderboard && !gameSession && (
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-6 z-30">
            <div className="bg-white/95 backdrop-blur-sm rounded-3xl p-6 shadow-xl border-4 border-purple-400 max-w-4xl w-full max-h-[80vh] overflow-hidden">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-3xl font-bold text-purple-600">Hall of Champions</h3>
                <button 
                  onClick={() => setShowLeaderboard(false)}
                  className="text-gray-500 hover:text-gray-700 text-xl"
                >
                  ✕
                </button>
              </div>
              
              {leaderboard.length > 0 ? (
                <div className="overflow-y-auto max-h-[60vh]">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b-2 border-purple-300">
                        <th className="text-left py-3 font-bold text-purple-700">Rank</th>
                        <th className="text-left py-3 font-bold text-purple-700">Player</th>
                        <th className="text-left py-3 font-bold text-purple-700">Score</th>
                        <th className="text-left py-3 font-bold text-purple-700">Time</th>
                        <th className="text-left py-3 font-bold text-purple-700">Date</th>
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
                            {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `#${index + 1}`}
                          </td>
                          <td className="py-3 font-bold">
                            {entry.user_id === (address || '') ? 'You' : formatAddress(entry.user_id)}
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
                  <p className="text-gray-500 font-bold text-xl">No champions yet!</p>
                  <p className="text-gray-400">Be the first to make your mark!</p>
                </div>
              )}
            </div>
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
