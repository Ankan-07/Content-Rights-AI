import { auth, audit } from './api.js';

// State management
const profileState = {
    user: null,
    recentActivity: []
};

// DOM Elements
const elements = {
    userName: document.getElementById('user-name'),
    displayName: document.getElementById('display-name'),
    email: document.getElementById('email'),
    role: document.getElementById('role'),
    permissions: document.getElementById('permissions'),
    memberSince: document.getElementById('member-since'),
    activityList: document.getElementById('activity-list'),
    editProfileForm: document.getElementById('edit-profile-form'),
    changePasswordForm: document.getElementById('change-password-form'),
    editDisplayName: document.getElementById('edit-display-name')
};

// Initialize the page
async function initializeProfile() {
    try {
        // Load user profile
        const profile = await auth.getProfile();
        profileState.user = profile;
        updateProfileUI(profile);

        // Load recent activity
        await loadRecentActivity();

        // Set up event listeners
        setupEventListeners();
    } catch (error) {
        showError('Failed to initialize profile page');
        console.error('Initialization error:', error);
    }
}

// Update profile UI
function updateProfileUI(profile) {
    elements.userName.textContent = profile.displayName;
    elements.displayName.textContent = profile.displayName;
    elements.email.textContent = profile.email;
    elements.role.textContent = profile.role;
    elements.memberSince.textContent = new Date(profile.createdAt).toLocaleDateString();
    
    // Update permissions list
    elements.permissions.innerHTML = profile.permissions.map(permission => `
        <span class="permission-tag">${permission}</span>
    `).join('');

    // Set current display name in edit form
    elements.editDisplayName.value = profile.displayName;
}

// Load recent activity
async function loadRecentActivity() {
    try {
        const activity = await audit.getLogs({
            userId: profileState.user.uid,
            limit: 10
        });

        profileState.recentActivity = activity.logs;
        updateActivityUI();
    } catch (error) {
        showError('Failed to load recent activity');
        console.error('Activity loading error:', error);
    }
}

// Update activity UI
function updateActivityUI() {
    const activity = profileState.recentActivity;
    elements.activityList.innerHTML = activity.map(item => `
        <div class="activity-item">
            <p>${item.action}</p>
            <small>${new Date(item.timestamp).toLocaleString()}</small>
        </div>
    `).join('');
}

// Edit profile
async function handleEditProfile(e) {
    e.preventDefault();
    try {
        const newDisplayName = elements.editDisplayName.value;
        await auth.updateProfile({ displayName: newDisplayName });
        
        // Update UI
        profileState.user.displayName = newDisplayName;
        updateProfileUI(profileState.user);
        
        // Close modal
        document.getElementById('edit-profile-modal').style.display = 'none';
        
        showSuccess('Profile updated successfully');
    } catch (error) {
        showError('Failed to update profile');
        console.error('Profile update error:', error);
    }
}

// Change password
async function handleChangePassword(e) {
    e.preventDefault();
    try {
        const currentPassword = document.getElementById('current-password').value;
        const newPassword = document.getElementById('new-password').value;
        const confirmPassword = document.getElementById('confirm-password').value;

        if (newPassword !== confirmPassword) {
            showError('New passwords do not match');
            return;
        }

        await auth.changePassword(currentPassword, newPassword);
        
        // Close modal and reset form
        document.getElementById('change-password-modal').style.display = 'none';
        e.target.reset();
        
        showSuccess('Password changed successfully');
    } catch (error) {
        showError('Failed to change password');
        console.error('Password change error:', error);
    }
}

// Set up event listeners
function setupEventListeners() {
    elements.editProfileForm.addEventListener('submit', handleEditProfile);
    elements.changePasswordForm.addEventListener('submit', handleChangePassword);
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
document.addEventListener('DOMContentLoaded', initializeProfile); 