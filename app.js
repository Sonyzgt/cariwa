// Elements
const regionSelector = document.getElementById('regionSelector');
const singleNumberContainer = document.getElementById('singleNumberContainer');
const loadingState = document.getElementById('loadingState');
const statsDisplay = document.querySelector('.stats'); // Added in placeholder if needed, let's keep it for db info

// State
let currentDb = '';
let currentRegion = ''; // Selected region code
let availableDbs = [];
let availableRegions = [];
let currentNumberData = null;

// Initialize
async function init() {
    try {
        const response = await fetch('/api/databases');
        availableDbs = await response.json();
        
        if (availableDbs.length > 0) {
            currentDb = availableDbs[0];
            await fetchRegions(); // Load regions for this database
            fetchRandomNumber();
        } else {
            singleNumberContainer.innerHTML = '<p class="error">Tidak ada database ditemukan.</p>';
        }
    } catch (error) {
        console.error('Failed to init:', error);
        singleNumberContainer.innerHTML = '<p class="error">Gagal memuat database.</p>';
    }
}

async function fetchRegions() {
    try {
        const res = await fetch(`/api/regions?db=${encodeURIComponent(currentDb)}`);
        availableRegions = await res.json();
        
        if (availableRegions.length > 1) {
            renderRegions();
            regionSelector.classList.remove('hidden');
        } else {
            regionSelector.classList.add('hidden');
            currentRegion = availableRegions.length > 0 ? availableRegions[0].code : '';
        }
    } catch (err) {
        console.error('Failed to fetch regions:', err);
    }
}

function renderRegions() {
    regionSelector.innerHTML = '';
    
    // Optional: Add "All" or "Global" or just use the detected countries
    availableRegions.forEach(region => {
        const btn = document.createElement('button');
        btn.className = `region-pill ${currentRegion === region.code ? 'active' : ''}`;
        btn.innerHTML = `
            <span class="region-flag">${region.flag}</span>
            <span class="region-name">${region.name}</span>
            <span class="region-count">${region.count}</span>
        `;
        
        btn.onclick = () => {
            if (currentRegion === region.code) return;
            currentRegion = region.code;
            document.querySelectorAll('.region-pill').forEach(p => p.classList.remove('active'));
            btn.classList.add('active');
            btn.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
            fetchRandomNumber();
        };
        
        regionSelector.appendChild(btn);
    });
    
    // Set default if not set
    if (!currentRegion && availableRegions.length > 0) {
        currentRegion = availableRegions[0].code;
        const firstPill = regionSelector.querySelector('.region-pill');
        if (firstPill) {
            firstPill.classList.add('active');
            // Small timeout to ensure rendering is complete
            setTimeout(() => firstPill.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' }), 100);
        }
    }
}

async function fetchRandomNumber() {
    singleNumberContainer.classList.add('hidden');
    loadingState.classList.remove('hidden');
    
    try {
        let url = `/api/random?db=${encodeURIComponent(currentDb)}`;
        if (currentRegion) {
            url += `&region=${encodeURIComponent(currentRegion)}`;
        }
        
        const res = await fetch(url);
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
            <div class="big-info">
                <div class="big-number">${data.original}</div>
            </div>
            <div class="card-big-actions">
                <button class="big-action-btn btn-copy" onclick="copyToClipboard('${data.original}', this)">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                    COPY NUMBER
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
            btn.disabled = false;
            btn.innerHTML = originalHTML;
        }
    } catch (err) {
        console.error(err);
        alert('Gagal menghubungi server.');
        btn.disabled = false;
        btn.innerHTML = originalHTML;
    }
}


async function copyToClipboard(text, btn) {
    const prefixedText = text.startsWith('+') ? text : '+' + text;
    try {
        await navigator.clipboard.writeText(prefixedText);
        const originalHTML = btn.innerHTML;
        btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg> COPIED!`;
        btn.classList.add('success');
        setTimeout(() => {
            btn.innerHTML = originalHTML;
            btn.classList.remove('success');
        }, 2000);
    } catch (err) {
        console.error('Failed to copy!', err);
    }
}

// Global exposure for onclick handlers
window.changeNumber = changeNumber;
window.copyToClipboard = copyToClipboard;

// Start
init();
