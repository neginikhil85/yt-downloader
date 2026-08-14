// ==========================================================================
// YT Studio Pro — P2P Utilities & Network Helpers
// ==========================================================================

const os = require('os');

const localPeerId = 'peer_' + Math.random().toString(36).substring(2, 10);
const localDeviceName = `${os.hostname()} (${process.platform === 'darwin' ? 'Mac' : (process.platform === 'win32' ? 'Windows' : 'Linux')})`;

function generateTransferCode() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

function calculateBroadcast(ip, netmask) {
    try {
        const ipParts = ip.split('.').map(Number);
        const maskParts = netmask.split('.').map(Number);
        const broadcastParts = [];
        for (let i = 0; i < 4; i++) {
            broadcastParts.push((ipParts[i] | (~maskParts[i] & 255)) >>> 0);
        }
        return broadcastParts.join('.');
    } catch (e) {
        return '255.255.255.255';
    }
}

function getNetworkInterfaceConfigs() {
    const interfaces = os.networkInterfaces();
    const configs = [];
    for (const [name, iface] of Object.entries(interfaces)) {
        for (const net of iface) {
            if (net.family === 'IPv4' && !net.internal) {
                const broadcast = calculateBroadcast(net.address, net.netmask || '255.255.255.0');
                const subnetPrefix = net.address.split('.').slice(0, 3).join('.');
                configs.push({
                    name,
                    address: net.address,
                    netmask: net.netmask,
                    broadcast,
                    subnetPrefix
                });
            }
        }
    }
    return configs;
}

function getLocalIpAddresses() {
    const configs = getNetworkInterfaceConfigs();
    const list = configs.map(c => c.address);
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
    getNetworkInterfaceConfigs,
    getLocalIpAddresses,
    getPrimaryIp,
    formatBytes
};
