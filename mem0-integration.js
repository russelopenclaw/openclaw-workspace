/**
 * mem0 Integration for OpenClaw
 * 
 * This script provides mem0 memory management for Alfred.
 * Run as a subagent or integrate into session startup.
 * 
 * Usage:
 *   node mem0-integration.js --add "memory text" --user kevin
 *   node mem0-integration.js --search "query text" --user kevin
 */

const fs = require('fs');
const path = require('path');

// Configuration
const CONFIG = {
  workspacePath: '/home/kevin/.openclaw/workspace',
  mem0DataPath: '.mem0',
  embeddingModel: 'nomic-embed-text', // Local Ollama
  embedderEndpoint: 'http://localhost:11434', // Local Ollama
};

// Vector math utilities
const VectorMath = {
  /**
   * Compute cosine similarity between two vectors
   */
  cosineSimilarity(a, b) {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    
    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    return denominator === 0 ? 0 : dotProduct / denominator;
  },
};

// Ollama embedding service
class EmbeddingService {
  constructor() {
    this.ollamaUrl = CONFIG.embedderEndpoint;
    this.model = CONFIG.embeddingModel;
    this.cache = new Map();
  }

  /**
   * Generate embedding for text using Ollama
   */
  async embed(text) {
    const cacheKey = text.substring(0, 50);
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    try {
      const response = await fetch(`${this.ollamaUrl}/api/embeddings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.model,
          prompt: text,
        }),
      });

      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.status}`);
      }

      const data = await response.json();
      const embedding = data.embedding;
      
      this.cache.set(cacheKey, embedding);
      return embedding;
    } catch (error) {
      console.error('Embedding error:', error.message);
      // Fallback: return zero vector
      return new Array(768).fill(0);
    }
  }
}

// Vector storage with semantic search
class VectorStore {
  constructor(dbPath) {
    this.dbPath = dbPath;
    this.memories = [];
    this.embedder = new EmbeddingService();
    this.load();
  }

  load() {
    try {
      const data = fs.readFileSync(this.dbPath, 'utf8');
      this.memories = JSON.parse(data);
    } catch (e) {
      this.memories = [];
    }
  }

  save() {
    fs.writeFileSync(this.dbPath, JSON.stringify(this.memories, null, 2));
  }

  async add(text, metadata = {}) {
    // Generate embedding
    const embedding = await this.embedder.embed(text);
    
    const memory = {
      text,
      embedding,
      metadata,
      timestamp: new Date().toISOString(),
      id: `mem_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    };
    
    this.memories.push(memory);
    this.save();
    return memory;
  }

  async search(query, limit = 5) {
    // Generate query embedding
    const queryEmbedding = await this.embedder.embed(query);
    
    // Calculate similarity scores (skip memories without embeddings)
    const scored = this.memories
      .filter(m => m.embedding && m.embedding.length > 0)
      .map(m => ({
        ...m,
        score: VectorMath.cosineSimilarity(queryEmbedding, m.embedding),
      }));
    
    // Sort by score (descending) and return top results
    const results = scored
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    return {
      results: results.map(m => ({
        memory: m.text,
        score: m.score,
        metadata: m.metadata,
        id: m.id,
      })),
      total: results.length,
    };
  }

  // Legacy keyword search (fallback)
  searchKeyword(query, limit = 5) {
    const queryLower = query.toLowerCase();
    const results = this.memories
      .filter(m => m.text.toLowerCase().includes(queryLower))
      .slice(0, limit);

    return {
      results: results.map(m => ({
        memory: m.text,
        score: 1.0,
        metadata: m.metadata,
      })),
      total: results.length,
    };
  }
}

class Mem0Integration {
  constructor(userId = 'kevin') {
    this.userId = userId;
    this.dataPath = path.join(CONFIG.workspacePath, CONFIG.mem0DataPath);
    this.dbPath = path.join(this.dataPath, `${userId}-memories.json`);
    
    // Initialize vector store
    if (!fs.existsSync(this.dataPath)) {
      fs.mkdirSync(this.dataPath, { recursive: true });
    }
    this.store = new VectorStore(this.dbPath);
  }

  /**
   * Add memory from conversation
   * @param {Array} messages - Array of {role, content} objects
   * @returns {Promise<Array>} - Added memory entries
   */
  async add(messages) {
    const added = [];
    
    // Extract key information from messages
    for (const msg of messages) {
      if (msg.role === 'user') {
        // Store user statements as memories
        const memory = await this.store.add(msg.content, {
          source: 'conversation',
          user: this.userId,
          type: 'user_statement',
        });
        added.push(memory);
      }
    }

    console.log(`Added ${added.length} memories for user ${this.userId}`);
    return added;
  }

  /**
   * Search for relevant memories (semantic search with embeddings)
   * @param {string} query - Search query
   * @param {number} limit - Max results
   * @returns {Promise<Object>} - Search results with scores
   */
  async search(query, limit = 5) {
    return await this.store.search(query, limit);
  }

  /**
   * Get memory statistics
   * @returns {Object} - Stats
   */
  getStats() {
    return {
      totalMemories: this.store.memories.length,
      userId: this.userId,
      dbPath: this.dbPath,
      hasEmbeddings: this.store.memories.length > 0 && 
                     this.store.memories[0].embedding !== undefined,
    };
  }
  
  /**
   * Re-embed all memories (use after adding embedding support)
   * @returns {Promise<number>} - Number of memories re-embedded
   */
  async reembedAll() {
    let count = 0;
    for (const memory of this.store.memories) {
      if (!memory.embedding || memory.embedding.length === 0) {
        console.log(`Embedding: ${memory.text.substring(0, 50)}...`);
        memory.embedding = await this.store.embedder.embed(memory.text);
        count++;
      }
    }
    this.store.save();
    console.log(`Re-embedded ${count} memories`);
    return count;
  }
  
  /**
   * Add a memory directly (without conversation format)
   * @param {string} text - Memory text
   * @param {Object} metadata - Optional metadata
   * @returns {Promise<Object>} - Added memory
   */
  async addDirect(text, metadata = {}) {
    const memory = await this.store.add(text, metadata);
    console.log(`Added 1 memory for user ${this.userId}`);
    return memory;
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  const argMap = {};
  
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      const key = args[i].slice(2);
      argMap[key] = args[i + 1];
      i++;
    }
  }

  const userId = argMap.user || 'kevin';
  const mem0 = new Mem0Integration(userId);

  if (argMap.add) {
    await mem0.add([{ role: 'user', content: argMap.add }]);
    console.log('✅ Memory added');
    process.exit(0);
  } else if (argMap.search) {
    const results = await mem0.search(argMap.search);
    console.log(`\n📚 Found ${results.results.length} memories:\n`);
    results.results.forEach((r, i) => {
      console.log(`${i + 1}. [Score: ${r.score.toFixed(3)}] ${r.memory}`);
    });
    process.exit(0);
  } else if (argMap.stats) {
    const stats = mem0.getStats();
    console.log('\n📊 Memory Statistics:');
    console.log(`User: ${stats.userId}`);
    console.log(`Total Memories: ${stats.totalMemories}`);
    console.log(`Has Embeddings: ${stats.hasEmbeddings ? '✅ Yes' : '❌ No'}`);
    console.log(`Database: ${stats.dbPath}`);
    process.exit(0);
  } else if (argMap.reembed) {
    console.log('🔄 Re-embedding all memories...');
    await mem0.reembedAll();
    console.log('✅ Re-embedding complete');
    process.exit(0);
  } else if (argMap.test) {
    // Test semantic search
    console.log('🧪 Testing semantic search...\n');
    await mem0.addDirect('The sky is blue and clear today');
    await mem0.addDirect('I love programming in Python and JavaScript');
    await mem0.addDirect('Kevin enjoys hiking in the mountains');
    
    console.log('\nSearch for "coding":');
    const codingResults = await mem0.search('coding');
    codingResults.results.forEach(r => {
      console.log(`  [${r.score.toFixed(3)}] ${r.memory}`);
    });
    
    console.log('\nSearch for "nature":');
    const natureResults = await mem0.search('nature');
    natureResults.results.forEach(r => {
      console.log(`  [${r.score.toFixed(3)}] ${r.memory}`);
    });
    
    process.exit(0);
  } else {
    console.log('mem0 Integration for OpenClaw');
    console.log('\nUsage:');
    console.log('  node mem0-integration.js --add "memory text" --user kevin');
    console.log('  node mem0-integration.js --search "query" --user kevin');
    console.log('  node mem0-integration.js --stats --user kevin');
    console.log('  node mem0-integration.js --reembed --user kevin');
    console.log('  node mem0-integration.js --test --user kevin');
    process.exit(0);
  }
}

// Export for use as module
module.exports = { Mem0Integration, CONFIG };

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}
