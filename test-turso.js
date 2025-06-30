import { createClient } from '@libsql/client';
import { config } from 'dotenv';

config();

const db = createClient({
  url: process.env.TURSO_DB_URL,
  authToken: process.env.TURSO_DB_AUTH_TOKEN,
});

async function testConnection() {
  try {
    console.log('Testing Turso connection...');
    console.log('URL:', process.env.TURSO_DB_URL);
    console.log('Auth Token:', process.env.TURSO_DB_AUTH_TOKEN ? 'Present' : 'Missing');
    
    const result = await db.execute('SELECT COUNT(*) as count FROM AFL_data');
    console.log('✅ Connection successful!');
    console.log('Total records in AFL_data:', result.rows[0].count);
    
    // Test a simple query
    const teams = await db.execute(`
      SELECT DISTINCT match_home_team 
      FROM AFL_data 
      WHERE match_home_team IS NOT NULL 
      LIMIT 5
    `);
    console.log('Sample teams:', teams.rows.map(r => r.match_home_team));
    
  } catch (error) {
    console.error('❌ Connection failed:', error.message);
    process.exit(1);
  }
}

testConnection();