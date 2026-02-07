import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Newspaper, Film, Phone, Megaphone, DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import type { Cidade } from "@/types/cidade";
import AdminCidadeJornal from "@/components/admin/cidade/AdminCidadeJornal";
import AdminCidadeCinema from "@/components/admin/cidade/AdminCidadeCinema";
import AdminCidadeAloPrefeitura from "@/components/admin/cidade/AdminCidadeAloPrefeitura";
import AdminCidadeBanners from "@/components/admin/cidade/AdminCidadeBanners";
import AdminCidadePrecificacao from "@/components/admin/cidade/AdminCidadePrecificacao";

const AdminCidadeDetail = () => {
  const { cidadeId } = useParams<{ cidadeId: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("jornal");

  // Fetch cidade details
  const { data: cidade, isLoading } = useQuery({
    queryKey: ["cidade", cidadeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cidade")
        .select("*")
        .eq("id", cidadeId)
        .maybeSingle();

      if (error) throw error;
      return data as Cidade | null;
    },
    enabled: !!cidadeId,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-muted-foreground">Carregando...</div>
      </div>
    );
  }

  if (!cidade) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <div className="text-muted-foreground">Cidade não encontrada</div>
        <Button variant="outline" onClick={() => navigate("/admin/cidades")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/admin/cidades")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex items-center gap-4">
          {cidade.banner_url && (
            <img
              src={cidade.banner_url}
              alt={cidade.nome}
              className="w-16 h-10 object-cover rounded-lg"
            />
          )}
          <div>
            <h1 className="text-2xl font-bold text-foreground">{cidade.nome}</h1>
            <p className="text-muted-foreground text-sm">/{cidade.slug}</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="w-full grid grid-cols-5 h-12">
          <TabsTrigger value="jornal" className="flex items-center gap-2">
            <Newspaper className="h-4 w-4" />
            <span className="hidden sm:inline">Jornal</span>
          </TabsTrigger>
          <TabsTrigger value="cinema" className="flex items-center gap-2">
            <Film className="h-4 w-4" />
            <span className="hidden sm:inline">Cinema</span>
          </TabsTrigger>
          <TabsTrigger value="alo-prefeitura" className="flex items-center gap-2">
            <Phone className="h-4 w-4" />
            <span className="hidden sm:inline">Alô Prefeitura</span>
          </TabsTrigger>
          <TabsTrigger value="banners" className="flex items-center gap-2">
            <Megaphone className="h-4 w-4" />
            <span className="hidden sm:inline">Banners</span>
          </TabsTrigger>
          <TabsTrigger value="precificacao" className="flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            <span className="hidden sm:inline">Precificação</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="jornal" className="mt-6">
          <AdminCidadeJornal cidadeId={cidadeId!} />
        </TabsContent>

        <TabsContent value="cinema" className="mt-6">
          <AdminCidadeCinema cidadeId={cidadeId!} />
        </TabsContent>

        <TabsContent value="alo-prefeitura" className="mt-6">
          <AdminCidadeAloPrefeitura cidadeId={cidadeId!} />
        </TabsContent>

        <TabsContent value="banners" className="mt-6">
          <AdminCidadeBanners cidadeId={cidadeId!} />
        </TabsContent>

        <TabsContent value="precificacao" className="mt-6">
          <AdminCidadePrecificacao cidadeId={cidadeId!} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminCidadeDetail;
