import { Check, Users, Image, RefreshCw, Eye } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface EmpresaPricingInfoProps {
  valorAnual: number;
}

const EmpresaPricingInfo = ({ valorAnual }: EmpresaPricingInfoProps) => {
  const valorMensal = valorAnual / 12;

  const beneficios = [
    {
      icon: Users,
      title: "Seja encontrado",
      text: "Milhares de pessoas buscam serviços todos os dias na sua cidade",
    },
    {
      icon: Image,
      title: "Banner na Home",
      text: "Seu banner promocional aparece na seção de Ofertas da Cidade, direto na página inicial — a área mais visitada do app!",
    },
    {
      icon: Eye,
      title: "Máxima visibilidade",
      text: "Pessoas entram para ver as ofertas do dia. Seu negócio ganha destaque especial",
    },
    {
      icon: RefreshCw,
      title: "Atualize sempre",
      text: "Mude suas informações, fotos e ofertas quantas vezes precisar",
    },
  ];

  return (
    <Card className="border-green-500/30 bg-green-50">
      <CardContent className="p-4 space-y-4">
        {/* Preço */}
        <div className="text-center">
          <div className="text-sm text-green-700">
            Investimento anual
          </div>
          <div className="text-3xl font-bold text-green-600">
            R$ {valorAnual.toFixed(2).replace(".", ",")}
          </div>
          <div className="text-sm text-green-700">
            equivalente a{" "}
            <span className="font-semibold text-green-800">
              R$ {valorMensal.toFixed(2).replace(".", ",")}
            </span>{" "}
            por mês
          </div>
        </div>

        {/* Benefícios */}
        <div className="space-y-4 pt-3 border-t border-green-200">
          {beneficios.map((beneficio, index) => (
            <div key={index} className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                <beneficio.icon className="h-4 w-4 text-green-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-green-800">
                  {beneficio.title}
                </p>
                <p className="text-xs text-green-700 leading-relaxed">
                  {beneficio.text}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Selo de garantia */}
        <div className="flex items-center justify-center gap-2 pt-2 text-xs text-green-700 bg-green-100 rounded-lg py-2">
          <Check className="h-4 w-4 text-green-600" />
          <span>Validade de 1 ano a partir da aprovação</span>
        </div>
      </CardContent>
    </Card>
  );
};

export default EmpresaPricingInfo;
