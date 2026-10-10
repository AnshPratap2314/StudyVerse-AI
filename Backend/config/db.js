// ============================================================
// DATABASE CONNECTION
// ============================================================
//
// Person 2 owns this file.
//
// Connects to MongoDB using Mongoose.
// Connection is non-blocking to ensure existing features work
// even if database is offline or unwhitelisted.
//
// ============================================================

const mongoose = require("mongoose");


async function connectDB() {

    const uri = process.env.MONGODB_URI;


    if (!uri) {

        console.warn(
            "⚠️  MONGODB_URI is missing from .env. Database features unavailable."
        );

        return false;

    }


    try {

        // Connection options for Atlas / local compatibility
        const options = {
            serverSelectionTimeoutMS: 5000,
            autoIndex: true
        };


        await mongoose.connect(uri, options);

        console.log(
            "✅ MongoDB connected successfully"
        );

        return true;

    } catch (error) {

        console.error("");
        console.error("❌ MongoDB connection failed:", error.message);


        if (error.message.includes("SSL") || error.message.includes("tlsv1 alert")) {

            console.error("💡 TLS/SSL FIX:");

            console.error("   1. If using MongoDB Atlas: Check Network Access in Atlas dashboard.");

            console.error("   2. Make sure your current IP address is whitelisted (or add 0.0.0.0/0).");

            console.error("   3. Check if VPN/Antivirus is blocking port 27017.");

        }


        console.error("");

        return false;

    }

}


function isDbConnected() {

    return mongoose.connection.readyState === 1;

}


mongoose.connection.on("disconnected", () => {

    console.warn(
        "⚠️  MongoDB disconnected"
    );

});


mongoose.connection.on("error", (error) => {

    console.error(
        "❌ MongoDB runtime error:",
        error.message
    );

});


module.exports = {
    connectDB,
    isDbConnected
};