import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Briefcase, Building2, MapPin, Clock, Phone, Mail, Calendar } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Vaga, tipoContratoLabels, modalidadeLabels } from "@/types/vagas";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const VagaDetailPage = () => {
  const { slug, vagaId } = useParams<{ slug: string; vagaId: string }>();
  const navigate = useNavigate();

  const { data: vaga, isLoading } = useQuery({
    queryKey: ["vaga", vagaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vagas")
        .select("*")
        .eq("id", vagaId)
        .maybeSingle();
      if (error) throw error;
      return data as Vaga;
    },
    enabled: !!vagaId,
  });

  const handleWhatsApp = () => {
    if (vaga?.contato_whatsapp) {
      const phone = vaga.contato_whatsapp.replace(/\D/g, "");
      const message = encodeURIComponent(`Olá! Vi a vaga de ${vaga.titulo} e gostaria de mais informações.`);
      window.open(`https://wa.me/55${phone}?text=${message}`, "_blank");
    }
  };

  const handleEmail = () => {
    if (vaga?.contato_email) {
      const subject = encodeURIComponent(`Candidatura: ${vaga.titulo}`);
      const body = encodeURIComponent(`Olá!\n\nVi a vaga de ${vaga.titulo} na ${vaga.empresa} e gostaria de me candidatar.\n\nAtenciosamente,`);
      window.open(`mailto:${vaga.contato_email}?subject=${subject}&body=${body}`, "_blank");
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-4 space-y-4">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!vaga) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Vaga não encontrada</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-card border-b border-border pt-safe">
        <div className="flex items-center gap-3 px-4 pb-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(`/cidade/${slug}/vagas`)}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-semibold text-foreground">
            Detalhes da Vaga
          </h1>
        </div>
      </header>

      {/* Content */}
      <main className="p-4 pb-32 space-y-6">
        {/* Hero */}
        <div className="flex items-start gap-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-orange-500 to-amber-400 flex items-center justify-center flex-shrink-0">
            <Briefcase className="w-8 h-8 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-foreground">{vaga.titulo}</h2>
            <div className="flex items-center gap-1.5 text-muted-foreground mt-1">
              <Building2 className="w-4 h-4" />
              <span>{vaga.empresa}</span>
            </div>
          </div>
        </div>

        {/* Badges */}
        <div className="flex flex-wrap gap-2">
          <Badge className="bg-orange-100 text-orange-700 hover:bg-orange-100">
            {tipoContratoLabels[vaga.tipo_contrato]}
          </Badge>
          <Badge variant="outline">
            <MapPin className="w-3 h-3 mr-1" />
            {modalidadeLabels[vaga.modalidade]}
          </Badge>
          {vaga.salario && (
            <Badge variant="secondary" className="font-semibold">
              {vaga.salario}
            </Badge>
          )}
        </div>

        {/* Date */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Calendar className="w-4 h-4" />
          <span>
            Publicado em {format(new Date(vaga.created_at), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
          </span>
        </div>

        {/* Description */}
        <div className="space-y-2">
          <h3 className="font-semibold text-foreground">Descrição</h3>
          <p className="text-muted-foreground whitespace-pre-wrap">
            {vaga.descricao}
          </p>
        </div>

        {/* Requirements */}
        {vaga.requisitos && (
          <div className="space-y-2">
            <h3 className="font-semibold text-foreground">Requisitos</h3>
            <p className="text-muted-foreground whitespace-pre-wrap">
              {vaga.requisitos}
            </p>
          </div>
        )}
      </main>

      {/* Contact Actions */}
      <div className="fixed bottom-0 left-0 right-0 bg-card border-t border-border p-4 space-y-2">
        {vaga.contato_whatsapp && (
          <Button
            onClick={handleWhatsApp}
            className="w-full h-12 bg-green-500 hover:bg-green-600"
          >
            <Phone className="w-5 h-5 mr-2" />
            Candidatar via WhatsApp
          </Button>
        )}
        {vaga.contato_email && (
          <Button
            onClick={handleEmail}
            variant="outline"
            className="w-full h-12"
          >
            <Mail className="w-5 h-5 mr-2" />
            Enviar Email
          </Button>
        )}
      </div>
    </div>
  );
};

export default VagaDetailPage;
