import Tesseract from 'tesseract.js';
import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();

// Support custom OpenAI-compatible endpoints (e.g., vLLM, LocalAI, Ollama)
const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      baseURL: process.env.OPENAI_BASE_URL || undefined // Use custom URL if provided
    })
  : null;

export async function performOCR(base64Image) {
  try {
    const imageBuffer = Buffer.from(base64Image, 'base64');

    const result = await Tesseract.recognize(imageBuffer, 'eng', {
      logger: m => console.log(m)
    });

    return {
      text: result.data.text,
      confidence: result.data.confidence
    };
  } catch (error) {
    console.error('OCR error:', error);
    return { text: '', confidence: 0 };
  }
}

export async function analyzeFileName(fileName) {
  if (!openai) {
    // Fallback to simple analysis if no OpenAI key
    return {
      needsRenaming: isGenericName(fileName),
      suggestedName: fileName,
      confidence: 50,
      reasoning: 'OpenAI API key not configured. Using original filename.'
    };
  }

  try {
    const prompt = `Analyze this filename and suggest a better, more descriptive name if needed: "${fileName}"

Rules:
- If the filename is already clear and descriptive, return it as-is
- If it's generic (like "Untitled", "IMG_1234", "Screenshot"), suggest a better name based on any context you can infer
- Keep the file extension
- Use proper capitalization and spacing
- Be concise but descriptive
- Return ONLY the suggested filename, nothing else

Suggested filename:`;

    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 50,
      temperature: 0.3
    });

    const suggestedName = response.choices[0].message.content.trim();

    return {
      needsRenaming: suggestedName !== fileName,
      suggestedName: suggestedName || fileName,
      confidence: 80,
      reasoning: 'AI-based analysis'
    };
  } catch (error) {
    console.error('Error analyzing filename:', error);
    return {
      needsRenaming: false,
      suggestedName: fileName,
      confidence: 0,
      reasoning: 'Analysis failed'
    };
  }
}

export async function analyzeFileContent(fileName, mimeType, content) {
  if (!openai) {
    return analyzeFileName(fileName);
  }

  try {
    // Truncate content if too long
    const truncatedContent = typeof content === 'string'
      ? content.substring(0, 2000)
      : '';

    const prompt = `Analyze this file and suggest a descriptive filename.

Current filename: "${fileName}"
File type: ${mimeType}
Content preview: "${truncatedContent}"

Based on the content, suggest a clear, descriptive filename that reflects what the file contains.
Keep the original file extension.
Return ONLY the suggested filename, nothing else.

Suggested filename:`;

    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 50,
      temperature: 0.3
    });

    const suggestedName = response.choices[0].message.content.trim();

    return {
      needsRenaming: suggestedName !== fileName,
      suggestedName: suggestedName || fileName,
      confidence: 90,
      reasoning: 'Content-based AI analysis'
    };
  } catch (error) {
    console.error('Error analyzing file content:', error);
    return analyzeFileName(fileName);
  }
}

function isGenericName(fileName) {
  const genericPatterns = [
    /^(untitled|document|file|image|photo|screenshot|scan)/i,
    /^IMG_\d+/i,
    /^DSC\d+/i,
    /^Screenshot/i,
    /^\d{8}_\d{6}/i
  ];

  return genericPatterns.some(pattern => pattern.test(fileName));
}
