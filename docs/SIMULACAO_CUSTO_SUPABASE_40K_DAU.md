# Simulação de custo Supabase – 40 mil acessos diários

Estimativa com base na **estrutura atual do projeto** (queries na Home, auth, hooks). Nenhum código foi alterado.

---

## 1. Chamadas ao Supabase por carregamento da Home (1 sessão)

Cada abertura da Home dispara várias queries em paralelo (React Query). Contagem por componente:

| Origem | Chamadas (from/auth) | Observação |
|--------|----------------------|------------|
| CidadePage | 1 | `cidade` (select por slug) |
| useAuth | 1 getSession + 1 profiles (se logado) | 1x por app load |
| Banners (HomeSection) | 4 | cidade, rel_cidade_banner, rel_banner_dias, banner |
| JornalHorizontalList | 2 | cidade, rel_cidade_jornal |
| ServicosSection | 2 | cidade, rel_cidade_servico_empresa |
| AloPrefeituraHorizontalList | 3 | cidade, rel_cidade_alo_prefeitura, imagens |
| CinemaHorizontalList | 2 | cidade, rel_cidade_cinema |
| EventosSection | 2 | cidade, rel_cidade_eventos |
| OfertasSection | 2 | cidade, rel_cidade_servico_empresa |

**Total por carga completa da Home:** ~19 (anônimo) a ~21 (logado).

A tabela `cidade` é lida várias vezes por sessão (cada seção usa um `queryKey` diferente), então não há deduplicação hoje.

---

## 2. Premissas para 40k DAU

- **Sessões por dia:** 40k usuários × 2,5 aberturas/dia = **100 mil cargas de Home/dia** (ordem de grandeza).
- **Requisições PostgREST/dia:** 100k × 20 ≈ **2 milhões/dia**. No plano **Pro** o Supabase não cobra por número de API requests (ilimitado).
- **MAU (Monthly Active Users):** 40k DAU pode gerar entre **80k e 120k MAU** (mesma base voltando). O plano **Pro** inclui **100k MAU**; acima disso há overage (ex.: ~US$ 0,00325 por MAU extra).
- **Bandwidth (egress):** Respostas JSON. Estimativa ~2 KB por request × 20 ≈ **40 KB por sessão**. 100k × 40 KB = 4 GB/dia ≈ **120 GB/mês** só Home. Somando auth, outras telas e listagens: **150–200 GB/mês**. Pro inclui **250 GB**; excedente ~US$ 0,09/GB.
- **Storage:** Imagens (banners, avatares) no Storage; impacto depende do uso. Assumindo uso moderado, tende a ficar dentro dos 100 GB do Pro.
- **Edge Functions:** Uso pontual (email, pagamento); impacto baixo no custo.

---

## 3. Cenários de custo mensal (ordem de grandeza)

| Cenário | MAU | Egress | Custo estimado (Pro) |
|---------|-----|--------|----------------------|
| **Conservador** | 80k | 180 GB | **~US$ 25** (tudo dentro da cota) |
| **Médio** | 120k | 220 GB | **~US$ 25 + ~US$ 65 (20k MAU overage) ≈ US$ 90** |
| **Alto** | 200k | 300 GB | **~US$ 25 + ~US$ 325 (100k MAU) + ~US$ 4,5 (50 GB egress) ≈ US$ 355** |

Valores em dólar (Supabase cobra em USD).  
Conversão aproximada: US$ 25 ≈ R$ 125; US$ 90 ≈ R$ 450; US$ 355 ≈ R$ 1.775 (varia com câmbio).

---

## 4. Conclusão

- Com **40k DAU**, no cenário em que a base é engajada (mesma base voltando, MAU em torno de 80k–100k) e o tráfego fica perto de 200 GB/mês, o custo tende a ficar **no Pro (US$ 25/mês)** ou **um pouco acima (overage de MAU**, na faixa de **US$ 65–90/mês)**.
- Fica **bem mais caro** se os 40k acessos diários forem de **muitos usuários únicos** (MAU alto) ou se houver **muito egress** (ex.: muitas imagens pesadas servidas pelo Supabase).

---

## 5. Otimizações recomendadas (para quando escalar)

1. **Cache de `cidade` compartilhado** – Usar o mesmo `queryKey` para cidade em todos os componentes (ou um contexto) para reduzir leituras repetidas da mesma tabela.
2. **Aumentar `staleTime` no React Query** – Para dados que mudam pouco (cidade, categorias), reduz refetch e tráfego.
3. **Servir imagens por CDN** – Storage com cache longo ou CDN na frente para reduzir egress do Supabase.
4. **Monitorar no dashboard** – Acompanhar MAU e egress no Supabase para antecipar overage.
