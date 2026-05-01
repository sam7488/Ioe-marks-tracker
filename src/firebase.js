import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyAhZfDFAj-_HC4nEgyw3ZuBeH5whS28gDc",
  authDomain: "ioe-mark-tracker.firebaseapp.com",
  projectId: "ioe-mark-tracker",
  storageBucket: "ioe-mark-tracker.firebasestorage.app",
  messagingSenderId: "533959432060",
  appId: "1:533959432060:web:af11dfdb089892a7c076f9",
  measurementId: "G-B7EX0W6JLQ"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();
export default app;
