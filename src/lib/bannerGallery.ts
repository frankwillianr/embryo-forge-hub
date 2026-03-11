import { supabase } from "@/integrations/supabase/client";

type GalleryRow = {
  id?: string;
  banner_id: string;
  imagem_url: string;
  ordem: number;
};

type TableName = "banner_imagens" | "banner_imagem";

let cachedTableName: TableName | null = null;

const isMissingTable = (error: any) =>
  error?.code === "42P01" ||
  typeof error?.message === "string" && error.message.toLowerCase().includes("does not exist");

const detectGalleryTable = async (): Promise<TableName> => {
  if (cachedTableName) return cachedTableName;

  const tryPlural = await supabase.from("banner_imagens").select("id").limit(1);
  if (!tryPlural.error) {
    cachedTableName = "banner_imagens";
    return cachedTableName;
  }

  const trySingular = await supabase.from("banner_imagem").select("id").limit(1);
  if (!trySingular.error) {
    cachedTableName = "banner_imagem";
    return cachedTableName;
  }

  throw new Error(
    `Tabela de galeria de banner não encontrada. Erros: plural=${tryPlural.error?.message || "-"} | singular=${trySingular.error?.message || "-"}`,
  );
};

export const fetchBannerGallery = async (bannerId: string) => {
  const table = await detectGalleryTable();
  const { data, error } = await supabase
    .from(table)
    .select("*")
    .eq("banner_id", bannerId)
    .order("ordem", { ascending: true });

  if (error) throw error;
  return data || [];
};

export const replaceBannerGallery = async (bannerId: string, imagemUrls: string[]) => {
  const table = await detectGalleryTable();

  const { error: deleteError } = await supabase
    .from(table)
    .delete()
    .eq("banner_id", bannerId);

  if (deleteError) throw deleteError;

  if (imagemUrls.length === 0) return;

  const rows: GalleryRow[] = imagemUrls.map((url, index) => ({
    banner_id: bannerId,
    imagem_url: url,
    ordem: index,
  }));

  const { error: insertError } = await supabase.from(table).insert(rows);
  if (insertError) throw insertError;
};

export const insertBannerGallery = async (bannerId: string, imagemUrls: string[]) => {
  if (imagemUrls.length === 0) return;
  const table = await detectGalleryTable();
  const rows: GalleryRow[] = imagemUrls.map((url, index) => ({
    banner_id: bannerId,
    imagem_url: url,
    ordem: index,
  }));
  const { error } = await supabase.from(table).insert(rows);
  if (error) throw error;
};

export const clearBannerGalleryTableCache = () => {
  cachedTableName = null;
};
