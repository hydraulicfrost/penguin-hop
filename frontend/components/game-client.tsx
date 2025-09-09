"use client"

import { AbstractWalletProvider, useLoginWithAbstract } from "@abstract-foundation/agw-react"
import { useAccount } from "wagmi"
import { abstractTestnet } from "viem/chains"
import { useState, useEffect, useRef } from "react"

function LoginButton() {
  const { login, logout } = useLoginWithAbstract()
  const { address, isConnected } = useAccount()
  const [isLoading, setIsLoading] = useState(false)
  const [gameSession, setGameSession] = useState(null)
  const [leaderboard, setLeaderboard] = useState([])
  const [showLeaderboard, setShowLeaderboard] = useState(false)
  const [isConnectedToWS, setIsConnectedToWS] = useState(false)
  const wsRef = useRef(null)

  useEffect(() => {
    console.log('Account state changed:', { address, isConnected })
  }, [address, isConnected])

  // WebSocket connection
  useEffect(() => {
    if (gameSession) {
      // Connect to WebSocket when game starts
      connectWebSocket()
    } else {
      // Disconnect WebSocket when game ends
      disconnectWebSocket()
    }

    return () => {
      disconnectWebSocket()
    }
  }, [gameSession])

  const connectWebSocket = () => {
    try {
      const ws = new WebSocket('ws://127.0.0.1:3001')
      
      ws.onopen = () => {
        console.log('Connected to WebSocket')
        setIsConnectedToWS(true)
      }

      ws.onmessage = (event) => {
        const message = JSON.parse(event.data)
        if (message.type === 'leaderboard_update') {
          console.log('Received leaderboard update:', message.data)
          setLeaderboard(message.data)
        }
      }

      ws.onclose = () => {
        console.log('WebSocket connection closed')
        setIsConnectedToWS(false)
      }

      ws.onerror = (error) => {
        console.error('WebSocket error:', error)
        setIsConnectedToWS(false)
      }

      wsRef.current = ws
    } catch (error) {
      console.error('Failed to connect to WebSocket:', error)
    }
  }

  const disconnectWebSocket = () => {
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
      setIsConnectedToWS(false)
    }
  }

  // Fallback: fetch leaderboard via HTTP
  const fetchLeaderboard = async () => {
    try {
      const response = await fetch('http://127.0.0.1:3001/api/leaderboard')
      if (response.ok) {
        const data = await response.json()
        setLeaderboard(data)
      }
    } catch (error) {
      console.error('Failed to fetch leaderboard:', error)
    }
  }

  useEffect(() => {
    // Initial leaderboard fetch
    fetchLeaderboard()
    
    // Fallback polling if WebSocket fails
    const interval = setInterval(() => {
      if (!isConnectedToWS) {
        fetchLeaderboard()
      }
    }, 10000)
    
    return () => clearInterval(interval)
  }, [isConnectedToWS])

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
    } catch (error) {
      console.error('Logout error:', error)
    }
  }

  const verifyNFT = async () => {
    if (!address) return
    
    console.log('Attempting to verify NFT for:', address)
    
    try {
      const response = await fetch('http://127.0.0.1:3001/api/verify-nft', {
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

  const LiveLeaderboard = () => (
    <div className="bg-gray-800 rounded-lg p-4 h-full">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-purple-400">Live Leaderboard</h3>
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${isConnectedToWS ? 'bg-green-400' : 'bg-yellow-400'}`}></div>
          <span className="text-xs text-gray-400">
            {isConnectedToWS ? 'Live' : 'Polling'}
          </span>
        </div>
      </div>
      
      {leaderboard.length > 0 ? (
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {leaderboard.map((player, index) => (
            <div 
              key={player.user_id} 
              className={`flex items-center justify-between p-2 rounded ${
                player.user_id === address ? 'bg-blue-900/50 ring-1 ring-blue-500' : 'bg-gray-700/50'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold w-6">
                  {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `#${index + 1}`}
                </span>
                <span className="text-xs font-mono">
                  {player.user_id === address ? 'You' : `${player.user_id.substring(0, 6)}...`}
                </span>
              </div>
              <div className="text-right">
                <div className="text-sm font-bold text-green-400">
                  {player.max_score.toLocaleString()}
                </div>
                <div className="text-xs text-gray-400">
                  {new Date(player.last_played).toLocaleTimeString()}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-gray-400 text-center py-8 text-sm">
          No scores yet. Be the first to play!
        </p>
      )}
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-6">
          <h1 className="text-4xl font-bold mb-2">Penguin Hop Challenge</h1>
          <p className="text-gray-400">Abstract Global Wallet Gaming Platform</p>
        </div>
        
        {!isConnected ? (
          <div className="flex justify-center">
            <button 
              onClick={handleLogin}
              disabled={isLoading}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-bold py-3 px-6 rounded-lg"
            >
              {isLoading ? 'Connecting...' : 'Sign in with Abstract'}
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="bg-gray-800 rounded-lg p-4 text-center">
              <p className="text-green-400 mb-2">Connected to Abstract Global Wallet</p>
              <p className="text-sm text-gray-300">
                {address?.substring(0, 6)}...{address?.substring(38)}
              </p>
            </div>
            
            {!gameSession ? (
              <div className="space-y-4 text-center">
                <button 
                  onClick={verifyNFT}
                  className="bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-lg mr-4"
                >
                  Verify NFT & Access Game
                </button>
                
                <button 
                  onClick={() => setShowLeaderboard(!showLeaderboard)}
                  className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-6 rounded-lg"
                >
                  {showLeaderboard ? 'Hide Leaderboard' : 'Show Leaderboard'}
                </button>
                
                {showLeaderboard && (
                  <div className="max-w-md mx-auto">
                    <LiveLeaderboard />
                  </div>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 h-[600px]">
                {/* Game Area */}
                <div className="lg:col-span-3 bg-gray-800 rounded-lg p-4">
                  <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-semibold text-green-400">Game Active</h2>
                    <button 
                      onClick={() => setGameSession(null)}
                      className="bg-yellow-600 hover:bg-yellow-700 text-white font-bold py-1 px-3 rounded text-sm"
                    >
                      Exit Game
                    </button>
                  </div>
                  <div className="bg-black rounded-lg flex justify-center items-center h-full">
                    <iframe 
                      src={`https://coco-and-bridge.marketjs-cloud2.com/en/coco-and-bridge-penguin-hop/1756889184732/index.html?tournament_id=${gameSession.tournament_id}&game_id=${gameSession.game_id}&user_id=${gameSession.user_id}&user_name=${gameSession.user_name}`}
                      width="100%" 
                      height="100%"
                      frameBorder="0"
                      title="Penguin Hop Game"
                      className="rounded"
                    />
                  </div>
                </div>
                
                {/* Live Leaderboard Sidebar */}
                <div className="lg:col-span-1">
                  <LiveLeaderboard />
                </div>
              </div>
            )}
            
            <div className="text-center">
              <button 
                onClick={handleLogout}
                className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded"
              >
                Disconnect Wallet
              </button>
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