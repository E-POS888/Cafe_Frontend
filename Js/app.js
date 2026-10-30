/**
 * Js/app.js - 顧客點餐前端邏輯
 */

let shoppingCart = [];
let currentUser = { role: "顧客" }; 
let tempUserProfile = null; 
let fullMenuData = []; 
let currentSelectingItem = null; 

document.addEventListener("DOMContentLoaded", () => {
  if (typeof APP_CONFIG === 'undefined') return;
  initializeLiff(APP_CONFIG.LIFF_ID);
  initCarousel(); 
});

function initCarousel() {
  const images = document.querySelectorAll('.carousel-img');
  if(images.length === 0) return;
  let currentIndex = 0;
  setInterval(() => {
    images[currentIndex].classList.remove('active');
    currentIndex = (currentIndex + 1) % images.length;
    images[currentIndex].classList.add('active');
  }, 4000); 
}

function showLoading(msg) {
  document.getElementById("loading-text").textContent = msg;
  document.getElementById("loading-screen").style.display = "flex";
}
function hideLoading() {
  document.getElementById("loading-screen").style.display = "none";
}

async function initializeLiff(myLiffId) {
  try {
    showLoading("正在連接 LINE 服務...");
    await liff.init({ liffId: myLiffId });
    if (!liff.isLoggedIn()) { liff.login(); return; }
    const profile = await liff.getProfile();
    updateProfileUI(profile.displayName, profile.pictureUrl);
    await verifyUserWithBackend(profile.userId, profile.displayName);
  } catch (err) {
    alert("LINE 驗證失敗");
  }
}

function updateProfileUI(name, picUrl) {
  document.getElementById("profile-name").textContent = name;
  if(picUrl) document.getElementById("profile-img").src = picUrl;
}

async function verifyUserWithBackend(uid, name) {
  showLoading("正在驗證會員權限...");
  try {
    const response = await fetch(APP_CONFIG.GAS_API_URL, {
      method: "POST",
      body: JSON.stringify({ action: "loginUser", uid: uid, name: name })
    });
    const result = await response.json();
    
    if (result.data && result.data.isNewUser) {
      tempUserProfile = result.data.profile; 
      document.getElementById("reg-name").value = tempUserProfile.name; 
      hideLoading();
      document.getElementById("register-modal").classList.add("active");
    } else {
      currentUser = { 
        uid: uid, 
        name: result.data.userData["姓名(可變更)"], 
        role: result.data.userData["系統權限"] 
      };
      if (currentUser.role === "管理員") document.getElementById("admin-entrance").style.display = "block";
      await fetchMenuFromBackend();
    }
  } catch (error) {
    alert("會員驗證失敗");
  }
}

async function submitRegistration() {
  const name = document.getElementById("reg-name").value.trim();
  const phone = document.getElementById("reg-phone").value.trim();
  const floor = document.getElementById("reg-floor").value.trim();
  const note = document.getElementById("reg-note").value.trim(); 
  
  if (!name || !phone) { alert("請填寫姓名與手機號碼！"); return; }
  
  document.getElementById("register-modal").classList.remove("active");
  showLoading("正在建立會員資料...");
  try {
    const response = await fetch(APP_CONFIG.GAS_API_URL, {
      method: "POST",
      body: JSON.stringify({ 
        action: "registerUser", 
        userData: { uid: tempUserProfile.uid, name, phone, floor, note } 
      })
    });
    const result = await response.json();
    if (result.success) {
       currentUser = { uid: tempUserProfile.uid, name: name, role: "顧客" };
       await fetchMenuFromBackend();
    }
  } catch (error) { alert("網路連線錯誤"); }
}

async function fetchMenuFromBackend() {
  showLoading("正在擷取精品咖啡風味...");
  try {
    const response = await fetch(APP_CONFIG.GAS_API_URL, {
      method: "POST",
      body: JSON.stringify({ action: "getMenu" })
    });
    const result = await response.json();
    if (result.success) {
      fullMenuData = result.data; 
      renderMenu(fullMenuData);
      hideLoading();
    }
  } catch (error) { alert("無法連線資料庫"); }
}

function renderMenu(menuData) {
  const container = document.getElementById("menu-container");
  const stickyNav = document.getElementById("sticky-nav");
  container.innerHTML = ""; stickyNav.innerHTML = "";
  
  const categories = {};
  menuData.forEach(item => {
    const cat = item["大類別"];
    if (!categories[cat]) categories[cat] = [];
    categories[cat].push(item);
  });
  
  let isFirst = true;
  for (const [catName, items] of Object.entries(categories)) {
    const navBtn = document.createElement("button");
    navBtn.className = `nav-tab ${isFirst ? 'active' : ''}`;
    navBtn.textContent = catName;
    navBtn.onclick = () => {
      document.querySelectorAll('.nav-tab').forEach(b => b.classList.remove('active'));
      navBtn.classList.add('active');
      const section = document.getElementById(`cat-${catName}`);
      if(section) window.scrollTo({top: section.getBoundingClientRect().top + window.scrollY - 110, behavior: 'smooth'});
    };
    stickyNav.appendChild(navBtn);
    isFirst = false;

    const section = document.createElement("div");
    section.id = `cat-${catName}`; section.className = "category-section";
    section.innerHTML = `<div class="category-title">${catName}</div>`;
    const grid = document.createElement("div"); grid.className = "product-grid";
    
    items.forEach(item => {
      const imgUrl = item["照片網址(Drive)"] || "https://via.placeholder.com/80?text=No+Image";
      const card = document.createElement("div");
      card.className = "product-card";
      card.onclick = () => openProductModal(item["商品編號"]);
      card.innerHTML = `<img class="product-image" src="${imgUrl}" alt="${item["商品名稱"]}"><div class="product-info"><h3 class="product-name">${item["商品名稱"]}</h3><div class="product-price">$${item["預設價格"]}</div><button class="add-btn">選擇風味</button></div>`;
      grid.appendChild(card);
    });
    section.appendChild(grid);
    container.appendChild(section);
  }
}

function closeModal(modalId, force = false) {
  if (force === true || (force && force.target.id === modalId)) {
    document.getElementById(modalId).classList.remove("active");
    document.body.style.overflow = ""; 
    if(modalId === 'product-modal') currentSelectingItem = null;
  }
}

function openProductModal(productId) {
  currentSelectingItem = fullMenuData.find(item => item["商品編號"] === productId);
  if(!currentSelectingItem) return;
  document.getElementById("modal-title").textContent = currentSelectingItem["商品名稱"];
  document.getElementById("modal-price").textContent = "$" + currentSelectingItem["預設價格"];
  document.getElementById("modal-desc").textContent = currentSelectingItem["商品描述"] || "精選莊園級咖啡豆，為您帶來最純粹的風味體驗。";
  
  const opts = document.getElementById("modal-options-container"); opts.innerHTML = "";
  if (currentSelectingItem["大類別"] !== "精品限定" && currentSelectingItem["大類別"] !== "甜點" && currentSelectingItem["大類別"] !== "輕食") {
    opts.innerHTML += generatePillGroup("size", "容量", [{ label: "中杯", value: "M", checked: true }, { label: "大杯 +$20", value: "L" }]);
  }
  if (currentSelectingItem["可調冰熱"] === "TRUE" || currentSelectingItem["可調冰熱"] === true) {
    opts.innerHTML += generatePillGroup("temp", "溫度", [{ label: "正常冰", value: "正常冰", checked: true }, { label: "少冰", value: "少冰" }, { label: "去冰", value: "去冰" }, { label: "熱", value: "熱" }]);
  }
  if (currentSelectingItem["可調甜度"] === "TRUE" || currentSelectingItem["可調甜度"] === true) {
    opts.innerHTML += generatePillGroup("sugar", "甜度", [{ label: "正常糖", value: "正常糖" }, { label: "半糖", value: "半糖", checked: true }, { label: "微糖", value: "微糖" }, { label: "無糖", value: "無糖" }]);
  }
  if (currentSelectingItem["大類別"] !== "甜點" && currentSelectingItem["大類別"] !== "輕食") {
    opts.innerHTML += generatePillGroup("ecoCup", "容器", [{ label: "店家提供", value: "店家提供", checked: true }, { label: "自備環保杯 (-$5)", value: "自備環保杯" }]);
  }
  
  document.getElementById("modal-note").value = "";
  document.getElementById("product-modal").classList.add("active");
  document.body.style.overflow = "hidden"; 
}

function generatePillGroup(name, title, options) {
  let html = `<div class="option-group"><div class="option-title">${title}</div><div class="pill-container">`;
  options.forEach((opt, idx) => {
    html += `<input type="radio" name="${name}" id="opt-${name}-${idx}" class="pill-radio" value="${opt.value}" ${opt.checked ? "checked" : ""}><label for="opt-${name}-${idx}" class="pill-label">${opt.label}</label>`;
  });
  return html + `</div></div>`;
}

function confirmAddToCart() {
  let finalPrice = Number(currentSelectingItem["預設價格"]);
  const getVal = (name) => document.querySelector(`input[name="${name}"]:checked`)?.value || "";
  let size = getVal("size"), temp = getVal("temp"), sugar = getVal("sugar"), ecoCup = getVal("ecoCup");
  
  if(size === "L") finalPrice += 20; 
  if(ecoCup === "自備環保杯") finalPrice -= 5;
  
  shoppingCart.push({ 
    id: Date.now().toString(), 
    productId: currentSelectingItem["商品編號"], 
    name: currentSelectingItem["商品名稱"], 
    price: finalPrice, 
    qty: 1, size, temp, sugar, ecoCup,
    note: document.getElementById("modal-note").value.trim()
  });
  
  updateCartUI();
  closeModal('product-modal', true);
}

function updateCartUI() {
  document.getElementById("cart-summary").textContent = `Cart • ${shoppingCart.length} | $${shoppingCart.reduce((s, i) => s + i.price, 0)}`;
}

function removeFromCart(id) {
  shoppingCart = shoppingCart.filter(item => item.id !== id);
  updateCartUI();
  openCheckoutModal(); 
  if(shoppingCart.length === 0) closeModal('checkout-modal', true);
}

function openCheckoutModal() {
  if (shoppingCart.length === 0) { alert("購物車目前是空的。"); return; }
  
  const list = document.getElementById("checkout-list");
  list.innerHTML = "";
  let total = 0;
  
  shoppingCart.forEach(item => {
    total += item.price;
    let spec = [item.size, item.temp, item.sugar, item.ecoCup === "自備環保杯" ? "(自備)" : ""].filter(Boolean).join(" / ");
    if(item.note) spec += ` [備註: ${item.note}]`;
    
    list.innerHTML += `
      <div class="cart-item-row">
        <div class="cart-item-info">
          <h4>${item.name}</h4>
          <p class="cart-item-spec">${spec}</p>
          <button class="remove-btn" onclick="removeFromCart('${item.id}')">刪除</button>
        </div>
        <div class="cart-item-price">$${item.price}</div>
      </div>
    `;
  });
  
  document.getElementById("checkout-total-display").textContent = `總計: $${total}`;
  document.getElementById("checkout-modal").classList.add("active");
  document.body.style.overflow = "hidden";
}

async function submitOrder() {
  if(shoppingCart.length === 0) return;
  const payMethod = document.querySelector('input[name="payMethod"]:checked').value;
  const dineInType = document.querySelector('input[name="dineInType"]:checked').value; 
  const total = shoppingCart.reduce((s, i) => s + i.price, 0);
  
  const payload = {
    action: "appendOrder",
    orderData: {
      timestamp: new Date().toLocaleString("zh-TW", {timeZone: "Asia/Taipei"}),
      uid: currentUser.uid,
      name: currentUser.name,
      dineInType: dineInType, // 送出內用外帶設定
      itemsJson: JSON.stringify(shoppingCart),
      originalTotal: total,
      discount: 0,
      finalTotal: total,
      paymentMethod: payMethod
    }
  };
  
  document.getElementById("checkout-modal").classList.remove("active");
  showLoading("訂單傳送中...");
  try {
    const res = await fetch(APP_CONFIG.GAS_API_URL, { method: "POST", body: JSON.stringify(payload) });
    const result = await res.json();
    if(result.success) {
      alert(`訂單 ${result.orderId} 送出成功！\n(${dineInType}) 請至櫃檯完成結帳/取餐。`);
      shoppingCart = [];
      updateCartUI();
    }
  } catch(e) { alert("送單失敗"); }
  hideLoading();
}

async function openMemberProfile() {
  if(!currentUser || !currentUser.uid) return;
  document.getElementById("member-name-title").textContent = `Hi, ${currentUser.name}`;
  document.getElementById("member-modal").classList.add("active");
  document.body.style.overflow = "hidden";
  
  const listEl = document.getElementById("order-history-list");
  listEl.innerHTML = '<p style="font-size: 13px; color: var(--text-muted);">正在讀取歷史訂單...</p>';
  
  try {
    const response = await fetch(APP_CONFIG.GAS_API_URL, {
      method: "POST",
      body: JSON.stringify({ action: "getUserOrders", uid: currentUser.uid })
    });
    const result = await response.json();
    
    if (result.success && result.data.length > 0) {
      const orders = result.data;
      document.getElementById("habit-count").textContent = orders.length;
      
      let itemCounts = {};
      orders.forEach(order => {
        try {
          const items = JSON.parse(order["訂單內容(JSON)"]);
          items.forEach(i => { itemCounts[i.name] = (itemCounts[i.name] || 0) + 1; });
        } catch(e){}
      });
      let favItem = Object.keys(itemCounts).reduce((a, b) => itemCounts[a] > itemCounts[b] ? a : b, "-");
      document.getElementById("habit-drink").textContent = favItem;
      
      listEl.innerHTML = "";
      orders.slice(0, 10).forEach(order => {
        let statusColor = order["訂單狀態"] === "已完成" ? "green" : "orange";
        listEl.innerHTML += `
          <div class="history-item">
            <div style="display:flex; justify-content:space-between; margin-bottom:5px;">
              <strong>${order["建立時間"].split(" ")[0]}</strong>
              <span style="color:${statusColor}; font-weight:bold;">${order["訂單狀態"]}</span>
            </div>
            <div style="color:var(--text-muted); margin-bottom:5px;">$${order["實收金額"]} (${order["付款方式"]})</div>
          </div>
        `;
      });
    } else {
      listEl.innerHTML = '<p style="font-size: 13px; color: var(--text-muted);">目前尚無訂單紀錄。</p>';
    }
  } catch (error) {
    listEl.innerHTML = '<p style="font-size: 13px; color: red;">讀取失敗，請稍後再試。</p>';
  }
}
