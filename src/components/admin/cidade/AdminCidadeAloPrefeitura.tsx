import AdminAloPrefeitura from "@/pages/admin/AdminAloPrefeitura";

interface AdminCidadeAloPrefeituraProps {
  cidadeId: string;
}

const AdminCidadeAloPrefeitura = ({ cidadeId }: AdminCidadeAloPrefeituraProps) => {
  return <AdminAloPrefeitura forcedCidadeId={cidadeId} />;
};

export default AdminCidadeAloPrefeitura;
