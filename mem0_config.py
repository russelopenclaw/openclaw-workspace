from mem0 import Memory

# mem0 Configuration for Alfred
# This file configures mem0 to use local models and storage

MEM0_CONFIG = {
    # Vector store configuration
    "vector_store": {
        "provider": "qdrant",
        "config": {
            "path": ".mem0/qdrant",  # Local Qdrant instance
            "on_disk": True,
        }
    },
    
    # Embedding model (local via Ollama)
    "embedder": {
        "provider": "ollama",
        "config": {
            "model": "nomic-embed-text",  # Or mxbai-embed-large
            "base_url": "http://192.168.1.33:11434",
        }
    },
    
    # LLM for memory extraction (local via Ollama)
    "llm": {
        "provider": "ollama",
        "config": {
            "model": "qwen2.5:7b",
            "base_url": "http://192.168.1.33:11434",
        }
    },
    
    # History store (SQLite for persistence)
    "history_db_path": ".mem0/history.db",
    
    # Memory settings
    "memory_db_path": ".mem0/memory.db",
    
    # Enable automatic memory extraction
    "auto_mem": True,
    
    # Custom filters for extraction
    "custom_filters": {
        "min_score": 0.7,  # Only extract high-confidence memories
        "max_memories": 100,  # Limit per conversation
    },
}

def get_memory_client():
    """
    Initialize and return a mem0 Memory client with local configuration.
    
    Usage:
        from mem0_config import get_memory_client
        memory = get_memory_client()
        memory.add([...], user_id="kevin")
    """
    memory = Memory(config=MEM0_CONFIG)
    return memory

def add_conversation(memory, messages, user_id="kevin"):
    """
    Add a conversation to mem0.
    
    Args:
        memory: mem0 Memory client
        messages: List of {"role": "user|assistant", "content": "..."} dicts
        user_id: User identifier (default: "kevin")
    
    Example:
        messages = [
            {"role": "user", "content": "I prefer dark mode"},
            {"role": "assistant", "content": "Got it, I'll use dark mode."}
        ]
        add_conversation(memory, messages)
    """
    memory.add(messages, user_id=user_id)

def search_memories(memory, query, user_id="kevin", limit=5):
    """
    Search for relevant memories.
    
    Args:
        memory: mem0 Memory client
        query: Search query string
        user_id: User identifier
        limit: Max results to return
    
    Returns:
        List of memory entries with scores
    """
    results = memory.search(query=query, user_id=user_id, limit=limit)
    return results.get("results", [])

if __name__ == "__main__":
    # Test configuration
    print("Testing mem0 configuration...")
    try:
        memory = get_memory_client()
        print("✅ mem0 client initialized successfully")
        
        # Test add
        test_messages = [
            {"role": "user", "content": "Test memory entry"},
            {"role": "assistant", "content": "This is a test"}
        ]
        memory.add(test_messages, user_id="kevin")
        print("✅ Test memory added")
        
        # Test search
        results = search_memories(memory, "test", user_id="kevin")
        print(f"✅ Search returned {len(results)} results")
        
        print("\nmem0 is ready to use!")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
