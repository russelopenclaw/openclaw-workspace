const { exec } = require('child_process');

// Test heartbeat runner
exec('node /home/kevin/.openclaw/workspace/tools/heartbeat-runner.js', (error, stdout, stderr) => {
  if (error) {
    console.error(`Error: ${error.message}`);
    return;
  }
  if (stderr) {
    console.error(`Stderr: ${stderr}`);
    return;
  }
  console.log(`Output:\n${stdout}`);
});