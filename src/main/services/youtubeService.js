const https = require('https');
const { execFile } = require('child_process');
const { YT_DLP_PATH } = require('../config/paths');

const EXTRACTOR_ARGS = ['--no-check-certificates', '--extractor-args', 'youtube:player_client=web,android,ios,mweb'];

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
