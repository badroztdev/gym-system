# GymPro — نظام إدارة الصالات الرياضية

## هيكل المشروع

```
gym-system/
├── backend/                    # Node.js + Express API
│   ├── src/
│   │   ├── controllers/        # منطق كل endpoint
│   │   │   ├── auth.controller.js
│   │   │   └── members.controller.js
│   │   ├── middleware/
│   │   │   ├── auth.js         # JWT + RBAC
│   │   │   └── validate.js     # express-validator
│   │   ├── routes/
│   │   │   └── index.js        # كل مسارات API
│   │   ├── utils/
│   │   │   ├── db.js           # PostgreSQL pool
│   │   │   └── response.js     # helpers موحدة
│   │   └── index.js            # Express app entry
│   ├── .env.example
│   └── package.json
│
├── frontend/                   # React + Vite
│   ├── src/
│   │   ├── components/
│   │   │   ├── layout/         # Layout, PageHeader
│   │   │   ├── ui/             # Button, Input, Modal, Badge...
│   │   │   └── members/        # MemberForm
│   │   ├── pages/
│   │   │   ├── Login.jsx
│   │   │   └── Members.jsx     # ✅ مكتملة
│   │   ├── services/
│   │   │   ├── api.js          # Axios + interceptors
│   │   │   └── members.service.js
│   │   ├── store/
│   │   │   └── authStore.js    # Zustand
│   │   ├── styles/
│   │   │   └── globals.css
│   │   ├── App.jsx             # Routes + QueryClient
│   │   └── main.jsx
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
│
└── database/
    └── schema.sql              # PostgreSQL schema كامل
```

---

## إعداد المشروع

### 1. قاعدة البيانات

```bash
# إنشاء قاعدة البيانات
psql -U postgres -c "CREATE DATABASE gym_pro ENCODING 'UTF8' TEMPLATE template0;"

# تشغيل الـ schema
psql -U postgres -d gym_pro -f database/schema.sql
```

### 2. Backend

```bash
cd backend
cp .env.example .env
# عدّل .env وأضف كلمة مرور PostgreSQL

npm install
npm run dev
# يعمل على: http://localhost:5000
```

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
# يعمل على: http://localhost:3000
```

---

## API Endpoints المتاحة

| الطريقة | المسار                | الوصف                    | الدور |
|---------|----------------------|--------------------------|-------|
| POST    | /api/auth/login      | تسجيل الدخول             | عام   |
| GET     | /api/auth/me         | بيانات المستخدم الحالي    | مصادق |
| GET     | /api/members         | قائمة الأعضاء (paginated) | staff |
| GET     | /api/members/stats   | إحصائيات الأعضاء          | staff |
| GET     | /api/members/:id     | تفاصيل عضو               | staff |
| POST    | /api/members         | إضافة عضو جديد            | staff |
| PATCH   | /api/members/:id     | تعديل بيانات عضو          | staff |
| DELETE  | /api/members/:id     | إلغاء تفعيل عضو           | owner |

### مثال على Login

```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"phone":"+213550000001","password":"Admin@1234"}'
```

---

## الصفحات المكتملة ✅ والقادمة 🔜

- ✅ تسجيل الدخول
- ✅ صفحة الأعضاء (CRUD كامل + بحث + فلاتر + pagination)
- 🔜 لوحة التحكم الرئيسية
- 🔜 الحصص والجداول
- 🔜 الاشتراكات والمدفوعات
- 🔜 الحضور بـ QR Code
- 🔜 متابعة تقدم الرياضيين
