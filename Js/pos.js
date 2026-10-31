/**
 * Js/pos.js - 櫃台 POS 系統邏輯 
 */

let posCart = [];
let menuData = [];
let processingOnlineOrderId = null; 
let currentOnlineOrders = [];
let currentCheckoutTotal = 0; 

document.addEventListener("DOMContentLoaded", () => {
  if (typeof APP_CONFIG === 'undefined') {
    showError("❌ 設定檔未載入");
    return;
  }
  fetchMenu();
  fetchOnlineOrders();
  setInterval(fetchOnlineOrders, 10000); 
});

function showError(msg) {
  const el = document.getElementById("error-msg");
  el.textContent = msg;
  el.style.display = "block";
  setTimeout(() => { el.style.display = "none"; }, 4000);
}

// --- 1. 左側：線上點餐看板邏輯 (分流至三個區塊) ---
async function fetchOnlineOrders() {
  const pendingContainer = document.getElementById("pending-container");
  const makingContainer = document.getElementById("making-container");
  const completedContainer = document.getElementById("completed-container");
  
  try {
    const response = await fetch(APP_CONFIG.GAS_API_URL, {
      method: "POST",
      body: JSON.stringify({ action: "getActiveOrders" })
    });
    const result = await response.json();
    
    if (result.success) {
      currentOnlineOrders = result.data; 
      pendingContainer.innerHTML = ""; makingContainer.innerHTML = ""; completedContainer.innerHTML = "";
      
      let pendingCount = 0, makingCount = 0, completedCount = 0;
      
      currentOnlineOrders.forEach(order => {
        const cardHtml = createOrderCard(order);
        if (order["訂單狀態"] === "等待結帳") {
          pendingContainer.innerHTML += cardHtml; pendingCount++;
        } else if (order["訂單狀態"] === "製作中") {
          makingContainer.innerHTML += cardHtml; makingCount++;
        } else if (order["訂單狀態"] === "已完成") {
          completedContainer.innerHTML += cardHtml; completedCount++;
        }
      });

      if(pendingCount === 0) pendingContainer.innerHTML = "<p style='color:#999; text-align:center; font-size:13px;'>無資料</p>";
      if(makingCount === 0) makingContainer.innerHTML = "<p style='color:#999; text-align:center; font-size:13px;'>無資料</p>";
      if(completedCount === 0) completedContainer.innerHTML = "<p style='color:#999; text-align:center; font-size:13px;'>無資料</p>";
    }
  } catch (error) { showError("訂單更新失敗，請檢查網路"); }
}

function createOrderCard(order) {
  let itemsHtml = "";
  try {
    const items = JSON.parse(order["訂單內容(JSON)"]);
    items.forEach(item => {
      let spec = [item.size, item.temp, item.sugar, item.ecoCup === "自備環保杯" ? "(自備)" : ""].filter(Boolean).join("/");
      itemsHtml += `<div style="font-size:12px; margin-bottom:3px;">- ${item.name} x1 [${spec}]</div>`;
      if (item.note) itemsHtml += `<div style="font-size:11px; color:#d32f2f; margin-left:8px;">*${item.note}</div>`;
    });
  } catch (e) { itemsHtml = "無法解析"; }

  let actionBtnHtml = "";
  if (order["訂單狀態"] === "等待結帳") {
    actionBtnHtml = `<button class="action-btn" onclick="updateOrderStatus('${order["訂單編號"]}', '製作中')">接單 (開始製作)</button>`;
  } else if (order["訂單狀態"] === "製作中") {
    actionBtnHtml = `<button class="action-btn" style="background:#388e3c;" onclick="loadOrderToCheckout('${order["訂單編號"]}')">👉 前往結帳收銀</button>`;
  } else if (order["訂單狀態"] === "已完成") {
    actionBtnHtml = `<div style="text-align:right; font-size:12px; color:#666;">已結帳 (${order["付款方式"]})</div>`;
  }

  const dineInBadge = order["用餐方式"] === '內用' 
    ? `<span style="padding:3px 6px; border-radius:4px; background:#e65100; color:white; font-size:11px; font-weight:bold;">🍽️ 內用</span>` 
    : `<span style="padding:3px 6px; border-radius:4px; background:#8D6E63; color:white; font-size:11px; font-weight:bold;">🛍️ 外帶</span>`;

  return `
    <div class="order-card" style="${order["訂單狀態"]==='已完成' ? 'opacity:0.7; border-left-color:#9e9e9e;' : ''}">
      <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:8px;">
        <div>
          <div style="font-size:14px; font-weight:bold; margin-bottom:2px;">${order["會員姓名"]}</div>
          <div style="font-size:10px; color:#666; margin-bottom:4px;">${order["訂單編號"]}</div>
          ${dineInBadge}
        </div>
      </div>
      <div style="margin: 8px 0; border-left: 2px solid #eee; padding-left: 8px;">${itemsHtml}</div>
      <div style="display:flex; justify-content:space-between; align-items:center; font-weight:bold; margin-top:5px;">
        <span style="color:#d32f2f; font-size:16px;">$${order["實收金額"]}</span>
      </div>
      ${actionBtnHtml}
    </div>
  `;
}

async function updateOrderStatus(orderId, newStatus) {
  try {
    const response = await fetch(APP_CONFIG.GAS_API_URL, {
      method: "POST",
      body: JSON.stringify({ action: "updateOrderStatus", orderId: orderId, status: newStatus })
    });
    const result = await response.json();
    if (result.success) fetchOnlineOrders();
    else showError("狀態更新失敗：" + result.message);
  } catch (error) { showError("系統連線錯誤"); }
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
    document.querySelector('label[for="pos-dinein"]').click();
  } else {
    document.getElementById('pos-takeaway').checked = true;
    document.querySelector('label[for="pos-takeaway"]').click();
  }
  
  // 清空並隱藏電話輸入框 (處理線上單不需要填電話)
  const phoneInput = document.getElementById("pos-member-phone");
  phoneInput.value = "";
  phoneInput.style.display = "none";
  
  updatePosCartUI();
}

function addPosCart(item) {
  if (processingOnlineOrderId !== null) {
    if(confirm("正在處理線上訂單，確定要清空並建立現場新單嗎？")) clearCart();
    else return;
  }
  posCart.push({ id: Date.now().toString(), productId: item["商品編號"], name: item["商品名稱"], price: Number(item["預設價格"]) });
  updatePosCartUI();
}

function removePosCart(id) {
  if (processingOnlineOrderId !== null) {
    alert("線上訂單無法修改品項，請直接結帳或點擊「清空/換單」。");
    return;
  }
  posCart = posCart.filter(item => item.id !== id);
  updatePosCartUI();
}

function clearCart() {
  posCart = [];
  processingOnlineOrderId = null;
  document.getElementById("current-order-badge").style.display = "none";
  document.getElementById("pos-member-phone").style.display = "block"; // 恢復顯示電話輸入框
  document.getElementById("pos-member-phone").value = "";
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
        <div style="flex:1;"><div style="font-weight:bold; font-size:14px; line-height:1.4;">${item.name}</div></div>
        <div style="font-weight:bold; margin: 0 10px; color:#d32f2f;">$${item.price}</div>
        <button style="color:red; background:none; border:none; cursor:pointer;" onclick="removePosCart('${item.id}')">✕</button>
      </div>
    `;
  });
  document.getElementById("pos-total").textContent = `Total: $${total}`;
}

// --- 3. 全螢幕對單與支付邏輯 ---
function closeModal(modalId) {
  document.getElementById(modalId).classList.remove("active");
}

function openFullCheckoutModal() {
  if (posCart.length === 0) { alert("結帳區目前沒有商品"); return; }
  currentCheckoutTotal = posCart.reduce((s, i) => s + i.price, 0);
  
  const typeLabel = document.querySelector('input[name="posDineInType"]:checked').value;
  let identity = processingOnlineOrderId ? "線上單" : "現場客";
  
  document.getElementById("full-modal-type").textContent = `${typeLabel === '內用' ? '🍽️' : '🛍️'} ${typeLabel} - ${identity}`;
  
  const itemsContainer = document.getElementById("full-modal-items");
  itemsContainer.innerHTML = "";
  posCart.forEach(item => {
    itemsContainer.innerHTML += `
      <div style="display:flex; justify-content:space-between; margin-bottom:15px; border-bottom:1px dashed #ccc; padding-bottom:10px;">
        <div style="flex:1;">${item.name}</div>
        <div style="font-weight:bold;">$${item.price}</div>
      </div>
    `;
  });
  document.getElementById("full-modal-total").textContent = `總計: $${currentCheckoutTotal}`;
  document.getElementById("full-checkout-modal").classList.add("active");
}

function selectPaymentMethod(method) {
  if (method === '現金') {
    closeModal('full-checkout-modal');
    openCashModal();
  } else {
    closeModal('full-checkout-modal');
    processCheckout(method);
  }
}

// 現金找零小彈窗
function openCashModal() {
  document.getElementById("cash-modal-total").textContent = "$" + currentCheckoutTotal;
  document.getElementById("cash-received").value = "";
  document.getElementById("cash-modal-change").textContent = "$0";
  document.getElementById("cash-modal-change").style.color = "#388e3c";
  
  document.getElementById("cash-modal").classList.add("active");
  setTimeout(() => document.getElementById("cash-received").focus(), 100);
}

function calculateChange() {
  const received = Number(document.getElementById("cash-received").value);
  const changeEl = document.getElementById("cash-modal-change");
  
  if (!received) { changeEl.textContent = "$0"; changeEl.style.color = "#388e3c"; return; }
  const change = received - currentCheckoutTotal;
  if (change < 0) {
    changeEl.textContent = "金額不足"; changeEl.style.color = "#d32f2f";
  } else {
    changeEl.textContent = "$" + change; changeEl.style.color = "#388e3c";
  }
}

function confirmCashCheckout() {
  const received = Number(document.getElementById("cash-received").value);
  if (received < currentCheckoutTotal) { alert("支付金額不足！"); return; }
  closeModal('cash-modal');
  processCheckout('現金');
}

// 送單 (包含現場客綁定會員資料邏輯)
async function processCheckout(payMethod) {
  if (processingOnlineOrderId !== null) {
    // 處理左側載入的線上單：只更新狀態為已完成
    try {
      const response = await fetch(APP_CONFIG.GAS_API_URL, {
        method: "POST",
        body: JSON.stringify({ action: "updateOrderStatus", orderId: processingOnlineOrderId, status: "已完成" })
      });
      const result = await response.json();
      if(result.success) {
        alert("結帳成功！狀態已更新。");
        clearCart();
        fetchOnlineOrders(); 
      } else { showError("結帳失敗：" + result.message); }
    } catch(e) { showError("系統連線錯誤"); }

  } else {
    // 處理現場新建立的單：檢查是否有輸入會員電話
    const posDineIn = document.querySelector('input[name="posDineInType"]:checked').value;
    const phoneInput = document.getElementById("pos-member-phone").value.trim();
    
    let targetUid = "GUEST_" + Date.now().toString().slice(-6);
    let targetName = "現場客";

    // 若有填寫電話，先呼叫 API 查詢會員資料
    if (phoneInput) {
      try {
        const checkRes = await fetch(APP_CONFIG.GAS_API_URL, {
          method: "POST",
          body: JSON.stringify({ action: "findMemberByPhone", phone: phoneInput })
        });
        const checkResult = await checkRes.json();
        if (checkResult.success) {
          targetUid = checkResult.uid;
          targetName = checkResult.name;
        } else {
          if(!confirm(`找不到號碼 ${phoneInput} 的會員。要以「現場客」身分繼續結帳嗎？`)) return;
        }
      } catch (error) { showError("查詢會員失敗，將以訪客身分結帳"); }
    }

    const payload = {
      action: "appendOrder",
      orderData: {
        timestamp: new Date().toLocaleString("zh-TW", {timeZone: "Asia/Taipei"}),
        uid: targetUid,
        name: targetName,
        dineInType: posDineIn, 
        itemsJson: JSON.stringify(posCart.map(i => ({ name: i.name, price: i.price, qty: 1 }))),
        originalTotal: currentCheckoutTotal, discount: 0, finalTotal: currentCheckoutTotal,
        paymentMethod: payMethod,
        status: "已完成" // 現場結帳直接為已完成
      }
    };
    
    try {
      const response = await fetch(APP_CONFIG.GAS_API_URL, { method: "POST", body: JSON.stringify(payload) });
      const result = await response.json();
      if(result.success) {
        alert(`結帳成功！已歸檔至：${targetName}`);
        clearCart();
        fetchOnlineOrders();
      }
    } catch (error) { showError("結帳發生錯誤"); }
  }
}

// --- 初始化右側菜單 ---
async function fetchMenu() {
  try {
    const response = await fetch(APP_CONFIG.GAS_API_URL, { method: "POST", body: JSON.stringify({ action: "getMenu" }) });
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
    div.innerHTML = `<div style="font-weight:bold; margin-bottom:8px; font-size:13px;">${item["商品名稱"]}</div><div style="color:var(--accent-color); font-weight:bold;">$${item["預設價格"]}</div>`;
    div.onclick = () => addPosCart(item);
    gridContainer.appendChild(div);
  });
}
