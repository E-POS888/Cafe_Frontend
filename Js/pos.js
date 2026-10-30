/**
 * js/pos.js - 櫃台 POS 系統邏輯
 */

let fullMenu = [];
let currentCategory = "";
let posCart = [];

document.addEventListener("DOMContentLoaded", async () => {
  await fetchMenu();
  fetchPendingOrders();
  // 每 15 秒自動刷新一次線上訂單
  setInterval(fetchPendingOrders, 15000);
});

/**
 * 載入菜單並生成分類標籤
 */
async function fetchMenu() {
  try {
    const response = await fetch(APP_CONFIG.GAS_API_URL, {
      method: "POST",
      body: JSON.stringify({ action: "getMenu" })
    });
    const result = await response.json();
    if (result.success) {
      fullMenu = result.data;
      generateCategories();
    }
  } catch (error) {
    console.error("載入菜單失敗", error);
  }
}

/**
 * 動態生成大分類按鈕
 */
function generateCategories() {
  const tabsContainer = document.getElementById("category-tabs");
  const categories = [...new Set(fullMenu.map(item => item["大類別"]))];
  
  tabsContainer.innerHTML = "";
  categories.forEach((cat, index) => {
    const btn = document.createElement("button");
    btn.className = `tab-btn ${index === 0 ? 'active' : ''}`;
    btn.textContent = cat;
    btn.onclick = () => {
      document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      renderGrid(cat);
    };
    tabsContainer.appendChild(btn);
  });
  
  // 預設渲染第一個分類
  if (categories.length > 0) renderGrid(categories[0]);
}

/**
 * 渲染選定分類的商品網格
 */
function renderGrid(category) {
  const grid = document.getElementById("pos-grid");
  grid.innerHTML = "";
  const filtered = fullMenu.filter(item => item["大類別"] === category);
  
  filtered.forEach(item => {
    const div = document.createElement("div");
    div.className = "pos-item";
    div.innerHTML = `
      <div style="font-weight:bold;">${item["商品名稱"]}</div>
      <div style="color:var(--primary-color); margin-top:5px;">$${item["預設價格"]}</div>
    `;
    div.onclick = () => addToPosCart(item);
    grid.appendChild(div);
  });
}

/**
 * 現場點餐加入購物車
 */
function addToPosCart(item) {
  posCart.push({ ...item, qty: 1 });
  updatePosCartUI();
}

/**
 * 更新購物車畫面與總計
 */
function updatePosCartUI() {
  const list = document.getElementById("pos-cart-list");
  list.innerHTML = "";
  let total = 0;
  
  posCart.forEach((item, index) => {
    total += Number(item["預設價格"]);
    const div = document.createElement("div");
    div.className = "cart-item";
    div.innerHTML = `
      <span>${item["商品名稱"]}</span>
      <span>$${item["預設價格"]}</span>
    `;
    list.appendChild(div);
  });
  
  document.getElementById("pos-total").textContent = `Total: $${total}`;
}

function clearCart() {
  posCart = [];
  updatePosCartUI();
}

/**
 * 抓取線上待處理訂單
 */
async function fetchPendingOrders() {
  try {
    const response = await fetch(APP_CONFIG.GAS_API_URL, {
      method: "POST",
      body: JSON.stringify({ action: "getActiveOrders" })
    });
    const result = await response.json();
    if (result.success) {
      renderPendingOrders(result.data);
    }
  } catch (error) {
    console.error("抓取線上訂單失敗", error);
  }
}

/**
 * 渲染左側線上訂單列表
 */
function renderPendingOrders(orders) {
  const container = document.getElementById("pending-orders-container");
  container.innerHTML = "";
  
  const pending = orders.filter(o => o["訂單狀態"] === "等待結帳");
  if (pending.length === 0) {
    container.innerHTML = "<p>目前無待接訂單</p>";
    return;
  }
  
  pending.forEach(order => {
    const card = document.createElement("div");
    card.className = "order-card";
    const content = JSON.parse(order["訂單內容(JSON)"] || "[]");
    const itemsStr = content.map(c => `${c.name} x${c.qty}`).join("<br>");
    
    card.innerHTML = `
      <h4>訂單: ${order["會員姓名"]}</h4>
      <p style="font-size:12px; color:#666;">${order["訂單編號"]}</p>
      <p>${itemsStr}</p>
      <div style="font-weight:bold; text-align:right;">$${order["實收金額"]}</div>
      <button class="action-btn" onclick="acceptOrder('${order["訂單編號"]}')">確認接單 (開始製作)</button>
    `;
    container.appendChild(card);
  });
}

/**
 * 接單並更新狀態為製作中
 */
async function acceptOrder(orderId) {
  try {
    await fetch(APP_CONFIG.GAS_API_URL, {
      method: "POST",
      body: JSON.stringify({ action: "updateOrderStatus", orderId: orderId, status: "製作中" })
    });
    alert("已接單，通知吧台出餐");
    fetchPendingOrders(); // 刷新列表
  } catch (error) {
    alert("狀態更新失敗");
  }
}

/**
 * 處理現場訪客結帳 (預留串接後端 appendOrder 的接口)
 */
async function processCheckout(method) {
  if (posCart.length === 0) return alert("購物車是空的");
  alert(`模擬以 [${method}] 完成結帳，將觸發後端寫入資料庫流程。`);
  clearCart();
}
