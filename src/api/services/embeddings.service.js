/**
 * Embeddings service for profile text - uses OpenAI text-embedding-3-small.
 * Blank/empty profile text uses a hard-coded embedding from test/embedding-empty-string.json.
 */

const path = require('path');
const fs = require('fs');

const { EMBEDDING_EMPTY_STRING } = require('./embedding-empty-string');
const MODEL_ID = 'text-embedding-3-small';

/**
 * Generate embedding for profile text via OpenAI API.
 * Blank/whitespace-only text returns the hard-coded empty embedding.
 * @param {string} text - Profile text to embed
 * @returns {Promise<number[]>} 1536-dimensional embedding vector
 */
async function generateEmbedding(text) {
  const trimmed = typeof text === 'string' ? text.trim() : '';
  if (trimmed === '') {
    return EMBEDDING_EMPTY_STRING.data.empty.embedding;
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY environment variable required for embedding generation');
  }

  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MODEL_ID,
      input: trimmed,
    }),
  });

  if (!response.ok) {
    const errBody = await response.text();
    let errMsg = `OpenAI API error: ${response.status} ${response.statusText}`;
    try {
      const errJson = JSON.parse(errBody);
      if (errJson.error && errJson.error.message) {
        errMsg = `OpenAI API error: ${errJson.error.message}`;
      }
    } catch (e) {
      // use default msg
    }
    throw new Error(errMsg);
  }

  const data = await response.json();
  return data.data[0].embedding;
}

/**
 * Convert embedding vector to comma-separated string for storage.
 * @param {number[]} vec - Embedding vector
 * @returns {string} Comma-separated values
 */
function embeddingToStorageString(vec) {
  return vec.map((v) => String(v)).join(',');
}

/**
 * Parse comma-separated embedding string back to number array.
 * @param {string} str - Comma-separated embedding values
 * @returns {number[]} Embedding vector
 */
function storageStringToEmbedding(str) {
  if (!str || typeof str !== 'string') {
    return null;
  }
  return str.split(',').map((s) => parseFloat(s.trim(), 10));
}

module.exports = {
  generateEmbedding,
  embeddingToStorageString,
  storageStringToEmbedding,
  MODEL_ID,
};
