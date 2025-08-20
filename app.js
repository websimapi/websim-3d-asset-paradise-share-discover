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

