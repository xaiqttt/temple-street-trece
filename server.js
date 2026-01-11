const express = require('express');
const cors = require('cors');
const path = require('path');
const crypto = require('crypto');
import fetch from 'node-fetch';

const app = express();
const PORT = process.env.PORT || 3000;

// SECURITY: Admin key should be in environment variable for production
const ADMIN_KEY = process.env.ADMIN_KEY || 'TST13ADMIN2025';

// Store active admin sessions
const activeSessions = new Map();

// Session timeout (30 minutes)
const SESSION_TIMEOUT = 30 * 60 * 1000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Rate limiting for admin endpoints
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

    if (Date.now() - session.createdAt > SESSION_TIMEOUT) {
        activeSessions.delete(sessionToken);
        return false;
    }

    return true;
}

// Clean up expired sessions
setInterval(() => {
    const now = Date.now();
    for (const [token, session] of activeSessions.entries()) {
        if (now - session.createdAt > SESSION_TIMEOUT) {
            activeSessions.delete(token);
        }
    }
}, 5 * 60 * 1000);

// GitHub storage config
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const REPO = process.env.GITHUB_REPO;
const FILE_PATH = process.env.GITHUB_FILE_PATH;
const BRANCH = process.env.GITHUB_BRANCH;

// Get current SHA of the file
async function getFileSHA() {
    const res = await fetch(`https://api.github.com/repos/${REPO}/contents/${FILE_PATH}?ref=${BRANCH}`, {
        headers: { Authorization: `token ${GITHUB_TOKEN}` },
    });

    if (!res.ok) throw new Error(`Failed to get file SHA: ${res.statusText}`);
    const data = await res.json();
    return data.sha;
}

// Read funds.json from GitHub
async function readFunds() {
    const res = await fetch(`https://raw.githubusercontent.com/${REPO}/${BRANCH}/${FILE_PATH}`);
    if (!res.ok) throw new Error(`Failed to read funds: ${res.statusText}`);
    return await res.json();
}

// Write funds.json to GitHub
async function writeFunds(data) {
    const content = Buffer.from(JSON.stringify(data, null, 2)).toString('base64');
    const sha = await getFileSHA();

    const res = await fetch(`https://api.github.com/repos/${REPO}/contents/${FILE_PATH}`, {
        method: 'PUT',
        headers: {
            Authorization: `token ${GITHUB_TOKEN}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            message: 'Update funds.json via Vercel',
            content: content,
            sha: sha,
            branch: BRANCH
        })
    });

    if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Error writing funds: ${errText}`);
    }

    return await res.json();
}

// API Routes

app.get('/api/funds', async (req, res) => {
    try {
        const data = await readFunds();
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: 'Failed to read funds data' });
    }
});

app.post('/api/funds', async (req, res) => {
    try {
        const { sessionToken, data } = req.body;

        if (!verifySession(sessionToken)) {
            return res.status(401).json({ error: 'Unauthorized - Invalid or expired session' });
        }

        if (!data || !data.funds || !data.summary) {
            return res.status(400).json({ error: 'Invalid data structure' });
        }

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

        if (typeof data.summary.pman !== 'number' || typeof data.summary.hawak !== 'number') {
            return res.status(400).json({ error: 'Invalid summary data' });
        }

        await writeFunds(data);
        res.json({ success: true, message: 'Funds updated successfully' });
    } catch (error) {
        console.error('Update error:', error);
        res.status(500).json({ error: 'Failed to update funds' });
    }
});

app.post('/api/admin/login', async (req, res) => {
    try {
        const { adminKey } = req.body;
        const clientIp = req.ip || req.connection.remoteAddress;

        if (!checkRateLimit(clientIp)) {
            return res.status(429).json({
                error: 'Too many login attempts. Please try again later.'
            });
        }

        if (adminKey !== ADMIN_KEY) {
            console.log(`Failed login attempt from ${clientIp}`);
            return res.status(401).json({ error: 'Invalid admin key' });
        }

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

app.get('/api/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        activeSessions: activeSessions.size
    });
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

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
