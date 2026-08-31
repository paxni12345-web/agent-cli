/**
 * Web Tools System - Full CLI Features in Browser
 * Includes: File ops, Git, Search, Memory
 */

const fs = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

// Memory system
const conversationMemory = new Map();
const fileCache = new Map();

// ========================================================================
// MEMORY SYSTEM
// ========================================================================

/**
 * Store conversation context
 */
function storeMemory(sessionId, key, value) {
  if (!conversationMemory.has(sessionId)) {
    conversationMemory.set(sessionId, new Map());
  }
  conversationMemory.get(sessionId).set(key, {
    value,
    timestamp: Date.now(),
  });
}

/**
 * Retrieve memory
 */
function getMemory(sessionId, key) {
  const session = conversationMemory.get(sessionId);
  if (!session) return null;
  const memory = session.get(key);
  return memory ? memory.value : null;
}

/**
 * Get all memories for session
 */
function getAllMemories(sessionId) {
  const session = conversationMemory.get(sessionId);
  if (!session) return {};

  const memories = {};
  for (const [key, data] of session.entries()) {
    memories[key] = data.value;
  }
  return memories;
}

/**
 * Clear old memories (older than 1 hour)
 */
function clearOldMemories() {
  const now = Date.now();
  const ONE_HOUR = 60 * 60 * 1000;

  for (const [sessionId, session] of conversationMemory.entries()) {
    for (const [key, data] of session.entries()) {
      if (now - data.timestamp > ONE_HOUR) {
        session.delete(key);
      }
    }
    if (session.size === 0) {
      conversationMemory.delete(sessionId);
    }
  }
}

// Clear old memories every 10 minutes
setInterval(clearOldMemories, 10 * 60 * 1000);

// ========================================================================
// FILE TOOLS
// ========================================================================

/**
 * List files in directory
 */
async function listFiles(req, res) {
  try {
    const { path: dirPath = '.', pattern = '*' } = req.body;

    const fullPath = path.resolve(dirPath);
    const entries = await fs.readdir(fullPath, { withFileTypes: true });

    const files = entries.map(entry => ({
      name: entry.name,
      path: path.join(fullPath, entry.name),
      type: entry.isDirectory() ? 'directory' : 'file',
      isDirectory: entry.isDirectory(),
    }));

    res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    res.end(JSON.stringify({ success: true, files }));
  } catch (error) {
    res.writeHead(500, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    res.end(JSON.stringify({ success: false, error: error.message }));
  }
}

/**
 * Read file content
 */
router.post('/files/read', async (req, res) => {
  try {
    const { path: filePath } = req.body;

    if (!filePath) {
      return res.status(400).json({ success: false, error: 'Path required' });
    }

    const fullPath = path.resolve(filePath);
    const content = await fs.readFile(fullPath, 'utf-8');

    // Cache the file
    fileCache.set(fullPath, { content, timestamp: Date.now() });

    res.json({ success: true, content, path: fullPath });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Write file content
 */
router.post('/files/write', async (req, res) => {
  try {
    const { path: filePath, content } = req.body;

    if (!filePath || content === undefined) {
      return res.status(400).json({ success: false, error: 'Path and content required' });
    }

    const fullPath = path.resolve(filePath);

    // Create directory if needed
    const dir = path.dirname(fullPath);
    await fs.mkdir(dir, { recursive: true });

    await fs.writeFile(fullPath, content, 'utf-8');

    // Update cache
    fileCache.set(fullPath, { content, timestamp: Date.now() });

    res.json({ success: true, path: fullPath });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Edit file content
 */
router.post('/files/edit', async (req, res) => {
  try {
    const { path: filePath, search, replace } = req.body;

    if (!filePath || !search) {
      return res.status(400).json({ success: false, error: 'Path and search required' });
    }

    const fullPath = path.resolve(filePath);
    let content = await fs.readFile(fullPath, 'utf-8');

    // Perform replacement
    const newContent = content.replace(new RegExp(search, 'g'), replace || '');

    await fs.writeFile(fullPath, newContent, 'utf-8');

    // Update cache
    fileCache.set(fullPath, { content: newContent, timestamp: Date.now() });

    res.json({ success: true, path: fullPath, changes: content !== newContent });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Delete file
 */
router.post('/files/delete', async (req, res) => {
  try {
    const { path: filePath } = req.body;

    if (!filePath) {
      return res.status(400).json({ success: false, error: 'Path required' });
    }

    const fullPath = path.resolve(filePath);
    await fs.unlink(fullPath);

    // Remove from cache
    fileCache.delete(fullPath);

    res.json({ success: true, path: fullPath });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ========================================================================
// GIT TOOLS
// ========================================================================

/**
 * Git status
 */
router.post('/git/status', async (req, res) => {
  try {
    const { path: repoPath = '.' } = req.body;
    const cwd = path.resolve(repoPath);

    const { stdout } = await execAsync('git status --porcelain', { cwd });

    res.json({ success: true, output: stdout });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Git diff
 */
router.post('/git/diff', async (req, res) => {
  try {
    const { path: repoPath = '.', file = '' } = req.body;
    const cwd = path.resolve(repoPath);

    const command = file ? `git diff ${file}` : 'git diff';
    const { stdout } = await execAsync(command, { cwd });

    res.json({ success: true, output: stdout });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Git log
 */
router.post('/git/log', async (req, res) => {
  try {
    const { path: repoPath = '.', limit = 10 } = req.body;
    const cwd = path.resolve(repoPath);

    const { stdout } = await execAsync(`git log --oneline -n ${limit}`, { cwd });

    res.json({ success: true, output: stdout });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Git commit
 */
router.post('/git/commit', async (req, res) => {
  try {
    const { path: repoPath = '.', message } = req.body;

    if (!message) {
      return res.status(400).json({ success: false, error: 'Commit message required' });
    }

    const cwd = path.resolve(repoPath);

    // Add all changes
    await execAsync('git add .', { cwd });

    // Commit
    const { stdout } = await execAsync(`git commit -m "${message}"`, { cwd });

    res.json({ success: true, output: stdout });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ========================================================================
// SEARCH TOOLS
// ========================================================================

/**
 * Search code
 */
router.post('/search/code', async (req, res) => {
  try {
    const { query, path: searchPath = '.', filePattern = '*' } = req.body;

    if (!query) {
      return res.status(400).json({ success: false, error: 'Query required' });
    }

    const cwd = path.resolve(searchPath);
    const command = `grep -r "${query}" . --include="${filePattern}"`;

    try {
      const { stdout } = await execAsync(command, { cwd });

      const results = stdout.split('\n')
        .filter(line => line.trim())
        .map(line => {
          const [file, ...rest] = line.split(':');
          return { file, line: rest.join(':') };
        });

      res.json({ success: true, results });
    } catch (error) {
      // grep returns non-zero if no matches
      res.json({ success: true, results: [] });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ========================================================================
// MEMORY TOOLS
// ========================================================================

/**
 * Store memory
 */
router.post('/memory/store', async (req, res) => {
  try {
    const { sessionId, key, value } = req.body;

    if (!sessionId || !key) {
      return res.status(400).json({ success: false, error: 'SessionId and key required' });
    }

    storeMemory(sessionId, key, value);

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Retrieve memory
 */
router.post('/memory/get', async (req, res) => {
  try {
    const { sessionId, key } = req.body;

    if (!sessionId) {
      return res.status(400).json({ success: false, error: 'SessionId required' });
    }

    const value = key ? getMemory(sessionId, key) : getAllMemories(sessionId);

    res.json({ success: true, value });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Clear memory
 */
router.post('/memory/clear', async (req, res) => {
  try {
    const { sessionId } = req.body;

    if (!sessionId) {
      return res.status(400).json({ success: false, error: 'SessionId required' });
    }

    conversationMemory.delete(sessionId);

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ========================================================================
// SHELL TOOLS (Limited for security)
// ========================================================================

/**
 * Safe shell commands (whitelist only)
 */
const SAFE_COMMANDS = [
  'ls', 'pwd', 'echo', 'cat', 'grep', 'find',
  'git', 'npm', 'node', 'python', 'pip',
];

router.post('/shell/execute', async (req, res) => {
  try {
    const { command, cwd = '.' } = req.body;

    if (!command) {
      return res.status(400).json({ success: false, error: 'Command required' });
    }

    // Check if command is safe
    const baseCommand = command.split(' ')[0];
    if (!SAFE_COMMANDS.includes(baseCommand)) {
      return res.status(403).json({
        success: false,
        error: `Command '${baseCommand}' not allowed. Allowed: ${SAFE_COMMANDS.join(', ')}`
      });
    }

    const workDir = path.resolve(cwd);
    const { stdout, stderr } = await execAsync(command, { cwd: workDir, timeout: 30000 });

    res.json({ success: true, stdout, stderr });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message, stderr: error.stderr });
  }
});

module.exports = {
  conversationMemory,
  fileCache,
  storeMemory,
  getMemory,
  getAllMemories,
  clearOldMemories,
  listFiles,
  // Add more exports as needed
};
