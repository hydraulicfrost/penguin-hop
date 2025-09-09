const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const crypto = require('crypto');
const http = require('http');
const WebSocket = require('ws');

// Configuration
const MARKETJS_SECRET = 'your-shared-secret-with-marketjs';
const PORT = 3001;

// Abstract testnet configuration
const ABSTRACT_RPC_URL = 'https://api.testnet.abs.xyz';
const NFT_CONTRACT_ADDRESS = '0x70071362bCBc37C49cDCBC2112ad71215e2fd90D';
const CHAIN_ID = 11124;

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// CORS configuration
app.use(cors({
  origin: [
    'http://localhost:5500', 
    'http://127.0.0.1:5500', 
    'http://localhost:3001',  
    'http://127.0.0.1:3001',  
    'http://localhost:3000',  
    'http://127.0.0.1:3000',  
    'https://coco-and-bridge.marketjs-cloud2.com'
  ],
  credentials: true
}));

app.use(express.json());
app.use(express.static('public'));

// Initialize database
const db = new sqlite3.Database('./database.db');

// Create tables
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS scores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    tournament_id TEXT,
    game_id TEXT,
    score INTEGER NOT NULL,
    time INTEGER NOT NULL,
    is_valid BOOLEAN NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS game_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tournament_id TEXT UNIQUE NOT NULL,
    user_id TEXT NOT NULL,
    game_id TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME
  )`);
});

// WebSocket connection handling
wss.on('connection', (ws) => {
  console.log('Client connected to WebSocket');
  
  // Send current leaderboard on connection
  sendLeaderboardUpdate(ws);
  
  ws.on('close', () => {
    console.log('Client disconnected from WebSocket');
  });
});

// Function to broadcast leaderboard updates
function broadcastLeaderboardUpdate() {
  db.all(
    `SELECT user_id, MAX(score) as max_score, MAX(created_at) as last_played 
     FROM scores 
     WHERE is_valid = 1 
     GROUP BY user_id 
     ORDER BY max_score DESC 
     LIMIT 10`,
    (err, rows) => {
      if (!err) {
        const message = JSON.stringify({
          type: 'leaderboard_update',
          data: rows
        });
        
        wss.clients.forEach((client) => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(message);
          }
        });
      }
    }
  );
}

// Function to send leaderboard to single client
function sendLeaderboardUpdate(ws) {
  db.all(
    `SELECT user_id, MAX(score) as max_score, MAX(created_at) as last_played 
     FROM scores 
     WHERE is_valid = 1 
     GROUP BY user_id 
     ORDER BY max_score DESC 
     LIMIT 10`,
    (err, rows) => {
      if (!err && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: 'leaderboard_update',
          data: rows
        }));
      }
    }
  );
}

// NFT verification function
const verifyNftOwnership = async (walletAddress) => {
  try {
    console.log(`Checking NFT ownership for ${walletAddress} on Abstract testnet...`);
    console.log(`Contract: ${NFT_CONTRACT_ADDRESS}`);
    
    const { ethers } = require('ethers');
    const provider = new ethers.JsonRpcProvider(ABSTRACT_RPC_URL);
    
    const contract = new ethers.Contract(
      NFT_CONTRACT_ADDRESS, 
      ["function balanceOf(address owner) view returns (uint256)"], 
      provider
    );
    
    const balance = await contract.balanceOf(walletAddress);
    const hasNft = balance > 0;
    
    console.log(`NFT balance for ${walletAddress}: ${balance.toString()}`);
    console.log(`NFT verification result: ${hasNft ? 'APPROVED' : 'REJECTED'}`);
    
    return hasNft;
  } catch (error) {
    console.error('NFT verification failed:', error.message);
    console.log('NFT verification failed - ACCESS DENIED');
    return false;
  }
};

// Bearer token authentication middleware
const authenticateMarketJS = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (token !== MARKETJS_SECRET) {
    return res.json({ status: 401, message: "Invalid authentication" });
  }
  
  next();
};

// API Routes

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 200, message: "Server running with NFT verification and WebSocket support" });
});

// NFT verification and game session creation
app.post('/api/verify-nft', async (req, res) => {
  const { walletAddress } = req.body;
  
  if (!walletAddress) {
    return res.status(400).json({ 
      status: 400, 
      message: "Wallet address is required" 
    });
  }
  
  console.log(`Received NFT verification request for: ${walletAddress}`);
  
  try {
    const hasNft = await verifyNftOwnership(walletAddress);
    
    if (hasNft) {
      const gameSession = {
        tournament_id: crypto.randomUUID(),
        game_id: 'penguin-hop',
        user_id: walletAddress,
        user_name: walletAddress.substring(0, 8)
      };
      
      console.log(`Generated game session: tournament_id=${gameSession.tournament_id}, user_id=${gameSession.user_id}`);
      
      db.run(
        `INSERT INTO game_sessions (tournament_id, user_id, game_id, expires_at) VALUES (?, ?, ?, datetime('now', '+1 hour'))`,
        [gameSession.tournament_id, gameSession.user_id, gameSession.game_id],
        function(err) {
          if (err) {
            console.error('Error storing game session:', err);
          } else {
            console.log(`Game session stored successfully for ${gameSession.user_id}`);
          }
        }
      );
      
      res.json({
        status: 200,
        ...gameSession
      });
    } else {
      res.status(403).json({ 
        status: 403, 
        message: "NFT ownership required to play. You need to own an NFT from this collection." 
      });
    }
  } catch (error) {
    console.error('Verification error:', error);
    res.status(500).json({ 
      status: 500, 
      message: "Verification failed" 
    });
  }
});

// MarketJS score submission endpoint
app.post('/api/submitScore', authenticateMarketJS, (req, res) => {
  const { tournament_id, game_id, user_id, score, time, is_valid } = req.body;
  
  console.log(`Received score submission: user=${user_id}, score=${score}, valid=${is_valid}`);
  
  if (typeof score !== 'number' || typeof time !== 'number' || typeof is_valid !== 'boolean') {
    return res.json({ status: 401, message: "Invalid score data format" });
  }
  
  db.get(
    `SELECT * FROM game_sessions WHERE tournament_id = ? AND user_id = ?`,
    [tournament_id, user_id],
    (err, session) => {
      if (err) {
        console.error('Database error:', err);
        return res.json({ status: 404, message: "Database error" });
      }
      
      if (!session) {
        console.log(`Invalid game session: ${tournament_id} for user ${user_id}`);
        return res.json({ status: 404, message: "Invalid game session" });
      }
      
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
    }
  );
});

// Regular leaderboard endpoint (fallback)
app.get('/api/leaderboard', (req, res) => {
  db.all(
    `SELECT user_id, MAX(score) as max_score, MAX(created_at) as last_played 
     FROM scores 
     WHERE is_valid = 1 
     GROUP BY user_id 
     ORDER BY max_score DESC 
     LIMIT 10`,
    (err, rows) => {
      if (err) {
        console.error('Leaderboard error:', err.message);
        return res.status(500).json({ message: "Database error" });
      }
      console.log(`Leaderboard request: returning ${rows.length} scores`);
      res.json(rows);
    }
  );
});

// Start server with WebSocket support
server.listen(PORT, '127.0.0.1', () => {
  console.log(`Server running on http://127.0.0.1:${PORT}`);
  console.log(`WebSocket server running on ws://127.0.0.1:${PORT}`);
  console.log(`NFT verification enabled for contract: ${NFT_CONTRACT_ADDRESS}`);
  console.log(`Network: Abstract testnet (Chain ID: ${CHAIN_ID})`);
  console.log(`Make sure to share this secret with MarketJS: ${MARKETJS_SECRET}`);
});

console.log('Connected to SQLite database.');
console.log('Scores table ready.');
console.log('Game sessions table ready.');