import AdminCinema from "@/pages/admin/AdminCinema";

interface AdminCidadeCinemaProps {
  cidadeId: string;
}

const AdminCidadeCinema = ({ cidadeId }: AdminCidadeCinemaProps) => {
  return <AdminCinema forcedCidadeId={cidadeId} />;
};

export default AdminCidadeCinema;
