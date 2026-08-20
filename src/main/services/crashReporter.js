const { app, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');

let logDir = null;
let mainCrashLogPath = null;
let isInitialized = false;

function ensureLogDir() {
    if (!logDir) {
        try {
            const userData = app.isReady() ? app.getPath('userData') : path.join(require('os').homedir(), '.yt_downloader');
            logDir = path.join(userData, 'logs');
            if (!fs.existsSync(logDir)) {
                fs.mkdirSync(logDir, { recursive: true });
            }
            mainCrashLogPath = path.join(logDir, 'crash.log');
        } catch (e) {
            console.error('[CrashReporter] Failed to initialize log directory:', e);
        }
    }
    return logDir;
}

function writeCrashLog(type, error, extra = {}) {
    try {
        ensureLogDir();
        const timestamp = new Date().toISOString();
        const divider = '='.repeat(60);
        
        let errorDetails = '';
        if (error instanceof Error) {
            errorDetails = `${error.name}: ${error.message}\n${error.stack || ''}`;
        } else if (typeof error === 'object') {
            try {
                errorDetails = JSON.stringify(error, null, 2);
            } catch (e) {
                errorDetails = String(error);
            }
        } else {
            errorDetails = String(error);
        }

        let extraDetails = '';
        if (Object.keys(extra).length > 0) {
            extraDetails = `\nExtra Info:\n${JSON.stringify(extra, null, 2)}\n`;
        }

        const logEntry = `\n${divider}\n[${timestamp}] [CRASH TYPE: ${type}]\n${errorDetails}${extraDetails}${divider}\n`;

        if (mainCrashLogPath) {
            fs.appendFileSync(mainCrashLogPath, logEntry, 'utf8');
        }

        // Also create a specific timestamped file for fatal exceptions
        if (logDir && type === 'UNCAUGHT_EXCEPTION') {
            const fileSafeTime = timestamp.replace(/[:.]/g, '-');
            const fatalLogPath = path.join(logDir, `crash-${fileSafeTime}.log`);
            fs.writeFileSync(fatalLogPath, logEntry, 'utf8');
        }
    } catch (e) {
        console.error('[CrashReporter] Failed to write crash log:', e);
    }
}

function handleFatalError(type, error) {
    console.error(`[CRASH] ${type}:`, error);
    writeCrashLog(type, error);

    const errorMessage = error && error.message ? error.message : String(error);
    const errorStack = error && error.stack ? error.stack : '';

    if (app.isReady()) {
        const choice = dialog.showMessageBoxSync({
            type: 'error',
            title: 'Application Error',
            message: `A fatal error occurred in the application:`,
            detail: `${errorMessage}\n\nLog saved to:\n${mainCrashLogPath || 'User data logs'}\n\nStack:\n${errorStack.slice(0, 500)}`,
            buttons: ['Restart App', 'Open Logs', 'Exit'],
            defaultId: 0,
            cancelId: 2,
            noLink: true
        });

        if (choice === 0) {
            app.relaunch();
            app.exit(0);
        } else if (choice === 1) {
            if (mainCrashLogPath && fs.existsSync(mainCrashLogPath)) {
                shell.showItemInFolder(mainCrashLogPath);
            } else if (logDir && fs.existsSync(logDir)) {
                shell.openPath(logDir);
            }
            app.exit(1);
        } else {
            app.exit(1);
        }
    } else {
        dialog.showErrorBox(
            'Application Startup Error',
            `${errorMessage}\n\n${errorStack}\n\nLog location: ${mainCrashLogPath || 'N/A'}`
        );
        app.exit(1);
    }
}

function initCrashReporter() {
    if (isInitialized) return;
    isInitialized = true;

    // 1. Capture uncaught JavaScript exceptions in Main process
    process.on('uncaughtException', (error) => {
        handleFatalError('UNCAUGHT_EXCEPTION', error);
    });

    // 2. Capture unhandled Promise rejections
    process.on('unhandledRejection', (reason, promise) => {
        console.error('[CRASH] UNHANDLED_REJECTION:', reason);
        writeCrashLog('UNHANDLED_REJECTION', reason);
    });

    // 3. Capture native child process exits / crashes
    if (typeof app.on === 'function') {
        app.on('child-process-gone', (event, details) => {
            console.warn('[CrashReporter] Child process gone:', details);
            writeCrashLog('CHILD_PROCESS_GONE', details.reason, details);
        });
    }
}

/**
 * Attaches crash and responsiveness listeners to a BrowserWindow instance
 */
function attachWindowCrashHandler(window) {
    if (!window || !window.webContents) return;

    window.webContents.on('render-process-gone', (event, details) => {
        const { reason, exitCode } = details;
        console.error(`[CrashReporter] Renderer process gone (reason: ${reason}, code: ${exitCode})`);
        writeCrashLog('RENDER_PROCESS_GONE', `Renderer crashed: ${reason} (code ${exitCode})`, details);

        if (reason === 'clean-exit') return;

        const choice = dialog.showMessageBoxSync(window, {
            type: 'warning',
            title: 'UI Process Error',
            message: 'The application user interface encountered an unexpected issue.',
            detail: `Reason: ${reason} (Exit Code: ${exitCode})\n\nWould you like to reload the window or restart the application?`,
            buttons: ['Reload Window', 'Restart App', 'Close App'],
            defaultId: 0,
            cancelId: 2,
            noLink: true
        });

        if (choice === 0) {
            window.reload();
        } else if (choice === 1) {
            app.relaunch();
            app.exit(0);
        } else {
            window.close();
        }
    });

    window.webContents.on('unresponsive', () => {
        console.warn('[CrashReporter] Window webContents is unresponsive.');
        writeCrashLog('WINDOW_UNRESPONSIVE', 'Main window became unresponsive.');
    });

    window.webContents.on('plugin-crashed', (event, name, version) => {
        console.warn(`[CrashReporter] Plugin crashed: ${name} v${version}`);
        writeCrashLog('PLUGIN_CRASHED', `Plugin crashed: ${name} v${version}`);
    });
}

module.exports = {
    initCrashReporter,
    attachWindowCrashHandler,
    writeCrashLog,
    getCrashLogPath: () => mainCrashLogPath
};
