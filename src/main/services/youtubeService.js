const https = require('https');
const { execFile } = require('child_process');
const { YT_DLP_PATH } = require('../config/paths');

const EXTRACTOR_ARGS = ['--no-check-certificates'];

// In-memory cache for search pagination continuation tokens: query -> token
const continuationTokenCache = new Map();

function parseVideoRenderer(v, index = 0) {
    if (!v || !v.videoId) return null;
    const title = v.title?.runs?.map(r => r.text).join('') || v.title?.simpleText || 'YouTube Video';
    const uploader = v.ownerText?.runs?.[0]?.text || v.longBylineText?.runs?.[0]?.text || v.shortBylineText?.runs?.[0]?.text || 'YouTube Creator';
    const views = v.viewCountText?.simpleText || v.shortViewCountText?.simpleText || 'N/A';
    const durationStr = v.lengthText?.simpleText || 'LIVE';
    const thumb = v.thumbnail?.thumbnails?.slice(-1)[0]?.url || `https://i.ytimg.com/vi/${v.videoId}/hqdefault.jpg`;
    return {
        id: v.videoId,
        index,
        title,
        uploader,
        durationStr,
        views,
        thumbnail: thumb,
        url: `https://www.youtube.com/watch?v=${v.videoId}`
    };
}

function parseInnerTubeSections(sections, startIndex = 1) {
    const results = [];
    let nextContinuationToken = null;
    let currIdx = startIndex;

    for (const section of sections) {
        if (section.continuationItemRenderer) {
            nextContinuationToken = section.continuationItemRenderer.continuationEndpoint?.continuationCommand?.token || null;
            continue;
        }

        const items = section.itemSectionRenderer?.contents || [];
        for (const item of items) {
            if (item.videoRenderer) {
                const parsed = parseVideoRenderer(item.videoRenderer, currIdx++);
                if (parsed) results.push(parsed);
            } else if (item.shelfRenderer?.content?.verticalListRenderer?.items) {
                for (const subItem of item.shelfRenderer.content.verticalListRenderer.items) {
                    if (subItem.videoRenderer) {
                        const parsed = parseVideoRenderer(subItem.videoRenderer, currIdx++);
                        if (parsed) results.push(parsed);
                    }
                }
            } else if (item.continuationItemRenderer) {
                nextContinuationToken = item.continuationItemRenderer.continuationEndpoint?.continuationCommand?.token || null;
            }
        }
    }
    return { results, nextContinuationToken };
}

function searchInnerTube(query, page = 1, pageSize = 20) {
    return new Promise((resolve, reject) => {
        const isNextPage = page > 1;
        const cachedToken = isNextPage ? continuationTokenCache.get(query) : null;

        const payload = isNextPage && cachedToken
            ? {
                context: {
                    client: {
                        clientName: 'WEB',
                        clientVersion: '2.20240101.00.00',
                        hl: 'en',
                        gl: 'US'
                    }
                },
                continuation: cachedToken
            }
            : {
                context: {
                    client: {
                        clientName: 'WEB',
                        clientVersion: '2.20240101.00.00',
                        hl: 'en',
                        gl: 'US'
                    }
                },
                query: query
            };

        const postData = JSON.stringify(payload);

        const req = https.request({
            hostname: 'www.youtube.com',
            path: '/youtubei/v1/search',
            method: 'POST',
            rejectUnauthorized: false,
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData),
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36',
                'Referer': 'https://www.youtube.com/'
            }
        }, (res) => {
            let rawData = '';
            res.on('data', chunk => rawData += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(rawData);
                    let sections = [];
                    let results = [];
                    let nextToken = null;

                    if (isNextPage && cachedToken) {
                        const continuationItems = json.onResponseReceivedCommands?.[0]?.appendContinuationItemsAction?.continuationItems || [];
                        const parsed = parseInnerTubeSections(continuationItems, (page - 1) * pageSize + 1);
                        results = parsed.results;
                        nextToken = parsed.nextContinuationToken;
                    } else {
                        sections = json.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents || [];
                        const parsed = parseInnerTubeSections(sections, 1);
                        results = parsed.results;
                        nextToken = parsed.nextContinuationToken;
                    }

                    if (nextToken) {
                        continuationTokenCache.set(query, nextToken);
                    }

                    resolve({
                        success: true,
                        results,
                        hasMore: !!nextToken || results.length >= 10,
                        page
                    });
                } catch (parseErr) {
                    reject(parseErr);
                }
            });
        });

        req.on('error', reject);
        req.setTimeout(8000, () => {
            req.destroy(new Error('InnerTube search timeout'));
        });
        req.write(postData);
        req.end();
    });
}

/**
 * Searches YouTube for queries with fast InnerTube API and yt-dlp fallback
 */
async function searchYouTube(query, page = 1, pageSize = 20) {
    if (!query || !query.trim()) return { success: true, results: [], hasMore: false, page };

    const trimmed = query.trim();

    try {
        const innerTubeRes = await searchInnerTube(trimmed, page, pageSize);
        if (innerTubeRes && innerTubeRes.success && innerTubeRes.results && innerTubeRes.results.length > 0) {
            return innerTubeRes;
        }
    } catch (innerTubeErr) {
        console.warn('InnerTube search fallback triggered:', innerTubeErr.message);
    }

    // Fallback to yt-dlp if direct InnerTube fails
    return new Promise((resolve) => {
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
                console.error('Search fallback error:', stderr || error.message);
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

const { getHttpPort } = require('./p2p/p2pHttpServer');
const { formatBytes } = require('./p2p/p2pUtils');

function formatProxiedStreamUrl(rawStreamUrl) {
    if (!rawStreamUrl || !rawStreamUrl.startsWith('http')) return rawStreamUrl;
    const port = getHttpPort() || 9876;
    return `http://127.0.0.1:${port}/api/stream?url=${encodeURIComponent(rawStreamUrl)}`;
}

/**
 * Dynamically queries YouTube for all supported video resolutions and audio formats with exact file sizes
 */
function getVideoFormats(url) {
    return new Promise((resolve) => {
        const args = [
            ...EXTRACTOR_ARGS,
            '-J',
            '--no-warnings',
            url
        ];

        execFile(YT_DLP_PATH, args, { maxBuffer: 15 * 1024 * 1024 }, (err, stdout) => {
            if (err) {
                return resolve({
                    success: false,
                    error: err.message,
                    resolutions: [
                        { height: 1080, quality: '1080p', label: '1080p Full HD', sizeStr: '' },
                        { height: 720, quality: '720p', label: '720p HD', sizeStr: '' },
                        { height: 480, quality: '480p', label: '480p SD', sizeStr: '' },
                        { height: 360, quality: '360p', label: '360p', sizeStr: '' },
                        { height: 0, quality: 'MP3', label: 'Audio MP3', sizeStr: '' }
                    ]
                });
            }

            try {
                const json = JSON.parse(stdout);
                const videoFormats = (json.formats || []).filter(f => f.vcodec && f.vcodec !== 'none' && f.protocol && f.protocol.startsWith('http') && f.height >= 144);
                const heights = [...new Set(videoFormats.map(f => f.height).filter(Boolean))].sort((a, b) => b - a);

                const resolutions = heights.map(h => {
                    let label = `${h}p`;
                    let quality = `${h}p`;
                    if (h >= 2160) { label = '4K (2160p)'; quality = '2160p'; }
                    else if (h >= 1440) { label = '2K (1440p)'; quality = '1440p'; }
                    else if (h === 1080) { label = '1080p Full HD'; quality = '1080p'; }
                    else if (h === 720) { label = '720p HD'; quality = '720p'; }
                    else if (h === 480) { label = '480p SD'; quality = '480p'; }
                    else if (h === 360) { label = '360p'; quality = '360p'; }
                    else if (h === 240) { label = '240p'; quality = '240p'; }
                    else if (h === 144) { label = '144p'; quality = '144p'; }

                    const matching = videoFormats.filter(f => f.height === h);
                    const f = matching.find(vf => vf.filesize || vf.filesize_approx) || matching[0];
                    const sizeBytes = f ? (f.filesize || f.filesize_approx) : null;
                    const sizeStr = sizeBytes ? formatBytes(sizeBytes) : '';

                    return {
                        height: h,
                        quality,
                        label,
                        sizeBytes,
                        sizeStr,
                        fps: f?.fps
                    };
                });

                // Add Audio option
                const audioFormats = (json.formats || []).filter(f => f.acodec && f.acodec !== 'none' && (!f.vcodec || f.vcodec === 'none'));
                const bestAudio = audioFormats.find(f => f.filesize || f.filesize_approx) || audioFormats[0];
                const audioSize = bestAudio ? (bestAudio.filesize || bestAudio.filesize_approx) : null;
                resolutions.push({
                    height: 0,
                    quality: 'MP3',
                    label: 'Audio MP3',
                    sizeBytes: audioSize,
                    sizeStr: audioSize ? formatBytes(audioSize) : ''
                });

                resolve({
                    success: true,
                    title: json.title,
                    thumbnail: json.thumbnail,
                    duration: json.duration,
                    resolutions
                });
            } catch (parseErr) {
                resolve({ success: false, error: parseErr.message, resolutions: [] });
            }
        });
    });
}

/**
 * Resolves direct media stream URL for HTML5 player with dynamic resolution selection
 */
function getStreamUrl(url, quality = 'auto') {
    return new Promise((resolve) => {
        let formatFilter = 'bestvideo[vcodec^=avc1]+bestaudio[acodec^=mp4a]/bestvideo[ext=mp4]+bestaudio[ext=m4a]/bestvideo+bestaudio/best';
        const heightMatch = String(quality).match(/(\d+)/);
        if (heightMatch) {
            const h = parseInt(heightMatch[1], 10);
            formatFilter = `bestvideo[height<=${h}][vcodec^=avc1]+bestaudio[acodec^=mp4a]/bestvideo[height<=${h}][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height<=${h}]+bestaudio/best[height<=${h}]/best`;
        }

        const args = [
            '--no-check-certificates',
            '--no-playlist',
            '--no-warnings',
            '-g',
            '-f', formatFilter,
            url
        ];
        execFile(YT_DLP_PATH, args, (error, stdout) => {
            if (error) {
                const fallbackArgs = ['--no-check-certificates', '-g', url];
                execFile(YT_DLP_PATH, fallbackArgs, (err2, stdout2) => {
                    if (err2) return resolve({ success: false, error: err2.message });
                    const lines = stdout2.trim().split('\n').filter(Boolean);
                    const raw = lines[0];
                    resolve({ success: true, streamUrl: formatProxiedStreamUrl(raw), audioUrl: null, rawUrl: raw, quality });
                });
                return;
            }
            const lines = stdout.trim().split('\n').filter(Boolean);
            const videoUrl = lines[0];
            const audioUrl = lines[1] || null;
            resolve({
                success: true,
                streamUrl: formatProxiedStreamUrl(videoUrl),
                audioUrl: audioUrl ? formatProxiedStreamUrl(audioUrl) : null,
                rawVideoUrl: videoUrl,
                rawAudioUrl: audioUrl,
                quality
            });
        });
    });
}

module.exports = {
    searchYouTube,
    getStreamUrl,
    getVideoFormats
};
