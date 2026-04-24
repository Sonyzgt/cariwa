// Elements
const regionSelector = document.getElementById('regionSelector');
const singleNumberContainer = document.getElementById('singleNumberContainer');
const batchNumberContainer = document.getElementById('batchNumberContainer');
const loadingState = document.getElementById('loadingState');
const loadingText = document.getElementById('loadingText');
const modeBtns = document.querySelectorAll('.mode-btn');

// State
let currentDb = '';
let currentRegion = ''; // Selected region code
let availableDbs = [];
let availableRegions = [];
let currentNumberData = null; // Can be single object or array
let currentMode = 1; // 1, 5, or 25

// Initialize
async function init() {
    setupModeSelector();
    try {
        const response = await fetch('/api/databases');
        availableDbs = await response.json();
        
        if (availableDbs.length > 0) {
            currentDb = availableDbs[0];
            await fetchRegions(); // Load regions for this database
            fetchNumbers();
        } else {
            singleNumberContainer.innerHTML = '<p class="error">Tidak ada database ditemukan.</p>';
        }
    } catch (error) {
        console.error('Failed to init:', error);
        singleNumberContainer.innerHTML = '<p class="error">Gagal memuat database.</p>';
    }
}

function setupModeSelector() {
    modeBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const mode = parseInt(btn.getAttribute('data-mode'));
            if (currentMode === mode) return;

            currentMode = mode;
            modeBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            fetchNumbers();
        });
    });
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
    
    // Calculate total
    let totalCount = 0;
    availableRegions.forEach(region => totalCount += region.count);

    // Add "Semua" (All) pill
    const allBtn = document.createElement('button');
    allBtn.className = `region-pill ${currentRegion === '' ? 'active' : ''}`;
    allBtn.innerHTML = `
        <span class="region-flag">🌍</span>
        <span class="region-name">Semua</span>
        <span class="region-count">${totalCount}</span>
    `;
    allBtn.onclick = () => {
        if (currentRegion === '') return;
        currentRegion = '';
        document.querySelectorAll('.region-pill').forEach(p => p.classList.remove('active'));
        allBtn.classList.add('active');
        allBtn.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
        fetchNumbers();
    };
    regionSelector.appendChild(allBtn);

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
            fetchNumbers();
        };
        
        regionSelector.appendChild(btn);
    });
    
    if (currentRegion === undefined) {
        currentRegion = '';
        allBtn.classList.add('active');
    } else if (currentRegion === '') {
        const firstPill = regionSelector.querySelector('.region-pill');
        if (firstPill) {
            firstPill.classList.add('active');
        }
    }
}

async function fetchNumbers() {
    singleNumberContainer.classList.add('hidden');
    batchNumberContainer.classList.add('hidden');
    loadingState.classList.remove('hidden');
    loadingText.innerText = currentMode === 1 ? 'Mencari nomor...' : `Mencari ${currentMode} nomor...`;
    
    try {
        let url = `/api/batch?db=${encodeURIComponent(currentDb)}&count=${currentMode}`;
        if (currentRegion) {
            url += `&region=${encodeURIComponent(currentRegion)}`;
        }
        
        const res = await fetch(url);
        const result = await res.json();
        
        if (result.success) {
            currentNumberData = result.data;
            if (currentMode === 1) {
                renderNumberCard(result.data[0], result.remaining);
            } else {
                renderBatchCard(result.data, result.remaining);
            }
        } else {
            const errHtml = `<div class="error-msg">${result.error || 'Gagal mengambil nomor.'}</div>`;
            if (currentMode === 1) {
                singleNumberContainer.innerHTML = errHtml;
                singleNumberContainer.classList.remove('hidden');
            } else {
                batchNumberContainer.innerHTML = errHtml;
                batchNumberContainer.classList.remove('hidden');
            }
        }
    } catch (err) {
        console.error(err);
        singleNumberContainer.innerHTML = '<div class="error-msg">Terjadi kesalahan pada server.</div>';
        singleNumberContainer.classList.remove('hidden');
    } finally {
        loadingState.classList.add('hidden');
    }
}

function renderNumberCard(data, remaining) {
    singleNumberContainer.innerHTML = `
        <div class="big-number-card">
            <div class="remaining-count" style="text-align:center; font-size:1.1rem; color:var(--text-muted); margin-bottom:10px; font-weight:600; letter-spacing: 1px;">SISA NOMOR: ${remaining}</div>
            <div class="big-info">
                <div class="big-number">${data.original}</div>
            </div>
            <div class="card-big-actions">
                <button class="big-action-btn btn-copy" onclick="copyToClipboard('${data.original}', this)">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                    COPY NUMBER
                </button>
                <button class="big-action-btn btn-change" onclick="fetchNumbers()">
                    CHANGE NUMBER
                </button>
            </div>
        </div>
    `;
    singleNumberContainer.classList.remove('hidden');
}

function renderBatchCard(data, remaining) {
    let itemsHtml = '';
    data.forEach(num => {
        itemsHtml += `
            <div class="batch-item">
                <span class="batch-number">${num.original}</span>
                <span class="batch-region" title="${num.countryName}">${num.flag}</span>
            </div>
        `;
    });

    batchNumberContainer.innerHTML = `
        <div class="batch-card">
            <div class="batch-header">
                <span class="batch-title">${data.length} NOMOR DITEMUKAN</span>
                <span class="remaining-count" style="font-size:0.9rem; color:var(--text-muted); font-weight:600;">SISA: ${remaining}</span>
            </div>
            <div class="batch-list">
                ${itemsHtml}
            </div>
            <div class="batch-actions">
                <button class="btn-copy-all" onclick="copyBatchToClipboard(this)">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                    COPY SEMUA NOMOR
                </button>
                <button class="big-action-btn btn-change" style="margin-top: 1rem; width:100%;" onclick="fetchNumbers()">
                    REFRESH BATCH
                </button>
            </div>
        </div>
    `;
    batchNumberContainer.classList.remove('hidden');
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

async function copyBatchToClipboard(btn) {
    if (!currentNumberData || !Array.isArray(currentNumberData)) return;
    
    const textToCopy = currentNumberData.map(num => {
        return num.original.startsWith('+') ? num.original : '+' + num.original;
    }).join('\n');

    try {
        await navigator.clipboard.writeText(textToCopy);
        const originalHTML = btn.innerHTML;
        btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg> SEMUA DISALIN!`;
        btn.classList.add('success');
        setTimeout(() => {
            btn.innerHTML = originalHTML;
            btn.classList.remove('success');
        }, 2000);
    } catch (err) {
        console.error('Failed to copy batch!', err);
    }
}

// Global exposure
window.fetchNumbers = fetchNumbers;
window.copyToClipboard = copyToClipboard;
window.copyBatchToClipboard = copyBatchToClipboard;

// Start
init();
