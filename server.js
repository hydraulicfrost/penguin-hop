const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const http = require('http');
const WebSocket = require('ws');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');

// Configuration
const MARKETJS_SECRET = process.env.MARKETJS_SECRET || 'fallback-secret-for-local-dev';
const JWT_SECRET = process.env.JWT_SECRET || 'penguin-hop-jwt-secret-change-in-production';
const PORT = process.env.PORT || 10000;
const DATABASE_URL = process.env.DATABASE_URL;

const app = express();

// CORS configuration
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, curl, etc)
    if (!origin) return callback(null, true);
    
    const allowedOrigins = [
      'http://localhost:5500', 
      'http://127.0.0.1:5500', 
      'http://localhost:3001',  
      'http://127.0.0.1:3001',  
      'http://localhost:3000',  
      'http://127.0.0.1:3000',
      'https://coco-and-bridge.marketjs-cloud2.com',
      'https://validator.marketjs-cloud.com',
      'http://164.92.196.60'
    ];
    
    // Allow all Vercel deployments
    if (origin.endsWith('.vercel.app') || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true
}));

app.use(express.json());

// Create HTTP server for both Express and WebSocket
const server = http.createServer(app);

// WebSocket server for real-time leaderboard updates
const wss = new WebSocket.Server({ server });

// Store connected clients
const clients = new Set();

wss.on('connection', (ws) => {
  console.log('Client connected to WebSocket');
  clients.add(ws);
  
  ws.on('close', () => {
    console.log('Client disconnected from WebSocket');
    clients.delete(ws);
  });
  
  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
    clients.delete(ws);
  });
});

// Database setup - PostgreSQL for production, SQLite for local dev
let db;
let isPostgres = false;

if (DATABASE_URL) {
  // Production: Use PostgreSQL
  isPostgres = true;
  db = new Pool({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  console.log('Using PostgreSQL database');
} else {
  // Local development: Use SQLite
  const sqlite3 = require('sqlite3').verbose();
  db = new sqlite3.Database('./database.db');
  console.log('Using SQLite database (local development)');
}

// Database helper functions to abstract SQLite vs PostgreSQL
async function dbRun(query, params = []) {
  if (isPostgres) {
    // Convert ? placeholders to $1, $2, etc for PostgreSQL
    let pgQuery = query;
    let paramIndex = 0;
    pgQuery = pgQuery.replace(/\?/g, () => `$${++paramIndex}`);
    return db.query(pgQuery, params);
  } else {
    return new Promise((resolve, reject) => {
      db.run(query, params, function(err) {
        if (err) reject(err);
        else resolve({ lastID: this.lastID, changes: this.changes });
      });
    });
  }
}

async function dbGet(query, params = []) {
  if (isPostgres) {
    let pgQuery = query;
    let paramIndex = 0;
    pgQuery = pgQuery.replace(/\?/g, () => `$${++paramIndex}`);
    const result = await db.query(pgQuery, params);
    return result.rows[0];
  } else {
    return new Promise((resolve, reject) => {
      db.get(query, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }
}

async function dbAll(query, params = []) {
  if (isPostgres) {
    let pgQuery = query;
    let paramIndex = 0;
    pgQuery = pgQuery.replace(/\?/g, () => `$${++paramIndex}`);
    const result = await db.query(pgQuery, params);
    return result.rows;
  } else {
    return new Promise((resolve, reject) => {
      db.all(query, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }
}

// Initialize database tables
async function initDatabase() {
  try {
    if (isPostgres) {
      // PostgreSQL tables
      await db.query(`
        CREATE TABLE IF NOT EXISTS users (
          id SERIAL PRIMARY KEY,
          username VARCHAR(50) UNIQUE NOT NULL,
          password_hash TEXT NOT NULL,
          wallet_address TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      
      await db.query(`
        CREATE TABLE IF NOT EXISTS scores (
          id SERIAL PRIMARY KEY,
          user_id INTEGER NOT NULL REFERENCES users(id),
          tournament_id TEXT NOT NULL,
          game_id TEXT NOT NULL,
          score INTEGER NOT NULL,
          time INTEGER NOT NULL,
          is_valid BOOLEAN NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      
      await db.query(`
        CREATE TABLE IF NOT EXISTS game_sessions (
          id SERIAL PRIMARY KEY,
          tournament_id TEXT UNIQUE NOT NULL,
          user_id INTEGER NOT NULL REFERENCES users(id),
          game_id TEXT NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
    } else {
      // SQLite tables
      await dbRun(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        wallet_address TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);
      
      await dbRun(`CREATE TABLE IF NOT EXISTS scores (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        tournament_id TEXT NOT NULL,
        game_id TEXT NOT NULL,
        score INTEGER NOT NULL,
        time INTEGER NOT NULL,
        is_valid BOOLEAN NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
      )`);
      
      await dbRun(`CREATE TABLE IF NOT EXISTS game_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tournament_id TEXT UNIQUE NOT NULL,
        user_id INTEGER NOT NULL,
        game_id TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
      )`);
    }
    
    console.log('Database tables ready.');
  } catch (error) {
    console.error('Error initializing database:', error);
  }
}

// Initialize database on startup
initDatabase();

// Function to broadcast leaderboard updates
async function broadcastLeaderboardUpdate() {
  if (clients.size === 0) return;
  
  try {
    const rows = await dbAll(
      `SELECT s.user_id, u.username, MAX(s.score) as best_score, s.time, s.created_at, s.id
       FROM scores s
       JOIN users u ON s.user_id = u.id
       WHERE s.is_valid = true
       GROUP BY s.user_id, u.username
       ORDER BY best_score DESC
       LIMIT 50`
    );
    
    const message = JSON.stringify({
      type: 'leaderboard_update',
      leaderboard: rows
    });
    
    clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        try {
          client.send(message);
        } catch (error) {
          console.error('Error sending WebSocket message:', error);
          clients.delete(client);
        }
      }
    });
    
    console.log(`Broadcasted leaderboard update to ${clients.size} clients`);
  } catch (error) {
    console.error('Error broadcasting leaderboard:', error);
  }
}

// Authentication middleware for MarketJS
function authenticateMarketJS(req, res, next) {
  const authHeader = req.headers['authorization'];
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.json({ status: 401, message: "No authentication token" });
  }
  
  const token = authHeader.substring(7);
  
  if (token !== MARKETJS_SECRET) {
    return res.json({ status: 401, message: "Invalid authentication" });
  }
  
  next();
}

// JWT authentication middleware
function authenticateJWT(req, res, next) {
  const authHeader = req.headers['authorization'];
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: "No token provided" });
  }
  
  const token = authHeader.substring(7);
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: "Invalid token" });
  }
}

// ============ AUTH ENDPOINTS ============

// Register new user
app.post('/api/register', async (req, res) => {
  const { username, password } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({ error: "Username and password required" });
  }
  
  if (username.length < 3 || username.length > 20) {
    return res.status(400).json({ error: "Username must be 3-20 characters" });
  }
  
  if (password.length < 6) {
    return res.status(400).json({ error: "Password must be at least 6 characters" });
  }
  
  try {
    // Check if username already exists
    const existing = await dbGet('SELECT id FROM users WHERE username = ?', [username]);
    
    if (existing) {
      return res.status(400).json({ error: "Username already taken" });
    }
    
    // Hash password and create user
    const passwordHash = await bcrypt.hash(password, 10);
    
    let userId;
    if (isPostgres) {
      const result = await db.query(
        'INSERT INTO users (username, password_hash) VALUES ($1, $2) RETURNING id',
        [username, passwordHash]
      );
      userId = result.rows[0].id;
    } else {
      const result = await dbRun(
        'INSERT INTO users (username, password_hash) VALUES (?, ?)',
        [username, passwordHash]
      );
      userId = result.lastID;
    }
    
    const token = jwt.sign({ id: userId, username }, JWT_SECRET, { expiresIn: '30d' });
    
    console.log(`✅ New user registered: ${username} (ID: ${userId})`);
    
    res.json({
      success: true,
      user: { id: userId, username },
      token
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: "Failed to create user" });
  }
});

// Login
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({ error: "Username and password required" });
  }
  
  try {
    const user = await dbGet('SELECT * FROM users WHERE username = ?', [username]);
    
    if (!user) {
      return res.status(401).json({ error: "Invalid username or password" });
    }
    
    const validPassword = await bcrypt.compare(password, user.password_hash);
    
    if (!validPassword) {
      return res.status(401).json({ error: "Invalid username or password" });
    }
    
    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '30d' });
    
    console.log(`✅ User logged in: ${username}`);
    
    res.json({
      success: true,
      user: { id: user.id, username: user.username, wallet_address: user.wallet_address },
      token
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: "Login failed" });
  }
});

// Get current user
app.get('/api/me', authenticateJWT, async (req, res) => {
  try {
    const user = await dbGet('SELECT id, username, wallet_address, created_at FROM users WHERE id = ?', [req.user.id]);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    res.json({ user });
  } catch (error) {
    res.status(500).json({ error: "Failed to get user" });
  }
});

// Link wallet address
app.post('/api/link-wallet', authenticateJWT, async (req, res) => {
  const { walletAddress } = req.body;
  
  if (!walletAddress) {
    return res.status(400).json({ error: "Wallet address required" });
  }
  
  try {
    await dbRun('UPDATE users SET wallet_address = ? WHERE id = ?', [walletAddress, req.user.id]);
    console.log(`✅ Wallet linked for user ${req.user.username}: ${walletAddress}`);
    res.json({ success: true, walletAddress });
  } catch (error) {
    console.error('Error linking wallet:', error);
    res.status(500).json({ error: "Failed to link wallet" });
  }
});

// ============ GAME ENDPOINTS ============

// Start game session
app.post('/api/start-game', authenticateJWT, async (req, res) => {
  const userId = req.user.id;
  const username = req.user.username;
  
  console.log(`Starting game session for user: ${username} (ID: ${userId})`);
  
  const tournament_id = crypto.randomUUID();
  const game_id = 'penguin-hop';
  
  try {
    await dbRun(
      'INSERT INTO game_sessions (tournament_id, user_id, game_id) VALUES (?, ?, ?)',
      [tournament_id, userId, game_id]
    );
    
    console.log(`✅ Game session created: ${tournament_id} for ${username}`);
    
    res.json({
      success: true,
      tournament_id,
      game_id,
      user_id: userId,
      username
    });
  } catch (error) {
    console.error('Error creating game session:', error);
    res.status(500).json({ error: "Failed to create game session" });
  }
});

// Submit score (MarketJS webhook)
app.post('/api/submitScore', authenticateMarketJS, async (req, res) => {
  const { tournament_id, game_id, user_id, score, time, is_valid } = req.body;
  
  console.log(`Received score: tournament=${tournament_id}, score=${score}, valid=${is_valid}`);
  
  if (typeof score !== 'number' || typeof time !== 'number' || typeof is_valid !== 'boolean') {
    return res.json({ status: 401, message: "Invalid score data format" });
  }
  
  try {
    // Verify the session exists
    const session = await dbGet('SELECT * FROM game_sessions WHERE tournament_id = ?', [tournament_id]);
    
    if (!session) {
      console.log(`⚠️ REJECTED: No session found for tournament ${tournament_id}`);
      return res.json({ status: 403, message: "Invalid game session" });
    }
    
    // Store the score
    await dbRun(
      'INSERT INTO scores (user_id, tournament_id, game_id, score, time, is_valid) VALUES (?, ?, ?, ?, ?, ?)',
      [session.user_id, tournament_id, game_id, score, time, is_valid]
    );
    
    console.log(`✅ Score saved: ${score} for user ID ${session.user_id}`);
    
    if (!is_valid) {
      console.log(`⚠️ FRAUD DETECTED: Invalid score flagged`);
    }
    
    // Broadcast leaderboard update
    broadcastLeaderboardUpdate();
    
    res.json({ status: 200 });
  } catch (error) {
    console.error('Error saving score:', error);
    res.json({ status: 500, message: "Failed to store score" });
  }
});

// Get leaderboard
app.get('/api/leaderboard', async (req, res) => {
  try {
    const rows = await dbAll(
      `SELECT s.user_id, u.username, MAX(s.score) as best_score, s.time, s.created_at, s.id
       FROM scores s
       JOIN users u ON s.user_id = u.id
       WHERE s.is_valid = true
       GROUP BY s.user_id, u.username
       ORDER BY best_score DESC
       LIMIT 50`
    );
    
    res.json({ leaderboard: rows });
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    res.status(500).json({ error: "Database error" });
  }
});

// API info
app.get('/api', (req, res) => {
  res.json({
    name: "Penguin Hop Competition API",
    version: "2.0",
    database: isPostgres ? "PostgreSQL" : "SQLite",
    status: "running"
  });
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 200, message: "Server running", database: isPostgres ? "PostgreSQL" : "SQLite" });
});

// Start server
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://127.0.0.1:${PORT}`);
  console.log(`WebSocket server running on ws://127.0.0.1:${PORT}`);
  console.log(`Database: ${isPostgres ? 'PostgreSQL' : 'SQLite'}`);
  console.log('==> Your service is live 🎉');
});
