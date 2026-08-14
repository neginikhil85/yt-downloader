// ==========================================================================
// YT Studio Pro — P2P Utilities & Network Helpers
// ==========================================================================

const os = require('os');

const localPeerId = 'peer_' + Math.random().toString(36).substring(2, 10);
const localDeviceName = `${os.hostname()} (${process.platform === 'darwin' ? 'Mac' : (process.platform === 'win32' ? 'Windows' : 'Linux')})`;

function generateTransferCode() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

function getLocalIpAddresses() {
    const interfaces = os.networkInterfaces();
    const list = [];
    for (const iface of Object.values(interfaces)) {
        for (const net of iface) {
            if (net.family === 'IPv4' && !net.internal) {
                list.push(net.address);
            }
        }
    }
    return list.length > 0 ? list : ['127.0.0.1'];
}

function getPrimaryIp() {
    return getLocalIpAddresses()[0] || '127.0.0.1';
}

function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

module.exports = {
    localPeerId,
    localDeviceName,
    generateTransferCode,
    getLocalIpAddresses,
    getPrimaryIp,
    formatBytes
};
