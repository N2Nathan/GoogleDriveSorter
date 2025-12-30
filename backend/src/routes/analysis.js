import express from 'express';
import { analyzeFileName, performOCR, analyzeFileContent } from '../services/analysis.js';
import { getCachedAnalysis, saveCachedAnalysis } from '../database/db.js';
import { analyzeFileForClient, shouldOrganizeByClient, getClientFolderPath } from '../services/clientDetection.js';

const router = express.Router();

// Analyze a single file
router.post('/file', async (req, res) => {
  try {
    const { fileId, fileName, mimeType, content } = req.body;

    // Check cache first
    const cached = await getCachedAnalysis(fileId);
    if (cached) {
      return res.json({
        fileId,
        originalName: cached.original_name,
        suggestedName: cached.suggested_name,
        analysis: cached.analysis_data,
        fromCache: true
      });
    }

    let analysis = {
      needsRenaming: false,
      suggestedName: fileName,
      confidence: 0,
      reasoning: ''
    };

    // Check if filename is generic or unclear
    const genericPatterns = [
      /^(untitled|document|file|image|photo|screenshot|scan)/i,
      /^IMG_\d+/i,
      /^DSC\d+/i,
      /^Screenshot/i,
      /^\d{8}_\d{6}/i  // Date-based names like 20231215_143022
    ];

    const isGeneric = genericPatterns.some(pattern => pattern.test(fileName));

    if (isGeneric || content) {
      // Perform OCR if it's an image
      if (mimeType && mimeType.startsWith('image/') && content) {
        const ocrResult = await performOCR(content);
        analysis = await analyzeFileContent(fileName, mimeType, ocrResult.text);
      } else if (content) {
        analysis = await analyzeFileContent(fileName, mimeType, content);
      } else {
        analysis = await analyzeFileName(fileName);
      }
    }

    // Save to cache
    await saveCachedAnalysis(fileId, fileName, analysis.suggestedName, analysis);

    res.json({
      fileId,
      originalName: fileName,
      suggestedName: analysis.suggestedName,
      analysis,
      fromCache: false
    });
  } catch (error) {
    console.error('Error analyzing file:', error);
    res.status(500).json({ error: 'Failed to analyze file' });
  }
});

// Batch analyze multiple files
router.post('/batch', async (req, res) => {
  try {
    const { files, includeClientDetection = true } = req.body;
    const results = [];

    for (const file of files) {
      try {
        // Check cache
        const cached = await getCachedAnalysis(file.fileId);
        if (cached) {
          results.push({
            fileId: file.fileId,
            originalName: cached.original_name,
            suggestedName: cached.suggested_name,
            analysis: cached.analysis_data,
            client: cached.analysis_data?.client || null,
            fromCache: true
          });
          continue;
        }

        // Simple analysis based on filename
        const analysis = await analyzeFileName(file.fileName);

        // Detect client if enabled
        let detectedClient = null;
        if (includeClientDetection) {
          detectedClient = await analyzeFileForClient({
            fileId: file.fileId,
            fileName: file.fileName,
            mimeType: file.mimeType
          });
        }

        // Add client to analysis
        analysis.client = detectedClient;

        await saveCachedAnalysis(file.fileId, file.fileName, analysis.suggestedName, analysis);

        results.push({
          fileId: file.fileId,
          originalName: file.fileName,
          suggestedName: analysis.suggestedName,
          analysis,
          client: detectedClient,
          fromCache: false
        });
      } catch (error) {
        console.error(`Error analyzing file ${file.fileId}:`, error);
        results.push({
          fileId: file.fileId,
          originalName: file.fileName,
          error: 'Analysis failed'
        });
      }
    }

    res.json({ results });
  } catch (error) {
    console.error('Error in batch analysis:', error);
    res.status(500).json({ error: 'Failed to analyze files' });
  }
});

// Suggest folder structure based on analyzed files
router.post('/suggest-folders', async (req, res) => {
  try {
    const { analyzedFiles, existingFolders } = req.body;

    // Separate files into client-based and category-based
    const clientFiles = {};
    const categoryFiles = {};

    analyzedFiles.forEach(file => {
      // Check if file has client detected and should be organized by client
      if (file.client && shouldOrganizeByClient(file.client, file.originalName)) {
        const clientFolder = getClientFolderPath(file.client.name);
        if (!clientFiles[clientFolder]) {
          clientFiles[clientFolder] = {
            client: file.client,
            files: []
          };
        }
        clientFiles[clientFolder].files.push(file);
      } else {
        // Regular category-based organization
        const category = determineCategory(file);
        if (!categoryFiles[category]) {
          categoryFiles[category] = [];
        }
        categoryFiles[category].push(file);
      }
    });

    const suggestions = [];

    // Add client-based suggestions
    Object.entries(clientFiles).forEach(([folderPath, data]) => {
      const folderName = folderPath; // e.g., "Clients/Acme Corp"

      // Check if this client folder exists
      const exists = existingFolders.find(
        f => f.name.toLowerCase() === folderName.toLowerCase() ||
             f.name.toLowerCase() === data.client.name.toLowerCase()
      );

      suggestions.push({
        folderName: folderName,
        fileCount: data.files.length,
        exists: !!exists,
        folderId: exists?.id || null,
        isClientFolder: true,
        clientInfo: {
          name: data.client.name,
          confidence: data.client.confidence,
          sources: data.client.sources
        },
        files: data.files.map(f => ({
          fileId: f.fileId,
          originalName: f.originalName,
          suggestedName: f.suggestedName,
          client: f.client
        }))
      });
    });

    // Add category-based suggestions
    Object.entries(categoryFiles).forEach(([category, files]) => {
      const exists = existingFolders.find(
        f => f.name.toLowerCase() === category.toLowerCase()
      );

      suggestions.push({
        folderName: category,
        fileCount: files.length,
        exists: !!exists,
        folderId: exists?.id || null,
        isClientFolder: false,
        files: files.map(f => ({
          fileId: f.fileId,
          originalName: f.originalName,
          suggestedName: f.suggestedName
        }))
      });
    });

    // Sort: client folders first (by confidence), then category folders
    suggestions.sort((a, b) => {
      if (a.isClientFolder && !b.isClientFolder) return -1;
      if (!a.isClientFolder && b.isClientFolder) return 1;
      if (a.isClientFolder && b.isClientFolder) {
        return b.clientInfo.confidence - a.clientInfo.confidence;
      }
      return 0;
    });

    res.json({ suggestions });
  } catch (error) {
    console.error('Error suggesting folders:', error);
    res.status(500).json({ error: 'Failed to suggest folders' });
  }
});

function determineCategory(file) {
  const fileName = file.suggestedName || file.originalName;
  const lowerName = fileName.toLowerCase();

  // Document types
  if (/\.(pdf|doc|docx|txt|rtf)$/i.test(fileName)) {
    if (/invoice|receipt|bill/i.test(lowerName)) return 'Receipts & Invoices';
    if (/contract|agreement|legal/i.test(lowerName)) return 'Legal Documents';
    if (/report|presentation|proposal/i.test(lowerName)) return 'Work Documents';
    return 'Documents';
  }

  // Images
  if (/\.(jpg|jpeg|png|gif|bmp|svg|webp)$/i.test(fileName)) {
    if (/screenshot/i.test(lowerName)) return 'Screenshots';
    if (/photo|picture|img/i.test(lowerName)) return 'Photos';
    return 'Images';
  }

  // Videos
  if (/\.(mp4|avi|mov|wmv|flv|mkv)$/i.test(fileName)) {
    return 'Videos';
  }

  // Audio
  if (/\.(mp3|wav|flac|aac|ogg)$/i.test(fileName)) {
    return 'Audio';
  }

  // Spreadsheets
  if (/\.(xls|xlsx|csv)$/i.test(fileName)) {
    return 'Spreadsheets';
  }

  // Archives
  if (/\.(zip|rar|7z|tar|gz)$/i.test(fileName)) {
    return 'Archives';
  }

  // Code
  if (/\.(js|py|java|cpp|c|h|cs|php|rb|go|rs)$/i.test(fileName)) {
    return 'Code';
  }

  return 'Other';
}

export default router;
