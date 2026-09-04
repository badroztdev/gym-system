// src/portal/pages/PortalScan.jsx
import { useState, useRef, useEffect } from "react";
import { useOutletContext } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import jsQR from "jsqr";
import { portalService } from "@/portal/services/portal.service";
import { useAuthStore } from "@/store/authStore";
import toast from "react-hot-toast";

export default function PortalScan() {
  const { athlete } = useOutletContext();
  const authToken = useAuthStore(s => s.token);

  // ✅ داخل تطبيق SGMS Athlete (Flutter): مرّر رمز الدخول ومعرّف الرياضي
  // للتطبيق الأصلي، ليتمكن من فتح ماسح QR أصلي أكثر موثوقية من WebView
  useEffect(() => {
    if (window.FlutterScanContext && authToken && athlete?.id) {
      window.FlutterScanContext.postMessage(
        JSON.stringify({ token: authToken, athleteId: athlete.id })
      );
    }
  }, [authToken, athlete?.id]);
  const videoRef   = useRef(null);
  const canvasRef  = useRef(null); // ✅ جديد — قماش مخفي لتحليل الإطارات (مطلوب لـ jsQR)
  const streamRef  = useRef(null);
  const rafRef     = useRef(null); // ✅ جديد — لضمان إيقاف حلقة المسح بشكل نظيف تماماً
  const [scanning, setScanning] = useState(false);
  const [manualCode, setManualCode] = useState("");
  const [result, setResult] = useState(null);
  const [cameraError, setCameraError] = useState(false);

  const scanMutation = useMutation({
    mutationFn: (qrCode) => portalService.scan({ qrCode, athleteId: athlete.id }),
    onSuccess: (res) => {
      setResult({ success: true, message: res.data.message });
      toast.success(res.data.message);
      stopCamera();
    },
    onError: (err) => {
      setResult({ success: false, message: err.response?.data?.message || "فشل تسجيل الحضور" });
    },
  });

  // ── تشغيل الكاميرا ────────────────────────────────────────
  const startCamera = async () => {
    setResult(null);
    setCameraError(false);
    setScanning(true);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      streamRef.current = stream;

      await new Promise(resolve => requestAnimationFrame(resolve));

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        detectLoop();
      } else {
        requestAnimationFrame(() => {
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            videoRef.current.play();
            detectLoop();
          }
        });
      }
    } catch (err) {
      console.error("Camera error:", err);
      setCameraError(true);
      setScanning(false);
    }
  };

  const stopCamera = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    setScanning(false);
  };

  // ── ✅ كشف QR باستخدام jsQR — يعمل على كل المتصفحات (بما فيها Safari/iOS) ──
  // بعكس BarcodeDetector (غير مدعومة إطلاقاً على iOS)، هذه المكتبة تقرأ
  // بيانات البكسل مباشرة من كل إطار فيديو وتحلّلها بنفسها، دون الاعتماد
  // على أي واجهة برمجية خاصة بالمتصفح
  const detectLoop = () => {
    const tick = () => {
      if (!videoRef.current || !streamRef.current || !canvasRef.current) return;

      const video  = videoRef.current;
      const canvas = canvasRef.current;

      if (video.readyState === video.HAVE_ENOUGH_DATA) {
        canvas.width  = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: "dontInvert",
        });

        if (code?.data) {
          scanMutation.mutate(code.data);
          return; // توقف بعد أول قراءة ناجحة
        }
      }

      if (streamRef.current) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  };

  useEffect(() => () => stopCamera(), []);

  const handleManualSubmit = () => {
    if (!manualCode.trim()) return;
    scanMutation.mutate(manualCode.trim());
  };

  return (
    <div style={{ padding: "16px 16px 0", textAlign: "center" }}>
      <h1 style={{ fontSize: 18, fontWeight: 700, color: "var(--text)", marginBottom: 6 }}>تسجيل الحضور</h1>
      <p style={{ fontSize: 12, color: "var(--muted)", marginBottom: 20 }}>
        امسح رمز QR الموجود في القاعة لتسجيل حضورك تلقائياً
      </p>

      <div style={{
        position: "relative", width: "100%", maxWidth: 320, aspectRatio: "1",
        margin: "0 auto 20px", borderRadius: 20, overflow: "hidden",
        background: "var(--card)", border: "1px solid var(--border)",
      }}>
        <video
          ref={videoRef}
          style={{
            width: "100%", height: "100%", objectFit: "cover",
            display: scanning ? "block" : "none",
          }}
          muted
          playsInline
          autoPlay
        />
        {/* ✅ قماش مخفي — يُستخدم داخلياً فقط لتحليل الإطارات، لا يظهر للمستخدم */}
        <canvas ref={canvasRef} style={{ display: "none" }} />

        {scanning ? (
          <div style={{
            position: "absolute", inset: "15%", border: "3px solid var(--accent)",
            borderRadius: 16, boxShadow: "0 0 0 9999px rgba(0,0,0,0.4)",
            pointerEvents: "none",
          }} />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 12 }}>
            <div style={{ fontSize: 48 }}>🔲</div>
            <span style={{ fontSize: 13, color: "var(--muted)" }}>اضغط للبدء</span>
          </div>
        )}
      </div>

      {result && (
        <div style={{
          background: result.success ? "var(--accent)15" : "var(--danger)15",
          border: `1px solid ${result.success ? "var(--accent)40" : "var(--danger)40"}`,
          borderRadius: "var(--radius)", padding: "14px 18px", marginBottom: 16,
          color: result.success ? "var(--accent)" : "var(--danger)",
          fontSize: 13, fontWeight: 600,
        }}>
          {result.success ? "✅" : "❌"} {result.message}
        </div>
      )}

      {!scanning ? (
        <button onClick={startCamera} style={{
          width: "100%", maxWidth: 320, padding: "14px",
          background: "var(--accent)", border: "none", borderRadius: "var(--radius-sm)",
          color: "#0d0f14", fontSize: 15, fontWeight: 700, cursor: "pointer",
          fontFamily: "'Sora', sans-serif", marginBottom: 16,
        }}>
          📷 فتح الكاميرا
        </button>
      ) : (
        <button onClick={stopCamera} style={{
          width: "100%", maxWidth: 320, padding: "14px",
          background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)",
          color: "var(--text)", fontSize: 15, fontWeight: 600, cursor: "pointer",
          fontFamily: "'Sora', sans-serif", marginBottom: 16,
        }}>
          إيقاف الكاميرا
        </button>
      )}

      {cameraError && (
        <div style={{ maxWidth: 320, margin: "0 auto", textAlign: "right" }}>
          <p style={{ fontSize: 12, color: "var(--warning)", marginBottom: 10, textAlign: "center" }}>
            ⚠️ تعذّر تشغيل الكاميرا على هذا الجهاز. أدخل الرمز يدوياً:
          </p>
          <input
            value={manualCode}
            onChange={e => setManualCode(e.target.value)}
            placeholder="GYM_ROOM_..."
            style={{
              width: "100%", padding: "12px 14px", background: "var(--surface)",
              border: "1px solid var(--border)", borderRadius: "var(--radius-sm)",
              color: "var(--text)", fontSize: 13, outline: "none",
              fontFamily: "'JetBrains Mono', monospace", marginBottom: 10,
            }}
          />
          <button onClick={handleManualSubmit} disabled={scanMutation.isPending} style={{
            width: "100%", padding: "12px", background: "var(--accent2)",
            border: "none", borderRadius: "var(--radius-sm)", color: "#fff",
            fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "'Sora', sans-serif",
          }}>
            {scanMutation.isPending ? "جاري التسجيل..." : "تسجيل الحضور"}
          </button>
        </div>
      )}
    </div>
  );
}
