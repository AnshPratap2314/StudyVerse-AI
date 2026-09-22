// ============================================================
// AUTHENTICATION MIDDLEWARE
// ============================================================

const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET;

function authenticateToken(req, res, next) {

    if (!JWT_SECRET) {
        return res.status(503).json({ success: false, error: "Authentication is not configured." });
    }

    const authHeader = req.headers["authorization"];

    const token =
        authHeader && authHeader.startsWith("Bearer ")
            ? authHeader.split(" ")[1]
            : null;


    if (!token) {

        return res.status(401).json({

            success: false,

            error: "Access denied. Authentication token is missing."

        });

    }


    try {

        const decoded = jwt.verify(token, JWT_SECRET);

        req.user = {
            id: decoded.id
        };

        next();

    } catch (error) {

        return res.status(401).json({

            success: false,

            error: "Invalid or expired token."

        });

    }

}

module.exports = authenticateToken;