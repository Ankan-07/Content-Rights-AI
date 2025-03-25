import { auth, compliance } from './api.js';

// State management
const complianceState = {
    violations: [],
    overview: {
        totalViolations: 0,
        activeViolations: 0,
        resolvedViolations: 0,
        complianceRate: 0
    }
};

// DOM Elements
const elements = {
    userName: document.getElementById('user-name'),
    totalViolations: document.getElementById('total-violations'),
    activeViolations: document.getElementById('active-violations'),
    resolvedViolations: document.getElementById('resolved-violations'),
    complianceRate: document.getElementById('compliance-rate'),
    violationsContainer: document.getElementById('violations-container'),
    violationType: document.getElementById('violation-type'),
    violationStatus: document.getElementById('violation-status'),
    startDate: document.getElementById('start-date'),
    endDate: document.getElementById('end-date'),
    geoComplianceForm: document.getElementById('geo-compliance-form'),
    violationDetails: document.getElementById('violation-details')
};

// Initialize the page
async function initializeCompliance() {
    try {
        // Load user profile
        const profile = await auth.getProfile();
        elements.userName.textContent = profile.name;

        // Load compliance data
        await loadComplianceOverview();
        await loadViolations();

        // Set up event listeners
        setupEventListeners();
    } catch (error) {
        showError('Failed to initialize compliance page');
        console.error('Initialization error:', error);
    }
}

// Load compliance overview
async function loadComplianceOverview() {
    try {
        const overview = await compliance.getOverview();
        complianceState.overview = overview;
        updateOverviewUI();
    } catch (error) {
        showError('Failed to load compliance overview');
        console.error('Overview loading error:', error);
    }
}

// Load violations
async function loadViolations() {
    try {
        const filters = {
            type: elements.violationType.value,
            status: elements.violationStatus.value,
            startDate: elements.startDate.value,
            endDate: elements.endDate.value
        };

        const violations = await compliance.getViolations(filters);
        complianceState.violations = violations;
        updateViolationsUI();
    } catch (error) {
        showError('Failed to load violations');
        console.error('Violations loading error:', error);
    }
}

// Update overview UI
function updateOverviewUI() {
    const { totalViolations, activeViolations, resolvedViolations, complianceRate } = complianceState.overview;
    
    elements.totalViolations.textContent = totalViolations;
    elements.activeViolations.textContent = activeViolations;
    elements.resolvedViolations.textContent = resolvedViolations;
    elements.complianceRate.textContent = `${complianceRate}%`;
}

// Update violations UI
function updateViolationsUI() {
    const violations = complianceState.violations;
    elements.violationsContainer.innerHTML = violations.map(violation => `
        <div class="violation-card" onclick="viewViolationDetails('${violation.id}')">
            <div class="violation-header">
                <h3>${violation.type}</h3>
                <span class="status ${violation.status}">${violation.status}</span>
            </div>
            <div class="violation-content">
                <p><strong>Contract:</strong> ${violation.contractName}</p>
                <p><strong>Date:</strong> ${new Date(violation.date).toLocaleDateString()}</p>
                <p><strong>Description:</strong> ${violation.description}</p>
            </div>
        </div>
    `).join('');
}

// View violation details
async function viewViolationDetails(violationId) {
    try {
        const violation = complianceState.violations.find(v => v.id === violationId);
        if (!violation) {
            throw new Error('Violation not found');
        }

        elements.violationDetails.innerHTML = `
            <div class="violation-details-content">
                <h3>${violation.type}</h3>
                <p><strong>Status:</strong> ${violation.status}</p>
                <p><strong>Contract:</strong> ${violation.contractName}</p>
                <p><strong>Date:</strong> ${new Date(violation.date).toLocaleDateString()}</p>
                <p><strong>Description:</strong> ${violation.description}</p>
                <p><strong>Impact:</strong> ${violation.impact}</p>
                <p><strong>Recommended Action:</strong> ${violation.recommendedAction}</p>
            </div>
        `;

        document.getElementById('violation-details-modal').style.display = 'block';
    } catch (error) {
        showError('Failed to load violation details');
        console.error('Violation details error:', error);
    }
}

// Resolve violation
async function resolveViolation() {
    try {
        const violationId = elements.violationDetails.dataset.violationId;
        await compliance.resolveViolation(violationId);
        
        // Refresh data
        await loadComplianceOverview();
        await loadViolations();
        
        // Close modal
        document.getElementById('violation-details-modal').style.display = 'none';
        
        showSuccess('Violation resolved successfully');
    } catch (error) {
        showError('Failed to resolve violation');
        console.error('Violation resolution error:', error);
    }
}

// Check geo-compliance
async function checkGeoCompliance(contractId, userIp) {
    try {
        const result = await compliance.checkGeoCompliance(contractId, userIp);
        showSuccess(`Geo-compliance check completed: ${result.compliant ? 'Compliant' : 'Non-compliant'}`);
        document.getElementById('geo-compliance-modal').style.display = 'none';
    } catch (error) {
        showError('Failed to check geo-compliance');
        console.error('Geo-compliance check error:', error);
    }
}

// Check expired contracts
async function checkExpiredContracts() {
    try {
        const result = await compliance.checkExpiredContracts();
        showSuccess(`Found ${result.expiredCount} expired contracts`);
        await loadViolations(); // Refresh violations list
    } catch (error) {
        showError('Failed to check expired contracts');
        console.error('Expired contracts check error:', error);
    }
}

// Set up event listeners
function setupEventListeners() {
    // Filter change listeners
    elements.violationType.addEventListener('change', loadViolations);
    elements.violationStatus.addEventListener('change', loadViolations);
    elements.startDate.addEventListener('change', loadViolations);
    elements.endDate.addEventListener('change', loadViolations);

    // Geo-compliance form submission
    elements.geComplianceForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const contractId = document.getElementById('contract-id').value;
        const userIp = document.getElementById('user-ip').value;
        await checkGeoCompliance(contractId, userIp);
    });
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
document.addEventListener('DOMContentLoaded', initializeCompliance); 