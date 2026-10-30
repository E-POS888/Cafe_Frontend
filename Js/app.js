/**
 * Js/app.js - 顧客點餐前端邏輯 (加入嚴謹會員註冊與權限判斷)
 */

let shoppingCart = [];
let currentUser = { role: "顧客" }; 
let tempUserProfile = null; // 用於暫存 LINE 傳來的個資，以便註冊時使用
let fullMenuData = []; 
let currentSelectingItem = null; 

document.addEventListener("DOMContentLoaded", () => {
  if (typeof APP_CONFIG === 'undefined') {
    showError("設定檔未載入，請確認檔案路徑。");
    return;
  }
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

// 修改：攔截新會員，若找不到資料則強迫填寫註冊單
async function verifyUserWithBackend(uid, name) {
  document.getElementById("loading-text").textContent = "正在驗證會員權限...";
  try {
    const response = await fetch(APP_CONFIG.GAS_API_URL, {
      method: "POST",
      body: JSON.stringify({ action: "loginUser", uid: uid, name: name })
    });
    const result = await response.json();
    
    // 判斷是否為新會員
    if (result.data && result.data.isNewUser) {
      tempUserProfile = result.data.profile; // 暫存 UID 資訊
      document.getElementById("reg-name").value = tempUserProfile.name; // 預設帶入 LINE 暱稱
      document.getElementById("loading-screen").style.display = "none"; // 隱藏載入遮罩
      document.getElementById("register-modal").classList.add("active"); // 彈出註冊表單
    } else if (result.data && !result.data.isNewUser) {
      // 舊會員：正常登入程序
      currentUser = { 
        uid: uid, 
        name: result.data.userData["姓名(可變更)"], 
        role: result.data.userData["系統權限"] 
      };
      
      if (currentUser.role === "管理員") {
        document.getElementById("admin-entrance").style.display = "block";
      }
      await fetchMenuFromBackend();
    }
  } catch (error) {
    showError("會員驗證失敗，請檢查 API。");
  }
}

// 新增：提交註冊表單
async function submitRegistration() {
  const nameInput = document.getElementById("reg-name").value.trim();
  const phoneInput = document.getElementById("reg-phone").value.trim();
  const floorInput = document.getElementById("reg-floor").value.trim();
  const noteInput = document.getElementById("reg-note").value.trim();
  
  if (!nameInput) { alert("請填寫姓名！"); return; }
  if (!phoneInput) { alert("請填寫手機號碼 (必填)！"); return; }
  
  // 關閉註冊表單，顯示載入中
  document.getElementById("register-modal").classList.remove("active");
  document.getElementById("loading-screen").style.display = "flex";
  document.getElementById("loading-text").textContent = "正在建立會員資料...";
  
  const userData = {
    uid: tempUserProfile.uid,
    name: nameInput,
    phone: phoneInput,
    floor: floorInput,
    note: noteInput
  };
  
  try {
    const response = await fetch(APP_CONFIG.GAS_API_URL, {
      method: "POST",
      body: JSON.stringify({ action: "registerUser", userData: userData })
    });
    const result = await response.json();
    
    if (result.success) {
       // 註冊成功，更新本地使用者資訊，並載入菜單
       currentUser = { uid: userData.uid, name: userData.name, role: "顧客" };
       await fetchMenuFromBackend();
    } else {
       showError("註冊失敗：" + result.error);
    }
  } catch (error) {
     showError("網路連線錯誤，無法完成註冊。");
  }
}

async function fetchMenuFromBackend() {
  document.getElementById("loading-text").textContent = "正在擷取精品咖啡風味...";
  try {
    const response = await fetch(APP_CONFIG.GAS_API_URL, {
      method: "POST",
      body: JSON.stringify({ action: "getMenu" })
    });
    const result = await response.json();
    
    if (result.success) {
      fullMenuData = result.data; 
      renderMenu(fullMenuData);
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
  const stickyNav = document.getElementById("sticky-nav");
  if(!container || !stickyNav) return;
  
  container.innerHTML = ""; 
  stickyNav.innerHTML = "";
  
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
      if(section) {
        const y = section.getBoundingClientRect().top + window.scrollY - 110;
        window.scrollTo({top: y, behavior: 'smooth'});
      }
    };
    stickyNav.appendChild(navBtn);
    isFirst = false;

    const section = document.createElement("div");
    section.id = `cat-${catName}`; 
    section.className = "category-section";
    section.innerHTML = `<div class="category-title">${catName}</div>`;
    
    const grid = document.createElement("div");
    grid.className = "product-grid";
    
    items.forEach(item => {
      const imgUrl = item["照片網址(Drive)"] || "https://via.placeholder.com/80?text=No+Image";
      const card = document.createElement("div");
      card.className = "product-card";
      card.onclick = () => openProductModal(item["商品編號"]);
      
      card.innerHTML = `
        <img class="product-image" src="${imgUrl}" alt="${item["商品名稱"]}">
        <div class="product-info">
          <h3 class="product-name">${item["商品名稱"]}</h3>
          <div class="product-price">$${item["預設價格"]}</div>
          <button class="add-btn">選擇風味</button>
        </div>
      `;
      grid.appendChild(card);
    });
    
    section.appendChild(grid);
    container.appendChild(section);
  }
}

/* 客製化彈窗控制邏輯 (保持原樣，負責呈現商品細節) */
function openProductModal(productId) {
  currentSelectingItem = fullMenuData.find(item => item["商品編號"] === productId);
  if(!currentSelectingItem) return;
  
  document.getElementById("modal-img").src = currentSelectingItem["照片網址(Drive)"] || "https://via.placeholder.com/100?text=No+Image";
  document.getElementById("modal-title").textContent = currentSelectingItem["商品名稱"];
  document.getElementById("modal-price").textContent = "$" + currentSelectingItem["預設價格"];
  
  let desc = currentSelectingItem["商品描述"];
  if (!desc) {
    desc = currentSelectingItem["大類別"].includes("咖啡") 
      ? "精選莊園級咖啡豆，透過職人細緻烘焙，為您帶來最純粹的風味體驗。每一口都蘊含我們對細節的堅持。" 
      : "嚴選頂級原料，搭配專屬特調比例，為您的片刻悠閒注入美好滋味。";
  }
  document.getElementById("modal-desc").textContent = desc;
  
  const optionsContainer = document.getElementById("modal-options-container");
  optionsContainer.innerHTML = "";
  
  if (currentSelectingItem["大類別"] !== "精品限定" && currentSelectingItem["大類別"] !== "甜點" && currentSelectingItem["大類別"] !== "輕食") {
    optionsContainer.innerHTML += generatePillGroup("size", "容量選擇", [
      { label: "中杯 (M)", value: "M", checked: true },
      { label: "大杯 (L) +$20", value: "L" }
    ]);
  }
  
  const canTemp = currentSelectingItem["可調冰熱"] === "TRUE" || currentSelectingItem["可調冰熱"] === true;
  if (canTemp) {
    optionsContainer.innerHTML += generatePillGroup("temp", "溫度", [
      { label: "正常冰", value: "正常冰", checked: true },
      { label: "少冰", value: "少冰" },
      { label: "去冰", value: "去冰" },
      { label: "熱", value: "熱" }
    ]);
  }
  
  const canSugar = currentSelectingItem["可調甜度"] === "TRUE" || currentSelectingItem["可調甜度"] === true;
  if (canSugar) {
    optionsContainer.innerHTML += generatePillGroup("sugar", "甜度", [
      { label: "正常糖", value: "正常糖" },
      { label: "半糖", value: "半糖", checked: true },
      { label: "微糖", value: "微糖" },
      { label: "無糖", value: "無糖" }
    ]);
  }

  if (currentSelectingItem["大類別"] !== "甜點" && currentSelectingItem["大類別"] !== "輕食") {
    optionsContainer.innerHTML += generatePillGroup("ecoCup", "容器選擇", [
      { label: "店家提供", value: "店家提供", checked: true },
      { label: "自備環保杯 (-$5)", value: "自備環保杯" }
    ]);
  }
  
  document.getElementById("modal-note").value = "";
  document.getElementById("product-modal").classList.add("active");
  document.body.style.overflow = "hidden"; 
}

function generatePillGroup(groupName, title, options) {
  let html = `<div class="option-group"><div class="option-title">${title}</div><div class="pill-container">`;
  options.forEach((opt, idx) => {
    const id = `opt-${groupName}-${idx}`;
    const checkedStr = opt.checked ? "checked" : "";
    html += `
      <input type="radio" name="${groupName}" id="${id}" class="pill-radio" value="${opt.value}" ${checkedStr}>
      <label for="${id}" class="pill-label">${opt.label}</label>
    `;
  });
  html += `</div></div>`;
  return html;
}

function closeProductModal(force = false) {
  if (force === true || (force && force.target.id === 'product-modal')) {
    document.getElementById("product-modal").classList.remove("active");
    document.body.style.overflow = ""; 
    currentSelectingItem = null;
  }
}

function confirmAddToCart() {
  if(!currentSelectingItem) return;
  
  let finalPrice = Number(currentSelectingItem["預設價格"]);
  let selectedSize = "";
  let selectedTemp = "";
  let selectedSugar = "";
  let selectedEcoCup = "";
  
  const sizeInput = document.querySelector('input[name="size"]:checked');
  if(sizeInput) {
    selectedSize = sizeInput.value;
    if(selectedSize === "L") finalPrice += 20; 
  }
  
  const tempInput = document.querySelector('input[name="temp"]:checked');
  if(tempInput) selectedTemp = tempInput.value;
  
  const sugarInput = document.querySelector('input[name="sugar"]:checked');
  if(sugarInput) selectedSugar = sugarInput.value;

  const ecoCupInput = document.querySelector('input[name="ecoCup"]:checked');
  if(ecoCupInput) {
    selectedEcoCup = ecoCupInput.value;
    if(selectedEcoCup === "自備環保杯") finalPrice -= 5;
  }
  
  const note = document.getElementById("modal-note").value.trim();
  
  shoppingCart.push({ 
    id: currentSelectingItem["商品編號"], 
    name: currentSelectingItem["商品名稱"], 
    price: finalPrice, 
    qty: 1,
    size: selectedSize,
    temp: selectedTemp,
    sugar: selectedSugar,
    ecoCup: selectedEcoCup,
    note: note
  });
  
  updateCartUI();
  closeProductModal(true);
}

function updateCartUI() {
  const totalQty = shoppingCart.length;
  const totalPrice = shoppingCart.reduce((sum, item) => sum + item.price, 0);
  const cartSummary = document.getElementById("cart-summary");
  if(cartSummary) cartSummary.textContent = `Cart • ${totalQty} | $${totalPrice}`;
}

function openCart() {
  if (shoppingCart.length === 0) {
    alert("購物車目前是空的。");
    return;
  }
  
  let details = shoppingCart.map(item => {
    let spec = [item.size, item.temp, item.sugar, item.ecoCup === "自備環保杯" ? "(自備杯)" : ""].filter(Boolean).join(" / ");
    let noteStr = item.note ? `\n  *專屬備註: ${item.note}` : "";
    return `- ${item.name} $${item.price}\n  規格: ${spec} ${noteStr}`;
  }).join("\n\n");
  
  alert(`【訂單明細】\n\n${details}\n\n總計: $${shoppingCart.reduce((s,i)=>s+i.price,0)}\n\n(即將進入結帳畫面...)`);
}
