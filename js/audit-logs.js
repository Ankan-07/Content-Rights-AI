import { auth, audit } from './api.js';

// State management
const auditState = {
    logs: [],
    totalLogs: 0,
    todayLogs: 0,
    activeUsers: 0,
    currentPage: 1,
    pageSize: 20,
    filters: {
        userId: '',
        action: '',
        dateFrom: '',
        dateTo: '',
        search: ''
    }
};

// DOM Elements
const elements = {
    totalLogs: document.getElementById('total-logs'),
    todayLogs: document.getElementById('today-logs'),
    activeUsers: document.getElementById('active-users'),
    logsList: document.getElementById('logs-list'),
    userFilter: document.getElementById('user-filter'),
    actionFilter: document.getElementById('action-filter'),
    dateFrom: document.getElementById('date-from'),
    dateTo: document.getElementById('date-to'),
    searchInput: document.getElementById('search-logs'),
    pageInfo: document.getElementById('page-info')
};

// Initialize the page
async function initializeAuditLogs() {
    try {
        // Load initial data
        await loadAuditStats();
        await loadLogs();
        await loadFilters();
        
        // Set up event listeners
        setupEventListeners();
    } catch (error) {
        showError('Failed to initialize audit logs');
        console.error('Initialization error:', error);
    }
}

// Load audit statistics
async function loadAuditStats() {
    try {
        const stats = await audit.getStats();
        auditState.totalLogs = stats.totalLogs;
        auditState.todayLogs = stats.todayLogs;
        auditState.activeUsers = stats.activeUsers;
        
        updateStatsUI();
    } catch (error) {
        showError('Failed to load audit statistics');
        console.error('Stats loading error:', error);
    }
}

// Update statistics UI
function updateStatsUI() {
    elements.totalLogs.textContent = auditState.totalLogs;
    elements.todayLogs.textContent = auditState.todayLogs;
    elements.activeUsers.textContent = auditState.activeUsers;
}

// Load audit logs
async function loadLogs() {
    try {
        const response = await audit.getLogs({
            page: auditState.currentPage,
            pageSize: auditState.pageSize,
            ...auditState.filters
        });

        auditState.logs = response.logs;
        updateLogsUI();
    } catch (error) {
        showError('Failed to load audit logs');
        console.error('Logs loading error:', error);
    }
}

// Update logs UI
function updateLogsUI() {
    const logs = auditState.logs;
    elements.logsList.innerHTML = logs.map(log => `
        <div class="log-item">
            <div class="log-header">
                <span class="log-user">${log.userName}</span>
                <span class="log-action">${log.action}</span>
                <span class="log-timestamp">${new Date(log.timestamp).toLocaleString()}</span>
            </div>
            <div class="log-details">
                <p>${log.details}</p>
                ${log.metadata ? `<pre>${JSON.stringify(log.metadata, null, 2)}</pre>` : ''}
            </div>
        </div>
    `).join('');

    // Update pagination info
    const totalPages = Math.ceil(auditState.totalLogs / auditState.pageSize);
    elements.pageInfo.textContent = `Page ${auditState.currentPage} of ${totalPages}`;
}

// Load filter options
async function loadFilters() {
    try {
        const { users, actions } = await audit.getFilterOptions();
        
        // Populate user filter
        elements.userFilter.innerHTML = `
            <option value="">All Users</option>
            ${users.map(user => `
                <option value="${user.id}">${user.displayName}</option>
            `).join('')}
        `;

        // Populate action filter
        elements.actionFilter.innerHTML = `
            <option value="">All Actions</option>
            ${actions.map(action => `
                <option value="${action}">${action}</option>
            `).join('')}
        `;
    } catch (error) {
        showError('Failed to load filter options');
        console.error('Filter loading error:', error);
    }
}

// Apply filters
function applyFilters() {
    auditState.filters = {
        userId: elements.userFilter.value,
        action: elements.actionFilter.value,
        dateFrom: elements.dateFrom.value,
        dateTo: elements.dateTo.value,
        search: elements.searchInput.value
    };
}

// Filter logs
async function filterLogs() {
    applyFilters();
    auditState.currentPage = 1; // Reset to first page
    await loadLogs();
}

// Export logs
async function exportLogs() {
    try {
        const response = await audit.exportLogs(auditState.filters);
        
        // Create download link
        const blob = new Blob([response.data], { type: 'application/json' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `audit-logs-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
    } catch (error) {
        showError('Failed to export logs');
        console.error('Export error:', error);
    }
}

// Pagination functions
async function previousPage() {
    if (auditState.currentPage > 1) {
        auditState.currentPage--;
        await loadLogs();
    }
}

async function nextPage() {
    const totalPages = Math.ceil(auditState.totalLogs / auditState.pageSize);
    if (auditState.currentPage < totalPages) {
        auditState.currentPage++;
        await loadLogs();
    }
}

// Set up event listeners
function setupEventListeners() {
    // Debounce search input
    let searchTimeout;
    elements.searchInput.addEventListener('input', () => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(filterLogs, 300);
    });
}

// Utility functions
function showError(message) {
    // Implementation depends on your UI framework
    alert(message);
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', initializeAuditLogs);

// Export functions for global use
window.exportLogs = exportLogs;
window.refreshLogs = loadLogs;
window.filterLogs = filterLogs;
window.previousPage = previousPage;
window.nextPage = nextPage; 