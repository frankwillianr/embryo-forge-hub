# 🚀 Como Fazer Deploy da Edge Function Correta

## Problema Atual

As notícias estão usando URLs do Yandex TTS ao invés de arquivos MP3 no Storage.

**URL atual (errada):**
```
https://tts.voicetech.yandex.net/generate?text=...
```

**URL desejada (correta):**
```
https://projeto.supabase.co/storage/v1/object/public/jornal-audios/jornal-uuid.mp3
```

---

## Opção 1: Deploy Manual via Dashboard (RECOMENDADO)

### Passo 1: Abrir o Supabase Dashboard

1. Vá para https://app.supabase.com
2. Selecione seu projeto
3. No menu lateral, clique em **Edge Functions**

### Passo 2: Criar/Editar a Função

#### Se a função `generate-jornal-audio` JÁ EXISTE:
1. Clique em `generate-jornal-audio`
2. Clique em **Edit Function**
3. **APAGUE TODO O CÓDIGO** atual
4. **COLE O CÓDIGO** do arquivo `supabase/functions/generate-jornal-audio/index.ts`
5. Clique em **Deploy**

#### Se a função `generate-jornal-audio` NÃO EXISTE:
1. Clique em **New Function**
2. Nome: `generate-jornal-audio`
3. **COLE O CÓDIGO** do arquivo `supabase/functions/generate-jornal-audio/index.ts`
4. Clique em **Deploy**

### Passo 3: Verificar Deploy

Após o deploy, você deve ver uma mensagem de sucesso e a função aparecerá na lista.

---

## Opção 2: Deploy via Supabase CLI

### Instalar Supabase CLI (se não tiver)

```bash
npm install -g supabase
```

### Login no Supabase

```bash
supabase login
```

### Deploy da Função

```bash
cd c:/Users/willi/embryo-forge-hub
supabase functions deploy generate-jornal-audio --project-ref umauozcntfxgphzbiifz
```

**Substitua `umauozcntfxgphzbiifz` pelo seu Project Reference ID**
(encontre em: Settings > General > Reference ID)

---

## ✅ Verificar se Funcionou

Depois do deploy, execute:

```bash
node scripts/testar-uma-noticia.mjs
```

A URL retornada deve ser algo como:
```
https://projeto.supabase.co/storage/v1/object/public/jornal-audios/jornal-abc123-1234567890.mp3
```

---

## 🔄 Regerar Áudios com a Função Correta

Depois de deployar a função correta, você precisa **regerar os áudios**:

### Opção A: Limpar e regerar tudo

```sql
-- CUIDADO: Isso vai limpar TODAS as URLs de áudio
UPDATE rel_cidade_jornal
SET audio_url = NULL;
```

Depois execute:
```bash
node scripts/gerar-audios-lote.mjs
```

### Opção B: Limpar apenas algumas notícias

```sql
-- Limpar apenas notícias com URL do Yandex
UPDATE rel_cidade_jornal
SET audio_url = NULL
WHERE audio_url LIKE '%yandex%';
```

Depois execute:
```bash
node scripts/gerar-audios-lote.mjs
```

---

## 🐛 Troubleshooting

### Erro: "Function not found"
- Confirme que o nome da função é exatamente `generate-jornal-audio`
- Verifique se está no projeto correto

### Erro ao fazer upload no Storage
- Confirme que o bucket `jornal-audios` existe e é público
- Verifique as políticas de acesso (execute `DEPLOY_ALL.sql`)

### URLs ainda do Yandex após regerar
- Confirme que deployou a função CORRETA
- Veja os logs da função no Dashboard para identificar erros
