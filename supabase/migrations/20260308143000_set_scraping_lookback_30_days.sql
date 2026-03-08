-- Ajusta janela de coleta de noticias para 30 dias
ALTER TABLE cidade_scraping_config
ALTER COLUMN lookback_dias SET DEFAULT 30;

UPDATE cidade_scraping_config
SET lookback_dias = 30
WHERE lookback_dias IS DISTINCT FROM 30;
