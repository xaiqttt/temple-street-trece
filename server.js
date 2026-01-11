const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const fetch = require('node-fetch');

const app = express();
const PORT = process.env.PORT || 3000;

// SECURITY: Admin key should be in environment variable for production
const ADMIN_KEY = process.env.ADMIN_KEY || 'TST13ADMIN2025';

// GitHub storage config
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_REPO = process.env.GITHUB_REPO; // e.g., xaiqttt/temple-street-trece
const GITHUB_FILE_PATH = process.env.GITHUB_FILE_PATH || 'data/funds.json';
const GITHUB_BRANCH = process.env.GITHUB_BRANCH || 'main';

// Store active admin sessions
const activeSessions = new Map();
const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Rate limiting
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const MAX_ATTEMPTS = 5;
function checkRateLimit(ip) {
    const now = Date.now();
    const attempts = rateLimitMap.get(ip) || [];
    const recent = attempts.filter(time => now - time < RATE_LIMIT_WINDOW);
    if (recent.length >= MAX_ATTEMPTS) return false;
    recent.push(now);
    rateLimitMap.set(ip, recent);
    return true;
}

// Session functions
function generateSessionToken() {
    return crypto.randomBytes(32).toString('hex');
}
function verifySession(token) {
    if (!token) return false;
    const session = activeSessions.get(token);
    if (!session) return false;
    if (Date.now() - session.createdAt > SESSION_TIMEOUT) {
        activeSessions.delete(token);
        return false;
    }
    return true;
}
setInterval(() => {
    const now = Date.now();
    for (const [token, session] of activeSessions.entries()) {
        if (now - session.createdAt > SESSION_TIMEOUT) activeSessions.delete(token);
    }
}, 5 * 60 * 1000);

// GitHub API helpers
async function getFundsFromGitHub() {
    const url = `https://api.github.com/repos/${GITHUB_REPO}/contents/${GITHUB_FILE_PATH}?ref=${GITHUB_BRANCH}`;
    const res = await fetch(url, {
        headers: { Authorization: `token ${GITHUB_TOKEN}` }
    });
    if (!res.ok) throw new Error('Failed to fetch funds from GitHub');
    const json = await res.json();
    const content = Buffer.from(json.content, 'base64').toString('utf-8');
    return { data: JSON.parse(content), sha: json.sha };
}

async function saveFundsToGitHub(data, sha) {
    const url = `https://api.github.com/repos/${GITHUB_REPO}/contents/${GITHUB_FILE_PATH}`;
    const body = {
        message: 'Update funds via admin panel',
        content: Buffer.from(JSON.stringify(data, null, 2)).toString('base64'),
        branch: GITHUB_BRANCH,
        sha
    };
    const res = await fetch(url, {
        method: 'PUT',
        headers: {
            Authorization: `token ${GITHUB_TOKEN}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
    });
    if (!res.ok) throw new Error('Failed to save funds to GitHub');
    return res.json();
}

// API Routes
app.get('/api/funds', async (req, res) => {
    try {
        const { data } = await getFundsFromGitHub();
        res.json(data);
    } catch (error) {
        console.error('Error reading funds:', error);
        res.status(500).json({ error: 'Failed to read funds data' });
    }
});

app.post('/api/funds', async (req, res) => {
    try {
        const { sessionToken, data } = req.body;
        if (!verifySession(sessionToken)) return res.status(401).json({ error: 'Unauthorized' });

        if (!data || !data.funds || !data.summary) {
            return res.status(400).json({ error: 'Invalid data structure' });
        }

        // Fetch current SHA from GitHub
        const { sha: currentSha } = await getFundsFromGitHub();
        await saveFundsToGitHub(data, currentSha);

        res.json({ success: true, message: 'Funds updated successfully' });
    } catch (error) {
        console.error('Error writing funds:', error);
        res.status(500).json({ error: 'Failed to update funds' });
    }
});

// Admin login
app.post('/api/admin/login', (req, res) => {
    try {
        const { adminKey } = req.body;
        const clientIp = req.ip || req.connection.remoteAddress;
        if (!checkRateLimit(clientIp)) return res.status(429).json({ error: 'Too many login attempts' });
        if (adminKey !== ADMIN_KEY) return res.status(401).json({ error: 'Invalid admin key' });

        const sessionToken = generateSessionToken();
        activeSessions.set(sessionToken, { createdAt: Date.now(), ip: clientIp });

        res.json({ success: true, sessionToken, expiresIn: SESSION_TIMEOUT });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Login failed' });
    }
});

// Verify session
app.post('/api/admin/verify', (req, res) => {
    try {
        const { sessionToken } = req.body;
        res.json({ valid: verifySession(sessionToken) });
    } catch (error) {
        res.status(500).json({ error: 'Verification failed' });
    }
});

// Admin logout
app.post('/api/admin/logout', (req, res) => {
    try {
        const { sessionToken } = req.body;
        if (sessionToken) activeSessions.delete(sessionToken);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Logout failed' });
    }
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString(), activeSessions: activeSessions.size });
});

// Serve frontend
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/public/index.html');
});

app.listen(PORT, () => {
    console.log(`Temple Street Trece server running on port ${PORT}`);
});
