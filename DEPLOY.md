# Render.com Deployment Guide for LegalLens

This document outlines the steps to deploy both the frontend and backend of LegalLens to Render.com.

## Prerequisites

- A GitHub repository containing the LegalLens application
- A Render.com account
- Firebase project (for backend authentication and database)

## Step 1: Deploy the Backend API

1. Log in to your Render.com dashboard
2. Click on "New" and select "Web Service"
3. Connect your GitHub repository
4. Configure the service:
   - **Name**: `legallens-backend`
   - **Runtime**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   
5. Add the following environment variables:
   ```
   PORT=5000
   NODE_ENV=production
   CORS_ORIGIN=https://legallens-w4dg.onrender.com
   SESSION_SECRET=<your-secure-session-secret>
   GOOGLE_APPLICATION_CREDENTIALS=./config/firebase-admin-key.json
   GEMINI_API_KEY=<your-gemini-api-key>
   EMAIL_SERVICE=gmail
   EMAIL_USER=<your-email>
   EMAIL_PASSWORD=<your-email-password>
   NOTIFICATION_EMAILS=<comma-separated-emails>
   IP2LOCATION_API_KEY=<your-ip2location-key>
   ```
   
6. Under "Advanced" settings, upload your Firebase admin key JSON file to the `/config` folder
7. Click "Create Web Service"

## Step 2: Deploy the Frontend

1. In your Render.com dashboard, click on "New" and select "Static Site"
2. Connect your GitHub repository
3. Configure the service:
   - **Name**: `legallens-frontend`
   - **Build Command**: `npm run render-build`
   - **Publish Directory**: `frontend/build`
   
4. Add the following environment variable:
   ```
   REACT_APP_API_URL=https://legallens-backend.onrender.com
   ```
   
5. Click "Create Static Site"

## Step 3: Test the Deployment

1. After both deployments complete, access your frontend at the provided Render.com URL (e.g., `https://legallens-frontend.onrender.com`)
2. The frontend should load and connect to the backend API
3. Test basic functionality to ensure everything is working correctly

## Troubleshooting

### Missing render-build script
If you encounter an error like "Missing script: render-build", ensure that:
- The root `package.json` contains a script named `render-build`
- The frontend `package.json` has the necessary build scripts
- You're using the recommended build command: `npm run render-build`

### CORS Issues
If the frontend cannot connect to the backend, check:
- That the `CORS_ORIGIN` environment variable in the backend includes the frontend URL
- That the `REACT_APP_API_URL` in the frontend points to the correct backend URL

### Firebase Configuration Issues
If you encounter Firebase authentication errors:
- Verify the Firebase admin key is correctly uploaded
- Check that the `GOOGLE_APPLICATION_CREDENTIALS` path is correct

## Using Blueprint for Automated Deployment

For easier deployment, you can use the `render.yaml` file at the root of the repository with the Render Blueprint feature:

1. Go to the Render Dashboard
2. Click "Blueprint" at the top of the page
3. Connect your repository
4. Render will detect the `render.yaml` file and configure both services automatically
5. Review the settings and click "Apply"

This will deploy both the frontend and backend in one step.