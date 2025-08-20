import { WebsimSocket } from '@websim/websim-socket';

const room = new WebsimSocket();
let currentUser = null;

async function initApp() {
    try {
        const userData = await window.websim.getCurrentUser();
        currentUser = userData;
        await refreshContent('browse');
        await refreshLeaderboard();
    } catch (error) {
        console.error('Error initializing app:', error);
    }
}

function getFileIcon(filename) {
    const ext = filename.split('.').pop()?.toLowerCase();
    const icons = {
        'glb': '🎮',
        'gltf': '🎮',
        'obj': '🧊',
        'fbx': '📦'
    };
    return icons[ext] || '📁';
}

function formatDate(dateString) {
    const date = new Date(dateString);
    const diff = Date.now() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days} days ago`;
    if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
    return `${Math.floor(days / 30)} months ago`;
}

async function uploadFile() {
    const fileInput = document.getElementById('fileInput');
    const modelName = document.getElementById('modelName').value.trim();
    const modelDescription = document.getElementById('modelDescription').value.trim();

    if (!modelName) {
        alert('Please enter a model name');
        return;
    }

    fileInput.click();
}

document.getElementById('fileInput').addEventListener('change', async (event) => {
    const file = event.target.files[0];
    const modelName = document.getElementById('modelName').value.trim();
    const modelDescription = document.getElementById('modelDescription').value.trim();

    if (!file) return;

    try {
        const url = await window.websim.upload(file);
        
        await room.collection('models').create({
            name: modelName,
            description: modelDescription,
            filename: file.name,
            url: url,
            size: file.size,
            fileType: file.type,
            downloads: 0
        });

        alert('Model uploaded successfully!');
        document.getElementById('modelName').value = '';
        document.getElementById('modelDescription').value = '';
        await refreshContent('browse');
        await refreshLeaderboard();
    } catch (error) {
        console.error('Error uploading file:', error);
        alert('Error uploading file. Please try again.');
    }
});

async function switchTab(tab) {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelector(`[onclick="switchTab('${tab}')"]`).classList.add('active');
    await refreshContent(tab);
}

async function refreshContent(category) {
    const contentArea = document.getElementById('contentArea');
    contentArea.innerHTML = '<div class="loading">Loading models...</div>';

    let models;
    
    switch (category) {
        case 'popular':
            models = await room.query(`
                SELECT * FROM public.models 
                ORDER BY downloads DESC 
                LIMIT 50
            `);
            break;
        case 'recent':
            models = await room.query(`
                SELECT * FROM public.models 
                ORDER BY created_at DESC 
                LIMIT 50
            `);
            break;
        default:
            models = await room.collection('models').getList({ limit: 50 });
    }

    displayModels(models);
}

function displayModels(models) {
    const contentArea = document.getElementById('contentArea');
    
    if (!models || models.length === 0) {
        contentArea.innerHTML = '<div class="loading">No models found. Be the first to upload!</div>';
        return;
    }

    contentArea.innerHTML = models.map(model => `
        <div class="asset-card fade-in">
            <div class="asset-preview">
                ${getFileIcon(model.filename)}
            </div>
            <div class="asset-info">
                <div class="asset-name">${model.name}</div>
                <div class="stat">
                    <i class="fas fa-download"></i>
                    ${model.downloads || 0}
                </div>
            </div>
            <div style="font-size: 0.85rem; opacity: 0.7; margin-top: 0.5rem;">
                by ${model.username} • ${formatDate(model.created_at)}
            </div>
            <button onclick="downloadModel('${model.url}', '${model.name}', '${model.id}')" 
                    style="width: 100%; margin-top: 1rem; padding: 0.5rem; background: rgba(255,255,255,0.2); border: none; border-radius: 10px; color: white; cursor: pointer; transition: all 0.3s;"
                    onmouseover="this.style.background='rgba(255,255,255,0.3)'"
                    onmouseout="this.style.background='rgba(255,255,255,0.2)'">
                <i class="fas fa-download"></i> Download
            </button>
        </div>
    `).join('');
}

async function downloadModel(url, name, modelId) {
    try {
        window.open(url, '_blank');
        
        await room.collection('models').upsert({
            id: modelId,
            downloads: (await room.query(`SELECT downloads FROM public.models WHERE id = '${modelId}'`))[0]?.downloads + 1 || 0
        });
    } catch (error) {
        console.error('Error downloading model:', error);
    }
}

async function refreshLeaderboard() {
    const leaderboard = await room.query(`
        SELECT username, COUNT(*) as uploads 
        FROM public.models 
        GROUP BY username 
        ORDER BY uploads DESC 
        LIMIT 10
    `);
    
    const leaderboardDiv = document.getElementById('leaderboard');
    
    if (!leaderboard || leaderboard.length === 0) {
        leaderboardDiv.innerHTML = '<div style="text-align: center; opacity: 0.7;">No uploads yet</div>';
        return;
    }

    leaderboardDiv.innerHTML = leaderboard.map((user, index) => `
        <div class="leaderboard-item">
            <div class="user-info">
                <div class="avatar" style="background-image: url('https://images.websim.com/avatar/${user.username}'); background-size: cover;"></div>
                <span>${user.username}</span>
            </div>
            <div class="stat">
                <i class="fas fa-upload"></i> ${user.uploads}
            </div>
        </div>
    `).join('');
}

// Auto-refresh subscriptions
let unsubscribeModels = null;

function setupRealTimeUpdates() {
    if (unsubscribeModels) {
        unsubscribeModels();
    }
    
    unsubscribeModels = room.collection('models').subscribe(() => {
        const activeTab = document.querySelector('.tab.active').getAttribute('onclick').match(/'([^']+)'/)[1];
        refreshContent(activeTab);
        refreshLeaderboard();
    });
}

// Initialize app
initApp();
setupRealTimeUpdates();

