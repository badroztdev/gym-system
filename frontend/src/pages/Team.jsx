// src/pages/Team.jsx
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import PageHeader from "@/components/layout/PageHeader";
import { Button, Badge, Spinner, Empty, Confirm } from "@/components/ui";
import StaffForm from "@/components/team/StaffForm";
import CategoryForm from "@/components/team/CategoryForm";
import { staffService } from "@/services/staff.service";
import { categoriesService } from "@/services/categories.service";
import { useAuthStore } from "@/store/authStore";
import toast from "react-hot-toast";

const getTabs = (t) => [
  { id: "staff",      label: t("team.tabStaff"),      icon: "🧑‍🏫" },
  { id: "categories", label: t("team.tabCategories"), icon: "🏷️" },
];

// ════════════════════════════════════════════════════════════
//  Tab 1 — المدربون والمساعدون
// ════════════════════════════════════════════════════════════
function StaffTab() {
  const { t } = useTranslation();
  const ROLE_LABELS = { owner: t("common.owner"), coach: t("common.coach"), assistant: t("common.assistant") };
  const qc = useQueryClient();
  const { user } = useAuthStore();
  const isOwner = user?.role === "owner";

  const [showForm, setShowForm] = useState(false);
  const [editStaff, setEditStaff] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [showInactive, setShowInactive] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["staff", showInactive],
    queryFn: () => staffService.getAll({ includeInactive: showInactive ? "true" : "false" }),
  });
  const staff = data?.data || [];

  const refresh = () => qc.invalidateQueries({ queryKey: ["staff"] });

  const deleteMutation = useMutation({
    mutationFn: staffService.remove,
    onSuccess: () => { toast.success(t("team.toastStaffDisabled")); refresh(); setDeleteId(null); },
  });

  const reactivateMutation = useMutation({
    mutationFn: (id) => staffService.update(id, { isActive: true }),
    onSuccess: () => { toast.success(t("team.toastStaffActivated")); refresh(); },
  });

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
        <button onClick={() => setShowInactive(v => !v)} style={{
          padding: "8px 14px", fontSize: 12, borderRadius: "var(--radius-sm)",
          border: "1px solid " + (showInactive ? "var(--danger)" : "var(--border)"),
          background: showInactive ? "var(--danger)15" : "var(--card)",
          color: showInactive ? "var(--danger)" : "var(--muted)",
          cursor: "pointer", fontFamily: "'Sora', sans-serif", fontWeight: 500,
        }}>{showInactive ? t("team.showingInactive") : t("team.showInactive")}</button>

        {isOwner && (
          <Button icon="+" onClick={() => { setEditStaff(null); setShowForm(true); }}>{t("team.newStaff")}</Button>
        )}
      </div>

      {isLoading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: 48 }}><Spinner size={32} /></div>
      ) : staff.length === 0 ? (
        <Empty icon="🧑‍🏫" title={t("team.noStaff")} description={t("team.addFirstStaff")} />
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 14 }}>
          {staff.map(s => (
            <div key={s.id} className="fade-in" style={{
              background: "var(--card)", border: "1px solid var(--border)",
              borderRadius: "var(--radius)", padding: 18,
              opacity: s.is_active ? 1 : 0.5,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                <div style={{
                  width: 44, height: 44, borderRadius: "50%",
                  background: s.role === "owner" ? "var(--accent2)20" : "var(--accent3)20",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 17, fontWeight: 700,
                  color: s.role === "owner" ? "var(--accent2)" : "var(--accent3)",
                  flexShrink: 0,
                }}>{s.full_name[0]}</div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.full_name}</div>
                  <div className="mono" style={{ fontSize: 11, color: "var(--muted)" }}>{s.phone}</div>
                </div>
              </div>

              <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
                <Badge label={ROLE_LABELS[s.role] || s.role} type={s.role === "owner" ? "guardian" : "coach"} />
                {!s.is_active && <Badge label={t("team.staffInactive")} type="expired" />}
                <span style={{ fontSize: 11, color: "var(--muted)" }}>📅 {t("team.sessionsCount", { count: s.sessions_count })}</span>
              </div>

              {s.role !== "owner" && (
                <div style={{ display: "flex", gap: 6, borderTop: "1px solid var(--border)", paddingTop: 10 }}>
                  <Button variant="secondary" size="sm" onClick={() => { setEditStaff(s); setShowForm(true); }} style={{ flex: 1, justifyContent: "center" }}>{t("team.staffEdit")}</Button>
                  {isOwner && (
                    s.is_active ? (
                      <Button variant="danger" size="sm" onClick={() => setDeleteId(s.id)} style={{ flex: 1, justifyContent: "center" }}>{t("team.staffDisable")}</Button>
                    ) : (
                      <Button variant="secondary" size="sm" loading={reactivateMutation.isPending} onClick={() => reactivateMutation.mutate(s.id)} style={{ flex: 1, justifyContent: "center", color: "var(--accent)" }}>{t("team.staffActivate")}</Button>
                    )
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <StaffForm open={showForm} onClose={() => { setShowForm(false); setEditStaff(null); }} staff={editStaff} onSuccess={refresh} />

      <Confirm
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={() => deleteMutation.mutate(deleteId)}
        loading={deleteMutation.isPending}
        title={t("team.disableStaffTitle")}
        message={t("team.disableStaffMessage")}
      />
    </>
  );
}

// ════════════════════════════════════════════════════════════
//  Tab 2 — الفئات الرياضية
// ════════════════════════════════════════════════════════════
function CategoriesTab() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { user } = useAuthStore();
  const isOwner = user?.role === "owner";

  const [showForm, setShowForm] = useState(false);
  const [editCategory, setEditCategory] = useState(null);
  const [deleteId, setDeleteId] = useState(null);

  const { data, isLoading } = useQuery({
    queryKey: ["categories-page"],
    queryFn: () => categoriesService.getAll({ includeInactive: "true" }),
  });
  const categories = data?.data || [];

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["categories-page"] });
    qc.invalidateQueries({ queryKey: ["categories"] });
  };

  const deleteMutation = useMutation({
    mutationFn: categoriesService.remove,
    onSuccess: () => { toast.success(t("team.toastCategoryDisabled")); refresh(); setDeleteId(null); },
  });

  const reactivateMutation = useMutation({
    mutationFn: (id) => categoriesService.update(id, { isActive: true }),
    onSuccess: () => { toast.success(t("team.toastCategoryActivated")); refresh(); },
  });

  return (
    <>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
        {isOwner && <Button icon="+" onClick={() => { setEditCategory(null); setShowForm(true); }}>{t("team.newCategory")}</Button>}
      </div>

      {isLoading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: 48 }}><Spinner size={32} /></div>
      ) : categories.length === 0 ? (
        <Empty icon="🏷️" title={t("team.noCategories")} description={t("team.addFirstCategory")} />
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 12 }}>
          {categories.map(c => (
            <div key={c.id} className="fade-in" style={{
              background: "var(--card)", border: "1px solid var(--border)",
              borderRadius: "var(--radius)", padding: 16,
              opacity: c.is_active ? 1 : 0.5,
              borderTop: `3px solid ${c.color}`,
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 12, height: 12, borderRadius: "50%", background: c.color }} />
                  <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text)" }}>{c.name}</span>
                </div>
                {!c.is_active && <Badge label={t("team.categoryInactive")} type="expired" />}
              </div>

              <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 12 }}>
                {t("team.categoryStats", { plans: c.plans_count, sessions: c.sessions_count })}
              </div>

              {isOwner && (
                <div style={{ display: "flex", gap: 6 }}>
                  <Button variant="secondary" size="sm" onClick={() => { setEditCategory(c); setShowForm(true); }} style={{ flex: 1, justifyContent: "center" }}>{t("team.categoryEdit")}</Button>
                  {c.is_active ? (
                    <Button variant="danger" size="sm" onClick={() => setDeleteId(c.id)} style={{ flex: 1, justifyContent: "center" }}>{t("team.categoryDisable")}</Button>
                  ) : (
                    <Button variant="secondary" size="sm" loading={reactivateMutation.isPending} onClick={() => reactivateMutation.mutate(c.id)} style={{ flex: 1, justifyContent: "center", color: "var(--accent)" }}>{t("team.categoryActivate")}</Button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <CategoryForm open={showForm} onClose={() => { setShowForm(false); setEditCategory(null); }} category={editCategory} onSuccess={refresh} />

      <Confirm
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={() => deleteMutation.mutate(deleteId)}
        loading={deleteMutation.isPending}
        title={t("team.disableCategoryTitle")}
        message={t("team.disableCategoryMessage")}
      />
    </>
  );
}

// ════════════════════════════════════════════════════════════
//  Page
// ════════════════════════════════════════════════════════════
export default function TeamPage() {
  const { t } = useTranslation();
  const TABS = getTabs(t);
  const [tab, setTab] = useState("staff");

  return (
    <>
      <PageHeader title={t("team.pageTitle")} subtitle={t("team.pageSubtitle")}>
        <div style={{ display: "flex", gap: 4, background: "var(--surface)", borderRadius: "var(--radius-sm)", padding: 4 }}>
          {TABS.map(tabItem => (
            <button key={tabItem.id} onClick={() => setTab(tabItem.id)} style={{
              padding: "7px 16px", fontSize: 12, fontWeight: 600,
              borderRadius: "var(--radius-sm)", border: "none",
              background: tab === tabItem.id ? "var(--accent)" : "transparent",
              color: tab === tabItem.id ? "#0d0f14" : "var(--muted)",
              cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
              fontFamily: "'Sora', sans-serif", transition: "all 0.15s",
            }}>
              <span>{tabItem.icon}</span>{tabItem.label}
            </button>
          ))}
        </div>
      </PageHeader>

      <main style={{ padding: "24px 28px", flex: 1 }}>
        {tab === "staff"      && <StaffTab />}
        {tab === "categories" && <CategoriesTab />}
      </main>
    </>
  );
}
