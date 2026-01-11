const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch'); // npm install node-fetch@2
const crypto = require('crypto');

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
const SESSION_TIMEOUT = 30 * 60 * 1000;

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
    const recentAttempts = attempts.filter(time => now - time < RATE_LIMIT_WINDOW);

    if (recentAttempts.length >= MAX_ATTEMPTS) return false;

    recentAttempts.push(now);
    rateLimitMap.set(ip, recentAttempts);
    return true;
}

// Session functions
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

// Clean up expired sessions
setInterval(() => {
    const now = Date.now();
    for (const [token, session] of activeSessions.entries()) {
        if (now - session.createdAt > SESSION_TIMEOUT) {
            activeSessions.delete(token);
        }
    }
}, 5 * 60 * 1000);

// GitHub helper functions
async function readFunds() {
    const url = `https://api.github.com/repos/${GITHUB_REPO}/contents/${GITHUB_FILE_PATH}?ref=${GITHUB_BRANCH}`;
    const res = await fetch(url, {
        headers: { Authorization: `token ${GITHUB_TOKEN}` }
    });

    if (!res.ok) throw new Error('Failed to fetch from GitHub');
    const data = await res.json();
    const content = Buffer.from(data.content, 'base64').toString('utf-8');
    return JSON.parse(content);
}

async function writeFunds(data) {
    const url = `https://api.github.com/repos/${GITHUB_REPO}/contents/${GITHUB_FILE_PATH}`;
    // Get current SHA
    const res = await fetch(`${url}?ref=${GITHUB_BRANCH}`, {
        headers: { Authorization: `token ${GITHUB_TOKEN}` }
    });
    if (!res.ok) throw new Error('Failed to get file SHA from GitHub');
    const json = await res.json();
    const sha = json.sha;

    const body = {
        message: 'Update funds.json via server',
        content: Buffer.from(JSON.stringify(data, null, 2)).toString('base64'),
        branch: GITHUB_BRANCH,
        sha
    };

    const putRes = await fetch(url, {
        method: 'PUT',
        headers: {
            Authorization: `token ${GITHUB_TOKEN}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
    });

    if (!putRes.ok) throw new Error('Failed to write to GitHub');
    return true;
}

// Initialize default data if GitHub is empty
async function initializeData() {
    try {
        await readFunds();
    } catch {
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
        await writeFunds(defaultData);
        console.log('Default data initialized on GitHub');
    }
}

// API Routes
app.get('/api/funds', async (req, res) => {
    try {
        const data = await readFunds();
        res.json(data);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to read funds' });
    }
});

app.post('/api/funds', async (req, res) => {
    try {
        const { sessionToken, data } = req.body;
        if (!verifySession(sessionToken)) return res.status(401).json({ error: 'Unauthorized' });

        await writeFunds(data);
        res.json({ success: true });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to update funds' });
    }
});

app.post('/api/admin/login', async (req, res) => {
    const { adminKey } = req.body;
    const clientIp = req.ip || req.connection.remoteAddress;

    if (!checkRateLimit(clientIp)) return res.status(429).json({ error: 'Too many attempts' });

    if (adminKey !== ADMIN_KEY) return res.status(401).json({ error: 'Invalid admin key' });

    const sessionToken = generateSessionToken();
    activeSessions.set(sessionToken, { createdAt: Date.now(), ip: clientIp });
    res.json({ success: true, sessionToken, expiresIn: SESSION_TIMEOUT });
});

app.post('/api/admin/verify', async (req, res) => {
    const { sessionToken } = req.body;
    if (verifySession(sessionToken)) res.json({ valid: true });
    else res.status(401).json({ valid: false });
});

app.post('/api/admin/logout', async (req, res) => {
    const { sessionToken } = req.body;
    if (sessionToken) activeSessions.delete(sessionToken);
    res.json({ success: true });
});

app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date(), activeSessions: activeSessions.size });
});

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/public/index.html');
});

// Start server
initializeData().then(() => {
    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
}).catch(console.error);
