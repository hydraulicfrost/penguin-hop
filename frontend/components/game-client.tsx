'use client'

// Username/password authentication system - v2.0 - Mobile friendly
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
  const [isFullscreen, setIsFullscreen] = useState(false)
  
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
      
      <div className="min-h-screen w-full relative overflow-hidden bg-slate-900">
        {/* TV Background Container */}
        <div className="absolute inset-0 flex items-center justify-center">
          {/* Game iframe - behind the TV (or fullscreen) */}
          {gameSession && (
            <>
              {/* Normal view - inside TV */}
              {!isFullscreen && (
                <iframe
                  src={`https://coco-and-bridge.marketjs-cloud2.com/en/coco-and-bridge-penguin-hop/1756889184732/index.html?tournament_id=${gameSession.tournament_id}&user_id=${gameSession.user_id}&game_id=${gameSession.game_id}`}
                  title="Penguin Hop Game"
                  className="game-iframe-normal"
                  style={{
                    position: 'absolute',
                    zIndex: 1,
                    top: '29%',
                    left: '15%',
                    width: '70%',
                    height: '46%',
                    border: 'none',
                    borderRadius: '15px',
                  }}
                />
              )}
              
              {/* Fullscreen view */}
              {isFullscreen && (
                <>
                  <div 
                    className="absolute inset-0 bg-slate-900/95 z-[99] cursor-pointer"
                    onClick={() => setIsFullscreen(false)}
                  />
                  <iframe
                    src={`https://coco-and-bridge.marketjs-cloud2.com/en/coco-and-bridge-penguin-hop/1756889184732/index.html?tournament_id=${gameSession.tournament_id}&user_id=${gameSession.user_id}&game_id=${gameSession.game_id}`}
                    title="Penguin Hop Game"
                    style={{
                      position: 'absolute',
                      zIndex: 100,
                      top: '5%',
                      left: '5%',
                      width: '90%',
                      height: '90%',
                      border: 'none',
                      borderRadius: '12px',
                    }}
                  />
                </>
              )}
            </>
          )}
          
          {/* TV Frame - Show on all screen sizes */}
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

          {/* Mobile-specific: wider iframe */}
          <style jsx>{`
            @media (max-width: 767px) {
              .game-iframe-normal {
                left: 5% !important;
                width: 90% !important;
              }
            }
          `}</style>


          {/* Top Panel - Responsive positioning */}
          <div className="absolute top-2 right-2 md:top-6 md:right-8 z-30 flex flex-col items-end gap-2">
            {!user ? (
              /* Login/Register Form - Responsive */
              <div className="bg-slate-800/95 backdrop-blur-md rounded-xl md:rounded-2xl p-3 md:p-5 border border-slate-600/50 shadow-2xl w-64 md:w-72">
                <h2 
                  className="text-white text-lg md:text-xl font-bold mb-3 md:mb-4 text-center"
                  style={{ fontFamily: '"Fredoka One", cursive' }}
                >
                  {authMode === 'login' ? 'Welcome Back!' : 'Join the Fun!'}
                </h2>
                
                <form onSubmit={handleAuth} className="space-y-2 md:space-y-3">
                  <input
                    type="text"
                    placeholder="Username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full px-3 md:px-4 py-2 md:py-3 rounded-lg md:rounded-xl bg-slate-700/50 border border-slate-600 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm md:text-base"
                    style={{ fontFamily: '"Nunito", sans-serif' }}
                    required
                  />
                  <input
                    type="password"
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-3 md:px-4 py-2 md:py-3 rounded-lg md:rounded-xl bg-slate-700/50 border border-slate-600 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm md:text-base"
                    style={{ fontFamily: '"Nunito", sans-serif' }}
                    required
                  />
                  
                  {authError && (
                    <p className="text-red-400 text-xs md:text-sm text-center">{authError}</p>
                  )}
                  
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full py-2 md:py-3 rounded-lg md:rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white font-bold transition-all duration-200 transform hover:scale-105 active:scale-95 disabled:opacity-50 text-sm md:text-base"
                    style={{ fontFamily: '"Fredoka One", cursive' }}
                  >
                    {isSubmitting ? '...' : (authMode === 'login' ? 'Play!' : 'Sign Up')}
                  </button>
                </form>
                
                <p className="text-slate-400 text-xs md:text-sm text-center mt-3 md:mt-4" style={{ fontFamily: '"Nunito", sans-serif' }}>
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
                {/* Logged in user panel - Responsive */}
                <div className="bg-slate-800/90 backdrop-blur-md rounded-xl md:rounded-2xl px-3 md:px-4 py-2 md:py-3 border border-slate-600/50 flex items-center space-x-2 md:space-x-3 w-48 md:w-56">
                  <div className="w-8 h-8 md:w-10 md:h-10 bg-gradient-to-br from-cyan-500 to-blue-500 rounded-lg md:rounded-xl flex items-center justify-center text-white font-bold text-sm md:text-lg">
                    {user.username[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] md:text-xs text-slate-400">Playing as</p>
                    <p className="text-white font-bold text-xs md:text-sm truncate" style={{ fontFamily: '"Fredoka One", cursive' }}>
                      {user.username}
                    </p>
                  </div>
                  <button 
                    onClick={logout}
                    className="text-slate-400 hover:text-red-400 text-base md:text-lg flex-shrink-0"
                    title="Logout"
                  >
                    ✕
                  </button>
                </div>

                {/* Leaderboard Toggle - Responsive */}
                <button
                  onClick={() => setShowLeaderboard(!showLeaderboard)}
                  className="bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-white font-bold py-2 md:py-3 rounded-xl md:rounded-2xl transition-all duration-200 transform hover:scale-105 active:scale-95 shadow-xl flex items-center justify-center gap-1 md:gap-2 w-48 md:w-56 text-sm md:text-base"
                  style={{ fontFamily: '"Fredoka One", cursive' }}
                >
                  <span>🏆</span>
                  <span>Leaderboard</span>
                  <span className={`transition-transform duration-200 ${showLeaderboard ? 'rotate-180' : ''}`}>▼</span>
                </button>

                {/* Fullscreen Button */}
                {gameSession && (
                  <button
                    onClick={() => setIsFullscreen(true)}
                    className="group bg-slate-800/90 hover:bg-slate-700 text-white font-bold py-2 md:py-3 rounded-xl md:rounded-2xl transition-all duration-200 transform hover:scale-105 active:scale-95 shadow-xl flex items-center justify-center gap-2 w-48 md:w-56 text-sm md:text-base border border-slate-600/50"
                    style={{ fontFamily: '"Fredoka One", cursive' }}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="15 3 21 3 21 9"></polyline>
                      <polyline points="9 21 3 21 3 15"></polyline>
                      <line x1="21" y1="3" x2="14" y2="10"></line>
                      <line x1="3" y1="21" x2="10" y2="14"></line>
                    </svg>
                    <span className="hidden group-hover:inline">Play Fullscreen</span>
                    <span className="group-hover:hidden">Fullscreen</span>
                  </button>
                )}

                {/* Collapsible Leaderboard - Responsive */}
                <div className={`overflow-hidden transition-all duration-300 ease-out ${
                  showLeaderboard ? 'max-h-[400px] md:max-h-[500px] opacity-100' : 'max-h-0 opacity-0'
                }`}>
                  <div className="bg-slate-900/95 backdrop-blur-md rounded-xl md:rounded-2xl border border-slate-700/50 shadow-2xl w-48 md:w-56">
                    {/* Your Stats */}
                    <div className="bg-slate-800/50 px-3 md:px-4 py-2 md:py-3 border-b border-slate-700/50 rounded-t-xl md:rounded-t-2xl">
                      <p className="text-slate-400 text-[10px] md:text-xs uppercase tracking-wide mb-1">Your Stats</p>
                      <div className="flex justify-between items-center">
                        <p className="text-white font-bold text-xs md:text-sm" style={{ fontFamily: '"Fredoka One", cursive' }}>
                          {userStats.rank ? `Rank #${userStats.rank}` : 'Unranked'}
                        </p>
                        <div className="text-right">
                          <p className="text-yellow-400 font-bold text-base md:text-lg" style={{ fontFamily: '"Fredoka One", cursive' }}>
                            {userStats.highScore?.toLocaleString() || '-'}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Top 10 */}
                    <div className="px-2 md:px-3 py-2 max-h-48 md:max-h-64 overflow-y-auto">
                      <p className="text-slate-400 text-[10px] md:text-xs uppercase tracking-wide mb-2 px-1 md:px-2">Top 10</p>
                      {top10.length > 0 ? (
                        <div className="space-y-1">
                          {top10.map((entry, index) => {
                            const isUser = user && entry.user_id === user.id
                            return (
                              <div 
                                key={entry.id}
                                className={`flex items-center justify-between px-2 md:px-3 py-1.5 md:py-2 rounded-lg ${
                                  isUser ? 'bg-yellow-500/20 border border-yellow-500/30' : 'hover:bg-slate-800/50'
                                }`}
                              >
                                <div className="flex items-center gap-1 md:gap-2">
                                  <span className="text-sm md:text-lg w-5 md:w-6 text-center">
                                    {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : 
                                      <span className="text-slate-400 text-xs md:text-sm font-bold">{index + 1}</span>
                                    }
                                  </span>
                                  <span className={`text-xs md:text-sm font-medium truncate max-w-[60px] md:max-w-[80px] ${isUser ? 'text-yellow-300' : 'text-white'}`}>
                                    {isUser ? 'You' : entry.username}
                                  </span>
                                </div>
                                <span className={`font-bold text-xs md:text-sm ${isUser ? 'text-yellow-300' : 'text-white'}`}>
                                  {entry.best_score?.toLocaleString()}
                                </span>
                              </div>
                            )
                          })}
                        </div>
                      ) : (
                        <div className="text-center py-3 md:py-4">
                          <p className="text-slate-400 text-xs md:text-sm">No scores yet!</p>
                          <p className="text-slate-500 text-[10px] md:text-xs">Be the first!</p>
                        </div>
                      )}
                    </div>

                    <div className="bg-slate-800/30 px-3 md:px-4 py-1.5 md:py-2 border-t border-slate-700/50 rounded-b-xl md:rounded-b-2xl">
                      <p className="text-slate-500 text-[10px] md:text-xs text-center">🔴 Live updates</p>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Welcome overlay when not logged in */}
          {!user && (
            <div className="absolute inset-0 z-10 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center">
              <div className="text-center px-4">
                <h1 
                  className="text-3xl md:text-5xl font-bold text-white mb-2 md:mb-4 drop-shadow-lg"
                  style={{ fontFamily: '"Fredoka One", cursive' }}
                >
                  Penguin Hop
                </h1>
                <p 
                  className="text-base md:text-xl text-cyan-200"
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
