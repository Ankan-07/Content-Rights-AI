// API Configuration
const API_BASE_URL = 'https://content-rights-ai.onrender.com';

// Authentication Functions
const getAuthToken = () => {
    return localStorage.getItem('authToken');
};

const setAuthToken = (token) => {
    localStorage.setItem('authToken', token);
};

const removeAuthToken = () => {
    localStorage.removeItem('authToken');
};

// API Request Helper
const apiRequest = async (endpoint, options = {}) => {
    const token = getAuthToken();
    const headers = {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` }),
        ...options.headers
    };

    try {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
            ...options,
            headers
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'API request failed');
        }

        return await response.json();
    } catch (error) {
        console.error('API Error:', error);
        throw error;
    }
};

// Authentication API
const auth = {
    register: async (email, password, displayName) => {
        return apiRequest('/auth/register', {
            method: 'POST',
            body: JSON.stringify({ email, password, displayName })
        });
    },

    getProfile: async () => {
        return apiRequest('/auth/profile');
    },

    updateUserRole: async (userId, role) => {
        return apiRequest(`/users/${userId}/role`, {
            method: 'PUT',
            body: JSON.stringify({ role })
        });
    },

    listUsers: async () => {
        return apiRequest('/users');
    }
};

// Contract Management API
const contracts = {
    analyze: async (contractText, contractFormat = 'text', contractId = null) => {
        return apiRequest('/analyze-contract', {
            method: 'POST',
            body: JSON.stringify({ contractText, contractFormat, contractId })
        });
    },

    search: async (query, field = 'all', startDate, endDate, limit = 20) => {
        const params = new URLSearchParams({
            query,
            field,
            limit,
            ...(startDate && { startDate }),
            ...(endDate && { endDate })
        });
        return apiRequest(`/search-contracts?${params}`);
    },

    getActive: async () => {
        return apiRequest('/active-contracts');
    },

    getExpired: async () => {
        return apiRequest('/expired-contracts');
    },

    editClause: async (contractId, clauseEdit, clauseType, clauseContent) => {
        return apiRequest('/edit-contract-clause', {
            method: 'POST',
            body: JSON.stringify({ contractId, clauseEdit, clauseType, clauseContent })
        });
    },

    getRecommendations: async (contractId, contractText, recommendationType) => {
        return apiRequest('/clause-recommendations', {
            method: 'POST',
            body: JSON.stringify({ contractId, contractText, recommendationType })
        });
    }
};

// Compliance API
const compliance = {
    checkGeoCompliance: async (contractId, userIp) => {
        return apiRequest('/check-geo-compliance', {
            method: 'POST',
            body: JSON.stringify({ contractId, userIp })
        });
    },

    checkExpiredContracts: async () => {
        return apiRequest('/check-expired-contracts');
    },

    getViolations: async (contractId, limit = 50, type) => {
        const params = new URLSearchParams({
            limit,
            ...(contractId && { contractId }),
            ...(type && { type })
        });
        return apiRequest(`/violations?${params}`);
    },

    getOverview: async () => {
        return apiRequest('/compliance-overview');
    },

    exportReport: async (format = 'json', startDate, endDate) => {
        const params = new URLSearchParams({
            format,
            ...(startDate && { startDate }),
            ...(endDate && { endDate })
        });
        return apiRequest(`/export-compliance-report?${params}`);
    }
};

// Audit API
const audit = {
    getLogs: async (userId, action, startDate, endDate, limit = 50) => {
        const params = new URLSearchParams({
            limit,
            ...(userId && { userId }),
            ...(action && { action }),
            ...(startDate && { startDate }),
            ...(endDate && { endDate })
        });
        return apiRequest(`/audit-logs?${params}`);
    }
};

// Export API functions
export {
    auth,
    contracts,
    compliance,
    audit,
    getAuthToken,
    setAuthToken,
    removeAuthToken
}; 