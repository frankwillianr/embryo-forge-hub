# Sistema de Áudio TTS para Notícias

## 📋 Visão Geral

Sistema de geração automática de áudio para notícias usando **Edge-TTS** (Microsoft Text-to-Speech), completamente **GRATUITO** e com vozes naturais em português brasileiro.

## 🎯 Como Funciona

### 1. Criação Automática de Áudio
Quando uma notícia é publicada:
1. **Trigger Database** detecta nova notícia
2. **Edge Function** `generate-jornal-audio` é chamada automaticamente
3. Áudio é gerado usando Edge-TTS (voz: `pt-BR-FranciscaNeural`)
4. Arquivo MP3 é salvo no **Supabase Storage** (bucket: `jornal-audios`)
5. URL pública é salva no campo `audio_url` da tabela

### 2. Reprodução no Frontend
- Se `audio_url` existe → reproduz MP3 pré-gerado (rápido, alta qualidade)
- Se `audio_url` não existe → fallback para Web Speech API

## 💰 Custos

### Storage
- **Tamanho médio por áudio:** ~50KB
- **3.000 notícias/mês:** 150MB
- **Supabase free tier:** 1GB
- **Custo:** $0 ✅

### TTS (Text-to-Speech)
- **Edge-TTS (Microsoft):** Completamente GRATUITO
- **Vozes:** Naturais em pt-BR
- **Limite:** Ilimitado
- **Custo:** $0 ✅

### Escalabilidade
Com 50.000 usuários:
- Cada notícia gera áudio **apenas 1 vez**
- 50.000 usuários ouvem o **mesmo arquivo MP3**
- **Custo adicional:** $0 🎉

## 🚀 Vantagens

✅ **Gratuito** - Edge-TTS sem limite
✅ **Escalável** - Gera 1 vez, usa infinitas vezes
✅ **Rápido** - MP3 pré-gerado, sem latência
✅ **Qualidade** - Vozes neurais naturais
✅ **Cache** - Armazenado no Supabase Storage
✅ **Fallback** - Web Speech API se falhar

## 📁 Arquivos Criados

### Migrations
- `20260216000000_add_audio_url_to_jornal.sql` - Adiciona campo audio_url
- `20260216000001_create_jornal_audios_bucket.sql` - Cria bucket de storage
- `20260216000002_trigger_generate_jornal_audio.sql` - Trigger automático

### Edge Functions
- `supabase/functions/generate-jornal-audio/index.ts` - Gera e armazena áudio

### Frontend
- Atualizado `src/types/jornal.ts` - Tipo com audio_url
- Atualizado `src/components/jornal/JornalFeedCard.tsx` - Player de áudio

## 🔧 Deploy

### 1. Aplicar Migrations
```bash
# Se você usa Supabase CLI local
supabase db reset

# Ou execute as migrations manualmente no Supabase Dashboard
```

### 2. Deploy da Edge Function
```bash
supabase functions deploy generate-jornal-audio
```

### 3. Configurar Variáveis de Ambiente
No Supabase Dashboard, configure:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

## 🧪 Testar

### Gerar áudio para notícia existente
```bash
curl -X POST 'https://seu-projeto.supabase.co/functions/v1/generate-jornal-audio' \
  -H 'Authorization: Bearer SEU_ANON_KEY' \
  -H 'Content-Type: application/json' \
  -d '{"jornalId": "uuid-da-noticia"}'
```

### Verificar áudio gerado
1. Acesse o Supabase Dashboard
2. Storage → jornal-audios
3. Veja os arquivos MP3 gerados

## 📊 Monitoramento

### Ver logs da Edge Function
```bash
supabase functions logs generate-jornal-audio
```

### Verificar notícias sem áudio
```sql
SELECT id, titulo, audio_url
FROM rel_cidade_jornal
WHERE audio_url IS NULL;
```

### Gerar áudios em lote (caso necessário)
```sql
-- Chamar função para cada notícia sem áudio
SELECT net.http_post(
  url := current_setting('app.settings.supabase_url') || '/functions/v1/generate-jornal-audio',
  headers := jsonb_build_object(
    'Content-Type', 'application/json',
    'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
  ),
  body := jsonb_build_object('jornalId', id)
)
FROM rel_cidade_jornal
WHERE audio_url IS NULL;
```

## 🎙️ Opções de Voz

Vozes disponíveis em português (Edge-TTS):
- `pt-BR-FranciscaNeural` (Feminina) - **Padrão**
- `pt-BR-AntonioNeural` (Masculina)
- `pt-PT-RaquelNeural` (Feminina, Portugal)
- `pt-PT-DuarteNeural` (Masculino, Portugal)

Para alterar, edite `generate-jornal-audio/index.ts`, linha com `const voice =`.

## ⚠️ Notas Importantes

1. **Trigger automático** só funciona para novas notícias após o deploy
2. Notícias antigas precisam ter áudio gerado manualmente (ver seção de monitoramento)
3. **Edge-TTS** tem limite de 5000 caracteres por requisição (já implementado no código)
4. Áudios têm cache de 1 ano no Storage

## 🐛 Troubleshooting

### Áudio não está sendo gerado
1. Verifique logs da Edge Function
2. Verifique se o bucket `jornal-audios` existe
3. Verifique permissões do Storage

### Áudio não toca no frontend
1. Verifique se `audio_url` está preenchido no banco
2. Teste a URL diretamente no navegador
3. Verifique console do navegador para erros

### Regenerar áudio
```sql
-- Limpar audio_url para regenerar
UPDATE rel_cidade_jornal
SET audio_url = NULL
WHERE id = 'uuid-da-noticia';

-- Trigger irá gerar novamente na próxima atualização
```

## 📚 Recursos

- [Edge-TTS Documentation](https://github.com/rany2/edge-tts)
- [Supabase Storage](https://supabase.com/docs/guides/storage)
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)
