// Configuration
const API_URL = 'http://localhost:3000/api';
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

// State
let currentYear = new Date().getFullYear();
let currentMonth = null;
let members = {};
let payments = [];

// ==================== INITIALIZATION ====================

document.addEventListener('DOMContentLoaded', () => {
    // Show intro screen
    setTimeout(() => {
        document.getElementById('intro-screen').style.display = 'none';
        document.getElementById('main-app').style.display = 'flex';
        initApp();
    }, 4000);
});

async function initApp() {
    setupEventListeners();
    await loadMembers();
    renderCalendar();
}

// ==================== EVENT LISTENERS ====================

function setupEventListeners() {
    // Menu toggle
    document.getElementById('menu-btn').addEventListener('click', () => {
        document.getElementById('nav-menu').classList.add('active');
    });
    
    document.getElementById('nav-close').addEventListener('click', () => {
        document.getElementById('nav-menu').classList.remove('active');
    });
    
    // Navigation
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', (e) => {
            const view = e.currentTarget.dataset.view;
            switchView(view);
            document.getElementById('nav-menu').classList.remove('active');
        });
    });
    
    // Year navigation
    document.getElementById('prev-year').addEventListener('click', () => {
        currentYear--;
        document.getElementById('current-year').textContent = currentYear;
        renderCalendar();
    });
    
    document.getElementById('next-year').addEventListener('click', () => {
        currentYear++;
        document.getElementById('current-year').textContent = currentYear;
        renderCalendar();
    });
    
    // Back to calendar
    document.getElementById('back-to-calendar').addEventListener('click', () => {
        switchView('calendar');
    });
}

function switchView(viewName) {
    // Update navigation
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.toggle('active', item.dataset.view === viewName);
    });
    
    // Update views
    document.querySelectorAll('.view').forEach(view => {
        view.classList.remove('active');
    });
    
    document.getElementById(`${viewName}-view`).classList.add('active');
    
    // Load view data
    if (viewName === 'members') {
        renderMembers();
    } else if (viewName === 'stats') {
        loadStats();
    }
}

// ==================== API CALLS ====================

async function apiCall(endpoint, options = {}) {
    try {
        showLoading();
        const response = await fetch(`${API_URL}${endpoint}`, {
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
            ...options
        });
        
        if (!response.ok) {
            throw new Error(`API error: ${response.statusText}`);
        }
        
        return await response.json();
    } catch (error) {
        console.error('API call failed:', error);
        alert('Connection error. Please check if the backend server is running.');
        return null;
    } finally {
        hideLoading();
    }
}

async function loadMembers() {
    const data = await apiCall('/members');
    if (data) {
        members = data;
    }
}

async function loadPayments(year, month) {
    const data = await apiCall(`/payments/${year}/${month}`);
    if (data) {
        payments = data;
        return data;
    }
    return [];
}

async function loadStats() {
    const data = await apiCall('/stats');
    if (data) {
        renderStats(data);
    }
}

async function initializeMonth(year, month) {
    await apiCall('/payments/initialize', {
        method: 'POST',
        body: JSON.stringify({ year, month })
    });
}

// ==================== CALENDAR RENDERING ====================

function renderCalendar() {
    const grid = document.getElementById('calendar-grid');
    grid.innerHTML = '';
    
    MONTHS.forEach((monthName, index) => {
        const monthCard = createMonthCard(monthName, index + 1);
        grid.appendChild(monthCard);
    });
}

function createMonthCard(monthName, monthNumber) {
    const card = document.createElement('div');
    card.className = 'calendar-month';
    card.innerHTML = `
        <div class="month-name">${monthName}</div>
        <div class="month-status">
            <div class="status-item">
                <span class="material-icons status-icon">schedule</span>
                <span>Due: ${monthNumber}/15/${currentYear}</span>
            </div>
        </div>
    `;
    
    card.addEventListener('click', () => {
        openMonth(currentYear, monthNumber, monthName);
    });
    
    return card;
}

async function openMonth(year, month, monthName) {
    currentMonth = { year, month, name: monthName };
    
    // Initialize payments for this month if needed
    await initializeMonth(year, month);
    
    // Load payment data
    const paymentData = await loadPayments(year, month);
    
    // Update title
    document.getElementById('month-title').textContent = `${monthName} ${year}`;
    
    // Render summary
    renderMonthSummary(paymentData);
    
    // Render payment list
    renderPaymentList(paymentData);
    
    // Switch to month view
    switchView('month');
}

function renderMonthSummary(paymentData) {
    const container = document.getElementById('month-summary');
    
    let northsidePaid = 0;
    let northsideTotal = 0;
    let laPaid = 0;
    let laTotal = 0;
    
    paymentData.forEach(p => {
        if (p.northside_paid) northsidePaid += p.northside_amount || 0;
        northsideTotal += p.northside_amount || 0;
        
        if (p.la_paid) laPaid += p.la_amount || 0;
        laTotal += p.la_amount || 0;
    });
    
    container.innerHTML = `
        <div class="summary-card">
            <div class="summary-label">Northside Fund</div>
            <div class="summary-value success">₱${northsidePaid.toFixed(2)}</div>
            <div class="summary-label" style="margin-top: 4px;">of ₱${northsideTotal.toFixed(2)}</div>
        </div>
        <div class="summary-card">
            <div class="summary-label">L.A Fund</div>
            <div class="summary-value success">₱${laPaid.toFixed(2)}</div>
            <div class="summary-label" style="margin-top: 4px;">of ₱${laTotal.toFixed(2)}</div>
        </div>
    `;
}

function renderPaymentList(paymentData) {
    const container = document.getElementById('payment-list');
    container.innerHTML = '';
    
    const rankOrder = ['ALAS', 'POINTMAN', 'JUNIOR', 'MINORS'];
    
    rankOrder.forEach(rank => {
        const rankMembers = paymentData.filter(p => p.rank === rank);
        if (rankMembers.length === 0) return;
        
        const section = createRankSection(rank, rankMembers);
        container.appendChild(section);
    });
}

function createRankSection(rank, rankMembers) {
    const section = document.createElement('div');
    section.className = 'rank-section';
    
    const header = document.createElement('div');
    header.className = 'rank-header';
    header.innerHTML = `
        <span class="rank-title">${rank}</span>
        <span class="rank-count">${rankMembers.length} members</span>
    `;
    
    const membersContainer = document.createElement('div');
    membersContainer.className = 'rank-members expanded';
    
    rankMembers.forEach(member => {
        const item = createPaymentItem(member);
        membersContainer.appendChild(item);
    });
    
    header.addEventListener('click', () => {
        membersContainer.classList.toggle('expanded');
    });
    
    section.appendChild(header);
    section.appendChild(membersContainer);
    
    return section;
}

function createPaymentItem(payment) {
    const item = document.createElement('div');
    item.className = 'payment-item';
    
    const northsideStatus = payment.northside_paid ? 'paid' : 'unpaid';
    const laStatus = payment.la_paid ? 'paid' : 'unpaid';
    
    item.innerHTML = `
        <div class="payment-header">
            <span class="member-name">${payment.name}</span>
        </div>
        <div class="payment-funds">
            <div class="fund-item">
                <div class="fund-label">Northside Fund</div>
                <div class="fund-status">
                    <span class="fund-amount">₱${(payment.northside_amount || 0).toFixed(2)}</span>
                    <span class="status-badge ${northsideStatus}">${northsideStatus}</span>
                </div>
            </div>
            <div class="fund-item">
                <div class="fund-label">L.A Fund</div>
                <div class="fund-status">
                    <span class="fund-amount">₱${(payment.la_amount || 0).toFixed(2)}</span>
                    <span class="status-badge ${laStatus}">${laStatus}</span>
                </div>
            </div>
        </div>
    `;
    
    return item;
}

// ==================== MEMBERS VIEW ====================

function renderMembers() {
    const container = document.getElementById('members-container');
    container.innerHTML = '';
    
    const rankOrder = ['ALAS', 'POINTMAN', 'JUNIOR', 'MINORS'];
    
    rankOrder.forEach(rank => {
        if (!members[rank] || members[rank].length === 0) return;
        
        const section = document.createElement('div');
        section.className = 'rank-section';
        
        const header = document.createElement('div');
        header.className = 'rank-header';
        header.innerHTML = `
            <span class="rank-title">${rank}</span>
            <span class="rank-count">${members[rank].length} members</span>
        `;
        
        const membersContainer = document.createElement('div');
        membersContainer.className = 'rank-members expanded';
        
        members[rank].forEach(member => {
            const card = createMemberCard(member);
            membersContainer.appendChild(card);
        });
        
        header.addEventListener('click', () => {
            membersContainer.classList.toggle('expanded');
        });
        
        section.appendChild(header);
        section.appendChild(membersContainer);
        container.appendChild(section);
    });
}

function createMemberCard(member) {
    const card = document.createElement('div');
    card.className = 'member-card';
    
    const initial = member.name.charAt(0);
    
    card.innerHTML = `
        <div class="member-avatar">${initial}</div>
        <div class="member-info">
            <div class="member-name">${member.name}</div>
            <div class="member-rank">${member.rank}</div>
        </div>
    `;
    
    return card;
}

// ==================== STATS VIEW ====================

function renderStats(data) {
    const container = document.getElementById('stats-container');
    container.innerHTML = '';
    
    // Member count by rank
    const memberCard = document.createElement('div');
    memberCard.className = 'stat-card';
    memberCard.innerHTML = `
        <div class="stat-title">Members by Rank</div>
        <div class="stat-grid">
            ${data.membersByRank.map(r => `
                <div class="stat-item">
                    <div class="stat-label">${r.rank}</div>
                    <div class="stat-value">${r.count}</div>
                </div>
            `).join('')}
        </div>
    `;
    container.appendChild(memberCard);
    
    // Year totals
    const totalsCard = document.createElement('div');
    totalsCard.className = 'stat-card';
    totalsCard.innerHTML = `
        <div class="stat-title">${currentYear} Collections</div>
        <div class="stat-grid">
            <div class="stat-item">
                <div class="stat-label">Northside Fund</div>
                <div class="stat-value">₱${(data.yearTotals.northside_year_total || 0).toFixed(2)}</div>
            </div>
            <div class="stat-item">
                <div class="stat-label">L.A Fund</div>
                <div class="stat-value">₱${(data.yearTotals.la_year_total || 0).toFixed(2)}</div>
            </div>
        </div>
    `;
    container.appendChild(totalsCard);
}

// ==================== UTILITIES ====================

function showLoading() {
    document.getElementById('loading').style.display = 'flex';
}

function hideLoading() {
    document.getElementById('loading').style.display = 'none';
}