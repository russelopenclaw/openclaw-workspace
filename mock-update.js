async function update() {
  const { updateStatus } = require('./agent-status.js');
  await updateStatus('working', 'Starting new session - ready to help');
}
update().catch(console.error);