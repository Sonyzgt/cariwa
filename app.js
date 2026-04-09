// Elements
const dbTabsContainer = document.getElementById('dbTabs');
const singleNumberContainer = document.getElementById('singleNumberContainer');
const loadingState = document.getElementById('loadingState');
const statsDisplay = document.querySelector('.stats'); // Added in placeholder if needed, let's keep it for db info

// State
let currentDb = '';
let availableDbs = [];
let currentNumberData = null;

// Initialize
async function init() {
    try {
        const response = await fetch('/api/databases');
        availableDbs = await response.json();
        
        if (availableDbs.length > 0) {
            currentDb = availableDbs[0];
            renderTabs();
            fetchRandomNumber();
        } else {
            singleNumberContainer.innerHTML = '<p class="error">Tidak ada database ditemukan.</p>';
        }
    } catch (error) {
        console.error('Failed to init:', error);
        singleNumberContainer.innerHTML = '<p class="error">Gagal memuat database.</p>';
    }
}

function formatDbName(name) {
    return name.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

function renderTabs() {
    dbTabsContainer.innerHTML = '';
    availableDbs.forEach(db => {
        const btn = document.createElement('button');
        btn.className = `db-tab ${db === currentDb ? 'active' : ''}`;
        btn.textContent = formatDbName(db);
        btn.onclick = () => {
            if (currentDb === db) return;
            currentDb = db;
            document.querySelectorAll('.db-tab').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            fetchRandomNumber();
        };
        dbTabsContainer.appendChild(btn);
    });
}

async function fetchRandomNumber() {
    singleNumberContainer.classList.add('hidden');
    loadingState.classList.remove('hidden');
    
    try {
        const res = await fetch(`/api/random?db=${encodeURIComponent(currentDb)}`);
        const result = await res.json();
        
        if (result.success) {
            currentNumberData = result.data;
            renderNumberCard(result.data);
        } else {
            singleNumberContainer.innerHTML = `<div class="error-msg">${result.error || 'Gagal mengambil nomor.'}</div>`;
            singleNumberContainer.classList.remove('hidden');
        }
    } catch (err) {
        console.error(err);
        singleNumberContainer.innerHTML = '<div class="error-msg">Terjadi kesalahan pada server.</div>';
        singleNumberContainer.classList.remove('hidden');
    } finally {
        loadingState.classList.add('hidden');
    }
}

function renderNumberCard(data) {
    singleNumberContainer.innerHTML = `
        <div class="big-number-card">
            <div class="big-flag-container">
                <div class="big-flag">${data.flag}</div>
            </div>
            <div class="big-info">
                <div class="big-country">${data.countryName}</div>
                <div class="big-number">${data.original}</div>
            </div>
            <div class="card-big-actions">
                <button class="big-action-btn btn-restore" onclick="sendRestoration('${data.original}', this)">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>
                    RESTORE ACCOUNT
                </button>
                <button class="big-action-btn btn-change" onclick="changeNumber(this)">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 0 1-9 9m9-9a9 9 0 0 0-9-9m9 9H3m9 9a9 9 0 0 1-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9"></path></svg>
                    CHANGE NUMBER
                </button>
            </div>
        </div>
    `;
    singleNumberContainer.classList.remove('hidden');
}

async function changeNumber(btn) {
    if (!currentNumberData || btn.disabled) return;
    
    btn.disabled = true;
    const originalHTML = btn.innerHTML;
    btn.innerHTML = `<span class="spinner-small"></span> Deleting...`;
    
    try {
        const res = await fetch('/api/delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                db: currentDb,
                number: currentNumberData.original
            })
        });
        
        const result = await res.json();
        if (result.success) {
            // Successfully deleted, now get a new one
            fetchRandomNumber();
        } else {
            alert('Gagal menghapus nomor: ' + (result.error || 'Unknown error'));
            changeBtn.disabled = false;
            changeBtn.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 0 1-9 9m9-9a9 9 0 0 0-9-9m9 9H3m9 9a9 9 0 0 1-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9"></path></svg>
                Change Number
            `;
        }
    } catch (err) {
        console.error(err);
        alert('Gagal menghubungi server.');
        changeBtn.disabled = false;
        changeBtn.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 0 1-9 9m9-9a9 9 0 0 0-9-9m9 9H3m9 9a9 9 0 0 1-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9"></path></svg>
            Change Number
        `;
    }
}

async function sendRestoration(number, btn) {
    if (btn.classList.contains('loading')) return;
    
    btn.classList.add('loading');
    const originalLabel = btn.innerHTML;
    btn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="2" x2="12" y2="6"></line><line x1="12" y1="18" x2="12" y2="22"></line><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line><line x1="2" y1="12" x2="6" y2="12"></line><line x1="18" y1="12" x2="22" y2="12"></line><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line></svg>
        Sending...
    `;
    
    try {
        const res = await fetch(`/api/send-email?number=${encodeURIComponent(number)}`);
        const data = await res.json();
        
        if (data.success) {
            btn.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                Email Sent!
            `;
            setTimeout(() => {
                btn.classList.remove('loading');
                btn.innerHTML = originalLabel;
            }, 3000);
        } else {
            alert('Gagal mengirim email: ' + (data.error || 'Unknown error'));
            btn.classList.remove('loading');
            btn.innerHTML = originalLabel;
        }
    } catch (err) {
        console.error(err);
        alert('Gagal menghubungi server.');
        btn.classList.remove('loading');
        btn.innerHTML = originalLabel;
    }
}

// Global exposure for onclick handlers
window.changeNumber = changeNumber;
window.sendRestoration = sendRestoration;

// Start
init();
