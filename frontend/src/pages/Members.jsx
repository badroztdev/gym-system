// src/pages/Members.jsx
import { useState, useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { membersService } from "@/services/members.service";
import { useAuthStore } from "@/store/authStore";
import PageHeader from "@/components/layout/PageHeader";
import MemberForm from "@/components/members/MemberForm";
import { Button, Badge, Spinner, Empty, Confirm, Modal } from "@/components/ui";
import toast from "react-hot-toast";

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(typeof window !== "undefined" ? window.innerWidth < 768 : false);
  useEffect(() => {
    const h = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);
  return isMobile;
}

// ── Status helpers ────────────────────────────────────────────
const subStatus = (member, t) => {
  if (!member.sub_status) return { type: "expired", label: t("members.statusNoSub") };
  if (member.sub_status !== "active") return { type: "expired", label: t("members.statusExpired") };
  const days = Math.ceil((new Date(member.sub_end_date) - new Date()) / 86400000);
  if (days <= 7) return { type: "expiring", label: t("members.statusExpiresInDays", { days }) };
  return { type: "active", label: t("members.statusActive") };
};

// ── Stat cards row ────────────────────────────────────────────
function StatsRow() {
  const isMobile = useIsMobile();
  const { t } = useTranslation();
  const { data } = useQuery({ queryKey: ["members-stats"], queryFn: membersService.getStats });
  const stats = data?.data || {};
  const cards = [
    { label: t("members.statTotal"),         value: stats.total,         color: "var(--accent2)" },
    { label: t("members.statActiveSub"),     value: stats.active_subs,    color: "var(--accent)" },
    { label: t("members.statExpiringSoon"),  value: stats.expiring_soon,  color: "var(--warning)" },
    { label: t("members.statNewThisMonth"),  value: stats.new_this_month, color: "var(--accent3)" },
  ];
  return (
    <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4, 1fr)", gap: isMobile ? 10 : 12, marginBottom: isMobile ? 14 : 20 }}>
      {cards.map((c, i) => (
        <div key={i} className={`fade-up d-${i + 1}`} style={{
          background: "var(--card)", border: "1px solid var(--border)",
          borderRadius: "var(--radius)", padding: isMobile ? "12px 14px" : "16px 20px",
        }}>
          <div style={{ fontSize: isMobile ? 18 : 24, fontWeight: 700, color: c.color, fontFamily: "'JetBrains Mono', monospace" }}>
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
  const isMobile = useIsMobile();
  const { t } = useTranslation();
  const statuses = [
    { value: "",         label: t("members.statusAll") },
    { value: "active",   label: t("members.statusActive") },
    { value: "expiring", label: t("members.statusExpiring") },
    { value: "expired",  label: t("members.statusExpired") },
  ];
  // ✅ القيم الفعلية (value) تبقى بالعربية دائماً لأنها تُخزَّن هكذا في قاعدة البيانات
  // فقط التسمية المعروضة (label) تُترجم — يمنع كسر الفلترة عند تبديل اللغة
  const categoryKeys = ["", "مدارس", "كتاكيت", "براعم", "أصاغر", "أشبال", "أواسط", "أمال", "أكابر"];
  const categoryLabels = {
    "مدارس": t("members.categorySchools"), "كتاكيت": t("members.categoryChicks"),
    "براعم": t("members.categoryBuds"), "أصاغر": t("members.categoryYoungCubs"),
    "أشبال": t("members.categoryCubs"), "أواسط": t("members.categoryMids"),
    "أمال": t("members.categoryHopes"), "أكابر": t("members.categorySeniors"),
  };
  const categories = categoryKeys;

  return (
    <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
      <div style={{ position: "relative", flex: 1, minWidth: isMobile ? "100%" : 200 }}>
        <span style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", color: "var(--muted)", fontSize: 14 }}>🔍</span>
        <input
          placeholder={t("members.searchPlaceholder")}
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
            {c ? categoryLabels[c] : t("members.allCategories")}
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
      }}>{showInactive ? t("members.showingInactive") : t("members.showInactive")}</button>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────
export default function MembersPage() {
  const qc = useQueryClient();
  const { t, i18n } = useTranslation();
  const { user } = useAuthStore();
  const isOwner = user?.role === "owner";
  const isMobile = useIsMobile();

  const [search,  setSearch]  = useState("");
  const [status,  setStatus]  = useState("");
  const [ageCategory, setAgeCategory] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [page,    setPage]    = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [editMember, setEditMember] = useState(null);
  const [deleteId,  setDeleteId]  = useState(null);
  const [permanentDeleteId, setPermanentDeleteId] = useState(null);
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
      toast.success(t("members.toastDeactivated"));
      qc.invalidateQueries({ queryKey: ["members"] });
      qc.invalidateQueries({ queryKey: ["members-stats"] });
      setDeleteId(null);
    },
  });

  // ✅ حذف نهائي حقيقي — يُستخدم لإتاحة إعادة استخدام رقم الهاتف لاحقاً
  const permanentDeleteMutation = useMutation({
    mutationFn: membersService.removePermanently,
    onSuccess: (res) => {
      toast.success(res.data?.message || t("members.toastPermanentlyDeleted"));
      qc.invalidateQueries({ queryKey: ["members"] });
      qc.invalidateQueries({ queryKey: ["members-stats"] });
      setPermanentDeleteId(null);
    },
  });

  const reactivateMutation = useMutation({
    mutationFn: (id) => membersService.update(id, { isActive: true }),
    onSuccess: () => {
      toast.success(t("members.toastReactivated"));
      qc.invalidateQueries({ queryKey: ["members"] });
      qc.invalidateQueries({ queryKey: ["members-stats"] });
    },
  });

  const resetPasswordMutation = useMutation({
    mutationFn: ({ id, newPassword }) =>
      membersService.resetPassword(id, newPassword || undefined),
    onSuccess: (res) => {
      toast.success(res.data?.message || t("members.toastPasswordReset"));
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
        title={t("members.title")}
        subtitle={meta.total ? t("members.totalCount", { count: meta.total }) : ""}
        actions={
          <Button icon="+" onClick={() => setShowForm(true)}>
            {t("members.newMember")}
          </Button>
        }
      />

      <main style={{ padding: isMobile ? "14px 12px" : "24px 28px", flex: 1 }}>
        <StatsRow />
        <FiltersBar search={search} status={status} ageCategory={ageCategory} showInactive={showInactive} onSearch={handleSearch} onStatus={handleStatus} onAgeCategory={handleAgeCategory} onToggleInactive={handleToggleInactive} />

        {/* Table */}
        <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", overflow: "hidden" }}>
          {isLoading ? (
            <div style={{ display: "flex", justifyContent: "center", padding: 48 }}>
              <Spinner size={32} />
            </div>
          ) : members.length === 0 ? (
            <Empty icon="👥" title={t("members.noMembers")} description={t("members.addFirstMember")} />
          ) : isMobile ? (
            /* ── عرض بطاقات للهاتف ─────────────────────────── */
            <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: 12 }}>
              {members.map(m => {
                const s = subStatus(m, t);
                const roleMap = { athlete: t("members.roleAthlete"), guardian: t("members.roleGuardian") };
                return (
                  <div key={m.id} className="fade-in" style={{
                    background: "var(--surface)", border: "1px solid var(--border)",
                    borderRadius: "var(--radius-sm)", padding: 14,
                    opacity: m.is_active ? 1 : 0.5,
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                      <div style={{
                        width: 36, height: 36, borderRadius: "50%", flexShrink: 0,
                        background: s.type === "active" ? "var(--accent)20" : s.type === "expiring" ? "var(--warning)20" : "var(--border)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 14, fontWeight: 700,
                        color: s.type === "active" ? "var(--accent)" : s.type === "expiring" ? "var(--warning)" : "var(--muted)",
                      }}>{m.full_name[0]}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.full_name}</div>
                        <div className="mono" style={{ fontSize: 11, color: "var(--muted-lt)" }}>{m.phone}</div>
                      </div>
                      {m.is_active
                        ? <Badge label={t("members.badgeActive")} type="active" />
                        : <Badge label={t("members.badgeInactive")} type="expired" />}
                    </div>

                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
                      <Badge label={roleMap[m.role] || m.role} type={m.role} />
                      {m.age_category && <Badge label={m.age_category} type="athlete" />}
                      {m.group_name && <Badge label={m.group_name} type="guardian" />}
                      <Badge label={s.label} type={s.type} />
                    </div>

                    {(m.rank || m.weight_kg || m.blood_group) && (
                      <div style={{ display: "flex", gap: 14, marginBottom: 10, fontSize: 11, color: "var(--muted-lt)" }}>
                        {m.rank && <span>🏅 {m.rank}</span>}
                        {m.weight_kg && <span className="mono">{m.weight_kg} {t("common.kg")}</span>}
                        {m.blood_group && <span style={{ color: "var(--danger)", fontWeight: 700 }} className="mono">{m.blood_group}</span>}
                      </div>
                    )}

                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", borderTop: "1px solid var(--border)", paddingTop: 10 }}>
                      <Button variant="secondary" size="sm" onClick={() => openEdit(m)} style={{ padding: "4px 8px", fontSize: 10.5, whiteSpace: "nowrap", color: "var(--accent2)" }}>{t("members.actionEdit")}</Button>
                      {isOwner && (
                        <Button variant="secondary" size="sm" onClick={() => { setResetId(m.id); setCustomPass(""); setResetModal(true); }} style={{ color: "var(--accent3)" }}>🔑</Button>
                      )}
                      {isOwner && m.is_active && (
                        <>
                          <Button variant="secondary" size="sm" onClick={() => setDeleteId(m.id)} style={{ padding: "4px 8px", fontSize: 10.5, whiteSpace: "nowrap", color: "var(--danger)" }}>{t("members.actionDelete")}</Button>
                          <Button variant="secondary" size="sm" onClick={() => setPermanentDeleteId(m.id)} style={{ padding: "4px 8px", fontSize: 10.5, whiteSpace: "nowrap", color: "#fff", background: "var(--danger)" }}>{t("members.actionPermanentDelete")}</Button>
                        </>
                      )}
                      {isOwner && !m.is_active && (
                        <Button variant="secondary" size="sm" onClick={() => reactivateMutation.mutate(m.id)} style={{ padding: "4px 8px", fontSize: 10.5, whiteSpace: "nowrap", color: "var(--accent)" }}>{t("members.actionActivate")}</Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", direction: i18n.language === "ar" ? "rtl" : "ltr" }}>
                <thead>
                  <tr style={{ background: "var(--surface)" }}>
                    {[t("members.colMember"), t("members.colRole"), t("members.colPhone"), t("members.colCategory"), t("members.colGroup"), t("members.colRank"), t("members.colWeight"), t("members.colBloodGroup"), t("members.colSubscription"), t("members.colStatus"), t("members.colActions")].map(h => (
                      <th key={h} style={{ padding: "11px 16px", fontSize: 11, color: "var(--muted)", fontWeight: 500, textAlign: i18n.language === "ar" ? "right" : "left", whiteSpace: "nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {members.map((m, i) => {
                    const s = subStatus(m, t);
                    const roleMap = { athlete: t("members.roleAthlete"), guardian: t("members.roleGuardian") };
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
                            {m.weight_kg ? `${m.weight_kg} ${t("common.kg")}` : "—"}
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
                            ? <Badge label={t("members.badgeActive")} type="active" />
                            : <Badge label={t("members.badgeInactive")} type="expired" />}
                        </td>
                        <td style={{ padding: "12px 16px" }}>
                          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                            <Button variant="ghost" size="sm" onClick={() => openEdit(m)} style={{ padding: "4px 8px", fontSize: 10.5, whiteSpace: "nowrap", color: "var(--accent2)" }}>{t("members.actionEdit")}</Button>
                            {isOwner && (
                              <Button variant="ghost" size="sm" onClick={() => { setResetId(m.id); setCustomPass(""); setResetModal(true); }} style={{ color: "var(--accent3)" }}>🔑</Button>
                            )}
                            {isOwner && m.is_active && (
                              <>
                                <Button variant="ghost" size="sm" onClick={() => setDeleteId(m.id)} style={{ padding: "4px 8px", fontSize: 10.5, whiteSpace: "nowrap", color: "var(--danger)" }}>{t("members.actionDelete")}</Button>
                                <Button variant="ghost" size="sm" onClick={() => setPermanentDeleteId(m.id)} style={{ padding: "4px 8px", fontSize: 10.5, whiteSpace: "nowrap", color: "var(--danger)", fontWeight: 700 }}>{t("members.actionPermanentDelete")}</Button>
                              </>
                            )}
                            {isOwner && !m.is_active && (
                              <Button variant="ghost" size="sm" onClick={() => reactivateMutation.mutate(m.id)} style={{ padding: "4px 8px", fontSize: 10.5, whiteSpace: "nowrap", color: "var(--accent)" }}>{t("members.actionActivate")}</Button>
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
                {t("members.paginationInfo", { page, pages: meta.pages, total: meta.total })}
              </span>
              <div style={{ display: "flex", gap: 6 }}>
                <Button variant="secondary" size="sm" onClick={() => setPage(p => p - 1)} disabled={page === 1}>{t("common.previous")}</Button>
                <Button variant="secondary" size="sm" onClick={() => setPage(p => p + 1)} disabled={page === meta.pages}>{t("common.next")}</Button>
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
        title={t("members.resetPasswordTitle")}
        width={380}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <p style={{ fontSize: 13, color: "var(--muted-lt)", lineHeight: 1.6 }}>
            {t("members.resetPasswordDesc")} <strong style={{ color: "var(--text)" }}>{t("members.resetPasswordPhone")}</strong>.
          </p>
          <input
            type="text"
            placeholder={t("members.resetPasswordPlaceholder")}
            value={customPass}
            onChange={e => setCustomPass(e.target.value)}
            style={{
              width: "100%", padding: "10px 14px",
              background: "var(--surface)", border: "1px solid var(--border)",
              borderRadius: "var(--radius-sm)", color: "var(--text)",
              fontSize: 13, outline: "none", direction: i18n.language === "ar" ? "rtl" : "ltr",
              fontFamily: "'Sora', sans-serif",
            }}
          />
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <Button variant="secondary" onClick={() => { setResetModal(false); setResetId(null); setCustomPass(""); }}>
              {t("common.cancel")}
            </Button>
            <Button
              onClick={() => resetPasswordMutation.mutate({ id: resetId, newPassword: customPass })}
              loading={resetPasswordMutation.isPending}
              style={{ background: "var(--accent3)", color: "#0d0f14" }}
            >
              {t("members.resetPasswordConfirm")}
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
        title={t("members.deleteConfirmTitle")}
        message={t("members.deleteConfirmMessage")}
      />

      {/* ✅ تأكيد الحذف النهائي — تحذير أقوى بسبب عدم إمكانية التراجع */}
      <Confirm
        open={!!permanentDeleteId}
        onClose={() => setPermanentDeleteId(null)}
        onConfirm={() => permanentDeleteMutation.mutate(permanentDeleteId)}
        loading={permanentDeleteMutation.isPending}
        title={t("members.permanentDeleteConfirmTitle")}
        message={t("members.permanentDeleteConfirmMessage")}
      />
    </>
  );
}