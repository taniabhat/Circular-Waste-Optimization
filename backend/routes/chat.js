const express = require('express');
const router = express.Router();

router.post('/', async (req, res) => {
  try {
    const { messages } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Messages array is required' });
    }

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: messages,
        max_tokens: 150
      })
    });
    
    if (!response.ok) {
      const errorData = await response.text();
      console.error('Groq API Error:', errorData);
      return res.status(response.status).json({ error: 'Error from Groq API' });
    }

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('Chat API Error:', error);
    res.status(500).json({ error: 'Failed to fetch AI response' });
  }
});

module.exports = router;
