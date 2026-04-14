const { initDatabase } = require('../src/config/database');

console.log('Initializing WorkProof database...\n');

initDatabase()
  .then(() => {
    console.log('\n✅ Database initialized successfully!');
    console.log('   Location: ./database/workproof.db');
    console.log('\nYou can now start the server:');
    console.log('   npm run dev');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Database initialization failed:', error);
    process.exit(1);
  });
