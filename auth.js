const { google } = require('googleapis');
require('dotenv').config();
const fs = require('fs');
const path = require('path');

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

// Generate Google login URL
function getAuthUrl() {
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: [
      'https://www.googleapis.com/auth/calendar',
      'https://www.googleapis.com/auth/userinfo.email'
    ]
  });
}

// Exchange code for tokens
async function getTokens(code) {
  const { tokens } = await oauth2Client.getToken(code);
  oauth2Client.setCredentials(tokens);
  return tokens;
}

// Save tokens for a specific user
function saveToken(userId, tokens) {
  const filePath = path.join(__dirname, 'tokens.json');
  let data = {};

  if (fs.existsSync(filePath)) {
    data = JSON.parse(fs.readFileSync(filePath));
  }

  data[userId] = tokens; // use username/email as key
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

// Get tokens for a user
function getToken(userId) {
  const filePath = path.join(__dirname, 'tokens.json');
  if (!fs.existsSync(filePath)) return null;

  const data = JSON.parse(fs.readFileSync(filePath));
  return data[userId] || null;
}

module.exports = {
  oauth2Client,
  getAuthUrl,
  getTokens,
  saveToken,
  getToken
};
