# 🎵 Script de Geração de Áudios em Lote

Este script gera áudios TTS para todas as notícias que ainda não possuem áudio.

## 🚀 Como Usar

### Pré-requisitos

Certifique-se de que o arquivo `.env` na raiz do projeto contém:

```env
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua-chave-anon
```

### Executar o Script

```bash
node scripts/gerar-audios-lote.mjs
```

## ⚙️ Configurações

Você pode ajustar as configurações no topo do arquivo `gerar-audios-lote.mjs`:

```javascript
const BATCH_SIZE = 5;    // Quantas notícias processar por vez
const DELAY_MS = 2000;   // Delay em ms entre lotes
```

## 📊 O que o Script Faz

1. **Busca** todas as notícias sem `audio_url`
2. **Processa** em lotes (padrão: 5 por vez)
3. **Chama** a Edge Function `generate-jornal-audio` para cada notícia
4. **Aguarda** 2 segundos entre lotes para não sobrecarregar
5. **Mostra** progresso em tempo real
6. **Exibe** resumo final com estatísticas

## 🎯 Exemplo de Saída

```
🎵 Iniciando geração de áudios em lote...

📋 Buscando notícias sem áudio...
📊 Encontradas 47 notícias sem áudio

⚙️  Processando em lotes de 5 com delay de 2000ms

📦 Lote 1/10 (5 notícias)
────────────────────────────────────────────────────────────
1/47 - Gerando: Prefeitura anuncia novo projeto...
  ✅ Sucesso: [NOVO] jornal-uuid-123.mp3
2/47 - Gerando: Obras na Avenida Principal...
  ✅ Sucesso: [NOVO] jornal-uuid-124.mp3
...

⏳ Aguardando 2000ms antes do próximo lote...

============================================================
📊 RESUMO FINAL
============================================================
Total processadas: 47
✅ Sucesso: 45
❌ Erros: 2
📈 Taxa de sucesso: 95.7%
============================================================

🎉 Processamento concluído!
```

## ⚠️ Avisos Importantes

- **Tempo de execução**: Pode levar vários minutos dependendo da quantidade de notícias
- **Cache**: Se uma notícia já tem áudio, será retornado `[CACHE]` e não gerará novamente
- **Erros**: Se alguma notícia falhar, o script continua processando as outras
- **Custo**: Edge-TTS é gratuito, então pode processar quantas quiser!

## 🔍 Verificar Resultado

Depois de executar, verifique no Supabase:

```sql
-- Ver quantas notícias têm áudio agora
SELECT
  COUNT(*) FILTER (WHERE audio_url IS NOT NULL) as com_audio,
  COUNT(*) FILTER (WHERE audio_url IS NULL) as sem_audio,
  COUNT(*) as total
FROM rel_cidade_jornal;

-- Ver os áudios gerados
SELECT id, titulo, audio_url
FROM rel_cidade_jornal
WHERE audio_url IS NOT NULL
ORDER BY created_at DESC
LIMIT 10;
```

## 🐛 Troubleshooting

### Erro: "Variáveis de ambiente não configuradas"
- Verifique se o arquivo `.env` existe na raiz do projeto
- Confirme que as variáveis `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` estão corretas

### Erro: "Erro ao buscar notícias"
- Verifique se a URL do Supabase está correta
- Confirme que a chave ANON está válida

### Erro: "Erro ao gerar áudio"
- Verifique se a Edge Function `generate-jornal-audio` foi deployada
- Veja os logs da função no Supabase Dashboard

### Script muito lento
- Reduza o `BATCH_SIZE` para 2 ou 3
- Aumente o `DELAY_MS` para 3000 ou 5000

### Script muito rápido (erros de rate limit)
- Aumente o `DELAY_MS` para 5000 ou mais
- Reduza o `BATCH_SIZE`
