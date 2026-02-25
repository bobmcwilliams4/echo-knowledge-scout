-- Seed source configurations with default search queries

INSERT OR REPLACE INTO source_configs (source, enabled, search_queries, scan_interval_hours, max_results_per_scan, config)
VALUES
  ('github', 1, '["autonomous agent framework","mcp server model context protocol","multi agent orchestration","ai agent memory","llm tool use function calling","browser automation ai agent","agentic workflow"]', 24, 100, '{"min_stars": 10}'),
  ('huggingface', 1, '["agent","function-calling","tool-use","code","tts","whisper","mcp"]', 24, 80, '{"include_spaces": true}'),
  ('arxiv', 1, '["autonomous agent language model","multi-agent orchestration","tool use large language model","agent memory retrieval","self-improving artificial intelligence","model context protocol"]', 24, 60, '{}'),
  ('reddit', 1, '["MachineLearning","artificial","LocalLLaMA","ClaudeAI","AutoGPT","LangChain","ChatGPTPro","singularity"]', 24, 50, '{"min_score": 50}'),
  ('hackernews', 1, '["topstories","beststories"]', 24, 50, '{"min_score": 50}'),
  ('rss', 1, '["cloudflare","openai","anthropic","google-ai","huggingface","langchain","the-batch","simon-willison"]', 24, 80, '{}'),
  ('producthunt', 1, '["artificial-intelligence"]', 24, 20, '{}');
