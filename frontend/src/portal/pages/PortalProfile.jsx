// src/portal/pages/PortalProfile.jsx
import { useState } from "react";
import { useOutletContext } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { portalService } from "@/portal/services/portal.service";
import { settingsService } from "@/services/settings.service";
import toast from "react-hot-toast";

const STATUS_INFO = {
  active:    { label: "نشط",   color: "var(--accent)" },
  expired:   { label: "منتهي", color: "var(--danger)" },
  suspended: { label: "معلّق", color: "var(--warning)" },
  cancelled: { label: "ملغى",  color: "var(--muted)" },
};

export default function PortalProfile() {
  const { athlete } = useOutletContext();

  // ── تغيير كلمة المرور ────────────────────────────────────────
  const [pwForm, setPwForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [showPwSection, setShowPwSection] = useState(false);

  const passwordMutation = useMutation({
    mutationFn: settingsService.changePassword,
    onSuccess: (res) => {
      toast.success(res.data?.message || "تم تغيير كلمة المرور بنجاح ✅");
      setPwForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      setShowPwSection(false);
    },
  });

  const handlePasswordSubmit = () => {
    if (!pwForm.currentPassword || !pwForm.newPassword) {
      toast.error("يرجى تعبئة جميع الحقول");
      return;
    }
    if (pwForm.newPassword.length < 6) {
      toast.error("كلمة المرور الجديدة يجب أن تكون 6 أحرف على الأقل");
      return;
    }
    if (pwForm.newPassword !== pwForm.confirmPassword) {
      toast.error("كلمة المرور الجديدة غير متطابقة");
      return;
    }
    passwordMutation.mutate({
      currentPassword: pwForm.currentPassword,
      newPassword: pwForm.newPassword,
    });
  };

  const { data: attData } = useQuery({
    queryKey: ["portal-attendance", athlete?.id],
    queryFn: () => portalService.getAttendance(athlete.id),
    enabled: !!athlete?.id,
  });

  const { data: subData } = useQuery({
    queryKey: ["portal-subscriptions", athlete?.id],
    queryFn: () => portalService.getSubscription(athlete.id),
    enabled: !!athlete?.id,
  });

  const attendance    = attData?.data || [];
  const subscriptions = subData?.data || [];

  const STATUS_AR = { present: "حاضر", absent: "غائب", late: "متأخر", excused: "بعذر" };
  const STATUS_COLOR = { present: "var(--accent)", absent: "var(--danger)", late: "var(--warning)", excused: "var(--muted)" };

  if (!athlete) return null;

  return (
    <div style={{ padding: "16px 16px 0" }}>

      {/* بطاقة الرياضي */}
      <div style={{
        background: "var(--card)", border: "1px solid var(--border)",
        borderRadius: 18, padding: 20, marginBottom: 20, textAlign: "center",
      }}>
        <div style={{
          width: 72, height: 72, borderRadius: "50%", margin: "0 auto 12px",
          background: "linear-gradient(135deg, var(--accent), var(--accent2))",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 28, fontWeight: 700, color: "#0d0f14",
        }}>{athlete.full_name?.[0]}</div>
        <div style={{ fontSize: 17, fontWeight: 700, color: "var(--text)" }}>{athlete.full_name}</div>
        <div className="mono" style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>{athlete.phone}</div>

        <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
          {athlete.age_category && (
            <span style={{ fontSize: 11, padding: "3px 10px", borderRadius: 20, background: "var(--accent3)20", color: "var(--accent3)", fontWeight: 600 }}>
              {athlete.age_category}
            </span>
          )}
          {athlete.rank && (
            <span style={{ fontSize: 11, padding: "3px 10px", borderRadius: 20, background: "var(--accent2)20", color: "var(--accent2)", fontWeight: 600 }}>
              {athlete.rank}
            </span>
          )}
        </div>

        {(athlete.weight_kg || athlete.blood_group) && (
          <div style={{ display: "flex", justifyContent: "center", gap: 20, marginTop: 16, paddingTop: 16, borderTop: "1px solid var(--border)" }}>
            {athlete.weight_kg && (
              <div>
                <div style={{ fontSize: 10, color: "var(--muted)" }}>الوزن</div>
                <div className="mono" style={{ fontSize: 15, fontWeight: 700, color: "var(--text)" }}>{athlete.weight_kg} كغ</div>
              </div>
            )}
            {athlete.blood_group && (
              <div>
                <div style={{ fontSize: 10, color: "var(--muted)" }}>زمرة الدم</div>
                <div className="mono" style={{ fontSize: 15, fontWeight: 700, color: "var(--danger)" }}>{athlete.blood_group}</div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* سجل الاشتراكات */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text)", marginBottom: 10 }}>سجل الاشتراكات</div>
        {subscriptions.length === 0 ? (
          <div style={{ textAlign: "center", padding: 20, color: "var(--muted)", fontSize: 12, background: "var(--card)", borderRadius: "var(--radius)" }}>
            لا توجد اشتراكات
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {subscriptions.map(s => {
              const st = STATUS_INFO[s.status] || STATUS_INFO.expired;
              const remaining = Number(s.price) - Number(s.total_paid);
              return (
                <div key={s.id} style={{
                  background: "var(--card)", border: "1px solid var(--border)",
                  borderRadius: "var(--radius-sm)", padding: "12px 14px",
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>{s.plan_name}</span>
                    <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 10, background: st.color + "20", color: st.color, fontWeight: 600 }}>{st.label}</span>
                  </div>
                  <div className="mono" style={{ fontSize: 11, color: "var(--muted)" }}>
                    {s.start_date?.slice(0,10)} → {s.end_date?.slice(0,10)}
                  </div>
                  {remaining > 0 && (
                    <div style={{ fontSize: 11, color: "var(--warning)", marginTop: 4, fontWeight: 600 }}>
                      متبقي: {remaining.toFixed(0)} دج
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* سجل الحضور */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text)", marginBottom: 10 }}>آخر الحضور</div>
        {attendance.length === 0 ? (
          <div style={{ textAlign: "center", padding: 20, color: "var(--muted)", fontSize: 12, background: "var(--card)", borderRadius: "var(--radius)" }}>
            لا يوجد سجل بعد
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {attendance.slice(0, 10).map((a, i) => (
              <div key={i} style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                background: "var(--card)", border: "1px solid var(--border)",
                borderRadius: "var(--radius-sm)", padding: "9px 12px",
              }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text)" }}>{a.title}</div>
                  <div className="mono" style={{ fontSize: 10, color: "var(--muted)" }}>{a.session_date} • {a.start_time?.slice(0,5)}</div>
                </div>
                <span style={{ fontSize: 11, fontWeight: 700, color: STATUS_COLOR[a.status] }}>{STATUS_AR[a.status]}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* تغيير كلمة المرور */}
      <div style={{ marginBottom: 24 }}>
        <button
          onClick={() => setShowPwSection(v => !v)}
          style={{
            width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center",
            background: "var(--card)", border: "1px solid var(--border)",
            borderRadius: "var(--radius)", padding: "14px 16px", cursor: "pointer",
          }}
        >
          <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text)" }}>🔒 تغيير كلمة المرور</span>
          <span style={{ color: "var(--muted)", fontSize: 14 }}>{showPwSection ? "▲" : "▼"}</span>
        </button>

        {showPwSection && (
          <div style={{
            background: "var(--card)", border: "1px solid var(--border)", borderTop: "none",
            borderRadius: "0 0 var(--radius) var(--radius)", padding: 16,
            display: "flex", flexDirection: "column", gap: 12,
          }}>
            <div>
              <label style={{ fontSize: 12, color: "var(--muted-lt)", fontWeight: 500, display: "block", marginBottom: 6 }}>
                كلمة المرور الحالية
              </label>
              <input
                type="password"
                value={pwForm.currentPassword}
                onChange={e => setPwForm(f => ({ ...f, currentPassword: e.target.value }))}
                style={{
                  width: "100%", padding: "11px 14px", background: "var(--surface)",
                  border: "1px solid var(--border)", borderRadius: "var(--radius-sm)",
                  color: "var(--text)", fontSize: 14, outline: "none", textAlign: "right",
                }}
              />
            </div>
            <div>
              <label style={{ fontSize: 12, color: "var(--muted-lt)", fontWeight: 500, display: "block", marginBottom: 6 }}>
                كلمة المرور الجديدة
              </label>
              <input
                type="password"
                value={pwForm.newPassword}
                onChange={e => setPwForm(f => ({ ...f, newPassword: e.target.value }))}
                style={{
                  width: "100%", padding: "11px 14px", background: "var(--surface)",
                  border: "1px solid var(--border)", borderRadius: "var(--radius-sm)",
                  color: "var(--text)", fontSize: 14, outline: "none", textAlign: "right",
                }}
              />
            </div>
            <div>
              <label style={{ fontSize: 12, color: "var(--muted-lt)", fontWeight: 500, display: "block", marginBottom: 6 }}>
                تأكيد كلمة المرور الجديدة
              </label>
              <input
                type="password"
                value={pwForm.confirmPassword}
                onChange={e => setPwForm(f => ({ ...f, confirmPassword: e.target.value }))}
                style={{
                  width: "100%", padding: "11px 14px", background: "var(--surface)",
                  border: "1px solid var(--border)", borderRadius: "var(--radius-sm)",
                  color: "var(--text)", fontSize: 14, outline: "none", textAlign: "right",
                }}
              />
            </div>

            <button
              onClick={handlePasswordSubmit}
              disabled={passwordMutation.isPending}
              style={{
                padding: "12px", background: "var(--accent)", border: "none",
                borderRadius: "var(--radius-sm)", color: "#0d0f14", fontSize: 14,
                fontWeight: 700, cursor: passwordMutation.isPending ? "not-allowed" : "pointer",
                opacity: passwordMutation.isPending ? 0.7 : 1,
                fontFamily: "'Sora', sans-serif", marginTop: 4,
              }}
            >
              {passwordMutation.isPending ? "جاري التغيير..." : "تغيير كلمة المرور"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}