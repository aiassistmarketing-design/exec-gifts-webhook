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

    // Try Qdrant first (vector search)
    try {
      const embedding = await generateEmbedding(query);
      const results = await searchQdrant(embedding);
      
      if (results && results.length > 0) {
        const bestMatch = results[0];
        return res.status(200).json({
          success: true,
          source: 'qdrant',
          data: {
            question: bestMatch.payload?.question,
            answer: bestMatch.payload?.answer,
            product_description: bestMatch.payload?.product_description,
            product_id: bestMatch.payload?.product_id,
            score: bestMatch.score
          }
        });
      }
    } catch (error) {
      console.log('Qdrant failed:', error.message);
    }

    // Fallback to Supabase (text search)
    try {
      const results = await searchSupabase(query);
      
      if (results && results.length > 0) {
        const bestMatch = results[0];
        return res.status(200).json({
          success: true,
          source: 'supabase',
          data: {
            question: bestMatch.question,
            answer: bestMatch.answer,
            product_description: bestMatch.product_description
          }
        });
      }
    } catch (error) {
      console.log('Supabase failed:', error.message);
    }

    // No results found in either database
    return res.status(200).json({
      success: false,
      message: 'No relevant information found'
    });

  } catch (error) {
    console.error('Webhook error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
}

async function generateEmbedding(text) {
  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'text-embedding-3-large',
      input: text
    })
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.status}`);
  }

  const data = await response.json();
  return data.data[0].embedding;
}

async function searchQdrant(embedding) {
  const response = await fetch(
    'https://3f703634-7b1a-454a-9c67-2714374d7598.us-east4-0.gcp.cloud.qdrant.io/collections/qa_knowledge/points/search',
    {
      method: 'POST',
      headers: {
        'api-key': process.env.QDRANT_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        vector: embedding,
        limit: 3,
        score_threshold: 0.5,
        with_payload: true,
        with_vector: false
      })
    }
  );

  if (!response.ok) {
    throw new Error(`Qdrant API error: ${response.status}`);
  }

  const data = await response.json();
  return data.result || [];
}

async function searchSupabase(query) {
  const response = await fetch(
    `https://untrclproolrmfycxtkb.supabase.co/rest/v1/qa_knowledge?or=(question.ilike.*${encodeURIComponent(query)}*,answer.ilike.*${encodeURIComponent(query)}*,product_description.ilike.*${encodeURIComponent(query)}*)&limit=3`,
    {
      method: 'GET',
      headers: {
        'apikey': process.env.SUPABASE_KEY,
        'Authorization': `Bearer ${process.env.SUPABASE_KEY}`
      }
    }
  );

  if (!response.ok) {
    throw new Error(`Supabase API error: ${response.status}`);
  }

  return await response.json();
}
