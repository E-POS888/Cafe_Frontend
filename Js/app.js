/**
 * app.js - 顧客點餐前端邏輯
 */

// 購物車資料陣列
let shoppingCart = [];
let currentUser = {};

document.addEventListener("DOMContentLoaded", () => {
  // 1. 系統啟動，初始化 LIFF (若尚未填入 LIFF ID，則先執行本地測試模式)
  if (APP_CONFIG.LIFF_ID === "YOUR_LIFF_ID_HERE") {
    console.log("未設定 LIFF ID，進入本地測試模式");
    mockLoginAndLoadData();
  } else {
    initializeLiff(APP_CONFIG.LIFF_ID);
  }
});

/**
 * 初始化 LINE LIFF
 */
async function initializeLiff(myLiffId) {
  try {
    await liff.init({ liffId: myLiffId });
    if (!liff.isLoggedIn()) {
      liff.login();
      return;
    }
    
    // 取得使用者公開資料
    const profile = await liff.getProfile();
    updateProfileUI(profile.displayName, profile.pictureUrl);
    
    // 向 GAS 驗證會員身分
    await verifyUserWithBackend(profile.userId, profile.displayName);
    
    // 載入商品菜單
    await fetchMenuFromBackend();
    
  } catch (err) {
    console.error("LIFF 初始化失敗", err);
    alert("LINE 登入失敗，請重新整理頁面。");
  }
}

/**
 * 更新頂部會員 UI
 */
function updateProfileUI(name, picUrl) {
  document.getElementById("profile-name").textContent = name;
  if(picUrl) document.getElementById("profile-img").src = picUrl;
}

/**
 * 向 GAS 發送請求：驗證會員
 */
async function verifyUserWithBackend(uid, name) {
  document.getElementById("loading-text").textContent = "正在驗證會員資料...";
  const payload = { action: "loginUser", uid: uid, name: name };
  
  try {
    const response = await fetch(APP_CONFIG.GAS_API_URL, {
      method: "POST",
      body: JSON.stringify(payload)
    });
    const result = await response.json();
    currentUser = { uid: uid, name: name };
    
    if (result.data.isNewUser) {
      alert("歡迎首次光臨！未來結帳時請向櫃檯提供電話號碼完成綁定。");
    }
  } catch (error) {
    console.error("驗證失敗", error);
  }
}

/**
 * 向 GAS 發送請求：抓取商品總表
 */
async function fetchMenuFromBackend() {
  document.getElementById("loading-text").textContent = "正在載入最新菜單...";
  const payload = { action: "getMenu" };
  
  try {
    const response = await fetch(APP_CONFIG.GAS_API_URL, {
      method: "POST",
      body: JSON.stringify(payload)
    });
    const result = await response.json();
    
    if (result.success) {
      renderMenu(result.data);
      document.getElementById("loading-screen").style.display = "none";
    }
  } catch (error) {
    console.error("菜單載入失敗", error);
    document.getElementById("loading-text").textContent = "菜單載入失敗，請稍後再試。";
  }
}

/**
 * 將商品資料渲染到畫面上
 */
function renderMenu(menuData) {
  const container = document.getElementById("menu-container");
  container.innerHTML = ""; 
  
  // 依照大類別進行分組
  const categories = {};
  menuData.forEach(item => {
    const cat = item["大類別"];
    if (!categories[cat]) categories[cat] = [];
    categories[cat].push(item);
  });
  
  // 建立 HTML 元素
  for (const [catName, items] of Object.entries(categories)) {
    const section = document.createElement("div");
    section.innerHTML = `<div class="category-title">${catName}</div>`;
    
    const grid = document.createElement("div");
    grid.className = "product-grid";
    
    items.forEach(item => {
      // 若無照片，給予預設圖
      const imgUrl = item["照片網址(Drive)"] || "https://via.placeholder.com/80?text=No+Image";
      const card = document.createElement("div");
      card.className = "product-card";
      card.innerHTML = `
        <img class="product-image" src="${imgUrl}" alt="${item["商品名稱"]}">
        <div class="product-info">
          <h3 class="product-name">${item["商品名稱"]}</h3>
          <div class="product-price">$${item["預設價格"]}</div>
          <button class="add-btn" onclick="addToCart('${item["商品編號"]}', '${item["商品名稱"]}', ${item["預設價格"]})">加入清單</button>
        </div>
      `;
      grid.appendChild(card);
    });
    
    section.appendChild(grid);
    container.appendChild(section);
  }
}

/**
 * 加入購物車邏輯
 */
function addToCart(id, name, price) {
  // 這裡預留後續實作冰熱/甜度客製化彈窗的位置
  shoppingCart.push({ id, name, price, qty: 1 });
  updateCartUI();
}

/**
 * 更新底部購物車狀態
 */
function updateCartUI() {
  const totalQty = shoppingCart.length;
  const totalPrice = shoppingCart.reduce((sum, item) => sum + item.price, 0);
  document.getElementById("cart-summary").textContent = `購物車：${totalQty} 項 | $${totalPrice}`;
}

/**
 * 點擊查看訂單
 */
function openCart() {
  if (shoppingCart.length === 0) {
    alert("購物車是空的喔！");
    return;
  }
  alert("即將進入結帳畫面，準備送單至後台...");
  // 未來將在此實作送出訂單至 appendOrder API 的邏輯
}

/**
 * 供本機無 LIFF ID 時測試用的模擬登入程序
 */
async function mockLoginAndLoadData() {
  updateProfileUI("測試訪客", "");
  await verifyUserWithBackend("U_MOCK_123", "測試訪客");
  await fetchMenuFromBackend();
}
