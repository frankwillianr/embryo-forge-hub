import CinemaList from "@/components/cinema/CinemaList";

interface CinemaSectionProps {
  cidadeSlug?: string;
}

const CinemaSection = ({ cidadeSlug }: CinemaSectionProps) => {
  return <CinemaList cidadeSlug={cidadeSlug} />;
};

export default CinemaSection;
