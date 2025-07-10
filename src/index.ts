import { InferenceClient } from '@huggingface/inference';
import { createClient } from '@supabase/supabase-js';

const corsHeaders = {
	'Access-Control-Allow-Origin': 'https://smart-query-v3hp.vercel.app',
	'Access-Control-Allow-Methods': 'POST, OPTIONS',
	'Access-Control-Allow-Headers': 'Content-Type',
};

interface RAGRequest {
	question: string;
	document_id: string;
}

interface SimilarChunk {
	id: string;
	document_id: string;
	chunk_text: string;
	similarity: number;
}

export default {
	async fetch(request, env, ctx): Promise<Response> {
		if (request.method === 'OPTIONS') {
			return new Response(null, { headers: corsHeaders });
		}

		if (request.method !== 'POST') {
			return new Response(JSON.stringify({ error: 'Only POST requests allowed' }), {
				status: 405,
				headers: { ...corsHeaders, 'Content-Type': 'application/json' },
			});
		}
		try {
			const { question, document_id }: RAGRequest = await request.json();

			if (!question || !document_id) {
				return new Response(JSON.stringify({ error: 'question and document_id are required' }), {
					status: 400,
					headers: { ...corsHeaders, 'Content-Type': 'application/json' },
				});
			}

			const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);
			const hfClient = new InferenceClient(env.HF_TOKEN);

			const questionEmbeddingResponse = await env.EMBEDDINGS_WORKER.fetch(
				new Request('https://fake', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify([question]),
				})
			);

			if (!questionEmbeddingResponse.ok) {
				throw new Error('Failed to create question embedding');
			}

			const questionEmbeddings: number[][] = await questionEmbeddingResponse.json();
			const questionEmbedding = questionEmbeddings[0];

			const {
				data: similarChunks,
				error: searchError,
			}: {
				data: SimilarChunk[] | null;
				error: any;
			} = await supabase.rpc('match_chunks', {
				query_embedding: questionEmbedding,
				match_threshold: 0.7,
				match_count: 3,
				doc_id: document_id,
			});

			if (searchError) {
				throw new Error(`Search error: ${searchError.message}`);
			}

			if (!similarChunks || similarChunks.length === 0) {
				return new Response(
					JSON.stringify({
						answer: {
							role: 'assistant',
							content: 'No relevant information found in the document.',
						},
						chunks_used: 0,
						similarity_scores: [],
					}),
					{
						headers: { ...corsHeaders, 'Content-Type': 'application/json' },
					}
				);
			}

			const context = similarChunks.map((chunk) => chunk.chunk_text).join('\n\n');

			const messages = [
				{
					role: 'system',
					content:
						'You are an information extraction assistant. Your job is to answer questions based ONLY on the provided context. Always treat the context as accurate and never question or correct the information given. Do not add external knowledge. If the context states something, accept it as fact for this response. Answer in 2-3 sentences.',
				},
				{
					role: 'user',
					content: `Context:\n${context}\n\nQuestion: ${question}`,
				},
			];

			const answerResponse = await hfClient.chatCompletion({
				model: 'meta-llama/Llama-3.1-8B-Instruct',
				messages,
				temperature: 0.7,
				top_p: 0.9,
				max_tokens: 150,
			});

			return new Response(
				JSON.stringify({
					answer: answerResponse.choices[0].message,
					chunks_used: similarChunks.length,
					similarity_scores: similarChunks.map((c) => c.similarity),
				}),
				{ headers: corsHeaders }
			);
		} catch (error: any) {
			return new Response(JSON.stringify({ error: error.message }), {
				status: 500,
				headers: { ...corsHeaders, 'Content-Type': 'application/json' },
			});
		}
	},
} satisfies ExportedHandler<Env>;
