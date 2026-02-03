import DynamicBanner from "@/components/DynamicBanner";

const Home = () => {
  return (
    <div className="space-y-4">
      <DynamicBanner />
      
      {/* Placeholder for more content */}
      <div className="px-4 text-center py-8 text-muted-foreground">
        <p>Conteúdo da cidade virá aqui</p>
      </div>
    </div>
  );
};

export default Home;
