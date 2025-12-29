'use client'

// Username/password authentication system - v2.0
import { useState, useEffect, useRef } from 'react'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:3001'

interface User {
  id: number
  username: string
  wallet_address?: string
}

interface GameSession {
  tournament_id: string
  game_id: string
  user_id: number
  username: string
}

interface LeaderboardEntry {
  id: number
  user_id: number
  username: string
  best_score: number
}

export default function GameClient() {
  // Auth state
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  
  // Auth form state
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [authError, setAuthError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  
  // Game state
  const [gameSession, setGameSession] = useState<GameSession | null>(null)
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [showLeaderboard, setShowLeaderboard] = useState(false)
  
  const wsRef = useRef<WebSocket | null>(null)

  // Check for existing session on mount
  useEffect(() => {
    const savedToken = localStorage.getItem('penguin_token')
    const savedUser = localStorage.getItem('penguin_user')
    
    if (savedToken && savedUser) {
      setToken(savedToken)
      setUser(JSON.parse(savedUser))
    }
    setIsLoading(false)
  }, [])

  // Start game session when logged in
  useEffect(() => {
    if (user && token) {
      startGameSession()
      connectWebSocket()
      fetchLeaderboard()
    }
    
    return () => {
      if (wsRef.current) {
        wsRef.current.close()
      }
      
    }
  }, [user, token])

  const startGameSession = async () => {
    if (!token) return
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/start-game`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      })
      
      const data = await response.json()
      
      if (data.success) {
        setGameSession(data)
        console.log('Game session started:', data.tournament_id)
      } else {
        console.error('Failed to start game:', data.error)
      }
    } catch (error) {
      console.error('Error starting game session:', error)
    }
  }

  const connectWebSocket = () => {
    try {
      const wsUrl = API_BASE_URL.replace('https://', 'wss://').replace('http://', 'ws://')
      const ws = new WebSocket(wsUrl)
      wsRef.current = ws

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data)
        if (data.type === 'leaderboard_update') {
          setLeaderboard(data.leaderboard)
        }
      }
    } catch (error) {
      console.error('WebSocket error:', error)
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

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setAuthError('')
    setIsSubmitting(true)
    
    try {
      const endpoint = authMode === 'login' ? '/api/login' : '/api/register'
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      })
      
      const data = await response.json()
      
      if (data.success) {
        setUser(data.user)
        setToken(data.token)
        localStorage.setItem('penguin_token', data.token)
        localStorage.setItem('penguin_user', JSON.stringify(data.user))
        setUsername('')
        setPassword('')
      } else {
        setAuthError(data.error || 'Authentication failed')
      }
    } catch (error) {
      setAuthError('Network error - please try again')
    } finally {
      setIsSubmitting(false)
    }
  }

  const logout = () => {
    setUser(null)
    setToken(null)
    setGameSession(null)
    localStorage.removeItem('penguin_token')
    localStorage.removeItem('penguin_user')
    if (wsRef.current) {
      wsRef.current.close()
    }
  }

  const getUserStats = () => {
    if (!user) return { rank: null, highScore: null }
    const entry = leaderboard.find(e => e.user_id === user.id)
    if (!entry) return { rank: null, highScore: null }
    const rank = leaderboard.findIndex(e => e.user_id === user.id) + 1
    return { rank, highScore: entry.best_score }
  }

  const userStats = getUserStats()
  const top10 = leaderboard.slice(0, 10)

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-white text-xl">Loading...</div>
      </div>
    )
  }

  return (
    <>
      <link 
        href="https://fonts.googleapis.com/css2?family=Fredoka+One&family=Nunito:wght@400;600;700;800&display=swap" 
        rel="stylesheet" 
      />
      
      <div className="min-h-screen w-full relative overflow-hidden">
        {/* TV Background Container */}
        <div className="absolute inset-0 flex items-center justify-center">
          {/* Game iframe - behind the TV */}
          {gameSession && (
            <iframe
              src={`https://coco-and-bridge.marketjs-cloud2.com/en/coco-and-bridge-penguin-hop/1756889184732/index.html?tournament_id=${gameSession.tournament_id}&user_id=${gameSession.user_id}&game_id=${gameSession.game_id}`}
              title="Penguin Hop Game"
              style={{
                position: 'absolute',
                zIndex: 1,
                top: '33%',
                left: '15%',
                width: '70%',
                height: '44%',
                border: 'none',
                borderRadius: '15px',
              }}
            />
          )}
          
          {/* TV Frame */}
          <img 
            src="/tv-background.png"
            alt="TV"
            className="pointer-events-none"
            style={{ 
              position: 'relative', 
              zIndex: 2,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
            }}
          />

          {/* Top Right Panel */}
          <div className="absolute top-6 right-8 z-30 flex flex-col items-end gap-2">
            {!user ? (
              /* Login/Register Form */
              <div className="bg-slate-800/95 backdrop-blur-md rounded-2xl p-5 border border-slate-600/50 shadow-2xl w-72">
                <h2 
                  className="text-white text-xl font-bold mb-4 text-center"
                  style={{ fontFamily: '"Fredoka One", cursive' }}
                >
                  {authMode === 'login' ? 'Welcome Back!' : 'Join the Fun!'}
                </h2>
                
                <form onSubmit={handleAuth} className="space-y-3">
                  <input
                    type="text"
                    placeholder="Username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl bg-slate-700/50 border border-slate-600 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    style={{ fontFamily: '"Nunito", sans-serif' }}
                    required
                  />
                  <input
                    type="password"
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl bg-slate-700/50 border border-slate-600 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    style={{ fontFamily: '"Nunito", sans-serif' }}
                    required
                  />
                  
                  {authError && (
                    <p className="text-red-400 text-sm text-center">{authError}</p>
                  )}
                  
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white font-bold transition-all duration-200 transform hover:scale-105 disabled:opacity-50"
                    style={{ fontFamily: '"Fredoka One", cursive' }}
                  >
                    {isSubmitting ? '...' : (authMode === 'login' ? 'Play!' : 'Sign Up')}
                  </button>
                </form>
                
                <p className="text-slate-400 text-sm text-center mt-4" style={{ fontFamily: '"Nunito", sans-serif' }}>
                  {authMode === 'login' ? "Don't have an account? " : "Already have an account? "}
                  <button
                    onClick={() => {
                      setAuthMode(authMode === 'login' ? 'register' : 'login')
                      setAuthError('')
                    }}
                    className="text-cyan-400 hover:text-cyan-300 font-bold"
                  >
                    {authMode === 'login' ? 'Sign up' : 'Log in'}
                  </button>
                </p>
              </div>
            ) : (
              <>
                {/* Logged in user panel */}
                <div className="bg-slate-800/90 backdrop-blur-md rounded-2xl px-4 py-3 border border-slate-600/50 flex items-center space-x-3 w-56">
                  <div className="w-10 h-10 bg-gradient-to-br from-cyan-500 to-blue-500 rounded-xl flex items-center justify-center text-white font-bold text-lg">
                    {user.username[0].toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <p className="text-xs text-slate-400">Playing as</p>
                    <p className="text-white font-bold text-sm" style={{ fontFamily: '"Fredoka One", cursive' }}>
                      {user.username}
                    </p>
                  </div>
                  <button 
                    onClick={logout}
                    className="text-slate-400 hover:text-red-400 text-lg"
                    title="Logout"
                  >
                    ✕
                  </button>
                </div>

                {/* Leaderboard Toggle */}
                <button
                  onClick={() => setShowLeaderboard(!showLeaderboard)}
                  className="bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-white font-bold py-3 rounded-2xl transition-all duration-200 transform hover:scale-105 shadow-xl flex items-center justify-center gap-2 w-56"
                  style={{ fontFamily: '"Fredoka One", cursive' }}
                >
                  <span>🏆</span>
                  <span>Leaderboard</span>
                  <span className={`transition-transform duration-200 ${showLeaderboard ? 'rotate-180' : ''}`}>▼</span>
                </button>

                {/* Collapsible Leaderboard */}
                <div className={`overflow-hidden transition-all duration-300 ease-out ${
                  showLeaderboard ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'
                }`}>
                  <div className="bg-slate-900/95 backdrop-blur-md rounded-2xl border border-slate-700/50 shadow-2xl w-56">
                    {/* Your Stats */}
                    <div className="bg-slate-800/50 px-4 py-3 border-b border-slate-700/50 rounded-t-2xl">
                      <p className="text-slate-400 text-xs uppercase tracking-wide mb-1">Your Stats</p>
                      <div className="flex justify-between items-center">
                        <p className="text-white font-bold text-sm" style={{ fontFamily: '"Fredoka One", cursive' }}>
                          {userStats.rank ? `Rank #${userStats.rank}` : 'Unranked'}
                        </p>
                        <div className="text-right">
                          <p className="text-yellow-400 font-bold text-lg" style={{ fontFamily: '"Fredoka One", cursive' }}>
                            {userStats.highScore?.toLocaleString() || '-'}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Top 10 */}
                    <div className="px-3 py-2 max-h-64 overflow-y-auto">
                      <p className="text-slate-400 text-xs uppercase tracking-wide mb-2 px-2">Top 10</p>
                      {top10.length > 0 ? (
                        <div className="space-y-1">
                          {top10.map((entry, index) => {
                            const isUser = user && entry.user_id === user.id
                            return (
                              <div 
                                key={entry.id}
                                className={`flex items-center justify-between px-3 py-2 rounded-lg ${
                                  isUser ? 'bg-yellow-500/20 border border-yellow-500/30' : 'hover:bg-slate-800/50'
                                }`}
                              >
                                <div className="flex items-center gap-2">
                                  <span className="text-lg w-6 text-center">
                                    {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : 
                                      <span className="text-slate-400 text-sm font-bold">{index + 1}</span>
                                    }
                                  </span>
                                  <span className={`text-sm font-medium ${isUser ? 'text-yellow-300' : 'text-white'}`}>
                                    {isUser ? 'You' : entry.username}
                                  </span>
                                </div>
                                <span className={`font-bold text-sm ${isUser ? 'text-yellow-300' : 'text-white'}`}>
                                  {entry.best_score?.toLocaleString()}
                                </span>
                              </div>
                            )
                          })}
                        </div>
                      ) : (
                        <div className="text-center py-4">
                          <p className="text-slate-400 text-sm">No scores yet!</p>
                          <p className="text-slate-500 text-xs">Be the first!</p>
                        </div>
                      )}
                    </div>

                    <div className="bg-slate-800/30 px-4 py-2 border-t border-slate-700/50 rounded-b-2xl">
                      <p className="text-slate-500 text-xs text-center">🔴 Live updates</p>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Welcome overlay when not logged in */}
          {!user && (
            <div className="absolute inset-0 z-10 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center">
              <div className="text-center">
                <h1 
                  className="text-5xl font-bold text-white mb-4 drop-shadow-lg"
                  style={{ fontFamily: '"Fredoka One", cursive' }}
                >
                  Penguin Hop
                </h1>
                <p 
                  className="text-xl text-cyan-200"
                  style={{ fontFamily: '"Nunito", sans-serif' }}
                >
                  Sign in to start playing!
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
