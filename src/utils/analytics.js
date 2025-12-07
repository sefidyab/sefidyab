/**
 * سفید یاب | Sefid Yab - Analytics Utility
 * 
 * @author Tawana Mohammadi
 * @website https://tawana.online
 * @license GPL-3.0
 */

export class Analytics {
    /**
     * Generate CSV from user data
     * @param {Array} users - Array of user objects
     * @returns {string} CSV string
     */
    static generateCSV(users) {
        if (!users || users.length === 0) return '';

        const headers = ['Username', 'Display Name', 'Status', 'Anomaly Score', 'Added At', 'Profile URL'];
        const rows = users.map(user => [
            user.username || '',
            user.displayName || '',
            user.status || 'unknown',
            (user.anomaly_score || 0).toFixed(2),
            user.addedAt || new Date().toISOString(),
            user.profileUrl || `https://x.com/${user.username}`
        ]);

        const csv = [headers, ...rows]
            .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
            .join('\n');

        return csv;
    }

    /**
     * Get statistics from user data
     * @param {Array} users - Array of user objects
     * @returns {Object} Statistics object
     */
    static getStatistics(users) {
        const stats = {
            total: users.length,
            shield: 0,
            safe: 0,
            anomaly: 0,
            hidden: 0,
            avgScore: 0,
            highRisk: 0,
            mediumRisk: 0,
            lowRisk: 0
        };

        let totalScore = 0;
        users.forEach(user => {
            // Count by status
            if (stats[user.status] !== undefined) {
                stats[user.status]++;
            }

            // Calculate average score
            const score = user.anomaly_score || 0;
            totalScore += score;

            // Risk categorization
            if (score >= 0.7) stats.highRisk++;
            else if (score >= 0.4) stats.mediumRisk++;
            else stats.lowRisk++;
        });

        stats.avgScore = users.length > 0 ? (totalScore / users.length).toFixed(2) : 0;

        return stats;
    }

    /**
     * Generate comprehensive report
     * @param {Array} users - Array of user objects
     * @param {Object} config - Configuration object
     * @returns {Object} Report object
     */
    static generateReport(users, config) {
        const stats = Analytics.getStatistics(users);
        const timestamp = new Date().toISOString();

        return {
            generated: timestamp,
            version: config.VERSION,
            author: config.AUTHOR,
            website: config.WEBSITE,
            doi: config.DOI,
            statistics: stats,
            users: users,
            metadata: {
                totalScanned: users.length,
                anomalyRate: ((stats.anomaly / stats.total) * 100).toFixed(2) + '%',
                safeRate: ((stats.safe / stats.total) * 100).toFixed(2) + '%',
                shieldRate: ((stats.shield / stats.total) * 100).toFixed(2) + '%'
            }
        };
    }

    /**
     * Download data as file
     * @param {string} data - Data to download
     * @param {string} filename - Filename
     * @param {string} type - MIME type
     */
    static downloadFile(data, filename, type = 'application/json') {
        const blob = new Blob([data], { type });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    /**
     * Export users to JSON
     * @param {Array} users - Array of user objects
     * @param {Object} config - Configuration object
     */
    static exportJSON(users, config) {
        const report = Analytics.generateReport(users, config);
        const data = JSON.stringify(report, null, 2);
        const filename = `sefidyab_export_${Date.now()}.json`;
        Analytics.downloadFile(data, filename, 'application/json');
    }

    /**
     * Export users to CSV
     * @param {Array} users - Array of user objects
     */
    static exportCSV(users) {
        const csv = Analytics.generateCSV(users);
        const filename = `sefidyab_export_${Date.now()}.csv`;
        Analytics.downloadFile(csv, filename, 'text/csv');
    }
}

export default Analytics;
