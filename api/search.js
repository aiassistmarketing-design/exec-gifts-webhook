export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const query = req.body?.args?.query || req.body?.query;
    
    if (!query) {
      return res.status(400).json({ 
        success: false, 
        message: 'No query provided' 
      });
    }

    // DEBUG: Return environment variable status
    return res.status(200).json({
      success: false,
      message: 'Debug mode',
      debug: {
        query: query,
        hasOpenAI: !!process.env.OPENAI_API_KEY,
        hasQdrant: !!process.env.QDRANT_API_KEY,
        hasSupabase: !!process.env.SUPABASE_KEY
      }
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Error: ' + error.message
    });
  }
}
