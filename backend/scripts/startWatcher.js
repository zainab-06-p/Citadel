const { startWatcher } = require('../src/services/watcherService');

console.log('Starting WorkProof Blockchain Watcher...\n');

startWatcher().catch(error => {
  console.error('Failed to start watcher:', error);
  process.exit(1);
});

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\nStopping watcher...');
  process.exit(0);
});
