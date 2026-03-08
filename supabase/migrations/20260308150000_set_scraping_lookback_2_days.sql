-- Reverte janela de coleta de noticias para 2 dias
ALTER TABLE cidade_scraping_config
ALTER COLUMN lookback_dias SET DEFAULT 2;

UPDATE cidade_scraping_config
SET lookback_dias = 2
WHERE lookback_dias IS DISTINCT FROM 2;
