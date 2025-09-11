const { google } = require("googleapis");
const { getToken } = require("./auth");
require("dotenv").config();

async function insertEvent(event, username) {
    const oAuth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        process.env.GOOGLE_REDIRECT_URI
    );

    const tokens = getToken(username);
    if (!tokens) throw new Error(`No tokens found for user ${username}`);
    oAuth2Client.setCredentials(tokens);

    const calendar = google.calendar({ version: "v3", auth: oAuth2Client });

    try {
        const response = await calendar.events.insert({
            calendarId: process.env.CALENDAR_ID,
            resource: event,
        });
        console.log("✅ Event created:", response.data.htmlLink);
    } catch (error) {
        console.error("❌ Error creating event:", error);
    }
}

module.exports = { insertEvent };
