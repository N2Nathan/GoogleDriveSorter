import express from 'express';
import { google } from 'googleapis';
import { oauth2Client, getAuthUrl } from '../config/google.js';
import { saveTokens, createOrUpdateUser, getUserById } from '../database/db.js';

const router = express.Router();
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

// Get authorization URL
router.get('/url', (req, res) => {
  const authUrl = getAuthUrl();
  res.json({ url: authUrl });
});

// Handle OAuth callback
router.get('/google/callback', async (req, res) => {
  const { code } = req.query;

  if (!code) {
    return res.redirect(`${FRONTEND_URL}?auth=error&message=no_code`);
  }

  try {
    // Exchange code for tokens
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    // Get user profile from Google
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const { data: profile } = await oauth2.userinfo.get();

    // Create or update user in database
    const userId = await createOrUpdateUser({
      id: profile.id,
      email: profile.email,
      name: profile.name,
      picture: profile.picture
    });

    // Save tokens for this user
    await saveTokens(userId, tokens);

    // Create session
    req.session.userId = userId;
    req.session.user = {
      id: userId,
      googleId: profile.id,
      email: profile.email,
      name: profile.name,
      picture: profile.picture
    };

    // Redirect to frontend with success message
    res.redirect(`${FRONTEND_URL}?auth=success`);
  } catch (error) {
    console.error('Error during OAuth callback:', error);
    res.redirect(`${FRONTEND_URL}?auth=error&message=callback_failed`);
  }
});

// Check authentication status
router.get('/status', async (req, res) => {
  try {
    if (!req.session || !req.session.userId) {
      return res.json({ authenticated: false });
    }

    const user = await getUserById(req.session.userId);

    if (!user) {
      return res.json({ authenticated: false });
    }

    res.json({
      authenticated: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        picture: user.picture
      }
    });
  } catch (error) {
    console.error('Error checking auth status:', error);
    res.status(500).json({ error: 'Failed to check authentication status' });
  }
});

// Get current user info
router.get('/me', async (req, res) => {
  try {
    if (!req.session || !req.session.userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const user = await getUserById(req.session.userId);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      id: user.id,
      email: user.email,
      name: user.name,
      picture: user.picture
    });
  } catch (error) {
    console.error('Error getting user info:', error);
    res.status(500).json({ error: 'Failed to get user info' });
  }
});

// Logout
router.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Error destroying session:', err);
      return res.status(500).json({ error: 'Failed to logout' });
    }
    res.clearCookie('connect.sid');
    res.json({ success: true });
  });
});

export default router;
