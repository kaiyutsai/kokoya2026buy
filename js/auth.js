// =====================================================
// 果果家 KOKOYA · 購物網會員登入（Google）
// - 登入是 optional：未登入也可以下單，登入後訂單跟 UID 綁定
// - 登入後自動把客戶資料存到 customers/{uid}
// =====================================================
import {
  auth, googleProvider, signInWithPopup, signOut, onAuthStateChanged,
  db, doc, setDoc, getDoc, serverTimestamp
} from "./firebase-shop.js";

let _currentUser = null;
const _listeners = [];

// 監聽登入狀態
onAuthStateChanged(auth, (user) => {
  _currentUser = user;
  _listeners.forEach(cb => cb(user));
  // 登入時自動同步客戶資料
  if (user) syncCustomerProfile(user).catch(console.warn);
});

export function getCurrentUser() { return _currentUser; }

export function onAuthChange(cb) {
  _listeners.push(cb);
  // 立即觸發一次（如果已登入）
  if (_currentUser !== null) cb(_currentUser);
  return () => {
    const i = _listeners.indexOf(cb);
    if (i >= 0) _listeners.splice(i, 1);
  };
}

export async function loginWithGoogle() {
  const result = await signInWithPopup(auth, googleProvider);
  return result.user;
}

export async function logout() {
  await signOut(auth);
}

// 登入時自動建立 / 更新 customers/{uid} 基本欄位（不覆蓋客人填的 phone/address）
async function syncCustomerProfile(user) {
  await setDoc(doc(db, "customers", user.uid), {
    uid:        user.uid,
    email:      user.email || "",
    displayName:user.displayName || "",
    photoURL:   user.photoURL || "",
    lastLogin:  serverTimestamp()
  }, { merge: true });
}

// 讀取會員的完整 profile（含手機/地址）
export async function getProfile(uid) {
  if (!uid) return null;
  const s = await getDoc(doc(db, "customers", uid));
  return s.exists() ? s.data() : null;
}

// 寫入 profile 的可編輯欄位（name/phone/address）
export async function saveProfile(uid, data) {
  if (!uid) throw new Error("請先登入");
  await setDoc(doc(db, "customers", uid), {
    name:    data.name    || "",
    phone:   data.phone   || "",
    address: data.address || "",
    updatedAt: serverTimestamp()
  }, { merge: true });
}

// 渲染右上角登入按鈕 / 用戶頭像
// 用法：renderAuthButton(document.getElementById("authSlot"))
export function renderAuthButton(slot) {
  if (!slot) return;
  const update = (user) => {
    if (user) {
      slot.innerHTML = `
        <div class="user-chip" id="userChip">
          <img src="${user.photoURL || ''}" alt="${user.displayName||user.email}" referrerpolicy="no-referrer"
               onerror="this.style.display='none';this.nextElementSibling.style.display='inline'">
          <span class="avatar-fallback" style="display:none">👤</span>
          <span class="uname">${user.displayName || (user.email || "").split("@")[0]}</span>
          <button class="user-menu-btn" id="userMenuBtn" title="會員選單">▼</button>
          <div class="user-menu" id="userMenu" hidden>
            <a href="my-orders.html">📦 我的訂單</a>
            <button class="logout-btn" id="logoutBtn">⏻ 登出</button>
          </div>
        </div>`;
      const $btn = slot.querySelector("#userMenuBtn");
      const $menu = slot.querySelector("#userMenu");
      $btn.addEventListener("click", (e) => {
        e.stopPropagation();
        $menu.hidden = !$menu.hidden;
      });
      document.addEventListener("click", () => $menu.hidden = true);
      slot.querySelector("#logoutBtn").addEventListener("click", async () => {
        await logout();
        location.reload();
      });
    } else {
      slot.innerHTML = `<button class="login-btn" id="btnLogin" title="使用 Google 登入">🔐 登入</button>`;
      slot.querySelector("#btnLogin").addEventListener("click", async () => {
        try {
          await loginWithGoogle();
          // onAuthStateChanged 會自動更新 UI
        } catch (err) {
          console.error("登入失敗:", err);
          if (err.code === "auth/popup-closed-by-user") {
            // 使用者取消，不報錯
            return;
          }
          alert("登入失敗：" + err.message);
        }
      });
    }
  };
  onAuthChange(update);
}
