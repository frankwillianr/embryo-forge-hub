/**
 * Testar geração de áudio para UMA notícia
 * node scripts/testar-uma-noticia.mjs
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Ler .env
const envPath = join(__dirname, '..', '.env');
let SUPABASE_URL, ANON_KEY;

try {
  const envFile = readFileSync(envPath, 'utf-8');
  envFile.split('\n').forEach(line => {
    const [key, value] = line.split('=');
    if (key === 'VITE_SUPABASE_URL') SUPABASE_URL = value.trim();
    if (key === 'VITE_SUPABASE_ANON_KEY') ANON_KEY = value.trim();
  });
} catch (error) {
  console.error('❌ Erro ao ler .env:', error.message);
  process.exit(1);
}

async function main() {
  console.log('🔍 Buscando uma notícia sem áudio...\n');

  // Buscar UMA notícia
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/rel_cidade_jornal?select=id,titulo&audio_url=is.null&order=created_at.desc&limit=1`,
    {
      headers: {
        'apikey': ANON_KEY,
        'Authorization': `Bearer ${ANON_KEY}`,
      },
    }
  );

  const noticias = await response.json();

  if (noticias.length === 0) {
    console.log('✅ Todas as notícias já têm áudio!');
    return;
  }

  const noticia = noticias[0];
  console.log(`📰 Notícia: ${noticia.titulo}`);
  console.log(`🆔 ID: ${noticia.id}\n`);
  console.log('🎵 Gerando áudio...\n');

  // Chamar Edge Function
  const audioResponse = await fetch(
    `${SUPABASE_URL}/functions/v1/generate-jornal-audio`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ANON_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ jornalId: noticia.id }),
    }
  );

  console.log(`📊 Status: ${audioResponse.status} ${audioResponse.statusText}\n`);

  const resultado = await audioResponse.json();

  console.log('📋 Resposta completa:');
  console.log(JSON.stringify(resultado, null, 2));

  if (resultado.error) {
    console.log('\n❌ ERRO:', resultado.error);
  } else {
    console.log('\n✅ SUCESSO!');
    console.log('🔗 URL do áudio:', resultado.audioUrl);
    console.log('💾 Cached:', resultado.cached);
  }
}

main().catch(error => {
  console.error('❌ Erro:', error);
  process.exit(1);
});
