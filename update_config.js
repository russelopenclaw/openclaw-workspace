const fs = require('fs');
const path = '/home/kevin/.openclaw/config/';

try {
  // Create directory if it doesn't exist
  if (!fs.existsSync(path)) {
    fs.mkdirSync(path, { recursive: true });
    console.log('Created directory:', path);
  }
  
  // Create config file
  const configPath = path + 'openclaw.json';
  const configContent = {
    "ask": "on-miss",
    "security": "allowlist"
  };
  
  fs.writeFileSync(configPath, JSON.stringify(configContent, null, 2));
  console.log('Created config file:', configPath);
  console.log('Contents:', JSON.stringify(configContent, null, 2));
} catch (err) {
  console.error('Error creating config:', err);
}