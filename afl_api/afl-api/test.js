import Database from 'better-sqlite3';

try {
  console.log('Testing database connection...');
  const db = new Database('./afl_data.sqlite', { readonly: true });
  
  console.log('Database connected successfully');
  
  const years = db.prepare(`
    SELECT DISTINCT substr(match_date, 1, 4) AS year
    FROM AFL_data
    WHERE year GLOB '[1-2][0-9][0-9][0-9]'
    ORDER BY year DESC
    LIMIT 5
  `).all();
  
  console.log('Years found:', years);
  
  db.close();
  console.log('Test completed successfully');
} catch (error) {
  console.error('Database error:', error);
}