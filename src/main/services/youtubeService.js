const { execFile } = require('child_process');
const { YT_DLP_PATH } = require('../config/paths');

const EXTRACTOR_ARGS = ['--no-check-certificates', '--extractor-args', 'youtube:player_client=web,android,ios,mweb'];

/**
 * Searches YouTube for queries with pagination support (Infinite Scroll)
 */
function searchYouTube(query, page = 1, pageSize = 20) {
    return new Promise((resolve) => {
        if (!query || !query.trim()) return resolve({ success: true, results: [], hasMore: false, page });

        const trimmed = query.trim();
        const isVideoId = /^[a-zA-Z0-9_-]{11}$/.test(trimmed);

        let searchArg = trimmed;
        let paginationArgs = [];

        if (!trimmed.startsWith('http') && !isVideoId) {
            const startIndex = (page - 1) * pageSize + 1;
            const endIndex = page * pageSize;
            searchArg = `ytsearch200:${trimmed}`;
            paginationArgs = ['--playlist-start', String(startIndex), '--playlist-end', String(endIndex)];
        }

        const args = [
            ...EXTRACTOR_ARGS,
            '--dump-single-json',
            '--flat-playlist',
            '--skip-download',
            '--no-warnings',
            ...paginationArgs,
            searchArg
        ];

        execFile(YT_DLP_PATH, args, { maxBuffer: 1024 * 1024 * 30 }, (error, stdout, stderr) => {
            if (error) {
                console.error('Search error:', stderr || error.message);
                return resolve({ success: false, error: error.message, results: [], hasMore: false, page });
            }

            try {
                const data = JSON.parse(stdout);
                const rawEntries = data.entries || (Array.isArray(data) ? data : [data]);
                const results = rawEntries.filter(Boolean).map((e, idx) => {
                    const videoId = e.id;
                    const durationSec = e.duration || 0;
                    const durStr = durationSec
                        ? `${Math.floor(durationSec / 60)}:${String(Math.floor(durationSec % 60)).padStart(2, '0')}`
                        : 'LIVE';

                    let viewsStr = 'N/A';
                    if (e.view_count) {
                        const v = e.view_count;
                        viewsStr = v >= 1e6 ? `${(v / 1e6).toFixed(1)}M views` : v >= 1e3 ? `${(v / 1e3).toFixed(1)}K views` : `${v} views`;
                    }

                    const thumb = e.thumbnail || (videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : '');
                    const videoUrl = e.url && e.url.startsWith('http') ? e.url : `https://www.youtube.com/watch?v=${videoId}`;

                    return {
                        id: videoId,
                        index: (page - 1) * pageSize + idx + 1,
                        title: e.title || 'YouTube Video',
                        uploader: e.uploader || e.channel || 'YouTube Creator',
                        duration: durationSec,
                        durationStr: durStr,
                        views: viewsStr,
                        thumbnail: thumb,
                        url: videoUrl
                    };
                });

                resolve({
                    success: true,
                    results,
                    hasMore: results.length >= pageSize,
                    page
                });
            } catch (parseErr) {
                console.error('Parse error:', parseErr);
                resolve({ success: false, error: 'Failed to parse YouTube results', results: [], hasMore: false, page });
            }
        });
    });
}

/**
 * Resolves direct media stream URL for HTML5 player
 */
function getStreamUrl(url) {
    return new Promise((resolve) => {
        const args = [
            ...EXTRACTOR_ARGS,
            '-g',
            '-f', 'best[ext=mp4]/best',
            '--no-warnings',
            url
        ];
        execFile(YT_DLP_PATH, args, (error, stdout) => {
            if (error) {
                const fallbackArgs = [...EXTRACTOR_ARGS, '-g', url];
                execFile(YT_DLP_PATH, fallbackArgs, (err2, stdout2) => {
                    if (err2) return resolve({ success: false, error: err2.message });
                    const lines = stdout2.trim().split('\n').filter(Boolean);
                    resolve({ success: true, streamUrl: lines[0] });
                });
                return;
            }
            const lines = stdout.trim().split('\n').filter(Boolean);
            resolve({ success: true, streamUrl: lines[0] });
        });
    });
}

module.exports = {
    searchYouTube,
    getStreamUrl
};
