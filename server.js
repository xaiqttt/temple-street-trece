const express = require('express');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

// SECURITY: Admin key should be in environment variable for production
// Generate a secure key: node -e "console.log(crypto.randomBytes(32).toString('hex'))"
const ADMIN_KEY = process.env.ADMIN_KEY || 'TST13ADMIN2025';

// Store active admin sessions (in production, use Redis or similar)
const activeSessions = new Map();

// Session timeout (30 minutes)
const SESSION_TIMEOUT = 30 * 60 * 1000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Rate limiting for admin endpoints (simple implementation)
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const MAX_ATTEMPTS = 5;

function checkRateLimit(ip) {
    const now = Date.now();
    const attempts = rateLimitMap.get(ip) || [];
    const recentAttempts = attempts.filter(time => now - time < RATE_LIMIT_WINDOW);
    
    if (recentAttempts.length >= MAX_ATTEMPTS) {
        return false;
    }
    
    recentAttempts.push(now);
    rateLimitMap.set(ip, recentAttempts);
    return true;
}

// Generate secure session token
function generateSessionToken() {
    return crypto.randomBytes(32).toString('hex');
}

// Verify session token
function verifySession(sessionToken) {
    if (!sessionToken) return false;
    
    const session = activeSessions.get(sessionToken);
    if (!session) return false;
    
    // Check if session expired
    if (Date.now() - session.createdAt > SESSION_TIMEOUT) {
        activeSessions.delete(sessionToken);
        return false;
    }
    
    return true;
}

// Clean up expired sessions periodically
setInterval(() => {
    const now = Date.now();
    for (const [token, session] of activeSessions.entries()) {
        if (now - session.createdAt > SESSION_TIMEOUT) {
            activeSessions.delete(token);
        }
    }
}, 5 * 60 * 1000); // Every 5 minutes

// Data file path
const DATA_FILE = path.join(__dirname, 'data', 'funds.json');

// Ensure data directory exists
async function ensureDataDirectory() {
    try {
        await fs.mkdir(path.join(__dirname, 'data'), { recursive: true });
    } catch (error) {
        console.error('Error creating data directory:', error);
    }
}

// Initialize default data
async function initializeData() {
    try {
        await fs.access(DATA_FILE);
    } catch {
        // File doesn't exist, create it with default data
        const defaultData = {
            funds: {
                ns: {
                    title: 'PONDO FOR NS(NORTHSIDE)',
                    target: 75,
                    members: [
                        { name: 'Jess', amount: 75 },
                        { name: 'Reb', amount: 75 },
                        { name: 'Darwin', amount: 75 },
                        { name: 'Chad', amount: 75 },
                        { name: 'David', amount: 75 },
                        { name: 'Jerome', amount: 75 },
                        { name: 'El uno', amount: 75 },
                        { name: 'Johnroo', amount: 75 }
                    ]
                },
                la: {
                    title: 'PONDO FOR LA',
                    target: 75,
                    members: [
                        { name: 'Jess', amount: 75 },
                        { name: 'Reb', amount: 15 },
                        { name: 'Darwin', amount: 30 },
                        { name: 'Chad', amount: 25 },
                        { name: 'David', amount: 75 },
                        { name: 'Jerome', amount: 75 },
                        { name: 'El uno', amount: 75 },
                        { name: 'Johnroo', amount: 75 }
                    ]
                },
                pintura: {
                    title: 'PINTURA',
                    target: 30,
                    members: [
                        { name: 'Jess', amount: 0 },
                        { name: 'Reb', amount: 0 },
                        { name: 'Darwin', amount: 30 },
                        { name: 'Chad', amount: 0 },
                        { name: 'David', amount: 30 },
                        { name: 'Jerome', amount: 0 },
                        { name: 'El uno', amount: 0 },
                        { name: 'Johnroo', amount: 0 }
                    ]
                }
            },
            summary: {
                pman: 730,
                hawak: 375
            }
        };
        
        await fs.writeFile(DATA_FILE, JSON.stringify(defaultData, null, 2));
        console.log('Default data initialized');
    }
}

// Read funds data
async function readFunds() {
    try {
        const data = await fs.readFile(DATA_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Error reading funds:', error);
        throw error;
    }
}

// Write funds data
async function writeFunds(data) {
    try {
        await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2));
        return true;
    } catch (error) {
        console.error('Error writing funds:', error);
        throw error;
    }
}

// API Routes

// Get funds (PUBLIC - no auth required)
app.get('/api/funds', async (req, res) => {
    try {
        const data = await readFunds();
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: 'Failed to read funds data' });
    }
});

// Update funds (REQUIRES VALID SESSION TOKEN)
app.post('/api/funds', async (req, res) => {
    try {
        const { sessionToken, data } = req.body;
        
        // Verify session token (NOT admin key!)
        if (!verifySession(sessionToken)) {
            return res.status(401).json({ error: 'Unauthorized - Invalid or expired session' });
        }
        
        // Validate data structure
        if (!data || !data.funds || !data.summary) {
            return res.status(400).json({ error: 'Invalid data structure' });
        }
        
        // Additional validation: ensure all amounts are numbers
        for (const fundKey in data.funds) {
            const fund = data.funds[fundKey];
            if (!fund.members || !Array.isArray(fund.members)) {
                return res.status(400).json({ error: 'Invalid fund structure' });
            }
            
            for (const member of fund.members) {
                if (typeof member.amount !== 'number' || member.amount < 0) {
                    return res.status(400).json({ error: 'Invalid member amount' });
                }
                if (!member.name || typeof member.name !== 'string') {
                    return res.status(400).json({ error: 'Invalid member name' });
                }
            }
        }
        
        // Validate summary
        if (typeof data.summary.pman !== 'number' || typeof data.summary.hawak !== 'number') {
            return res.status(400).json({ error: 'Invalid summary data' });
        }
        
        // Save data
        await writeFunds(data);
        res.json({ success: true, message: 'Funds updated successfully' });
    } catch (error) {
        console.error('Update error:', error);
        res.status(500).json({ error: 'Failed to update funds' });
    }
});

// Admin login - verify key and create session
app.post('/api/admin/login', async (req, res) => {
    try {
        const { adminKey } = req.body;
        const clientIp = req.ip || req.connection.remoteAddress;
        
        // Check rate limit
        if (!checkRateLimit(clientIp)) {
            return res.status(429).json({ 
                error: 'Too many login attempts. Please try again later.' 
            });
        }
        
        // Verify admin key
        if (adminKey !== ADMIN_KEY) {
            console.log(`Failed login attempt from ${clientIp}`);
            return res.status(401).json({ error: 'Invalid admin key' });
        }
        
        // Create session token
        const sessionToken = generateSessionToken();
        activeSessions.set(sessionToken, {
            createdAt: Date.now(),
            ip: clientIp
        });
        
        console.log(`✓ Admin logged in from ${clientIp} - Session: ${sessionToken.substring(0, 8)}...`);
        
        res.json({ 
            success: true, 
            sessionToken,
            expiresIn: SESSION_TIMEOUT 
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Login failed' });
    }
});

// Verify session (for frontend to check if still logged in)
app.post('/api/admin/verify', async (req, res) => {
    try {
        const { sessionToken } = req.body;
        
        if (verifySession(sessionToken)) {
            res.json({ valid: true });
        } else {
            res.status(401).json({ valid: false });
        }
    } catch (error) {
        res.status(500).json({ error: 'Verification failed' });
    }
});

// Admin logout - invalidate session
app.post('/api/admin/logout', async (req, res) => {
    try {
        const { sessionToken } = req.body;
        
        if (sessionToken) {
            activeSessions.delete(sessionToken);
            console.log(`✓ Admin logged out - Session: ${sessionToken.substring(0, 8)}...`);
        }
        
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Logout failed' });
    }
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        activeSessions: activeSessions.size
    });
});

// Serve index.html for root path
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Initialize and start server
async function startServer() {
    await ensureDataDirectory();
    await initializeData();
    
    app.listen(PORT, () => {
        console.log(`
╔═══════════════════════════════════════════════════════╗
║                                                       ║
║         TEMPLE STREET TRECE - SERVER RUNNING          ║
║                  SECURE ADMIN MODE                    ║
║                                                       ║
║  Server: http://localhost:${PORT}                        ║
║  Admin Key: ${ADMIN_KEY}                    ║
║  Session Timeout: ${SESSION_TIMEOUT / 60000} minutes                       ║
║                                                       ║
║  🔒 Security Features:                                ║
║  - Session-based authentication                       ║
║  - Rate limiting on login                             ║
║  - No admin key in frontend                           ║
║  - Session auto-expiry                                ║
║                                                       ║
╚═══════════════════════════════════════════════════════╝
        `);
    });
}

startServer().catch(console.error);
