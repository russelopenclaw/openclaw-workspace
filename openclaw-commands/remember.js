/**
 * Remember Command Handler
 * 
 * Parses "Remember: [URL or content]" commands and saves to Brain API.
 * Auto-detects type (article/video/link/note) and extracts keywords.
 * 
 * Usage:
 *   - "Remember: https://youtube.com/watch?v=abc"
 *   - "Remember: https://article.com/post"
 *   - "Remember: This is a random note"
 */

const http = require('http');

// Mission Control API base URL
const API_BASE = process.env.MISSION_CONTROL_URL || 'http://localhost:8765';
const BRAIN_API_ENDPOINT = `${API_BASE}/api/brain/items`;

/**
 * Detect content type from URL
 * @param {string} url - URL to analyze
 * @returns {{type: string, domain: string}} Detected type and domain
 */
function detectTypeFromUrl(url) {
  try {
    const urlObj = new URL(url);
    const domain = urlObj.hostname.toLowerCase();
    
    // Video platforms
    const videoDomains = ['youtube.com', 'youtu.be', 'vimeo.com', 'twitch.tv', 'tiktok.com'];
    if (videoDomains.some(d => domain.includes(d))) {
      return { type: 'video', domain };
    }
    
    // Article platforms
    const articleDomains = ['medium.com', 'dev.to', 'hashnode.com', 'substack.com', 'ghost.io', 'wordpress.com'];
    const articleExtensions = ['.html', '.htm', '.md', '.markdown'];
    const articlePaths = ['/blog', '/article', '/post', '/news', '/story'];
    
    const hasArticleExtension = articleExtensions.some(ext => urlObj.pathname.toLowerCase().endsWith(ext));
    const hasArticlePath = articlePaths.some(path => urlObj.pathname.toLowerCase().includes(path));
    const isArticleDomain = articleDomains.some(d => domain.includes(d));
    
    if (isArticleDomain || hasArticleExtension || hasArticlePath) {
      return { type: 'article', domain };
    }
    
    // Default to link
    return { type: 'link', domain };
  } catch {
    return { type: 'note', domain: '' };
  }
}

/**
 * Check if text is a URL
 * @param {string} text - Text to check
 * @returns {boolean} True if text appears to be a URL
 */
function isUrl(text) {
  const urlPattern = /^https?:\/\/[^\s]+$/i;
  return urlPattern.test(text.trim());
}

/**
 * Extract URL from mixed text
 * @param {string} text - Text that may contain URL
 * @returns {string|null} Extracted URL or null
 */
function extractUrlFromText(text) {
  const urlPattern = /https?:\/\/[^\s]+/i;
  const match = text.match(urlPattern);
  return match ? match[0] : null;
}

/**
 * Save item to Brain API
 * @param {{title?: string, url?: string, content: string, type?: string}} item - Item to save
 * @returns {Promise<{success: boolean, item?: object, error?: string}>}
 */
async function saveToBrain(item) {
  try {
    const response = await fetch(BRAIN_API_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(item),
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      return {
        success: false,
        error: data.error || `HTTP ${response.status}`,
      };
    }
    
    return {
      success: true,
      item: data.item,
    };
  } catch (error) {
    return {
      success: false,
      error: `Failed to connect to Brain API: ${error.message}`,
    };
  }
}

/**
 * Process "Remember:" command
 * @param {string} input - User input after "Remember:" prefix
 * @returns {Promise<{success: boolean, message: string, item?: object}>}
 */
async function processRememberCommand(input) {
  const text = input.trim();
  
  if (!text) {
    return {
      success: false,
      message: '❌ Please provide content or a URL to remember.',
    };
  }
  
  let url = null;
  let content = text;
  let title = '';
  let detectedType = 'note';
  let domain = '';
  
  // Check if input is a URL
  if (isUrl(text)) {
    url = text;
    const detection = detectTypeFromUrl(url);
    detectedType = detection.type;
    domain = detection.domain;
    
    // Generate title from URL
    try {
      const urlObj = new URL(url);
      title = domain.replace('www.', '');
      const pathSegments = urlObj.pathname.split('/').filter(s => s);
      if (pathSegments.length > 0) {
        title += ' - ' + pathSegments[pathSegments.length - 1];
      }
    } catch {
      title = 'Untitled';
    }
    
    content = ''; // Pure URL, no additional content
  } else {
    // Check if text contains a URL
    const extractedUrl = extractUrlFromText(text);
    if (extractedUrl) {
      url = extractedUrl;
      const detection = detectTypeFromUrl(url);
      detectedType = detection.type;
      domain = detection.domain;
      
      // Use the rest as content/title
      const withoutUrl = text.replace(extractedUrl, '').trim();
      title = withoutUrl || domain;
      content = text;
    } else {
      // Pure text/note
      detectedType = 'note';
      title = text.slice(0, 50) + (text.length > 50 ? '...' : '');
      content = text;
    }
  }
  
  // Save to Brain
  const result = await saveToBrain({
    title,
    url: url || undefined,
    content,
    type: detectedType,
    metadata: domain ? { domain } : undefined,
  });
  
  if (!result.success) {
    return {
      success: false,
      message: `❌ Failed to save: ${result.error}`,
    };
  }
  
  const { item } = result;
  
  // Build confirmation message
  const typeEmojis = {
    video: '🎥',
    article: '📄',
    link: '🔗',
    note: '📝',
  };
  
  const typeEmoji = typeEmojis[detectedType] || '🔗';
  const typeLabel = detectedType.charAt(0).toUpperCase() + detectedType.slice(1);
  
  let message = `✅ Saved to Brain!\n\n`;
  message += `${typeEmoji} *${item.title}*\n`;
  message += `Type: ${typeLabel}\n`;
  
  if (item.keywords && item.keywords.length > 0) {
    message += `Keywords: ${item.keywords.join(', ')}\n`;
  }
  
  if (item.url) {
    message += `URL: ${item.url}`;
  }
  
  return {
    success: true,
    message,
    item,
  };
}

/**
 * Main handler for "Remember:" commands
 * @param {string} userInput - Full user input
 * @returns {Promise<{handled: boolean, response?: string}>}
 */
async function handle(userInput) {
  // Check if this is a "Remember:" command
  const rememberPattern = /^remember:\s*(.+)$/i;
  const match = userInput.match(rememberPattern);
  
  if (!match) {
    return { handled: false };
  }
  
  const content = match[1];
  const result = await processRememberCommand(content);
  
  return {
    handled: true,
    response: result.message,
    item: result.item,
  };
}

// Export for use as module
module.exports = {
  handle,
  processRememberCommand,
  detectTypeFromUrl,
  isUrl,
  saveToBrain,
};

// If run directly (for testing)
if (require.main === module) {
  const testInputs = [
    'Remember: https://youtube.com/watch?v=abc',
    'Remember: https://medium.com/some-article',
    'Remember: This is a random note',
    'Remember: Check out https://github.com/project for cool stuff',
  ];
  
  console.log('Testing Remember Command Handler\n');
  console.log('=' .repeat(50));
  
  testInputs.forEach(async (input, index) => {
    console.log(`\nTest ${index + 1}: ${input}`);
    console.log('-'.repeat(50));
    
    const result = await handle(input);
    console.log(result.response || 'Not handled');
  });
}
