/**
 * Js/pos.js - 櫃台 POS 系統邏輯 
 */

let posCart = [];
let menuData = [];
let processingOnlineOrderId = null; 
let currentOnlineOrders = [];
let currentCheckoutTotal = 0; 

document.addEventListener("DOMContentLoaded", () => {
  if (typeof APP_CONFIG === 'undefined') { showError("❌ 設定檔未載入"); return; }
  fetchMenu();
  fetchOnlineOrders();
  setInterval(fetchOnlineOrders, 10000); 
});

function showError(msg) {
  const el = document.getElementById("error-msg");
  el.textContent = msg; el.style.display = "block";
  setTimeout(() => { el.style.display = "none"; }, 4000);
}

// 左側看板邏輯 (已確保能載入全部當日訂單)
async function fetchOnlineOrders() {
  const pendingContainer = document.getElementById("pending-container");
  const makingContainer = document.getElementById("making-container");
  const completedContainer = document.getElementById("completed-container");
  const historyContainer = document.getElementById("history-list-container"); // 側邊面板容器
  
  try {
    const response = await fetch(APP_CONFIG.GAS_API_URL, { method: "POST", body: JSON.stringify({ action: "getActiveOrders" }) });
    const result = await response.json();
    
    if (result.success) {
      currentOnlineOrders = result.data; 
      pendingContainer.innerHTML = ""; makingContainer.innerHTML = ""; completedContainer.innerHTML = ""; historyContainer.innerHTML = "";
      
      let pendingCount = 0, makingCount = 0, completedCount = 0;
      let completedHtml = ""; // 收集所有已完成訂單準備放入側邊面板
      
      currentOnlineOrders.forEach(order => {
        const cardHtml = createOrderCard(order);
        const status = order["訂單狀態"];
        if (status === "待接單" || status === "等待結帳") {
          pendingContainer.innerHTML += cardHtml; pendingCount++;
        } else if (status === "製作中(未結)" || status === "可出餐(已結)" || status === "製作中") {
          makingContainer.innerHTML += cardHtml; makingCount++;
        } else if (status === "已完成") {
          // 左下角只顯示最新 5 筆
          if(completedCount < 5) completedContainer.innerHTML += cardHtml; 
          completedCount++;
          // 側邊面板顯示全部
          completedHtml += createHistoryCard(order);
        }
      });

      if(pendingCount === 0) pendingContainer.innerHTML = "<p style='color:#999; text-align:center;'>無資料</p>";
      if(makingCount === 0) makingContainer.innerHTML = "<p style='color:#999; text-align:center;'>無資料</p>";
      if(completedCount === 0) {
        completedContainer.innerHTML = "<p style='color:#999; text-align:center;'>無資料</p>";
        historyContainer.innerHTML = "<p style='text-align:center; color:#666; margin-top:20px;'>尚無已完成訂單</p>";
      } else {
        historyContainer.innerHTML = completedHtml;
      }
    }
  } catch (error) { showError("訂單更新失敗"); }
}

function createOrderCard(order) {
  let itemsHtml = "";
  try {
    const items = JSON.parse(order["訂單內容(JSON)"]);
    items.forEach(item => {
      let spec = [item.size, item.temp, item.sugar, item.ecoCup === "自備環保杯" ? "(自備)" : ""].filter(Boolean).join("/");
      itemsHtml += `<div style="font-size:12px; margin-bottom:3px; line-height:1.4;">- ${item.name} x1 [${spec}]</div>`;
      if (item.note) itemsHtml += `<div style="font-size:11px; color:#d32f2f; margin-left:8px;">*備註:${item.note}</div>`;
    });
  } catch (e) { itemsHtml = "無法解析"; }

  let actionBtnHtml = "";
  const orderIdStr = String(order["訂單編號"]);

  if (order["訂單狀態"] === "待接單" || order["訂單狀態"] === "等待結帳") {
    actionBtnHtml = `<div style="display:flex; gap:8px; margin-top:10px;"><button class="action-btn" style="flex:1; margin-top:0; background:#e65100; font-size:12px;" onclick="updateOrderStatus('${orderIdStr}', '製作中(未結)')">🧑‍🍳 先製作</button><button class="action-btn" style="flex:1; margin-top:0; background:#1976D2; font-size:12px;" onclick="loadOrderToCheckout('${orderIdStr}')">💰 先結帳</button></div>`;
  } else if (order["訂單狀態"] === "製作中(未結)" || order["訂單狀態"] === "製作中") {
    actionBtnHtml = `<button class="action-btn" style="background:#1976D2; margin-top:10px;" onclick="loadOrderToCheckout('${orderIdStr}')">💰 結帳後出餐</button>`;
  } else if (order["訂單狀態"] === "可出餐(已結)") {
    actionBtnHtml = `<button class="action-btn" style="background:#388e3c; margin-top:10px;" onclick="updateOrderStatus('${orderIdStr}', '已完成')">🛎️ 直接出餐 (完成)</button>`;
  } else if (order["訂單狀態"] === "已完成") {
    actionBtnHtml = `<div style="text-align:right; font-size:12px; color:#666; margin-top:10px;">已結帳 (${order["付款方式"]})</div>`;
  }

  const dineInBadge = order["用餐方式"] === '內用' ? `<span style="padding:3px 6px; border-radius:4px; background:#e65100; color:white; font-size:11px; font-weight:bold;">🍽️ 內用</span>` : `<span style="padding:3px 6px; border-radius:4px; background:#8D6E63; color:white; font-size:11px; font-weight:bold;">🛍️ 外帶</span>`;

  return `
    <div class="order-card" style="padding-bottom:15px; ${order["訂單狀態"]==='已完成' ? 'opacity:0.7; border-left-color:#9e9e9e;' : ''}">
      <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:8px;">
        <div><div style="font-size:14px; font-weight:bold; margin-bottom:2px;">${order["會員姓名"]}</div><div style="font-size:11px; color:#666; margin-bottom:6px;">${orderIdStr}</div>${dineInBadge}</div>
      </div>
      <div style="margin: 8px 0; border-left: 2px solid #eee; padding-left: 8px;">${itemsHtml}</div>
      <div style="display:flex; justify-content:space-between; align-items:center; font-weight:bold; margin-top:8px;">
        <span style="color:#d32f2f; font-size:16px;">$${order["實收金額"]}</span>
      </div>
      ${actionBtnHtml}
    </div>
  `;
}

// 產生側邊歷史訂單卡片
function createHistoryCard(order) {
  let summary = "";
  try {
    const items = JSON.parse(order["訂單內容(JSON)"]);
    summary = items.map(i => i.name.split(" [")[0]).join(", ");
    if(summary.length > 20) summary = summary.substring(0, 20) + "...";
  } catch(e) { summary = "商品"; }
  
  const time = order["建立時間"].split(" ")[1] || order["建立時間"];
  return `
    <div class="history-card">
      <div style="display:flex; justify-content:space-between; margin-bottom:5px;">
        <strong>${order["會員姓名"]} <span style="font-size:12px; color:#666;">(${order["訂單編號"]})</span></strong>
        <span style="color:#8D6E63;">$${order["實收金額"]}</span>
      </div>
      <div style="font-size:13px; color:#444; margin-bottom:5px;">📋 ${summary}</div>
      <div style="display:flex; justify-content:space-between; font-size:12px; color:#888;">
        <span>🕒 ${time}</span>
        <span>${order["付款方式"]}</span>
      </div>
    </div>
  `;
}

function toggleHistoryPanel() {
  const panel = document.getElementById("history-panel");
  panel.classList.toggle("open");
}

async function updateOrderStatus(orderId, newStatus) {
  try {
    const response = await fetch(APP_CONFIG.GAS_API_URL, { method: "POST", body: JSON.stringify({ action: "updateOrderStatus", orderId: String(orderId), status: newStatus }) });
    const result = await response.json();
    if (result.success) fetchOnlineOrders();
    else showError("狀態更新失敗：" + result.message);
  } catch (error) { showError("系統連線錯誤"); }
}

function loadOrderToCheckout(orderId) {
  const targetId = String(orderId);
  const order = currentOnlineOrders.find(o => String(o["訂單編號"]) === targetId);
  if (!order) { showError("無法載入訂單"); return; }
  
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

  processingOnlineOrderId = targetId;
  const badge = document.getElementById("current-order-badge");
  badge.style.display = "block"; badge.textContent = `收銀處理中：${order["會員姓名"]} (${targetId})`;

  if (order["用餐方式"] === "內用") { document.getElementById('pos-dinein').checked = true; document.querySelector('label[for="pos-dinein"]').click(); } 
  else { document.getElementById('pos-takeaway').checked = true; document.querySelector('label[for="pos-takeaway"]').click(); }
  
  const phoneInput = document.getElementById("pos-member-phone");
  phoneInput.value = ""; phoneInput.style.display = "none";
  updatePosCartUI();
}

function addPosCart(item) {
  if (processingOnlineOrderId !== null) {
    if(confirm("正在處理線上訂單，確定要清空並建立現場新單嗎？")) clearCart(); else return;
  }
  posCart.push({ id: Date.now().toString(), productId: item["商品編號"], name: item["商品名稱"], price: Number(item["預設價格"]) });
  updatePosCartUI();
}

function removePosCart(id) {
  if (processingOnlineOrderId !== null) { alert("線上訂單無法修改品項，請直接結帳或點擊「清空/換單」。"); return; }
  posCart = posCart.filter(item => item.id !== id);
  updatePosCartUI();
}

function clearCart() {
  posCart = []; processingOnlineOrderId = null;
  document.getElementById("current-order-badge").style.display = "none";
  document.getElementById("pos-member-phone").style.display = "block"; document.getElementById("pos-member-phone").value = "";
  updatePosCartUI();
}

function updatePosCartUI() {
  const list = document.getElementById("pos-cart-list"); list.innerHTML = ""; let total = 0;
  posCart.forEach(item => {
    total += item.price;
    list.innerHTML += `<div class="cart-item"><div style="flex:1;"><div style="font-weight:bold; font-size:14px; line-height:1.4;">${item.name}</div></div><div style="font-weight:bold; margin: 0 10px; color:#d32f2f;">$${item.price}</div><button style="color:red; background:none; border:none; cursor:pointer;" onclick="removePosCart('${item.id}')">✕</button></div>`;
  });
  document.getElementById("pos-total").textContent = `Total: $${total}`;
}

function closeModal(modalId) { document.getElementById(modalId).classList.remove("active"); }

function openFullCheckoutModal() {
  if (posCart.length === 0) { alert("結帳區目前沒有商品"); return; }
  currentCheckoutTotal = posCart.reduce((s, i) => s + i.price, 0);
  const typeLabel = document.querySelector('input[name="posDineInType"]:checked').value;
  let identity = processingOnlineOrderId ? "線上單" : "現場客";
  document.getElementById("full-modal-type").textContent = `${typeLabel === '內用' ? '🍽️' : '🛍️'} ${typeLabel} - ${identity}`;
  
  const itemsContainer = document.getElementById("full-modal-items"); itemsContainer.innerHTML = "";
  posCart.forEach(item => { itemsContainer.innerHTML += `<div style="display:flex; justify-content:space-between; margin-bottom:15px; border-bottom:1px dashed #ccc; padding-bottom:10px;"><div style="flex:1;">${item.name}</div><div style="font-weight:bold;">$${item.price}</div></div>`; });
  document.getElementById("full-modal-total").textContent = `總計: $${currentCheckoutTotal}`;
  document.getElementById("full-checkout-modal").classList.add("active");
}

function selectPaymentMethod(method) {
  if (method === '現金') { closeModal('full-checkout-modal'); openCashModal(); } 
  else { closeModal('full-checkout-modal'); processCheckout(method); }
}

function openCashModal() {
  document.getElementById("cash-modal-total").textContent = "$" + currentCheckoutTotal;
  document.getElementById("cash-received").value = ""; document.getElementById("cash-modal-change").textContent = "$0"; document.getElementById("cash-modal-change").style.color = "#388e3c";
  document.getElementById("cash-modal").classList.add("active");
  setTimeout(() => document.getElementById("cash-received").focus(), 100);
}

function calculateChange() {
  const received = Number(document.getElementById("cash-received").value);
  const changeEl = document.getElementById("cash-modal-change");
  if (!received) { changeEl.textContent = "$0"; changeEl.style.color = "#388e3c"; return; }
  const change = received - currentCheckoutTotal;
  if (change < 0) { changeEl.textContent = "金額不足"; changeEl.style.color = "#d32f2f"; } 
  else { changeEl.textContent = "$" + change; changeEl.style.color = "#388e3c"; }
}

function confirmCashCheckout() {
  const received = Number(document.getElementById("cash-received").value);
  if (received < currentCheckoutTotal) { alert("支付金額不足！"); return; }
  closeModal('cash-modal'); processCheckout('現金');
}

async function processCheckout(payMethod) {
  if (processingOnlineOrderId !== null) {
    let nextStatus = "已完成";
    if (!confirm(`✅ 收銀結帳成功 (${payMethod})！\n\n這筆線上訂單是否要直接「完成出餐」？\n\n[確定]：出餐完畢 (直接完成)\n[取消]：僅結帳，稍後出餐 (移至可出餐)`)) { nextStatus = "可出餐(已結)"; }
    try {
      const response = await fetch(APP_CONFIG.GAS_API_URL, { method: "POST", body: JSON.stringify({ action: "updateOrderStatus", orderId: String(processingOnlineOrderId), status: nextStatus, payMethod: payMethod }) });
      const result = await response.json();
      if(result.success) { alert(`狀態已更新為：${nextStatus}`); clearCart(); fetchOnlineOrders(); } 
      else { showError("結帳狀態更新失敗：" + result.message); }
    } catch(e) { showError("系統連線錯誤"); }
  } else {
    const posDineIn = document.querySelector('input[name="posDineInType"]:checked').value;
    const phoneInput = document.getElementById("pos-member-phone").value.trim();
    let targetUid = "GUEST_" + Date.now().toString().slice(-6); let targetName = "現場客";
    if (phoneInput) {
      try {
        const checkRes = await fetch(APP_CONFIG.GAS_API_URL, { method: "POST", body: JSON.stringify({ action: "findMemberByPhone", phone: phoneInput }) });
        const checkResult = await checkRes.json();
        if (checkResult.success) { targetUid = checkResult.uid; targetName = checkResult.name; } 
        else { if(!confirm(`找不到號碼 ${phoneInput} 的會員。要以「現場客」身分繼續結帳嗎？`)) return; }
      } catch (error) { showError("查詢會員失敗，將以訪客身分結帳"); }
    }
    const payload = { action: "appendOrder", orderData: { timestamp: new Date().toLocaleString("zh-TW", {timeZone: "Asia/Taipei"}), uid: targetUid, name: targetName, dineInType: posDineIn, itemsJson: JSON.stringify(posCart.map(i => ({ name: i.name, price: i.price, qty: 1 }))), originalTotal: currentCheckoutTotal, discount: 0, finalTotal: currentCheckoutTotal, paymentMethod: payMethod, status: "已完成" } };
    try {
      const response = await fetch(APP_CONFIG.GAS_API_URL, { method: "POST", body: JSON.stringify(payload) });
      const result = await response.json();
      if(result.success) { alert(`結帳成功！已歸檔至：${targetName}`); clearCart(); fetchOnlineOrders(); }
    } catch (error) { showError("結帳發生錯誤"); }
  }
}

async function fetchMenu() {
  try {
    const response = await fetch(APP_CONFIG.GAS_API_URL, { method: "POST", body: JSON.stringify({ action: "getMenu" }) });
    const result = await response.json();
    if (result.success) { menuData = result.data; renderPosMenu(menuData); }
  } catch (error) {}
}

function renderPosMenu(data) {
  const tabsContainer = document.getElementById("category-tabs"); tabsContainer.innerHTML = "";
  const categories = [...new Set(data.map(item => item["大類別"]))];
  categories.forEach((cat, index) => {
    const btn = document.createElement("button"); btn.className = `tab-btn ${index === 0 ? 'active' : ''}`; btn.textContent = cat;
    btn.onclick = () => { document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active')); btn.classList.add('active'); renderPosGrid(cat); };
    tabsContainer.appendChild(btn);
  });
  if(categories.length > 0) renderPosGrid(categories[0]);
}

function renderPosGrid(category) {
  const gridContainer = document.getElementById("pos-grid"); gridContainer.innerHTML = "";
  const items = menuData.filter(item => item["大類別"] === category);
  items.forEach(item => {
    const div = document.createElement("div"); div.className = "pos-item";
    div.innerHTML = `<div style="font-weight:bold; margin-bottom:8px; font-size:13px;">${item["商品名稱"]}</div><div style="color:var(--accent-color); font-weight:bold;">$${item["預設價格"]}</div>`;
    div.onclick = () => addPosCart(item); gridContainer.appendChild(div);
  });
}
