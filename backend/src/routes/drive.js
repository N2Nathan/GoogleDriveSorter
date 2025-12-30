import express from 'express';
import { getDriveClient } from '../config/google.js';
import { getTokens } from '../database/db.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(requireAuth);

// Get authenticated drive client for current user
async function getAuthenticatedDrive(userId) {
  const tokens = await getTokens(userId);
  if (!tokens) {
    throw new Error('Not authenticated');
  }
  return getDriveClient(tokens);
}

// Get all files not in folders (root-level files)
router.get('/unorganized-files', async (req, res) => {
  try {
    const drive = await getAuthenticatedDrive(req.session.userId);

    const response = await drive.files.list({
      q: "'root' in parents and trashed = false",
      fields: 'files(id, name, mimeType, size, createdTime, modifiedTime, webViewLink, thumbnailLink, iconLink)',
      pageSize: 1000
    });

    res.json({ files: response.data.files || [] });
  } catch (error) {
    console.error('Error fetching unorganized files:', error);
    res.status(500).json({ error: 'Failed to fetch files' });
  }
});

// Get all folders
router.get('/folders', async (req, res) => {
  try {
    const drive = await getAuthenticatedDrive(req.session.userId);

    const response = await drive.files.list({
      q: "mimeType='application/vnd.google-apps.folder' and trashed = false",
      fields: 'files(id, name, parents, createdTime, modifiedTime)',
      pageSize: 1000
    });

    res.json({ folders: response.data.files || [] });
  } catch (error) {
    console.error('Error fetching folders:', error);
    res.status(500).json({ error: 'Failed to fetch folders' });
  }
});

// Get folder structure (nested)
router.get('/folder-structure', async (req, res) => {
  try {
    const drive = await getAuthenticatedDrive(req.session.userId);

    const response = await drive.files.list({
      q: "mimeType='application/vnd.google-apps.folder' and trashed = false",
      fields: 'files(id, name, parents)',
      pageSize: 1000
    });

    const folders = response.data.files || [];

    // Build folder tree
    const folderMap = {};
    const rootFolders = [];

    folders.forEach(folder => {
      folderMap[folder.id] = { ...folder, children: [] };
    });

    folders.forEach(folder => {
      if (!folder.parents || folder.parents.includes('root')) {
        rootFolders.push(folderMap[folder.id]);
      } else {
        const parentId = folder.parents[0];
        if (folderMap[parentId]) {
          folderMap[parentId].children.push(folderMap[folder.id]);
        }
      }
    });

    res.json({ structure: rootFolders, allFolders: folders });
  } catch (error) {
    console.error('Error fetching folder structure:', error);
    res.status(500).json({ error: 'Failed to fetch folder structure' });
  }
});

// Download file content for analysis
router.get('/file/:fileId/content', async (req, res) => {
  try {
    const drive = await getAuthenticatedDrive(req.session.userId);
    const { fileId } = req.params;

    const file = await drive.files.get({
      fileId: fileId,
      fields: 'id, name, mimeType, size'
    });

    // Check file size (limit to 10MB for now)
    if (file.data.size && parseInt(file.data.size) > 10 * 1024 * 1024) {
      return res.status(400).json({ error: 'File too large for analysis' });
    }

    const response = await drive.files.get(
      { fileId: fileId, alt: 'media' },
      { responseType: 'arraybuffer' }
    );

    res.json({
      fileId: file.data.id,
      fileName: file.data.name,
      mimeType: file.data.mimeType,
      content: Buffer.from(response.data).toString('base64')
    });
  } catch (error) {
    console.error('Error downloading file:', error);
    res.status(500).json({ error: 'Failed to download file' });
  }
});

export default router;
