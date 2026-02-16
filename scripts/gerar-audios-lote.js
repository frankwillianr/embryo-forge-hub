/**
 * Script para gerar áudios em lote para todas as notícias
 *
 * Como usar:
 * 1. Configure as variáveis de ambiente no arquivo .env:
 *    - VITE_SUPABASE_URL
 *    - VITE_SUPABASE_ANON_KEY
 *
 * 2. Execute: node scripts/gerar-audios-lote.js
 */

import 'dotenv/config';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;
const BATCH_SIZE = 5; // Processar 5 notícias por vez
const DELAY_MS = 2000; // 2 segundos de delay entre lotes

if (!SUPABASE_URL || !ANON_KEY) {
  console.error('❌ Erro: Variáveis de ambiente não configuradas!');
  console.error('Configure VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no arquivo .env');
  process.exit(1);
}

// Função para buscar notícias sem áudio
async function buscarNoticiasSemAudio() {
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/rel_cidade_jornal?select=id,titulo,created_at&audio_url=is.null&order=created_at.desc`,
    {
      headers: {
        'apikey': ANON_KEY,
        'Authorization': `Bearer ${ANON_KEY}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Erro ao buscar notícias: ${response.statusText}`);
  }

  return response.json();
}

// Função para gerar áudio de uma notícia
async function gerarAudio(jornalId, titulo) {
  try {
    const response = await fetch(
      `${SUPABASE_URL}/functions/v1/generate-jornal-audio`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ jornalId }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Erro desconhecido');
    }

    return data;
  } catch (error) {
    console.error(`❌ Erro ao gerar áudio para "${titulo}":`, error.message);
    return null;
  }
}

// Função para delay
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Função principal
async function main() {
  console.log('🎵 Iniciando geração de áudios em lote...\n');

  // Buscar todas as notícias sem áudio
  console.log('📋 Buscando notícias sem áudio...');
  const noticias = await buscarNoticiasSemAudio();

  if (noticias.length === 0) {
    console.log('✅ Todas as notícias já têm áudio!');
    return;
  }

  console.log(`📊 Encontradas ${noticias.length} notícias sem áudio\n`);
  console.log(`⚙️  Processando em lotes de ${BATCH_SIZE} com delay de ${DELAY_MS}ms\n`);

  let processadas = 0;
  let sucesso = 0;
  let erros = 0;

  // Processar em lotes
  for (let i = 0; i < noticias.length; i += BATCH_SIZE) {
    const lote = noticias.slice(i, i + BATCH_SIZE);
    const loteNumero = Math.floor(i / BATCH_SIZE) + 1;
    const totalLotes = Math.ceil(noticias.length / BATCH_SIZE);

    console.log(`\n📦 Lote ${loteNumero}/${totalLotes} (${lote.length} notícias)`);
    console.log('─'.repeat(60));

    // Processar lote em paralelo
    const promises = lote.map(async (noticia, index) => {
      const numero = i + index + 1;
      console.log(`${numero}/${noticias.length} - Gerando: ${noticia.titulo.slice(0, 50)}...`);

      const resultado = await gerarAudio(noticia.id, noticia.titulo);

      if (resultado) {
        console.log(`  ✅ Sucesso: ${resultado.cached ? '[CACHE]' : '[NOVO]'} ${resultado.audioUrl.split('/').pop()}`);
        sucesso++;
      } else {
        erros++;
      }

      processadas++;
    });

    await Promise.all(promises);

    // Delay entre lotes (exceto no último)
    if (i + BATCH_SIZE < noticias.length) {
      console.log(`\n⏳ Aguardando ${DELAY_MS}ms antes do próximo lote...`);
      await sleep(DELAY_MS);
    }
  }

  // Resumo final
  console.log('\n' + '='.repeat(60));
  console.log('📊 RESUMO FINAL');
  console.log('='.repeat(60));
  console.log(`Total processadas: ${processadas}`);
  console.log(`✅ Sucesso: ${sucesso}`);
  console.log(`❌ Erros: ${erros}`);
  console.log(`📈 Taxa de sucesso: ${((sucesso / processadas) * 100).toFixed(1)}%`);
  console.log('='.repeat(60));
  console.log('\n🎉 Processamento concluído!');
}

// Executar
main().catch(error => {
  console.error('❌ Erro fatal:', error);
  process.exit(1);
});
