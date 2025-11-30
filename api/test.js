import { supabase } from '../db.js';

export default async function handler(req, res) {
  try {
    // Check environment variables
    console.log('Environment check:', {
      hasUrl: !!process.env.SUPABASE_URL,
      hasKey: !!process.env.SUPABASE_ANON_KEY,
      url: process.env.SUPABASE_URL?.substring(0, 20) + '...',
    });

    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
      return res.status(500).json({ 
        error: 'Missing environment variables',
        details: {
          hasUrl: !!process.env.SUPABASE_URL,
          hasKey: !!process.env.SUPABASE_ANON_KEY
        }
      });
    }

    // Test basic connection
    const { data, error, count } = await supabase
      .from('afl_data')
      .select('*', { count: 'exact' })
      .limit(1);

    if (error) {
      console.error('Supabase error:', error);
      return res.status(500).json({ 
        error: 'Database connection failed',
        details: error.message,
        code: error.code
      });
    }

    // Check table structure
    const { data: tableInfo, error: tableError } = await supabase
      .from('afl_data')
      .select('*')
      .limit(1);

    res.json({
      success: true,
      connection: 'OK',
      recordCount: count,
      sampleRecord: data?.[0],
      columns: tableInfo?.[0] ? Object.keys(tableInfo[0]) : [],
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Test endpoint error:', error);
    res.status(500).json({ 
      error: 'Test failed',
      message: error.message,
      stack: error.stack
    });
  }
}
