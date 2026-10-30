/**
 * Js/pos.js - 櫃台 POS 系統邏輯
 */

let posCart = [];
let menuData = [];

document.addEventListener("DOMContentLoaded", () => {
  if (typeof APP_CONFIG === 'undefined') {
    document.getElementById("error-msg").textContent = "❌ 設定檔未載入";
    return;
  }
  fetchMenu();
  fetchOnlineOrders();
  setInterval(fetchOnlineOrders, 15000); // 15秒自動刷新接單
});

// --- 處理線上訂單 (左側) ---
async function fetchOnlineOrders() {
  const container = document.getElementById("pending-orders-container");
  try {
    const response = await fetch(APP_CONFIG.GAS_API_URL, {
      method: "POST",
      body: JSON.stringify({ action: "getActiveOrders" })
    });
    const result = await response.json();
    
    if (result.success) {
      container.innerHTML = "";
      if (result.data.length === 0) {
        container.innerHTML = "<p>目前無待接訂單</p>";
        return;
      }
      
      result.data.forEach(order => {
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
          actionBtnHtml = `<button class="action-btn" onclick="updateOrderStatus('${order["訂單編號"]}', '製作中')">接單 (轉製作中)</button>`;
        } else if (order["訂單狀態"] === "製作中") {
          actionBtnHtml = `<button class="action-btn" style="background:#388e3c;" onclick="updateOrderStatus('${order["訂單編號"]}', '已完成')">✅ 完成結帳</button>`;
        }

        const dineInBadge = order["用餐方式"] === '內用' 
          ? `<span style="padding:4px 8px; border-radius:6px; background:#e65100; color:white; font-size:12px; font-weight:bold;">🍽️ 內用</span>` 
          : `<span style="padding:4px 8px; border-radius:6px; background:#8D6E63; color:white; font-size:12px; font-weight:bold;">🛍️ 外帶</span>`;

        const card = document.createElement("div");
        card.className = "order-card";
        card.innerHTML = `
          <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:10px;">
            <div>
              <h4 style="margin-bottom:4px;">${order["會員姓名"]} <span style="font-size:12px; color:#666;">(${order["訂單編號"]})</span></h4>
              ${dineInBadge}
            </div>
            <span style="font-size:12px; font-weight:bold; color: ${order["訂單狀態"] === '製作中' ? '#e65100' : '#d32f2f'};">${order["訂單狀態"]}</span>
          </div>
          <div style="margin: 10px 0; border-left: 2px solid #ccc; padding-left: 8px;">${itemsHtml}</div>
          <div style="display:flex; justify-content:space-between; align-items:center; font-weight:bold;">
            <span>${order["付款方式"]}</span>
            <span style="color:#d32f2f; font-size:16px;">$${order["實收金額"]}</span>
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
  if (!confirm(`確定要將訂單 ${orderId} 設為「${newStatus}」嗎？`)) return;
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

// --- 處理現場訪客點餐 (中/右側) ---
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
  } catch (error) { document.getElementById("pos-grid").innerHTML = "<p>菜單載入失敗</p>"; }
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
      <div style="color:var(--accent-color);">$${item["預設價格"]}</div>
    `;
    div.onclick = () => addPosCart(item);
    gridContainer.appendChild(div);
  });
}

function addPosCart(item) {
  posCart.push({ id: Date.now().toString(), productId: item["商品編號"], name: item["商品名稱"], price: Number(item["預設價格"]) });
  updatePosCartUI();
}

function removePosCart(id) {
  posCart = posCart.filter(item => item.id !== id);
  updatePosCartUI();
}

function clearCart() {
  posCart = [];
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
          <div style="font-weight:bold; font-size:14px;">${item.name}</div>
        </div>
        <div style="font-weight:bold; margin: 0 10px;">$${item.price}</div>
        <button style="color:red; background:none; border:none; cursor:pointer;" onclick="removePosCart('${item.id}')">✕</button>
      </div>
    `;
  });
  document.getElementById("pos-total").textContent = `Total: $${total}`;
}

async function processCheckout(payMethod) {
  if (posCart.length === 0) { alert("購物車是空的"); return; }
  
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
      alert(`現場結帳完成 (${posDineIn} / ${payMethod})`);
      clearCart();
    }
  } catch (error) { alert("結帳發生錯誤"); }
}
