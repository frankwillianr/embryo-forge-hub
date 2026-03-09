import { Check, Users, Image, RefreshCw, Eye } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

const EmpresaPricingInfo = () => {
  const beneficios = [
    {
      icon: Users,
      title: "Seja encontrado",
      text: "Milhares de pessoas buscam servicos todos os dias na sua cidade",
    },
    {
      icon: Image,
      title: "Banner na Home",
      text: "Seu banner promocional aparece no Mural de ofertas, direto na pagina inicial - a area mais visitada do app!",
    },
    {
      icon: Eye,
      title: "Maxima visibilidade",
      text: "Pessoas entram para ver as ofertas do dia. Seu negocio ganha destaque especial",
    },
    {
      icon: RefreshCw,
      title: "Atualize sempre",
      text: "Mude suas informacoes, fotos e ofertas quantas vezes precisar",
    },
  ];

  return (
    <Card className="border-green-300 bg-green-50/50">
      <CardContent className="p-4 space-y-4">
        <div className="space-y-4">
          {beneficios.map((beneficio, index) => (
            <div key={index} className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                <beneficio.icon className="h-4 w-4 text-green-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">{beneficio.title}</p>
                <p className="text-xs text-muted-foreground leading-relaxed">{beneficio.text}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-center gap-2 pt-2 text-xs text-foreground bg-green-100/50 rounded-lg py-2">
          <Check className="h-4 w-4 text-green-600" />
          <span>Validade de 1 ano a partir da aprovacao</span>
        </div>
      </CardContent>
    </Card>
  );
};

export default EmpresaPricingInfo;
