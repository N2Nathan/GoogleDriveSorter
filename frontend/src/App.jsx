import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Folder,
  File,
  FolderPlus,
  CheckSquare,
  Square,
  ChevronDown,
  ChevronRight,
  RotateCcw,
  Upload,
  AlertCircle,
  CheckCircle,
  Briefcase,
  Award
} from 'lucide-react';

const API_URL = 'http://localhost:3001';

function App() {
  const [authenticated, setAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [files, setFiles] = useState([]);
  const [folders, setFolders] = useState([]);
  const [folderGroups, setFolderGroups] = useState([]);
  const [selectedGroups, setSelectedGroups] = useState(new Set());
  const [expandedGroups, setExpandedGroups] = useState(new Set());
  const [moveHistory, setMoveHistory] = useState([]);
  const [alert, setAlert] = useState(null);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    checkAuthStatus();
    const params = new URLSearchParams(window.location.search);
    if (params.get('auth') === 'success') {
      setAlert({ type: 'success', message: 'Successfully authenticated with Google Drive!' });
      window.history.replaceState({}, '', '/');
      checkAuthStatus();
    }
  }, []);

  const checkAuthStatus = async () => {
    try {
      const response = await axios.get(`${API_URL}/auth/status`);
      setAuthenticated(response.data.authenticated);
    } catch (error) {
      console.error('Error checking auth status:', error);
      setAuthenticated(false);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    try {
      const response = await axios.get(`${API_URL}/auth/url`);
      window.location.href = response.data.url;
    } catch (error) {
      console.error('Error getting auth URL:', error);
      setAlert({ type: 'error', message: 'Failed to initiate authentication' });
    }
  };

  const scanAndAnalyze = async () => {
    setScanning(true);
    setAlert(null);

    try {
      // Fetch unorganized files
      const filesResponse = await axios.get(`${API_URL}/api/drive/unorganized-files`);
      const fetchedFiles = filesResponse.data.files;
      setFiles(fetchedFiles);

      if (fetchedFiles.length === 0) {
        setAlert({ type: 'info', message: 'No unorganized files found in your Drive!' });
        setScanning(false);
        return;
      }

      // Fetch existing folders
      const foldersResponse = await axios.get(`${API_URL}/api/drive/folders`);
      const fetchedFolders = foldersResponse.data.folders;
      setFolders(fetchedFolders);

      // Analyze files in batch
      const analysisResponse = await axios.post(`${API_URL}/api/analysis/batch`, {
        files: fetchedFiles.map(f => ({ fileId: f.id, fileName: f.name }))
      });

      const analyzedFiles = analysisResponse.data.results;

      // Get folder suggestions
      const suggestionsResponse = await axios.post(`${API_URL}/api/analysis/suggest-folders`, {
        analyzedFiles,
        existingFolders: fetchedFolders
      });

      const groups = suggestionsResponse.data.suggestions.map(group => ({
        ...group,
        files: group.files.map(f => {
          const original = fetchedFiles.find(file => file.id === f.fileId);
          return { ...f, ...original };
        })
      }));

      setFolderGroups(groups);
      setAlert({
        type: 'success',
        message: `Found ${fetchedFiles.length} files and created ${groups.length} folder groups!`
      });
    } catch (error) {
      console.error('Error scanning files:', error);
      setAlert({ type: 'error', message: 'Failed to scan and analyze files' });
    } finally {
      setScanning(false);
    }
  };

  const toggleGroupSelection = (folderName) => {
    const newSelected = new Set(selectedGroups);
    if (newSelected.has(folderName)) {
      newSelected.delete(folderName);
    } else {
      newSelected.add(folderName);
    }
    setSelectedGroups(newSelected);
  };

  const toggleGroupExpansion = (folderName) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(folderName)) {
      newExpanded.delete(folderName);
    } else {
      newExpanded.add(folderName);
    }
    setExpandedGroups(newExpanded);
  };

  const selectAll = () => {
    setSelectedGroups(new Set(folderGroups.map(g => g.folderName)));
  };

  const deselectAll = () => {
    setSelectedGroups(new Set());
  };

  const handleOverrideFolder = (fileId, groupName, newFolderId) => {
    setFolderGroups(prevGroups =>
      prevGroups.map(group =>
        group.folderName === groupName
          ? {
              ...group,
              files: group.files.map(file =>
                file.fileId === fileId
                  ? { ...file, overrideFolderId: newFolderId }
                  : file
              )
            }
          : group
      )
    );
  };

  const executeMoves = async () => {
    setProcessing(true);
    setAlert(null);

    try {
      const moves = [];

      for (const group of folderGroups) {
        if (!selectedGroups.has(group.folderName)) continue;

        let targetFolderId = group.folderId;

        // Create folder if it doesn't exist
        if (!group.exists) {
          const createResponse = await axios.post(`${API_URL}/api/move/create-folder`, {
            folderName: group.folderName,
            existingFolders: folders
          });
          targetFolderId = createResponse.data.folder.id;
        }

        for (const file of group.files) {
          moves.push({
            fileId: file.fileId,
            fileName: file.suggestedName || file.originalName,
            targetFolderId: file.overrideFolderId || targetFolderId,
            targetFolderName: file.overrideFolderId
              ? folders.find(f => f.id === file.overrideFolderId)?.name || group.folderName
              : group.folderName,
            createIfNeeded: !group.exists && group.isClientFolder
          });
        }
      }

      const response = await axios.post(`${API_URL}/api/move/execute`, {
        moves,
        existingFolders: folders
      });

      const successCount = response.data.results.filter(r => r.success).length;
      setAlert({
        type: 'success',
        message: `Successfully moved ${successCount} files!`
      });

      // Refresh history
      loadMoveHistory();

      // Clear selections and rescan
      setSelectedGroups(new Set());
      setTimeout(() => scanAndAnalyze(), 1000);
    } catch (error) {
      console.error('Error executing moves:', error);
      setAlert({ type: 'error', message: 'Failed to move files' });
    } finally {
      setProcessing(false);
    }
  };

  const loadMoveHistory = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/move/history?limit=20`);
      setMoveHistory(response.data.logs);
    } catch (error) {
      console.error('Error loading history:', error);
    }
  };

  const undoBatch = async (batchId) => {
    try {
      await axios.post(`${API_URL}/api/move/undo`, { batchId });
      setAlert({ type: 'success', message: 'Successfully undone batch move!' });
      loadMoveHistory();
      scanAndAnalyze();
    } catch (error) {
      console.error('Error undoing batch:', error);
      setAlert({ type: 'error', message: 'Failed to undo moves' });
    }
  };

  useEffect(() => {
    if (authenticated) {
      loadMoveHistory();
    }
  }, [authenticated]);

  if (loading) {
    return (
      <div className="app">
        <div className="loading">
          <div className="spinner"></div>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  if (!authenticated) {
    return (
      <div className="app">
        <div className="container">
          <div className="header">
            <h1>Google Drive Organizer</h1>
            <p>Intelligent file organization with OCR and AI-powered naming</p>
          </div>

          <div className="auth-section">
            <p style={{ marginBottom: '2rem', fontSize: '1.1rem', color: '#666' }}>
              Connect your Google Drive account to get started
            </p>
            <button className="btn btn-primary" onClick={handleLogin}>
              <Upload style={{ display: 'inline', marginRight: '0.5rem', verticalAlign: 'middle' }} size={20} />
              Connect Google Drive
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <div className="container">
        <div className="header">
          <h1>Google Drive Organizer</h1>
          <p>Your intelligent file organization assistant</p>
        </div>

        {alert && (
          <div className={`alert alert-${alert.type}`}>
            {alert.type === 'success' && <CheckCircle size={20} style={{ display: 'inline', marginRight: '0.5rem', verticalAlign: 'middle' }} />}
            {alert.type === 'error' && <AlertCircle size={20} style={{ display: 'inline', marginRight: '0.5rem', verticalAlign: 'middle' }} />}
            {alert.type === 'info' && <AlertCircle size={20} style={{ display: 'inline', marginRight: '0.5rem', verticalAlign: 'middle' }} />}
            {alert.message}
          </div>
        )}

        {files.length > 0 && (
          <div className="stats">
            <div className="stat-card">
              <h3>{files.length}</h3>
              <p>Unorganized Files</p>
            </div>
            <div className="stat-card">
              <h3>{folderGroups.length}</h3>
              <p>Suggested Folders</p>
            </div>
            <div className="stat-card">
              <h3>{selectedGroups.size}</h3>
              <p>Selected Groups</p>
            </div>
          </div>
        )}

        <div className="actions">
          <button
            className="btn btn-primary"
            onClick={scanAndAnalyze}
            disabled={scanning}
          >
            {scanning ? 'Scanning...' : 'Scan & Analyze Files'}
          </button>

          {folderGroups.length > 0 && (
            <>
              <button className="btn btn-secondary" onClick={selectAll}>
                Select All
              </button>
              <button className="btn btn-secondary" onClick={deselectAll}>
                Deselect All
              </button>
              <button
                className="btn btn-success"
                onClick={executeMoves}
                disabled={selectedGroups.size === 0 || processing}
              >
                {processing ? 'Moving Files...' : `Move Selected (${selectedGroups.size})`}
              </button>
            </>
          )}
        </div>

        {folderGroups.length > 0 && (
          <div className="folder-groups">
            {folderGroups.map(group => (
              <div
                key={group.folderName}
                className={`folder-group ${selectedGroups.has(group.folderName) ? 'selected' : ''} ${group.isClientFolder ? 'client-folder' : ''}`}
              >
                <div className="folder-header" onClick={() => toggleGroupExpansion(group.folderName)}>
                  <div className="folder-info">
                    {expandedGroups.has(group.folderName) ? (
                      <ChevronDown className="folder-icon" />
                    ) : (
                      <ChevronRight className="folder-icon" />
                    )}
                    {group.isClientFolder ? (
                      <Briefcase className="folder-icon" style={{ color: '#764ba2' }} />
                    ) : (
                      <Folder className="folder-icon" />
                    )}
                    <span className="folder-name">
                      {group.folderName}
                      {!group.exists && (
                        <span style={{ marginLeft: '0.5rem', fontSize: '0.85rem', color: '#48bb78' }}>
                          (New)
                        </span>
                      )}
                      {group.isClientFolder && group.clientInfo && (
                        <span style={{
                          marginLeft: '0.5rem',
                          fontSize: '0.75rem',
                          color: '#764ba2',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.25rem'
                        }}>
                          <Award size={14} />
                          {group.clientInfo.confidence}% confident
                        </span>
                      )}
                    </span>
                    <span className="file-count">{group.fileCount} files</span>
                  </div>

                  <div className="folder-actions" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      className="checkbox"
                      checked={selectedGroups.has(group.folderName)}
                      onChange={() => toggleGroupSelection(group.folderName)}
                    />
                  </div>
                </div>

                {expandedGroups.has(group.folderName) && (
                  <div className="file-list">
                    {group.files.map(file => (
                      <div key={file.fileId} className="file-item">
                        <div className="file-info">
                          <div className="file-name">
                            {file.suggestedName !== file.originalName && file.suggestedName ? (
                              <>
                                <span className="file-suggestion">{file.suggestedName}</span>
                                <br />
                                <span className="file-original">{file.originalName}</span>
                              </>
                            ) : (
                              <span>{file.originalName}</span>
                            )}
                          </div>
                        </div>

                        <select
                          className="override-select"
                          value={file.overrideFolderId || ''}
                          onChange={(e) =>
                            handleOverrideFolder(file.fileId, group.folderName, e.target.value)
                          }
                        >
                          <option value="">Move to: {group.folderName}</option>
                          <optgroup label="Existing Folders">
                            {folders.map(folder => (
                              <option key={folder.id} value={folder.id}>
                                {folder.name}
                              </option>
                            ))}
                          </optgroup>
                        </select>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {folderGroups.length === 0 && !scanning && (
          <div className="empty-state">
            <Folder className="empty-state-icon" />
            <h3>No files to organize</h3>
            <p>Click "Scan & Analyze Files" to get started</p>
          </div>
        )}

        {moveHistory.length > 0 && (
          <div className="history-section">
            <div className="history-header">
              <h2>Move History</h2>
            </div>

            <div className="history-list">
              {(() => {
                const batches = {};
                moveHistory.forEach(log => {
                  if (!batches[log.batch_id]) {
                    batches[log.batch_id] = [];
                  }
                  batches[log.batch_id].push(log);
                });

                return Object.entries(batches).map(([batchId, logs]) => (
                  <div key={batchId} className="history-item">
                    <div className="history-info">
                      <div className="history-batch">
                        Batch: {batchId.substring(0, 8)}... ({logs.length} files)
                      </div>
                      <div className="history-details">
                        {new Date(logs[0].moved_at).toLocaleString()}
                      </div>
                    </div>
                    <button
                      className="btn btn-danger"
                      onClick={() => undoBatch(batchId)}
                      style={{ fontSize: '0.9rem', padding: '0.5rem 1rem' }}
                    >
                      <RotateCcw size={16} style={{ display: 'inline', marginRight: '0.25rem', verticalAlign: 'middle' }} />
                      Undo
                    </button>
                  </div>
                ));
              })()}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
