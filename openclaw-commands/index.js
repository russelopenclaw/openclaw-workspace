/**
 * Alfred Command Index
 * Maps command patterns to handlers for Telegram integration
 */

module.exports = {
  commands: {
    'remember': {
      pattern: /^remember:\s*(.+)$/i,
      handler: './remember.js',
      method: 'handle',
      description: 'Save content to Brain (personal knowledge base)',
      examples: [
        'Remember: https://youtube.com/watch?v=abc',
        'Remember: https://medium.com/article',
        'Remember: This is a random note',
        'Remember: https://github.com/project for cool stuff',
      ],
    },
    // Add more commands here as they're created
  },
  
  /**
   * Get handler for a command
   * @param {string} commandName - Name of command
   * @returns {object|null} Handler config or null
   */
  getHandler(commandName) {
    return this.commands[commandName.toLowerCase()] || null;
  },
  
  /**
   * Process a message and find matching command
   * @param {string} message - User message
   * @returns {Promise<{handled: boolean, command?: string, result?: any}>}
   */
  async processMessage(message) {
    for (const [name, config] of Object.entries(this.commands)) {
      if (message.toLowerCase().startsWith(name + ':')) {
        const handler = require(config.handler);
        const result = await handler.handle(message);
        return {
          handled: true,
          command: name,
          result,
        };
      }
    }
    
    return { handled: false };
  },
};
