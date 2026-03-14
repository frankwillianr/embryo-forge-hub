import AdminJornal from "@/pages/admin/AdminJornal";

interface AdminCidadeJornalProps {
  cidadeId: string;
}

const AdminCidadeJornal = ({ cidadeId }: AdminCidadeJornalProps) => {
  return <AdminJornal forcedCidadeId={cidadeId} />;
};

export default AdminCidadeJornal;
