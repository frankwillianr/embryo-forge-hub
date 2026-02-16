# 🧪 Testar Edge Function de Áudio

## Passo 1: Pegar ID de uma notícia

Execute no Supabase SQL Editor:

```sql
SELECT id, titulo, audio_url
FROM rel_cidade_jornal
ORDER BY created_at DESC
LIMIT 1;
```

Copie o `id` da notícia.

---

## Passo 2: Testar a função manualmente

Você pode testar de duas formas:

### **Opção A: Via cURL (Terminal)**

```bash
curl -X POST 'https://SEU-PROJETO.supabase.co/functions/v1/generate-jornal-audio' \
  -H 'Authorization: Bearer SUA-ANON-KEY' \
  -H 'Content-Type: application/json' \
  -d '{"jornalId": "COLE-O-ID-AQUI"}'
```

**Substitua:**
- `SEU-PROJETO` → ID do seu projeto Supabase
- `SUA-ANON-KEY` → Anon key do projeto (pega em Settings > API)
- `COLE-O-ID-AQUI` → ID da notícia que você copiou

### **Opção B: Via JavaScript (Console do Browser)**

1. Abra a aplicação no navegador
2. Abra o Console (F12)
3. Cole e execute:

```javascript
fetch('https://SEU-PROJETO.supabase.co/functions/v1/generate-jornal-audio', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer SUA-ANON-KEY',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ jornalId: 'COLE-O-ID-AQUI' })
})
.then(r => r.json())
.then(console.log)
.catch(console.error);
```

---

## ✅ Resultado Esperado

Se funcionou, você deve ver algo assim:

```json
{
  "audioUrl": "https://SEU-PROJETO.supabase.co/storage/v1/object/public/jornal-audios/jornal-UUID-TIMESTAMP.mp3",
  "cached": false
}
```

Se chamar de novo, deve retornar `"cached": true`.

---

## 🔍 Ver Logs da Função

No Supabase Dashboard:
1. Vá em **Edge Functions**
2. Clique em `generate-jornal-audio`
3. Veja a aba **Logs**

---

## 🎵 Testar o Áudio no Frontend

1. Vá para a página do jornal: `/cidade/SLUG/jornal`
2. Clique no botão **"Ouvir notícia"**
3. O áudio deve tocar automaticamente!

---

## ⚠️ Se não funcionar

**Erro comum 1:** Bucket não existe
- Solução: Execute o SQL `DEPLOY_ALL.sql` novamente

**Erro comum 2:** Permission denied
- Solução: Verifique as políticas do Storage no Supabase Dashboard

**Erro comum 3:** Edge Function não encontrada
- Solução: Confirme que fez deploy da função `generate-jornal-audio`

**Ver logs detalhados:**
```bash
# Se tiver Supabase CLI instalado
supabase functions logs generate-jornal-audio
```
