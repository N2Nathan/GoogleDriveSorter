# Google Drive Organizer

An intelligent Google Drive file organizer with OCR, AI-powered file naming, and smart folder suggestions. Organize thousands of unorganized files with just a few clicks.

## Features

- **Google Drive Authentication**: Secure OAuth2 integration with Google Drive
- **Intelligent File Scanning**: Automatically finds all files not organized in folders
- **OCR Integration**: Extract text from images and PDFs using Tesseract.js
- **AI-Powered Naming**: Uses OpenAI to suggest better file names for generic or unclear filenames
- **Smart Folder Suggestions**: Automatically categorizes files and suggests folder structures
- **Interactive UI**:
  - View files grouped by suggested folders
  - Select which file groups to move
  - Manual override to move files to different folders
  - Expand/collapse file groups
- **Complete Logging**: Every file move is logged to SQLite database
- **Mass Undo**: Undo entire batches of moves with one click
- **Move History**: View all past file operations

## Technology Stack

### Backend
- Node.js with Express
- Google Drive API (googleapis)
- SQLite3 for logging
- Tesseract.js for OCR
- OpenAI API for intelligent file naming
- JWT for authentication

### Frontend
- React with Vite
- Axios for API calls
- Lucide React for icons
- Modern CSS with gradients

## Prerequisites

- Node.js 18+ and npm
- Google Cloud Project with Drive API enabled
- OpenAI API key (optional, but recommended for better file naming)

## Setup Instructions

### 1. Clone the Repository

```bash
git clone <repository-url>
cd GoogleDriveSorter
```

### 2. Set Up Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the Google Drive API:
   - Navigate to "APIs & Services" > "Library"
   - Search for "Google Drive API"
   - Click "Enable"
4. Create OAuth 2.0 credentials:
   - Go to "APIs & Services" > "Credentials"
   - Click "Create Credentials" > "OAuth client ID"
   - Choose "Web application"
   - Add authorized redirect URIs:
     - `http://localhost:3001/auth/google/callback`
   - Save the Client ID and Client Secret

### 3. Configure Environment Variables

```bash
cd backend
cp .env.example .env
```

Edit `backend/.env` and fill in your credentials:

```env
PORT=3001
GOOGLE_CLIENT_ID=your_google_client_id_here
GOOGLE_CLIENT_SECRET=your_google_client_secret_here
GOOGLE_REDIRECT_URI=http://localhost:3001/auth/google/callback
OPENAI_API_KEY=your_openai_api_key_here  # Optional but recommended
SESSION_SECRET=your_random_session_secret_here
```

### 4. Install Dependencies

```bash
# From the root directory
npm run install:all
```

This will install dependencies for the root project, backend, and frontend.

### 5. Create Data Directory

```bash
mkdir backend/data
```

### 6. Start the Application

#### Development Mode (Recommended)

From the root directory, run both backend and frontend simultaneously:

```bash
npm run dev
```

This starts:
- Backend API on `http://localhost:3001`
- Frontend UI on `http://localhost:5173`

#### Production Mode

Start backend and frontend separately:

```bash
# Terminal 1 - Backend
cd backend
npm start

# Terminal 2 - Frontend
cd frontend
npm run build
npm run preview
```

## Usage Guide

### 1. Authentication

1. Open `http://localhost:5173` in your browser
2. Click "Connect Google Drive"
3. Authorize the application to access your Google Drive
4. You'll be redirected back to the app

### 2. Scan and Analyze Files

1. Click "Scan & Analyze Files" button
2. The app will:
   - Fetch all root-level (unorganized) files from your Drive
   - Analyze each file name
   - Suggest better names for generic files (IMG_1234.jpg, etc.)
   - Group files by category (Documents, Images, Screenshots, etc.)
   - Check if suggested folders already exist

### 3. Review and Organize

1. Review the suggested folder groups
2. Expand groups to see individual files
3. For each file, you can:
   - See the suggested new name (if applicable)
   - Override the destination folder using the dropdown
4. Select which folder groups to process by checking the boxes
5. Use "Select All" or "Deselect All" for bulk selection

### 4. Execute Moves

1. Click "Move Selected" button
2. The app will:
   - Create new folders if they don't exist
   - Move files to their designated folders
   - Rename files if better names were suggested
   - Log all operations to the database

### 5. Undo Operations

1. View the "Move History" section at the bottom
2. Each batch of moves shows:
   - Batch ID
   - Number of files moved
   - Timestamp
3. Click "Undo" to reverse an entire batch of moves
4. Files will be moved back to their original locations

## File Categorization

The app automatically categorizes files into these folders:

- **Documents**: PDF, DOC, DOCX, TXT, RTF
- **Receipts & Invoices**: Files containing keywords like "invoice", "receipt", "bill"
- **Legal Documents**: Files containing "contract", "agreement", "legal"
- **Work Documents**: Files containing "report", "presentation", "proposal"
- **Images**: JPG, JPEG, PNG, GIF, BMP, SVG, WEBP
- **Screenshots**: Images with "screenshot" in the name
- **Photos**: Images with "photo", "picture", "img" in the name
- **Videos**: MP4, AVI, MOV, WMV, FLV, MKV
- **Audio**: MP3, WAV, FLAC, AAC, OGG
- **Spreadsheets**: XLS, XLSX, CSV
- **Archives**: ZIP, RAR, 7Z, TAR, GZ
- **Code**: JS, PY, JAVA, CPP, C, H, CS, PHP, RB, GO, RS
- **Other**: Everything else

## API Endpoints

### Authentication
- `GET /auth/url` - Get Google OAuth URL
- `GET /auth/google/callback` - OAuth callback handler
- `GET /auth/status` - Check authentication status

### Drive Operations
- `GET /api/drive/unorganized-files` - Get all root-level files
- `GET /api/drive/folders` - Get all folders
- `GET /api/drive/folder-structure` - Get nested folder structure
- `GET /api/drive/file/:fileId/content` - Download file content

### Analysis
- `POST /api/analysis/file` - Analyze single file
- `POST /api/analysis/batch` - Batch analyze multiple files
- `POST /api/analysis/suggest-folders` - Suggest folder structure

### Move Operations
- `POST /api/move/execute` - Execute file moves
- `POST /api/move/create-folder` - Create new folder
- `POST /api/move/rename` - Rename file
- `GET /api/move/history` - Get move history
- `POST /api/move/undo` - Undo batch of moves

## Database Schema

### file_moves
Logs every file move operation:
- `id`: Auto-increment primary key
- `file_id`: Google Drive file ID
- `file_name`: Name of the file
- `original_parent_id`: Original folder ID
- `new_parent_id`: New folder ID
- `original_parent_name`: Original folder name
- `new_parent_name`: New folder name
- `moved_at`: Timestamp
- `undone`: Boolean flag
- `batch_id`: UUID for batch operations

### auth_tokens
Stores Google OAuth tokens:
- `id`: Auto-increment primary key
- `user_id`: User identifier
- `access_token`: Google access token
- `refresh_token`: Google refresh token
- `token_type`: Token type
- `expiry_date`: Token expiration
- `updated_at`: Last update timestamp

### file_analysis_cache
Caches file analysis results:
- `id`: Auto-increment primary key
- `file_id`: Google Drive file ID
- `original_name`: Original file name
- `suggested_name`: AI-suggested name
- `analysis_data`: JSON analysis results
- `analyzed_at`: Analysis timestamp

## Performance Considerations

- **Batch Operations**: Files are analyzed in batches to improve performance
- **Caching**: File analysis results are cached to avoid re-analyzing
- **Rate Limiting**: Google Drive API has rate limits; the app handles them gracefully
- **File Size Limit**: Files larger than 10MB are not downloaded for content analysis

## Troubleshooting

### Authentication Issues
- Make sure your Google Cloud OAuth credentials are correct
- Verify the redirect URI matches exactly: `http://localhost:3001/auth/google/callback`
- Check that the Google Drive API is enabled in your project

### Database Errors
- Ensure the `backend/data` directory exists and is writable
- Check SQLite3 is properly installed

### OCR Not Working
- Tesseract.js downloads language data on first use
- Ensure you have a stable internet connection
- Check browser console for errors

### API Rate Limits
- Google Drive API has quotas; reduce batch sizes if hitting limits
- Consider implementing exponential backoff for production use

## Security Notes

- Never commit your `.env` file with real credentials
- Tokens are stored locally in SQLite database
- Consider implementing proper user authentication for multi-user scenarios
- Review Google Drive API permissions carefully

## Future Enhancements

- Support for more file types and analysis methods
- Custom folder naming rules
- Scheduled automatic organization
- Support for shared drives
- Duplicate file detection
- Bulk rename operations
- Export/import of organization rules
- Web-based deployment option

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Support

For issues and questions, please open an issue on GitHub.
