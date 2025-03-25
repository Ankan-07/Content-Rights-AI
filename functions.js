const functions = require("firebase-functions");
const admin = require("firebase-admin");
const nodemailer = require("nodemailer");
const axios = require("axios");

// Initialize Firebase Admin SDK
admin.initializeApp();

const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;

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

// Scheduled function to check for expired contracts (runs daily)
exports.checkExpiredContracts = functions.pubsub.schedule("0 0 * * *") // Run at midnight every day
    .timeZone("America/New_York") // Set your timezone
    .onRun(async (context) => {
        try {
            const now = new Date();
            console.log(`Checking contracts expiry as of: ${now.toISOString()}`);

            // Get notification settings
            const settingsDoc = await db.collection("settings").doc("notifications").get();
            const settings = settingsDoc.exists ? settingsDoc.data() : { enableExpiryAlerts: true };
            
            if (!settings.enableExpiryAlerts) {
                console.log("Expiry alerts are disabled in settings. Skipping check.");
                return null;
            }
            
            const notificationEmails = (settings.notificationEmails || []).length > 0
                ? settings.notificationEmails
                : process.env.NOTIFICATION_EMAILS?.split(',') || [];
                
            if (notificationEmails.length === 0) {
                console.log("No notification emails configured. Skipping notifications.");
            }

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

                    // Store expired contract violation
                    db.collection("violations").add({
                        contractId: doc.id,
                        type: "expiry",
                        reason: "License Expired",
                        endDate: endDate.toISOString(),
                        timestamp: FieldValue.serverTimestamp()
                    });
                    
                    // Update contract with violation count
                    db.collection("contracts").doc(doc.id).update({
                        violationCount: FieldValue.increment(1),
                        expiryViolationRecorded: true,
                        expiryViolationTimestamp: FieldValue.serverTimestamp()
                    });
                }
            });
            
            if (expiredContracts.length > 0 && notificationEmails.length > 0) {
                // Send notification email about expired contracts
                try {
                    const emailSubject = `📅 [ALERT] ${expiredContracts.length} Contract(s) Expired`;
                    let emailHtml = `
                        <h2>Contract Expiration Notice</h2>
                        <p>The following contracts have expired:</p>
                        <table border="1" cellpadding="5" style="border-collapse: collapse;">
                            <tr>
                                <th>Contract Title</th>
                                <th>Expiry Date</th>
                                <th>Days Expired</th>
                            </tr>
                    `;
                    
                    expiredContracts.forEach(contract => {
                        const endDate = new Date(contract.endDate);
                        const daysExpired = Math.floor((now - endDate) / (1000 * 60 * 60 * 24));
                        
                        emailHtml += `
                            <tr>
                                <td>${contract.title}</td>
                                <td>${endDate.toLocaleDateString()}</td>
                                <td>${daysExpired}</td>
                            </tr>
                        `;
                    });
                    
                    emailHtml += `
                        </table>
                        <p>Please review these contracts in the compliance dashboard.</p>
                    `;
                    
                    await sendEmailNotification(notificationEmails, emailSubject, null, emailHtml);
                } catch (emailError) {
                    console.error("❌ Error sending expiry notification:", emailError);
                }
            }

            console.log(`Found ${expiredContracts.length} expired contracts`);
            return null;
        } catch (error) {
            console.error("❌ Error checking expired contracts:", error);
            return null;
        }
    });
    
// Scheduled function to check for contracts nearing expiry (runs daily)
exports.checkContractsNearingExpiry = functions.pubsub.schedule("0 9 * * *") // Run at 9 AM every day
    .timeZone("America/New_York") // Set your timezone
    .onRun(async (context) => {
        try {
            const now = new Date();
            console.log(`Checking contracts nearing expiry as of: ${now.toISOString()}`);
            
            // Get notification settings
            const settingsDoc = await db.collection("settings").doc("notifications").get();
            const settings = settingsDoc.exists ? settingsDoc.data() : { 
                enableExpiryAlerts: true,
                expiryWarningDays: 30
            };
            
            if (!settings.enableExpiryAlerts) {
                console.log("Expiry alerts are disabled in settings. Skipping check.");
                return null;
            }
            
            const expiryWarningDays = settings.expiryWarningDays || 30;
            const notificationEmails = (settings.notificationEmails || []).length > 0
                ? settings.notificationEmails
                : process.env.NOTIFICATION_EMAILS?.split(',') || [];
                
            if (notificationEmails.length === 0) {
                console.log("No notification emails configured. Skipping notifications.");
                return null;
            }
            
            // Calculate warning date
            const warningDate = new Date();
            warningDate.setDate(now.getDate() + expiryWarningDays);
            
            // Fetch all contracts from Firestore
            const contractsSnapshot = await db.collection("contracts").get();
            
            let contractsNearingExpiry = [];
            
            contractsSnapshot.forEach((doc) => {
                const contract = doc.data();
                const endDate = contract.contractDetails?.duration?.end_date
                    ? new Date(contract.contractDetails.duration.end_date)
                    : null;
                
                // Check if contract expires within warning period and is not already expired
                if (endDate && endDate > now && endDate <= warningDate) {
                    // Add to list
                    contractsNearingExpiry.push({
                        contractId: doc.id,
                        title: contract.contractDetails?.title || "Unknown Contract",
                        endDate: endDate.toISOString(),
                        daysUntilExpiry: Math.ceil((endDate - now) / (1000 * 60 * 60 * 24))
                    });
                }
            });
            
            if (contractsNearingExpiry.length > 0) {
                // Send notification email
                const emailSubject = `🕒 Contracts Nearing Expiry Alert`;
                let emailHtml = `
                    <h2>Contracts Nearing Expiry</h2>
                    <p>The following contracts will expire within the next ${expiryWarningDays} days:</p>
                    <table border="1" cellpadding="5" style="border-collapse: collapse;">
                        <tr>
                            <th>Contract</th>
                            <th>Expiry Date</th>
                            <th>Days Remaining</th>
                        </tr>
                `;
                
                contractsNearingExpiry.forEach(contract => {
                    emailHtml += `
                        <tr>
                            <td>${contract.title}</td>
                            <td>${new Date(contract.endDate).toLocaleDateString()}</td>
                            <td>${contract.daysUntilExpiry}</td>
                        </tr>
                    `;
                });
                
                emailHtml += `
                    </table>
                    <p>Please review these contracts in the compliance dashboard.</p>
                `;
                
                try {
                    await sendEmailNotification(notificationEmails, emailSubject, null, emailHtml);
                    
                    // Record that warnings were sent
                    await db.collection("notifications").add({
                        type: "expiry_warning",
                        contractIds: contractsNearingExpiry.map(c => c.contractId),
                        warningDays: expiryWarningDays,
                        sentAt: FieldValue.serverTimestamp()
                    });
                    
                    console.log(`Sent expiry warnings for ${contractsNearingExpiry.length} contracts`);
                } catch (emailError) {
                    console.error("❌ Error sending expiry warnings:", emailError);
                }
            } else {
                console.log("No contracts nearing expiry found");
            }
            
            return null;
        } catch (error) {
            console.error("❌ Error checking contracts nearing expiry:", error);
            return null;
        }
    });

// Scheduled function to send weekly compliance report (runs every Monday at 8 AM)
exports.sendWeeklyComplianceReport = functions.pubsub.schedule("0 8 * * 1") // Every Monday at 8 AM
    .timeZone("America/New_York") // Set your timezone
    .onRun(async (context) => {
        try {
            // Get notification settings
            const settingsDoc = await db.collection("settings").doc("notifications").get();
            const settings = settingsDoc.exists ? settingsDoc.data() : { enableWeeklySummary: true };
            
            if (!settings.enableWeeklySummary) {
                console.log("Weekly summary reports are disabled. Skipping.");
                return null;
            }
            
            const notificationEmails = (settings.notificationEmails || []).length > 0
                ? settings.notificationEmails
                : process.env.NOTIFICATION_EMAILS?.split(',') || [];
                
            if (notificationEmails.length === 0) {
                console.log("No notification emails configured. Skipping weekly report.");
                return null;
            }
            
            // Calculate date range for the past week
            const now = new Date();
            const weekAgo = new Date();
            weekAgo.setDate(weekAgo.getDate() - 7);
            
            // Get total contracts
            const contractsSnapshot = await db.collection("contracts").get();
            const totalContracts = contractsSnapshot.size;
            
            // Get active vs expired contracts
            let activeContracts = 0;
            let expiredContracts = 0;
            
            contractsSnapshot.forEach((doc) => {
                const contract = doc.data();
                const endDate = contract.contractDetails?.duration?.end_date
                    ? new Date(contract.contractDetails.duration.end_date)
                    : null;
                
                if (!endDate || endDate >= now) {
                    activeContracts++;
                } else {
                    expiredContracts++;
                }
            });
            
            // Get violations for the week
            const violationsSnapshot = await db.collection("violations")
                .where("timestamp", ">=", weekAgo)
                .get();
            
            const weeklyViolations = violationsSnapshot.size;
            
            // Get newly expired contracts for the week
            let newlyExpiredContracts = 0;
            
            contractsSnapshot.forEach((doc) => {
                const contract = doc.data();
                const endDate = new Date(contract.contractDetails?.duration?.end_date);
                
                if (!isNaN(endDate) && endDate >= weekAgo && endDate <= now) {
                    newlyExpiredContracts++;
                }
            });
            
            // Get compliance rate
            const contractsWithViolations = await db.collection("contracts")
                .where("violationCount", ">", 0)
                .get();
            
            const complianceRate = totalContracts > 0 
                ? Math.round(((totalContracts - contractsWithViolations.size) / totalContracts) * 100)
                : 100;
            
            // Create the email report
            const emailSubject = `📊 Weekly Compliance Report - ${now.toLocaleDateString()}`;
            const emailHtml = `
                <h2>Weekly Compliance Report</h2>
                <p><strong>Report Period:</strong> ${weekAgo.toLocaleDateString()} to ${now.toLocaleDateString()}</p>
                
                <h3>Summary</h3>
                <table border="1" cellpadding="5" style="border-collapse: collapse;">
                    <tr>
                        <td><strong>Total Contracts</strong></td>
                        <td>${totalContracts}</td>
                    </tr>
                    <tr>
                        <td><strong>Active Contracts</strong></td>
                        <td>${activeContracts}</td>
                    </tr>
                    <tr>
                        <td><strong>Expired Contracts</strong></td>
                        <td>${expiredContracts}</td>
                    </tr>
                    <tr>
                        <td><strong>Compliance Rate</strong></td>
                        <td>${complianceRate}%</td>
                    </tr>
                    <tr>
                        <td><strong>New Violations This Week</strong></td>
                        <td>${weeklyViolations}</td>
                    </tr>
                    <tr>
                        <td><strong>Newly Expired Contracts</strong></td>
                        <td>${newlyExpiredContracts}</td>
                    </tr>
                </table>
                
                <p>For detailed information, please visit the compliance dashboard.</p>
            `;
            
            try {
                const success = await sendEmailNotification(notificationEmails, emailSubject, null, emailHtml);
                
                if (success) {
                    // Record that the report was sent
                    await db.collection("reports").add({
                        type: "weekly",
                        sentAt: FieldValue.serverTimestamp(),
                        recipients: notificationEmails,
                        stats: {
                            totalContracts,
                            activeContracts,
                            expiredContracts,
                            complianceRate,
                            weeklyViolations,
                            newlyExpiredContracts
                        }
                    });
                    
                    console.log("Weekly report sent successfully");
                } else {
                    console.error("Failed to send weekly report");
                }
            } catch (emailError) {
                console.error("❌ Error sending weekly report:", emailError);
            }
            
            return null;
        } catch (error) {
            console.error("❌ Error generating weekly compliance report:", error);
            return null;
        }
    }); 