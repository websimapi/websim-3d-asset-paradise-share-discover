import { WebsimSocket } from '@websim/websim-socket';

const room = new WebsimSocket();

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

async function handleFileUpload(file) {
    try {
        const modelName = document.getElementById('modelName').value.trim();
        const modelDescription = document.getElementById('modelDescription').value.trim();

        // Upload file to blob storage
        const url = await window.websim.upload(file);
        
        // Create model record
        await room.collection('models').create({
            name: modelName,
            description: modelDescription,
            filename: file.name,
            url: url,
            size: file.size,
            fileType: file.name.split('.').pop().toLowerCase(),
            downloads: 0
        });

        // Reset form
        document.getElementById('modelName').value = '';
        document.getElementById('modelDescription').value = '';
        
        // Refresh content
        await refreshContent(currentTab);
        await refreshLeaderboard();
        
    } catch (error) {
        console.error('Error uploading file:', error);
        alert('Error uploading file: ' + error.message);
    }
}

let currentTab = 'browse';

function switchTab(tab) {
    currentTab = tab;
    
    // Update active tab
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    event.target.classList.add('active');
    
    // Refresh content
    refreshContent(tab);
}

async function refreshContent(category) {
    const contentArea = document.getElementById('contentArea');
    contentArea.innerHTML = '<div class="loading">Loading models...</div>';

    let models;
    
    switch (category) {
        case 'popular':
            models = await room.query(`
                SELECT m.id, m.name, m.filename, m.url, m.size, m.fileType, m.downloads, m.created_at, u.username
                FROM public.models m
                JOIN public.user u ON m.user_id = u.id
                ORDER BY m.downloads DESC 
                LIMIT 50
            `);
            break;
        case 'recent':
            models = await room.query(`
                SELECT m.id, m.name, m.filename, m.url, m.size, m.fileType, m.downloads, m.created_at, u.username
                FROM public.models m
                JOIN public.user u ON m.user_id = u.id
                ORDER BY m.created_at DESC 
                LIMIT 50
            `);
            break;
        default:
            models = await room.query(`
                SELECT m.id, m.name, m.filename, m.url, m.size, m.fileType, m.downloads, m.created_at, u.username
                FROM public.models m
                JOIN public.user u ON m.user_id = u.id
                ORDER BY m.created_at DESC 
                LIMIT 50
            `);
    }

    displayModels(models);
}

function displayModels(models) {
    const contentArea = document.getElementById('contentArea');
    
    if (!models || models.length === 0) {
        contentArea.innerHTML = '<div style="text-align: center; opacity: 0.7;">No models found</div>';
        return;
    }

    contentArea.innerHTML = models.map(model => `
        <div class="asset-card fade-in">
            <div class="asset-preview">
                <i class="fas fa-cube"></i>
            </div>
            <h3 class="asset-name">${model.name}</h3>
            <p style="opacity: 0.8; margin-bottom: 1rem;">${model.description || 'No description'}</p>
            <div class="asset-info">
                <div>
                    <div class="stat">
                        <i class="fas fa-download"></i> ${model.downloads}
                    </div>
                    <div class="stat">
                        <i class="fas fa-user"></i> ${model.username}
                    </div>
                    <div class="stat">
                        <i class="fas fa-file"></i> ${model.fileType.toUpperCase()}
                    </div>
                </div>
                <button onclick="downloadModel('${model.id}', '${model.url}')" class="upload-btn" style="padding: 0.5rem 1rem; font-size: 0.9rem;">
                    <i class="fas fa-download"></i> Download
                </button>
            </div>
        </div>
    `).join('');
}

async function downloadModel(modelId, url) {
    try {
        // Increment download count
        await room.collection('models').update(modelId, {
            downloads: { increment: 1 }
        });
        
        // Download file
        const a = document.createElement('a');
        a.href = url;
        a.download = '';
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        
        // Refresh content to show updated download count
        refreshContent(currentTab);
        refreshLeaderboard();
    } catch (error) {
        console.error('Error downloading model:', error);
        alert('Error downloading model: ' + error.message);
    }
}

async function refreshLeaderboard() {
    const leaderboard = await room.query(`
        SELECT u.username, COUNT(*) as uploads 
        FROM public.models m
        JOIN public.user u ON m.user_id = u.id
        GROUP BY u.username 
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

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    // Set up file input change handler
    document.getElementById('fileInput').addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            handleFileUpload(e.target.files[0]);
        }
    });
    
    // Initial load
    refreshContent('browse');
    refreshLeaderboard();
});

// Make uploadFile globally available
window.uploadFile = uploadFile;