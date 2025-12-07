/**
 * سفید یاب | Sefid Yab - Theme Manager
 * 
 * @author Tawana Mohammadi
 * @website https://tawana.online
 * @license GPL-3.0
 */

export class ThemeManager {
    constructor(config) {
        this.config = config;
        this.currentTheme = config.THEME.current;
    }

    /**
     * Get current theme colors
     * @returns {Object} Theme colors
     */
    getColors() {
        return this.config.THEME[this.currentTheme];
    }

    /**
     * Toggle between dark and light theme
     */
    toggle() {
        this.currentTheme = this.currentTheme === 'dark' ? 'light' : 'dark';
        this.config.THEME.current = this.currentTheme;
        this.apply();
    }

    /**
     * Set specific theme
     * @param {string} theme - Theme name ('dark' or 'light')
     */
    setTheme(theme) {
        if (this.config.THEME[theme]) {
            this.currentTheme = theme;
            this.config.THEME.current = theme;
            this.apply();
        }
    }

    /**
     * Apply theme to UI
     */
    apply() {
        const colors = this.getColors();
        const dashboard = document.getElementById('sefidyab-dashboard');

        if (dashboard) {
            dashboard.style.background = colors.background;
            dashboard.style.color = colors.text;

            // Update all child elements
            const elements = dashboard.querySelectorAll('*');
            elements.forEach(el => {
                if (el.classList.contains('sefidyab-surface')) {
                    el.style.background = colors.surface;
                }
            });
        }

        // Dispatch theme change event
        document.dispatchEvent(new CustomEvent('sefidyab:themeChanged', {
            detail: { theme: this.currentTheme, colors }
        }));
    }

    /**
     * Get theme name
     * @returns {string} Current theme name
     */
    getCurrentTheme() {
        return this.currentTheme;
    }
}

export default ThemeManager;
