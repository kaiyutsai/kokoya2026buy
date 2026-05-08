// =====================================================
// 果果家 KOKOYA · 購物網前端 Firebase 設定
// 與後台共用同一個 Firebase 專案 kokoya-b5e5c
// 訪客可：讀 items、settings/payment、寫 webOrders
// 登入會員可：讀自己的 webOrders（customerUid 比對）
// =====================================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import {
  getFirestore,
  collection,
  doc,
  addDoc,
  setDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  serverTimestamp,
  Timestamp
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBiRLtPYl399g_0w0WVRLpo2wi3WKwqGa8",
  authDomain: "kokoya-b5e5c.firebaseapp.com",
  projectId: "kokoya-b5e5c",
  storageBucket: "kokoya-b5e5c.firebasestorage.app",
  messagingSenderId: "306715168839",
  appId: "1:306715168839:web:e9e007c5b02c174fc96162"
};

const app  = initializeApp(firebaseConfig);
const db   = getFirestore(app);
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

// 登入持久化（重新整理還記得）
setPersistence(auth, browserLocalPersistence).catch(console.warn);

export {
  db, auth, googleProvider,
  collection, doc,
  addDoc, setDoc, getDoc, getDocs, query, where, orderBy,
  serverTimestamp, Timestamp,
  signInWithPopup, signOut, onAuthStateChanged
};
