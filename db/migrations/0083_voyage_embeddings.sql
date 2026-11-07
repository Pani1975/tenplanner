-- Cambia el proveedor de embeddings de OpenAI (1536 dim.) a Voyage AI (1024 dim.).
-- Motivo: el índice todavía no tiene datos en producción (el backfill nunca se ejecutó),
-- así que no se pierde nada al vaciar la tabla. Los vectores de dos modelos distintos
-- no son comparables, por eso hay que regenerarlos todos con el backfill nuevo.

DELETE FROM ai_document_embeddings;
--> statement-breakpoint
DROP INDEX IF EXISTS ai_doc_embeddings_embedding_hnsw;
--> statement-breakpoint
ALTER TABLE ai_document_embeddings
  ALTER COLUMN embedding TYPE extensions.vector(1024);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS ai_doc_embeddings_embedding_hnsw
  ON ai_document_embeddings USING hnsw (embedding extensions.vector_cosine_ops);
--> statement-breakpoint
UPDATE app_settings SET value = '"voyage-3.5"' WHERE key = 'ai.embedding_model';
--> statement-breakpoint
UPDATE app_settings SET value = '1024' WHERE key = 'ai.embedding_dimensions';
