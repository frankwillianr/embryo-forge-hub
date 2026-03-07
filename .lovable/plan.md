

## Problem

Sources marked as `localGV: true` (Diário do Rio Doce, Jornal da Cidade) bypass the relevance filter that checks for "Valadares" in the text. However, these sites also publish national news (Toffoli/STF, Flamengo, Ancelotti, etc.) that have no connection to Governador Valadares.

## Solution

Add a **national news filter** for `localGV: true` sources. Instead of requiring "Valadares" in the text, detect clearly national/generic articles and reject them unless they also mention something local.

### Changes in `supabase/functions/coletar-noticias-gv/index.ts`:

1. **Add a `NATIONAL_KEYWORDS_RE`** regex matching national-only topics (STF, Supremo, Senado, Congresso, Planalto, Brasília, seleção brasileira, Copa do Mundo, etc.) and well-known national figures/teams that have no GV connection.

2. **Update the relevance filter** (lines 488-492): For `localGV: true` sources, if the article matches `NATIONAL_KEYWORDS_RE` **and** does NOT mention "valadares" anywhere, reject it with a `[nacional]` tag. This way:
   - Local news from DRD/Jornal da Cidade that doesn't say "Valadares" explicitly → **kept** (as before)
   - National news like "Toffoli nega..." or "Ancelotti prevê..." → **rejected** (new filter)
   - National news that has a local angle mentioning Valadares → **kept**

3. **Add national keywords regex**:
```
/\b(stf|supremo tribunal|senado|congresso|planalto|brasilia|presidente lula|presidente da republica|selecao brasileira|copa do mundo|flamengo|corinthians|palmeiras|sao paulo fc|vasco|botafogo|fluminense|internacional|gremio|cruzeiro|atletico.mg|santos|ancelotti|toffoli|lula|bolsonaro|moraes|barroso)\b/i
```

4. **Update the `AdminCidadeScraping.tsx`** component to reflect the updated sources config isn't needed (it already matches).

### Deployment

After editing the Edge Function, it must be redeployed via CLI or GitHub push for changes to take effect.

