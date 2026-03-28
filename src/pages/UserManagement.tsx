import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Shield, ShieldCheck, Eye, Users, Pencil, Key, Trash2, Loader2, UserPlus } from "lucide-react";
import { Navigate } from "react-router-dom";

async function getAuthHeaders() {
  const { data: { session } } = await supabase.auth.getSession();
  return { Authorization: `Bearer ${session?.access_token || ""}`, "Content-Type": "application/json" };
}

type AppRole = "admin" | "founder" | "viewer";

interface UserWithRole {
  user_id: string; full_name: string | null; avatar_url: string | null; created_at: string; roles: AppRole[]; email?: string;
}

const roleIcons: Record<AppRole, typeof Shield> = { admin: ShieldCheck, founder: Shield, viewer: Eye };
const roleColors: Record<AppRole, string> = {
  admin: "bg-destructive/10 text-destructive border-0",
  founder: "bg-primary/10 text-primary border-0",
  viewer: "bg-muted text-muted-foreground border-0",
};

export default function UserManagementPage() {
  const { t } = useLanguage();
  const { isSuperAdmin, loading: authLoading, user } = useAuth();
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [editUser, setEditUser] = useState<UserWithRole | null>(null);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [pwUser, setPwUser] = useState<UserWithRole | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleteUser, setDeleteUser] = useState<UserWithRole | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createEmail, setCreateEmail] = useState("");
  const [createPassword, setCreatePassword] = useState("");
  const [createRole, setCreateRole] = useState<AppRole>("viewer");

  const canAccess = isSuperAdmin;
  const roleLabels: Record<AppRole, string> = { admin: t.admin, founder: t.founderRole, viewer: t.viewer };

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch("/api/admin/users", { headers });
      if (!res.ok) { toast.error("Access denied"); setLoading(false); return; }
      const data = await res.json();
      setUsers(data.map((p: any) => ({ ...p, roles: (p.roles || []) as AppRole[] })));
    } catch {
      toast.error("Failed to load users");
    }
    setLoading(false);
  };

  useEffect(() => { if (canAccess) fetchUsers(); }, [canAccess]);

  const updateRole = async (userId: string, newRole: AppRole) => {
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/admin/users/${userId}/role`, {
        method: "PATCH", headers, body: JSON.stringify({ role: newRole }),
      });
      if (!res.ok) { const d = await res.json(); toast.error(d.error || "Error"); return; }
      toast.success(t.roleUpdated);
      fetchUsers();
    } catch { toast.error(t.roleUpdateFailed); }
  };

  const handleEditProfile = async () => {
    if (!editUser) return;
    setSaving(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/admin/users/${editUser.user_id}/profile`, {
        method: "PATCH", headers,
        body: JSON.stringify({ full_name: editName, phone: editPhone, email: editEmail }),
      });
      if (!res.ok) { const d = await res.json(); toast.error(d.error || "Error"); setSaving(false); return; }
      toast.success("تم تحديث البيانات بنجاح");
      setEditUser(null);
      fetchUsers();
    } catch { toast.error("فشل في التحديث"); }
    setSaving(false);
  };

  const handleChangePassword = async () => {
    if (!pwUser) return;
    setSaving(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/admin/users/${pwUser.user_id}/password`, {
        method: "PATCH", headers,
        body: JSON.stringify({ password: newPassword }),
      });
      if (!res.ok) { const d = await res.json(); toast.error(d.error || "Error"); setSaving(false); return; }
      toast.success("تم تغيير كلمة المرور بنجاح");
      setPwUser(null);
      setNewPassword("");
    } catch { toast.error("فشل في تغيير كلمة المرور"); }
    setSaving(false);
  };

  const handleDeleteUser = async () => {
    if (!deleteUser) return;
    setSaving(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/admin/users/${deleteUser.user_id}`, {
        method: "DELETE", headers,
      });
      if (!res.ok) { const d = await res.json(); toast.error(d.error || "Error"); setSaving(false); return; }
      toast.success("تم حذف المستخدم بنجاح");
      setDeleteUser(null);
      fetchUsers();
    } catch { toast.error("فشل في حذف المستخدم"); }
    setSaving(false);
  };

  const handleCreateUser = async () => {
    if (!createEmail || !createPassword) return;
    setSaving(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch("/api/admin/users", {
        method: "POST", headers,
        body: JSON.stringify({ email: createEmail, password: createPassword, full_name: createName, role: createRole }),
      });
      if (!res.ok) { const d = await res.json(); toast.error(d.error || "Error"); setSaving(false); return; }
      toast.success("تم إنشاء المستخدم بنجاح");
      setShowCreate(false);
      setCreateName(""); setCreateEmail(""); setCreatePassword(""); setCreateRole("viewer");
      fetchUsers();
    } catch { toast.error("فشل في إنشاء المستخدم"); }
    setSaving(false);
  };

  if (authLoading) return null;
  if (!canAccess) return <Navigate to="/" replace />;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Users className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="page-header">{t.userManagementTitle}</h1>
            <p className="page-description">{users.length} {t.usersCount}</p>
          </div>
        </div>
        <Button onClick={() => setShowCreate(true)} className="gap-2">
          <UserPlus className="h-4 w-4" />
          إضافة مستخدم
        </Button>
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
                <th className="text-start py-3 px-3 text-xs font-medium text-muted-foreground">إجراءات</th>
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
                          <p className="text-xs text-muted-foreground">{u.email || u.user_id.slice(0, 8) + "..."}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-3 text-muted-foreground">{new Date(u.created_at).toLocaleDateString("ar-EG")}</td>
                    <td className="py-3 px-3">
                      <Badge className={`${roleColors[currentRole]} gap-1`}><RoleIcon className="h-3 w-3" />{roleLabels[currentRole]}</Badge>
                    </td>
                    <td className="py-3 px-3">
                      <Select value={currentRole} onValueChange={(val) => updateRole(u.user_id, val as AppRole)}>
                        <SelectTrigger className="h-8 w-[130px]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">{t.admin}</SelectItem>
                          <SelectItem value="founder">{t.founderRole}</SelectItem>
                          <SelectItem value="viewer">{t.viewer}</SelectItem>
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" title="تعديل البيانات"
                          onClick={() => { setEditUser(u); setEditName(u.full_name || ""); setEditPhone(""); setEditEmail(u.email || ""); }}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8" title="تغيير كلمة المرور"
                          onClick={() => { setPwUser(u); setNewPassword(""); }}>
                          <Key className="h-3.5 w-3.5" />
                        </Button>
                        {!isSelf && (
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" title="حذف المستخدم"
                            onClick={() => setDeleteUser(u)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <Dialog open={!!editUser} onOpenChange={(open) => { if (!open) setEditUser(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>تعديل بيانات المستخدم</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>الاسم الكامل</Label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="الاسم" />
            </div>
            <div className="space-y-2">
              <Label>البريد الإلكتروني</Label>
              <Input type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} placeholder="email@example.com" />
            </div>
            <div className="space-y-2">
              <Label>رقم الهاتف</Label>
              <Input value={editPhone} onChange={(e) => setEditPhone(e.target.value)} placeholder="01xxxxxxxxx" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditUser(null)}>إلغاء</Button>
            <Button onClick={handleEditProfile} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin ltr:mr-2 rtl:ml-2" />}
              حفظ التغييرات
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!pwUser} onOpenChange={(open) => { if (!open) { setPwUser(null); setNewPassword(""); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>تغيير كلمة المرور</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              تغيير كلمة المرور لـ <span className="font-medium text-foreground">{pwUser?.full_name || pwUser?.email}</span>
            </p>
            <div className="space-y-2">
              <Label>كلمة المرور الجديدة</Label>
              <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="6 أحرف على الأقل" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setPwUser(null); setNewPassword(""); }}>إلغاء</Button>
            <Button onClick={handleChangePassword} disabled={saving || newPassword.length < 6}>
              {saving && <Loader2 className="h-4 w-4 animate-spin ltr:mr-2 rtl:ml-2" />}
              تغيير كلمة المرور
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteUser} onOpenChange={(open) => { if (!open) setDeleteUser(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-destructive">حذف المستخدم</DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <p className="text-sm">
              هل أنت متأكد من حذف المستخدم <span className="font-bold">{deleteUser?.full_name || deleteUser?.email}</span>؟
            </p>
            <p className="text-xs text-destructive mt-2">هذا الإجراء لا يمكن التراجع عنه.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteUser(null)}>إلغاء</Button>
            <Button variant="destructive" onClick={handleDeleteUser} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin ltr:mr-2 rtl:ml-2" />}
              حذف نهائي
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showCreate} onOpenChange={(open) => { if (!open) { setShowCreate(false); setCreateName(""); setCreateEmail(""); setCreatePassword(""); setCreateRole("viewer"); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>إضافة مستخدم جديد</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>الاسم الكامل</Label>
              <Input value={createName} onChange={(e) => setCreateName(e.target.value)} placeholder="اسم المستخدم" />
            </div>
            <div className="space-y-2">
              <Label>البريد الإلكتروني *</Label>
              <Input type="email" value={createEmail} onChange={(e) => setCreateEmail(e.target.value)} placeholder="email@example.com" />
            </div>
            <div className="space-y-2">
              <Label>كلمة المرور *</Label>
              <Input type="password" value={createPassword} onChange={(e) => setCreatePassword(e.target.value)} placeholder="6 أحرف على الأقل" />
            </div>
            <div className="space-y-2">
              <Label>الدور</Label>
              <Select value={createRole} onValueChange={(val) => setCreateRole(val as AppRole)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">{t.admin}</SelectItem>
                  <SelectItem value="founder">{t.founderRole}</SelectItem>
                  <SelectItem value="viewer">{t.viewer}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowCreate(false); setCreateName(""); setCreateEmail(""); setCreatePassword(""); setCreateRole("viewer"); }}>إلغاء</Button>
            <Button onClick={handleCreateUser} disabled={saving || !createEmail || createPassword.length < 6}>
              {saving && <Loader2 className="h-4 w-4 animate-spin ltr:mr-2 rtl:ml-2" />}
              إنشاء المستخدم
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
