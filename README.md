# 🛒 果果家 KOKOYA · 前端購物網（給客人用）

> 這是「客人逛的購物網」— 不是後台！
> 後台系統在另一個資料夾：`KOKOYA/上傳GitHub/`

---

## 這個 repo 是什麼

純前端購物網站，給來買水果的客戶使用：
- 瀏覽商品（從後台 Firestore 自動撈當前商品 + 庫存）
- 加入購物車（localStorage 暫存）
- 結帳填寫聯絡資訊 → 訂單寫入 `webOrders` collection
- 後台員工會在「網站訂單」頁看到並處理

**不需要登入**、**任何人都能訪問**。

## 部署到 GitHub Pages

```bash
cd "上傳GitHub_購物網"
git init
git add .
git commit -m "果果家 KOKOYA 購物網 · 初版"
git branch -M main
git remote add origin https://github.com/<你的帳號>/kokoya-shop.git
git push -u origin main
```

GitHub → Settings → Pages → main / root → 等 1-2 分鐘 → 網址：

```
https://<你的帳號>.github.io/kokoya-shop/
```

## 必須先做：Firestore 規則

購物網要能讀商品 + 寫訂單，後台 `firestore.rules` 必須包含：

```
match /items/{id} {
  allow read: if true;          // ⚠️ 公開讀
  ...
}
match /webOrders/{id} {
  allow create: if true;        // 訪客送單
  allow read:   if isStaff();   // 只有員工能看
  allow update: if isStaff();
  allow delete: if isAdmin();
}
```

→ 在 Firebase Console → Firestore → 規則貼新版本後「發布」。

## 檔案結構

```
上傳GitHub_購物網/
├── index.html              # 主頁（hero / 商品 / 分類 / footer）
├── css/
│   └── shop.css            # 米白底 + 暖橘調樣式
├── js/
│   ├── firebase-shop.js    # Firebase 初始化（公開 API key，沒登入）
│   └── shop.js             # 商品載入 / 購物車 / 結帳
└── assets/
    ├── logo.png            # 主 LOGO（小圖示用）
    ├── logo-full.png       # 完整 LOGO（含「果果家」字樣）
    └── fb-qr.png           # FB 社團 QR（footer 顯示）
```

## 跟後台的關聯

```
[購物網（這個 repo）]                    [後台（kokoya2026 repo）]
        ↓                                          ↑
   讀 items                              員工登入處理 webOrders
        ↓                                          ↑
   ─────────────── Firebase Firestore ───────────────
                  kokoya-b5e5c (共用)
```

兩個 repo 各自獨立部署，**不會互相影響**。改後台不會影響客人購物，反之亦然。

---

© 果果家 KOKOYA · 凱宇、凱帆、妍慧、于真
