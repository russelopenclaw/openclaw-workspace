const fs = require('fs');
const path = '/home/kevin/.openclaw/config/openclaw.json';

try {
  if (fs.existsSync(path)) {
    console.log('File exists');
    const data = fs.readFileSync(path, 'utf8');
    console.log('File contents:', data);
  } else {
    console.log('File does not exist');
  }
} catch (err) {
  console.error('Error checking file:', err);
}