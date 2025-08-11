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

    // Try Qdrant first
    try {
      const embedding = await generateEmbedding(query);
      const results = await searchQdrant(embedding);
      
      if (results && results.length > 0) {
        return res.status(200).json({
          success: true,
          source: 'qdrant',
          data: results[0]
        });
      } else {
        return res.status(200).json({
          success: false,
          message: 'Qdrant found no results',
          query: query
        });
      }
    } catch (error) {
      return res.status(200).json({
        success: false,
        message: 'Qdrant error: ' + error.message
      });
    }

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
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
    throw new Error(`OpenAI error: ${response.status}`);
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
        score_threshold: 0.5
      })
    }
  );

  if (!response.ok) {
    throw new Error(`Qdrant API error: ${response.status}`);
  }

  const data = await response.json();
  return data.result || [];
}
