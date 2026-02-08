import { Check, Users, Image, RefreshCw } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface EmpresaPricingInfoProps {
  valorAnual: number;
}

const EmpresaPricingInfo = ({ valorAnual }: EmpresaPricingInfoProps) => {
  const valorMensal = valorAnual / 12;

  const beneficios = [
    {
      icon: Users,
      text: "Seja visto e buscado por milhares de pessoas por dia",
    },
    {
      icon: Image,
      text: "Adicione um banner promocional na seção de ofertas da cidade",
    },
    {
      icon: RefreshCw,
      text: "Atualize suas informações quantas vezes precisar",
    },
  ];

  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardContent className="p-4 space-y-4">
        {/* Preço */}
        <div className="text-center">
          <div className="text-sm text-muted-foreground">
            Investimento anual
          </div>
          <div className="text-3xl font-bold text-primary">
            R$ {valorAnual.toFixed(2).replace(".", ",")}
          </div>
          <div className="text-sm text-muted-foreground">
            equivalente a{" "}
            <span className="font-semibold text-foreground">
              R$ {valorMensal.toFixed(2).replace(".", ",")}
            </span>{" "}
            por mês
          </div>
        </div>

        {/* Benefícios */}
        <div className="space-y-3 pt-3 border-t border-primary/20">
          {beneficios.map((beneficio, index) => (
            <div key={index} className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <beneficio.icon className="h-4 w-4 text-primary" />
              </div>
              <p className="text-sm text-foreground leading-relaxed">
                {beneficio.text}
              </p>
            </div>
          ))}
        </div>

        {/* Selo de garantia */}
        <div className="flex items-center justify-center gap-2 pt-2 text-xs text-muted-foreground">
          <Check className="h-4 w-4 text-green-600" />
          <span>Validade de 1 ano a partir da aprovação</span>
        </div>
      </CardContent>
    </Card>
  );
};

export default EmpresaPricingInfo;
