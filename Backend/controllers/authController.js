// ============================================================
// AUTHENTICATION CONTROLLER
// ============================================================

const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const User = require("../models/User");

async function sendPasswordResetEmail({ to, token }) {
    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.PASSWORD_RESET_FROM;
    const appUrl = process.env.PASSWORD_RESET_URL || "http://localhost:5050";
    if (!apiKey || !from) return false;
    const resetUrl = `${appUrl.replace(/\/$/, "")}/#resetToken=${encodeURIComponent(token)}`;
    const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from, to: [to], subject: "Smart Study AI password reset", html: `<p>Reset your Smart Study AI password.</p><p><a href="${resetUrl}">Reset password</a></p><p>This link expires in 15 minutes.</p>` })
    });
    if (!response.ok) throw new Error("Password reset email delivery failed.");
    return true;
}

const JWT_SECRET = process.env.JWT_SECRET;


function generateToken(userId) {
    if (!JWT_SECRET) throw new Error("JWT_SECRET is not configured.");
    return jwt.sign(
        { id: userId },
        JWT_SECRET,
        { expiresIn: "7d" }
    );
}


// ------------------------------------------------------------
// REGISTER
// ------------------------------------------------------------

async function register(req, res) {
    try {
        const { name, email, password } = req.body;

        if (!name || typeof name !== "string" || !name.trim()) {
            return res.status(400).json({
                success: false,
                error: "Name is required."
            });
        }

        if (!email || typeof email !== "string" || !email.trim()) {
            return res.status(400).json({
                success: false,
                error: "Email is required."
            });
        }

        const emailRegex = /^\S+@\S+\.\S+$/;
        if (!emailRegex.test(email.trim())) {
            return res.status(400).json({
                success: false,
                error: "Please enter a valid email address."
            });
        }

        if (!password || typeof password !== "string" || password.length < 6) {
            return res.status(400).json({
                success: false,
                error: "Password must be at least 6 characters long."
            });
        }

        const normalizedEmail = email.trim().toLowerCase();

        const existingUser = await User.findOne({ email: normalizedEmail });
        if (existingUser) {
            return res.status(409).json({
                success: false,
                error: "An account with this email address already exists."
            });
        }

        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(password, salt);

        const newUser = await User.create({
            name: name.trim(),
            email: normalizedEmail,
            passwordHash
        });

        const token = generateToken(newUser._id);

        return res.status(201).json({
            success: true,
            message: "User registered successfully.",
            token,
            user: {
                id: newUser._id,
                name: newUser.name,
                email: newUser.email,
                createdAt: newUser.createdAt
            }
        });
    } catch (error) {
        console.error("❌ Registration error:", error);
        return res.status(500).json({
            success: false,
            error: "Failed to register user."
        });
    }
}


// ------------------------------------------------------------
// LOGIN
// ------------------------------------------------------------

async function login(req, res) {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                error: "Email and password are required."
            });
        }

        const normalizedEmail = String(email).trim().toLowerCase();

        const user = await User.findOne({ email: normalizedEmail });
        if (!user) {
            return res.status(401).json({
                success: false,
                error: "Invalid email or password."
            });
        }

        const isMatch = await bcrypt.compare(password, user.passwordHash);
        if (!isMatch) {
            return res.status(401).json({
                success: false,
                error: "Invalid email or password."
            });
        }

        const token = generateToken(user._id);

        return res.status(200).json({
            success: true,
            message: "Login successful.",
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                createdAt: user.createdAt
            }
        });
    } catch (error) {
        console.error("❌ Login error:", error);
        return res.status(500).json({
            success: false,
            error: "Failed to login."
        });
    }
}


// ------------------------------------------------------------
// GET ME
// ------------------------------------------------------------

async function getMe(req, res) {
    try {
        const user = await User.findById(req.user.id).select("-passwordHash");

        if (!user) {
            return res.status(404).json({
                success: false,
                error: "User not found."
            });
        }

        return res.status(200).json({
            success: true,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                educationLevel: user.educationLevel,
                currentLevel: user.currentLevel,
                preferredLanguage: user.preferredLanguage,
                explanationStyle: user.explanationStyle,
                goals: user.goals,
                dailyStudyTarget: user.dailyStudyTarget,
                preferredStudyTime: user.preferredStudyTime,
                timezone: user.timezone,
                subjects: user.subjects,
                learningPreferences: user.learningPreferences,
                createdAt: user.createdAt,
                updatedAt: user.updatedAt
            }
        });
    } catch (error) {
        console.error("❌ Get me error:", error);
        return res.status(500).json({
            success: false,
            error: "Failed to fetch user data."
        });
    }
}


async function logout(req,res){
    const sessions = global.smartStudyGoogleSessions;
    if (sessions && req.user?.id) {
        for (const [sid, session] of sessions.entries()) {
            if (String(session.userId) === String(req.user.id)) {
                try {
                    if (session.access_token) await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(session.access_token)}`, { method: "POST" });
                } catch {}
                sessions.delete(sid);
            }
        }
    }
    try {
        const GoogleIntegration = require("../models/GoogleIntegration");
        await GoogleIntegration.deleteOne({ userId: req.user.id });
    } catch {}
    return res.status(200).json({success:true,message:"Logged out successfully. Remove the token from the client."});
}



async function forgotPassword(req, res) {
    try {
        const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
        const normalizedEmail = email;
        if (!/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ success: false, error: "Enter a valid email address." });
        const user = await User.findOne({ email: normalizedEmail }).select("+resetTokenHash +resetTokenExpiresAt");
        const generic = { success: true, message: "If an account exists, a password reset token has been created." };
        if (!user) return res.json(generic);
        const rawToken = crypto.randomBytes(32).toString("hex");
        user.resetTokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
        user.resetTokenExpiresAt = new Date(Date.now() + 15 * 60 * 1000);
        await user.save();
        let delivered = false;
        try {
            delivered = await sendPasswordResetEmail({ to: normalizedEmail, token: rawToken });
        } catch (deliveryError) {
            console.error("Password reset email delivery error:", deliveryError.message);
        }
        if (process.env.NODE_ENV !== "production" && process.env.ALLOW_DEV_RESET_TOKEN === "true") {
            return res.json({ ...generic, resetToken: rawToken, expiresInMinutes: 15, deliveryConfigured: delivered });
        }
        if (!delivered) console.warn("Password reset token created but no email provider is configured for this environment.");
        return res.json({ ...generic, deliveryConfigured: delivered });
    } catch (error) {
        console.error("Password reset request error:", error);
        return res.status(500).json({ success: false, error: "Unable to start password reset." });
    }
}

async function resetPassword(req, res) {
    try {
        const token = typeof req.body?.token === "string" ? req.body.token.trim() : "";
        const password = typeof req.body?.password === "string" ? req.body.password : "";
        if (!token || token.length < 20) return res.status(400).json({ success: false, error: "A valid reset token is required." });
        if (password.length < 6) return res.status(400).json({ success: false, error: "Password must be at least 6 characters long." });
        const hash = crypto.createHash("sha256").update(token).digest("hex");
        const user = await User.findOne({ resetTokenHash: hash, resetTokenExpiresAt: { $gt: new Date() } }).select("+resetTokenHash +resetTokenExpiresAt");
        if (!user) return res.status(400).json({ success: false, error: "Reset token is invalid or expired." });
        user.passwordHash = await bcrypt.hash(password, await bcrypt.genSalt(10));
        user.resetTokenHash = undefined;
        user.resetTokenExpiresAt = undefined;
        await user.save();
        return res.json({ success: true, message: "Password reset successfully. You can now sign in." });
    } catch (error) {
        console.error("Password reset error:", error);
        return res.status(500).json({ success: false, error: "Unable to reset password." });
    }
}

module.exports = { register, login, getMe, logout  , forgotPassword, resetPassword };