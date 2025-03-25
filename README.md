# Content Rights AI

An AI-powered system for managing content rights and compliance.

## Features

- Contract analysis and management
- Geo-compliance checking
- Contract expiration monitoring
- User management and role-based access control
- Audit logging
- Compliance reporting

## Prerequisites

- Node.js (v14 or higher)
- Firebase project with Firestore database
- Google Cloud Platform account (for Gemini API)
- Email service credentials (for notifications)

## Environment Variables

Create a `.env` file in the root directory with the following variables:

```env
PORT=5000
NODE_ENV=production
CORS_ORIGIN=your-frontend-url
SESSION_SECRET=your-session-secret
GEMINI_API_KEY=your-gemini-api-key
GOOGLE_APPLICATION_CREDENTIALS=path-to-firebase-credentials.json
EMAIL_SERVICE=gmail
EMAIL_USER=your-email
EMAIL_PASSWORD=your-email-password
NOTIFICATION_EMAILS=email1@example.com,email2@example.com
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

## Development

Run the development server:
```bash
npm run dev
```

## Production Deployment

### Option 1: Deploy to Render.com

1. Create a Render.com account
2. Connect your GitHub repository
3. Create a new Web Service
4. Configure the following:
   - Build Command: `npm install`
   - Start Command: `npm start`
   - Environment Variables: Add all variables from your .env file

### Option 2: Deploy to Heroku

1. Create a Heroku account
2. Install Heroku CLI
3. Login to Heroku:
```bash
heroku login
```

4. Create a new Heroku app:
```bash
heroku create content-rights-ai
```

5. Set environment variables:
```bash
heroku config:set NODE_ENV=production
heroku config:set GEMINI_API_KEY=your-key
# Set other environment variables
```

6. Deploy:
```bash
git push heroku main
```

## API Documentation

The API provides endpoints for:

- Authentication: `/auth/*`
- Contract Management: `/analyze-contract`, `/search-contracts`
- Compliance: `/check-geo-compliance`, `/check-expired-contracts`
- Dashboard: `/active-contracts`, `/compliance-overview`

For detailed API documentation, visit `/api-docs` when running the server.

## License

MIT
