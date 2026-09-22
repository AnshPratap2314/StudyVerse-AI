// ============================================================
// USER PROFILE CONTROLLER
// ============================================================

const User = require("../models/User");

// Allowed preference value lists
const ALLOWED_LANGUAGES = ["English", "Hindi", "Hinglish", "Spanish", "French"];
const ALLOWED_LEVELS = ["beginner", "intermediate", "advanced"];
const ALLOWED_STYLES = ["simple", "detailed", "socratic", "exam-focused"];


// ------------------------------------------------------------
// GET PROFILE
// ------------------------------------------------------------
async function getProfile(req, res) {
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
            profile: {
                id: user._id,
                name: user.name,
                email: user.email,
                educationLevel: user.educationLevel,
                preferredLanguage: user.preferredLanguage,
                explanationStyle: user.explanationStyle,
                goals: user.goals,
                dailyStudyTarget: user.dailyStudyTarget,
                preferredStudyTime: user.preferredStudyTime,
                timezone: user.timezone,
                subjects: user.subjects,
                currentLevel: user.currentLevel,
                learningPreferences: user.learningPreferences,
                createdAt: user.createdAt,
                updatedAt: user.updatedAt
            }
        });
    } catch (error) {
        console.error("❌ Get profile error:", error);
        return res.status(500).json({
            success: false,
            error: "Failed to fetch user profile."
        });
    }
}


// ------------------------------------------------------------
// UPDATE PROFILE
// ------------------------------------------------------------
async function updateProfile(req, res) {
    try {
        const {
            name,
            educationLevel,
            preferredLanguage,
            explanationStyle,
            goals,
            dailyStudyTarget,
            preferredStudyTime, timezone, subjects, currentLevel, learningPreferences
        } = req.body;

        const user = await User.findById(req.user.id);

        if (!user) {
            return res.status(404).json({
                success: false,
                error: "User not found."
            });
        }

        // Validate and update fields if provided
        if (name !== undefined) {
            if (typeof name !== "string" || !name.trim()) {
                return res.status(400).json({
                    success: false,
                    error: "Name cannot be empty."
                });
            }
            user.name = name.trim();
        }

        if (educationLevel !== undefined) {
            if (!ALLOWED_LEVELS.includes(educationLevel)) {
                return res.status(400).json({
                    success: false,
                    error: `Invalid education level. Allowed values: ${ALLOWED_LEVELS.join(", ")}`
                });
            }
            user.educationLevel = educationLevel;
        }

        if (preferredLanguage !== undefined) {
            if (typeof preferredLanguage !== "string" || preferredLanguage.trim().length < 2 || preferredLanguage.trim().length > 32) {
                return res.status(400).json({ success: false, error: "Preferred language must be a short language name." });
            }
            user.preferredLanguage = preferredLanguage.trim();
        }

        if (explanationStyle !== undefined) {
            if (!ALLOWED_STYLES.includes(explanationStyle)) {
                return res.status(400).json({
                    success: false,
                    error: `Invalid explanation style. Allowed values: ${ALLOWED_STYLES.join(", ")}`
                });
            }
            user.explanationStyle = explanationStyle;
        }

        if (goals !== undefined) {
            if (typeof goals !== "string") {
                return res.status(400).json({
                    success: false,
                    error: "Goals must be a string."
                });
            }
            user.goals = goals.trim();
        }

        if (dailyStudyTarget !== undefined) {
            const target = Number(dailyStudyTarget);
            if (isNaN(target) || target < 0 || target > 24) {
                return res.status(400).json({
                    success: false,
                    error: "Daily study target must be a number between 0 and 24 hours."
                });
            }
            user.dailyStudyTarget = target;
        }

        if (preferredStudyTime !== undefined) {
            if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(String(preferredStudyTime))) return res.status(400).json({success:false,error:"Preferred study time must use HH:MM format."});
            user.preferredStudyTime = preferredStudyTime;
        }
        if (timezone !== undefined) {
            if (typeof timezone !== "string" || timezone.length > 100) return res.status(400).json({success:false,error:"Invalid timezone."});
            user.timezone = timezone.trim();
        }
        if (subjects !== undefined) {
            if (!Array.isArray(subjects) || subjects.some(x => typeof x !== "string" || x.trim().length > 100)) return res.status(400).json({success:false,error:"Subjects must be an array of short strings."});
            user.subjects = [...new Set(subjects.map(x => x.trim()).filter(Boolean))].slice(0,30);
        }
        if (currentLevel !== undefined) {
            if (!ALLOWED_LEVELS.includes(currentLevel)) return res.status(400).json({success:false,error:"Invalid current level."});
            user.currentLevel = currentLevel;
        }
        if (learningPreferences !== undefined) {
            if (!learningPreferences || typeof learningPreferences !== "object" || Array.isArray(learningPreferences)) return res.status(400).json({success:false,error:"Learning preferences must be an object."});
            user.learningPreferences = learningPreferences;
        }

        await user.save();

        return res.status(200).json({
            success: true,
            message: "Profile updated successfully.",
            profile: {
                id: user._id,
                name: user.name,
                email: user.email,
                educationLevel: user.educationLevel,
                preferredLanguage: user.preferredLanguage,
                explanationStyle: user.explanationStyle,
                goals: user.goals,
                dailyStudyTarget: user.dailyStudyTarget,
                preferredStudyTime: user.preferredStudyTime,
                timezone: user.timezone,
                subjects: user.subjects,
                currentLevel: user.currentLevel,
                learningPreferences: user.learningPreferences,
                createdAt: user.createdAt,
                updatedAt: user.updatedAt
            }
        });
    } catch (error) {
        console.error("❌ Update profile error:", error);
        return res.status(500).json({
            success: false,
            error: "Failed to update profile."
        });
    }
}


module.exports = {
    getProfile,
    updateProfile
};