import { contracts, compliance, audit } from './api.js';

// Dashboard State
let dashboardState = {
    activeContracts: [],
    expiredContracts: [],
    violations: [],
    complianceOverview: null,
    recentActivity: []
};

// DOM Elements
const activeContractsList = document.getElementById('active-contracts-list');
const expiredContractsList = document.getElementById('expired-contracts-list');
const violationsList = document.getElementById('violations-list');
const complianceOverviewCard = document.getElementById('compliance-overview');
const recentActivityList = document.getElementById('recent-activity');

// Initialize Dashboard
async function initializeDashboard() {
    try {
        await Promise.all([
            loadActiveContracts(),
            loadExpiredContracts(),
            loadViolations(),
            loadComplianceOverview(),
            loadRecentActivity()
        ]);
        updateDashboardUI();
    } catch (error) {
        console.error('Failed to initialize dashboard:', error);
        showError('Failed to load dashboard data');
    }
}

// Load Active Contracts
async function loadActiveContracts() {
    try {
        const response = await contracts.getActive();
        dashboardState.activeContracts = response.contracts;
    } catch (error) {
        console.error('Failed to load active contracts:', error);
    }
}

// Load Expired Contracts
async function loadExpiredContracts() {
    try {
        const response = await contracts.getExpired();
        dashboardState.expiredContracts = response.contracts;
    } catch (error) {
        console.error('Failed to load expired contracts:', error);
    }
}

// Load Violations
async function loadViolations() {
    try {
        const response = await compliance.getViolations();
        dashboardState.violations = response.violations;
    } catch (error) {
        console.error('Failed to load violations:', error);
    }
}

// Load Compliance Overview
async function loadComplianceOverview() {
    try {
        const response = await compliance.getOverview();
        dashboardState.complianceOverview = response;
    } catch (error) {
        console.error('Failed to load compliance overview:', error);
    }
}

// Load Recent Activity
async function loadRecentActivity() {
    try {
        const response = await audit.getLogs(null, null, null, null, 5);
        dashboardState.recentActivity = response.logs;
    } catch (error) {
        console.error('Failed to load recent activity:', error);
    }
}

// Update Dashboard UI
function updateDashboardUI() {
    updateActiveContractsList();
    updateExpiredContractsList();
    updateViolationsList();
    updateComplianceOverview();
    updateRecentActivity();
}

// Update Active Contracts List
function updateActiveContractsList() {
    if (!activeContractsList) return;
    
    activeContractsList.innerHTML = dashboardState.activeContracts
        .map(contract => `
            <div class="contract-card">
                <h3>${contract.title}</h3>
                <p>Status: ${contract.status}</p>
                <p>Expiry: ${new Date(contract.expiryDate).toLocaleDateString()}</p>
                <button onclick="viewContract('${contract.id}')">View Details</button>
            </div>
        `)
        .join('');
}

// Update Expired Contracts List
function updateExpiredContractsList() {
    if (!expiredContractsList) return;
    
    expiredContractsList.innerHTML = dashboardState.expiredContracts
        .map(contract => `
            <div class="contract-card expired">
                <h3>${contract.title}</h3>
                <p>Expired: ${new Date(contract.expiryDate).toLocaleDateString()}</p>
                <button onclick="renewContract('${contract.id}')">Renew Contract</button>
            </div>
        `)
        .join('');
}

// Update Violations List
function updateViolationsList() {
    if (!violationsList) return;
    
    violationsList.innerHTML = dashboardState.violations
        .map(violation => `
            <div class="violation-card">
                <h3>${violation.type}</h3>
                <p>Contract: ${violation.contractTitle}</p>
                <p>Status: ${violation.status}</p>
                <button onclick="resolveViolation('${violation.id}')">Resolve</button>
            </div>
        `)
        .join('');
}

// Update Compliance Overview
function updateComplianceOverview() {
    if (!complianceOverviewCard || !dashboardState.complianceOverview) return;
    
    const overview = dashboardState.complianceOverview;
    complianceOverviewCard.innerHTML = `
        <div class="compliance-stats">
            <div class="stat-card">
                <h3>Overall Compliance</h3>
                <p class="stat-value">${overview.overallCompliance}%</p>
            </div>
            <div class="stat-card">
                <h3>Active Contracts</h3>
                <p class="stat-value">${overview.activeContracts}</p>
            </div>
            <div class="stat-card">
                <h3>Expired Contracts</h3>
                <p class="stat-value">${overview.expiredContracts}</p>
            </div>
            <div class="stat-card">
                <h3>Violations</h3>
                <p class="stat-value">${overview.violations}</p>
            </div>
        </div>
    `;
}

// Update Recent Activity
function updateRecentActivity() {
    if (!recentActivityList) return;
    
    recentActivityList.innerHTML = dashboardState.recentActivity
        .map(activity => `
            <div class="activity-item">
                <p>${activity.action}</p>
                <small>${new Date(activity.timestamp).toLocaleString()}</small>
            </div>
        `)
        .join('');
}

// Error Handling
function showError(message) {
    // Implement error notification UI
    console.error(message);
}

// Event Handlers
function viewContract(contractId) {
    window.location.href = `/contract-management.html?id=${contractId}`;
}

function renewContract(contractId) {
    window.location.href = `/contract-management.html?id=${contractId}&action=renew`;
}

function resolveViolation(violationId) {
    window.location.href = `/compliance.html?id=${violationId}`;
}

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', initializeDashboard); 