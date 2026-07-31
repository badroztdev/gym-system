// src/pages/Members.jsx
import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { membersService } from "@/services/members.service";
import { useAuthStore } from "@/store/authStore";
import PageHeader from "@/components/layout/PageHeader";
import MemberForm from "@/components/members/MemberForm";
import { Button, Badge, Spinner, Empty, Confirm, Modal } from "@/components/ui";
import toast from "react-hot-toast";

// ── Status helpers ────────────────────────────────────────────
const subStatus = (member) => {
  if (!member.sub_status) return { type: "expired", label: "بدون اشتراك" };
  if (member.sub_status !== "active") return { type: "expired", label: "منتهي" };
  const days = Math.ceil((new Date(member.sub_end_date) - new Date()) / 86400000);
  if (days <= 7) return { type: "expiring", label: `ينتهي بعد ${days}ي` };
  return { type: "active", label: "نشط" };
};

// ── Stat cards row ────────────────────────────────────────────
function StatsRow() {
  const { data } = useQuery({ queryKey: ["members-stats"], queryFn: membersService.getStats });
  const stats = data?.data || {};
  const cards = [
    { label: "إجمالي الأعضاء",   value: stats.total,         color: "var(--accent2)" },
    { label: "اشتراك نشط",       value: stats.active_subs,    color: "var(--accent)" },
    { label: "تنتهي قريباً",     value: stats.expiring_soon,  color: "var(--warning)" },
    { label: "جدد هذا الشهر",    value: stats.new_this_month, color: "var(--accent3)" },
  ];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 20 }}>
      {cards.map((c, i) => (
        <div key={i} className={`fade-up d-${i + 1}`} style={{
          background: "var(--card)", border: "1px solid var(--border)",
          borderRadius: "var(--radius)", padding: "16px 20px",
        }}>
          <div style={{ fontSize: 24, fontWeight: 700, color: c.color, fontFamily: "'JetBrains Mono', monospace" }}>
            {stats.total === undefined ? "—" : (c.value ?? 0)}
          </div>
          <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>{c.label}</div>
        </div>
      ))}
    </div>
  );
}

// ── Filters bar ───────────────────────────────────────────────
function FiltersBar({ search, status, ageCategory, showInactive, onSearch, onStatus, onAgeCategory, onToggleInactive }) {
  const statuses = [
    { value: "",         label: "الكل" },
    { value: "active",   label: "نشط" },
    { value: "expiring", label: "تنتهي قريباً" },
    { value: "expired",  label: "منتهي" },
  ];
  const categories = ["", "مدارس", "براعم", "أصاغر", "أشبال", "أواسط", "أمال", "أكابر"];

  return (
    <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
      <div style={{ position: "relative", flex: 1, minWidth: 200 }}>
        <span style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", color: "var(--muted)", fontSize: 14 }}>🔍</span>
        <input
          placeholder="بحث بالاسم أو رقم الهاتف..."
          value={search}
          onChange={e => onSearch(e.target.value)}
          style={{
            width: "100%", padding: "9px 38px 9px 14px",
            background: "var(--card)", border: "1px solid var(--border)",
            borderRadius: "var(--radius-sm)", color: "var(--text)",
            fontSize: 13, outline: "none", direction: "rtl",
          }}
        />
      </div>
      {/* فلتر الفئة */}
      <select
        value={ageCategory}
        onChange={e => onAgeCategory(e.target.value)}
        style={{
          padding: "8px 14px", fontSize: 12, borderRadius: "var(--radius-sm)",
          border: "1px solid " + (ageCategory ? "var(--accent2)" : "var(--border)"),
          background: ageCategory ? "var(--accent2)15" : "var(--card)",
          color: ageCategory ? "var(--accent2)" : "var(--muted)",
          cursor: "pointer", fontFamily: "'Sora', sans-serif",
          outline: "none",
        }}
      >
        {categories.map(c => (
          <option key={c} value={c} style={{ background: "var(--card)", color: "var(--text)" }}>
            {c || "كل الفئات"}
          </option>
        ))}
      </select>
      {/* فلتر الحالة */}
      <div style={{ display: "flex", gap: 6 }}>
        {statuses.map(s => (
          <button key={s.value} onClick={() => onStatus(s.value)} style={{
            padding: "8px 14px", fontSize: 12, borderRadius: "var(--radius-sm)",
            border: "1px solid " + (status === s.value ? "var(--accent2)" : "var(--border)"),
            background: status === s.value ? "var(--accent2)15" : "var(--card)",
            color: status === s.value ? "var(--accent2)" : "var(--muted)",
            cursor: "pointer", fontFamily: "'Sora', sans-serif", fontWeight: 500,
          }}>{s.label}</button>
        ))}
      </div>
      {/* إظهار/إخفاء المعطّلين */}
      <button onClick={onToggleInactive} style={{
        padding: "8px 14px", fontSize: 12, borderRadius: "var(--radius-sm)",
        border: "1px solid " + (showInactive ? "var(--danger)" : "var(--border)"),
        background: showInactive ? "var(--danger)15" : "var(--card)",
        color: showInactive ? "var(--danger)" : "var(--muted)",
        cursor: "pointer", fontFamily: "'Sora', sans-serif", fontWeight: 500,
        whiteSpace: "nowrap",
      }}>{showInactive ? "✓ عرض المعطّلين" : "إظهار المعطّلين"}</button>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────
export default function MembersPage() {
  const qc = useQueryClient();
  const { user } = useAuthStore();
  const isOwner = user?.role === "owner";

  const [search,  setSearch]  = useState("");
  const [status,  setStatus]  = useState("");
  const [ageCategory, setAgeCategory] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [page,    setPage]    = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [editMember, setEditMember] = useState(null);
  const [deleteId,  setDeleteId]  = useState(null);
  const [resetId,   setResetId]   = useState(null);
  const [resetModal, setResetModal] = useState(false);
  const [customPass, setCustomPass] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["members", { search, status, ageCategory, showInactive, page }],
    queryFn:  () => membersService.getAll({ search, status, ageCategory, includeInactive: showInactive, page, limit: 15 }),
    keepPreviousData: true,
  });

  const deleteMutation = useMutation({
    mutationFn: membersService.remove,
    onSuccess: () => {
      toast.success("تم إلغاء تفعيل العضو");
      qc.invalidateQueries({ queryKey: ["members"] });
      qc.invalidateQueries({ queryKey: ["members-stats"] });
      setDeleteId(null);
    },
  });

  const reactivateMutation = useMutation({
    mutationFn: (id) => membersService.update(id, { isActive: true }),
    onSuccess: () => {
      toast.success("تم إعادة تفعيل العضو");
      qc.invalidateQueries({ queryKey: ["members"] });
      qc.invalidateQueries({ queryKey: ["members-stats"] });
    },
  });

  const resetPasswordMutation = useMutation({
    mutationFn: ({ id, newPassword }) =>
      membersService.resetPassword(id, newPassword || undefined),
    onSuccess: (res) => {
      toast.success(res.data?.message || "تم إعادة تعيين كلمة المرور ✅");
      setResetModal(false);
      setResetId(null);
      setCustomPass("");
    },
  });

  const members = data?.data || [];
  const meta    = data?.meta || {};

  const handleSearch      = useCallback((v) => { setSearch(v);      setPage(1); }, []);
  const handleStatus      = useCallback((v) => { setStatus(v);      setPage(1); }, []);
  const handleAgeCategory = useCallback((v) => { setAgeCategory(v); setPage(1); }, []);
  const handleToggleInactive = useCallback(() => { setShowInactive(v => !v); setPage(1); }, []);

  const openEdit   = (m)  => { setEditMember(m); setShowForm(true); };
  const closeForm  = ()   => { setShowForm(false); setEditMember(null); };
  const onSuccess  = ()   => { qc.invalidateQueries({ queryKey: ["members"] }); qc.invalidateQueries({ queryKey: ["members-stats"] }); };

  return (
    <>
      <PageHeader
        title="الأعضاء"
        subtitle={meta.total ? `${meta.total} عضو إجمالاً` : ""}
        actions={
          <Button icon="+" onClick={() => setShowForm(true)}>
            عضو جديد
          </Button>
        }
      />

      <main style={{ padding: "24px 28px", flex: 1 }}>
        <StatsRow />
        <FiltersBar search={search} status={status} ageCategory={ageCategory} showInactive={showInactive} onSearch={handleSearch} onStatus={handleStatus} onAgeCategory={handleAgeCategory} onToggleInactive={handleToggleInactive} />

        {/* Table */}
        <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", overflow: "hidden" }}>
          {isLoading ? (
            <div style={{ display: "flex", justifyContent: "center", padding: 48 }}>
              <Spinner size={32} />
            </div>
          ) : members.length === 0 ? (
            <Empty icon="👥" title="لا يوجد أعضاء" description="أضف أول عضو للبدء" />
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", direction: "rtl" }}>
                <thead>
                  <tr style={{ background: "var(--surface)" }}>
                    {["العضو", "الدور", "رقم الهاتف", "الفئة", "الفوج", "الرتبة", "الوزن", "زمرة الدم", "الاشتراك", "الحالة", "الإجراءات"].map(h => (
                      <th key={h} style={{ padding: "11px 16px", fontSize: 11, color: "var(--muted)", fontWeight: 500, textAlign: "right", whiteSpace: "nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {members.map((m, i) => {
                    const s = subStatus(m);
                    const roleMap = { athlete: "رياضي", guardian: "ولي أمر" };
                    return (
                      <tr key={m.id} className="fade-in"
                        style={{
                          borderTop: "1px solid var(--border)", transition: "background 0.12s",
                          opacity: m.is_active ? 1 : 0.5,
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = "var(--surface)"}
                        onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                      >
                        {/* Name + avatar */}
                        <td style={{ padding: "12px 16px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <div style={{
                              width: 34, height: 34, borderRadius: "50%", flexShrink: 0,
                              background: s.type === "active" ? "var(--accent)20" : s.type === "expiring" ? "var(--warning)20" : "var(--border)",
                              display: "flex", alignItems: "center", justifyContent: "center",
                              fontSize: 13, fontWeight: 700,
                              color: s.type === "active" ? "var(--accent)" : s.type === "expiring" ? "var(--warning)" : "var(--muted)",
                            }}>{m.full_name[0]}</div>
                            <div>
                              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>{m.full_name}</div>
                              {m.email && <div style={{ fontSize: 11, color: "var(--muted)" }}>{m.email}</div>}
                            </div>
                          </div>
                        </td>
                        <td style={{ padding: "12px 16px" }}>
                          <Badge label={roleMap[m.role] || m.role} type={m.role} />
                        </td>
                        <td style={{ padding: "12px 16px" }}>
                          <span className="mono" style={{ fontSize: 12, color: "var(--muted-lt)" }}>{m.phone}</span>
                        </td>
                        <td style={{ padding: "12px 16px" }}>
                          {m.age_category
                            ? <Badge label={m.age_category} type="athlete" />
                            : <span style={{ color: "var(--muted)", fontSize: 12 }}>—</span>}
                        </td>
                        <td style={{ padding: "12px 16px" }}>
                          {m.group_name
                            ? <Badge label={m.group_name} type="guardian" />
                            : <span style={{ color: "var(--muted)", fontSize: 12 }}>—</span>}
                        </td>
                        <td style={{ padding: "12px 16px" }}>
                          <span style={{ fontSize: 12, color: "var(--muted-lt)" }}>{m.rank || "—"}</span>
                        </td>
                        <td style={{ padding: "12px 16px" }}>
                          <span className="mono" style={{ fontSize: 12, color: "var(--muted-lt)" }}>
                            {m.weight_kg ? `${m.weight_kg} كغ` : "—"}
                          </span>
                        </td>
                        <td style={{ padding: "12px 16px" }}>
                          {m.blood_group ? (
                            <span style={{
                              fontSize: 12, fontWeight: 700, padding: "2px 8px",
                              borderRadius: 6, background: "var(--danger)15",
                              color: "var(--danger)", fontFamily: "'JetBrains Mono', monospace",
                            }}>{m.blood_group}</span>
                          ) : <span style={{ color: "var(--muted)", fontSize: 12 }}>—</span>}
                        </td>
                        <td style={{ padding: "12px 16px" }}>
                          <Badge label={s.label} type={s.type} />
                        </td>
                        <td style={{ padding: "12px 16px" }}>
                          {m.is_active
                            ? <Badge label="نشط" type="active" />
                            : <Badge label="معطّل" type="expired" />}
                        </td>
                        <td style={{ padding: "12px 16px" }}>
                          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                            <Button variant="ghost" size="sm" onClick={() => openEdit(m)} style={{ color: "var(--accent2)" }}>تعديل</Button>
                            {isOwner && (
                              <Button variant="ghost" size="sm" onClick={() => { setResetId(m.id); setCustomPass(""); setResetModal(true); }} style={{ color: "var(--accent3)" }}>🔑</Button>
                            )}
                            {isOwner && m.is_active && (
                              <Button variant="ghost" size="sm" onClick={() => setDeleteId(m.id)} style={{ color: "var(--danger)" }}>حذف</Button>
                            )}
                            {isOwner && !m.is_active && (
                              <Button variant="ghost" size="sm" onClick={() => reactivateMutation.mutate(m.id)} style={{ color: "var(--accent)" }}>تفعيل</Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {meta.pages > 1 && (
            <div style={{ padding: "12px 20px", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 12, color: "var(--muted)" }}>
                صفحة {page} من {meta.pages} — {meta.total} عضو
              </span>
              <div style={{ display: "flex", gap: 6 }}>
                <Button variant="secondary" size="sm" onClick={() => setPage(p => p - 1)} disabled={page === 1}>السابق</Button>
                <Button variant="secondary" size="sm" onClick={() => setPage(p => p + 1)} disabled={page === meta.pages}>التالي</Button>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Add / Edit form */}
      <MemberForm
        open={showForm}
        onClose={closeForm}
        member={editMember}
        onSuccess={onSuccess}
      />

      {/* Reset password modal */}
      <Modal
        open={resetModal}
        onClose={() => { setResetModal(false); setResetId(null); setCustomPass(""); }}
        title="إعادة تعيين كلمة المرور"
        width={380}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <p style={{ fontSize: 13, color: "var(--muted-lt)", lineHeight: 1.6 }}>
            اترك الحقل فارغاً لإعادة التعيين إلى <strong style={{ color: "var(--text)" }}>رقم الهاتف</strong>، أو أدخل كلمة مرور جديدة مخصصة.
          </p>
          <input
            type="text"
            placeholder="كلمة المرور الجديدة (اختياري)"
            value={customPass}
            onChange={e => setCustomPass(e.target.value)}
            style={{
              width: "100%", padding: "10px 14px",
              background: "var(--surface)", border: "1px solid var(--border)",
              borderRadius: "var(--radius-sm)", color: "var(--text)",
              fontSize: 13, outline: "none", direction: "rtl",
              fontFamily: "'Sora', sans-serif",
            }}
          />
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <Button variant="secondary" onClick={() => { setResetModal(false); setResetId(null); setCustomPass(""); }}>
              إلغاء
            </Button>
            <Button
              onClick={() => resetPasswordMutation.mutate({ id: resetId, newPassword: customPass })}
              loading={resetPasswordMutation.isPending}
              style={{ background: "var(--accent3)", color: "#0d0f14" }}
            >
              تأكيد إعادة التعيين
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete confirm */}
      <Confirm
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={() => deleteMutation.mutate(deleteId)}
        loading={deleteMutation.isPending}
        title="تأكيد إلغاء التفعيل"
        message="سيتم إلغاء تفعيل هذا العضو وسيفقد صلاحية الوصول. يمكنك إعادة تفعيله لاحقاً."
      />
    </>
  );
}