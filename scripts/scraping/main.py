"""
Pipeline de Ingestão de Notícias — Governador Valadares
Busca notícias via Google Search + scraping direto das fontes,
filtra por data/duplicata/imagem e insere no Supabase.
"""

import os
import re
import time
import random
import json
from datetime import datetime, date
from urllib.parse import urlencode, urlparse, quote_plus

import requests
from bs4 import BeautifulSoup
from supabase import create_client, Client
from dotenv import load_dotenv
from fake_useragent import UserAgent
from thefuzz import fuzz
import pytz

# ─── Ambiente ────────────────────────────────────────────────────────────────

load_dotenv()

SUPABASE_URL  = os.getenv("SUPABASE_URL", "")
SUPABASE_KEY  = os.getenv("SUPABASE_KEY", "")
GV_CIDADE_ID  = os.getenv("GV_CIDADE_ID", "")   # UUID fixo de Governador Valadares

if not SUPABASE_URL or not SUPABASE_KEY:
    raise EnvironmentError("SUPABASE_URL e SUPABASE_KEY são obrigatórios no .env")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# ─── Constantes ──────────────────────────────────────────────────────────────

BRT        = pytz.timezone("America/Sao_Paulo")
TODAY_DATE: date = datetime.now(BRT).date()

SEARCH_TERMS = [
    "notícias governador valadares hoje g1 vales",
    "diário do rio doce governador valadares hoje",
    "defato online governador valadares hoje",
    "jornal da cidade vales de minas hoje",
    "estado de minas governador valadares",
]

# Domínios preferidos — URLs desses domínios recebem prioridade
PRIORITY_DOMAINS = [
    "g1.globo.com/mg/vales-mg",
    "g1.globo.com",
    "drd.com.br",
    "defatoonline.com.br",
    "jornaldacidadevalesdeminas.com",
    "em.com.br",
    "horaregional.com.br",
]

# Jornais 100% locais de GV — dispensam checar "valadares" no texto
LOCAL_GV_DOMAINS = {
    "drd.com.br",
    "jornaldacidadevalesdeminas.com",
}

GV_RE          = re.compile(r'\b(governador valadares|valadares)\b', re.IGNORECASE)
OTHER_CITIES   = re.compile(
    r'\b(itabira|ipatinga|belo horizonte|caratinga|coronel fabriciano|'
    r'timoteo|timóteo|manhuacu|manhuaçu|inhapim|muriae|muriaé|ubai|ubaí|'
    r'teofilo otoni|teófilo otoni)\b',
    re.IGNORECASE
)
BLOCKED_TITLE  = re.compile(
    r'\b(arquivo|arquivos|feed|rss|404|edital|expediente|anuncie|publicidade|'
    r'whatsapp|telegram|instagram|facebook|twitter)\b',
    re.IGNORECASE
)
BLOCKED_IMG    = re.compile(
    r'(whatsapp|telegram|instagram|facebook|twitter|tiktok|youtube|linkedin|'
    r'logo|icon|avatar|spinner|loading|pixel|tracking|doubleclick|analytics|'
    r'banner|badge|placeholder|default)',
    re.IGNORECASE
)
BLOCKED_URL_EXT = re.compile(
    r'\.(png|jpe?g|gif|webp|svg|ico|js|css|pdf|mp4|mp3|zip|rar|exe|xml|json|'
    r'woff2?|ttf|eot)(\?.*)?$',
    re.IGNORECASE
)
BLOCKED_URL_SEG = re.compile(
    r'/(feed|rss|category|categoria|tag|wp-admin|wp-content|wp-includes|'
    r'author|autor|search|busca|page|pagina|xmlrpc)(?:/|$)',
    re.IGNORECASE
)

# ─── Sessão HTTP ─────────────────────────────────────────────────────────────

ua = UserAgent()

session = requests.Session()
session.headers.update({
    "User-Agent":      ua.random,
    "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
    "Accept":          "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
    "Connection":      "keep-alive",
})

# ─── Contadores ──────────────────────────────────────────────────────────────

stats = {
    "inseridas":           0,
    "antigas_rejeitadas":  0,
    "duplicadas_url":      0,
    "duplicadas_titulo":   0,
    "sem_imagens_validas": 0,
    "sem_conteudo":        0,
    "urls_invalidas":      0,
    "imagens_invalidas":   0,
    "erros":               [],
}

# ─── Helpers ─────────────────────────────────────────────────────────────────

def sleep_random(min_s: float = 1.5, max_s: float = 4.0) -> None:
    time.sleep(random.uniform(min_s, max_s))


def norm(s: str) -> str:
    """Normaliza string para comparações."""
    import unicodedata
    return unicodedata.normalize("NFD", s.lower()).encode("ascii", "ignore").decode()


def is_valid_url(url: str) -> bool:
    if not url.startswith("http"):
        return False
    if BLOCKED_URL_EXT.search(url):
        return False
    if BLOCKED_URL_SEG.search(url):
        return False
    if "#" in url:
        return False
    return True


def domain_of(url: str) -> str:
    return urlparse(url).netloc.lstrip("www.")


def is_priority_domain(url: str) -> bool:
    d = domain_of(url)
    return any(d == p or d.endswith("." + p) for p in PRIORITY_DOMAINS)


def is_local_gv(url: str) -> bool:
    d = domain_of(url)
    return d in LOCAL_GV_DOMAINS

# ─── Fase 1: Busca de URLs via Google Search ─────────────────────────────────

def search_google(query: str) -> list[str]:
    """Faz scraping do Google Search e retorna URLs de resultados orgânicos."""
    params = {"q": query, "hl": "pt-BR", "gl": "BR", "num": "20"}
    url = f"https://www.google.com/search?{urlencode(params)}"

    session.headers.update({
        "User-Agent": ua.random,
        "Referer":    "https://www.google.com/",
    })

    try:
        resp = session.get(url, timeout=15)
        resp.raise_for_status()
    except Exception as e:
        print(f"  ⚠️  Falha Google search '{query[:40]}': {e}")
        return []

    soup = BeautifulSoup(resp.text, "html.parser")
    links: list[str] = []

    # Google envolve resultados em <a href="/url?q=https://...">
    for a in soup.select("a[href]"):
        href = a["href"]
        # Extrai URL real do parâmetro q= do redirect do Google
        m = re.search(r'/url\?q=(https?://[^&]+)', href)
        if m:
            real_url = requests.utils.unquote(m.group(1))
            if is_valid_url(real_url) and is_priority_domain(real_url):
                links.append(real_url)

    return list(dict.fromkeys(links))  # dedup mantendo ordem


def collect_all_urls() -> list[str]:
    """Coleta URLs de todas as buscas, priorizando domínios relevantes."""
    all_urls: list[str] = []
    seen: set[str] = set()

    print(f"\n📡 Fase 1: Coletando URLs via Google Search ({len(SEARCH_TERMS)} buscas)")

    for term in SEARCH_TERMS:
        print(f"  🔍 Buscando: {term[:60]}…")
        urls = search_google(term)
        print(f"     → {len(urls)} URLs encontradas")
        for u in urls:
            if u not in seen:
                seen.add(u)
                all_urls.append(u)
        sleep_random(3, 7)

    print(f"  ✅ Total único: {len(all_urls)} URLs")
    return all_urls

# ─── Fase 2: Extração de dados do artigo ─────────────────────────────────────

DATE_PATTERNS = [
    # JSON-LD
    (re.compile(r'"datePublished"\s*:\s*"([^"]+)"'), None),
    (re.compile(r'"dateModified"\s*:\s*"([^"]+)"'),  None),
]

DATE_META_ATTRS = [
    ("article:published_time", "property"),
    ("article:modified_time",  "property"),
    ("datePublished",           "itemprop"),
    ("pubdate",                 "name"),
    ("date",                    "name"),
]

def extract_date(soup: BeautifulSoup, html: str) -> date | None:
    """Tenta extrair a data de publicação por múltiplos métodos."""
    candidates: list[str] = []

    # 1. Meta tags
    for attr_val, attr_name in DATE_META_ATTRS:
        tag = soup.find("meta", attrs={attr_name: attr_val})
        if tag and tag.get("content"):
            candidates.append(str(tag["content"]))

    # 2. JSON-LD via regex
    for pattern, _ in DATE_PATTERNS:
        for m in pattern.finditer(html):
            candidates.append(m.group(1))

    # 3. <time datetime="...">
    for tag in soup.select("time[datetime]"):
        candidates.append(str(tag["datetime"]))

    # Tentar parsear cada candidato
    for raw in candidates:
        for fmt in ("%Y-%m-%dT%H:%M:%S%z", "%Y-%m-%dT%H:%M:%S",
                    "%Y-%m-%d", "%d/%m/%Y", "%d/%m/%Y %H:%M"):
            try:
                dt = datetime.strptime(raw[:19], fmt[:len(raw[:19])])
                return dt.date()
            except ValueError:
                pass
        # ISO 8601 com timezone
        try:
            from dateutil import parser as dp
            return dp.parse(raw).astimezone(BRT).date()
        except Exception:
            pass

    return None


def extract_title(soup: BeautifulSoup, url: str) -> str:
    og = soup.find("meta", property="og:title")
    if og and og.get("content"):
        t = str(og["content"]).strip()
    else:
        h1 = soup.find("h1")
        t  = h1.get_text(strip=True) if h1 else ""
        if not t:
            title_tag = soup.find("title")
            t = title_tag.get_text(strip=True) if title_tag else ""

    # Remove sufixo do jornal (ex: "- Diário do Rio Doce")
    t = re.sub(r'\s*[|\-–—]\s*(G1|Globo|Diário do Rio Doce|Jornal da Cidade|DeFato|Estado de Minas).*$', '', t)
    return t.strip()


def extract_og_desc(soup: BeautifulSoup) -> str:
    for attr in (("property", "og:description"), ("name", "description")):
        tag = soup.find("meta", attrs={attr[0]: attr[1]})
        if tag and tag.get("content"):
            return str(tag["content"]).strip()
    return ""


ARTICLE_SELECTORS = [
    "article",
    "[itemprop='articleBody']",
    ".entry-content", ".post-content", ".article-body",
    ".materia-texto", ".corpo-texto", ".noticia-texto",
    ".content-text", ".article__body", ".post__content",
    "main",
]

def extract_body(soup: BeautifulSoup) -> str:
    """Extrai o corpo do artigo removendo lixo (nav, header, footer, aside)."""
    for tag in soup(["nav", "header", "footer", "aside", "script", "style",
                     "noscript", "iframe", "form", ".menu", ".sidebar",
                     ".advertisement", ".ads", ".related", ".comments"]):
        tag.decompose()

    for sel in ARTICLE_SELECTORS:
        container = soup.select_one(sel)
        if container:
            text = container.get_text(separator="\n", strip=True)
            if len(text) > 200:
                return text[:8000]

    return soup.get_text(separator="\n", strip=True)[:3000]


def extract_images(soup: BeautifulSoup, base_url: str) -> list[str]:
    """Extrai imagens do artigo priorizando og:image."""
    images: list[str] = []

    # 1. og:image / twitter:image — mais confiável
    for attr in (("property", "og:image"), ("name", "twitter:image")):
        tag = soup.find("meta", attrs={attr[0]: attr[1]})
        if tag and tag.get("content"):
            src = str(tag["content"]).strip()
            if src.startswith("http") and not BLOCKED_IMG.search(src):
                images.append(src)
                return images   # og:image é definitivo, não precisa mais

    # 2. Fallback: <img> no corpo do artigo
    for sel in ARTICLE_SELECTORS:
        container = soup.select_one(sel)
        if container:
            for img in container.find_all("img"):
                src = img.get("src") or img.get("data-src") or ""
                if not src or src.startswith("data:"):
                    continue
                if not src.startswith("http"):
                    src = base_url.rstrip("/") + "/" + src.lstrip("/")
                # Verifica dimensões mínimas
                try:
                    w = int(img.get("width", 0))
                    h = int(img.get("height", 0))
                    if (w and w < 150) or (h and h < 100):
                        continue
                except (ValueError, TypeError):
                    pass
                alt   = (img.get("alt") or "").lower()
                cls   = " ".join(img.get("class") or []).lower()
                if BLOCKED_IMG.search(src) or BLOCKED_IMG.search(alt) or BLOCKED_IMG.search(cls):
                    continue
                images.append(src)
            break

    return list(dict.fromkeys(images))


def validate_images(urls: list[str]) -> list[str]:
    """Faz HEAD request em cada imagem e mantém as válidas (>= 10 KB)."""
    valid: list[str] = []
    for url in urls[:5]:   # testa no máximo 5
        try:
            r = session.head(url, timeout=6, allow_redirects=True)
            if r.status_code == 200:
                length = int(r.headers.get("content-length", 0))
                if length == 0 or length >= 10_000:   # aceita se tamanho desconhecido
                    valid.append(url)
                else:
                    stats["imagens_invalidas"] += 1
            else:
                stats["imagens_invalidas"] += 1
        except Exception:
            stats["imagens_invalidas"] += 1
    return valid

# ─── Fase 3: Deduplicação + Inserção ─────────────────────────────────────────

def load_existing(cidade_id: str) -> tuple[set[str], list[str]]:
    """Carrega URLs e títulos dos últimos 7 dias do Supabase."""
    from datetime import timedelta
    cutoff = (datetime.now(BRT) - timedelta(days=7)).isoformat()
    resp = (
        supabase.table("rel_cidade_jornal")
        .select("id_externo, titulo")
        .eq("cidade_id", cidade_id)
        .gte("created_at", cutoff)
        .execute()
    )
    urls:   set[str]  = set()
    titles: list[str] = []
    for row in (resp.data or []):
        if row.get("id_externo"):
            urls.add(row["id_externo"])
        if row.get("titulo"):
            titles.append(row["titulo"])
    return urls, titles


def infer_category(titulo: str, descricao: str) -> str:
    text = norm(f"{titulo} {descricao}")
    if re.search(r'\b(policia|crime|preso|prisao|assalto|homicidio|furto|trafico)\b', text):
        return "policia"
    if re.search(r'\b(acidente|colisao|batida|atropelamento|capotamento)\b', text):
        return "acidente"
    if re.search(r'\b(politica|eleicao|vereador|prefeito|deputado|partido)\b', text):
        return "politica"
    if re.search(r'\b(saude|hospital|medico|vacina|doenca|sus)\b', text):
        return "saude"
    if re.search(r'\b(educacao|escola|universidade|vestibular|enem)\b', text):
        return "educacao"
    if re.search(r'\b(esporte|futebol|campeonato|atletismo|democrata)\b', text):
        return "esporte"
    if re.search(r'\b(economia|emprego|mercado|empresa|negocio|investimento)\b', text):
        return "economia"
    return "geral"

# ─── Processamento de cada artigo ────────────────────────────────────────────

def process_article(
    url:          str,
    existing_urls: set[str],
    existing_titles: list[str],
    cidade_id:    str,
) -> bool:
    """Processa um artigo e insere no Supabase se passar em todos os filtros.
    Retorna True se foi inserido."""

    # Filtro de URL básico
    if not is_valid_url(url):
        stats["urls_invalidas"] += 1
        return False

    # Dedup por URL
    if url in existing_urls:
        stats["duplicadas_url"] += 1
        print(f"  ✗ [dup URL] {url[:80]}")
        return False

    sleep_random(1.5, 3.5)

    # Fetch do artigo
    session.headers.update({"User-Agent": ua.random, "Referer": "https://www.google.com/"})
    try:
        resp = session.get(url, timeout=15)
        resp.raise_for_status()
        resp.encoding = resp.apparent_encoding
    except Exception as e:
        stats["erros"].append(f"{url}: {e}")
        print(f"  ⚠️  Erro ao buscar {url[:60]}: {e}")
        return False

    html = resp.text
    soup = BeautifulSoup(html, "html.parser")

    titulo  = extract_title(soup, url)
    og_desc = extract_og_desc(soup)
    body    = extract_body(soup)
    fonte   = domain_of(url)

    short = titulo[:55] + "…" if len(titulo) > 55 else titulo

    # Filtro de título
    if len(titulo) < 15:
        stats["urls_invalidas"] += 1
        print(f"  ✗ [título curto] {short}")
        return False
    if BLOCKED_TITLE.search(titulo):
        stats["urls_invalidas"] += 1
        print(f"  ✗ [bloqueado] {short}")
        return False
    if OTHER_CITIES.search(norm(titulo)):
        stats["urls_invalidas"] += 1
        print(f"  ✗ [outra cidade] {short}")
        return False

    # Filtro de data
    pub_date = extract_date(soup, html)
    if pub_date:
        from datetime import timedelta
        min_date = TODAY_DATE - timedelta(days=3)   # aceita últimos 4 dias
        if pub_date < min_date:
            stats["antigas_rejeitadas"] += 1
            print(f"  ✗ [antiga {pub_date}] {short}")
            return False

    # Filtro de conteúdo mínimo
    if len(og_desc) < 60 and len(body) < 100:
        stats["sem_conteudo"] += 1
        print(f"  ✗ [sem conteúdo] {short}")
        return False

    # Filtro de relevância GV (dispensado para jornais locais)
    if not is_local_gv(url):
        relevance_text = norm(f"{titulo} {og_desc} {body[:200]}")
        if not GV_RE.search(relevance_text):
            stats["urls_invalidas"] += 1
            print(f"  ✗ [irrelevante] {short}")
            return False

    # Dedup por título semântico
    for existing_title in existing_titles:
        similarity = fuzz.ratio(norm(titulo), norm(existing_title))
        if similarity > 80:
            stats["duplicadas_titulo"] += 1
            print(f"  ✗ [dup título {similarity}%] {short}")
            return False

    # Imagens
    raw_images  = extract_images(soup, url)
    valid_images = validate_images(raw_images)

    if not valid_images:
        stats["sem_imagens_validas"] += 1
        print(f"  ✗ [sem imagem] {short}")
        return False

    # Descrição final
    descricao       = body if len(body) >= 200 else og_desc
    descricao_curta = og_desc[:300] if og_desc else body[:300]

    # Categoria
    categoria = infer_category(titulo, descricao)

    # Inserir no Supabase
    payload = {
        "cidade_id":      cidade_id,
        "titulo":         titulo[:200],
        "descricao":      descricao,
        "descricao_curta": descricao_curta,
        "fonte":          fonte,
        "imagens":        valid_images,
        "id_externo":     url,
        "categoria":      categoria,
    }

    try:
        supabase.table("rel_cidade_jornal").insert(payload).execute()
        stats["inseridas"] += 1
        existing_urls.add(url)
        existing_titles.append(titulo)
        print(f"  ✓ Inserido: {short}")
        return True
    except Exception as e:
        stats["erros"].append(f"Insert failed {url}: {e}")
        print(f"  ✗ [erro insert] {short}: {e}")
        return False

# ─── Main ─────────────────────────────────────────────────────────────────────

def main() -> None:
    print("=" * 60)
    print("  PIPELINE DE INGESTÃO — GOVERNADOR VALADARES")
    print(f"  Data de referência: {TODAY_DATE.strftime('%d/%m/%Y')} (BRT)")
    print("=" * 60)

    # Obter cidade_id
    cidade_id = GV_CIDADE_ID
    if not cidade_id:
        print("🔍 Buscando cidade_id de GV no Supabase…")
        resp = supabase.table("cidades").select("id").eq("slug", "gv").single().execute()
        if not resp.data:
            raise RuntimeError("Cidade 'gv' não encontrada na tabela cidades")
        cidade_id = resp.data["id"]
    print(f"  cidade_id: {cidade_id}")

    # Carregar existentes
    print("\n📋 Carregando artigos existentes dos últimos 7 dias…")
    existing_urls, existing_titles = load_existing(cidade_id)
    print(f"   {len(existing_urls)} URLs | {len(existing_titles)} títulos em cache")

    # Coletar URLs
    all_urls = collect_all_urls()

    if not all_urls:
        print("\n⚠️  Nenhuma URL coletada. Encerrando.")
        print_report()
        return

    # Processar artigos
    print(f"\n⚙️  Fase 3: Processando {len(all_urls)} artigos…")
    for i, url in enumerate(all_urls, 1):
        print(f"\n[{i:03d}/{len(all_urls):03d}] {url[:90]}")
        process_article(url, existing_urls, existing_titles, cidade_id)

    print_report()


def print_report() -> None:
    print("\n" + "=" * 52)
    print("  RELATÓRIO DE EXECUÇÃO — INGESTÃO DE NOTÍCIAS")
    print(f"  Data Processada: {TODAY_DATE.strftime('%Y-%m-%d')}")
    print("=" * 52)
    print(f"  Notícias Inseridas com Sucesso    : {stats['inseridas']}")
    print(f"  Rejeitadas (Data Antiga)           : {stats['antigas_rejeitadas']}")
    print(f"  Rejeitadas (Duplicata de URL)      : {stats['duplicadas_url']}")
    print(f"  Rejeitadas (Duplicata Semântica)   : {stats['duplicadas_titulo']}")
    print(f"  Rejeitadas (Sem Imagens Válidas)   : {stats['sem_imagens_validas']}")
    print(f"  Rejeitadas (Sem Conteúdo)          : {stats['sem_conteudo']}")
    print(f"  Rejeitadas (URL Inválida/Outra)    : {stats['urls_invalidas']}")
    print(f"  Imagens Inválidas (HTTP ≠ 200)     : {stats['imagens_invalidas']}")
    if stats["erros"]:
        print(f"\n  Erros ({len(stats['erros'])}):")
        for e in stats["erros"][:10]:
            print(f"    - {e[:100]}")
    print("=" * 52)


if __name__ == "__main__":
    main()
