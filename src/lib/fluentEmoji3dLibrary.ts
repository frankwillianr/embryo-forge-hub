import { FLUENT_EMOJI_3D_SLUGS } from "@/data/fluentEmoji3dSlugs";

export type FluentEmoji3dItem = {
  slug: string;
  label: string;
  src: string;
};

const FLUENT_EMOJI_3D_BASE_URL =
  "https://cdn.jsdelivr.net/npm/fluentui-emoji@1.3.0/icons/modern";

const slugToLabel = (slug: string) => {
  const cleaned = slug
    .replace(/-/g, " ")
    .replace(/\b\d+\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return slug;
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
};

export const getFluentEmoji3dSrc = (slug: string) =>
  `${FLUENT_EMOJI_3D_BASE_URL}/${encodeURIComponent(slug)}.svg`;

export const FLUENT_EMOJI_3D_LIBRARY: FluentEmoji3dItem[] = FLUENT_EMOJI_3D_SLUGS.map(
  (slug) => ({
    slug,
    label: slugToLabel(slug),
    src: getFluentEmoji3dSrc(slug),
  }),
);

export const FLUENT_EMOJI_3D_BY_SLUG = new Map(
  FLUENT_EMOJI_3D_LIBRARY.map((item) => [item.slug, item.src]),
);
