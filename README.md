# RAG Query Worker

A Cloudflare workers-based Retrieval-Augmented Generation (RAG) service that provides intelligent question-answering capabilities using vector similarity search and large language models.

## 🚀 Overview

This worker enables users to ask questions about specific documents by:

1. Converting questions into vector embeddings
2. Finding semantically similar document chunks in a Supabase database
3. Using the retrieved context to generate accurate answers via Hugging Face's Llama model

## 🛠️ Architecture

- **Runtime**: Cloudflare Workers
- **Language**: TypeScript
- **Vector Database**: Supabase with pgvector
- **Embeddings**: External embeddings worker service
- **LLM**: Meta's Llama-3.1-8B-Instruct via Hugging Face Inference

## 📋 Prerequisites

- Node.js 18+ and npm
- Cloudflare account with Workers access
- Supabase project with vector search capabilities
- Hugging Face API token
- Deployed embeddings worker service

## 🔧 Setup

1. **Clone and install dependencies**:

   ```bash
   git clone <repository-url>
   cd rag-query-worker
   npm install
   ```

2. **Configure environment variables**:
   Create a `.dev.vars` file in the root directory:

   ```
   SUPABASE_SERVICE_KEY=your_supabase_service_key_here
   HF_TOKEN=your_hugging_face_token_here
   ```

3. **Update wrangler.jsonc**:

   - Ensure the `SUPABASE_URL` matches your Supabase project
   - Configure the `EMBEDDINGS_WORKER` service binding to point to your embeddings worker

4. **Database setup**:
   Your Supabase database should have a `match_chunks` function that performs vector similarity search. Example schema:
   ```sql
   CREATE TABLE chunks (
     id UUID PRIMARY KEY,
     document_id TEXT,
     chunk_text TEXT,
     embedding VECTOR(384)
   );
   ```

## 🚀 Development

```bash
# Start development server
npm run dev

# Run tests
npm test

# Generate TypeScript types
npm run cf-typegen
```

## 📡 API Reference

### POST /

Processes a question about a specific document and returns an AI-generated answer.

**Request Body**:

```json
{
	"question": "What is the main topic of this document?",
	"document_id": "doc-123-456"
}
```

**Response**:

```json
{
	"answer": {
		"role": "assistant",
		"content": "The main topic of this document is..."
	},
	"chunks_used": 3,
	"similarity_scores": [0.85, 0.78, 0.72]
}
```

## 🔍 How It Works

1. **Question Processing**: The incoming question is sent to the embeddings worker to generate a vector representation
2. **Similarity Search**: Using the question embedding, the system searches for the most similar document chunks in Supabase
3. **Context Retrieval**: Top matching chunks (default: 3) above the similarity threshold (0.7) are retrieved
4. **Answer Generation**: The retrieved chunks provide context for Llama-3.1-8B to generate a relevant answer
5. **Response**: The generated answer is returned along with metadata about the search process

## 🚀 Deployment

```bash
# Deploy to production
npm run deploy
```

The worker will be deployed to Cloudflare's global edge network for low-latency responses.

## 📊 Configuration

### Environment Variables

- `SUPABASE_SERVICE_KEY`: Supabase service role key for database access
- `HF_TOKEN`: Hugging Face API token for LLM inference

### Wrangler Configuration

- `SUPABASE_URL`: Your Supabase project URL
- `EMBEDDINGS_WORKER`: Service binding to your embeddings worker

### Search Parameters

- **Match Threshold**: 0.7 (minimum similarity score)
- **Match Count**: 3 (maximum chunks to retrieve)
- **Model**: meta-llama/Llama-3.1-8B-Instruct
