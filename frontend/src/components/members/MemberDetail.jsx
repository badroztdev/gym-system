// src/components/members/MemberDetail.jsx
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { Modal, Badge, Spinner, Empty } from "@/components/ui";
import { membersService } from "@/services/members.service";

const ROLE_LABEL_KEYS = { athlete: "members.roleAthlete", guardian: "members.roleGuardian" };
const CATEGORY_LABEL_KEYS = {
  "مدارس": "members.categorySchools", "كتاكيت": "members.categoryChicks",
  "براعم": "members.categoryBuds", "أصاغر": "members.categoryYoungCubs",
  "أشبال": "members.categoryCubs", "أواسط": "members.categoryMids",
  "أمال": "members.categoryHopes", "أكابر": "members.categorySeniors",
};

function InfoRow({ label, value }) {
  if (value === null || value === undefined || value === "") return null;
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--border)" }}>
      <span style={{ fontSize: 12, color: "var(--muted)" }}>{label}</span>
      <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text)" }}>{value}</span>
    </div>
  );
}

export default function MemberDetail({ open, onClose, memberId }) {
  const { t, i18n } = useTranslation();

  const { data, isLoading } = useQuery({
    queryKey: ["member-detail-full", memberId],
    queryFn: () => membersService.getOne(memberId),
    enabled: open && !!memberId,
  });

  const m = data?.data;

  const SUB_STATUS_KEYS = {
    active: "subscriptions.statusActive", expired: "subscriptions.statusExpired",
    cancelled: "subscriptions.statusCancelled", suspended: "subscriptions.statusSuspended",
  };

  return (
    <Modal open={open} onClose={onClose} title={m ? m.full_name : t("members.title")} width={560}>
      {isLoading || !m ? (
        <div style={{ display: "flex", justifyContent: "center", padding: 48 }}><Spinner size={32} /></div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>

          {/* رأس: الصورة الرمزية + الاسم + الحالة */}
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{
              width: 56, height: 56, borderRadius: "50%", flexShrink: 0,
              background: "var(--accent)20", color: "var(--accent)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 22, fontWeight: 700,
            }}>{m.full_name?.[0]}</div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 17, fontWeight: 700, color: "var(--text)" }}>{m.full_name}</div>
              <div style={{ display: "flex", gap: 6, marginTop: 4, flexWrap: "wrap" }}>
                <Badge label={t(ROLE_LABEL_KEYS[m.role] || m.role)} type={m.role === "guardian" ? "guardian" : "athlete"} />
                <Badge label={m.is_active ? t("members.badgeActive") : t("members.badgeInactive")} type={m.is_active ? "active" : "expired"} />
              </div>
            </div>
          </div>

          {/* المعلومات الأساسية */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: "var(--accent)", letterSpacing: "0.08em", borderBottom: "1px solid var(--border)", paddingBottom: 6, marginBottom: 4 }}>
              {t("memberForm.sectionBasic")}
            </div>
            <InfoRow label={t("staffForm.phone")} value={<span className="mono">{m.phone}</span>} />
            <InfoRow label={t("memberForm.email")} value={m.email} />
            <InfoRow label={t("memberForm.gender")} value={m.gender === "male" ? t("memberForm.male") : m.gender === "female" ? t("memberForm.female") : null} />
            <InfoRow label={t("memberForm.dateOfBirth")} value={m.date_of_birth?.slice(0,10)} />
          </div>

          {/* المعلومات الرياضية (للرياضي فقط) */}
          {m.role === "athlete" && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: "var(--accent)", letterSpacing: "0.08em", borderBottom: "1px solid var(--border)", paddingBottom: 6, marginBottom: 4 }}>
                {t("memberForm.sectionSport")}
              </div>
              <InfoRow label={t("memberForm.ageCategory")} value={m.age_category ? t(CATEGORY_LABEL_KEYS[m.age_category] || m.age_category) : null} />
              <InfoRow label={t("memberForm.group")} value={m.group_name} />
              <InfoRow label={t("memberForm.rank")} value={m.rank} />
              <InfoRow label={t("memberForm.weight")} value={m.weight_kg ? `${m.weight_kg} ${t("common.kg")}` : null} />
              <InfoRow label={t("memberForm.bloodGroup")} value={m.blood_group} />
            </div>
          )}

          {/* ولي الأمر المرتبط (للرياضي) */}
          {m.role === "athlete" && m.currentGuardian && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: "var(--accent)", letterSpacing: "0.08em", borderBottom: "1px solid var(--border)", paddingBottom: 6, marginBottom: 4 }}>
                {t("memberForm.guardianLink")}
              </div>
              <InfoRow label={t("staffForm.fullName")} value={m.currentGuardian.full_name} />
              <InfoRow label={t("staffForm.phone")} value={<span className="mono">{m.currentGuardian.phone}</span>} />
            </div>
          )}

          {/* الاشتراكات */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: "var(--accent)", letterSpacing: "0.08em", borderBottom: "1px solid var(--border)", paddingBottom: 6, marginBottom: 8 }}>
              {t("subscriptions.tabSubscriptions")} ({m.subscriptions?.length || 0})
            </div>
            {!m.subscriptions?.length ? (
              <div style={{ fontSize: 12, color: "var(--muted)", textAlign: "center", padding: 12 }}>{t("subscriptions.noSubscriptions")}</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {m.subscriptions.map(s => (
                  <div key={s.id} style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    background: "var(--surface)", borderRadius: "var(--radius-sm)", padding: "8px 12px",
                  }}>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text)" }}>{s.plan_name}</div>
                      <div className="mono" style={{ fontSize: 10, color: "var(--muted)" }}>{s.start_date?.slice(0,10)} → {s.end_date?.slice(0,10)}</div>
                    </div>
                    <Badge label={t(SUB_STATUS_KEYS[s.status] || s.status)} type={s.status === "active" ? "active" : "expired"} />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* آخر الحضور */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: "var(--accent)", letterSpacing: "0.08em", borderBottom: "1px solid var(--border)", paddingBottom: 6, marginBottom: 8 }}>
              {t("dashboard.statAttendance30")}
            </div>
            {!m.recentAttendance?.length ? (
              <div style={{ fontSize: 12, color: "var(--muted)", textAlign: "center", padding: 12 }}>{t("attendance.noRecentSessions")}</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 180, overflowY: "auto" }}>
                {m.recentAttendance.map((a, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 11, padding: "4px 0" }}>
                    <span style={{ color: "var(--text)" }}>{a.title}</span>
                    <span className="mono" style={{ color: "var(--muted)" }}>{a.session_date?.slice(0,10)}</span>
                    <Badge
                      label={a.status === "present" ? t("sessions.statusPresent") : a.status === "late" ? t("sessions.statusLate") : t("sessions.statusAbsent")}
                      type={a.status === "present" ? "active" : a.status === "late" ? "pending" : "expired"}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}
