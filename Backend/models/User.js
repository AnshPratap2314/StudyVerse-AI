// ============================================================
// USER MODEL (EXTENDED WITH PROFILE PREFERENCES)
// ============================================================

const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: [true, "Name is required"],
            trim: true,
            maxlength: [100, "Name cannot exceed 100 characters"]
        },

        email: {
            type: String,
            required: [true, "Email is required"],
            unique: true,
            lowercase: true,
            trim: true,
            match: [/^\S+@\S+\.\S+$/, "Please enter a valid email address"]
        },

        passwordHash: {
            type: String,
            required: [true, "Password hash is required"]
        },

        // Profile & Learning Preferences
        educationLevel: {
            type: String,
            enum: ["beginner", "intermediate", "advanced"],
            default: "intermediate"
        },

        preferredLanguage: {
            type: String,
            trim: true,
            maxlength: 32,
            default: "English"
        },

        resetTokenHash: { type: String, select: false },
        resetTokenExpiresAt: { type: Date, select: false },

        explanationStyle: {
            type: String,
            enum: ["simple", "detailed", "socratic", "exam-focused"],
            default: "simple"
        },

        goals: {
            type: String,
            default: "",
            maxlength: [500, "Goals cannot exceed 500 characters"]
        },

        dailyStudyTarget: {
            type: Number,
            default: 1,
            min: [0, "Study target cannot be negative"],
            max: [24, "Study target cannot exceed 24 hours"]
        },
        preferredStudyTime: { type: String, default: "18:00" },
        timezone: { type: String, default: "Asia/Kolkata" },
        subjects: { type: [String], default: [] },
        currentLevel: { type: String, enum: ["beginner", "intermediate", "advanced"], default: "intermediate" },
        learningPreferences: { type: mongoose.Schema.Types.Mixed, default: {} },
        lastActiveAt: { type: Date, default: Date.now }
    },

    {
        timestamps: true
    }
);

module.exports = mongoose.model("User", userSchema);