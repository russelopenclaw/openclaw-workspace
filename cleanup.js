// Cleanup temporary files
const fs = require('fs');
const paths = [
  './setup.js',
  './startup.js',
  '.init.js',
  '.boot.js'
];

paths.forEach(path => {
  if (fs.existsSync(path)) {
    fs.unlinkSync(path);
    console.log(`Removed ${path}`);
  }
});