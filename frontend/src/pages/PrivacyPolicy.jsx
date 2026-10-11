// src/pages/PrivacyPolicy.jsx
// صفحة سياسة الخصوصية — عامة بالكامل، لا تتطلب تسجيل دخول أو أي صلاحية.
// ⚠️ هذا الملف يجب أن يكون متاحاً للجميع دون أي حارس مصادقة (auth guard).
export default function PrivacyPolicy() {
  return (
    <div style={{
      minHeight: "100vh", background: "#0d0f14", color: "#e5e7eb",
      padding: "40px 20px", direction: "rtl", fontFamily: "'Sora', system-ui, sans-serif",
    }}>
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <img src="/logo.png" alt="SGMS" style={{ width: 56, height: 56, borderRadius: 14, margin: "0 auto 12px", display: "block" }} />
          <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 6 }}>سياسة الخصوصية — SGMS Athlete</h1>
          <p style={{ fontSize: 13, color: "#9ca3af" }}>آخر تحديث: 11 أكتوبر 2026</p>
        </div>

        <div style={{ lineHeight: 1.9, fontSize: 15 }}>
          <p>
            يُرحّب تطبيق <strong>SGMS Athlete</strong> (التابع لمنصة SGMS لإدارة الصالات الرياضية) بك، ويلتزم بحماية
            خصوصية مستخدميه. توضّح هذه السياسة البيانات التي يجمعها التطبيق، وكيفية استخدامها وحمايتها.
          </p>

          <h2 style={sectionStyle}>1. البيانات التي نجمعها</h2>
          <ul style={listStyle}>
            <li>معلومات الحساب: الاسم الكامل، رقم الهاتف، البريد الإلكتروني (إن وُجد).</li>
            <li>بيانات الاشتراك والحضور داخل الصالة الرياضية المسجَّل بها.</li>
            <li>بيانات التقدّم الرياضي (الرتب، المقاييس) التي يُدخلها المدرب أو الصالة.</li>
            <li>رمز إشعارات الجهاز (FCM Token) لإرسال التنبيهات (مواعيد الحصص، انتهاء الاشتراك...).</li>
          </ul>

          <h2 style={sectionStyle}>2. كيف نستخدم بياناتك</h2>
          <ul style={listStyle}>
            <li>عرض جدول الحصص، سجل الحضور، وحالة الاشتراك الخاصة بك.</li>
            <li>إرسال إشعارات متعلقة بحسابك (تذكير بحصة، انتهاء اشتراك، تحديثات من الصالة).</li>
            <li>تحسين خدمة التطبيق وإصلاح الأعطال التقنية.</li>
          </ul>

          <h2 style={sectionStyle}>3. مشاركة البيانات</h2>
          <p>
            لا نبيع أو نؤجّر بياناتك الشخصية لأي طرف ثالث. تُستخدم بياناتك فقط داخل نطاق الصالة الرياضية التي أنت
            عضو فيها، ومن قِبل الطاقم المخوَّل بذلك (المالك، المدربون) لغرض إدارة اشتراكك وحضورك.
          </p>

          <h2 style={sectionStyle}>4. أمان البيانات</h2>
          <p>
            تُخزَّن بياناتك على خوادم مؤمَّنة، ويُحمى الوصول إليها بكلمة مرور مشفَّرة وبروتوكولات اتصال آمنة (HTTPS).
          </p>

          <h2 style={sectionStyle}>5. حقوقك</h2>
          <ul style={listStyle}>
            <li>يمكنك طلب تعديل أو حذف بياناتك الشخصية بالتواصل مع إدارة صالتك الرياضية مباشرة.</li>
            <li>يمكنك إلغاء تفعيل الإشعارات من إعدادات جهازك في أي وقت.</li>
          </ul>

          <h2 style={sectionStyle}>6. بيانات الأطفال</h2>
          <p>
            إذا كان الرياضي قاصراً، تُدار حساباته من طرف ولي الأمر المسجَّل، وتُطبَّق نفس معايير الحماية المذكورة أعلاه.
          </p>

          <h2 style={sectionStyle}>7. التواصل معنا</h2>
          <p>
            لأي استفسار بخصوص هذه السياسة أو بياناتك، يرجى التواصل مع إدارة صالتك الرياضية المسجَّل بها على SGMS.
          </p>
        </div>
      </div>
    </div>
  );
}

const sectionStyle = { fontSize: 17, fontWeight: 700, marginTop: 28, marginBottom: 10, color: "#fff" };
const listStyle = { paddingRight: 20, marginBottom: 14 };