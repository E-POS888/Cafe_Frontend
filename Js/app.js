/**
 * JS/app.js - 顧客點餐前端邏輯
 */

let shoppingCart = [];
let currentUser = {};

document.addEventListener("DOMContentLoaded", () => {
  if (typeof APP_CONFIG === 'undefined') {
    showError("設定檔未載入，請確認檔案路徑。");
    return;
  }
  initializeLiff(APP_CONFIG.LIFF_ID);
});

function showError(msg) {
  const loadText = document.getElementById("loading-text");
  if (loadText) {
    loadText.textContent = "❌ " + msg;
    loadText.style.color = "red";
    loadText.style.fontWeight = "bold";
  }
}

async function initializeLiff(myLiffId) {
  try {
    document.getElementById("loading-text").textContent = "正在連接 LINE 服務...";
    await liff.init({ liffId: myLiffId });
    
    if (!liff.isLoggedIn()) {
      document.getElementById("loading-text").textContent = "準備跳轉 LINE 登入...";
      liff.login();
      return;
    }
    
    const profile = await liff.getProfile();
    updateProfileUI(profile.displayName, profile.pictureUrl);
    
    await verifyUserWithBackend(profile.userId, profile.displayName);
    await fetchMenuFromBackend();
    
  } catch (err) {
    showError("LINE 驗證失敗，請重新載入網頁。");
  }
}

function updateProfileUI(name, picUrl) {
  const nameEl = document.getElementById("profile-name");
  const imgEl = document.getElementById("profile-img");
  if(nameEl) nameEl.textContent = name;
  if(imgEl && picUrl) imgEl.src = picUrl;
}

async function verifyUserWithBackend(uid, name) {
  document.getElementById("loading-text").textContent = "正在驗證會員資料...";
  try {
    const response = await fetch(APP_CONFIG.GAS_API_URL, {
      method: "POST",
      body: JSON.stringify({ action: "loginUser", uid: uid, name: name })
    });
    const result = await response.json();
    currentUser = { uid: uid, name: name };
  } catch (error) {
    showError("會員驗證失敗，請檢查 API。");
  }
}

async function fetchMenuFromBackend() {
  document.getElementById("loading-text").textContent = "正在載入最新菜單...";
  try {
    const response = await fetch(APP_CONFIG.GAS_API_URL, {
      method: "POST",
      body: JSON.stringify({ action: "getMenu" })
    });
    const result = await response.json();
    
    if (result.success) {
      renderMenu(result.data);
      document.getElementById("loading-screen").style.display = "none";
    } else {
      showError("資料庫讀取失敗：" + (result.error || result.message));
    }
  } catch (error) {
    showError("無法連線至資料庫。");
  }
}

function renderMenu(menuData) {
  const container = document.getElementById("menu-container");
  if(!container) return;
  container.innerHTML = ""; 
  
  const categories = {};
  menuData.forEach(item => {
    const cat = item["大類別"];
    if (!categories[cat]) categories[cat] = [];
    categories[cat].push(item);
  });
  
  for (const [catName, items] of Object.entries(categories)) {
    const section = document.createElement("div");
    section.innerHTML = `<div class="category-title">${catName}</div>`;
    
    const grid = document.createElement("div");
    grid.className = "product-grid";
    
    items.forEach(item => {
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

function addToCart(id, name, price) {
  shoppingCart.push({ id, name, price, qty: 1 });
  updateCartUI();
}

function updateCartUI() {
  const totalQty = shoppingCart.length;
  const totalPrice = shoppingCart.reduce((sum, item) => sum + item.price, 0);
  const cartSummary = document.getElementById("cart-summary");
  if(cartSummary) cartSummary.textContent = `購物車：${totalQty} 項 | $${totalPrice}`;
}

function openCart() {
  if (shoppingCart.length === 0) {
    alert("購物車是空的喔！");
    return;
  }
  alert("即將進入結帳畫面，準備送單至後台...");
}
