# Content Rights AI

A comprehensive system for managing digital content rights, ensuring compliance, and tracking violations through AI-powered analysis.

## Features

### Contract Analysis & Management
- Analyze contracts using Google's Gemini AI
- Extract key details like parties, allowed regions, and duration
- Track contract versions with full history
- Get AI-powered clause recommendations
- Manually edit clauses with smart placement

### Geo-Compliance Tracking
- Verify user locations against allowed regions
- Store and track violations
- Generate compliance reports

### License Expiry Management
- Automatic expiry detection
- Email notifications for approaching and expired contracts
- Configurable warning periods

### Dashboard Analytics
- Active & expired contract overview
- Compliance statistics
- Violation tracking and reporting

### User Management
- Role-based access control (Admin, Editor, Viewer)
- Comprehensive audit logging
- Multi-tenant support

### Notifications & Alerts
- Email notifications for violations and expiry
- Weekly compliance reports
- Customizable notification settings

## Getting Started

### Prerequisites
- Node.js v14+ and npm
- Firebase account with Firestore database
- Google Cloud account (for Gemini API)
- Gmail account (for email notifications)

### Installation

1. Clone the repository
```
git clone https://github.com/your-username/content-rights-ai.git
cd content-rights-ai
```

2. Install dependencies
```
npm install
```

3. Configure environment variables
```
cp .env.example .env
```

4. Edit the `.env` file with your credentials
   - Add your Gemini API key
   - Set the path to your Firebase service account JSON
   - Configure email settings

5. Start the server
```
npm start
```

### Cloud Functions Deployment

Deploy the scheduled tasks for automated compliance checking:

```
firebase deploy --only functions
```

## API Documentation

### Authentication
```
POST /auth/register - Register a new user
GET /auth/profile - Get the current user's profile
```

### Contract Management
```
POST /analyze-contract - Analyze and store a contract
POST /edit-contract-clause - Edit a contract clause
GET /search-contracts - Search for contracts
```

### Compliance
```
POST /check-geo-compliance - Check if a user's location complies with a contract
GET /check-expired-contracts - Check for expired contracts
GET /violations - Get list of compliance violations
```

### Reports & Dashboard
```
GET /active-contracts - Get all active contracts
GET /expired-contracts - Get all expired contracts
GET /compliance-overview - Get compliance statistics
GET /export-compliance-report - Export a compliance report
```

### Notifications
```
POST /notification-settings - Configure notification settings
GET /check-expiry-warnings - Check for contracts nearing expiry
GET /send-weekly-report - Send a weekly compliance report
```

## License

This project is licensed under the MIT License - see the LICENSE file for details. 