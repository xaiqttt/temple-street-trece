const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

const ADMIN_KEY = process.env.ADMIN_KEY || 'TST13ADMIN2025';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_REPO = process.env.GITHUB_REPO;
const GITHUB_FILE_PATH = process.env.GITHUB_FILE_PATH || 'data/funds.json';
const GITHUB_BRANCH = process.env.GITHUB_BRANCH || 'main';

const activeSessions = new Map();
const SESSION_TIMEOUT = 30 * 60 * 1000;
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW = 60000;
const MAX_ATTEMPTS = 5;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// ---------------- GitHub Helpers ----------------
async function readFunds() {
    const url = `https://api.github.com/repos/${GITHUB_REPO}/contents/${GITHUB_FILE_PATH}?ref=${GITHUB_BRANCH}`;
    const res = await fetch(url, {
        headers: { Authorization: `token ${GITHUB_TOKEN}` },
    });

    if (!res.ok) throw new Error('Failed to fetch data from GitHub');

    const json = await res.json();
    const content = Buffer.from(json.content, 'base64').toString('utf8');
    return JSON.parse(content);
}

async function writeFunds(data) {
    // Get SHA first
    const url = `https://api.github.com/repos/${GITHUB_REPO}/contents/${GITHUB_FILE_PATH}`;
    const getRes = await fetch(url + `?ref=${GITHUB_BRANCH}`, {
        headers: { Authorization: `token ${GITHUB_TOKEN}` },
    });

    if (!getRes.ok) throw new Error('Failed to fetch file info from GitHub');

    const getJson = await getRes.json();
    const sha = getJson.sha;

    const res = await fetch(url, {
        method: 'PUT',
        headers: {
            Authorization: `token ${GITHUB_TOKEN}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            message: 'Update funds',
            content: Buffer.from(JSON.stringify(data, null, 2)).toString('base64'),
            branch: GITHUB_BRANCH,
            sha,
        }),
    });

    if (!res.ok) throw new Error('Failed to write data to GitHub');
    return true;
}

// ---------------- Rate Limiting ----------------
function checkRateLimit(ip) {
    const now = Date.now();
    const attempts = rateLimitMap.get(ip) || [];
    const recentAttempts = attempts.filter(time => now - time < RATE_LIMIT_WINDOW);

    if (recentAttempts.length >= MAX_ATTEMPTS) return false;

    recentAttempts.push(now);
    rateLimitMap.set(ip, recentAttempts);
    return true;
}

// ---------------- Session Helpers ----------------
function generateSessionToken() {
    return crypto.randomBytes(32).toString('hex');
}

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

setInterval(() => {
    const now = Date.now();
    for (const [token, session] of activeSessions.entries()) {
        if (now - session.createdAt > SESSION_TIMEOUT) {
            activeSessions.delete(token);
        }
    }
}, 5 * 60 * 1000);

// ---------------- API Routes ----------------

// Get funds
app.get('/api/funds', async (req, res) => {
    try {
        const data = await readFunds();
        res.json(data);
    } catch (error) {
        console.error('Error loading funds:', error);
        res.status(500).json({ error: 'Failed to read funds' });
    }
});

// Update funds
app.post('/api/funds', async (req, res) => {
    try {
        const { sessionToken, data } = req.body;

        if (!verifySession(sessionToken)) {
            return res.status(401).json({ error: 'Unauthorized - Invalid or expired session' });
        }

        // Optional: Validate data here (same as your old checks)
        await writeFunds(data);
        res.json({ success: true, message: 'Funds updated successfully' });
    } catch (error) {
        console.error('Update error:', error);
        res.status(500).json({ error: 'Failed to update funds' });
    }
});

// Admin login
app.post('/api/admin/login', async (req, res) => {
    const { adminKey } = req.body;
    const clientIp = req.ip || req.connection.remoteAddress;

    if (!checkRateLimit(clientIp)) {
        return res.status(429).json({ error: 'Too many login attempts' });
    }

    if (adminKey !== ADMIN_KEY) {
        console.log(`Failed login attempt from ${clientIp}`);
        return res.status(401).json({ error: 'Invalid admin key' });
    }

    const sessionToken = generateSessionToken();
    activeSessions.set(sessionToken, { createdAt: Date.now(), ip: clientIp });
    console.log(`✓ Admin logged in from ${clientIp} - Session: ${sessionToken.substring(0, 8)}...`);

    res.json({ success: true, sessionToken, expiresIn: SESSION_TIMEOUT });
});

// Verify session
app.post('/api/admin/verify', (req, res) => {
    const { sessionToken } = req.body;
    if (verifySession(sessionToken)) res.json({ valid: true });
    else res.status(401).json({ valid: false });
});

// Admin logout
app.post('/api/admin/logout', (req, res) => {
    const { sessionToken } = req.body;
    if (sessionToken) activeSessions.delete(sessionToken);
    res.json({ success: true });
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString(), activeSessions: activeSessions.size });
});

// Serve index
app.get('/', (req, res) => {
    res.sendFile(require('path').join(__dirname, 'public', 'index.html'));
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT} ✅`);
});
