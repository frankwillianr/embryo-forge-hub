import AloPrefeituraVerticalList from "@/components/aloPrefeitura/AloPrefeituraVerticalList";

interface AloPrefeituraSectionProps {
  cidadeSlug?: string;
}

const AloPrefeituraSection = ({ cidadeSlug }: AloPrefeituraSectionProps) => {
  return <AloPrefeituraVerticalList cidadeSlug={cidadeSlug} />;
};

export default AloPrefeituraSection;
