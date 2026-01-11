const API_URL = '/api';

let isAdmin = false;
let editMode = false;
let fundsData = {};
let sessionToken = null;

setTimeout(() => {
    document.getElementById('loading-screen').style.display = 'none';
    document.getElementById('main-content').style.display = 'block';
    loadFunds();
}, 3000);

async function loadFunds() {
    try {
        const response = await fetch(`${API_URL}/funds`);
        const data = await response.json();
        fundsData = data;
        renderFunds();
    } catch (error) {
        console.error('Error loading funds:', error);
        fundsData = getDefaultFunds();
        renderFunds();
    }
}

async function saveFunds() {
    if (!isAdmin || !sessionToken) {
        console.error('Cannot save: not authenticated');
        return;
    }
    
    try {
        const response = await fetch(`${API_URL}/funds`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                sessionToken: sessionToken,
                data: fundsData
            })
        });
        
        if (response.ok) {
            showNotification('Funds saved successfully!', 'success');
        } else if (response.status === 401) {
            showNotification('Session expired. Please login again.', 'error');
            handleSessionExpired();
        } else {
            showNotification('Failed to save funds', 'error');
        }
    } catch (error) {
        console.error('Error saving funds:', error);
        showNotification('Error saving funds', 'error');
    }
}

function handleSessionExpired() {
    isAdmin = false;
    sessionToken = null;
    sessionStorage.removeItem('sessionToken');
    document.getElementById('edit-mode-btn').style.display = 'none';
    
    if (editMode) {
        toggleEditMode();
    }
}

function showNotification(message, type) {
    alert(message);
}

function getDefaultFunds() {
    return {
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
}

function renderFunds() {
    const container = document.getElementById('funds-container');
    container.innerHTML = '';

    const funds = fundsData.funds || getDefaultFunds().funds;
    
    Object.keys(funds).forEach(key => {
        const fund = funds[key];
        const card = createFundCard(key, fund);
        container.appendChild(card);
    });

    updateTotals();
}

function createFundCard(key, fund) {
    const card = document.createElement('div');
    card.className = 'fund-card';

    const header = document.createElement('div');
    header.className = 'fund-card-header';

    const title = document.createElement('h3');
    title.className = 'gangster-font-alt';
    title.textContent = fund.title;
    header.appendChild(title);

    if (editMode) {
        const addBtn = document.createElement('button');
        addBtn.className = 'btn-add';
        addBtn.innerHTML = '<i class="fas fa-plus"></i> ADD MEMBER';
        addBtn.onclick = () => addMember(key);
        header.appendChild(addBtn);
    }

    card.appendChild(header);

    const membersContainer = document.createElement('div');
    fund.members.forEach((member, idx) => {
        const row = createMemberRow(key, member, idx);
        membersContainer.appendChild(row);
    });
    card.appendChild(membersContainer);

    const total = document.createElement('div');
    total.className = 'fund-total';
    total.innerHTML = `
        <span class="gangster-font-alt">TOTAL:</span>
        <span class="gangster-font">₱${calculateTotal(fund.members)}</span>
    `;
    card.appendChild(total);

    return card;
}

function createMemberRow(fundKey, member, idx) {
    const row = document.createElement('div');
    row.className = 'member-row';

    const name = document.createElement('span');
    name.className = 'member-name';
    name.textContent = member.name;
    row.appendChild(name);

    const controls = document.createElement('div');
    controls.className = 'member-controls';

    if (editMode) {
        const input = document.createElement('input');
        input.type = 'number';
        input.className = 'member-input';
        input.value = member.amount;
        input.onchange = (e) => updateMemberAmount(fundKey, idx, e.target.value);
        input.setAttribute('inputmode', 'numeric');
        input.setAttribute('pattern', '[0-9]*');
        controls.appendChild(input);

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'btn-delete';
        deleteBtn.innerHTML = '<i class="fas fa-trash-alt"></i>';
        deleteBtn.onclick = () => removeMember(fundKey, idx);
        controls.appendChild(deleteBtn);
    } else {
        const amount = document.createElement('span');
        amount.className = 'member-amount';
        amount.textContent = `₱${member.amount}`;
        controls.appendChild(amount);
    }

    row.appendChild(controls);

    return row;
}

function calculateTotal(members) {
    return members.reduce((sum, m) => sum + (parseFloat(m.amount) || 0), 0);
}

function updateTotals() {
    const funds = fundsData.funds || getDefaultFunds().funds;
    const overallTotal = Object.values(funds).reduce((sum, fund) => {
        return sum + calculateTotal(fund.members);
    }, 0);

    document.getElementById('overall-total').textContent = `₱${overallTotal}`;

    const summary = fundsData.summary || { pman: 730, hawak: 375 };
    document.getElementById('pman-display').textContent = `₱${summary.pman}`;
    document.getElementById('hawak-display').textContent = `₱${summary.hawak}`;
    document.getElementById('pman-input').value = summary.pman;
    document.getElementById('hawak-input').value = summary.hawak;
}

function addMember(fundKey) {
    const name = prompt('Enter member name:');
    if (name && name.trim()) {
        if (!fundsData.funds) fundsData = getDefaultFunds();
        fundsData.funds[fundKey].members.push({ name: name.trim(), amount: 0 });
        renderFunds();
        saveFunds();
    }
}

function removeMember(fundKey, idx) {
    if (confirm('Remove this member?')) {
        if (!fundsData.funds) fundsData = getDefaultFunds();
        fundsData.funds[fundKey].members.splice(idx, 1);
        renderFunds();
        saveFunds();
    }
}

function updateMemberAmount(fundKey, idx, value) {
    if (!fundsData.funds) fundsData = getDefaultFunds();
    fundsData.funds[fundKey].members[idx].amount = parseFloat(value) || 0;
    updateTotals();
    saveFunds();
}

function toggleEditMode() {
    if (!isAdmin) return;
    
    editMode = !editMode;
    
    const editIcon = document.getElementById('edit-icon');
    const editText = document.getElementById('edit-text');
    
    if (editMode) {
        editIcon.className = 'fas fa-times';
        editText.textContent = 'DONE';
        document.getElementById('pman-display').classList.add('hidden');
        document.getElementById('hawak-display').classList.add('hidden');
        document.getElementById('pman-input').classList.remove('hidden');
        document.getElementById('hawak-input').classList.remove('hidden');
        
        const pmanInput = document.getElementById('pman-input');
        const hawakInput = document.getElementById('hawak-input');
        
        pmanInput.setAttribute('inputmode', 'numeric');
        pmanInput.setAttribute('pattern', '[0-9]*');
        hawakInput.setAttribute('inputmode', 'numeric');
        hawakInput.setAttribute('pattern', '[0-9]*');
        
        pmanInput.onchange = (e) => {
            if (!fundsData.summary) fundsData.summary = { pman: 730, hawak: 375 };
            fundsData.summary.pman = parseFloat(e.target.value) || 0;
            updateTotals();
            saveFunds();
        };
        
        hawakInput.onchange = (e) => {
            if (!fundsData.summary) fundsData.summary = { pman: 730, hawak: 375 };
            fundsData.summary.hawak = parseFloat(e.target.value) || 0;
            updateTotals();
            saveFunds();
        };
    } else {
        editIcon.className = 'fas fa-pen';
        editText.textContent = 'EDIT';
        document.getElementById('pman-display').classList.remove('hidden');
        document.getElementById('hawak-display').classList.remove('hidden');
        document.getElementById('pman-input').classList.add('hidden');
        document.getElementById('hawak-input').classList.add('hidden');
    }
    
    renderFunds();
}

function showFunds() {
    document.getElementById('intro-section').style.display = 'none';
    document.getElementById('funds-section').style.display = 'block';
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function showIntro() {
    document.getElementById('intro-section').style.display = 'block';
    document.getElementById('funds-section').style.display = 'none';
    editMode = false;
    renderFunds();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function showAdminModal() {
    document.getElementById('admin-modal').style.display = 'flex';
    setTimeout(() => {
        document.getElementById('admin-key-input').focus();
    }, 300);
}

function closeAdminModal() {
    document.getElementById('admin-modal').style.display = 'none';
    document.getElementById('admin-key-input').value = '';
}

async function adminLogin() {
    const key = document.getElementById('admin-key-input').value;
    
    if (!key || !key.trim()) {
        alert('Please enter an admin key');
        return;
    }
    
    try {
        const response = await fetch(`${API_URL}/admin/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ adminKey: key })
        });
        
        const data = await response.json();
        
        if (response.ok && data.sessionToken) {
            isAdmin = true;
            sessionToken = data.sessionToken;
            sessionStorage.setItem('sessionToken', sessionToken);
            document.getElementById('edit-mode-btn').style.display = 'flex';
            closeAdminModal();
            alert('Admin access granted! Session expires in ' + (data.expiresIn / 60000) + ' minutes.');
            
            setTimeout(() => {
                if (isAdmin) {
                    alert('Your session will expire in 5 minutes. Save your work!');
                }
            }, data.expiresIn - 5 * 60000);
        } else {
            alert(data.error || 'Invalid admin key');
            document.getElementById('admin-key-input').value = '';
            document.getElementById('admin-key-input').focus();
        }
    } catch (error) {
        console.error('Error during login:', error);
        alert('Error connecting to server');
    }
}

async function adminLogout() {
    if (!sessionToken) return;
    
    try {
        await fetch(`${API_URL}/admin/logout`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ sessionToken })
        });
    } catch (error) {
        console.error('Logout error:', error);
    }
    
    handleSessionExpired();
    alert('Logged out successfully');
}

document.addEventListener('DOMContentLoaded', () => {
    const adminInput = document.getElementById('admin-key-input');
    if (adminInput) {
        adminInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                adminLogin();
            }
        });
    }
});

window.addEventListener('load', () => {
    const savedToken = sessionStorage.getItem('sessionToken');
    if (savedToken) {
        fetch(`${API_URL}/admin/verify`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ sessionToken: savedToken })
        })
        .then(response => response.json())
        .then(data => {
            if (data.valid) {
                isAdmin = true;
                sessionToken = savedToken;
                document.getElementById('edit-mode-btn').style.display = 'flex';
            } else {
                sessionStorage.removeItem('sessionToken');
            }
        })
        .catch(error => {
            console.error('Error checking session:', error);
            sessionStorage.removeItem('sessionToken');
        });
    }
});

document.addEventListener('touchstart', () => {}, { passive: true });

window.addEventListener('online', () => {
    console.log('Connection restored');
    loadFunds();
});

window.addEventListener('offline', () => {
    console.log('Connection lost - working offline');
});

window.addEventListener('beforeunload', (e) => {
    if (editMode) {
        e.preventDefault();
        e.returnValue = 'You are in edit mode. Are you sure you want to leave?';
        return e.returnValue;
    }
});
