import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Eye, Loader2, Search, Ticket } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface AdminCidadeSorteioCopa2026Props {
  cidadeId: string;
}

interface VoucherRow {
  id: string;
  user_id: string;
  cidade_slug: string;
  voucher_codigo: string;
  comprovante_path: string | null;
  comprovante_nome: string | null;
  created_at: string;
  nome: string | null;
  email: string | null;
  contato: string | null;
}

const formatDateTime = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};

const AdminCidadeSorteioCopa2026 = ({ cidadeId: _cidadeId }: AdminCidadeSorteioCopa2026Props) => {
  const [voucherCountFilter, setVoucherCountFilter] = useState("todos");
  const [search, setSearch] = useState("");
  const [openingPrintId, setOpeningPrintId] = useState<string | null>(null);
  const [printModal, setPrintModal] = useState<{ codigo: string; url: string } | null>(null);

  const { data: vouchers = [], isLoading, error } = useQuery({
    queryKey: ["admin-copa-2026-vouchers"],
    queryFn: async () => {
      const { data, error: rpcError } = await supabase.rpc("admin_copa_2026_vouchers" as any);
      if (rpcError) throw rpcError;
      return (data || []) as VoucherRow[];
    },
  });

  const voucherCountByUser = useMemo(() => {
    const map = new Map<string, number>();
    vouchers.forEach((voucher) => {
      map.set(voucher.user_id, (map.get(voucher.user_id) || 0) + 1);
    });
    return map;
  }, [vouchers]);

  const countOptions = useMemo(() => {
    const counts = Array.from(new Set(Array.from(voucherCountByUser.values()))).sort((a, b) => a - b);
    return counts;
  }, [voucherCountByUser]);

  const filteredVouchers = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    const selectedCount = voucherCountFilter === "todos" ? null : Number(voucherCountFilter);

    return vouchers.filter((voucher) => {
      const userVoucherCount = voucherCountByUser.get(voucher.user_id) || 0;
      if (selectedCount !== null && userVoucherCount !== selectedCount) return false;

      if (!normalizedSearch) return true;

      const haystack = [
        voucher.voucher_codigo,
        voucher.nome,
        voucher.email,
        voucher.contato,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(normalizedSearch);
    });
  }, [search, voucherCountByUser, voucherCountFilter, vouchers]);

  const participantes = voucherCountByUser.size;

  const handleOpenPrint = async (voucher: VoucherRow) => {
    if (!voucher.comprovante_path) return;

    setOpeningPrintId(voucher.id);
    try {
      const { data, error: signedUrlError } = await supabase.storage
        .from("copa-vouchers")
        .createSignedUrl(voucher.comprovante_path, 120);

      if (signedUrlError) throw signedUrlError;
      if (data?.signedUrl) {
        setPrintModal({ codigo: voucher.voucher_codigo, url: data.signedUrl });
      }
    } catch (err: any) {
      alert(err?.message || "Não foi possível abrir o anexo.");
    } finally {
      setOpeningPrintId(null);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Sorteio Copa 2026</h2>
          <p className="text-sm text-gray-500">
            Vouchers gerados para o sorteio da camisa original da Seleção Brasileira 2026.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:min-w-[260px]">
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
            <p className="text-xs text-gray-500">Participantes</p>
            <p className="text-2xl font-bold text-gray-900">{participantes}</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
            <p className="text-xs text-gray-500">Vouchers</p>
            <p className="text-2xl font-bold text-gray-900">{vouchers.length}</p>
          </div>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-[1fr_240px]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar por nome, telefone, email ou voucher..."
            className="pl-9"
          />
        </div>
        <Select value={voucherCountFilter} onValueChange={setVoucherCountFilter}>
          <SelectTrigger>
            <SelectValue placeholder="Filtrar por quantidade" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todas as quantidades</SelectItem>
            {countOptions.map((count) => (
              <SelectItem key={count} value={String(count)}>
                Pessoas com {count} voucher{count === 1 ? "" : "s"}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-200">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50">
              <TableHead>Data</TableHead>
              <TableHead>Usuário</TableHead>
              <TableHead>Nome</TableHead>
              <TableHead>Telefone</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Voucher</TableHead>
              <TableHead>Qtd.</TableHead>
              <TableHead className="text-right">Anexo</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={8} className="py-8 text-center text-gray-500">
                  Carregando vouchers...
                </TableCell>
              </TableRow>
            ) : error ? (
              <TableRow>
                <TableCell colSpan={8} className="py-8 text-center text-red-600">
                  {(error as Error).message || "Erro ao carregar vouchers."}
                </TableCell>
              </TableRow>
            ) : filteredVouchers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="py-8 text-center text-gray-500">
                  Nenhum voucher encontrado.
                </TableCell>
              </TableRow>
            ) : (
              filteredVouchers.map((voucher) => (
                <TableRow key={voucher.id}>
                  <TableCell className="whitespace-nowrap text-sm text-gray-600">
                    {formatDateTime(voucher.created_at)}
                  </TableCell>
                  <TableCell className="max-w-[160px] truncate text-xs text-gray-500">
                    {voucher.user_id}
                  </TableCell>
                  <TableCell className="font-medium text-gray-900">
                    {voucher.nome || "Sem nome"}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {voucher.contato || "-"}
                  </TableCell>
                  <TableCell>{voucher.email || "-"}</TableCell>
                  <TableCell className="whitespace-nowrap font-mono text-sm font-semibold">
                    {voucher.voucher_codigo}
                  </TableCell>
                  <TableCell>{voucherCountByUser.get(voucher.user_id) || 0}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={!voucher.comprovante_path || openingPrintId === voucher.id}
                      onClick={() => handleOpenPrint(voucher)}
                      className="gap-2"
                    >
                      {openingPrintId === voucher.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                      Ver
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!printModal} onOpenChange={(open) => !open && setPrintModal(null)}>
        <DialogContent className="max-w-[calc(100vw-2rem)] rounded-2xl p-0 sm:max-w-2xl">
          <DialogHeader className="px-4 pt-4">
            <DialogTitle className="flex items-center gap-2 text-base">
              <Ticket className="h-4 w-4" />
              Anexo do voucher
            </DialogTitle>
            {printModal?.codigo ? (
              <p className="break-all text-xs font-semibold text-gray-500">{printModal.codigo}</p>
            ) : null}
          </DialogHeader>
          <div className="px-4 pb-4">
            {printModal?.url ? (
              <img
                src={printModal.url}
                alt="Print anexado ao voucher"
                className="max-h-[76vh] w-full rounded-xl border border-gray-200 object-contain"
              />
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminCidadeSorteioCopa2026;
