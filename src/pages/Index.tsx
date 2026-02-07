import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Mail } from "lucide-react";

const Index = () => {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleSendEmail = async () => {
    if (!email.trim()) {
      toast({
        title: "Email obrigatório",
        description: "Digite um email para enviar o teste.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-brevo-email", {
        body: { to: email },
      });

      if (error) throw error;

      toast({
        title: "Email enviado! ✉️",
        description: `Email de teste enviado para ${email}`,
      });
      setEmail("");
    } catch (error: any) {
      console.error("Error sending email:", error);
      toast({
        title: "Erro ao enviar email",
        description: error.message || "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6 bg-card p-6 rounded-xl border border-border">
        <div className="text-center space-y-2">
          <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
            <Mail className="w-6 h-6 text-primary" />
          </div>
          <h1 className="text-xl font-semibold text-foreground">Teste de Email - Brevo</h1>
          <p className="text-sm text-muted-foreground">
            Digite um email para testar a integração
          </p>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email de destino</Label>
            <Input
              id="email"
              type="email"
              placeholder="seu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSendEmail()}
            />
          </div>

          <Button
            onClick={handleSendEmail}
            disabled={isLoading}
            className="w-full bg-[#331D4A] hover:bg-[#331D4A]/90"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Enviando...
              </>
            ) : (
              <>
                <Mail className="h-4 w-4 mr-2" />
                Enviar Email de Teste
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Index;
