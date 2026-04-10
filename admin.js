const dbListContainer = document.getElementById('dbList');
const dbFileInput = document.getElementById('dbFileInput');
const uploadBtn = document.getElementById('uploadBtn');
const uploadStatus = document.getElementById('uploadStatus');

async function fetchDatabases() {
    try {
        const response = await fetch('/api/databases');
        const databases = await response.json();
        renderDatabases(databases);
    } catch (error) {
        console.error('Failed to fetch databases:', error);
        dbListContainer.innerHTML = '<p class="error-msg">Gagal memuat daftar database.</p>';
    }
}

function renderDatabases(databases) {
    dbListContainer.innerHTML = '';
    
    if (databases.length === 0) {
        dbListContainer.innerHTML = '<p class="text-muted" style="text-align:center; padding: 2rem;">Tidak ada database yang aktif.</p>';
        return;
    }

    databases.forEach(db => {
        const item = document.createElement('div');
        item.className = 'db-list-item';
        item.innerHTML = `
            <div class="db-info">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                <span class="db-name">${db}.txt</span>
            </div>
            <button class="db-delete-btn" onclick="deleteDatabase('${db}', this)">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
            </button>
        `;
        dbListContainer.appendChild(item);
    });
}

uploadBtn.addEventListener('click', () => {
    dbFileInput.click();
});

dbFileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('dbFile', file);

    const originalBtnHTML = uploadBtn.innerHTML;
    uploadBtn.innerHTML = '<span class="spinner-small" style="margin-right: 10px;"></span> UPLOADING...';
    uploadBtn.disabled = true;
    uploadStatus.innerText = '';
    uploadStatus.style.color = 'var(--text-muted)';

    try {
        const response = await fetch('/api/upload', {
            method: 'POST',
            body: formData
        });
        
        const result = await response.json();
        if (result.success) {
            uploadStatus.innerText = 'Upload berhasil!';
            uploadStatus.style.color = 'var(--green)';
            fetchDatabases(); // Refresh list
        } else {
            throw new Error(result.error || 'Upload failed');
        }
    } catch (err) {
        console.error(err);
        uploadStatus.innerText = 'Gagal mengunggah file.';
        uploadStatus.style.color = 'var(--red)';
    } finally {
        uploadBtn.innerHTML = originalBtnHTML;
        uploadBtn.disabled = false;
        dbFileInput.value = ''; // Reset input
    }
});

async function deleteDatabase(dbName, btnElement) {
    if (!confirm(`Yakin ingin menghapus database ${dbName}.txt?`)) return;

    btnElement.disabled = true;
    btnElement.innerHTML = '<span class="spinner-small" style="width:14px;height:14px;border-width:2px;border-color:currentColor;border-top-color:transparent;"></span>';

    try {
        const response = await fetch('/api/delete-db', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ dbName })
        });
        
        const result = await response.json();
        if (result.success) {
            fetchDatabases(); // Refresh list
        } else {
            throw new Error(result.error || 'Delete failed');
        }
    } catch (err) {
        console.error(err);
        alert('Gagal menghapus database.');
        fetchDatabases(); // Reset UI
    }
}

// Init
fetchDatabases();
