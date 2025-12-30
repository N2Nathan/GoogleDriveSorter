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
    const { moves, existingFolders = [] } = req.body; // Array of { fileId, fileName, targetFolderId, targetFolderName, createIfNeeded }
    const drive = await getAuthenticatedDrive();
    const batchId = uuidv4();
    const results = [];
    const createdFolders = new Map(); // Cache for created folders

    for (const move of moves) {
      try {
        let targetFolderId = move.targetFolderId;

        // If no targetFolderId provided but we need to create nested folders
        if (!targetFolderId && move.createIfNeeded && move.targetFolderName.includes('/')) {
          // Check cache first
          if (createdFolders.has(move.targetFolderName)) {
            targetFolderId = createdFolders.get(move.targetFolderName);
          } else {
            targetFolderId = await createNestedFolders(drive, move.targetFolderName, existingFolders);
            createdFolders.set(move.targetFolderName, targetFolderId);
          }
        }

        // Get current parents
        const file = await drive.files.get({
          fileId: move.fileId,
          fields: 'parents'
        });

        const previousParents = file.data.parents ? file.data.parents.join(',') : '';

        // Move file
        await drive.files.update({
          fileId: move.fileId,
          addParents: targetFolderId,
          removeParents: previousParents,
          fields: 'id, parents'
        });

        // Log the move
        await logFileMove({
          fileId: move.fileId,
          fileName: move.fileName,
          originalParentId: previousParents || 'root',
          newParentId: targetFolderId,
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

// Helper function to create nested folders
async function createNestedFolders(drive, folderPath, existingFolders) {
  const parts = folderPath.split('/').filter(p => p.length > 0);
  let currentParentId = 'root';

  for (let i = 0; i < parts.length; i++) {
    const folderName = parts[i];
    const currentPath = parts.slice(0, i + 1).join('/');

    // Check if folder already exists at this level
    let existingFolder = existingFolders.find(f => {
      const folderPath = getFolderPath(f, existingFolders);
      return folderPath === currentPath || f.name === folderName;
    });

    // Also check by querying Drive
    if (!existingFolder) {
      const query = `name='${folderName.replace(/'/g, "\\'")}' and '${currentParentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`;
      const response = await drive.files.list({
        q: query,
        fields: 'files(id, name)',
        pageSize: 1
      });

      if (response.data.files && response.data.files.length > 0) {
        existingFolder = response.data.files[0];
      }
    }

    if (existingFolder) {
      currentParentId = existingFolder.id;
    } else {
      // Create the folder
      const fileMetadata = {
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [currentParentId]
      };

      const folder = await drive.files.create({
        resource: fileMetadata,
        fields: 'id, name'
      });

      currentParentId = folder.data.id;
      existingFolders.push({ id: folder.data.id, name: folderName, parents: [currentParentId] });
    }
  }

  return currentParentId;
}

function getFolderPath(folder, allFolders) {
  if (!folder.parents || folder.parents.length === 0 || folder.parents[0] === 'root') {
    return folder.name;
  }

  const parent = allFolders.find(f => f.id === folder.parents[0]);
  if (parent) {
    return getFolderPath(parent, allFolders) + '/' + folder.name;
  }

  return folder.name;
}

// Create a new folder
router.post('/create-folder', async (req, res) => {
  try {
    const { folderName, parentId, existingFolders = [] } = req.body;
    const drive = await getAuthenticatedDrive();

    // Check if it's a nested path (contains /)
    if (folderName.includes('/')) {
      const folderId = await createNestedFolders(drive, folderName, existingFolders);
      res.json({ folder: { id: folderId, name: folderName } });
    } else {
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
    }
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
