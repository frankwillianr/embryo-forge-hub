import AloPrefeituraHorizontalList from "@/components/aloPrefeitura/AloPrefeituraHorizontalList";

interface AloPrefeituraSectionProps {
  cidadeSlug?: string;
}

const AloPrefeituraSection = ({ cidadeSlug }: AloPrefeituraSectionProps) => {
  return <AloPrefeituraHorizontalList cidadeSlug={cidadeSlug} />;
};

export default AloPrefeituraSection;
