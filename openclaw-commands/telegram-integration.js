// Alfred Command Integration Example
// How to integrate Remember command into your Telegram handler

const commands = require('./index.js');

/**
 * Example Telegram message handler
 * @param {string} message - User message from Telegram
 * @returns {Promise<string>} Response to send back
 */
async function handleTelegramMessage(message) {
  // Check if this is a recognized command
  const result = await commands.processMessage(message);
  
  if (result.handled) {
    console.log(`✓ Handled command: ${result.command}`);
    
    if (result.result.response) {
      return result.result.response;
    }
    
    return 'Command handled but no response generated.';
  }
  
  // Not a command - handle as regular chat
  return null; // or pass to other handlers
}

/**
 * Alternative: Direct inline handling
 * @param {string} message - User message
 * @returns {Promise<string|null>} Response or null
 */
async function handleRememberInline(message) {
  const remember = require('./remember.js');
  
  return remember.handle(message);
}

// Export for use in your Telegram bot
module.exports = {
  handleTelegramMessage,
  handleRememberInline,
};

// Quick test
if (require.main === module) {
  const testMessage = 'Remember: https://youtube.com/test';
  console.log('Testing:', testMessage);
  
  handleTelegramMessage(testMessage)
    .then(response => console.log('Response:', response))
    .catch(err => console.error('Error:', err));
}
