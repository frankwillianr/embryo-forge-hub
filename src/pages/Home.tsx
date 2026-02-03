import DynamicBanner from "@/components/DynamicBanner";

const Home = () => {
  return (
    <div className="p-4 space-y-4">
      <DynamicBanner />
      
      {/* Placeholder for more content */}
      <div className="text-center py-8 text-muted-foreground">
        <p>Conteúdo da cidade virá aqui</p>
      </div>
    </div>
  );
};

export default Home;
