// src/portal/pages/PortalHome.jsx
import { useOutletContext } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { portalService } from "@/portal/services/portal.service";

const STATUS_INFO = {
  active:    { label: "نشط",   color: "var(--accent)" },
  expired:   { label: "منتهي", color: "var(--danger)" },
  suspended: { label: "معلّق", color: "var(--warning)" },
  cancelled: { label: "ملغى",  color: "var(--muted)" },
};

export default function PortalHome() {
  const { athlete } = useOutletContext();

  const { data, isLoading } = useQuery({
    queryKey: ["portal-dashboard", athlete?.id],
    queryFn: () => portalService.getDashboard(athlete.id),
    enabled: !!athlete?.id,
  });

  const d = data?.data;

  if (isLoading || !athlete) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: "var(--muted)" }}>
        جاري التحميل...
      </div>
    );
  }

  const sub = d?.subscription;
  const subStatus = sub ? STATUS_INFO[sub.status] || STATUS_INFO.expired : null;
  const daysLeft = sub ? Math.ceil((new Date(sub.end_date) - new Date()) / 86400000) : null;
  const remaining = sub ? Number(sub.price) - Number(sub.total_paid) : 0;

  return (
    <div style={{ padding: "16px 16px 0" }}>

      {/* ترحيب */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--text)" }}>
          أهلاً، {athlete.full_name?.split(" ")[0]} 👋
        </h1>
        <p style={{ fontSize: 13, color: "var(--muted)", marginTop: 2 }}>
          {new Date().toLocaleDateString("ar-DZ", { weekday: "long", day: "numeric", month: "long" })}
        </p>
      </div>

      {/* بطاقة الاشتراك */}
      {sub ? (
        <div style={{
          background: "linear-gradient(135deg, var(--accent2)20, var(--accent)10)",
          border: "1px solid var(--accent2)30",
          borderRadius: 16, padding: 18, marginBottom: 16,
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 11, color: "var(--muted)" }}>الاشتراك الحالي</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text)", marginTop: 2 }}>{sub.plan_name}</div>
            </div>
            <span style={{
              fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 20,
              background: subStatus.color + "20", color: subStatus.color,
            }}>{subStatus.label}</span>
          </div>

          <div style={{ display: "flex", gap: 16, marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 10, color: "var(--muted)" }}>ينتهي بعد</div>
              <div className="mono" style={{ fontSize: 18, fontWeight: 700, color: daysLeft <= 7 ? "var(--warning)" : "var(--text)" }}>
                {daysLeft > 0 ? `${daysLeft} يوم` : "منتهي"}
              </div>
            </div>
            {sub.sessions_limit && (
              <div>
                <div style={{ fontSize: 10, color: "var(--muted)" }}>الحصص المتبقية</div>
                <div className="mono" style={{ fontSize: 18, fontWeight: 700, color: "var(--text)" }}>
                  {sub.sessions_remaining ?? "—"}/{sub.sessions_limit}
                </div>
              </div>
            )}
          </div>

          {remaining > 0 && (
            <div style={{
              background: "var(--danger)15", border: "1px solid var(--danger)30",
              borderRadius: "var(--radius-sm)", padding: "8px 12px",
              fontSize: 12, color: "var(--danger)", fontWeight: 600,
            }}>
              ⚠️ متبقي {remaining.toFixed(0)} دج
            </div>
          )}
        </div>
      ) : (
        <div style={{
          background: "var(--card)", border: "1px solid var(--border)",
          borderRadius: 16, padding: 20, marginBottom: 16, textAlign: "center",
        }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>🎫</div>
          <div style={{ fontSize: 13, color: "var(--muted)" }}>لا يوجد اشتراك حالياً</div>
        </div>
      )}

      {/* إحصائيات الحضور الشهرية */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 20 }}>
        <StatBox label="حاضر" value={d?.attendanceStats?.present || 0} color="var(--accent)" icon="✅" />
        <StatBox label="غائب" value={d?.attendanceStats?.absent || 0} color="var(--danger)" icon="❌" />
        <StatBox label="متأخر" value={d?.attendanceStats?.late || 0} color="var(--warning)" icon="⏰" />
      </div>

      {/* حصص اليوم */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text)", marginBottom: 10 }}>
          حصص اليوم {d?.todaySessions?.length > 0 && `(${d.todaySessions.length})`}
        </div>

        {!d?.todaySessions?.length ? (
          <div style={{
            background: "var(--card)", border: "1px solid var(--border)",
            borderRadius: "var(--radius)", padding: 24, textAlign: "center", color: "var(--muted)",
          }}>
            <div style={{ fontSize: 24, marginBottom: 6 }}>📭</div>
            <div style={{ fontSize: 12 }}>لا توجد حصص اليوم</div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {d.todaySessions.map(s => (
              <div key={s.id} style={{
                background: "var(--card)",
                border: `1px solid ${s.attended ? "var(--accent)50" : "var(--border)"}`,
                borderRadius: "var(--radius-sm)", padding: "12px 14px",
                display: "flex", alignItems: "center", gap: 12,
              }}>
                <div style={{
                  width: 4, alignSelf: "stretch", borderRadius: 4,
                  background: s.category_color || "var(--accent2)",
                }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>{s.title}</div>
                  <div style={{ display: "flex", gap: 10, marginTop: 4, flexWrap: "wrap" }}>
                    <span className="mono" style={{ fontSize: 11, color: "var(--muted-lt)" }}>
                      🕐 {s.start_time?.slice(0,5)}–{s.end_time?.slice(0,5)}
                    </span>
                    {s.room_name && <span style={{ fontSize: 11, color: "var(--muted)" }}>🏛️ {s.room_name}</span>}
                  </div>
                </div>
                {s.attended && (
                  <span style={{ fontSize: 11, color: "var(--accent)", fontWeight: 700 }}>✓ حضرت</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* آخر الإشعارات */}
      {d?.recentNotifications?.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text)", marginBottom: 10 }}>آخر الإشعارات</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {d.recentNotifications.map(n => (
              <div key={n.id} style={{
                background: "var(--card)", border: "1px solid var(--border)",
                borderRadius: "var(--radius-sm)", padding: "10px 12px",
                opacity: n.is_read ? 0.6 : 1,
              }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text)" }}>{n.title}</div>
                <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>{n.body}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StatBox({ label, value, color, icon }) {
  return (
    <div style={{
      background: "var(--card)", border: "1px solid var(--border)",
      borderRadius: "var(--radius-sm)", padding: "14px 8px", textAlign: "center",
    }}>
      <div style={{ fontSize: 18, marginBottom: 4 }}>{icon}</div>
      <div className="mono" style={{ fontSize: 18, fontWeight: 700, color }}>{value}</div>
      <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 2 }}>{label}</div>
    </div>
  );
}