// src/pages/Sessions.jsx
import { useState, useEffect, useCallback, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import PageHeader from "@/components/layout/PageHeader";
import { Button, Badge, Spinner, Empty, Confirm, Modal, Input } from "@/components/ui";
import SessionForm from "@/components/sessions/SessionForm";
import { sessionsService } from "@/services/sessions.service";
import { roomsService }    from "@/services/rooms.service";
import { attendanceService } from "@/services/attendance.service";
import { membersService }   from "@/services/members.service";
import { useAuthStore }     from "@/store/authStore";
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

// قراءة QR code بالكاميرا (مكتبة مضمّنة في المتصفح عبر BarcodeDetector)
// أو مجرد حقل نص للإدخال اليدوي كخيار بديل

const TABS = [
  { id: "schedule", label: "الجدول",   icon: "📅" },
  { id: "rooms",    label: "القاعات",  icon: "🏛️" },
  { id: "attendance",label: "الحضور", icon: "✅" },
];

const DAY_NAMES = ["الأحد","الاثنين","الثلاثاء","الأربعاء","الخميس","الجمعة","السبت"];

// الأسبوع الحالي
function getWeekDates() {
  const today = new Date();
  const day = today.getDay();
  const sunday = new Date(today);
  sunday.setDate(today.getDate() - day);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(sunday);
    d.setDate(sunday.getDate() + i);
    return d.toISOString().slice(0, 10);
  });
}

// ════════════════════════════════════════════════════════════
//  Tab 1 — الجدول الأسبوعي
// ════════════════════════════════════════════════════════════
function ScheduleTab() {
  const qc = useQueryClient();
  const [weekOffset, setWeekOffset] = useState(0);
  const [showForm, setShowForm] = useState(false);
  const [editSession, setEditSession] = useState(null);
  const [cancelId, setCancelId] = useState(null);

  const weekDates = useMemo(() => {
    const base = getWeekDates(); // أيام الأسبوع الحالي
    return base.map(d => {
      const date = new Date(d);
      date.setDate(date.getDate() + weekOffset * 7);
      return date.toISOString().slice(0, 10);
    });
  }, [weekOffset]);

  const { data, isLoading } = useQuery({
    queryKey: ["sessions-week", weekOffset],
    queryFn: () => sessionsService.getAll({ dateFrom: weekDates[0], dateTo: weekDates[6] }),
  });
  const sessions = data?.data || [];

  const cancelMutation = useMutation({
    mutationFn: (id) => sessionsService.cancel(id, "ألغيت من لوحة التحكم"),
    onSuccess: () => {
      toast.success("تم إلغاء الحصة");
      qc.invalidateQueries({ queryKey: ["sessions-week"], exact: false });
      setCancelId(null);
    },
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ["sessions-week"], exact: false });

  const today = new Date().toISOString().slice(0, 10);

  const [isMobile, setIsMobile] = useState(typeof window !== "undefined" ? window.innerWidth < 768 : false);
  useEffect(() => {
    const h = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);

  // ── بطاقة حصة واحدة (مشتركة بين العرضين) ─────────────────
  const SessionCard = ({ s, compact = false }) => (
    <div
      onClick={() => { setEditSession(s); setShowForm(true); }}
      style={{
        background: (s.category_color || "var(--accent2)") + "18",
        border: `1px solid ${s.category_color || "var(--accent2)"}50`,
        borderRadius: 8, padding: compact ? "6px 8px" : "12px 14px",
        cursor: "pointer", transition: "opacity 0.15s",
        display: "flex", flexDirection: compact ? "column" : "row",
        gap: compact ? 2 : 14, alignItems: compact ? "flex-start" : "center",
      }}
    >
      {/* شريط اللون */}
      {!compact && (
        <div style={{
          width: 4, alignSelf: "stretch", borderRadius: 4, flexShrink: 0,
          background: s.category_color || "var(--accent2)",
        }} />
      )}

      {/* المعلومات */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* شارات */}
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: compact ? 2 : 4 }}>
          {s.category_name && (
            <span style={{
              fontSize: compact ? 9 : 10, fontWeight: 600,
              padding: "1px 6px", borderRadius: 10,
              background: (s.category_color || "var(--accent2)") + "30",
              color: s.category_color || "var(--accent2)",
            }}>{s.category_name}</span>
          )}
          {(Array.isArray(s.age_category) ? s.age_category : (s.age_category ? [s.age_category] : []))
            .map(cat => (
              <span key={cat} style={{
                fontSize: compact ? 9 : 10, fontWeight: 600,
                padding: "1px 6px", borderRadius: 10,
                background: "var(--accent3)20", color: "var(--accent3)",
              }}>{cat}</span>
            ))}
        </div>
        {/* العنوان */}
        <div style={{
          fontSize: compact ? 11 : 13, fontWeight: 700, color: "var(--text)",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          marginBottom: compact ? 2 : 4,
        }}>{s.title}</div>
        {/* التفاصيل */}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <span className="mono" style={{ fontSize: compact ? 10 : 11, color: "var(--muted-lt)" }}>
            🕐 {s.start_time?.slice(0,5)}–{s.end_time?.slice(0,5)}
          </span>
          <span style={{ fontSize: compact ? 9 : 11, color: "var(--muted)" }}>
            🧑‍🏫 {s.coach_name?.split(" ").slice(0,2).join(" ")}
          </span>
          {s.room_name && (
            <span style={{ fontSize: compact ? 9 : 11, color: "var(--muted)" }}>
              🏛️ {s.room_name}
            </span>
          )}
        </div>
      </div>

      {/* الحضور */}
      <div style={{
        fontSize: compact ? 10 : 12, color: "var(--accent)",
        fontWeight: 600, flexShrink: 0,
        alignSelf: compact ? "flex-start" : "center",
      }}>
        👥 {s.present_count}/{s.enrolled_count}
      </div>
    </div>
  );

  return (
    <>
      {/* ── شريط التنقل ─────────────────────────────────────── */}
      <div style={{
        display: "flex", alignItems: "center",
        justifyContent: "space-between", marginBottom: 16,
        gap: 8, flexWrap: "wrap",
      }}>
        <Button variant="secondary" size="sm" onClick={() => setWeekOffset(w => w - 1)}>← السابق</Button>
        <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text)", textAlign: "center" }}>
          <span className="mono">{weekDates[0].slice(5)}</span>
          <span style={{ color: "var(--muted)", margin: "0 4px" }}>—</span>
          <span className="mono">{weekDates[6].slice(5)}</span>
          {weekOffset === 0 && <div style={{ color: "var(--accent)", fontSize: 10, marginTop: 2 }}>هذا الأسبوع</div>}
        </div>
        <Button variant="secondary" size="sm" onClick={() => setWeekOffset(w => w + 1)}>التالي →</Button>
      </div>

      {isLoading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: 48 }}><Spinner size={32} /></div>
      ) : isMobile ? (
        /* ══ عرض الهاتف: قائمة يومية ══════════════════════════ */
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {weekDates.map((date, i) => {
            const daySessions = sessions.filter(s => (s.session_date || "").slice(0,10) === date);
            const isToday = date === today;
            return (
              <div key={date} style={{
                background: "var(--card)",
                border: `1px solid ${isToday ? "var(--accent)60" : "var(--border)"}`,
                borderRadius: "var(--radius)", overflow: "hidden",
              }}>
                {/* رأس اليوم */}
                <div style={{
                  padding: "10px 16px",
                  background: isToday ? "var(--accent)12" : "var(--surface)",
                  borderBottom: daySessions.length > 0 ? "1px solid var(--border)" : "none",
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: isToday ? "var(--accent)" : "var(--text)" }}>
                      {DAY_NAMES[i]}
                    </span>
                    <span className="mono" style={{ fontSize: 11, color: "var(--muted)" }}>{date.slice(5)}</span>
                    {isToday && <span style={{ fontSize: 10, background: "var(--accent)20", color: "var(--accent)", padding: "1px 8px", borderRadius: 10, fontWeight: 600 }}>اليوم</span>}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    {daySessions.length > 0 && (
                      <span style={{ fontSize: 11, color: "var(--muted)" }}>{daySessions.length} حصة</span>
                    )}
                    <button onClick={() => { setEditSession(null); setShowForm(true); }} style={{
                      width: 28, height: 28, borderRadius: "50%",
                      background: "var(--accent)15", border: "1px solid var(--accent)40",
                      color: "var(--accent)", cursor: "pointer", fontSize: 18, lineHeight: 1,
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>+</button>
                  </div>
                </div>

                {/* الحصص */}
                {daySessions.length > 0 && (
                  <div style={{ padding: "10px 12px", display: "flex", flexDirection: "column", gap: 8 }}>
                    {daySessions.map(s => <SessionCard key={s.id} s={s} compact={false} />)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        /* ══ عرض الحاسوب: جدول 7 أعمدة ═══════════════════════ */
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 8 }}>
          {weekDates.map((date, i) => {
            const daySessions = sessions.filter(s => (s.session_date || "").slice(0,10) === date);
            const isToday = date === today;
            return (
              <div key={date} style={{
                background: "var(--card)",
                border: `1px solid ${isToday ? "var(--accent)50" : "var(--border)"}`,
                borderRadius: "var(--radius)", overflow: "hidden", minHeight: 200,
              }}>
                <div style={{
                  padding: "8px 10px", borderBottom: "1px solid var(--border)",
                  background: isToday ? "var(--accent)10" : "var(--surface)",
                  textAlign: "center",
                }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: isToday ? "var(--accent)" : "var(--muted-lt)" }}>{DAY_NAMES[i]}</div>
                  <div className="mono" style={{ fontSize: 11, color: isToday ? "var(--accent)" : "var(--muted)", marginTop: 2 }}>{date.slice(5)}</div>
                </div>
                <div style={{ padding: 6, display: "flex", flexDirection: "column", gap: 4 }}>
                  {daySessions.length === 0 ? (
                    <div style={{ fontSize: 10, color: "var(--muted)", textAlign: "center", padding: "12px 0" }}>لا توجد حصص</div>
                  ) : (
                    daySessions.map(s => <SessionCard key={s.id} s={s} compact={true} />)
                  )}
                </div>
                <button onClick={() => { setEditSession(null); setShowForm(true); }} style={{
                  width: "100%", padding: "6px", background: "transparent", border: "none",
                  borderTop: "1px solid var(--border)", color: "var(--muted)", cursor: "pointer", fontSize: 16,
                }}>+</button>
              </div>
            );
          })}
        </div>
      )}

      <SessionForm
        open={showForm}
        onClose={() => { setShowForm(false); setEditSession(null); }}
        session={editSession}
        onSuccess={refresh}
      />

      <Confirm
        open={!!cancelId}
        onClose={() => setCancelId(null)}
        onConfirm={() => cancelMutation.mutate(cancelId)}
        loading={cancelMutation.isPending}
        title="إلغاء الحصة"
        message="سيتم إلغاء هذه الحصة نهائياً. لا يمكن التراجع عن هذا الإجراء."
      />
    </>
  );
}

// ════════════════════════════════════════════════════════════
//  Tab 2 — القاعات
// ════════════════════════════════════════════════════════════
function RoomsTab() {
  const qc = useQueryClient();
  const { user } = useAuthStore();
  const isOwner = user?.role === "owner";
  const isMobile = useIsMobile();

  const [showForm, setShowForm] = useState(false);
  const [editRoom, setEditRoom] = useState(null);
  const [qrRoom, setQrRoom] = useState(null);

  const { data, isLoading } = useQuery({ queryKey: ["rooms"], queryFn: roomsService.getAll });
  const rooms = data?.data || [];

  const refresh = () => qc.invalidateQueries({ queryKey: ["rooms"] });

  const regenMutation = useMutation({
    mutationFn: roomsService.regenerateQR,
    onSuccess: () => { toast.success("تم تجديد رمز QR ✅"); refresh(); },
  });

  const deleteMutation = useMutation({
    mutationFn: roomsService.remove,
    onSuccess: () => { toast.success("تم تعطيل القاعة"); refresh(); },
  });

  return (
    <>
      {isOwner && (
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
          <Button icon="+" onClick={() => { setEditRoom(null); setShowForm(true); }}>قاعة جديدة</Button>
        </div>
      )}

      {isLoading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: 48 }}><Spinner size={32} /></div>
      ) : rooms.length === 0 ? (
        <Empty icon="🏛️" title="لا توجد قاعات" description="أضف أول قاعة للبدء" />
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>
          {rooms.map(r => (
            <div key={r.id} style={{
              background: "var(--card)", border: "1px solid var(--border)",
              borderRadius: "var(--radius)", padding: 18, opacity: r.is_active ? 1 : 0.5,
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text)" }}>{r.name}</div>
                  <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
                    👥 {r.capacity} مقعد • 📅 {r.sessions_today} حصص اليوم
                  </div>
                </div>
                {!r.is_active && <Badge label="معطّلة" type="expired" />}
              </div>

              {/* QR Code Display */}
              <div style={{
                background: "var(--surface)", borderRadius: "var(--radius-sm)",
                padding: "10px 12px", marginBottom: 12, display: "flex",
                alignItems: "center", justifyContent: "space-between",
              }}>
                <div>
                  <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 4 }}>رمز QR الثابت للقاعة</div>
                  <div className="mono" style={{ fontSize: 10, color: "var(--accent)", wordBreak: "break-all" }}>
                    {r.qr_code}
                  </div>
                </div>
                <button onClick={() => setQrRoom(r)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 22 }}>🔲</button>
              </div>

              {isOwner && (
                <div style={{ display: "flex", gap: 6 }}>
                  <Button variant="secondary" size="sm" onClick={() => { setEditRoom(r); setShowForm(true); }} style={{ flex: 1, justifyContent: "center" }}>تعديل</Button>
                  <Button variant="secondary" size="sm" loading={regenMutation.isPending} onClick={() => regenMutation.mutate(r.id)} style={{ flex: 1, justifyContent: "center", color: "var(--accent2)" }}>تجديد QR</Button>
                  {r.is_active && <Button variant="danger" size="sm" onClick={() => deleteMutation.mutate(r.id)} style={{ flex: 1, justifyContent: "center" }}>تعطيل</Button>}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* نموذج إضافة/تعديل قاعة */}
      <RoomForm open={showForm} onClose={() => { setShowForm(false); setEditRoom(null); }} room={editRoom} onSuccess={refresh} />

      {/* عرض QR كبير للطباعة */}
      <Modal open={!!qrRoom} onClose={() => setQrRoom(null)} title={`QR Code — ${qrRoom?.name}`} width={380}>
        {qrRoom && (
          <div style={{ textAlign: "center", padding: "20px 0" }}>
            <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 16 }}>
              ضع هذا الرمز في القاعة — الرياضي يمسحه لتسجيل حضوره
            </div>
            {/* QR مبسّط كنص */}
            <div style={{
              background: "#fff", padding: 20, borderRadius: "var(--radius)", display: "inline-block",
              marginBottom: 16,
            }}>
              <QRDisplay value={qrRoom.qr_code} size={200} />
            </div>
            <div className="mono" style={{ fontSize: 12, color: "var(--muted)", wordBreak: "break-all", padding: "0 20px" }}>
              {qrRoom.qr_code}
            </div>
            <Button style={{ marginTop: 16 }} onClick={() => window.print()}>🖨️ طباعة</Button>
          </div>
        )}
      </Modal>
    </>
  );
}

// QR بسيط SVG (بدون مكتبة خارجية)
function QRDisplay({ value, size = 200 }) {
  // استخدام Google Charts API لتوليد QR بسيط
  const url = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(value)}`;
  return <img src={url} alt="QR Code" width={size} height={size} style={{ display: "block" }} />;
}

// نموذج القاعة
function RoomForm({ open, onClose, room, onSuccess }) {
  const isEdit = !!room;
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ name: "", capacity: "20" });

  useEffect(() => {
    if (!open) return;
    setForm({ name: room?.name || "", capacity: String(room?.capacity || 20) });
  }, [open, room]);

  const handleSubmit = async () => {
    if (!form.name.trim()) { toast.error("اسم القاعة مطلوب"); return; }
    setLoading(true);
    try {
      if (isEdit) {
        await roomsService.update(room.id, { name: form.name, capacity: Number(form.capacity) });
        toast.success("تم تحديث القاعة ✅");
      } else {
        await roomsService.create({ name: form.name, capacity: Number(form.capacity) });
        toast.success("تم إضافة القاعة ✅");
      }
      onSuccess?.();
      onClose();
    } catch { } finally { setLoading(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? "تعديل القاعة" : "قاعة جديدة"} width={380}>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <Input label="اسم القاعة *" placeholder="مثال: قاعة A" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
        <Input label="الطاقة الاستيعابية" type="number" min="1" value={form.capacity} onChange={e => setForm(p => ({ ...p, capacity: e.target.value }))} />
        {!isEdit && <p style={{ fontSize: 11, color: "var(--muted)", lineHeight: 1.6, background: "var(--surface)", padding: "10px 12px", borderRadius: "var(--radius-sm)" }}>💡 سيتم توليد رمز QR ثابت للقاعة تلقائياً عند الإنشاء.</p>}
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <Button variant="secondary" onClick={onClose}>إلغاء</Button>
          <Button onClick={handleSubmit} loading={loading}>{isEdit ? "حفظ" : "إنشاء"}</Button>
        </div>
      </div>
    </Modal>
  );
}

// ════════════════════════════════════════════════════════════
//  Tab 3 — الحضور
// ════════════════════════════════════════════════════════════
function AttendanceTab() {
  const isMobile = useIsMobile();
  const [selectedSession, setSelectedSession] = useState(null);
  const [qrInput, setQrInput] = useState("");
  const [scanning, setScanning] = useState(false);

  const { data: todayData } = useQuery({ queryKey: ["sessions-today"], queryFn: sessionsService.getToday });
  const todaySessions = todayData?.data || [];

  const { data: attData, isLoading: attLoading, refetch } = useQuery({
    queryKey: ["attendance-session", selectedSession?.id],
    queryFn:  () => attendanceService.getBySession(selectedSession.id),
    enabled:  !!selectedSession,
  });
  const attendanceList = attData?.data || [];

  const present = attendanceList.filter(a => a.status === "present").length;
  const absent  = attendanceList.filter(a => a.status === "absent").length;
  const late    = attendanceList.filter(a => a.status === "late").length;

  const handleManualStatus = async (athleteId, status) => {
    try {
      await attendanceService.manualRecord({ sessionId: selectedSession.id, athleteId, status });
      toast.success("تم تحديث الحضور");
      refetch();
    } catch {}
  };

  const handleQRScan = async () => {
    if (!qrInput.trim()) return;
    setScanning(true);
    try {
      // في الواجهة نحتاج athleteId — هنا نفترض أن المسح يتم من التطبيق
      // لكن للاختبار يدوياً نطلب من المدير إدخال QR + ID الرياضي
      toast.error("مسح QR متاح من تطبيق الهاتف للرياضي");
    } finally { setScanning(false); }
  };

  const STATUS_COLORS = {
    present: { color: "var(--accent)",  label: "حاضر"  },
    absent:  { color: "var(--danger)",  label: "غائب"  },
    late:    { color: "var(--warning)", label: "متأخر" },
    excused: { color: "var(--muted)",   label: "بعذر"  },
  };
  // حالة افتراضية لمن لم يُسجَّل حضوره/غيابه بعد (status = null من الـ backend)
  const NOT_RECORDED = { color: "var(--muted-lt)", label: "لم يُسجَّل" };

  return (
    <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "280px 1fr", gap: 16, alignItems: "flex-start" }}>
      {/* قائمة حصص اليوم */}
      <div style={{
        background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", overflow: "hidden",
        maxHeight: isMobile ? 260 : "none", overflowY: isMobile ? "auto" : "visible",
      }}>
        <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--border)", fontSize: 13, fontWeight: 600, color: "var(--text)" }}>
          حصص اليوم
        </div>
        {todaySessions.length === 0 ? (
          <div style={{ padding: 24, textAlign: "center", color: "var(--muted)", fontSize: 12 }}>لا توجد حصص اليوم</div>
        ) : (
          todaySessions.map(s => (
            <button key={s.id} onClick={() => setSelectedSession(s)} style={{
              width: "100%", textAlign: "right", padding: "12px 16px",
              background: selectedSession?.id === s.id ? "var(--accent)10" : "transparent",
              border: "none", borderBottom: "1px solid var(--border)",
              borderRight: selectedSession?.id === s.id ? "2px solid var(--accent)" : "2px solid transparent",
              cursor: "pointer",
            }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>{s.title}</div>
              <div className="mono" style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
                {s.start_time?.slice(0,5)} — {s.room_name || "بدون قاعة"}
              </div>
              <div style={{ fontSize: 11, color: "var(--accent)", marginTop: 2 }}>
                ✅ {s.present_count} حاضر
              </div>
            </button>
          ))
        )}
      </div>

      {/* تفاصيل الحضور */}
      <div>
        {!selectedSession ? (
          <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: 48, textAlign: "center", color: "var(--muted)" }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>👈</div>
            <div style={{ fontSize: 13 }}>اختر حصة من القائمة لعرض الحضور</div>
          </div>
        ) : (
          <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", overflow: "hidden" }}>
            {/* رأس */}
            <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: isMobile ? "flex-start" : "center", flexWrap: "wrap", gap: 8 }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text)" }}>{selectedSession.title}</div>
                <div className="mono" style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
                  {selectedSession.start_time?.slice(0,5)} — {selectedSession.room_name}
                </div>
              </div>
              <div style={{ display: "flex", gap: 12, fontSize: 12, flexWrap: "wrap" }}>
                <span style={{ color: "var(--accent)" }}>✅ {present} حاضر</span>
                <span style={{ color: "var(--danger)" }}>❌ {absent} غائب</span>
                <span style={{ color: "var(--warning)" }}>⏰ {late} متأخر</span>
              </div>
            </div>

            {/* قائمة الحضور */}
            {attLoading ? (
              <div style={{ display: "flex", justifyContent: "center", padding: 32 }}><Spinner size={24} /></div>
            ) : attendanceList.length === 0 ? (
              <div style={{ padding: 32, textAlign: "center", color: "var(--muted)", fontSize: 13 }}>
                لا يوجد رياضيون مؤهلون لهذه الحصة (تحقق من الفئة العمرية المحدَّدة للحصة)
              </div>
            ) : isMobile ? (
              /* ── عرض بطاقات للهاتف ─────────────────────────── */
              <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: 12 }}>
                {attendanceList.map(a => {
                  const st = a.status ? (STATUS_COLORS[a.status] || NOT_RECORDED) : NOT_RECORDED;
                  return (
                    <div key={a.athlete_id} style={{
                      background: "var(--surface)", border: "1px solid var(--border)",
                      borderRadius: "var(--radius-sm)", padding: 12,
                    }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>{a.athlete_name}</div>
                          <div className="mono" style={{ fontSize: 11, color: "var(--muted)" }}>{a.athlete_phone}</div>
                        </div>
                        <span style={{ fontSize: 11, padding: "3px 8px", borderRadius: 12, background: st.color + "20", color: st.color, fontWeight: 600 }}>{st.label}</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: 11, color: "var(--muted)" }}>
                          {a.scan_method === "qr_room" ? "🔲 QR" : a.scanned_at ? "✍️ يدوي" : ""}
                          {a.scanned_at && (
                            <span className="mono" style={{ marginRight: 6 }}>
                              {new Date(a.scanned_at).toLocaleTimeString("ar", { hour: "2-digit", minute: "2-digit" })}
                            </span>
                          )}
                        </span>
                        <div style={{ display: "flex", gap: 4 }}>
                          {["present","late","absent","excused"].map(s => (
                            <button key={s} onClick={() => handleManualStatus(a.athlete_id, s)} style={{
                              padding: "4px 8px", fontSize: 11, borderRadius: 5,
                              border: `1px solid ${STATUS_COLORS[s]?.color}40`,
                              background: a.status === s ? STATUS_COLORS[s]?.color + "30" : "transparent",
                              color: STATUS_COLORS[s]?.color, cursor: "pointer",
                            }} title={STATUS_COLORS[s]?.label}>
                              {STATUS_COLORS[s]?.label[0]}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse", direction: "rtl" }}>
                <thead>
                  <tr style={{ background: "var(--surface)" }}>
                    {["الرياضي", "الهاتف", "الفئة", "الحالة", "طريقة التسجيل", "الوقت", "تغيير"].map(h => (
                      <th key={h} style={{ padding: "10px 14px", fontSize: 11, color: "var(--muted)", fontWeight: 500, textAlign: "right" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {attendanceList.map(a => {
                    const st = a.status ? (STATUS_COLORS[a.status] || NOT_RECORDED) : NOT_RECORDED;
                    return (
                      <tr key={a.athlete_id} style={{ borderTop: "1px solid var(--border)" }}>
                        <td style={{ padding: "10px 14px", fontSize: 13, fontWeight: 500, color: "var(--text)" }}>{a.athlete_name}</td>
                        <td className="mono" style={{ padding: "10px 14px", fontSize: 11, color: "var(--muted)" }}>{a.athlete_phone}</td>
                        <td style={{ padding: "10px 14px", fontSize: 11, color: "var(--muted)" }}>{a.age_category || "—"}</td>
                        <td style={{ padding: "10px 14px" }}>
                          <span style={{ fontSize: 11, padding: "3px 8px", borderRadius: 12, background: st.color + "20", color: st.color, fontWeight: 600 }}>{st.label}</span>
                        </td>
                        <td style={{ padding: "10px 14px", fontSize: 11, color: "var(--muted)" }}>
                          {a.scan_method === "qr_room" ? "🔲 QR" : "✍️ يدوي"}
                        </td>
                        <td className="mono" style={{ padding: "10px 14px", fontSize: 11, color: "var(--muted)" }}>
                          {a.scanned_at ? new Date(a.scanned_at).toLocaleTimeString("ar", { hour: "2-digit", minute: "2-digit" }) : "—"}
                        </td>
                        <td style={{ padding: "10px 14px" }}>
                          <div style={{ display: "flex", gap: 4 }}>
                            {["present","late","absent","excused"].map(s => (
                              <button key={s} onClick={() => handleManualStatus(a.athlete_id, s)} style={{
                                padding: "3px 6px", fontSize: 10, borderRadius: 4,
                                border: `1px solid ${STATUS_COLORS[s]?.color}40`,
                                background: a.status === s ? STATUS_COLORS[s]?.color + "30" : "transparent",
                                color: STATUS_COLORS[s]?.color, cursor: "pointer",
                              }} title={STATUS_COLORS[s]?.label}>
                                {STATUS_COLORS[s]?.label[0]}
                              </button>
                            ))}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
//  Page
// ════════════════════════════════════════════════════════════
export default function SessionsPage() {
  const [tab, setTab] = useState("schedule");
  const isMobile = useIsMobile();

  return (
    <>
      <PageHeader title="الحصص والجداول" subtitle={isMobile ? "" : "إدارة الجداول والقاعات ونظام الحضور"}>
        <div style={{ display: "flex", gap: 4, background: "var(--surface)", borderRadius: "var(--radius-sm)", padding: 4 }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              padding: isMobile ? "7px 10px" : "7px 16px", fontSize: 12, fontWeight: 600,
              borderRadius: "var(--radius-sm)", border: "none",
              background: tab === t.id ? "var(--accent)" : "transparent",
              color: tab === t.id ? "#0d0f14" : "var(--muted)",
              cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
              fontFamily: "'Sora', sans-serif", transition: "all 0.15s",
            }}>
              <span>{t.icon}</span>{!isMobile && t.label}
            </button>
          ))}
        </div>
      </PageHeader>

      <main style={{ padding: isMobile ? "14px 12px" : "24px 28px", flex: 1 }}>
        {tab === "schedule"   && <ScheduleTab />}
        {tab === "rooms"      && <RoomsTab />}
        {tab === "attendance" && <AttendanceTab />}
      </main>
    </>
  );
}