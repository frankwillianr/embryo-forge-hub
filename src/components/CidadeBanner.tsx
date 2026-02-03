interface CidadeBannerProps {
  bannerUrl?: string | null;
  cidadeNome?: string;
}

const CidadeBanner = ({ bannerUrl, cidadeNome }: CidadeBannerProps) => {
  if (!bannerUrl) {
    return (
      <div className="aspect-[16/9] w-full bg-muted flex items-center justify-center">
        <p className="text-muted-foreground text-sm">Sem banner</p>
      </div>
    );
  }

  return (
    <div className="relative w-full">
      <div className="aspect-[16/9] w-full">
        <img
          src={bannerUrl}
          alt={cidadeNome || "Banner da cidade"}
          className="w-full h-full object-cover"
        />
      </div>
    </div>
  );
};

export default CidadeBanner;
