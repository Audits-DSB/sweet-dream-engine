import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Shield, ShieldCheck, Eye, Users } from "lucide-react";
import { Navigate } from "react-router-dom";

type AppRole = "admin" | "founder" | "viewer";

interface UserWithRole {
  user_id: string; full_name: string | null; avatar_url: string | null; created_at: string; roles: AppRole[];
}

const roleIcons: Record<AppRole, typeof Shield> = { admin: ShieldCheck, founder: Shield, viewer: Eye };
const roleColors: Record<AppRole, string> = {
  admin: "bg-destructive/10 text-destructive border-0",
  founder: "bg-primary/10 text-primary border-0",
  viewer: "bg-muted text-muted-foreground border-0",
};

export default function UserManagementPage() {
  const { t } = useLanguage();
  const { isAdmin, hasRole, loading: authLoading, user } = useAuth();
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [loading, setLoading] = useState(true);

  const canAccess = isAdmin || hasRole("founder");

  const roleLabels: Record<AppRole, string> = { admin: t.admin, founder: t.founderRole, viewer: t.viewer };

  const fetchUsers = async () => {
    setLoading(true);
    const { data: profiles } = await supabase.from("profiles").select("user_id, full_name, avatar_url, created_at");
    const { data: roles } = await supabase.from("user_roles").select("user_id, role");
    if (profiles) {
      setUsers(profiles.map((p) => ({
        ...p, roles: (roles?.filter((r) => r.user_id === p.user_id).map((r) => r.role as AppRole)) || [],
      })));
    }
    setLoading(false);
  };

  useEffect(() => { if (canAccess) fetchUsers(); }, [canAccess]);

  const updateRole = async (userId: string, newRole: AppRole) => {
    const { error: deleteError } = await supabase.from("user_roles").delete().eq("user_id", userId);
    if (deleteError) { toast.error(`${t.roleUpdateFailed}: ${deleteError.message}`); return; }
    const { error: insertError } = await supabase.from("user_roles").insert({ user_id: userId, role: newRole });
    if (insertError) { toast.error(`${t.roleUpdateFailed}: ${insertError.message}`); return; }
    toast.success(t.roleUpdated);
    fetchUsers();
  };

  if (authLoading) return null;
  if (!canAccess) return <Navigate to="/" replace />;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <Users className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="page-header">{t.userManagementTitle}</h1>
          <p className="page-description">{users.length} {t.usersCount}</p>
        </div>
      </div>

      <div className="stat-card overflow-x-auto">
        {loading ? (
          <div className="text-center py-12 text-muted-foreground text-sm">{t.loadingUsers}</div>
        ) : users.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground text-sm">{t.noDataAvailable}</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-start py-3 px-3 text-xs font-medium text-muted-foreground">{t.user}</th>
                <th className="text-start py-3 px-3 text-xs font-medium text-muted-foreground">{t.joinedDate}</th>
                <th className="text-start py-3 px-3 text-xs font-medium text-muted-foreground">{t.currentRole}</th>
                <th className="text-start py-3 px-3 text-xs font-medium text-muted-foreground">{t.changeRole}</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const currentRole = u.roles[0] || "viewer";
                const RoleIcon = roleIcons[currentRole];
                const isSelf = u.user_id === user?.id;
                return (
                  <tr key={u.user_id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-xs">
                          {(u.full_name || "?")[0].toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium">{u.full_name || t.noNameUser}</p>
                          <p className="text-xs text-muted-foreground font-mono">{u.user_id.slice(0, 8)}...</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-3 text-muted-foreground">{new Date(u.created_at).toLocaleDateString("ar-EG")}</td>
                    <td className="py-3 px-3">
                      <Badge className={`${roleColors[currentRole]} gap-1`}><RoleIcon className="h-3 w-3" />{roleLabels[currentRole]}</Badge>
                    </td>
                    <td className="py-3 px-3">
                      {isSelf ? (
                        <span className="text-xs text-muted-foreground">{t.cannotChangeOwnRole}</span>
                      ) : (
                        <Select value={currentRole} onValueChange={(val) => updateRole(u.user_id, val as AppRole)}>
                          <SelectTrigger className="h-8 w-[130px]"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="admin">{t.admin}</SelectItem>
                            <SelectItem value="founder">{t.founderRole}</SelectItem>
                            <SelectItem value="viewer">{t.viewer}</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
