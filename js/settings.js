import { auth, settings } from './api.js';

// State management
const settingsState = {
    currentSettings: null,
    defaultSettings: {
        language: 'en',
        timezone: 'UTC',
        dateFormat: 'MM/DD/YYYY',
        notifications: {
            email: true,
            contractAlerts: true,
            complianceAlerts: true,
            auditAlerts: true
        },
        api: {
            rateLimit: 100,
            timeout: 30
        },
        security: {
            twoFactorAuth: false,
            sessionTimeout: true,
            sessionDuration: 30,
            ipRestriction: false
        }
    }
};

// DOM Elements
const elements = {
    // General Settings
    defaultLanguage: document.getElementById('default-language'),
    timezone: document.getElementById('timezone'),
    dateFormat: document.getElementById('date-format'),
    
    // Notification Settings
    emailNotifications: document.getElementById('email-notifications'),
    contractAlerts: document.getElementById('contract-alerts'),
    complianceAlerts: document.getElementById('compliance-alerts'),
    auditAlerts: document.getElementById('audit-alerts'),
    
    // API Settings
    apiKey: document.getElementById('api-key'),
    apiRateLimit: document.getElementById('api-rate-limit'),
    apiTimeout: document.getElementById('api-timeout'),
    
    // Security Settings
    twoFactorAuth: document.getElementById('two-factor-auth'),
    sessionTimeout: document.getElementById('session-timeout'),
    sessionDuration: document.getElementById('session-duration'),
    ipRestriction: document.getElementById('ip-restriction')
};

// Initialize the page
async function initializeSettings() {
    try {
        // Load current settings
        await loadSettings();
        
        // Set up event listeners
        setupEventListeners();
    } catch (error) {
        showError('Failed to initialize settings');
        console.error('Initialization error:', error);
    }
}

// Load settings
async function loadSettings() {
    try {
        const userSettings = await settings.getSettings();
        settingsState.currentSettings = userSettings;
        updateSettingsUI(userSettings);
    } catch (error) {
        showError('Failed to load settings');
        console.error('Settings loading error:', error);
    }
}

// Update settings UI
function updateSettingsUI(settings) {
    // General Settings
    elements.defaultLanguage.value = settings.language;
    elements.timezone.value = settings.timezone;
    elements.dateFormat.value = settings.dateFormat;
    
    // Notification Settings
    elements.emailNotifications.checked = settings.notifications.email;
    elements.contractAlerts.checked = settings.notifications.contractAlerts;
    elements.complianceAlerts.checked = settings.notifications.complianceAlerts;
    elements.auditAlerts.checked = settings.notifications.auditAlerts;
    
    // API Settings
    elements.apiKey.value = settings.api.key;
    elements.apiRateLimit.value = settings.api.rateLimit;
    elements.apiTimeout.value = settings.api.timeout;
    
    // Security Settings
    elements.twoFactorAuth.checked = settings.security.twoFactorAuth;
    elements.sessionTimeout.checked = settings.security.sessionTimeout;
    elements.sessionDuration.value = settings.security.sessionDuration;
    elements.ipRestriction.checked = settings.security.ipRestriction;
}

// Save settings
async function saveSettings() {
    try {
        const updatedSettings = {
            language: elements.defaultLanguage.value,
            timezone: elements.timezone.value,
            dateFormat: elements.dateFormat.value,
            notifications: {
                email: elements.emailNotifications.checked,
                contractAlerts: elements.contractAlerts.checked,
                complianceAlerts: elements.complianceAlerts.checked,
                auditAlerts: elements.auditAlerts.checked
            },
            api: {
                key: elements.apiKey.value,
                rateLimit: parseInt(elements.apiRateLimit.value),
                timeout: parseInt(elements.apiTimeout.value)
            },
            security: {
                twoFactorAuth: elements.twoFactorAuth.checked,
                sessionTimeout: elements.sessionTimeout.checked,
                sessionDuration: parseInt(elements.sessionDuration.value),
                ipRestriction: elements.ipRestriction.checked
            }
        };

        await settings.updateSettings(updatedSettings);
        settingsState.currentSettings = updatedSettings;
        showSuccess('Settings saved successfully');
    } catch (error) {
        showError('Failed to save settings');
        console.error('Settings save error:', error);
    }
}

// Reset settings to defaults
async function resetSettings() {
    try {
        await settings.updateSettings(settingsState.defaultSettings);
        settingsState.currentSettings = settingsState.defaultSettings;
        updateSettingsUI(settingsState.defaultSettings);
        showSuccess('Settings reset to defaults');
    } catch (error) {
        showError('Failed to reset settings');
        console.error('Settings reset error:', error);
    }
}

// Show API key
function showApiKey() {
    const apiKeyInput = elements.apiKey;
    if (apiKeyInput.type === 'password') {
        apiKeyInput.type = 'text';
    } else {
        apiKeyInput.type = 'password';
    }
}

// Regenerate API key
async function regenerateApiKey() {
    try {
        const newKey = await settings.regenerateApiKey();
        elements.apiKey.value = newKey;
        showSuccess('API key regenerated successfully');
    } catch (error) {
        showError('Failed to regenerate API key');
        console.error('API key regeneration error:', error);
    }
}

// Set up event listeners
function setupEventListeners() {
    // Add any additional event listeners here
}

// Utility functions
function showError(message) {
    // Implementation depends on your UI framework
    alert(message);
}

function showSuccess(message) {
    // Implementation depends on your UI framework
    alert(message);
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', initializeSettings);

// Export functions for global use
window.saveSettings = saveSettings;
window.resetSettings = resetSettings;
window.showApiKey = showApiKey;
window.regenerateApiKey = regenerateApiKey; 