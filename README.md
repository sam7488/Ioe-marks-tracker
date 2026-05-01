# IOE BCT Marksheet Tracker 🎓

A professional mark tracking tool for **Computer Engineering (BCT)** students at **IOE, Tribhuvan University**. 

**Live Demo:** [https://github.com/sam7488/Ioe-marks-tracker](https://github.com/sam7488/Ioe-marks-tracker)

---

## ✨ Features

- **✅ Full Curriculum**: Pre-loaded BCT syllabus (Theory/Practical).
- **☁️ Cloud Sync**: Automatic background syncing via Firebase Firestore.
- **🚀 0ms Loading**: Optimistic local caching for instant app access.
- **📊 IOE Aggregate**: Auto-calculates aggregate percentage (10% Sem 1-4, 15% Sem 5-8).
- **📑 PDF Export**: Single semester or full 8-semester transcript with aggregate.
- **🔐 Google Auth**: Secure login and profile management.

---

## 🛠️ Quick Setup

1. **Clone & Install**:
   ```bash
   git clone https://github.com/sam7488/Ioe-marks-tracker.git
   cd Ioe-marks-tracker
   npm install
   ```

2. **Firebase Config**: Update `src/firebase.js` with your project credentials.

3. **Run**:
   ```bash
   npm run dev
   ```

---

## 🛡️ Firestore Rules

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

---
*Developed for IOE BCT Students* 🇳🇵
