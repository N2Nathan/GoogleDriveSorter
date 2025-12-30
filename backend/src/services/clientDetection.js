import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

// Common patterns that indicate client-related content
const CLIENT_PATTERNS = {
  // Explicit client mentions
  clientMention: [
    /client[:\s]+([A-Z][A-Za-z0-9\s&.-]+)/gi,
    /for[:\s]+([A-Z][A-Za-z0-9\s&.-]+)(?:\s+(?:Inc|LLC|Ltd|Corp|Corporation|Company))/gi,
    /(?:project|account)[:\s]+([A-Z][A-Za-z0-9\s&.-]+)/gi,
  ],

  // Company suffixes
  companySuffix: [
    /([A-Z][A-Za-z0-9\s&.-]+)\s+(?:Inc\.?|LLC|Ltd\.?|Corp\.?|Corporation|Company|Co\.?|LLP|LP)/gi,
  ],

  // Invoice/contract patterns
  invoicePattern: [
    /(?:invoice|bill)\s+(?:to|for)[:\s]+([A-Z][A-Za-z0-9\s&.-]+)/gi,
    /(?:contract|agreement)\s+(?:with|for)[:\s]+([A-Z][A-Za-z0-9\s&.-]+)/gi,
  ],

  // Attention/To patterns
  attentionPattern: [
    /(?:ATTN|Attention|To)[:\s]+([A-Z][A-Za-z0-9\s&.-]+)/gi,
  ],

  // Project codes
  projectCode: [
    /(?:project|job)\s+(?:code|number|#)[:\s]+([A-Z0-9-]+)/gi,
  ]
};

/**
 * Extract potential client names from text content
 */
export function extractClientNames(text) {
  const clients = new Map(); // Map to store client name -> confidence score

  if (!text || text.length < 10) {
    return [];
  }

  // Apply all pattern categories
  Object.entries(CLIENT_PATTERNS).forEach(([category, patterns]) => {
    patterns.forEach(pattern => {
      const matches = [...text.matchAll(pattern)];
      matches.forEach(match => {
        if (match[1]) {
          let clientName = match[1].trim();

          // Clean up the client name
          clientName = cleanClientName(clientName);

          if (isValidClientName(clientName)) {
            const currentScore = clients.get(clientName) || 0;
            const boost = getBoostForCategory(category);
            clients.set(clientName, currentScore + boost);
          }
        }
      });
    });
  });

  // Convert to array and sort by confidence
  const results = Array.from(clients.entries())
    .map(([name, score]) => ({
      name,
      confidence: Math.min(score, 100)
    }))
    .sort((a, b) => b.confidence - a.confidence);

  return results;
}

/**
 * Clean and normalize client name
 */
function cleanClientName(name) {
  return name
    .replace(/[:\n\r\t]/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^(the|a|an)\s+/i, '')
    .trim()
    .substring(0, 100); // Limit length
}

/**
 * Validate if the extracted text is a valid client name
 */
function isValidClientName(name) {
  // Must be at least 2 characters
  if (name.length < 2) return false;

  // Must contain at least one letter
  if (!/[A-Za-z]/.test(name)) return false;

  // Shouldn't be too long
  if (name.length > 100) return false;

  // Shouldn't be common words
  const commonWords = ['date', 'page', 'total', 'amount', 'subject', 'regarding', 'reference'];
  if (commonWords.includes(name.toLowerCase())) return false;

  // Shouldn't be just numbers
  if (/^\d+$/.test(name)) return false;

  return true;
}

/**
 * Get confidence boost based on pattern category
 */
function getBoostForCategory(category) {
  const boosts = {
    clientMention: 40,
    companySuffix: 35,
    invoicePattern: 45,
    attentionPattern: 30,
    projectCode: 25
  };
  return boosts[category] || 20;
}

/**
 * Use AI to detect client name from document content
 */
export async function detectClientWithAI(fileName, content, mimeType) {
  if (!openai) {
    return null;
  }

  try {
    // Truncate content to avoid token limits
    const truncatedContent = typeof content === 'string'
      ? content.substring(0, 3000)
      : '';

    const prompt = `Analyze this document and identify the client or company name it's related to.

Filename: "${fileName}"
File type: ${mimeType}
Content preview:
"""
${truncatedContent}
"""

Instructions:
- Look for client names, company names, or project names
- Common indicators: "Client:", "For:", "Invoice to:", "Project:", "Account:", company suffixes (Inc, LLC, Corp, etc.)
- Return ONLY the client/company name, nothing else
- If multiple clients are mentioned, return the primary one
- If no clear client can be identified, return "UNKNOWN"
- Keep it concise (max 50 characters)

Client name:`;

    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 50,
      temperature: 0.3
    });

    const clientName = response.choices[0].message.content.trim();

    if (clientName === 'UNKNOWN' || clientName.length < 2) {
      return null;
    }

    return {
      name: cleanClientName(clientName),
      confidence: 90,
      source: 'ai'
    };
  } catch (error) {
    console.error('Error detecting client with AI:', error);
    return null;
  }
}

/**
 * Analyze file for client information
 */
export async function analyzeFileForClient(fileData) {
  const { fileId, fileName, mimeType, content, ocrText } = fileData;

  const detectedClients = [];

  // 1. Extract from filename
  const filenameClients = extractClientNames(fileName);
  detectedClients.push(...filenameClients.map(c => ({ ...c, source: 'filename' })));

  // 2. Extract from OCR text if available
  if (ocrText) {
    const ocrClients = extractClientNames(ocrText);
    detectedClients.push(...ocrClients.map(c => ({ ...c, source: 'ocr' })));
  }

  // 3. Extract from document content if available
  if (content && typeof content === 'string') {
    // Decode base64 if needed
    let textContent = content;
    try {
      textContent = Buffer.from(content, 'base64').toString('utf-8');
    } catch (e) {
      // Already text
    }

    const contentClients = extractClientNames(textContent);
    detectedClients.push(...contentClients.map(c => ({ ...c, source: 'content' })));

    // 4. Use AI for deeper analysis if we have content
    if (openai && (mimeType?.includes('pdf') || mimeType?.includes('document') || mimeType?.includes('text'))) {
      const aiClient = await detectClientWithAI(fileName, textContent, mimeType);
      if (aiClient) {
        detectedClients.push(aiClient);
      }
    }
  }

  // Merge and deduplicate clients
  const clientMap = new Map();
  detectedClients.forEach(client => {
    const existing = clientMap.get(client.name.toLowerCase());
    if (existing) {
      // Increase confidence if found in multiple sources
      existing.confidence = Math.min(existing.confidence + 15, 100);
      if (!existing.sources.includes(client.source)) {
        existing.sources.push(client.source);
      }
    } else {
      clientMap.set(client.name.toLowerCase(), {
        name: client.name,
        confidence: client.confidence,
        sources: [client.source]
      });
    }
  });

  // Convert to array and sort by confidence
  const results = Array.from(clientMap.values())
    .sort((a, b) => b.confidence - a.confidence);

  return results.length > 0 ? results[0] : null; // Return top result
}

/**
 * Determine if a file should be organized under a client folder
 */
export function shouldOrganizeByClient(client, fileType) {
  if (!client) return false;

  // Require minimum confidence
  if (client.confidence < 30) return false;

  // Certain file types are more likely to be client-related
  const clientRelevantTypes = [
    'pdf', 'doc', 'docx', 'xls', 'xlsx',
    'ppt', 'pptx', 'txt', 'rtf'
  ];

  const fileExtension = fileType.split('.').pop().toLowerCase();

  // Boost confidence for relevant file types
  if (clientRelevantTypes.includes(fileExtension)) {
    return client.confidence >= 30;
  }

  // Higher threshold for other file types
  return client.confidence >= 50;
}

/**
 * Generate client folder path
 */
export function getClientFolderPath(clientName) {
  // Sanitize folder name
  const sanitized = clientName
    .replace(/[<>:"/\\|?*]/g, '') // Remove invalid chars
    .replace(/\s+/g, ' ')
    .trim();

  return `Clients/${sanitized}`;
}
