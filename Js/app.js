/**
 * Js/app.js - 顧客點餐前端邏輯 (加入圖片輪播與橫向導航)
 */

let shoppingCart = [];
let currentUser = {};
let fullMenuData = []; 
let currentSelectingItem = null; 

document.addEventListener("DOMContentLoaded", () => {
  if (typeof APP_CONFIG === 'undefined') {
    showError("設定檔未載入，請確認檔案路徑。");
    return;
  }
  initializeLiff(APP_CONFIG.LIFF_ID);
  initCarousel(); // 啟動圖片輪播
});

// 圖片輪播邏輯
function initCarousel() {
  const images = document.querySelectorAll('.carousel-img');
  if(images.length === 0) return;
  let currentIndex = 0;
  setInterval(() => {
    images[currentIndex].classList.remove('active');
    currentIndex = (currentIndex + 1) % images.length;
    images[currentIndex].classList.add('active');
  }, 4000); // 每 4 秒切換一張
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
    // 1. 建立懸浮導航按鈕
    const navBtn = document.createElement("button");
    navBtn.className = `nav-tab ${isFirst ? 'active' : ''}`;
    navBtn.textContent = catName;
    navBtn.onclick = () => {
      // 點擊導航平滑滾動到對應區塊
      document.querySelectorAll('.nav-tab').forEach(b => b.classList.remove('active'));
      navBtn.classList.add('active');
      const section = document.getElementById(`cat-${catName}`);
      if(section) {
        // 扣除 header 高度避免被遮擋
        const y = section.getBoundingClientRect().top + window.scrollY - 110;
        window.scrollTo({top: y, behavior: 'smooth'});
      }
    };
    stickyNav.appendChild(navBtn);
    isFirst = false;

    // 2. 建立商品區塊
    const section = document.createElement("div");
    section.id = `cat-${catName}`; // 設定錨點 ID
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

/* =========================================
   客製化彈窗控制邏輯
   ========================================= */

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
