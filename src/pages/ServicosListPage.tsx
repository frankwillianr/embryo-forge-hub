import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import servicosBanner from "@/assets/servicos-banner.jpg";

// Import icons
import veiculosIcon from "@/assets/icons/veiculos.png";
import desapegaIcon from "@/assets/icons/desapega.png";
import entregadorIcon from "@/assets/icons/entregador.png";
import salaoIcon from "@/assets/icons/salao.png";
import reparosIcon from "@/assets/icons/reparos.png";
import limpezaIcon from "@/assets/icons/limpeza.png";
import petIcon from "@/assets/icons/pet.png";
import obrasIcon from "@/assets/icons/obras.png";

const categorias = [
  // Destaques
  { id: "veiculos", nome: "Veículos", icon: veiculosIcon },
  { id: "desapega", nome: "Desapega", icon: desapegaIcon },
  
  // Entregas e transporte
  { id: "entregador", nome: "Entregador", icon: entregadorIcon },
  { id: "motorista", nome: "Motorista", emoji: "🚙" },
  { id: "mudancas", nome: "Mudanças", emoji: "🚚" },
  
  // Beleza e estética
  { id: "salao", nome: "Salão", icon: salaoIcon },
  { id: "manicure", nome: "Manicure", emoji: "💅" },
  { id: "barbeiro", nome: "Barbeiro", emoji: "💈" },
  
  // Casa e reparos
  { id: "reparos", nome: "Reparos", icon: reparosIcon },
  { id: "eletricista", nome: "Eletricista", emoji: "⚡" },
  { id: "encanador", nome: "Encanador", emoji: "🚿" },
  { id: "pintor", nome: "Pintor", emoji: "🎨" },
  { id: "chaveiro", nome: "Chaveiro", emoji: "🔑" },
  { id: "vidraceiro", nome: "Vidraceiro", emoji: "🪟" },
  
  // Limpeza e organização
  { id: "limpeza", nome: "Limpeza", icon: limpezaIcon },
  { id: "diarista", nome: "Diarista", emoji: "🏠" },
  { id: "dedetizacao", nome: "Dedetização", emoji: "🪲" },
  
  // Construção
  { id: "obras", nome: "Obras", icon: obrasIcon },
  { id: "serralheria", nome: "Serralheria", emoji: "⚙️" },
  { id: "marceneiro", nome: "Marceneiro", emoji: "🪑" },
  
  // Jardim
  { id: "jardinagem", nome: "Jardinagem", emoji: "🌳" },
  
  // Pet
  { id: "pet", nome: "Pet", icon: petIcon },
  
  // Tecnologia
  { id: "informatica", nome: "Informática", emoji: "💻" },
  { id: "ar-condicionado", nome: "Ar Cond.", emoji: "❄️" },
  
  // Saúde e bem-estar
  { id: "personal", nome: "Personal", emoji: "🏋️" },
  { id: "nutricionista", nome: "Nutrição", emoji: "🍎" },
  { id: "massagista", nome: "Massagem", emoji: "💆" },
  
  // Educação e eventos
  { id: "aulas", nome: "Aulas", emoji: "📚" },
  { id: "fotografo", nome: "Fotógrafo", emoji: "📷" },
  { id: "eventos", nome: "Eventos", emoji: "🎉" },
  
  // Outros
  { id: "costura", nome: "Costura", emoji: "🧵" },
];

const ServicosListPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");

  const filteredCategorias = categorias.filter((cat) =>
    cat.nome.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleClick = (servicoId: string) => {
    if (servicoId === "veiculos") {
      navigate(`/cidade/${slug}/veiculos`);
    } else if (servicoId === "desapega") {
      navigate(`/cidade/${slug}/desapega`);
    } else {
      navigate(`/cidade/${slug}/servicos/${servicoId}`);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 flex items-center gap-3 p-4 border-b border-border bg-card">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate(`/cidade/${slug}`)}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-lg font-semibold text-foreground">Serviços</h1>
      </header>

      {/* Banner Hero */}
      <div className="relative h-40 overflow-hidden">
        <img
          src={servicosBanner}
          alt="Serviços"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
        <div className="absolute bottom-3 left-4 right-4">
          <p className="text-xs text-muted-foreground">Encontre</p>
          <h2 className="text-lg font-bold text-foreground">Todos os Serviços</h2>
        </div>
      </div>

      {/* Search */}
      <div className="p-4 border-b border-border bg-card/50">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar serviço..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Grid de categorias */}
      <main className="flex-1 p-4">
        {filteredCategorias.length > 0 ? (
          <div className="grid grid-cols-4 gap-2">
            {filteredCategorias.map((cat) => (
              <button
                key={cat.id}
                onClick={() => handleClick(cat.id)}
                className="flex flex-col items-center justify-center bg-muted/60 hover:bg-muted rounded-xl py-2.5 px-2 transition-all active:scale-95 group"
              >
                {cat.icon ? (
                  <img 
                    src={cat.icon} 
                    alt={cat.nome}
                    className="w-10 h-10 mb-1 group-hover:scale-110 transition-transform object-contain mix-blend-multiply dark:mix-blend-screen dark:invert"
                  />
                ) : (
                  <span className="text-2xl mb-1 group-hover:scale-110 transition-transform">
                    {cat.emoji}
                  </span>
                )}
                <span className="text-[10px] font-medium text-foreground text-center leading-tight">
                  {cat.nome}
                </span>
              </button>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <Search className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="font-medium text-foreground mb-1">
              Nenhum serviço encontrado
            </h3>
            <p className="text-sm text-muted-foreground">
              Tente buscar por outro termo
            </p>
          </div>
        )}
      </main>
    </div>
  );
};

export default ServicosListPage;
