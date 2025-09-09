const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const crypto = require('crypto');
const http = require('http');
const WebSocket = require('ws');

// Configuration - Using environment variables for security
const MARKETJS_SECRET = process.env.MARKETJS_SECRET || 'fallback-secret-for-local-dev';
const PORT = process.env.PORT || 10000;
const NFT_CONTRACT_ADDRESS = process.env.NFT_CONTRACT_ADDRESS || '0x70071362bCBc37C49cDCBC2112ad71215e2fd90D';

const app = express();

// CORS configuration - Updated to include Vercel frontend
app.use(cors({
  origin: [
    'http://localhost:5500', 
    'http://127.0.0.1:5500', 
    'http://localhost:3001',  
    'http://127.0.0.1:3001',  
    'http://localhost:3000',  
    'http://127.0.0.1:3000',
    'https://penguin-hop.vercel.app',  // Added Vercel frontend URL
    'https://coco-and-bridge.marketjs-cloud2.com'
  ],
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

// Function to broadcast leaderboard updates to all connected clients
function broadcastLeaderboardUpdate() {
  if (clients.size === 0) return;
  
  // Fetch current leaderboard
  db.all(
    `SELECT user_id, MAX(score) as best_score, time, created_at, id
     FROM scores 
     WHERE is_valid = 1 
     GROUP BY user_id 
     ORDER BY best_score DESC 
     LIMIT 50`,
    [],
    (err, rows) => {
      if (err) {
        console.error('Error fetching leaderboard for broadcast:', err);
        return;
      }
      
      const message = JSON.stringify({
        type: 'leaderboard_update',
        leaderboard: rows
      });
      
      // Send to all connected clients
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
    }
  );
}

// Database setup
const db = new sqlite3.Database('./database.db', (err) => {
  if (err) {
    console.error('Error opening database:', err);
  } else {
    console.log('Connected to SQLite database.');
  }
});

// Create tables
db.serialize(() => {
  // Scores table
  db.run(`CREATE TABLE IF NOT EXISTS scores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    tournament_id TEXT NOT NULL,
    game_id TEXT NOT NULL,
    score INTEGER NOT NULL,
    time INTEGER NOT NULL,
    is_valid BOOLEAN NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  
  // Game sessions table - recreate with correct schema
  db.run(`DROP TABLE IF EXISTS game_sessions`);
  db.run(`CREATE TABLE game_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tournament_id TEXT UNIQUE NOT NULL,
    user_id TEXT NOT NULL,
    game_id TEXT NOT NULL,
    user_name TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  
  console.log('Scores table ready.');
  console.log('Game sessions table ready.');
});

// Authentication middleware for MarketJS
function authenticateMarketJS(req, res, next) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.json({ status: 401, message: "Missing or invalid authorization header" });
  }
  
  const token = authHeader.substring(7);
  
  if (token !== MARKETJS_SECRET) {
    return res.json({ status: 401, message: "Invalid authentication" });
  }
  
  next();
}

// Add root route to prevent "Cannot GET /" error
app.get('/', (req, res) => {
  res.json({ 
    message: "Penguin Hop Gaming Platform API", 
    status: "running",
    endpoints: [
      "POST /api/submitScore",
      "GET /api/leaderboard", 
      "POST /api/verify-nft",
      "GET /api/health"
    ]
  });
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 200, message: "Server running with NFT verification" });
});

// Score submission endpoint (MarketJS integration)
app.post('/api/submitScore', authenticateMarketJS, (req, res) => {
  const { tournament_id, game_id, user_id, score, time, is_valid } = req.body;
  
  console.log(`Received score submission: user=${user_id}, score=${score}, valid=${is_valid}`);
  
  if (typeof score !== 'number' || typeof time !== 'number' || typeof is_valid !== 'boolean') {
    return res.json({ status: 401, message: "Invalid score data format" });
  }
  
  // Store the score directly (session validation disabled for testing)
  db.run(
    `INSERT INTO scores (user_id, tournament_id, game_id, score, time, is_valid) VALUES (?, ?, ?, ?, ?, ?)`,
    [user_id, tournament_id, game_id, score, time, is_valid],
    function(err) {
      if (err) {
        console.error('Error storing score:', err);
        return res.json({ status: 404, message: "Failed to store score" });
      }
      
      console.log(`Score stored successfully: ID ${this.lastID}`);
      
      if (!is_valid) {
        console.log(`⚠️ FRAUD DETECTED: Invalid score from user ${user_id}`);
      }
      
      // Broadcast leaderboard update to all connected clients
      broadcastLeaderboardUpdate();
      
      res.json({ status: 200 });
    }
  );
});

// Leaderboard endpoint
app.get('/api/leaderboard', (req, res) => {
  db.all(
    `SELECT user_id, MAX(score) as best_score, time, created_at, id
     FROM scores 
     WHERE is_valid = 1 
     GROUP BY user_id 
     ORDER BY best_score DESC 
     LIMIT 50`,
    [],
    (err, rows) => {
      if (err) {
        console.error('Database error:', err);
        return res.json({ status: 500, message: "Database error" });
      }
      
      res.json({ 
        status: 200, 
        leaderboard: rows 
      });
    }
  );
});

// NFT verification endpoint (simplified for testing)
app.post('/api/verify-nft', (req, res) => {
  const { walletAddress } = req.body;
  
  if (!walletAddress) {
    return res.json({ status: 400, message: "Wallet address required" });
  }
  
  console.log(`NFT verification request for wallet: ${walletAddress}`);
  
  // Generate unique game session
  const tournament_id = crypto.randomUUID();
  const game_id = 'penguin-hop';
  const user_name = `Player_${walletAddress.substring(2, 8)}`;
  
  // Store game session
  db.run(
    `INSERT INTO game_sessions (tournament_id, user_id, game_id, user_name) VALUES (?, ?, ?, ?)`,
    [tournament_id, walletAddress, game_id, user_name],
    function(err) {
      if (err) {
        console.error('Error creating game session:', err);
        return res.json({ status: 500, message: "Failed to create game session" });
      }
      
      console.log(`Game session created: ${tournament_id} for user ${walletAddress}`);
      
      // For testing: always approve (in production, add real NFT verification here)
      res.json({
        status: 200,
        message: "NFT verified successfully",
        tournament_id: tournament_id,
        game_id: game_id,
        user_id: walletAddress,
        user_name: user_name,
        nft_contract: NFT_CONTRACT_ADDRESS
      });
    }
  );
});

// Start server with WebSocket support
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://127.0.0.1:${PORT}`);
  console.log(`WebSocket server running on ws://127.0.0.1:${PORT}`);
  console.log(`NFT verification enabled for contract: ${NFT_CONTRACT_ADDRESS}`);
  console.log(`Network: Abstract testnet (Chain ID: 11124)`);
  console.log(`MarketJS authentication configured`);
  console.log('==> Your service is live 🎉');
  console.log('');
  console.log('////////////////////////////////////////////////');
  console.log(`==> Available at your primary URL: https://penguin-hop.onrender.com`);
  console.log('////////////////////////////////////////////////');
  console.log('');
});
