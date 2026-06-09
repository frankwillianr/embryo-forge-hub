import { useState } from "react";
import { ArrowRightLeft, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type LiberarNumeroResult = {
  numero_liberado: number;
  participante_fixado: string | null;
  participante_trocado: string | null;
  numero_anterior: number | null;
};

const AdminLiberarNumero = () => {
  const [numero, setNumero] = useState("45");
  const [nome, setNome] = useState("clara brito");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<LiberarNumeroResult | null>(null);

  const handleLiberarNumero = async () => {
    const parsedNumber = Number(numero);
    if (!Number.isInteger(parsedNumber) || parsedNumber < 1) {
      setError("Informe um numero valido.");
      return;
    }

    setIsSaving(true);
    setError(null);
    setResult(null);

    try {
      const { data, error: rpcError } = await supabase.rpc("admin_copa_2026_liberar_numero" as any, {
        p_numero: parsedNumber,
        p_nome: nome.trim() || "clara brito",
      });

      if (rpcError) throw rpcError;
      const first = Array.isArray(data) ? data[0] : data;
      setResult(first as LiberarNumeroResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nao foi possivel liberar o numero.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-gray-900">Liberar numero</h1>
        <p className="mt-1 text-sm text-gray-500">
          Troque a posicao de uma participante na lista do sorteio Copa 2026.
        </p>
      </div>

      <section className="max-w-xl rounded-xl bg-white p-5 shadow-sm">
        <div className="mb-5 flex items-center gap-2">
          <ArrowRightLeft className="h-5 w-5 text-gray-700" />
          <h2 className="text-base font-semibold text-gray-900">Trocar numero da lista</h2>
        </div>

        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Numero desejado</label>
            <Input
              value={numero}
              onChange={(event) => setNumero(event.target.value.replace(/\D/g, ""))}
              inputMode="numeric"
              placeholder="45"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Participante</label>
            <Input
              value={nome}
              onChange={(event) => setNome(event.target.value)}
              placeholder="clara brito"
            />
          </div>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          {result && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
              {result.participante_fixado || "Participante"} ficou no numero {result.numero_liberado}.
              {result.participante_trocado
                ? ` ${result.participante_trocado} foi para o numero ${result.numero_anterior}.`
                : ""}
            </div>
          )}

          <Button type="button" onClick={handleLiberarNumero} disabled={isSaving} className="w-full gap-2">
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRightLeft className="h-4 w-4" />}
            Liberar numero
          </Button>
        </div>
      </section>
    </div>
  );
};

export default AdminLiberarNumero;
