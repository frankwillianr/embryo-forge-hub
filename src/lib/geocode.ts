/**
 * Geocodifica um endereço no Brasil usando Nominatim (OpenStreetMap).
 * Retorna latitude e longitude para salvar no banco e exibir no mapa.
 */
const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const USER_AGENT = "EmbryoForgeHub/1.0 (contato@app.local)";

export type GeocodeResult = { latitude: number; longitude: number } | null;

export async function geocodeEndereco(params: {
  cep?: string;
  rua?: string;
  numero?: string;
  bairro?: string;
  cidade?: string;
  estado?: string;
}): Promise<GeocodeResult> {
  const { cep, rua, numero, bairro, cidade, estado = "MG" } = params;

  const parts: string[] = [];
  if (rua?.trim()) {
    if (numero?.trim()) parts.push(`${rua.trim()}, ${numero.trim()}`);
    else parts.push(rua.trim());
  }
  if (bairro?.trim()) parts.push(bairro.trim());
  if (cidade?.trim()) parts.push(cidade.trim());
  if (estado) parts.push(estado);
  parts.push("Brasil");

  const cepLimpo = cep?.replace(/\D/g, "") ?? "";
  const temEndereco = rua?.trim() || bairro?.trim() || cidade?.trim();
  const query = temEndereco
    ? parts.join(", ")
    : cepLimpo.length === 8
      ? `${cepLimpo.slice(0, 5)}-${cepLimpo.slice(5)}, Brasil`
      : "";

  if (!query || query === "Brasil") return null;

  try {
    const url = new URL(NOMINATIM_URL);
    url.searchParams.set("q", query);
    url.searchParams.set("format", "json");
    url.searchParams.set("limit", "1");
    url.searchParams.set("countrycodes", "br");

    const res = await fetch(url.toString(), {
      headers: { "User-Agent": USER_AGENT },
    });
    if (!res.ok) return null;

    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) return null;

    const lat = parseFloat(data[0].lat);
    const lon = parseFloat(data[0].lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;

    return { latitude: lat, longitude: lon };
  } catch {
    return null;
  }
}
