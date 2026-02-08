import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Save, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface AdminCidadePrecificacaoProps {
  cidadeId: string;
}

const AdminCidadePrecificacao = ({ cidadeId }: AdminCidadePrecificacaoProps) => {
  const queryClient = useQueryClient();
  const [valorDiaBanner, setValorDiaBanner] = useState<string>("");
  const [valorEmpresaAnual, setValorEmpresaAnual] = useState<string>("");

  // Fetch current pricing from cidade
  const { data: cidade, isLoading } = useQuery({
    queryKey: ["cidade-precificacao", cidadeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cidade")
        .select("id, nome, valor_dia_banner, valor_empresa_anual")
        .eq("id", cidadeId)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!cidadeId,
  });

  // Set initial value when data loads
  useState(() => {
    if (cidade?.valor_dia_banner) {
      setValorDiaBanner(cidade.valor_dia_banner.toString());
    }
  });

  // Update pricing mutation
  const updatePricing = useMutation({
    mutationFn: async (values: { valorDiaBanner: number; valorEmpresaAnual: number }) => {
      const { error } = await supabase
        .from("cidade")
        .update({ 
          valor_dia_banner: values.valorDiaBanner,
          valor_empresa_anual: values.valorEmpresaAnual,
        })
        .eq("id", cidadeId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cidade-precificacao", cidadeId] });
      toast.success("Precificação atualizada com sucesso!");
    },
    onError: (error) => {
      console.error("Erro ao atualizar precificação:", error);
      toast.error("Erro ao atualizar precificação");
    },
  });

  const handleSave = () => {
    const valorBanner = parseFloat(valorDiaBanner.replace(",", "."));
    const valorEmpresa = parseFloat(valorEmpresaAnual.replace(",", "."));
    
    if (isNaN(valorBanner) || valorBanner < 0) {
      toast.error("Valor do banner inválido");
      return;
    }
    if (isNaN(valorEmpresa) || valorEmpresa < 0) {
      toast.error("Valor da empresa inválido");
      return;
    }
    
    updatePricing.mutate({ 
      valorDiaBanner: valorBanner, 
      valorEmpresaAnual: valorEmpresa 
    });
  };

  // Update local state when data loads
  if (cidade?.valor_dia_banner !== undefined && valorDiaBanner === "") {
    setValorDiaBanner(cidade.valor_dia_banner?.toString() || "0");
  }
  if (cidade?.valor_empresa_anual !== undefined && valorEmpresaAnual === "") {
    setValorEmpresaAnual(cidade.valor_empresa_anual?.toString() || "0");
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Banner Publicitário</CardTitle>
          <CardDescription>
            Configure o valor cobrado por dia de exibição do banner na cidade
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="valor-dia">Valor por dia (R$)</Label>
            <div className="flex gap-3">
              <div className="relative flex-1 max-w-xs">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  R$
                </span>
                <Input
                  id="valor-dia"
                  type="text"
                  inputMode="decimal"
                  placeholder="0,00"
                  value={valorDiaBanner}
                  onChange={(e) => setValorDiaBanner(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Button 
                onClick={handleSave} 
                disabled={updatePricing.isPending}
              >
                {updatePricing.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                Salvar
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              Este valor será usado para calcular o preço total dos anúncios de banner
            </p>
          </div>

          {/* Preview dos pacotes */}
          <div className="mt-6 pt-6 border-t">
            <Label className="text-sm font-medium">Prévia dos pacotes</Label>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 mt-3">
              {[7, 15, 30, 60, 90].map((dias) => {
                const valor = parseFloat(valorDiaBanner.replace(",", ".")) || 0;
                const total = valor * dias;
                return (
                  <div 
                    key={dias}
                    className="p-3 bg-muted/50 rounded-lg text-center"
                  >
                    <div className="text-lg font-semibold text-foreground">
                      {dias} dias
                    </div>
                    <div className="text-sm text-primary font-medium">
                      R$ {total.toFixed(2).replace(".", ",")}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Card de Precificação de Empresas */}
      <Card>
        <CardHeader>
          <CardTitle>Cadastro de Empresas</CardTitle>
          <CardDescription>
            Configure o valor anual para cadastro de empresas no guia de serviços
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="valor-empresa">Valor anual (R$)</Label>
            <div className="flex gap-3">
              <div className="relative flex-1 max-w-xs">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  R$
                </span>
                <Input
                  id="valor-empresa"
                  type="text"
                  inputMode="decimal"
                  placeholder="0,00"
                  value={valorEmpresaAnual}
                  onChange={(e) => setValorEmpresaAnual(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Button 
                onClick={handleSave} 
                disabled={updatePricing.isPending}
              >
                {updatePricing.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                Salvar
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              Este valor será cobrado anualmente para manter a empresa ativa no guia de serviços
            </p>
          </div>

          {/* Preview mensal */}
          <div className="mt-6 pt-6 border-t">
            <Label className="text-sm font-medium">Equivalência mensal</Label>
            <div className="mt-3 p-4 bg-muted/50 rounded-lg inline-block">
              <div className="text-sm text-muted-foreground">Por mês</div>
              <div className="text-2xl font-semibold text-primary">
                R$ {((parseFloat(valorEmpresaAnual.replace(",", ".")) || 0) / 12).toFixed(2).replace(".", ",")}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminCidadePrecificacao;
