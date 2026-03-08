import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Shield, Users, ShieldCheck, Eye } from "lucide-react";
import { Navigate } from "react-router-dom";

type AppRole = "admin" | "founder" | "viewer";

interface UserWithRole {
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
  created_at: string;
  roles: AppRole[];
}

const roleIcons: Record<AppRole, typeof Shield> = {
  admin: ShieldCheck,
  founder: Shield,
  viewer: Eye,
};

const roleColors: Record<AppRole, string> = {
  admin: "bg-destructive/10 text-destructive border-0",
  founder: "bg-primary/10 text-primary border-0",
  viewer: "bg-muted text-muted-foreground border-0",
};

const roleLabels: Record<AppRole, string> = {
  admin: "مدير",
  founder: "مؤسس",
  viewer: "مشاهد",
};

export default function UserManagementPage() {
  const { isAdmin, loading: authLoading, user } = useAuth();
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchUsers = async () => {
    setLoading(true);
    const { data: profiles } = await supabase.from("profiles").select("user_id, full_name, avatar_url, created_at");
    const { data: roles } = await supabase.from("user_roles").select("user_id, role");

    if (profiles) {
      const userList: UserWithRole[] = profiles.map((p) => ({
        ...p,
        roles: (roles?.filter((r) => r.user_id === p.user_id).map((r) => r.role as AppRole)) || [],
      }));
      setUsers(userList);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (isAdmin) fetchUsers();
  }, [isAdmin]);

  const updateRole = async (userId: string, newRole: AppRole) => {
    const { error: deleteError } = await supabase.from("user_roles").delete().eq("user_id", userId);
    if (deleteError) { toast.error("فشل تحديث الصلاحية: " + deleteError.message); return; }
    const { error: insertError } = await supabase.from("user_roles").insert({ user_id: userId, role: newRole });
    if (insertError) { toast.error("فشل تحديث الصلاحية: " + insertError.message); return; }
    toast.success("تم تحديث الصلاحية بنجاح");
    fetchUsers();
  };

  if (authLoading) return null;
  if (!isAdmin) return <Navigate to="/" replace />;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="page-header">إدارة المستخدمين</h1>
        <p className="page-description">{users.length} مستخدم · للمديرين فقط</p>
      </div>

      <div className="stat-card overflow-x-auto">
        {loading ? (
          <div className="text-center py-12 text-muted-foreground text-sm">جاري تحميل المستخدمين...</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground">المستخدم</th>
                <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground">تاريخ الانضمام</th>
                <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground">الصلاحية الحالية</th>
                <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground">تغيير الصلاحية</th>
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
                          <p className="font-medium">{u.full_name || "مستخدم بدون اسم"}</p>
                          <p className="text-xs text-muted-foreground font-mono">{u.user_id.slice(0, 8)}...</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-3 text-muted-foreground">{new Date(u.created_at).toLocaleDateString("ar-EG")}</td>
                    <td className="py-3 px-3">
                      <Badge className={`${roleColors[currentRole]} gap-1`}>
                        <RoleIcon className="h-3 w-3" />
                        {roleLabels[currentRole]}
                      </Badge>
                    </td>
                    <td className="py-3 px-3">
                      {isSelf ? (
                        <span className="text-xs text-muted-foreground">لا يمكن تغيير صلاحيتك</span>
                      ) : (
                        <Select value={currentRole} onValueChange={(val) => updateRole(u.user_id, val as AppRole)}>
                          <SelectTrigger className="h-8 w-[130px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="admin">مدير</SelectItem>
                            <SelectItem value="founder">مؤسس</SelectItem>
                            <SelectItem value="viewer">مشاهد</SelectItem>
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
