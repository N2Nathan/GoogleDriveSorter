import express from 'express';
import { oauth2Client, getAuthUrl } from '../config/google.js';
import { saveTokens } from '../database/db.js';

const router = express.Router();

// Get authorization URL
router.get('/url', (req, res) => {
  const authUrl = getAuthUrl();
  res.json({ url: authUrl });
});

// Handle OAuth callback
router.get('/google/callback', async (req, res) => {
  const { code } = req.query;

  if (!code) {
    return res.status(400).json({ error: 'No authorization code provided' });
  }

  try {
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    // Save tokens to database (using a simple user_id for now)
    await saveTokens('default_user', tokens);

    // Redirect to frontend with success message
    res.redirect('http://localhost:5173?auth=success');
  } catch (error) {
    console.error('Error during OAuth callback:', error);
    res.redirect('http://localhost:5173?auth=error');
  }
});

// Check authentication status
router.get('/status', async (req, res) => {
  try {
    const { getTokens } = await import('../database/db.js');
    const tokens = await getTokens('default_user');

    if (!tokens) {
      return res.json({ authenticated: false });
    }

    // Check if token is expired
    if (tokens.expiry_date && tokens.expiry_date < Date.now()) {
      return res.json({ authenticated: false, expired: true });
    }

    res.json({ authenticated: true });
  } catch (error) {
    console.error('Error checking auth status:', error);
    res.status(500).json({ error: 'Failed to check authentication status' });
  }
});

export default router;
