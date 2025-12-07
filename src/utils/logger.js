/**
 * سفید یاب | Sefid Yab - Logger Utility
 * 
 * @author Tawana Mohammadi
 * @website https://tawana.online
 * @license GPL-3.0
 */

export class Logger {
    constructor(config) {
        this.config = config;
        this.logs = [];
    }

    log(level, message, data = {}) {
        if (!this.config.LOGGING.enabled) return;

        const logEntry = {
            timestamp: new Date().toISOString(),
            level,
            message,
            data,
            version: this.config.VERSION
        };

        // Console logging
        if (this.config.LOGGING.console) {
            const color = {
                debug: '#8899a6',
                info: '#1d9bf0',
                warn: '#ff6b00',
                error: '#f4212e'
            }[level] || '#ffffff';

            console.log(
                `%c[Sefidyab ${level.toUpperCase()}]%c ${message}`,
                `color: ${color}; font-weight: bold;`,
                'color: inherit;',
                data
            );
        }

        // Storage logging
        if (this.config.LOGGING.storage) {
            this.logs.push(logEntry);
            if (this.logs.length > this.config.LOGGING.maxLogs) {
                this.logs.shift();
            }
        }
    }

    debug(msg, data) { this.log('debug', msg, data); }
    info(msg, data) { this.log('info', msg, data); }
    warn(msg, data) { this.log('warn', msg, data); }
    error(msg, data) { this.log('error', msg, data); }

    export() {
        return JSON.stringify(this.logs, null, 2);
    }

    clear() {
        this.logs = [];
    }

    getLogs(level = null) {
        if (level) {
            return this.logs.filter(log => log.level === level);
        }
        return this.logs;
    }
}

export default Logger;
