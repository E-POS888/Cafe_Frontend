/**
 * Js/pos.js - 櫃台 POS 系統邏輯 (加入現金找零功能)
 */

let posCart = [];
let menuData = [];
let processingOnlineOrderId = null; 
let currentOnlineOrders = [];
let currentCheckoutTotal = 0; // 記錄當前結帳總金額供找零計算使用

document.addEventListener("DOMContentLoaded", () => {
  if (typeof APP_CONFIG === 'undefined') {
    document.getElementById("error-msg").textContent = "❌ 設定檔未載入";
    return;
  }
  fetchMenu();
  fetchOnlineOrders();
  setInterval(fetchOnlineOrders, 10000); 
});

// --- 1. 左側：線上點餐看板邏輯 ---
async function fetchOnlineOrders() {
  const container = document.getElementById("pending-orders-container");
  try {
    const response = await fetch(APP_CONFIG.GAS_API_URL, {
      method: "POST",
      body: JSON.stringify({ action: "getActiveOrders" })
    });
    const result = await response.json();
    
    if (result.success) {
      currentOnlineOrders = result.data; 
      container.innerHTML = "";
      if (currentOnlineOrders.length === 0) {
        container.innerHTML = "<p style='color:#666; text-align:center;'>目前無待處理訂單</p>";
        return;
      }
      
      currentOnlineOrders.forEach(order => {
        let itemsHtml = "";
        try {
          const items = JSON.parse(order["訂單內容(JSON)"]);
          items.forEach(item => {
            let spec = [item.size, item.temp, item.sugar, item.ecoCup === "自備環保杯" ? "(自備)" : ""].filter(Boolean).join("/");
            itemsHtml += `<div style="font-size:13px;">- ${item.name} x1 [${spec}]</div>`;
            if (item.note) itemsHtml += `<div style="font-size:12px; color:#d32f2f; margin-left:10px;">*備註: ${item.note}</div>`;
          });
        } catch (e) { itemsHtml = "無法解析商品內容"; }

        let actionBtnHtml = "";
        if (order["訂單狀態"] === "等待結帳") {
          actionBtnHtml = `<button class="action-btn" onclick="updateOrderStatus('${order["訂單編號"]}', '製作中')">接單 (開始製作)</button>`;
        } else if (order["訂單狀態"] === "製作中") {
          actionBtnHtml = `<button class="action-btn" style="background:#388e3c;" onclick="loadOrderToCheckout('${order["訂單編號"]}')">👉 前往結帳收銀</button>`;
        }

        const dineInBadge = order["用餐方式"] === '內用' 
          ? `<span style="padding:4px 8px; border-radius:6px; background:#e65100; color:white; font-size:12px; font-weight:bold;">🍽️ 內用</span>` 
          : `<span style="padding:4px 8px; border-radius:6px; background:#8D6E63; color:white; font-size:12px; font-weight:bold;">🛍️ 外帶</span>`;

        const card = document.createElement("div");
        card.className = "order-card";
        card.innerHTML = `
          <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:10px;">
            <div>
              <h4 style="margin-bottom:4px; font-size:15px;">${order["會員姓名"]} <span style="font-size:11px; color:#666;">(${order["訂單編號"]})</span></h4>
              ${dineInBadge}
            </div>
            <span style="font-size:12px; font-weight:bold; color: ${order["訂單狀態"] === '製作中' ? '#e65100' : '#d32f2f'};">${order["訂單狀態"]}</span>
          </div>
          <div style="margin: 10px 0; border-left: 2px solid #ccc; padding-left: 8px;">${itemsHtml}</div>
          <div style="display:flex; justify-content:space-between; align-items:center; font-weight:bold;">
            <span style="font-size:13px; color:#666;">${order["付款方式"]}</span>
            <span style="color:#d32f2f; font-size:18px;">$${order["實收金額"]}</span>
          </div>
          ${actionBtnHtml}
        `;
        container.appendChild(card);
      });
    }
  } catch (error) {
    container.innerHTML = "<p style='color:red;'>連線失敗</p>";
  }
}

async function updateOrderStatus(orderId, newStatus) {
  try {
    const response = await fetch(APP_CONFIG.GAS_API_URL, {
      method: "POST",
      body: JSON.stringify({ action: "updateOrderStatus", orderId: orderId, status: newStatus })
    });
    const result = await response.json();
    if (result.success) fetchOnlineOrders();
    else alert("狀態更新失敗：" + result.message);
  } catch (error) { alert("系統連線錯誤"); }
}

// --- 2. 結帳區與右側聯動邏輯 ---
function loadOrderToCheckout(orderId) {
  const order = currentOnlineOrders.find(o => o["訂單編號"] === orderId);
  if (!order) return;
  
  posCart = [];
  try {
    const items = JSON.parse(order["訂單內容(JSON)"]);
    items.forEach(item => {
      let spec = [item.size, item.temp, item.sugar, item.ecoCup === "自備環保杯" ? "(自備)" : ""].filter(Boolean).join("/");
      let dispName = item.name + (spec ? ` [${spec}]` : "");
      if(item.note) dispName += ` *(${item.note})`;
      posCart.push({ id: item.id || Date.now().toString(), name: dispName, price: item.price });
    });
  } catch(e) {}

  processingOnlineOrderId = orderId;
  const badge = document.getElementById("current-order-badge");
  badge.style.display = "block";
  badge.textContent = `收銀處理中：${order["會員姓名"]} (${orderId})`;

  if (order["用餐方式"] === "內用") {
    document.getElementById('pos-dinein').checked = true;
    document.querySelectorAll('label[for^=pos-]').forEach(l=>l.classList.remove('active'));
    document.querySelector('label[for="pos-dinein"]').classList.add('active');
  } else {
    document.getElementById('pos-takeaway').checked = true;
    document.querySelectorAll('label[for^=pos-]').forEach(l=>l.classList.remove('active'));
    document.querySelector('label[for="pos-takeaway"]').classList.add('active');
  }
  updatePosCartUI();
}

function addPosCart(item) {
  if (processingOnlineOrderId !== null) {
    if(confirm("正在處理線上訂單，確定要清空並建立現場新單嗎？")) {
      clearCart();
    } else return;
  }
  posCart.push({ id: Date.now().toString(), productId: item["商品編號"], name: item["商品名稱"], price: Number(item["預設價格"]) });
  updatePosCartUI();
}

function removePosCart(id) {
  if (processingOnlineOrderId !== null) {
    alert("線上訂單無法於此修改品項，請直接結帳或點擊「清空/換單」。");
    return;
  }
  posCart = posCart.filter(item => item.id !== id);
  updatePosCartUI();
}

function clearCart() {
  posCart = [];
  processingOnlineOrderId = null;
  document.getElementById("current-order-badge").style.display = "none";
  updatePosCartUI();
}

function updatePosCartUI() {
  const list = document.getElementById("pos-cart-list");
  list.innerHTML = "";
  let total = 0;
  
  posCart.forEach(item => {
    total += item.price;
    list.innerHTML += `
      <div class="cart-item">
        <div style="flex:1;">
          <div style="font-weight:bold; font-size:14px; line-height:1.4;">${item.name}</div>
        </div>
        <div style="font-weight:bold; margin: 0 10px; color:#d32f2f;">$${item.price}</div>
        <button style="color:red; background:none; border:none; cursor:pointer;" onclick="removePosCart('${item.id}')">✕</button>
      </div>
    `;
  });
  document.getElementById("pos-total").textContent = `Total: $${total}`;
}

// --- 3. 現金找零彈窗邏輯 ---
function openCashModal() {
  if (posCart.length === 0) { alert("結帳區目前沒有商品"); return; }
  currentCheckoutTotal = posCart.reduce((s, i) => s + i.price, 0);
  
  document.getElementById("cash-modal-total").textContent = "$" + currentCheckoutTotal;
  document.getElementById("cash-received").value = "";
  document.getElementById("cash-modal-change").textContent = "$0";
  document.getElementById("cash-modal-change").style.color = "#388e3c";
  
  document.getElementById("cash-modal").classList.add("active");
  // 自動 Focus 到輸入框方便鍵盤輸入
  setTimeout(() => document.getElementById("cash-received").focus(), 100);
}

function closeCashModal(force) {
  if (force === true || (force && force.target.id === 'cash-modal')) {
    document.getElementById("cash-modal").classList.remove("active");
  }
}

function calculateChange() {
  const received = Number(document.getElementById("cash-received").value);
  const changeEl = document.getElementById("cash-modal-change");
  
  if (!received) {
    changeEl.textContent = "$0";
    changeEl.style.color = "#388e3c";
    return;
  }
  
  const change = received - currentCheckoutTotal;
  if (change < 0) {
    changeEl.textContent = "金額不足";
    changeEl.style.color = "#d32f2f";
  } else {
    changeEl.textContent = "$" + change;
    changeEl.style.color = "#388e3c";
  }
}

function confirmCashCheckout() {
  const received = Number(document.getElementById("cash-received").value);
  if (received < currentCheckoutTotal) {
    alert("支付金額不足以結帳！");
    return;
  }
  closeCashModal(true);
  processCheckout('現金');
}

// --- 4. 結帳送單核心 ---
async function processCheckout(payMethod) {
  if (posCart.length === 0) { alert("結帳區目前沒有商品"); return; }
  
  if (processingOnlineOrderId !== null) {
    try {
      const response = await fetch(APP_CONFIG.GAS_API_URL, {
        method: "POST",
        body: JSON.stringify({ action: "updateOrderStatus", orderId: processingOnlineOrderId, status: "已完成" })
      });
      const result = await response.json();
      if(result.success) {
        // 如果是 LINE Pay，顯示不同提示字
        const msg = payMethod === '現金' ? "線上訂單結帳成功，找零已完成！" : "線上訂單已確認 LINE Pay 付款！";
        alert(msg);
        clearCart();
        fetchOnlineOrders(); 
      } else { alert("結帳失敗：" + result.message); }
    } catch(e) { alert("系統連線錯誤"); }

  } else {
    let posDineIn = "外帶";
    const dineInEl = document.querySelector('input[name="posDineInType"]:checked');
    if(dineInEl) posDineIn = dineInEl.value;

    const total = posCart.reduce((s, i) => s + i.price, 0);
    const payload = {
      action: "appendOrder",
      orderData: {
        timestamp: new Date().toLocaleString("zh-TW", {timeZone: "Asia/Taipei"}),
        uid: "GUEST_" + Date.now().toString().slice(-6),
        name: "現場客",
        dineInType: posDineIn, 
        itemsJson: JSON.stringify(posCart.map(i => ({ name: i.name, price: i.price, qty: 1 }))),
        originalTotal: total,
        discount: 0,
        finalTotal: total,
        paymentMethod: payMethod
      }
    };
    
    try {
      const response = await fetch(APP_CONFIG.GAS_API_URL, { method: "POST", body: JSON.stringify(payload) });
      const result = await response.json();
      if(result.success) {
        await fetch(APP_CONFIG.GAS_API_URL, { method: "POST", body: JSON.stringify({ action: "updateOrderStatus", orderId: result.orderId, status: "已完成" }) });
        const msg = payMethod === '現金' ? `現場單結帳成功 (${posDineIn})\n找零已完成。` : `現場單結帳成功 (${posDineIn} / LINE Pay)`;
        alert(msg);
        clearCart();
      }
    } catch (error) { alert("結帳發生錯誤"); }
  }
}

// --- 5. 初始化右側菜單 ---
async function fetchMenu() {
  try {
    const response = await fetch(APP_CONFIG.GAS_API_URL, {
      method: "POST",
      body: JSON.stringify({ action: "getMenu" })
    });
    const result = await response.json();
    if (result.success) {
      menuData = result.data;
      renderPosMenu(menuData);
    }
  } catch (error) {}
}

function renderPosMenu(data) {
  const tabsContainer = document.getElementById("category-tabs");
  tabsContainer.innerHTML = "";
  const categories = [...new Set(data.map(item => item["大類別"]))];
  
  categories.forEach((cat, index) => {
    const btn = document.createElement("button");
    btn.className = `tab-btn ${index === 0 ? 'active' : ''}`;
    btn.textContent = cat;
    btn.onclick = () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderPosGrid(cat);
    };
    tabsContainer.appendChild(btn);
  });
  if(categories.length > 0) renderPosGrid(categories[0]);
}

function renderPosGrid(category) {
  const gridContainer = document.getElementById("pos-grid");
  gridContainer.innerHTML = "";
  const items = menuData.filter(item => item["大類別"] === category);
  
  items.forEach(item => {
    const div = document.createElement("div");
    div.className = "pos-item";
    div.innerHTML = `
      <div style="font-weight:bold; margin-bottom:8px; font-size:14px;">${item["商品名稱"]}</div>
      <div style="color:var(--accent-color); font-weight:bold;">$${item["預設價格"]}</div>
    `;
    div.onclick = () => addPosCart(item);
    gridContainer.appendChild(div);
  });
}
