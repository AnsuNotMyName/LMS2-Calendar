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
  console.log(`saveToken called for ${userId}. tokens.json exists? ${fs.existsSync(filePath)}`);
  let data = {};

  if (fs.existsSync(filePath)) {
    try {
      const raw = fs.readFileSync(filePath, 'utf8');
      console.log(`tokens.json raw length=${raw.length} content-preview='${raw.slice(0,100)}'`);
      const trimmed = raw.trim();
      data = trimmed ? JSON.parse(trimmed) : {};
    } catch (err) {
      console.warn(`Warning: failed to parse ${filePath}, creating fresh file (backup created): ${err.message}`);
      try {
        fs.copyFileSync(filePath, filePath + '.bak');
      } catch (copyErr) {
        // ignore backup errors
      }
      data = {};
    }
  }

  data[userId] = tokens; // use username/email as key
  // write atomically: write to temp file then rename
  const tmpPath = filePath + '.tmp';
  fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2));
  try {
    fs.renameSync(tmpPath, filePath);
  } catch (err) {
    // fallback to direct write if rename fails
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    try { fs.unlinkSync(tmpPath); } catch (_) {}
  }
}

// Get tokens for a user
function getToken(userId) {
  const filePath = path.join(__dirname, 'tokens.json');
  if (!fs.existsSync(filePath)) return null;

  try {
    const raw = fs.readFileSync(filePath, 'utf8').trim();
    const data = raw ? JSON.parse(raw) : {};
    return data[userId] || null;
  } catch (err) {
    console.warn(`Warning: failed to parse ${filePath}: ${err.message}`);
    return null;
  }
}

module.exports = {
  oauth2Client,
  getAuthUrl,
  getTokens,
  saveToken,
  getToken
};
