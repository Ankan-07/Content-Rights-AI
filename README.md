# Content Rights AI

A powerful AI-powered system for managing and analyzing content rights, contracts, and compliance.

## Features

- 🔒 Secure Authentication & Authorization
- 📄 Contract Analysis & Management
- 🌍 Geo-compliance Checking
- ⏰ Contract Expiry Monitoring
- 📊 Compliance Dashboard
- 📧 Automated Notifications
- 🔍 Advanced Search Capabilities
- 📝 Audit Logging

## Tech Stack

- Node.js
- Express.js
- Firebase (Authentication & Firestore)
- Google Gemini AI
- Nodemailer
- Express Rate Limiting
- Input Validation

## Prerequisites

- Node.js (v14 or higher)
- Firebase Account
- Google Gemini API Key
- Email Service (for notifications)

## Environment Variables

Create a `.env` file in the root directory with the following variables:

```env
PORT=5000
GEMINI_API_KEY=your_gemini_api_key
GOOGLE_APPLICATION_CREDENTIALS=path_to_firebase_credentials.json
EMAIL_SERVICE=gmail
EMAIL_USER=your_email
EMAIL_PASSWORD=your_email_password
NOTIFICATION_EMAILS=admin@example.com,compliance@example.com
SESSION_SECRET=your_session_secret
CORS_ORIGIN=http://localhost:3000
```

## Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/content-rights-ai.git
cd content-rights-ai
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env
# Edit .env with your credentials
```

4. Start the server:
```bash
npm start
```

## API Documentation

### Authentication Routes
- `POST /auth/register` - Register a new user
- `GET /auth/profile` - Get user profile

### Contract Management
- `POST /analyze-contract` - Analyze and store a contract
- `GET /search-contracts` - Search contracts
- `POST /edit-contract-clause` - Edit contract clauses

### Compliance
- `GET /check-geo-compliance/:contractId` - Check geo-compliance
- `GET /check-expired-contracts` - Check for expired contracts
- `GET /compliance-overview` - Get compliance dashboard stats
- `GET /export-compliance-report` - Export compliance report

### User Management
- `GET /users` - List all users
- `PUT /users/:userId/role` - Update user role

### Audit & Monitoring
- `GET /audit-logs` - Get audit logs
- `GET /violations` - Get compliance violations

## Security

- JWT-based authentication
- Role-based access control
- Rate limiting
- Input validation
- Secure session management
- CORS protection

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

For support, email support@example.com or create an issue in the repository. 