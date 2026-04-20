import veiculosIcon from "@/assets/icons/veiculos.png";
import desapegaIcon from "@/assets/icons/desapega.png";
import entregadorIcon from "@/assets/icons/entregador.png";
import salaoIcon from "@/assets/icons/salao.png";
import reparosIcon from "@/assets/icons/reparos.png";
import limpezaIcon from "@/assets/icons/limpeza.png";
import petIcon from "@/assets/icons/pet.png";
import obrasIcon from "@/assets/icons/obras.png";

export type ServicoSubcategoria = {
  id?: string;
  categoria_id?: string;
  slug: string;
  nome: string;
  emoji?: string | null;
  icon_key?: string | null;
  ordem: number;
  ativo: boolean;
};

export type ServicoCategoria = {
  id?: string;
  slug: string;
  titulo: string;
  emoji: string;
  ordem: number;
  ativo: boolean;
  categorias_banco: string[];
  subcategorias: ServicoSubcategoria[];
};

type BaseSubcategoria = Omit<ServicoSubcategoria, "ordem" | "ativo"> & {
  ordem?: number;
  ativo?: boolean;
};

type BaseCategoria = Omit<ServicoCategoria, "ordem" | "ativo" | "subcategorias"> & {
  ordem?: number;
  ativo?: boolean;
  subcategorias: BaseSubcategoria[];
};

const withDefaults = (categorias: BaseCategoria[]): ServicoCategoria[] => {
  return categorias.map((categoria, categoriaIndex) => ({
    ...categoria,
    ordem: categoria.ordem ?? categoriaIndex,
    ativo: categoria.ativo ?? true,
    subcategorias: categoria.subcategorias.map((subcategoria, subcategoriaIndex) => ({
      ...subcategoria,
      ordem: subcategoria.ordem ?? subcategoriaIndex,
      ativo: subcategoria.ativo ?? true,
    })),
  }));
};

export const SERVICO_ICON_KEY_TO_ASSET: Record<string, string> = {
  veiculos: veiculosIcon,
  desapega: desapegaIcon,
  entregador: entregadorIcon,
  salao: salaoIcon,
  reparos: reparosIcon,
  limpeza: limpezaIcon,
  pet: petIcon,
  obras: obrasIcon,
};

export const ICONIFY_ICON_KEY_PREFIX = "iconify:";
export const FLUENT3D_ICON_KEY_PREFIX = "fluent3d:";

export const isIconifyIconKey = (iconKey?: string | null) =>
  !!iconKey && iconKey.startsWith(ICONIFY_ICON_KEY_PREFIX);

export const isFluent3dIconKey = (iconKey?: string | null) =>
  !!iconKey && iconKey.startsWith(FLUENT3D_ICON_KEY_PREFIX);

export const toIconifyIconKey = (iconName: string) =>
  `${ICONIFY_ICON_KEY_PREFIX}${iconName.trim()}`;

export const toFluent3dIconKey = (iconName: string) =>
  `${FLUENT3D_ICON_KEY_PREFIX}${iconName.trim()}`;

export const getIconifyNameFromKey = (iconKey?: string | null) =>
  isIconifyIconKey(iconKey) ? iconKey!.slice(ICONIFY_ICON_KEY_PREFIX.length) : "";

export const getFluent3dNameFromKey = (iconKey?: string | null) =>
  isFluent3dIconKey(iconKey) ? iconKey!.slice(FLUENT3D_ICON_KEY_PREFIX.length) : "";

export const getServicoAssetByIconKey = (iconKey?: string | null) =>
  iconKey ? SERVICO_ICON_KEY_TO_ASSET[iconKey] : undefined;

export const DEFAULT_SERVICO_CATEGORIAS: ServicoCategoria[] = withDefaults([
  {
    slug: "bares",
    titulo: "Bares e Restaurantes",
    emoji: "🍽️",
    categorias_banco: ["bares", "bar", "restaurantes", "lanchonete", "pizzaria", "hamburgueria", "sushi", "cafeteria"],
    subcategorias: [
      { slug: "restaurantes", nome: "Restaurantes", emoji: "🍽️" },
      { slug: "bares", nome: "Bares", emoji: "🍻" },
      { slug: "lanchonete", nome: "Lanchonete", emoji: "🍔" },
      { slug: "pizzaria", nome: "Pizzaria", emoji: "🍕" },
      { slug: "hamburgueria", nome: "Hamburgueria", emoji: "🍟" },
      { slug: "sushi", nome: "Sushi", emoji: "🍣" },
      { slug: "cafeteria", nome: "Cafeteria", emoji: "☕" },
      { slug: "doceria", nome: "Doceria", emoji: "🍰" },
    ],
  },
  {
    slug: "beleza",
    titulo: "Beleza",
    emoji: "💇",
    categorias_banco: ["salao", "barbeiro", "manicure", "estetica", "maquiagem", "sobrancelha", "depilacao", "cosmeticos"],
    subcategorias: [
      { slug: "salao", nome: "Salão", icon_key: "salao" },
      { slug: "barbeiro", nome: "Barbeiro", emoji: "💈" },
      { slug: "manicure", nome: "Manicure", emoji: "💅" },
      { slug: "estetica", nome: "Estética", emoji: "✨" },
      { slug: "maquiagem", nome: "Maquiagem", emoji: "💄" },
      { slug: "sobrancelha", nome: "Sobrancelha", emoji: "🪮" },
      { slug: "depilacao", nome: "Depilação", emoji: "🌸" },
      { slug: "cosmeticos", nome: "Cosméticos", emoji: "💄" },
    ],
  },
  {
    slug: "servicos",
    titulo: "Serviços",
    emoji: "🛠️",
    categorias_banco: ["reparos", "eletricista", "encanador", "obras", "limpeza", "dedetizacao", "chaveiro", "pintor", "marceneiro", "serralheria", "vidraceiro", "ar-condicionado", "jardinagem", "mudancas", "diarista", "costura"],
    subcategorias: [
      { slug: "reparos", nome: "Reparos", icon_key: "reparos" },
      { slug: "eletricista", nome: "Eletricista", emoji: "⚡" },
      { slug: "encanador", nome: "Encanador", emoji: "🚿" },
      { slug: "obras", nome: "Obras", icon_key: "obras" },
      { slug: "limpeza", nome: "Limpeza", icon_key: "limpeza" },
      { slug: "dedetizacao", nome: "Dedetização", emoji: "🪲" },
      { slug: "chaveiro", nome: "Chaveiro", emoji: "🔑" },
      { slug: "pintor", nome: "Pintor", emoji: "🎨" },
      { slug: "marceneiro", nome: "Marceneiro", emoji: "🪑" },
      { slug: "serralheria", nome: "Serralheria", emoji: "⚙️" },
      { slug: "vidraceiro", nome: "Vidraceiro", emoji: "🪟" },
      { slug: "ar-condicionado", nome: "Ar Cond.", emoji: "❄️" },
      { slug: "jardinagem", nome: "Jardinagem", emoji: "🌳" },
      { slug: "mudancas", nome: "Mudanças", emoji: "🚚" },
      { slug: "diarista", nome: "Diarista", emoji: "🏠" },
      { slug: "costura", nome: "Costura", emoji: "🧵" },
    ],
  },
  {
    slug: "profissionais",
    titulo: "Profissionais",
    emoji: "👔",
    categorias_banco: ["advogado", "contador", "despachante", "engenheiro", "arquiteto", "corretor", "fotografo", "aulas", "idiomas", "informatica", "eventos"],
    subcategorias: [
      { slug: "advogado", nome: "Advogado", emoji: "⚖️" },
      { slug: "contador", nome: "Contador", emoji: "📊" },
      { slug: "despachante", nome: "Despachante", emoji: "📄" },
      { slug: "engenheiro", nome: "Engenheiro", emoji: "🏗️" },
      { slug: "arquiteto", nome: "Arquiteto", emoji: "📐" },
      { slug: "corretor", nome: "Corretor", emoji: "🏡" },
      { slug: "fotografo", nome: "Fotógrafo", emoji: "📷" },
      { slug: "aulas", nome: "Aulas", emoji: "📚" },
      { slug: "idiomas", nome: "Idiomas", emoji: "🌎" },
      { slug: "informatica", nome: "Informática", emoji: "💻" },
      { slug: "eventos", nome: "Eventos", emoji: "🎉" },
    ],
  },
  {
    slug: "saude",
    titulo: "Saúde",
    emoji: "🏥",
    categorias_banco: ["clinica", "dentista", "psicologo", "fisioterapeuta", "nutricionista", "personal", "academia", "massagista", "farmacia"],
    subcategorias: [
      { slug: "clinica", nome: "Clínica", emoji: "🏥" },
      { slug: "dentista", nome: "Dentista", emoji: "🦷" },
      { slug: "psicologo", nome: "Psicólogo", emoji: "🧠" },
      { slug: "fisioterapeuta", nome: "Fisio", emoji: "🦴" },
      { slug: "nutricionista", nome: "Nutrição", emoji: "🍎" },
      { slug: "personal", nome: "Personal", emoji: "🏋️" },
      { slug: "academia", nome: "Academia", emoji: "💪" },
      { slug: "massagista", nome: "Massagem", emoji: "💆" },
      { slug: "farmacia", nome: "Farmácia", emoji: "💊" },
    ],
  },
  {
    slug: "comercio",
    titulo: "Comércio",
    emoji: "🛍️",
    categorias_banco: ["desapega", "lojas", "promocoes", "restaurantes", "entregador", "moda", "eletronicos"],
    subcategorias: [
      { slug: "desapega", nome: "Marketplace local", icon_key: "desapega" },
      { slug: "lojas", nome: "Lojas", emoji: "🏪" },
      { slug: "promocoes", nome: "Promoções", emoji: "🏷️" },
      { slug: "restaurantes", nome: "Restaurantes", emoji: "🍽️" },
      { slug: "entregador", nome: "Delivery", icon_key: "entregador" },
      { slug: "moda", nome: "Moda", emoji: "👗" },
      { slug: "eletronicos", nome: "Eletrônicos", emoji: "📱" },
    ],
  },
  {
    slug: "veiculos",
    titulo: "Veículos",
    emoji: "🚗",
    categorias_banco: ["mecanico", "lava-jato", "auto-pecas", "guincho", "funilaria", "borracharia", "vistoria", "motorista"],
    subcategorias: [
      { slug: "mecanico", nome: "Mecânico", emoji: "🔧" },
      { slug: "lava-jato", nome: "Lava Jato", emoji: "🚿" },
      { slug: "auto-pecas", nome: "Auto Peças", emoji: "⚙️" },
      { slug: "guincho", nome: "Guincho", emoji: "🏗️" },
      { slug: "funilaria", nome: "Funilaria", emoji: "🔨" },
      { slug: "borracharia", nome: "Borracharia", emoji: "🔄" },
      { slug: "vistoria", nome: "Vistoria", emoji: "📋" },
      { slug: "motorista", nome: "Motorista", emoji: "🚙" },
    ],
  },
  {
    slug: "pets",
    titulo: "Pets",
    emoji: "🐶",
    categorias_banco: ["veterinario", "pet", "petshop", "adestrador", "hotel-pet", "passeador"],
    subcategorias: [
      { slug: "veterinario", nome: "Veterinário", emoji: "🩺" },
      { slug: "pet", nome: "Banho e Tosa", icon_key: "pet" },
      { slug: "petshop", nome: "Pet Shop", emoji: "🐾" },
      { slug: "adestrador", nome: "Adestrador", emoji: "🐕" },
      { slug: "hotel-pet", nome: "Hotel Pet", emoji: "🏨" },
      { slug: "passeador", nome: "Passeador", emoji: "🐕" },
    ],
  },
]);

export const DEFAULT_SERVICOS_AUTOCOMPLETE_EXTRAS = [
  { id: "veiculos", nome: "Veículos" },
  { id: "desapega", nome: "Marketplace local" },
  { id: "influenciadores", nome: "Influenciadores" },
  { id: "entregador", nome: "Entregador / Delivery" },
];

export const slugifyValue = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
