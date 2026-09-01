// src/pages/SuperAdmin.jsx
import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { superadminService } from "@/services/superadmin.service";
import { useAuthStore } from "@/store/authStore";
import toast from "react-hot-toast";

const STATUS_INFO = {
  trial:     { label: "تجريبي", color: "#818cf8" },
  active:    { label: "نشط",    color: "#6ee7b7" },
  suspended: { label: "معلّق",  color: "#fbbf24" },
  cancelled: { label: "ملغى",   color: "#f87171" },
};

function StatCard({ label, value, color }) {
  return (
    <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "16px 20px" }}>
      <div className="mono" style={{ fontSize: 24, fontWeight: 700, color }}>{value ?? "—"}</div>
      <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>{label}</div>
    </div>
  );
}

function GymDetailModal({ gymId, onClose }) {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["gym-detail", gymId],
    queryFn: () => superadminService.getGymDetail(gymId),
    enabled: !!gymId,
  });
  const gym = data?.data;

  const statusMutation = useMutation({
    mutationFn: (status) => superadminService.updateGymStatus(gymId, { status }),
    onSuccess: () => {
      toast.success("تم تحديث حالة الصالة ✅");
      qc.invalidateQueries({ queryKey: ["gym-detail", gymId] });
      qc.invalidateQueries({ queryKey: ["superadmin-gyms"] });
    },
  });

  if (!gymId) return null;

  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.7)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        width: "100%", maxWidth: 480, maxHeight: "85vh", overflowY: "auto",
        background: "var(--card)", border: "1px solid var(--border)",
        borderRadius: 18, padding: 24,
      }}>
        {!gym ? (
          <div style={{ textAlign: "center", padding: 40, color: "var(--muted)" }}>جاري التحميل...</div>
        ) : (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 700, color: "var(--text)" }}>{gym.name}</div>
                <div className="mono" style={{ fontSize: 11, color: "var(--muted)" }}>/{gym.slug}</div>
              </div>
              <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--muted)", fontSize: 18, cursor: "pointer" }}>✕</button>
            </div>

            {gym.owner && (
              <div style={{ background: "var(--surface)", borderRadius: "var(--radius-sm)", padding: 12, marginBottom: 14 }}>
                <div style={{ fontSize: 11, color: "var(--muted)" }}>المالك</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text)" }}>{gym.owner.full_name}</div>
                <div className="mono" style={{ fontSize: 12, color: "var(--muted-lt)" }}>{gym.owner.phone}</div>
                {gym.owner.email && <div style={{ fontSize: 12, color: "var(--muted-lt)" }}>{gym.owner.email}</div>}
              </div>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 16 }}>
              <StatCard label="رياضيون" value={gym.counts?.athletes} color="var(--accent2)" />
              <StatCard label="حصص" value={gym.counts?.sessions} color="var(--accent)" />
              <StatCard label="اشتراكات نشطة" value={gym.counts?.active_subs} color="var(--accent3)" />
            </div>

            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 8 }}>حالة الاشتراك الحالية</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {Object.entries(STATUS_INFO).map(([key, info]) => (
                  <button
                    key={key}
                    onClick={() => statusMutation.mutate(key)}
                    disabled={statusMutation.isPending}
                    style={{
                      padding: "8px 14px", fontSize: 12, fontWeight: 600, borderRadius: 20,
                      border: `1px solid ${gym.subscription_status === key ? info.color : "var(--border)"}`,
                      background: gym.subscription_status === key ? info.color + "20" : "transparent",
                      color: gym.subscription_status === key ? info.color : "var(--muted)",
                      cursor: "pointer", fontFamily: "'Sora', sans-serif",
                    }}
                  >
                    {info.label}
                  </button>
                ))}
              </div>
            </div>

            {gym.activity?.length > 0 && (
              <div>
                <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 8 }}>آخر الأنشطة</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {gym.activity.slice(0, 8).map((a, i) => (
                    <div key={i} style={{ fontSize: 11, color: "var(--muted-lt)", display: "flex", justifyContent: "space-between" }}>
                      <span>{a.action}</span>
                      <span className="mono">{new Date(a.created_at).toLocaleDateString("ar-DZ")}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default function SuperAdminPage() {
  const user     = useAuthStore(s => s.user);
  const logout   = useAuthStore(s => s.logout);
  const navigate = useNavigate();

  // حماية إضافية على مستوى الواجهة (الحماية الفعلية موجودة أصلاً في الـ backend)
  if (user?.role !== "super_admin") {
    return <Navigate to="/dashboard" replace />;
  }

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [selectedGymId, setSelectedGymId] = useState(null);

  const { data: overviewData } = useQuery({ queryKey: ["superadmin-overview"], queryFn: superadminService.getOverview });
  const overview = overviewData?.data || {};

  const { data: gymsData, isLoading } = useQuery({
    queryKey: ["superadmin-gyms", { search, statusFilter }],
    queryFn: () => superadminService.getGyms({ search, status: statusFilter, limit: 50 }),
  });
  const gyms = gymsData?.data || [];

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", padding: "28px", direction: "rtl" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text)", marginBottom: 4 }}>🛠️ لوحة إدارة المنصة</h1>
            <p style={{ fontSize: 13, color: "var(--muted)" }}>إدارة كل الصالات الرياضية المسجَّلة على SGMS</p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ textAlign: "left" }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>{user?.fullName}</div>
              <div style={{ fontSize: 11, color: "var(--muted)" }}>مدير المنصة</div>
            </div>
            <button onClick={handleLogout} style={{
              padding: "8px 16px", fontSize: 12, fontWeight: 600,
              background: "var(--danger)10", border: "1px solid var(--danger)30",
              borderRadius: "var(--radius-sm)", color: "var(--danger)",
              cursor: "pointer", fontFamily: "'Sora', sans-serif",
              whiteSpace: "nowrap",
            }}>
              تسجيل الخروج
            </button>
          </div>
        </div>
        <div style={{ marginBottom: 24 }} />

        {/* إحصائيات المنصة */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12, marginBottom: 24 }}>
          <StatCard label="إجمالي الصالات" value={overview.total_gyms} color="var(--accent2)" />
          <StatCard label="تجريبية" value={overview.trial_gyms} color="#818cf8" />
          <StatCard label="نشطة" value={overview.active_gyms} color="var(--accent)" />
          <StatCard label="معلّقة" value={overview.suspended_gyms} color="var(--warning)" />
          <StatCard label="جديدة هذا الشهر" value={overview.new_this_month} color="var(--accent3)" />
          <StatCard label="إجمالي الرياضيين" value={overview.total_athletes} color="var(--accent2)" />
        </div>

        {/* فلاتر */}
        <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
          <input
            placeholder="ابحث باسم الصالة، الرابط، أو البريد..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              flex: 1, minWidth: 220, padding: "9px 14px",
              background: "var(--card)", border: "1px solid var(--border)",
              borderRadius: "var(--radius-sm)", color: "var(--text)",
              fontSize: 13, outline: "none", direction: "rtl",
            }}
          />
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{
            padding: "8px 14px", fontSize: 12, borderRadius: "var(--radius-sm)",
            border: "1px solid var(--border)", background: "var(--card)",
            color: "var(--text)", outline: "none",
          }}>
            <option value="">كل الحالات</option>
            {Object.entries(STATUS_INFO).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </div>

        {/* جدول الصالات */}
        <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", overflow: "hidden" }}>
          {isLoading ? (
            <div style={{ padding: 40, textAlign: "center", color: "var(--muted)" }}>جاري التحميل...</div>
          ) : gyms.length === 0 ? (
            <div style={{ padding: 40, textAlign: "center", color: "var(--muted)" }}>لا توجد صالات مطابقة</div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "var(--surface)" }}>
                    {["الصالة", "المالك", "الحالة", "رياضيون", "فريق", "أُنشئت", "—"].map(h => (
                      <th key={h} style={{ padding: "10px 14px", fontSize: 11, color: "var(--muted)", textAlign: "right" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {gyms.map(g => {
                    const st = STATUS_INFO[g.subscription_status] || STATUS_INFO.trial;
                    return (
                      <tr key={g.id} style={{ borderTop: "1px solid var(--border)", cursor: "pointer" }}
                        onClick={() => setSelectedGymId(g.id)}
                        onMouseEnter={e => e.currentTarget.style.background = "var(--surface)"}
                        onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                      >
                        <td style={{ padding: "12px 14px" }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>{g.name}</div>
                          <div className="mono" style={{ fontSize: 10, color: "var(--muted)" }}>/{g.slug}</div>
                        </td>
                        <td style={{ padding: "12px 14px", fontSize: 12, color: "var(--muted-lt)" }}>
                          {g.owner_name || "—"}<br/>
                          <span className="mono" style={{ fontSize: 10 }}>{g.owner_phone}</span>
                        </td>
                        <td style={{ padding: "12px 14px" }}>
                          <span style={{ fontSize: 11, padding: "3px 10px", borderRadius: 20, background: st.color + "20", color: st.color, fontWeight: 600 }}>
                            {st.label}
                          </span>
                        </td>
                        <td style={{ padding: "12px 14px" }}>
                          <span className="mono" style={{ fontSize: 12, color: "var(--text)" }}>{g.athletes_count}</span>
                        </td>
                        <td style={{ padding: "12px 14px" }}>
                          <span className="mono" style={{ fontSize: 12, color: "var(--text)" }}>{g.staff_count}</span>
                        </td>
                        <td style={{ padding: "12px 14px" }}>
                          <span className="mono" style={{ fontSize: 11, color: "var(--muted)" }}>
                            {new Date(g.created_at).toLocaleDateString("ar-DZ")}
                          </span>
                        </td>
                        <td style={{ padding: "12px 14px", fontSize: 11, color: "var(--accent2)" }}>عرض ←</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <GymDetailModal gymId={selectedGymId} onClose={() => setSelectedGymId(null)} />
    </div>
  );
}