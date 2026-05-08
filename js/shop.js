// =====================================================
// 果果家 KOKOYA · 購物網前端主邏輯
// 串 Firestore 撈 items / 購物車 / 線上轉帳結帳 → webOrders
// =====================================================
import {
  db, collection, doc, addDoc, getDoc, getDocs,
  query, orderBy, serverTimestamp, Timestamp
} from "./firebase-shop.js";
import { renderAuthButton, getCurrentUser, onAuthChange, getProfile, saveProfile } from "./auth.js";

const $ = id => document.getElementById(id);
const fmtMoney = v => "$" + (Math.round(Number(v) || 0)).toLocaleString();

// 沒設定 imageUrl 時的 emoji fallback（涵蓋台灣常見水果）
const EMOJI_MAP = [
  [/蘋果|apple/i,         "🍎"],
  [/橘|柑/,                "🍊"],
  [/梨/,                   "🍐"],
  [/葡萄/,                 "🍇"],
  [/草莓/,                 "🍓"],
  [/奇異果|kiwi/i,         "🥝"],
  [/香蕉/,                 "🍌"],
  [/桃/,                   "🍑"],
  [/西瓜/,                 "🍉"],
  [/鳳梨/,                 "🍍"],
  [/芒果/,                 "🥭"],
  [/檸檬|萊姆/,            "🍋"],
  [/櫻桃/,                 "🍒"],
  [/藍莓/,                 "🫐"],
  [/釋迦/,                 "🍏"],   // 釋迦（綠色佛果）
  [/火龍果/,               "🐉"],
  [/蓮霧/,                 "🔔"],
  [/楊桃/,                 "⭐"],
  [/木瓜/,                 "🥭"],
  [/芭樂|番石榴/,          "🍏"],
  [/百香果/,               "🟣"],
  [/柚子|文旦/,            "🍊"],
  [/椰子/,                 "🥥"],
  [/棗/,                   "🌰"],
  [/瓜/,                   "🍈"],
  [/禮盒|綜合/,            "🎁"],
];
function emojiOf(name) {
  for (const [re, e] of EMOJI_MAP) if (re.test(name || "")) return e;
  return "🍎";
}

const state = {
  items: [],
  payment: null,
  cart: JSON.parse(localStorage.getItem("kokoya_cart") || "{}"),
  catFilter: ""
};

// ============= UI Helpers =============
function toast(msg, type = "ok") {
  const $t = $("toast");
  $t.textContent = msg;
  $t.className = `toast ${type} show`;
  setTimeout(() => $t.className = "toast", 2400);
}
function persist() {
  localStorage.setItem("kokoya_cart", JSON.stringify(state.cart));
  renderCart();
}

// ============= 商品 =============
async function loadItems() {
  try {
    const snap = await getDocs(query(collection(db, "items"), orderBy("name")));
    state.items = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(i => i.visible !== false);   // 後台沒勾「上架」的不顯示
    renderProducts();
  } catch (err) {
    console.error("載入商品失敗:", err);
    const isPermission = /permission|denied/i.test(err.message);
    $("productList").innerHTML = `
      <div class="load-error">
        <div class="ico">${isPermission ? "🔐" : "😢"}</div>
        <div class="title">${isPermission ? "資料庫權限尚未開啟" : "商品載入失敗"}</div>
        <div style="margin:8px 0 12px">${isPermission
          ? "請後台管理員到 Firebase Console → Firestore → 規則，把 <code>firestore.rules</code> 的最新版本貼上並發布。<br>必須包含 <code>match /items: allow read: if true</code>"
          : "請確認網路後重新整理"}</div>
        <div style="font-size:.78rem;color:var(--muted)">技術細節：${err.message}</div>
      </div>`;
  }
}

async function loadPayment() {
  try {
    const s = await getDoc(doc(db, "settings", "payment"));
    state.payment = s.exists() ? s.data() : null;
  } catch (err) {
    console.warn("付款資訊載入失敗", err);
    state.payment = null;
  }
  renderPayment();
}

function renderPayment() {
  const $p = $("paymentRows");
  if (!$p) return;
  const p = state.payment;
  if (!p || !p.bankAccount) {
    $p.innerHTML = `
      <div style="padding:6px 0;color:var(--muted);font-size:.86rem">
        ⚠️ 老闆還沒設定銀行帳號，<br>送單後我們會用 FB 訊息告訴您
      </div>`;
    return;
  }
  $p.innerHTML = `
    ${p.bankName  ? `<div class="row"><span class="lbl">銀行</span><span class="val">${p.bankName}</span></div>` : ""}
    ${p.bankCode  ? `<div class="row"><span class="lbl">代碼</span><span class="val">${p.bankCode}</span></div>` : ""}
    ${p.accountName ? `<div class="row"><span class="lbl">戶名</span><span class="val">${p.accountName}</span></div>` : ""}
    <div class="row"><span class="lbl">帳號</span><span class="val copy" data-copy="${p.bankAccount}" title="點一下複製">${p.bankAccount}</span></div>
    ${p.note ? `<div class="row" style="margin-top:6px;padding-top:6px;border-top:1px dashed var(--line)"><span class="lbl">備註</span><span class="val" style="font-weight:400">${p.note}</span></div>` : ""}
  `;
  $p.querySelectorAll("[data-copy]").forEach(el => {
    el.addEventListener("click", () => {
      navigator.clipboard?.writeText(el.dataset.copy);
      toast("✓ 已複製帳號", "ok");
    });
  });
}

function renderProducts() {
  let list = state.items;
  if (state.catFilter) {
    list = list.filter(i =>
      (i.name || "").includes(state.catFilter) ||
      (i.category || "").includes(state.catFilter)
    );
  }
  if (!list.length) {
    $("productList").innerHTML = `
      <div class="load-error">
        <div class="ico">🍃</div>
        <div class="title">${state.catFilter ? `「${state.catFilter}」目前沒商品` : "目前沒有商品"}</div>
        <div style="margin-top:6px;font-size:.88rem">${state.catFilter
          ? `<a href="#" onclick="event.preventDefault();document.querySelector('[data-cat=\\'\\']')?.click()" style="color:var(--orange-d)">看全部商品 →</a>`
          : "請後台管理員先新增品項並設定價格"}</div>
      </div>`;
    return;
  }
  $("productList").innerHTML = list.map(i => {
    const stock = Number(i.stock || 0);
    const price = Number(i.price || 0);
    const out = stock <= 0;
    const noPrice = price <= 0;
    const disabled = out || noPrice;
    const imgHtml = i.imageUrl
      ? `<img src="${i.imageUrl}" alt="${i.name}" onerror="this.style.display='none';this.parentElement.innerHTML+='<span class=\\'emoji\\'>${emojiOf(i.name)}</span>'">`
      : `<span class="emoji">${emojiOf(i.name)}</span>`;
    return `
      <div class="card-product">
        <div class="thumb">
          ${out ? `<span class="badge sold">售完</span>`
                 : (stock > 0 && stock <= 5 ? `<span class="badge">最後${stock}${i.unit||""}</span>` : "")}
          ${imgHtml}
        </div>
        <div class="body">
          <div class="name">${i.name || "(未命名)"}</div>
          <div class="desc">${i.desc || i.category || "新鮮直送 · 當季嚴選"}</div>
          <div class="row">
            <div class="price">
              ${noPrice ? `<span style="color:var(--muted);font-size:.88rem">未定價</span>`
                       : `<small>NT$</small>${fmtMoney(price).replace("$","")}<span class="unit">/${i.unit||"份"}</span>`}
            </div>
            <button class="btn-cart" data-add="${i.id}" ${disabled ? "disabled" : ""} title="${out ? "售完" : noPrice ? "未定價" : "加入購物車"}">
              ${disabled ? "—" : "🛒"}
            </button>
          </div>
        </div>
      </div>`;
  }).join("");
}

// ============= 購物車 =============
function addToCart(itemId) {
  const item = state.items.find(i => i.id === itemId);
  if (!item) return;
  const cur = state.cart[itemId] || { qty: 0 };
  state.cart[itemId] = {
    qty: cur.qty + 1,
    name: item.name,
    unit: item.unit || "份",
    price: Number(item.price) || 0,
    imageUrl: item.imageUrl || ""
  };
  persist();
  toast(`✓ ${item.name} 加入購物車`, "ok");
}

function changeQty(itemId, delta) {
  if (!state.cart[itemId]) return;
  state.cart[itemId].qty += delta;
  if (state.cart[itemId].qty <= 0) delete state.cart[itemId];
  persist();
}

function removeFromCart(itemId) {
  delete state.cart[itemId];
  persist();
}

function renderCart() {
  const entries = Object.entries(state.cart);
  const count = entries.reduce((s, [, v]) => s + v.qty, 0);
  const total = entries.reduce((s, [, v]) => s + v.qty * v.price, 0);

  $("cartCount").textContent = count > 0 ? count : "";
  $("cartTotal").textContent = fmtMoney(total);

  if (!entries.length) {
    $("cartBody").innerHTML = `
      <div class="cart-empty">
        <div style="font-size:3rem;margin-bottom:10px">🍃</div>
        購物車空空如也<br>挑些水果吧 ✨
      </div>`;
    return;
  }
  $("cartBody").innerHTML = entries.map(([id, v]) => {
    const imgHtml = v.imageUrl
      ? `<img src="${v.imageUrl}" alt="" onerror="this.style.display='none';this.parentElement.textContent='${emojiOf(v.name)}'">`
      : emojiOf(v.name);
    return `
      <div class="cart-item">
        <div class="ph">${imgHtml}</div>
        <div class="info">
          <div class="nm">${v.name}</div>
          <div class="pr">${fmtMoney(v.price)} / ${v.unit}</div>
          <div class="qty-box">
            <button data-dec="${id}">−</button>
            <span class="n">${v.qty}</span>
            <button data-inc="${id}">＋</button>
            <span style="margin-left:auto;font-size:.88rem;color:var(--ink-2);font-weight:600">
              ${fmtMoney(v.qty * v.price)}
            </span>
          </div>
        </div>
        <button class="rm" data-rm="${id}" title="移除">✕</button>
      </div>`;
  }).join("");
}

// ============= Cart drawer 開關 =============
function openCart()  { $("cartDrawer").classList.add("show");    $("cartMask").classList.add("show"); }
function closeCart() { $("cartDrawer").classList.remove("show"); $("cartMask").classList.remove("show"); }

$("btnOpenCart").addEventListener("click", openCart);
$("btnCloseCart").addEventListener("click", closeCart);
$("cartMask").addEventListener("click", closeCart);

$("productList").addEventListener("click", e => {
  const id = e.target.closest("[data-add]")?.dataset.add;
  if (id) addToCart(id);
});
$("cartBody").addEventListener("click", e => {
  const inc = e.target.closest("[data-inc]")?.dataset.inc;
  const dec = e.target.closest("[data-dec]")?.dataset.dec;
  const rm  = e.target.closest("[data-rm]")?.dataset.rm;
  if (inc) changeQty(inc, +1);
  if (dec) changeQty(dec, -1);
  if (rm)  removeFromCart(rm);
});

// 分類點擊
document.querySelectorAll(".cat").forEach(c => {
  c.addEventListener("click", () => {
    state.catFilter = c.dataset.cat || "";
    renderProducts();
    document.getElementById("products").scrollIntoView({ behavior: "smooth" });
  });
});

// 漢堡選單
$("menuToggle")?.addEventListener("click", () => $("mainNav").classList.toggle("show"));
$("mainNav")?.addEventListener("click", e => {
  if (e.target.matches("a")) $("mainNav").classList.remove("show");
});

// ============= 結帳 =============
$("btnCheckout").addEventListener("click", () => {
  const entries = Object.entries(state.cart);
  if (!entries.length) return toast("購物車是空的", "err");
  closeCart();
  $("checkoutModal").classList.add("show");
  // 帶入順序：會員 profile > localStorage > 空
  const saved = JSON.parse(localStorage.getItem("kokoya_customer") || "{}");
  const fillName  = _profile?.name    || saved.name  || _profile?.displayName || "";
  const fillPhone = _profile?.phone   || saved.phone || "";
  const fillAddr  = _profile?.address || saved.addr  || "";
  if (!$("cName").value)  $("cName").value  = fillName;
  if (!$("cPhone").value) $("cPhone").value = fillPhone;
  if (!$("cAddr").value)  $("cAddr").value  = fillAddr;
});
$("btnCancelCheckout").addEventListener("click", () => $("checkoutModal").classList.remove("show"));
$("checkoutModal").addEventListener("click", e => {
  if (e.target === $("checkoutModal")) $("checkoutModal").classList.remove("show");
});

$("cMethod").addEventListener("change", () => {
  const method = $("cMethod").value;
  $("addrField").style.display = method === "宅配" ? "block" : "none";
});

$("checkoutForm").addEventListener("submit", async e => {
  e.preventDefault();
  const name   = $("cName").value.trim();
  const phone  = $("cPhone").value.trim();
  const method = $("cMethod").value;
  const addr   = $("cAddr").value.trim();
  const note   = $("cNote").value.trim();
  const tlast5 = $("cTransferLast5").value.trim();
  if (!name || !phone) return toast("請填姓名與電話", "err");
  if (method === "宅配" && !addr) return toast("宅配請填地址", "err");

  const lines = Object.entries(state.cart).map(([itemId, v]) => ({
    itemId,
    name: v.name,
    unit: v.unit,
    qty:  v.qty,
    price: v.price,
    lineTotal: v.qty * v.price
  }));
  if (!lines.length) return toast("購物車是空的", "err");
  const total = lines.reduce((s, l) => s + l.lineTotal, 0);

  const $btn = e.target.querySelector("button[type='submit']");
  $btn.disabled = true;
  $btn.textContent = "送出中…";

  const user = getCurrentUser();
  try {
    const ref = await addDoc(collection(db, "webOrders"), {
      customer: name,
      phone,
      method,
      address: method === "宅配" ? addr : "",
      note,
      lines,
      total,
      paymentMethod: "transfer",
      transferLast5: tlast5,
      paymentStatus: tlast5 ? "pending_verify" : "awaiting_transfer",
      status: "new",
      source: "web",
      // 會員資訊（若已登入）
      customerUid:   user?.uid   || null,
      customerEmail: user?.email || "",
      customerPhoto: user?.photoURL || "",
      isMember:      !!user,
      createdAt: serverTimestamp()
    });

    // 記錄到 localStorage 給「我的訂單」用
    const myOrders = JSON.parse(localStorage.getItem("kokoya_my_orders") || "[]");
    myOrders.unshift({ id: ref.id, phone, customer: name, total, at: Date.now() });
    localStorage.setItem("kokoya_my_orders", JSON.stringify(myOrders.slice(0, 50)));
    localStorage.setItem("kokoya_customer", JSON.stringify({ name, phone, addr }));

    // 登入會員：把這次結帳填的資料回存到 profile（下次自動帶）
    if (user) {
      try {
        await saveProfile(user.uid, {
          name, phone,
          address: method === "宅配" ? addr : (_profile?.address || "")
        });
        _profile = { ..._profile, name, phone, address: method === "宅配" ? addr : _profile?.address };
      } catch (err) { console.warn("回存 profile 失敗", err); }
    }

    state.cart = {};
    persist();
    $("checkoutModal").classList.remove("show");
    $("checkoutForm").reset();
    $("addrField").style.display = "block";

    // 顯示成功 modal
    $("successOrderNo").textContent = ref.id.slice(0, 8).toUpperCase();
    $("successModal").classList.add("show");
  } catch (err) {
    console.error(err);
    toast("送出失敗：" + err.message, "err");
  }
  $btn.disabled = false;
  $btn.textContent = "送出訂單";
});

// 成功 modal 關閉
$("btnSuccessClose")?.addEventListener("click", () => $("successModal").classList.remove("show"));
$("successModal")?.addEventListener("click", e => {
  if (e.target === $("successModal")) $("successModal").classList.remove("show");
});

// ============= 會員登入 UI =============
renderAuthButton(document.getElementById("authSlot"));

let _profile = null;

// 登入狀態變動 → 抓 profile 暫存，結帳時自動帶入
onAuthChange(async (user) => {
  if (user) {
    try {
      _profile = await getProfile(user.uid);
    } catch (err) { console.warn("讀取會員資料失敗", err); }
  } else {
    _profile = null;
  }
});

// ============= 水果小教室預覽（3 篇最新文章） =============
async function loadBlogPreview() {
  try {
    const snap = await getDocs(query(collection(db, "articles"), orderBy("order", "asc")));
    const list = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(a => a.published !== false)
      .slice(0, 3);
    if (!list.length) return;
    const $sec = $("blogTeaser");
    const $box = $("blogPreview");
    $box.innerHTML = list.map(a => {
      const slug = a.slug || a.id;
      const cover = a.cover
        ? `<img src="${a.cover}" alt="${a.title}" style="width:100%;height:100%;object-fit:cover" onerror="this.outerHTML='<span style=&quot;font-size:3.5rem&quot;>${a.icon||'📚'}</span>'">`
        : `<span style="font-size:3.5rem">${a.icon || "📚"}</span>`;
      return `
        <a class="card-product" href="blog-detail.html?slug=${encodeURIComponent(slug)}" style="text-decoration:none;color:inherit">
          <div class="thumb">${a.category ? `<span class="badge new">${a.category}</span>` : ""}${cover}</div>
          <div class="body">
            <div class="name">${a.title || "(無標題)"}</div>
            <div class="desc">${a.excerpt || ""}</div>
            <div class="row" style="border-top-color:transparent;padding-top:8px">
              <span class="muted" style="font-size:.84rem">📖 閱讀 →</span>
              <span></span>
            </div>
          </div>
        </a>`;
    }).join("");
    $sec.style.display = "block";
  } catch (err) {
    // 沒文章不顯示這一塊就好，不要報錯
    console.warn("載入文章預覽失敗", err);
  }
}

// ============= 啟動 =============
loadItems();
loadPayment();
loadBlogPreview();
renderCart();
