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
      alert(`Verification failed: ${error.message}`)
    }
  }

  const exitGame = () => {
    setGameSession(null)
    if (wsRef.current) {
      wsRef.current.close()
    }
  }

  const formatAddress = (addr) => {
    if (!addr) return ''
    return `${addr.substring(0, 6)}...${addr.substring(38)}`
  }

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString()
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="max-w-7xl mx-auto p-8">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-4">Penguin Hop Challenge</h1>
          <p className="text-gray-400">Abstract Global Wallet Integration</p>
        </div>
        
        {!isConnected ? (
          <div className="text-center">
            <button 
              onClick={handleLogin}
              disabled={isLoading}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-bold py-3 px-6 rounded-lg transition-colors"
            >
              {isLoading ? 'Connecting...' : 'Sign in with Abstract'}
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="bg-gray-800 rounded-lg p-4 text-center">
              <p className="text-green-400 mb-2">Connected to Abstract Global Wallet</p>
              <p className="text-sm text-gray-300">
                {formatAddress(address)}
              </p>
            </div>
            
            {!gameSession ? (
              <div className="text-center space-y-4">
                <button 
                  onClick={verifyNFT}
                  className="bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-lg mr-4"
                >
                  Verify NFT & Access Game
                </button>
                
                <button 
                  onClick={() => setShowLeaderboard(!showLeaderboard)}
                  className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-6 rounded-lg mr-4"
                >
                  {showLeaderboard ? 'Hide' : 'Show'} Leaderboard
                </button>
                
                <button 
                  onClick={handleLogout}
                  className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded"
                >
                  Disconnect
                </button>
              </div>
            ) : (
              <div className="flex gap-6">
                {/* Game Area */}
                <div className="flex-1">
                  <div className="bg-gray-800 rounded-lg p-6">
                    <div className="flex justify-between items-center mb-4">
                      <h2 className="text-2xl font-semibold text-green-400">Game Access Granted!</h2>
                      <button 
                        onClick={exitGame}
                        className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded"
                      >
                        Exit Game
                      </button>
                    </div>
                    <div className="bg-black rounded-lg p-4 min-h-[600px] flex items-center justify-center">
                      <iframe 
                        src={`https://coco-and-bridge.marketjs-cloud2.com/en/coco-and-bridge-penguin-hop/1756889184732/index.html?tournament_id=${gameSession.tournament_id}&game_id=${gameSession.game_id}&user_id=${gameSession.user_id}&user_name=${gameSession.user_name}`}
                        width="800" 
                        height="600"
                        frameBorder="0"
                        title="Penguin Hop Game"
                        className="rounded"
                      />
                    </div>
                  </div>
                </div>
                
                {/* Live Leaderboard */}
                <div className="w-80">
                  <div className="bg-gray-800 rounded-lg p-6 h-full">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-xl font-semibold text-purple-400">Live Leaderboard</h3>
                      <div className="flex items-center space-x-2">
                        <div className={`w-2 h-2 rounded-full ${isConnectedToWS ? 'bg-green-400' : 'bg-yellow-400'}`}></div>
                        <span className="text-xs text-gray-400">
                          {isConnectedToWS ? 'Live' : 'Polling'}
                        </span>
                      </div>
                    </div>
                    
                    {leaderboard.length > 0 ? (
                      <div className="space-y-2 max-h-[500px] overflow-y-auto">
                        {leaderboard.map((entry, index) => (
                          <div 
                            key={entry.id} 
                            className={`p-3 rounded border ${
                              entry.user_id === address 
                                ? 'border-blue-400 bg-blue-900/20' 
                                : 'border-gray-600 bg-gray-700'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-2">
                                <span className="text-lg font-bold">
                                  {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `#${index + 1}`}
                                </span>
                                <div>
                                  <p className="text-sm font-medium">
                                    {entry.user_id === address ? 'You' : formatAddress(entry.user_id)}
                                  </p>
                                  <p className="text-xs text-gray-400">{formatDate(entry.created_at)}</p>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="font-bold text-green-400">{entry.best_score}</p>
                                <p className="text-xs text-gray-400">{entry.time}s</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-gray-400 text-center">No scores yet. Be the first to play!</p>
                    )}
                  </div>
                </div>
              </div>
            )}
            
            {/* Leaderboard Section (when not in game) */}
            {showLeaderboard && !gameSession && (
              <div className="bg-gray-800 rounded-lg p-6">
                <h3 className="text-xl font-semibold mb-4 text-purple-400">Leaderboard</h3>
                {leaderboard.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-600">
                          <th className="text-left py-2">Rank</th>
                          <th className="text-left py-2">Player</th>
                          <th className="text-left py-2">Score</th>
                          <th className="text-left py-2">Time</th>
                          <th className="text-left py-2">Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {leaderboard.map((entry, index) => (
                          <tr 
                            key={entry.id} 
                            className={`border-b border-gray-700 ${
                              entry.user_id === address ? 'bg-blue-900/20' : ''
                            }`}
                          >
                            <td className="py-2">
                              {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : index + 1}
                            </td>
                            <td className="py-2">
                              {entry.user_id === address ? 'You' : formatAddress(entry.user_id)}
                            </td>
                            <td className="py-2 font-bold text-green-400">{entry.best_score}</td>
                            <td className="py-2">{entry.time}s</td>
                            <td className="py-2 text-gray-400">{formatDate(entry.created_at)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-gray-400 text-center">No scores yet. Be the first to play!</p>
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
