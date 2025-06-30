import { db } from './db.js';

async function test() {
  const result = await db.execute('SELECT COUNT(*) as count FROM AFL_data');
  console.log(result.rows[0].count);
}

test();