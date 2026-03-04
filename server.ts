import "dotenv/config";
import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import { GoogleGenAI } from "@google/genai";
import path from "path";
import { fileURLToPath } from "url";
import jwt from "jsonwebtoken";
import cookieParser from "cookie-parser";
import crypto from "crypto";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const db = new Database("scams.db");
const JWT_SECRET = process.env.JWT_SECRET || "cyberguard-super-secret-key-2026";

// Initialize Database
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE,
    password TEXT,
    name TEXT,
    role TEXT DEFAULT 'User',
    email_verified INTEGER DEFAULT 0,
    email_notifications INTEGER DEFAULT 1,
    webhook_notifications INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    token TEXT UNIQUE,
    type TEXT, -- 'password_reset' or 'email_verification'
    expires_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS detections (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    message_text TEXT,
    prediction TEXT,
    risk_level TEXT,
    confidence REAL,
    analysis TEXT,
    category TEXT,
    suspicious_phrases TEXT, -- JSON array
    reasons TEXT, -- JSON array
    recommended_actions TEXT, -- JSON array
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS complaints (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    complaint_text TEXT,
    status TEXT DEFAULT 'pending',
    reviewer_notes TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS notification_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    detection_id INTEGER,
    channel TEXT,
    status TEXT,
    recipient TEXT,
    error_message TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(detection_id) REFERENCES detections(id)
  );

  CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    action TEXT,
    resource TEXT,
    resource_id TEXT,
    details TEXT, -- JSON object
    ip_address TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );
`);

// Migration: Add role column if it doesn't exist (for existing DBs)
try {
  db.prepare("SELECT role FROM users LIMIT 1").get();
} catch (e) {
  db.exec("ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'User'");
}

// Migration: Add email_verified column if it doesn't exist
try {
  db.prepare("SELECT email_verified FROM users LIMIT 1").get();
} catch (e) {
  db.exec("ALTER TABLE users ADD COLUMN email_verified INTEGER DEFAULT 0");
}

// Migration: Add enrichment columns to detections if they don't exist
try {
  db.prepare("SELECT category FROM detections LIMIT 1").get();
} catch (e) {
  db.exec(`
    ALTER TABLE detections ADD COLUMN category TEXT;
    ALTER TABLE detections ADD COLUMN suspicious_phrases TEXT;
    ALTER TABLE detections ADD COLUMN reasons TEXT;
    ALTER TABLE detections ADD COLUMN recommended_actions TEXT;
  `);
}

// Migration: Add threat_intel column to detections if it doesn't exist
try {
  db.prepare("SELECT threat_intel FROM detections LIMIT 1").get();
} catch (e) {
  db.exec("ALTER TABLE detections ADD COLUMN threat_intel TEXT");
}

// Migration: Add reviewer_notes to complaints if they don't exist
try {
  db.prepare("SELECT reviewer_notes FROM complaints LIMIT 1").get();
} catch (e) {
  db.exec(`
    ALTER TABLE complaints ADD COLUMN reviewer_notes TEXT;
    ALTER TABLE complaints ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP;
  `);
}

// Migration: Add notification preference columns to users if they don't exist
try {
  db.prepare("SELECT email_notifications FROM users LIMIT 1").get();
} catch (e) {
  db.exec(`
    ALTER TABLE users ADD COLUMN email_notifications INTEGER DEFAULT 1;
    ALTER TABLE users ADD COLUMN webhook_notifications INTEGER DEFAULT 0;
  `);
}

// Seed Admin User
const seedAdmin = () => {
  const adminEmail = "admin@cyberguard.ai";
  const existing = db.prepare("SELECT * FROM users WHERE email = ?").get(adminEmail);
  if (!existing) {
    db.prepare("INSERT INTO users (email, password, name, role) VALUES (?, ?, ?, ?)")
      .run(adminEmail, "admin123", "System Admin", "Admin");
    console.log("Admin user seeded: admin@cyberguard.ai / admin123");
  }
};
seedAdmin();

async function startServer() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  const PORT = 3000;

  // --- Helper Functions ---
  const generateToken = () => crypto.randomBytes(32).toString("hex");

  // --- Notification Service ---
interface NotificationChannel {
  name: string;
  send(data: { detectionId: number; message: string; riskLevel: string; recipient: string }): Promise<{ success: boolean; error?: string }>;
}

const EmailChannel: NotificationChannel = {
  name: 'email',
  async send({ message, riskLevel, recipient }) {
    // Simulation of email sending
    console.log(`[NOTIFICATION SIMULATION] Sending Email to ${recipient}: HIGH RISK ALERT! Message: ${message.substring(0, 50)}...`);
    return { success: true };
  }
};

const WebhookChannel: NotificationChannel = {
  name: 'webhook',
  async send({ detectionId, message, riskLevel, recipient }) {
    // Simulation of webhook call
    console.log(`[NOTIFICATION SIMULATION] Triggering Webhook ${recipient} for Detection ID: ${detectionId}`);
    return { success: true };
  }
};

const notificationService = {
  channels: [EmailChannel, WebhookChannel],
  async triggerAlert(detectionId: number, messageText: string, riskLevel: string, userEmail: string) {
    if (riskLevel !== 'High') return;

    const user = db.prepare("SELECT email_notifications, webhook_notifications FROM users WHERE email = ?").get(userEmail) as any;
    if (!user) return;

    for (const channel of this.channels) {
      if (channel.name === 'email' && !user.email_notifications) continue;
      if (channel.name === 'webhook' && !user.webhook_notifications) continue;

      const recipient = channel.name === 'email' ? userEmail : (process.env.ALERT_WEBHOOK_URL || 'https://internal-security.cyberguard.ai/webhook');
      
      try {
        const result = await channel.send({ detectionId, message: messageText, riskLevel, recipient });
        
        const stmt = db.prepare(`
          INSERT INTO notification_logs (detection_id, channel, status, recipient, error_message)
          VALUES (?, ?, ?, ?, ?)
        `);
        stmt.run(detectionId, channel.name, result.success ? 'sent' : 'failed', recipient, result.error || null);
      } catch (e: any) {
        const stmt = db.prepare(`
          INSERT INTO notification_logs (detection_id, channel, status, recipient, error_message)
          VALUES (?, ?, ?, ?, ?)
        `);
        stmt.run(detectionId, channel.name, 'failed', recipient, e.message);
      }
    }
  }
};

// --- Audit Logging Service ---
const auditLogger = {
  log(userId: number | null, action: string, resource: string, resourceId: string | null = null, details: any = {}, ip: string = 'unknown') {
    try {
      const stmt = db.prepare(`
        INSERT INTO audit_logs (user_id, action, resource, resource_id, details, ip_address)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      stmt.run(userId, action, resource, resourceId, JSON.stringify(details), ip);
    } catch (error) {
      console.error("Failed to log audit event:", error);
    }
  }
};

// --- Threat Intelligence Service ---
const threatIntelService = {
  extractIndicators(text: string) {
    const indicators: { type: 'url' | 'domain' | 'phone' | 'email'; value: string }[] = [];
    
    // URL/Domain
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const urls = text.match(urlRegex) || [];
    urls.forEach(url => indicators.push({ type: 'url', value: url }));

    // Email
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    const emails = text.match(emailRegex) || [];
    emails.forEach(email => indicators.push({ type: 'email', value: email }));

    // Phone (Simple)
    const phoneRegex = /(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g;
    const phones = text.match(phoneRegex) || [];
    phones.forEach(phone => indicators.push({ type: 'phone', value: phone }));

    return indicators;
  },

  async getReputation(indicators: { type: string; value: string }[]) {
    // Stub implementation
    return indicators.map(ind => {
      const reputations = ['clean', 'suspicious', 'malicious'];
      // Deterministic-ish random for demo
      const index = Math.abs(ind.value.length % reputations.length);
      return {
        ...ind,
        reputation: reputations[index],
        details: `Checked against CyberGuard Global Threat Database. Source: ${ind.type === 'url' ? 'SafeBrowsing' : 'SpamCop'}`
      };
    });
  }
};

// --- Fallback Detection Strategy (Rule-based) ---
const ruleBasedDetection = (message: string) => {
  const scamKeywords = [
    { word: 'lottery', weight: 0.8 },
    { word: 'prize', weight: 0.7 },
    { word: 'won', weight: 0.6 },
    { word: 'urgent', weight: 0.5 },
    { word: 'immediate', weight: 0.5 },
    { word: 'bank', weight: 0.4 },
    { word: 'account', weight: 0.3 },
    { word: 'verify', weight: 0.4 },
    { word: 'transfer', weight: 0.5 },
    { word: 'otp', weight: 0.9 },
    { word: 'password', weight: 0.4 },
    { word: 'suspended', weight: 0.7 },
    { word: 'blocked', weight: 0.6 },
    { word: 'gift card', weight: 0.9 },
    { word: 'crypto', weight: 0.5 },
    { word: 'invest', weight: 0.5 }
  ];

  const lowerMessage = message.toLowerCase();
  let score = 0;
  const matchedPhrases: string[] = [];

  scamKeywords.forEach(k => {
    if (lowerMessage.includes(k.word)) {
      score += k.weight;
      matchedPhrases.push(k.word);
    }
  });

  // Check for suspicious patterns
  const patterns = [
    { regex: /https?:\/\/[^\s]+/g, weight: 0.3, label: 'URL detected' },
    { regex: /\d{4,}/g, weight: 0.2, label: 'Long number sequence' },
    { regex: /!!+/g, weight: 0.2, label: 'Excessive exclamation' }
  ];

  patterns.forEach(p => {
    if (p.regex.test(message)) {
      score += p.weight;
      matchedPhrases.push(p.label);
    }
  });

  const isScam = score >= 1.0;
  const riskLevel = score >= 2.0 ? 'High' : score >= 1.0 ? 'Medium' : 'Low';
  
  return {
    verdict: isScam ? 'Scam' : 'Safe',
    riskLevel: riskLevel,
    confidence: Math.min(0.85, score / 3), // Lower confidence for rule-based
    analysis: isScam 
      ? "Message contains multiple high-risk keywords and patterns associated with common scams. Detected via local security rules."
      : "No significant scam patterns detected by local security rules.",
    category: isScam ? "Pattern Match" : "Safe",
    suspicious_phrases: matchedPhrases,
    reasons: isScam ? ["Urgency or financial keywords detected", "Suspicious link or number pattern"] : [],
    recommended_actions: isScam ? ["Do not click any links", "Do not share personal info", "Block the sender"] : ["Stay vigilant"],
    fallback_used: true
  };
};

// --- Middleware ---
  const authenticate = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const token = req.cookies.token;
    if (!token) {
      console.log(`[Auth] No token found in cookies for ${req.path}`);
      return res.status(401).json({ error: "Unauthorized" });
    }

    try {
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      (req as any).user = decoded;
      next();
    } catch (err) {
      console.log(`[Auth] Invalid token for ${req.path}:`, (err as Error).message);
      res.clearCookie("token");
      return res.status(401).json({ error: "Invalid session" });
    }
  };

  const optionalAuthenticate = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const token = req.cookies.token;
    if (!token) {
      return next();
    }

    try {
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      (req as any).user = decoded;
      next();
    } catch (err) {
      // If token is invalid, we just ignore it for optional auth
      res.clearCookie("token");
      next();
    }
  };

  const authorize = (roles: string[]) => {
    return (req: express.Request, res: express.Response, next: express.NextFunction) => {
      const user = (req as any).user;
      if (!user || !roles.includes(user.role)) {
        return res.status(403).json({ error: "Access denied. Insufficient permissions." });
      }
      next();
    };
  };

  // --- API Routes ---

  // Auth & Token Routes
  app.post("/api/auth/forgot-password", (req, res) => {
    const { email } = req.body;
    const user = db.prepare("SELECT id FROM users WHERE email = ?").get(email) as any;
    
    if (user) {
      const token = generateToken();
      const expiresAt = new Date(Date.now() + 3600000).toISOString(); // 1 hour
      
      db.prepare("DELETE FROM tokens WHERE user_id = ? AND type = 'password_reset'").run(user.id);
      db.prepare("INSERT INTO tokens (user_id, token, type, expires_at) VALUES (?, ?, 'password_reset', ?)")
        .run(user.id, token, expiresAt);
      
      auditLogger.log(user.id, 'PASSWORD_RESET_REQUEST', 'auth', null, { email }, req.ip);
      console.log(`[EMAIL SIMULATION] Password reset link: ${process.env.APP_URL}/reset-password?token=${token}`);
    }
    
    // Always return success to prevent email enumeration
    res.json({ message: "If an account exists with that email, a reset link has been sent." });
  });

  app.post("/api/auth/reset-password", (req, res) => {
    const { token, newPassword } = req.body;
    const tokenData = db.prepare("SELECT * FROM tokens WHERE token = ? AND type = 'password_reset'").get(token) as any;
    
    if (!tokenData || new Date(tokenData.expires_at) < new Date()) {
      return res.status(400).json({ error: "Invalid or expired token" });
    }
    
    db.prepare("UPDATE users SET password = ? WHERE id = ?").run(newPassword, tokenData.user_id);
    db.prepare("DELETE FROM tokens WHERE id = ?").run(tokenData.id);
    
    auditLogger.log(tokenData.user_id, 'PASSWORD_RESET_SUCCESS', 'auth', null, {}, req.ip);
    res.json({ success: true, message: "Password has been reset successfully." });
  });

  app.post("/api/auth/request-verification", authenticate, (req, res) => {
    const user = (req as any).user;
    const token = generateToken();
    const expiresAt = new Date(Date.now() + 24 * 3600000).toISOString(); // 24 hours
    
    db.prepare("DELETE FROM tokens WHERE user_id = ? AND type = 'email_verification'").run(user.id);
    db.prepare("INSERT INTO tokens (user_id, token, type, expires_at) VALUES (?, ?, 'email_verification', ?)")
      .run(user.id, token, expiresAt);
    
    console.log(`[EMAIL SIMULATION] Email verification link: ${process.env.APP_URL}/verify-email?token=${token}`);
    res.json({ success: true, message: "Verification email sent." });
  });

  app.post("/api/auth/verify-email", (req, res) => {
    const { token } = req.body;
    const tokenData = db.prepare("SELECT * FROM tokens WHERE token = ? AND type = 'email_verification'").get(token) as any;
    
    if (!tokenData || new Date(tokenData.expires_at) < new Date()) {
      return res.status(400).json({ error: "Invalid or expired token" });
    }
    
    db.prepare("UPDATE users SET email_verified = 1 WHERE id = ?").run(tokenData.user_id);
    db.prepare("DELETE FROM tokens WHERE id = ?").run(tokenData.id);
    
    auditLogger.log(tokenData.user_id, 'EMAIL_VERIFIED', 'auth', null, {}, req.ip);
    res.json({ success: true, message: "Email verified successfully." });
  });

  app.get("/api/auth/me", authenticate, (req, res) => {
    const user = (req as any).user;
    const fullUser = db.prepare("SELECT id, email, name, role, email_verified, email_notifications, webhook_notifications FROM users WHERE id = ?").get(user.id);
    
    if (!fullUser) {
      res.clearCookie("token");
      return res.status(401).json({ error: "User not found" });
    }
    
    res.json(fullUser);
  });

  app.post("/api/auth/logout", (req, res) => {
    const token = req.cookies.token;
    if (token) {
      try {
        const decoded = jwt.verify(token, JWT_SECRET) as any;
        auditLogger.log(decoded.id, 'LOGOUT', 'auth', null, {}, req.ip);
      } catch (e) {}
    }
    res.clearCookie("token", {
      httpOnly: true,
      secure: true,
      sameSite: "none",
    });
    res.json({ success: true });
  });

  // Auth Mock
  app.post("/api/auth/register", (req, res) => {
    const { email, password, name } = req.body;
    try {
      const stmt = db.prepare("INSERT INTO users (email, password, name, role) VALUES (?, ?, ?, ?)");
      const info = stmt.run(email, password, name, 'User');
      const user = { id: info.lastInsertRowid, email, name, role: 'User' };
      
      const token = jwt.sign(user, JWT_SECRET, { expiresIn: "24h" });
      auditLogger.log(user.id as number, 'REGISTER', 'auth', user.id.toString(), { email, name }, req.ip);
      res.cookie("token", token, {
        httpOnly: true,
        secure: true,
        sameSite: "none",
        maxAge: 24 * 60 * 60 * 1000,
      });

      res.json(user);
    } catch (e) {
      res.status(400).json({ error: "User already exists" });
    }
  });

  app.post("/api/auth/login", (req, res) => {
    const { email, password } = req.body;
    const user = db.prepare("SELECT id, email, name, role FROM users WHERE email = ? AND password = ?").get(email, password) as any;
    if (user) {
      const token = jwt.sign(user, JWT_SECRET, { expiresIn: "24h" });
      auditLogger.log(user.id, 'LOGIN', 'auth', user.id.toString(), { email }, req.ip);
      res.cookie("token", token, {
        httpOnly: true,
        secure: true,
        sameSite: "none",
        maxAge: 24 * 60 * 60 * 1000,
      });
      res.json(user);
    } else {
      res.status(401).json({ error: "Invalid credentials" });
    }
  });

  // Settings - Profile Update
  app.patch("/api/user/profile", authenticate, (req, res) => {
    const { name, email } = req.body;
    const userId = (req as any).user.id;
    try {
      db.prepare("UPDATE users SET name = ?, email = ? WHERE id = ?").run(name, email, userId);
      auditLogger.log(userId, 'PROFILE_UPDATE', 'user', userId.toString(), { name, email }, req.ip);
      res.json({ success: true });
    } catch (e) {
      res.status(400).json({ error: "Email already in use or invalid data" });
    }
  });

  // Settings - Password Change
  app.patch("/api/user/password", authenticate, (req, res) => {
    const { currentPassword, newPassword } = req.body;
    const userId = (req as any).user.id;
    const user = db.prepare("SELECT password FROM users WHERE id = ?").get(userId) as any;
    
    if (user.password !== currentPassword) {
      return res.status(400).json({ error: "Current password incorrect" });
    }
    
    db.prepare("UPDATE users SET password = ? WHERE id = ?").run(newPassword, userId);
    auditLogger.log(userId, 'PASSWORD_CHANGE', 'user', userId.toString(), {}, req.ip);
    res.json({ success: true });
  });

  // Settings - Notification Preferences
  app.patch("/api/user/notifications", authenticate, (req, res) => {
    const { email_notifications, webhook_notifications } = req.body;
    const userId = (req as any).user.id;
    db.prepare("UPDATE users SET email_notifications = ?, webhook_notifications = ? WHERE id = ?")
      .run(email_notifications ? 1 : 0, webhook_notifications ? 1 : 0, userId);
    auditLogger.log(userId, 'NOTIFICATION_PREFS_UPDATE', 'user', userId.toString(), { email_notifications, webhook_notifications }, req.ip);
    res.json({ success: true });
  });

  // Settings - Account Deletion
  app.delete("/api/user", authenticate, (req, res) => {
    const userId = (req as any).user.id;
    // Delete related data first
    db.prepare("DELETE FROM detections WHERE user_id = ?").run(userId);
    db.prepare("DELETE FROM complaints WHERE user_id = ?").run(userId);
    db.prepare("DELETE FROM tokens WHERE user_id = ?").run(userId);
    db.prepare("DELETE FROM users WHERE id = ?").run(userId);
    
    auditLogger.log(userId, 'ACCOUNT_DELETION', 'user', userId.toString(), {}, req.ip);
    res.clearCookie("token", {
      httpOnly: true,
      secure: true,
      sameSite: "none",
    });
    res.json({ success: true });
  });

  // Scam Detection logic using Gemini
  app.post("/api/detect", optionalAuthenticate, async (req, res) => {
    const { message } = req.body;
    const user = (req as any).user;
    const userId = user?.id || null;
    
    console.log(`[Detection] Processing request for user: ${userId || 'Guest'}`);
    
    const apiKey = process.env.GEMINI_API_KEY;
    const isApiKeyConfigured = apiKey && apiKey !== "MY_GEMINI_API_KEY" && apiKey.trim() !== "";

    try {
      let result;
      
      if (isApiKeyConfigured) {
        try {
          const ai = new GoogleGenAI({ apiKey: apiKey! });
          const model = ai.models.generateContent({
            model: "gemini-3-flash-preview", 
            contents: `Analyze the following message for cyber scam patterns (phishing, OTP fraud, fake lottery, bank scams, etc.). 
            Return a JSON object with:
            - verdict: "Scam" or "Safe"
            - riskLevel: "Low", "Medium", or "High"
            - confidence: 0 to 1
            - analysis: A brief explanation of why it's a scam or safe.
            - category: A specific scam category (e.g., "Phishing", "OTP Fraud", "Lottery Scam", "Bank Fraud", "Safe")
            - suspicious_phrases: An array of strings containing specific phrases from the message that are suspicious.
            - reasons: An array of concise strings explaining the reasons for the prediction.
            - recommended_actions: An array of strings suggesting next steps for the user.
            
            Message: "${message}"`,
            config: { responseMimeType: "application/json" }
          });

          const response = await model;
          console.log(`[Detection] Raw AI Response:`, response.text);
          result = JSON.parse(response.text || "{}");
          
          // Normalize keys for frontend compatibility
          if ((result as any).prediction && !result.verdict) result.verdict = (result as any).prediction;
          if ((result as any).risk_level && !result.riskLevel) result.riskLevel = (result as any).risk_level;
          
          // Ensure defaults
          if (!result.verdict) result.verdict = 'Safe';
          if (!result.riskLevel) result.riskLevel = 'Low';
          
          result.fallback_used = false;
        } catch (aiError) {
          console.warn("Primary AI model failed, falling back to rule-based detection:", aiError);
          result = ruleBasedDetection(message);
        }
      } else {
        console.warn("Gemini API key not configured, using rule-based detection fallback.");
        result = ruleBasedDetection(message);
      }

      // Threat Intel Enrichment
      const indicators = threatIntelService.extractIndicators(message);
      const enrichedIndicators = await threatIntelService.getReputation(indicators);
      result.threat_intel = enrichedIndicators;

      // Store in DB
      const stmt = db.prepare(`
        INSERT INTO detections (
          user_id, message_text, prediction, risk_level, confidence, analysis, 
          category, suspicious_phrases, reasons, recommended_actions, threat_intel
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const info = stmt.run(
        userId, 
        message, 
        result.verdict, 
        result.riskLevel, 
        result.confidence, 
        result.analysis,
        result.category,
        JSON.stringify(result.suspicious_phrases || []),
        JSON.stringify(result.reasons || []),
        JSON.stringify(result.recommended_actions || []),
        JSON.stringify(result.threat_intel || [])
      );

      const detectionId = info.lastInsertRowid as number;
      
      auditLogger.log(userId, 'DETECTION_SUBMIT', 'detections', detectionId.toString(), { riskLevel: result.riskLevel, verdict: result.verdict }, req.ip);

      // Trigger Alert if High Risk
      if (result.riskLevel === 'High' && (req as any).user?.email) {
        notificationService.triggerAlert(detectionId, message, result.riskLevel, (req as any).user.email);
      }

      res.json(result);
    } catch (error) {
      console.error("Detection error:", error);
      res.status(500).json({ error: "Failed to analyze message" });
    }
  });

  // Batch Scam Detection logic
  app.post("/api/detect/batch", optionalAuthenticate, async (req, res) => {
    const { messages } = req.body; // Array of strings
    const user = (req as any).user;
    const userId = user?.id || null;
    
    console.log(`[Batch Detection] Processing ${messages?.length || 0} messages for user: ${userId || 'Guest'}`);
    
    const apiKey = process.env.GEMINI_API_KEY;
    const isApiKeyConfigured = apiKey && apiKey !== "MY_GEMINI_API_KEY" && apiKey.trim() !== "";

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: "Invalid messages format." });
    }

    const results = [];
    const ai = isApiKeyConfigured ? new GoogleGenAI({ apiKey: apiKey! }) : null;

    for (const message of messages) {
      try {
        let result;
        if (ai) {
          try {
            const model = ai.models.generateContent({
              model: "gemini-3-flash-preview", 
              contents: `Analyze the following message for cyber scam patterns (phishing, OTP fraud, fake lottery, bank scams, etc.). 
              Return a JSON object with:
              - verdict: "Scam" or "Safe"
              - riskLevel: "Low", "Medium", or "High"
              - confidence: 0 to 1
              - analysis: A brief explanation of why it's a scam or safe.
              - category: A specific scam category (e.g., "Phishing", "OTP Fraud", "Lottery Scam", "Bank Fraud", "Safe")
              - suspicious_phrases: An array of strings containing specific phrases from the message that are suspicious.
              - reasons: An array of concise strings explaining the reasons for the prediction.
              - recommended_actions: An array of strings suggesting next steps for the user.
              
              Message: "${message}"`,
              config: { responseMimeType: "application/json" }
            });

            const response = await model;
            result = JSON.parse(response.text || "{}");
            
            // Normalize keys for frontend compatibility
            if ((result as any).prediction && !result.verdict) result.verdict = (result as any).prediction;
            if ((result as any).risk_level && !result.riskLevel) result.riskLevel = (result as any).risk_level;
            
            // Ensure defaults
            if (!result.verdict) result.verdict = 'Safe';
            if (!result.riskLevel) result.riskLevel = 'Low';
            
            result.fallback_used = false;
          } catch (aiError) {
            console.warn(`Primary AI model failed for batch message, falling back to rule-based detection:`, aiError);
            result = ruleBasedDetection(message);
          }
        } else {
          result = ruleBasedDetection(message);
        }

        // Threat Intel Enrichment
        const indicators = threatIntelService.extractIndicators(message);
        const enrichedIndicators = await threatIntelService.getReputation(indicators);
        result.threat_intel = enrichedIndicators;

        // Store in DB
        const stmt = db.prepare(`
          INSERT INTO detections (
            user_id, message_text, prediction, risk_level, confidence, analysis, 
            category, suspicious_phrases, reasons, recommended_actions, threat_intel
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        const info = stmt.run(
          userId, 
          message, 
          result.verdict, 
          result.riskLevel, 
          result.confidence, 
          result.analysis,
          result.category,
          JSON.stringify(result.suspicious_phrases || []),
          JSON.stringify(result.reasons || []),
          JSON.stringify(result.recommended_actions || []),
          JSON.stringify(result.threat_intel || [])
        );

        const detectionId = info.lastInsertRowid as number;

        auditLogger.log(userId, 'DETECTION_SUBMIT_BATCH', 'detections', detectionId.toString(), { riskLevel: result.riskLevel, verdict: result.verdict }, req.ip);

        // Trigger Alert if High Risk
        if (result.riskLevel === 'High' && (req as any).user?.email) {
          notificationService.triggerAlert(detectionId, message, result.riskLevel, (req as any).user.email);
        }

        results.push({ message, ...result });
      } catch (error) {
        console.error(`Batch detection error for message: ${message}`, error);
        results.push({ message, error: "Failed to analyze message" });
      }
    }

    res.json(results);
  });

  // Fetch Detection History with Pagination, Filtering, and Sorting
  app.get("/api/detections", authenticate, (req, res) => {
    const user = (req as any).user;
    const { page = 1, limit = 20, search = '', riskLevel = '', prediction = '', sortBy = 'timestamp', sortOrder = 'DESC' } = req.query;
    
    const offset = (Number(page) - 1) * Number(limit);
    const sortMapping: Record<string, string> = {
      'timestamp': 'timestamp',
      'confidence': 'confidence',
      'riskLevel': 'risk_level',
      'verdict': 'prediction'
    };
    const validSortOrders = ['ASC', 'DESC'];
    
    const finalSortBy = sortMapping[sortBy as string] || 'timestamp';
    const finalSortOrder = validSortOrders.includes(sortOrder as string) ? sortOrder : 'DESC';

    let whereClause = "WHERE 1=1";
    const params: any[] = [];

    if (user.role !== 'Admin' && user.role !== 'Analyst') {
      whereClause += " AND d.user_id = ?";
      params.push(user.id);
    }

    if (search) {
      whereClause += " AND d.message_text LIKE ?";
      params.push(`%${search}%`);
    }

    if (riskLevel) {
      whereClause += " AND d.risk_level = ?";
      params.push(riskLevel);
    }

    if (prediction) {
      whereClause += " AND d.prediction = ?";
      params.push(prediction);
    }

    const countQuery = `
      SELECT COUNT(*) as count 
      FROM detections d 
      ${whereClause}
    `;
    const totalCount = db.prepare(countQuery).get(...params).count;

    const dataQuery = `
      SELECT d.*, u.name as user_name 
      FROM detections d 
      JOIN users u ON d.user_id = u.id 
      ${whereClause}
      ORDER BY d.${finalSortBy} ${finalSortOrder}
      LIMIT ? OFFSET ?
    `;
    const detections = db.prepare(dataQuery).all(...params, Number(limit), offset).map((d: any) => ({
      ...d,
      verdict: d.prediction,
      riskLevel: d.risk_level
    }));

    res.json({
      detections,
      pagination: {
        total: totalCount,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(totalCount / Number(limit))
      }
    });
  });

  // Fetch Notification Logs - Admin Only
  app.get("/api/notifications/logs", authenticate, authorize(['Admin']), (req, res) => {
    const logs = db.prepare(`
      SELECT nl.*, d.message_text, d.risk_level, u.email as user_email
      FROM notification_logs nl
      JOIN detections d ON nl.detection_id = d.id
      JOIN users u ON d.user_id = u.id
      ORDER BY nl.timestamp DESC
    `).all();
    res.json(logs);
  });

  // Analytics - Protected for Admin and Analyst
  app.get("/api/stats", authenticate, authorize(['Admin', 'Analyst']), (req, res) => {
    const { startDate, endDate, riskLevel, prediction } = req.query;
    
    let whereClause = "WHERE 1=1";
    const params: any[] = [];

    if (startDate) {
      whereClause += " AND timestamp >= ?";
      params.push(startDate);
    }
    if (endDate) {
      whereClause += " AND timestamp <= ?";
      params.push(endDate);
    }
    if (riskLevel) {
      whereClause += " AND risk_level = ?";
      params.push(riskLevel);
    }
    if (prediction) {
      whereClause += " AND prediction = ?";
      params.push(prediction);
    }

    const totalUsers = db.prepare("SELECT COUNT(*) as count FROM users").get().count;
    const totalScams = db.prepare(`SELECT COUNT(*) as count FROM detections ${whereClause} AND prediction = 'Scam'`).get(...params).count;
    const recentDetections = db.prepare(`SELECT * FROM detections ${whereClause} ORDER BY timestamp DESC LIMIT 10`).all(...params).map((d: any) => ({
      ...d,
      verdict: d.prediction,
      riskLevel: d.risk_level
    }));
    const riskDistribution = db.prepare(`SELECT risk_level as riskLevel, COUNT(*) as count FROM detections ${whereClause} GROUP BY risk_level`).all(...params);

    res.json({ totalUsers, totalScams, recentDetections, riskDistribution });
  });

  // Export Detections as CSV
  app.get("/api/detections/export", authenticate, authorize(['Admin', 'Analyst']), (req, res) => {
    const { startDate, endDate, riskLevel, prediction } = req.query;
    
    let whereClause = "WHERE 1=1";
    const params: any[] = [];

    if (startDate) {
      whereClause += " AND timestamp >= ?";
      params.push(startDate);
    }
    if (endDate) {
      whereClause += " AND timestamp <= ?";
      params.push(endDate);
    }
    if (riskLevel) {
      whereClause += " AND risk_level = ?";
      params.push(riskLevel);
    }
    if (prediction) {
      whereClause += " AND prediction = ?";
      params.push(prediction);
    }

    const detections = db.prepare(`
      SELECT d.id, u.email as user_email, d.message_text, d.prediction as verdict, d.risk_level as riskLevel, d.confidence, d.category, d.timestamp
      FROM detections d
      JOIN users u ON d.user_id = u.id
      ${whereClause}
      ORDER BY d.timestamp DESC
    `).all(...params);

    auditLogger.log((req as any).user.id, 'DETECTION_EXPORT', 'detections', null, { filters: { startDate, endDate, riskLevel, prediction } }, req.ip);

    // Simple CSV generation
    const headers = ["ID", "User Email", "Message", "Prediction", "Risk Level", "Confidence", "Category", "Timestamp"];
    const csvRows = [headers.join(",")];

    for (const d of detections as any[]) {
      const row = [
        d.id,
        `"${d.user_email}"`,
        `"${d.message_text.replace(/"/g, '""')}"`,
        d.prediction,
        d.risk_level,
        d.confidence,
        d.category,
        d.timestamp
      ];
      csvRows.push(row.join(","));
    }

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=detections_export.csv");
    res.send(csvRows.join("\n"));
  });

  // Complaints - User can submit, Admin can view all
  app.post("/api/complaints", authenticate, authorize(['User', 'Admin']), (req, res) => {
    const { text } = req.body;
    const userId = (req as any).user.id;
    const stmt = db.prepare("INSERT INTO complaints (user_id, complaint_text) VALUES (?, ?)");
    const info = stmt.run(userId, text);
    auditLogger.log(userId, 'COMPLAINT_SUBMIT', 'complaints', info.lastInsertRowid.toString(), {}, req.ip);
    res.json({ success: true });
  });

  app.get("/api/complaints", authenticate, (req, res) => {
    const user = (req as any).user;
    let complaints;
    if (user.role === 'Admin') {
      complaints = db.prepare(`
        SELECT c.*, u.name as user_name, u.email as user_email 
        FROM complaints c 
        JOIN users u ON c.user_id = u.id 
        ORDER BY c.timestamp DESC
      `).all();
    } else {
      complaints = db.prepare(`
        SELECT * FROM complaints 
        WHERE user_id = ? 
        ORDER BY timestamp DESC
      `).all(user.id);
    }
    res.json(complaints);
  });

  app.patch("/api/complaints/:id", authenticate, authorize(['Admin']), (req, res) => {
    const { id } = req.params;
    const { status, reviewer_notes } = req.body;
    
    try {
      const stmt = db.prepare(`
        UPDATE complaints 
        SET status = ?, reviewer_notes = ?, updated_at = CURRENT_TIMESTAMP 
        WHERE id = ?
      `);
      stmt.run(status, reviewer_notes, id);
      auditLogger.log((req as any).user.id, 'COMPLAINT_UPDATE', 'complaints', id, { status, reviewer_notes }, req.ip);
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: "Failed to update complaint" });
    }
  });

  // Audit Logs - Admin Only
  app.get("/api/audit", authenticate, authorize(['Admin']), (req, res) => {
    const { page = 1, limit = 50, action = '', resource = '', userId = '' } = req.query;
    const offset = (Number(page) - 1) * Number(limit);
    
    let whereClause = "WHERE 1=1";
    const params: any[] = [];
    
    if (action) {
      whereClause += " AND a.action = ?";
      params.push(action);
    }
    if (resource) {
      whereClause += " AND a.resource = ?";
      params.push(resource);
    }
    if (userId) {
      whereClause += " AND a.user_id = ?";
      params.push(userId);
    }
    
    const countQuery = `SELECT COUNT(*) as count FROM audit_logs a ${whereClause}`;
    const totalCount = db.prepare(countQuery).get(...params).count;
    
    const dataQuery = `
      SELECT a.*, u.email as user_email, u.name as user_name
      FROM audit_logs a
      LEFT JOIN users u ON a.user_id = u.id
      ${whereClause}
      ORDER BY a.timestamp DESC
      LIMIT ? OFFSET ?
    `;
    const logs = db.prepare(dataQuery).all(...params, Number(limit), offset);
    
    res.json({
      logs,
      pagination: {
        total: totalCount,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(totalCount / Number(limit))
      }
    });
  });

  // --- Vite Integration ---
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
