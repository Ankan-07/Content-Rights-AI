require("dotenv").config();
const express = require("express");
const axios = require("axios");
const cors = require("cors");
const admin = require("firebase-admin");

const bodyParser = require("body-parser");
const nodemailer = require("nodemailer");
const session = require("express-session");
const cookieParser = require("cookie-parser");
const rateLimit = require("express-rate-limit");
const { body, query, param, validationResult } = require("express-validator");

//ip2location.IP2Location_init("IP2LOCATION-LITE-DB11.BIN");

const app = express();
app.use(express.json());

// CORS Configuration
const corsOrigins = [
    'https://legallens-w4dg.onrender.com',
    'http://localhost:3000'
];

app.use(cors({
    origin: function(origin, callback) {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true);
        
        if (corsOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            console.log('CORS blocked for origin:', origin);
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(cookieParser());
app.use(session({
    secret: process.env.SESSION_SECRET || "content-rights-ai-secret",
    resave: false,
    saveUninitialized: false,
    cookie: { 
        secure: process.env.NODE_ENV === "production", 
        maxAge: 1000 * 60 * 60 * 24 // 1 day
    }
}));

// Apply rate limiting
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        error: "Too many requests, please try again later."
    }
});

// Apply rate limiting to all API routes
app.use("/api/", apiLimiter);

// Higher rate limit for authenticated routes
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        error: "Too many requests, please try again later."
    }
});

// Input validation middleware
const validateRequest = (validations) => {
    return async (req, res, next) => {
        // Run all validations
        await Promise.all(validations.map(validation => validation.run(req)));
        
        // Check for validation errors
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ 
                error: "Validation Error", 
                details: errors.array() 
            });
        }
        
        next();
    };
};

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const serviceAccount = require(process.env.GOOGLE_APPLICATION_CREDENTIALS);

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;
console.log("✅ Firestore Initialized Successfully");

// Define user roles and permissions
const USER_ROLES = {
    ADMIN: "admin",
    EDITOR: "editor",
    VIEWER: "viewer"
};

const ROLE_PERMISSIONS = {
    [USER_ROLES.ADMIN]: ["read", "write", "delete", "manage_users"],
    [USER_ROLES.EDITOR]: ["read", "write"],
    [USER_ROLES.VIEWER]: ["read"]
};

// Authentication middleware
const authenticateUser = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            console.error("❌ Missing or invalid Authorization header");
            return res.status(401).json({ error: "Unauthorized: No token provided" });
        }

        const idToken = authHeader.split("Bearer ")[1];

        // Verify Firebase token
        const decodedToken = await admin.auth().verifyIdToken(idToken);

        if (!decodedToken) {
            console.error("❌ Invalid Firebase token");
            return res.status(401).json({ error: "Unauthorized: Invalid token" });
        }

        // Get user from Firestore to check role
        const userDoc = await db.collection("users").doc(decodedToken.uid).get();
        
        if (!userDoc.exists) {
            // User exists in Firebase Auth but not in Firestore - create profile
            const userProfile = {
                uid: decodedToken.uid,
                email: decodedToken.email,
                displayName: decodedToken.name || decodedToken.email.split("@")[0],
                role: USER_ROLES.VIEWER, // Default role
                createdAt: FieldValue.serverTimestamp()
            };
            
            await db.collection("users").doc(decodedToken.uid).set(userProfile);
            
            req.user = userProfile;
        } else {
            // User exists in Firestore
            req.user = userDoc.data();
        }
        
        // Store user roles and permissions for access control
        req.userRole = req.user.role || USER_ROLES.VIEWER;
        req.userPermissions = ROLE_PERMISSIONS[req.userRole] || ROLE_PERMISSIONS[USER_ROLES.VIEWER];
        
        // Log activity for audit trail
        db.collection("audit_logs").add({
            userId: req.user.uid,
            userEmail: req.user.email,
            action: "API_ACCESS",
            endpoint: req.originalUrl,
            method: req.method,
            timestamp: FieldValue.serverTimestamp(),
            userIp: req.ip
        });
        
        next();
    } catch (error) {
        console.error("❌ Authentication error:", error.message);
        res.status(401).json({ error: "Unauthorized: " + error.message });
    }
};

// Authorization middleware
const authorizeUser = (requiredPermissions) => {
    return (req, res, next) => {
        // Skip authorization check if the route doesn't require it
        if (!requiredPermissions || requiredPermissions.length === 0) {
            return next();
        }
        
        const userPermissions = req.userPermissions || [];
        
        // Check if user has all required permissions
        const hasPermission = requiredPermissions.every(permission => 
            userPermissions.includes(permission)
        );
        
        if (!hasPermission) {
            return res.status(403).json({ 
                error: "Forbidden: Insufficient permissions",
                required: requiredPermissions,
                userRole: req.userRole
            });
        }
        
        next();
    };
};

// Initialize Email Service
const emailTransporter = nodemailer.createTransport({
    service: process.env.EMAIL_SERVICE || "gmail",
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD
    }
});

// Helper function to send email notifications
const sendEmailNotification = async (to, subject, text, html) => {
    try {
        if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
            console.warn("⚠️ Email credentials not configured. Skipping email notification.");
            return false;
        }
        
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: Array.isArray(to) ? to.join(',') : to,
            subject,
            text,
            html: html || text
        };
        
        const info = await emailTransporter.sendMail(mailOptions);
        console.log(`✅ Email notification sent: ${info.messageId}`);
        return true;
    } catch (error) {
        console.error("❌ Error sending email notification:", error);
        return false;
    }
};

// ====================== USER MANAGEMENT ROUTES ======================

// Route: Register a new user
app.post("/auth/register", async (req, res) => {
    try {
        const { email, password, displayName } = req.body;
        
        if (!email || !password) {
            return res.status(400).json({ error: "Email and password are required" });
        }
        
        // Create the user in Firebase Auth
        const userRecord = await admin.auth().createUser({
            email,
            password,
            displayName: displayName || email.split("@")[0]
        });
        
        // Create user profile in Firestore
        await db.collection("users").doc(userRecord.uid).set({
            uid: userRecord.uid,
            email,
            displayName: displayName || email.split("@")[0],
            role: USER_ROLES.VIEWER, // Default role
            createdAt: FieldValue.serverTimestamp()
        });
        
        res.status(201).json({ 
            message: "User registered successfully",
            uid: userRecord.uid
        });
        
    } catch (error) {
        console.error("❌ Error registering user:", error);
        res.status(500).json({ error: "Internal Server Error - " + error.message });
    }
});

// Route: Get user profile (requires authentication)
app.get("/auth/profile", authenticateUser, (req, res) => {
    // User already available from authentication middleware
    const user = req.user;
    
    res.json({ 
        user: {
            uid: user.uid,
            email: user.email,
            displayName: user.displayName,
            role: user.role,
            permissions: req.userPermissions
        }
    });
});

// Route: Update user role (admin only)
app.put("/users/:userId/role", authenticateUser, authorizeUser(["manage_users"]), async (req, res) => {
    try {
        const { userId } = req.params;
        const { role } = req.body;
        
        if (!role || !Object.values(USER_ROLES).includes(role)) {
            return res.status(400).json({ 
                error: "Invalid role",
                validRoles: Object.values(USER_ROLES)
            });
        }
        
        // Check if user exists
        const userDoc = await db.collection("users").doc(userId).get();
        
        if (!userDoc.exists) {
            return res.status(404).json({ error: "User not found" });
        }
        
        // Update user role
        await db.collection("users").doc(userId).update({
            role,
            updatedAt: FieldValue.serverTimestamp(),
            updatedBy: req.user.uid
        });
        
        // Log the role change for audit
        await db.collection("audit_logs").add({
            userId: req.user.uid,
            userEmail: req.user.email,
            action: "UPDATE_USER_ROLE",
            targetUserId: userId,
            oldRole: userDoc.data().role,
            newRole: role,
            timestamp: FieldValue.serverTimestamp()
        });
        
        res.json({ 
            message: "User role updated successfully",
            userId,
            role
        });
        
    } catch (error) {
        console.error("❌ Error updating user role:", error);
        res.status(500).json({ error: "Internal Server Error - " + error.message });
    }
});

// Route: List all users (admin only)
app.get("/users", authenticateUser, authorizeUser(["manage_users"]), async (req, res) => {
    try {
        const usersSnapshot = await db.collection("users").get();
        
        let users = [];
        
        usersSnapshot.forEach(doc => {
            const userData = doc.data();
            users.push({
                uid: userData.uid,
                email: userData.email,
                displayName: userData.displayName,
                role: userData.role,
                createdAt: userData.createdAt?.toDate() || null
            });
        });
        
        res.json({ users });
        
    } catch (error) {
        console.error("❌ Error listing users:", error);
        res.status(500).json({ error: "Internal Server Error - " + error.message });
    }
});

// ====================== PROTECTED API ROUTES ======================

// Route: Analyze contract and store in Firestore
app.post("/analyze-contract", 
    authenticateUser, 
    authorizeUser(["write"]),
    validateRequest([
        body("contractText").notEmpty().withMessage("Contract text is required"),
        body("contractFormat").optional().isIn(["text", "pdf", "docx"]),
        body("contractId").optional().isString()
    ]),
    async (req, res) => {
    try {
        const { contractText, contractFormat, contractId } = req.body;

        if (!contractText) {
            return res.status(400).json({ error: "Contract text is required" });
        }
        
        // Validate contract format
        const validFormats = ['text', 'pdf', 'docx']; // Supported formats
        if (contractFormat && !validFormats.includes(contractFormat)) {
            return res.status(400).json({ 
                error: "Invalid contract format. Supported formats: text, pdf, docx",
                validFormats
            });
        }

        const response = await axios.post(
            "https://generativelanguage.googleapis.com/v1/models/gemini-pro:generateContent",
            {
                contents: [
                    {
                        parts: [
                            {
                                text: `Extract key details from the following contract and return only JSON in this format:

{
  "title": "Contract Title",
  "parties": ["Party A", "Party B"],
  "rights": ["Streaming in India and USA"],
  "allowed_regions": ["India", "USA"],
  "duration": {
    "start_date": "YYYY-MM-DD",
    "end_date": "YYYY-MM-DD"
  },
  "revenue_sharing": "30%"
}

Contract text: "${contractText}"`
                            }
                        ]
                    }
                ]
            },
            {
                headers: { "Content-Type": "application/json" },
                params: { key: GEMINI_API_KEY }
            }
        );

        console.log("Full API Response:", JSON.stringify(response.data, null, 2));

        let rawText = response.data.candidates[0]?.content?.parts[0]?.text || "";

        // Remove Markdown-style code blocks (```json ... ```)
        rawText = rawText.replace(/```json\s*([\s\S]*?)\s*```/i, "$1").trim();

        // Attempt to parse as JSON
        let contractDetails;
        try {
            contractDetails = JSON.parse(rawText);
        } catch (jsonError) {
            console.warn("❌ Warning: Response is not valid JSON. Returning raw text.");
            return res.status(500).json({ error: "Invalid JSON response", rawText });
        }

        // Store analyzed contract in Firestore
        let docRef;
        
        if (contractId) {
            // This is an update to an existing contract - implement versioning
            const existingDoc = await db.collection("contracts").doc(contractId).get();
            
            if (!existingDoc.exists) {
                return res.status(404).json({ error: "Contract not found for updating" });
            }
            
            // Get the existing contract data
            const existingData = existingDoc.data();
            
            // Create a version record in the versions subcollection
            await db.collection("contracts").doc(contractId).collection("versions").add({
                contractDetails: existingData.contractDetails,
                originalText: existingData.originalText,
                timestamp: existingData.timestamp,
                versionCreatedAt: FieldValue.serverTimestamp()
            });
            
            // Update the existing contract
            await db.collection("contracts").doc(contractId).update({
            contractDetails,
            originalText: contractText,
                timestamp: FieldValue.serverTimestamp(),
                versionCount: FieldValue.increment(1)
            });
            
            docRef = { id: contractId };
        } else {
            // This is a new contract
            docRef = await db.collection("contracts").add({
                contractDetails,
                originalText: contractText,
                timestamp: FieldValue.serverTimestamp(),
                versionCount: 1,
                violationCount: 0
            });
        }

        res.json({ id: docRef.id, contractDetails });

    } catch (error) {
        console.error("❌ Error analyzing contract:", error.message);
        res.status(500).json({ error: "Internal Server Error - " + error.message });
    }
});

// Route: Test Firestore Connection
app.get("/test-firestore", async (req, res) => {
    try {
        const docRef = await db.collection("test").add({
            message: "Firestore is connected!",
            timestamp: FieldValue.serverTimestamp()
        });

        res.json({ id: docRef.id, message: "Firestore connection successful!" });
    } catch (error) {
        console.error("❌ Error connecting to Firestore:", error);
        res.status(500).json({ error: "Failed to connect to Firestore" });
    }
});

// Extract allowed regions from contract text
app.get("/check-geo-compliance/:contractId", async (req, res) => {
    try {
        const { contractId } = req.params;
        const docRef = db.collection("contracts").doc(contractId);
        const doc = await docRef.get();

        if (!doc.exists) {
            console.warn(`⚠️ Contract not found: ${contractId}`);
            return res.status(404).json({ error: "Contract not found" });
        }

        const contractData = doc.data();
        const allowedRegions = contractData?.contractDetails?.rights;

        if (!allowedRegions || !Array.isArray(allowedRegions)) {
            console.warn(`⚠️ No valid region data found for contract: ${contractId}`);
            return res.status(400).json({ error: "No valid region data found" });
        }

        console.log(`✅ Contract ID: ${contractId}, Allowed Regions:`, allowedRegions);
        res.json({ contractId, allowedRegions });

    } catch (error) {
        console.error("❌ Error checking geo compliance:", error);
        res.status(500).json({ error: `Internal Server Error - ${error.message}` });
    }
});

app.post("/check-geo-compliance", 
    authenticateUser, 
    authorizeUser(["read"]),
    validateRequest([
        body("contractId").notEmpty().withMessage("Contract ID is required"),
        body("userIp").notEmpty().withMessage("User IP is required"),
    ]),
    async (req, res) => {
    try {
        const { contractId, userIp } = req.body;

        if (!contractId || !userIp) {
            return res.status(400).json({ error: "Contract ID and User IP are required" });
        }

        console.log("Received Request Body:", req.body);

        // Fetch contract details from Firestore
        const contractDoc = await db.collection("contracts").doc(contractId).get();
        if (!contractDoc.exists) {
            return res.status(404).json({ error: "Contract not found" });
        }

        const contractData = contractDoc.data();
        const allowedRegions = contractData?.contractDetails?.allowed_regions || [];

        // 🔹 Use ip-api.com to get country from IP
        const ipApiUrl = `http://ip-api.com/json/${userIp}`;

        const response = await axios.get(ipApiUrl);
        const userCountry = response.data.countryCode;

        if (!userCountry) {
            return res.status(400).json({ error: "Invalid IP address or location not found" });
        }

        // Check if the user's location is in the allowed regions
        const isCompliant = allowedRegions.includes(userCountry);
        
        // Store violation in Firestore if non-compliant
        if (!isCompliant) {
            await db.collection("violations").add({
                type: "geo-compliance",
                contractId,
                userIp,
                userCountry,
                allowedRegions,
                violationTimestamp: FieldValue.serverTimestamp(),
                // Increment violation count for this contract
                contractTitle: contractData?.contractDetails?.title || "Unknown"
            });
            
            await db.collection("contracts").doc(contractId).update({
                violationCount: FieldValue.increment(1)
            });
            
            // Send notification email about geo-compliance violation
            try {
                const notificationEmails = process.env.NOTIFICATION_EMAILS
                    ? process.env.NOTIFICATION_EMAILS.split(',') 
                    : [];
                
                if (notificationEmails.length > 0) {
                    const contractTitle = contractData?.contractDetails?.title || "Unknown Contract";
                    const emailSubject = `🚨 Geo-compliance Violation: ${contractTitle}`;
                    const emailHtml = `
                        <h2>Geo-compliance Violation Detected</h2>
                        <p><strong>Contract:</strong> ${contractTitle}</p>
                        <p><strong>User Country:</strong> ${userCountry}</p>
                        <p><strong>Allowed Regions:</strong> ${allowedRegions.join(', ')}</p>
                        <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
                        <p>Please review this violation in the compliance dashboard.</p>
                    `;
                    
                    await sendEmailNotification(notificationEmails, emailSubject, null, emailHtml);
                }
            } catch (emailError) {
                console.error("❌ Error sending violation notification:", emailError);
                // Continue processing even if email notification fails
            }
        }

        res.json({
            contractId,
            userIp,
            allowedRegions,
            userCountry,
            complianceStatus: isCompliant ? "Compliant" : "Violation"
        });

    } catch (error) {
        console.error("❌ Error checking geo-compliance:", error.message);
        res.status(500).json({ error: "Internal Server Error - " + error.message });
    }
});


app.get("/check-expired-contracts", async (req, res) => {
    try {
        const now = new Date();  // Get current date
        console.log(`Checking contracts expiry as of: ${now.toISOString()}`);

        // Fetch all contracts from Firestore
        const contractsSnapshot = await db.collection("contracts").get();

        let expiredContracts = [];

        contractsSnapshot.forEach((doc) => {
            const contract = doc.data();
            const endDate = new Date(contract.contractDetails?.duration?.end_date);

            if (!isNaN(endDate) && endDate < now) {
                expiredContracts.push({
                    contractId: doc.id,
                    title: contract.contractDetails?.title || "Unknown",
                    endDate: endDate.toISOString(),
                });

                // 🔹 Store expired contract violation
                db.collection("violations").add({
                    contractId: doc.id,
                    reason: "License Expired",
                    endDate: endDate.toISOString(),
                    timestamp: FieldValue.serverTimestamp()
                });
                
                // Send notification email about expired contract
                try {
                    const notificationEmails = process.env.NOTIFICATION_EMAILS
                        ? process.env.NOTIFICATION_EMAILS.split(',') 
                        : [];
                    
                    if (notificationEmails.length > 0) {
                        const contractTitle = contract.contractDetails?.title || "Unknown Contract";
                        const emailSubject = `⚠️ Contract Expired: ${contractTitle}`;
                        const emailHtml = `
                            <h2>Contract Expiration Notice</h2>
                            <p><strong>Contract:</strong> ${contractTitle}</p>
                            <p><strong>Expiry Date:</strong> ${endDate.toLocaleDateString()}</p>
                            <p><strong>Days Expired:</strong> ${Math.floor((now - endDate) / (1000 * 60 * 60 * 24))}</p>
                            <p>Please review this contract in the compliance dashboard.</p>
                        `;
                        
                        sendEmailNotification(notificationEmails, emailSubject, null, emailHtml);
                    }
                } catch (emailError) {
                    console.error("❌ Error sending expiry notification:", emailError);
                    // Continue processing even if email notification fails
                }
            }
        });

        res.json({ expiredContracts });

    } catch (error) {
        console.error("❌ Error checking expired contracts:", error);
        res.status(500).json({ error: "Internal Server Error - " + error.message });
    }
});

// Route: Get Clause Recommendations
app.post("/clause-recommendations", authenticateUser, authorizeUser(["read"]), async (req, res) => {
    try {
        const { contractId, contractText, recommendationType } = req.body;
        
        if (!contractId && !contractText) {
            return res.status(400).json({ error: "Either contractId or contractText is required" });
        }
        
        let textToAnalyze = contractText;
        
        // If contractId is provided but no text, fetch the contract from Firestore
        if (contractId && !contractText) {
            const contractDoc = await db.collection("contracts").doc(contractId).get();
            
            if (!contractDoc.exists) {
                return res.status(404).json({ error: "Contract not found" });
            }
            
            textToAnalyze = contractDoc.data().originalText;
        }
        
        // Define the prompt based on recommendation type
        let prompt;
        switch (recommendationType) {
            case "missing-clauses":
                prompt = `Analyze this contract and identify any important standard clauses that are missing. For each missing clause, provide a brief explanation of why it's important and a sample clause text. Return in JSON format:
                {
                  "missing_clauses": [
                    {
                      "name": "Force Majeure",
                      "explanation": "Protects parties when unforeseeable events prevent performance",
                      "sample_text": "Sample clause text here..."
                    }
                  ]
                }
                
                Contract: "${textToAnalyze}"`;
                break;
                
            case "risk-mitigation":
                prompt = `Analyze this contract and identify potential legal risks or ambiguities. For each risk, suggest improvements to mitigate it. Return in JSON format:
                {
                  "risks": [
                    {
                      "clause": "Section where risk is found",
                      "risk": "Description of the risk",
                      "recommendation": "Suggested improvement"
                    }
                  ]
                }
                
                Contract: "${textToAnalyze}"`;
                break;
                
            case "compliance":
                prompt = `Analyze this contract and suggest improvements for regulatory compliance. Return in JSON format:
                {
                  "compliance_issues": [
                    {
                      "issue": "Description of compliance issue",
                      "regulation": "Relevant regulation or law",
                      "recommendation": "Suggested improvement"
                    }
                  ]
                }
                
                Contract: "${textToAnalyze}"`;
                break;
                
            default:
                prompt = `Analyze this contract and provide general recommendations for improvement. Return in JSON format:
                {
                  "recommendations": [
                    {
                      "area": "Area of concern",
                      "issue": "Description of issue",
                      "recommendation": "Suggested improvement"
                    }
                  ]
                }
                
                Contract: "${textToAnalyze}"`;
        }
        
        const response = await axios.post(
            "https://generativelanguage.googleapis.com/v1/models/gemini-pro:generateContent",
            {
                contents: [
                    {
                        parts: [
                            {
                                text: prompt
                            }
                        ]
                    }
                ]
            },
            {
                headers: { "Content-Type": "application/json" },
                params: { key: GEMINI_API_KEY }
            }
        );
        
        let rawText = response.data.candidates[0]?.content?.parts[0]?.text || "";
        
        // Remove Markdown-style code blocks
        rawText = rawText.replace(/```json\s*([\s\S]*?)\s*```/i, "$1").trim();
        
        // Attempt to parse as JSON
        let recommendations;
        try {
            recommendations = JSON.parse(rawText);
        } catch (jsonError) {
            console.warn("❌ Warning: Response is not valid JSON.");
            recommendations = { rawResponse: rawText };
        }
        
        // Store this recommendation in Firestore if contractId is provided
        if (contractId) {
            await db.collection("contracts").doc(contractId).collection("recommendations").add({
                type: recommendationType || "general",
                recommendations,
                timestamp: FieldValue.serverTimestamp()
            });
        }
        
        res.json({ recommendations });
        
    } catch (error) {
        console.error("❌ Error getting clause recommendations:", error.message);
        res.status(500).json({ error: "Internal Server Error - " + error.message });
    }
});

// Route: Edit Contract Clauses
app.post("/edit-contract-clause", authenticateUser, authorizeUser(["write"]), async (req, res) => {
    try {
        const { contractId, clauseEdit, clauseType, clauseContent } = req.body;
        
        if (!contractId || !clauseEdit || !clauseType) {
            return res.status(400).json({ error: "Contract ID, clause edit type, and clause type are required" });
        }
        
        // Get the existing contract
        const contractDoc = await db.collection("contracts").doc(contractId).get();
        
        if (!contractDoc.exists) {
            return res.status(404).json({ error: "Contract not found" });
        }
        
        const contractData = contractDoc.data();
        
        // Create a version record before making changes
        await db.collection("contracts").doc(contractId).collection("versions").add({
            contractDetails: contractData.contractDetails,
            originalText: contractData.originalText,
            timestamp: contractData.timestamp,
            versionCreatedAt: FieldValue.serverTimestamp(),
            editReason: `Manual clause ${clauseEdit}: ${clauseType}`
        });
        
        // Implement the clause edit based on the type
        let updatedText = contractData.originalText;
        let response;
        
        switch (clauseEdit) {
            case "add":
                if (!clauseContent) {
                    return res.status(400).json({ error: "Clause content is required for adding a clause" });
                }
                
                // Use Gemini API to find the best place to add this clause
                response = await axios.post(
                    "https://generativelanguage.googleapis.com/v1/models/gemini-pro:generateContent",
                    {
                        contents: [
                            {
                                parts: [
                                    {
                                        text: `Given this contract text, find the best position to insert a new "${clauseType}" clause and return the modified contract. The new clause to insert is: "${clauseContent}".
                                        
                                        Contract: "${updatedText}"`
                                    }
                                ]
                            }
                        ]
                    },
                    {
                        headers: { "Content-Type": "application/json" },
                        params: { key: GEMINI_API_KEY }
                    }
                );
                
                updatedText = response.data.candidates[0]?.content?.parts[0]?.text || "";
                break;
                
            case "edit":
                if (!clauseContent) {
                    return res.status(400).json({ error: "Clause content is required for editing a clause" });
                }
                
                // Use Gemini API to find and replace the specific clause
                response = await axios.post(
                    "https://generativelanguage.googleapis.com/v1/models/gemini-pro:generateContent",
                    {
                        contents: [
                            {
                                parts: [
                                    {
                                        text: `Find the "${clauseType}" clause in this contract and replace it with the following updated clause: "${clauseContent}". Return the entire updated contract text.
                                        
                                        Contract: "${updatedText}"`
                                    }
                                ]
                            }
                        ]
                    },
                    {
                        headers: { "Content-Type": "application/json" },
                        params: { key: GEMINI_API_KEY }
                    }
                );
                
                updatedText = response.data.candidates[0]?.content?.parts[0]?.text || "";
                break;
                
            case "remove":
                // Use Gemini API to remove the specified clause
                response = await axios.post(
                    "https://generativelanguage.googleapis.com/v1/models/gemini-pro:generateContent",
                    {
                        contents: [
                            {
                                parts: [
                                    {
                                        text: `Find and remove the "${clauseType}" clause from this contract. Return the entire updated contract text without this clause.
                                        
                                        Contract: "${updatedText}"`
                                    }
                                ]
                            }
                        ]
                    },
                    {
                        headers: { "Content-Type": "application/json" },
                        params: { key: GEMINI_API_KEY }
                    }
                );
                
                updatedText = response.data.candidates[0]?.content?.parts[0]?.text || "";
                break;
                
            default:
                return res.status(400).json({ error: "Invalid clause edit type. Must be 'add', 'edit', or 'remove'" });
        }
        
        // Now we need to re-analyze the contract to update the contractDetails
        const analysisResponse = await axios.post(
            "https://generativelanguage.googleapis.com/v1/models/gemini-pro:generateContent",
            {
                contents: [
                    {
                        parts: [
                            {
                                text: `Extract key details from the following contract and return only JSON in this format:

{
  "title": "Contract Title",
  "parties": ["Party A", "Party B"],
  "rights": ["Streaming in India and USA"],
  "allowed_regions": ["India", "USA"],
  "duration": {
    "start_date": "YYYY-MM-DD",
    "end_date": "YYYY-MM-DD"
  },
  "revenue_sharing": "30%"
}

Contract text: "${updatedText}"`
                            }
                        ]
                    }
                ]
            },
            {
                headers: { "Content-Type": "application/json" },
                params: { key: GEMINI_API_KEY }
            }
        );
        
        let rawText = analysisResponse.data.candidates[0]?.content?.parts[0]?.text || "";
        rawText = rawText.replace(/```json\s*([\s\S]*?)\s*```/i, "$1").trim();
        
        let updatedContractDetails;
        try {
            updatedContractDetails = JSON.parse(rawText);
        } catch (jsonError) {
            console.warn("❌ Warning: Response is not valid JSON.");
            // Keep the original contract details if parsing fails
            updatedContractDetails = contractData.contractDetails;
        }
        
        // Update the contract with the new text and details
        await db.collection("contracts").doc(contractId).update({
            originalText: updatedText,
            contractDetails: updatedContractDetails,
            timestamp: FieldValue.serverTimestamp(),
            versionCount: FieldValue.increment(1),
            lastEditType: clauseEdit,
            lastEditClause: clauseType
        });
        
        // Record the edit in an "edits" subcollection
        await db.collection("contracts").doc(contractId).collection("edits").add({
            editType: clauseEdit,
            clauseType,
            clauseContent,
            timestamp: FieldValue.serverTimestamp(),
            performedBy: req.body.userId || "anonymous"
        });
        
        res.json({ 
            success: true, 
            message: `Contract clause ${clauseEdit}ed successfully`,
            contractId,
            updatedContractDetails
        });
        
    } catch (error) {
        console.error("❌ Error editing contract clause:", error.message);
        res.status(500).json({ error: "Internal Server Error - " + error.message });
    }
});

// Route: Get Active Contracts
app.get("/active-contracts", authenticateUser, authorizeUser(["read"]), async (req, res) => {
    try {
        const now = new Date();
        const activeContractsSnapshot = await db.collection("contracts").get();
        
        let activeContracts = [];
        
        activeContractsSnapshot.forEach((doc) => {
            const contract = doc.data();
            const contractDetails = contract.contractDetails || {};
            
            // Check if contract has an end date and if it's in the future
            const endDate = contractDetails.duration?.end_date 
                ? new Date(contractDetails.duration.end_date) 
                : null;
            
            if (!endDate || endDate >= now) {
                activeContracts.push({
                    id: doc.id,
                    title: contractDetails.title || "Untitled Contract",
                    parties: contractDetails.parties || [],
                    allowedRegions: contractDetails.allowed_regions || [],
                    startDate: contractDetails.duration?.start_date || null,
                    endDate: contractDetails.duration?.end_date || null,
                    violationCount: contract.violationCount || 0,
                    versionCount: contract.versionCount || 1,
                    timestamp: contract.timestamp?.toDate() || null
                });
            }
        });
        
        res.json({ activeContracts });
        
    } catch (error) {
        console.error("❌ Error fetching active contracts:", error.message);
        res.status(500).json({ error: "Internal Server Error - " + error.message });
    }
});

// Route: Get Expired Contracts
app.get("/expired-contracts", authenticateUser, authorizeUser(["read"]), async (req, res) => {
    try {
        const now = new Date();
        const contractsSnapshot = await db.collection("contracts").get();
        
        let expiredContracts = [];
        
        contractsSnapshot.forEach((doc) => {
            const contract = doc.data();
            const contractDetails = contract.contractDetails || {};
            
            // Check if contract has an end date and if it's in the past
            const endDate = contractDetails.duration?.end_date 
                ? new Date(contractDetails.duration.end_date) 
                : null;
            
            if (endDate && endDate < now) {
                expiredContracts.push({
                    id: doc.id,
                    title: contractDetails.title || "Untitled Contract",
                    parties: contractDetails.parties || [],
                    allowedRegions: contractDetails.allowed_regions || [],
                    endDate: contractDetails.duration?.end_date || null,
                    violationCount: contract.violationCount || 0,
                    daysExpired: Math.floor((now - endDate) / (1000 * 60 * 60 * 24))
                });
            }
        });
        
        res.json({ expiredContracts });
        
    } catch (error) {
        console.error("❌ Error fetching expired contracts:", error.message);
        res.status(500).json({ error: "Internal Server Error - " + error.message });
    }
});

// Route: Get Violations
app.get("/violations", authenticateUser, authorizeUser(["read"]), async (req, res) => {
    try {
        const { contractId, limit = 50, type } = req.query;
        
        let violationsQuery = db.collection("violations");
        
        if (contractId) {
            violationsQuery = violationsQuery.where("contractId", "==", contractId);
        }
        
        if (type) {
            violationsQuery = violationsQuery.where("type", "==", type);
        }
        
        const violationsSnapshot = await violationsQuery
            .orderBy("violationTimestamp", "desc")
            .limit(parseInt(limit))
            .get();
        
        let violations = [];
        
        violationsSnapshot.forEach((doc) => {
            const violation = doc.data();
            violations.push({
                id: doc.id,
                contractId: violation.contractId,
                contractTitle: violation.contractTitle || "Unknown",
                type: violation.type || "geo-compliance",
                userCountry: violation.userCountry,
                allowedRegions: violation.allowedRegions || [],
                timestamp: violation.violationTimestamp?.toDate() || null
            });
        });
        
        res.json({ violations });
        
    } catch (error) {
        console.error("❌ Error fetching violations:", error.message);
        res.status(500).json({ error: "Internal Server Error - " + error.message });
    }
});

// Route: Get Compliance Overview (Dashboard Stats)
app.get("/compliance-overview", authenticateUser, authorizeUser(["read"]), async (req, res) => {
    try {
        // Get total contracts count
        const contractsSnapshot = await db.collection("contracts").get();
        const totalContracts = contractsSnapshot.size;
        
        // Get current date for active/expired calculation
        const now = new Date();
        
        let activeContracts = 0;
        let expiredContracts = 0;
        let contractsWithViolations = 0;
        let totalViolations = 0;
        
        // Process contract data
        contractsSnapshot.forEach((doc) => {
            const contract = doc.data();
            const contractDetails = contract.contractDetails || {};
            const endDate = contractDetails.duration?.end_date 
                ? new Date(contractDetails.duration.end_date) 
                : null;
            
            // Count active vs expired
            if (!endDate || endDate >= now) {
                activeContracts++;
            } else {
                expiredContracts++;
            }
            
            // Count violations
            if (contract.violationCount && contract.violationCount > 0) {
                contractsWithViolations++;
                totalViolations += contract.violationCount;
            }
        });
        
        // Get recent violations (last 30 days)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        
        const recentViolationsSnapshot = await db.collection("violations")
            .where("violationTimestamp", ">=", thirtyDaysAgo)
            .get();
        
        const recentViolations = recentViolationsSnapshot.size;
        
        // Compile stats
        const complianceStats = {
            totalContracts,
            activeContracts,
            expiredContracts,
            contractsWithViolations,
            totalViolations,
            recentViolations,
            complianceRate: totalContracts > 0 
                ? Math.round(((totalContracts - contractsWithViolations) / totalContracts) * 100) 
                : 100,
            lastUpdated: new Date().toISOString()
        };
        
        res.json({ complianceStats });
        
    } catch (error) {
        console.error("❌ Error fetching compliance overview:", error.message);
        res.status(500).json({ error: "Internal Server Error - " + error.message });
    }
});

// Route: Export Compliance Report
app.get("/export-compliance-report", authenticateUser, authorizeUser(["read"]), async (req, res) => {
    try {
        const { format = "json", startDate, endDate } = req.query;
        
        // Define date range
        const reportStartDate = startDate ? new Date(startDate) : new Date();
        reportStartDate.setDate(reportStartDate.getDate() - 30); // Default to last 30 days
        
        const reportEndDate = endDate ? new Date(endDate) : new Date();
        
        // Get all contracts
        const contractsSnapshot = await db.collection("contracts").get();
        
        // Get violations in date range
        const violationsQuery = await db.collection("violations")
            .where("violationTimestamp", ">=", reportStartDate)
            .where("violationTimestamp", "<=", reportEndDate)
            .get();
        
        // Prepare report data
        const contracts = [];
        const contractMap = new Map();
        
        contractsSnapshot.forEach((doc) => {
            const contract = doc.data();
            const contractDetails = contract.contractDetails || {};
            
            const contractData = {
                id: doc.id,
                title: contractDetails.title || "Untitled Contract",
                parties: contractDetails.parties || [],
                allowedRegions: contractDetails.allowed_regions || [],
                startDate: contractDetails.duration?.start_date || null,
                endDate: contractDetails.duration?.end_date || null,
                violationCount: contract.violationCount || 0,
                violations: []
            };
            
            contracts.push(contractData);
            contractMap.set(doc.id, contractData);
        });
        
        // Add violations to contracts
        violationsQuery.forEach((doc) => {
            const violation = doc.data();
            const contractId = violation.contractId;
            
            if (contractMap.has(contractId)) {
                contractMap.get(contractId).violations.push({
                    id: doc.id,
                    type: violation.type || "geo-compliance",
                    userCountry: violation.userCountry,
                    timestamp: violation.violationTimestamp?.toDate()?.toISOString() || null
                });
            }
        });
        
        // Prepare the report
        const report = {
            reportName: "Compliance Report",
            dateRange: {
                startDate: reportStartDate.toISOString(),
                endDate: reportEndDate.toISOString()
            },
            summary: {
                totalContracts: contracts.length,
                contractsWithViolations: contracts.filter(c => c.violationCount > 0).length,
                totalViolations: violationsQuery.size
            },
            contracts: contracts
        };
        
        // Return report in requested format
        if (format === "csv") {
            // Simple CSV format implementation
            let csv = "Contract ID,Title,Parties,Violation Count\n";
            
            contracts.forEach(contract => {
                csv += `${contract.id},"${contract.title}","${contract.parties.join('; ')}",${contract.violationCount}\n`;
            });
            
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', 'attachment; filename=compliance_report.csv');
            res.send(csv);
        } else {
            // Default to JSON
            res.json({ report });
        }
        
    } catch (error) {
        console.error("❌ Error generating compliance report:", error.message);
        res.status(500).json({ error: "Internal Server Error - " + error.message });
    }
});

// Protected notification settings route
app.post("/notification-settings", authenticateUser, authorizeUser(["manage_users"]), async (req, res) => {
    // ... existing code ...
});

// ====================== CONTRACT SEARCH ROUTES ======================

// Route: Search contracts
app.get("/search-contracts", 
    authenticateUser, 
    authorizeUser(["read"]),
    validateRequest([
        query("query").optional().isString(),
        query("field").optional().isIn(["title", "party", "region", "all"]),
        query("startDate").optional().isISO8601(),
        query("endDate").optional().isISO8601(),
        query("limit").optional().isInt({ min: 1, max: 100 }).toInt()
    ]),
    async (req, res) => {
        try {
            const { 
                query: searchQuery, 
                field = "all", 
                startDate, 
                endDate,
                limit = 20
            } = req.query;
            
            // Get all contracts first
            const contractsSnapshot = await db.collection("contracts").get();
            
            let filteredContracts = [];
            
            contractsSnapshot.forEach(doc => {
                const contract = doc.data();
                const contractDetails = contract.contractDetails || {};
                
                // Initialize include flag to true if no search query, otherwise to false until match is found
                let includeContract = !searchQuery;
                
                if (searchQuery && searchQuery.trim() !== "") {
                    const searchLower = searchQuery.toLowerCase();
                    
                    switch (field) {
                        case "title":
                            if (contractDetails.title && contractDetails.title.toLowerCase().includes(searchLower)) {
                                includeContract = true;
                            }
                            break;
                            
                        case "party":
                            if (contractDetails.parties && Array.isArray(contractDetails.parties)) {
                                includeContract = contractDetails.parties.some(party => 
                                    party.toLowerCase().includes(searchLower)
                                );
                            }
                            break;
                            
                        case "region":
                            if (contractDetails.allowed_regions && Array.isArray(contractDetails.allowed_regions)) {
                                includeContract = contractDetails.allowed_regions.some(region => 
                                    region.toLowerCase().includes(searchLower)
                                );
                            }
                            break;
                            
                        case "all":
                        default:
                            // Search in title
                            if (contractDetails.title && contractDetails.title.toLowerCase().includes(searchLower)) {
                                includeContract = true;
                            }
                            // Search in parties
                            else if (contractDetails.parties && Array.isArray(contractDetails.parties) &&
                                contractDetails.parties.some(party => party.toLowerCase().includes(searchLower))) {
                                includeContract = true;
                            }
                            // Search in regions
                            else if (contractDetails.allowed_regions && Array.isArray(contractDetails.allowed_regions) &&
                                contractDetails.allowed_regions.some(region => region.toLowerCase().includes(searchLower))) {
                                includeContract = true;
                            }
                            break;
                    }
                }
                
                // Apply date filters if provided
                if (includeContract && startDate) {
                    const contractStart = contractDetails.duration?.start_date
                        ? new Date(contractDetails.duration.start_date)
                        : null;
                        
                    if (contractStart && contractStart < new Date(startDate)) {
                        includeContract = false;
                    }
                }
                
                if (includeContract && endDate) {
                    const contractEnd = contractDetails.duration?.end_date
                        ? new Date(contractDetails.duration.end_date)
                        : null;
                        
                    if (contractEnd && contractEnd > new Date(endDate)) {
                        includeContract = false;
                    }
                }
                
                // Add contract to results if it passed all filters
                if (includeContract) {
                    filteredContracts.push({
                        id: doc.id,
                        title: contractDetails.title || "Untitled Contract",
                        parties: contractDetails.parties || [],
                        allowedRegions: contractDetails.allowed_regions || [],
                        startDate: contractDetails.duration?.start_date || null,
                        endDate: contractDetails.duration?.end_date || null,
                        violationCount: contract.violationCount || 0,
                        timestamp: contract.timestamp?.toDate() || null
                    });
                }
            });
            
            // Apply limit and sort by most recent
            filteredContracts.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
            filteredContracts = filteredContracts.slice(0, limit);
            
            res.json({ 
                contracts: filteredContracts,
                total: filteredContracts.length,
                query: searchQuery || "",
                field
            });
            
        } catch (error) {
            console.error("❌ Error searching contracts:", error.message);
            res.status(500).json({ error: "Internal Server Error - " + error.message });
        }
    }
);

// Route: Get Audit Logs (admin only)
app.get("/audit-logs", 
    authenticateUser, 
    authorizeUser(["manage_users"]),
    validateRequest([
        query("userId").optional().isString(),
        query("action").optional().isString(),
        query("startDate").optional().isISO8601(),
        query("endDate").optional().isISO8601(),
        query("limit").optional().isInt({ min: 1, max: 100 }).toInt()
    ]),
    async (req, res) => {
        try {
            const { 
                userId, 
                action, 
                startDate, 
                endDate,
                limit = 50
            } = req.query;
            
            let logsQuery = db.collection("audit_logs");
            
            // Apply filters if provided
            if (userId) {
                logsQuery = logsQuery.where("userId", "==", userId);
            }
            
            if (action) {
                logsQuery = logsQuery.where("action", "==", action);
            }
            
            if (startDate) {
                const startDateTime = new Date(startDate);
                logsQuery = logsQuery.where("timestamp", ">=", startDateTime);
            }
            
            // Note: We can't use multiple inequality filters on different fields in Firestore
            // So we'll filter endDate in memory
            
            // Order by timestamp descending and get most recent logs
            logsQuery = logsQuery.orderBy("timestamp", "desc").limit(parseInt(limit));
            
            const logsSnapshot = await logsQuery.get();
            
            let logs = [];
            
            logsSnapshot.forEach(doc => {
                const logData = doc.data();
                
                // Apply endDate filter in memory if needed
                if (endDate) {
                    const endDateTime = new Date(endDate);
                    if (logData.timestamp?.toDate() > endDateTime) {
                        return; // Skip this log
                    }
                }
                
                logs.push({
                    id: doc.id,
                    userId: logData.userId,
                    userEmail: logData.userEmail,
                    action: logData.action,
                    endpoint: logData.endpoint,
                    method: logData.method,
                    timestamp: logData.timestamp?.toDate() || null,
                    userIp: logData.userIp
                });
            });
            
            res.json({ 
                logs,
                total: logs.length 
            });
            
        } catch (error) {
            console.error("❌ Error fetching audit logs:", error.message);
            res.status(500).json({ error: "Internal Server Error - " + error.message });
        }
    }
);

// ====================== END OF SEARCH AND VALIDATION ======================

// Health check endpoint
app.get("/health", (req, res) => {
    res.json({
        status: "healthy",
        timestamp: new Date().toISOString(),
        corsOrigin: process.env.CORS_ORIGIN
    });
});

// Root route for server health check
app.get("/", (req, res) => {
    res.json({
        status: "online",
        service: "LegalLens API",
        version: "1.0.0",
        endpoints: {
            health: "/health",
            auth: "/auth/*",
            contracts: "/analyze-contract, /search-contracts, etc.",
            compliance: "/check-geo-compliance, /check-expired-contracts, etc.",
            dashboard: "/active-contracts, /compliance-overview, etc."
        }
    });
});

// Start Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});
