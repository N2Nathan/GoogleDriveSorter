import express from 'express';
import { getDriveClient } from '../config/google.js';
import { getTokens, logFileMove, getMoveLogs, undoMoves } from '../database/db.js';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

async function getAuthenticatedDrive() {
  const tokens = await getTokens('default_user');
  if (!tokens) {
    throw new Error('Not authenticated');
  }
  return getDriveClient(tokens);
}

// Move files to folders
router.post('/execute', async (req, res) => {
  try {
    const { moves } = req.body; // Array of { fileId, fileName, targetFolderId, targetFolderName }
    const drive = await getAuthenticatedDrive();
    const batchId = uuidv4();
    const results = [];

    for (const move of moves) {
      try {
        // Get current parents
        const file = await drive.files.get({
          fileId: move.fileId,
          fields: 'parents'
        });

        const previousParents = file.data.parents ? file.data.parents.join(',') : '';

        // Move file
        await drive.files.update({
          fileId: move.fileId,
          addParents: move.targetFolderId,
          removeParents: previousParents,
          fields: 'id, parents'
        });

        // Log the move
        await logFileMove({
          fileId: move.fileId,
          fileName: move.fileName,
          originalParentId: previousParents || 'root',
          newParentId: move.targetFolderId,
          originalParentName: 'Root',
          newParentName: move.targetFolderName,
          batchId
        });

        results.push({
          fileId: move.fileId,
          success: true
        });
      } catch (error) {
        console.error(`Error moving file ${move.fileId}:`, error);
        results.push({
          fileId: move.fileId,
          success: false,
          error: error.message
        });
      }
    }

    res.json({ batchId, results });
  } catch (error) {
    console.error('Error executing moves:', error);
    res.status(500).json({ error: 'Failed to execute moves' });
  }
});

// Create a new folder
router.post('/create-folder', async (req, res) => {
  try {
    const { folderName, parentId } = req.body;
    const drive = await getAuthenticatedDrive();

    const fileMetadata = {
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
      parents: parentId ? [parentId] : ['root']
    };

    const folder = await drive.files.create({
      resource: fileMetadata,
      fields: 'id, name'
    });

    res.json({ folder: folder.data });
  } catch (error) {
    console.error('Error creating folder:', error);
    res.status(500).json({ error: 'Failed to create folder' });
  }
});

// Rename a file
router.post('/rename', async (req, res) => {
  try {
    const { fileId, newName } = req.body;
    const drive = await getAuthenticatedDrive();

    const file = await drive.files.update({
      fileId: fileId,
      resource: { name: newName },
      fields: 'id, name'
    });

    res.json({ file: file.data });
  } catch (error) {
    console.error('Error renaming file:', error);
    res.status(500).json({ error: 'Failed to rename file' });
  }
});

// Get move history
router.get('/history', async (req, res) => {
  try {
    const { limit, batchId } = req.query;
    const logs = await getMoveLogs({
      limit: limit ? parseInt(limit) : 100,
      batchId
    });

    res.json({ logs });
  } catch (error) {
    console.error('Error fetching move history:', error);
    res.status(500).json({ error: 'Failed to fetch move history' });
  }
});

// Undo a batch of moves
router.post('/undo', async (req, res) => {
  try {
    const { batchId } = req.body;
    const drive = await getAuthenticatedDrive();

    // Get all moves for this batch
    const logs = await getMoveLogs({ batchId });

    const results = [];
    for (const log of logs) {
      try {
        // Move file back to original location
        const file = await drive.files.get({
          fileId: log.file_id,
          fields: 'parents'
        });

        const currentParents = file.data.parents ? file.data.parents.join(',') : '';

        await drive.files.update({
          fileId: log.file_id,
          addParents: log.original_parent_id === 'root' ? 'root' : log.original_parent_id,
          removeParents: currentParents,
          fields: 'id, parents'
        });

        results.push({
          fileId: log.file_id,
          success: true
        });
      } catch (error) {
        console.error(`Error undoing move for file ${log.file_id}:`, error);
        results.push({
          fileId: log.file_id,
          success: false,
          error: error.message
        });
      }
    }

    // Mark batch as undone
    await undoMoves(batchId);

    res.json({ results });
  } catch (error) {
    console.error('Error undoing moves:', error);
    res.status(500).json({ error: 'Failed to undo moves' });
  }
});

export default router;
