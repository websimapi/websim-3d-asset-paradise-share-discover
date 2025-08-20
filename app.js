import { WebsimSocket } from '@websim/websim-socket';

const room = new WebsimSocket();

// Global variables for Three.js scene
let scene, camera, renderer, modelMesh;
const PREVIEW_SIZE = 256;

// Set up file input change handler
document.addEventListener('DOMContentLoaded', async () => {
    document.getElementById('fileInput').addEventListener('change', async (e) => {
        if (e.target.files.length > 0) {
            const file = e.target.files[0];
            
            // Show loading state
            const uploadBtn = document.querySelector('.upload-btn');
            uploadBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
            uploadBtn.disabled = true;
            
            try {
                // Generate preview image
                const previewUrl = await generatePreview(file);
                
                // Upload original file
                const modelUrl = await window.websim.upload(file);
                
                // Upload preview image
                const previewBlob = await (await fetch(previewUrl)).blob();
                const previewFile = new File([previewBlob], 'preview.png', { type: 'image/png' });
                const previewImageUrl = await window.websim.upload(previewFile);
                
                // Create model record with preview
                const modelName = document.getElementById('modelName').value.trim();
                const modelDescription = document.getElementById('modelDescription').value.trim();
                
                await room.collection('models').create({
                    name: modelName,
                    description: modelDescription,
                    filename: file.name,
                    url: modelUrl,
                    previewUrl: previewImageUrl,
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
            } finally {
                // Reset upload button
                const uploadBtn = document.querySelector('.upload-btn');
                uploadBtn.innerHTML = '<i class="fas fa-cloud-upload-alt"></i> Upload 3D Model';
                uploadBtn.disabled = false;
            }
        }
    });
    
    // Initialize
    refreshContent('browse');
    refreshLeaderboard();
});

async function generatePreview(file) {
    return new Promise((resolve, reject) => {
        // Create offscreen canvas for preview
        const canvas = document.createElement('canvas');
        canvas.width = PREVIEW_SIZE;
        canvas.height = PREVIEW_SIZE;
        canvas.style.position = 'absolute';
        canvas.style.left = '-9999px';
        document.body.appendChild(canvas);
        
        const ctx = canvas.getContext('2d');
        
        // Draw placeholder 3D icon
        const gradient = ctx.createRadialGradient(
            PREVIEW_SIZE/2, PREVIEW_SIZE/2, 0,
            PREVIEW_SIZE/2, PREVIEW_SIZE/2, PREVIEW_SIZE/2
        );
        gradient.addColorStop(0, '#667eea');
        gradient.addColorStop(1, '#764ba2');
        
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, PREVIEW_SIZE, PREVIEW_SIZE);
        
        // Draw 3D cube icon
        ctx.fillStyle = 'white';
        ctx.font = `${PREVIEW_SIZE/3}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('📦', PREVIEW_SIZE/2, PREVIEW_SIZE/2);
        
        // Draw file type
        const fileType = file.name.split('.').pop().toUpperCase();
        ctx.font = '12px Arial';
        ctx.fillText(fileType, PREVIEW_SIZE/2, PREVIEW_SIZE - 20);
        
        const dataUrl = canvas.toDataURL('image/png');
        document.body.removeChild(canvas);
        resolve(dataUrl);
    });
}

async function uploadFile() {
    const modelName = document.getElementById('modelName').value.trim();
    const modelDescription = document.getElementById('modelDescription').value.trim();

    if (!modelName) {
        alert('Please enter a model name');
        return;
    }

    document.getElementById('fileInput').click();
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

// Add tap support for mobile
function openModelPreview(modelId) {
    // On mobile, show a full-screen preview or download dialog
    const model = modelsCache.find(m => m.id === modelId);
    if (model) {
        if (confirm(`Download ${model.name}?`)) {
            downloadModel(modelId, model.url);
        }
    }
}

// Cache models for mobile tap
let modelsCache = [];

// Update refreshContent to cache models
async function refreshContent(category) {
    const contentArea = document.getElementById('contentArea');
    contentArea.innerHTML = '<div class="loading">Loading models...</div>';

    let models;
    
    switch (category) {
        case 'popular':
            models = await room.query(`
                SELECT m.id, m.name, m.filename, m.url, m.previewUrl, m.size, m.fileType, m.downloads, m.created_at, u.username
                FROM public.models m
                JOIN public.user u ON m.user_id = u.id
                ORDER BY m.downloads DESC 
                LIMIT 50
            `);
            break;
        case 'recent':
            models = await room.query(`
                SELECT m.id, m.name, m.filename, m.url, m.previewUrl, m.size, m.fileType, m.downloads, m.created_at, u.username
                FROM public.models m
                JOIN public.user u ON m.user_id = u.id
                ORDER BY m.created_at DESC 
                LIMIT 50
            `);
            break;
        default:
            models = await room.query(`
                SELECT m.id, m.name, m.filename, m.url, m.previewUrl, m.size, m.fileType, m.downloads, m.created_at, u.username
                FROM public.models m
                JOIN public.user u ON m.user_id = u.id
                ORDER BY m.created_at DESC 
                LIMIT 50
            `);
    }

    modelsCache = models; // Cache for mobile tap
    displayModels(models);
}

function displayModels(models) {
    const contentArea = document.getElementById('contentArea');
    
    if (!models || models.length === 0) {
        contentArea.innerHTML = '<div style="text-align: center; opacity: 0.7;">No models found</div>';
        return;
    }

    contentArea.innerHTML = models.map(model => `
        <div class="asset-card fade-in" onclick="openModelPreview('${model.id}')">
            <div class="asset-preview" style="${model.previewUrl ? `background-image: url('${model.previewUrl}'); background-size: cover; background-position: center;` : ''}">
                ${!model.previewUrl ? '<i class="fas fa-cube"></i>' : ''}
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
                <button onclick="event.stopPropagation(); downloadModel('${model.id}', '${model.url}')" class="upload-btn" style="padding: 0.5rem 1rem; font-size: 0.9rem;">
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

// Make uploadFile globally available
window.uploadFile = uploadFile;