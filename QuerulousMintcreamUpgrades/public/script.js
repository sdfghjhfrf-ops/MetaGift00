// Admin ID
const ADMIN_ID = 7867539237;
let currentUser = null;
let isAdmin = false;

// Merchant wallet for manual payments
const MERCHANT_WALLET = 'UQDy5hhPvhwcNY9g-lP-nkjdmx4rAVZGFEnhOKzdF-JcIiDW';

// Current item being purchased
let currentPurchaseItem = null;
let currentPaymentMethods = null;
let selectedPaymentMethod = null;

// Current inventory item being viewed
let currentInventoryItem = null;

// User stats
let userStats = {
    totalPurchases: 0,
    totalSpent: 0,
    referralCount: 0,
    referralEarnings: 0
};

// User balance (for top-up and balance payments)
let userBalance = {
    stars: 0
};


// Initialize Telegram WebApp
if (window.Telegram && window.Telegram.WebApp) {
    const tg = window.Telegram.WebApp;
    tg.ready();
    tg.expand();

    // Get user data
    const user = tg.initDataUnsafe?.user;
    if (user) {
        currentUser = user;
        isAdmin = user.id === ADMIN_ID;

        if (isAdmin) {
            addAdminButton();
        }

        // Set user profile info
        setUserProfileInfo(user);

        // Load user stats and balance
        loadUserStats(user.id);
        loadUserBalance(user.id);

        // Update username if changed
        updateUserUsername(user.id, user.username);
    }

    // Enable fullscreen mode (check if method exists)
    try {
        if (tg.requestFullscreen && typeof tg.requestFullscreen === 'function') {
            tg.requestFullscreen();
        }
    } catch (error) {
        console.log('Fullscreen not supported in this Telegram version');
    }

    // Set theme
    try {
        if (tg.setHeaderColor) {
            tg.setHeaderColor('#1a1a1a');
        }
        if (tg.setBackgroundColor) {
            tg.setBackgroundColor('#1a1a1a');
        }
    } catch (error) {
        console.log('Theme methods not supported');
    }
}



// Add admin button to navigation
function addAdminButton() {
    const bottomNav = document.getElementById('bottomNav');
    const adminNavItem = document.createElement('div');
    adminNavItem.className = 'nav-item';
    adminNavItem.innerHTML = `
        <img class="nav-icon" src="https://i.postimg.cc/FHzrQQZD/IMG-1211.png" alt="Админ">
        <span class="nav-text">Админ</span>
    `;
    bottomNav.appendChild(adminNavItem);

    // Add click handler
    adminNavItem.addEventListener('click', function() {
        document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
        this.classList.add('active');

        // Show admin section
        document.getElementById('marketSection').style.display = 'none';
        document.getElementById('activitySection').style.display = 'none';
        document.getElementById('inventorySection').style.display = 'none';
        document.getElementById('adminSection').style.display = 'block';
        renderAdminItems();
    });
}

// NFT data
let nftItems = [];
let activityItems = [];
let inventoryItems = [];
let editingItemId = null;

// DOM elements
const nftGrid = document.getElementById('nftGrid');
const activityList = document.getElementById('activityList');
const inventoryGrid = document.getElementById('inventoryGrid');
const marketSection = document.getElementById('marketSection');
const activitySection = document.getElementById('activitySection');
const inventorySection = document.getElementById('inventorySection');

// Load NFT items from server
async function loadNFTs() {
    try {
        const response = await fetch('/api/items');
        if (response.ok) {
            nftItems = await response.json();
            console.log('NFTs loaded:', nftItems);
            renderNFTs(nftItems);
        } else {
            console.error('Failed to load NFTs from server');
            nftItems = [];
            renderNFTs(nftItems);
        }
    } catch (error) {
        console.error('Error loading NFTs:', error);
        nftItems = [];
        renderNFTs(nftItems);
    }
}

// Load activity from server
async function loadActivity() {
    try {
        const response = await fetch('/api/activity');
        if (response.ok) {
            activityItems = await response.json();
            renderActivity();
        }
    } catch (error) {
        console.error('Error loading activity:', error);
    }
}

// Load inventory from server
async function loadInventory() {
    try {
        if (!currentUser) return;
        const response = await fetch(`/api/inventory/${currentUser.id}`);
        if (response.ok) {
            inventoryItems = await response.json();
            renderInventory();
        }
    } catch (error) {
        console.error('Error loading inventory:', error);
    }
}

// Load user balance
async function loadUserBalance(userId) {
    try {
        const response = await fetch(`/api/user-balance/${userId}`);
        if (response.ok) {
            userBalance = await response.json();
            console.log('User balance loaded:', userBalance);
            // Update any UI elements that display balance
            updateBalanceDisplay();
        }
    } catch (error) {
        console.error('Error loading user balance:', error);
    }
}

// Auto-refresh data every 10 seconds to sync with server
setInterval(async () => {
    try {
        await loadNFTs();
        await loadActivity();
        await loadInventory();
        if (currentUser) {
            await loadUserBalance(currentUser.id);
        }
    } catch (error) {
        console.log('Auto-refresh error:', error);
    }
}, 10000);

// Admin functions
function renderAdminItems() {
    const adminItems = document.getElementById('adminItems');
    if (nftItems.length === 0) {
        adminItems.innerHTML = `
            <div class="admin-empty">
                <div class="admin-empty-icon">📦</div>
                <div class="admin-empty-text">Нет товаров</div>
                <div class="admin-empty-subtext">Добавьте первый товар</div>
            </div>
        `;
        return;
    }

    adminItems.innerHTML = '';
    nftItems.forEach(item => {
        const adminItem = createAdminItemElement(item);
        adminItems.appendChild(adminItem);
    });
}

function createAdminItemElement(item) {
    const div = document.createElement('div');
    div.className = 'admin-item';

    const imageContent = item.image.startsWith('http') ? 
        `<img src="${item.image}" alt="${item.name}">` : 
        item.image;

    let pricesDisplay = '';
    if (item.prices) {
        const prices = [];
        if (item.prices.TON > 0) prices.push(`${item.prices.TON} TON`);
        if (item.prices.STARS > 0) prices.push(`${item.prices.STARS} <img src="https://i.postimg.cc/3N3f5zhH/IMG-1243.png" style="width: 12px; height: 12px;" alt="Stars">`);
        if (item.prices.RUB > 0) prices.push(`${item.prices.RUB} ₽`);
        pricesDisplay = prices.join(' | ');
    } else {
        // Для совместимости со старым форматом
        const starsPrice = Math.ceil(item.price * 100);
        const rublePrice = Math.ceil(item.price * 300);
        pricesDisplay = `${item.price} TON | ${starsPrice} <img src="https://i.postimg.cc/3N3f5zhH/IMG-1243.png" style="width: 12px; height: 12px;" alt="Stars"> | ${rublePrice} ₽`;
    }

    div.innerHTML = `
        <div class="admin-item-image">
            ${imageContent}
            ${item.tag ? `<div class="admin-item-tag ${item.tagColor}">${item.tag}</div>` : ''}
            ${item.status ? `<div class="admin-item-status ${item.statusColor || 'rare'}">${item.status}</div>` : ''}
        </div>
        <div class="admin-item-info">
            <h3>${item.name}</h3>
            <div class="admin-item-details">
                <div class="admin-detail">#${item.id}</div>
                <div class="admin-detail">${pricesDisplay}</div>
                <div class="admin-detail">${item.quantity}</div>
                <div class="admin-detail">Осталось: ${item.stock}</div>
            </div>
        </div>
        <div class="admin-item-actions">
            <button class="admin-edit-btn" onclick="editAdminItem(${item.id})">✏️</button>
            <button class="admin-delete-btn" onclick="deleteAdminItem(${item.id})">🗑️</button>
        </div>
    `;

    return div;
}

function openAddItemModal() {
    editingItemId = null;
    document.getElementById('adminModalTitle').textContent = 'Добавить товар';
    clearAdminForm();
    document.getElementById('adminItemModal').classList.add('active');
    document.body.style.overflow = 'hidden';
}

function editAdminItem(itemId) {
    const item = nftItems.find(nft => nft.id === itemId);
    if (!item) return;

    editingItemId = itemId;
    document.getElementById('adminModalTitle').textContent = 'Редактировать товар';

    // Fill form
    document.getElementById('itemImage').value = item.image || '';
    document.getElementById('itemName').value = item.name || '';
    document.getElementById('itemDescription').value = item.description || '';

    // Заполнение цен в разных валютах
    if (item.prices) {
        document.getElementById('itemPriceTON').value = item.prices.TON || '';
        document.getElementById('itemPriceStars').value = item.prices.STARS || '';
        document.getElementById('itemPriceRubles').value = item.prices.RUB || '';
    } else {
        // Для совместимости со старым форматом
        document.getElementById('itemPriceTON').value = item.price || '';
        document.getElementById('itemPriceStars').value = '';
        document.getElementById('itemPriceRubles').value = '';
    }

    document.getElementById('itemId').value = item.id || '';
    document.getElementById('itemQuantity').value = item.quantity || '';
    document.getElementById('itemStock').value = item.stock || 1;
    document.getElementById('itemTag').value = item.tag || '';
    document.getElementById('itemTagColor').value = item.tagColor || 'new';
    document.getElementById('itemStatus').value = item.status || 'Редкий';
    document.getElementById('itemStatusColor').value = item.statusColor || 'rare';

    document.getElementById('adminItemModal').classList.add('active');
    document.body.style.overflow = 'hidden';
}

async function deleteAdminItem(itemId) {
    console.log('Удаление товара:', itemId);

    try {
        const response = await fetch(`/api/items/${itemId}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            // Reload data from server to sync with all users
            await loadNFTs();
            renderAdminItems();

            console.log('Товар успешно удален');

            if (window.Telegram?.WebApp?.showPopup) {
                try {
                    window.Telegram.WebApp.showPopup({
                        title: 'Успешно',
                        message: 'Товар удален',
                        buttons: [{ type: 'ok', text: 'OK' }]
                    });
                } catch (error) {
                    console.log('Товар удален');
                }
            }
        } else {
            console.log('Ошибка при удалении товара');
        }
    } catch (error) {
        console.error('Error deleting item:', error);
    }
}

function clearAdminForm() {
    document.getElementById('itemImage').value = '';
    document.getElementById('itemName').value = '';
    document.getElementById('itemDescription').value = '';
    document.getElementById('itemPriceTON').value = '';
    document.getElementById('itemPriceStars').value = '';
    document.getElementById('itemPriceRubles').value = '';
    document.getElementById('itemId').value = '';
    document.getElementById('itemQuantity').value = '';
    document.getElementById('itemStock').value = '1';
    document.getElementById('itemTag').value = '';
    document.getElementById('itemTagColor').value = 'new';
    document.getElementById('itemStatus').value = 'Редкий';
    document.getElementById('itemStatusColor').value = 'rare';
}

function closeAdminItemModal() {
    document.getElementById('adminItemModal').classList.remove('active');
    document.body.style.overflow = '';
    editingItemId = null;
}

async function saveAdminItem() {
    const tonPrice = parseFloat(document.getElementById('itemPriceTON').value) || 0;
    const starsPrice = parseFloat(document.getElementById('itemPriceStars').value) || 0;
    const rublesPrice = parseFloat(document.getElementById('itemPriceRubles').value) || 0;

    const itemData = {
        image: document.getElementById('itemImage').value.trim(),
        name: document.getElementById('itemName').value.trim(),
        description: document.getElementById('itemDescription').value.trim(),
        prices: {
            TON: tonPrice,
            STARS: starsPrice,
            RUB: rublesPrice
        },
        id: parseInt(document.getElementById('itemId').value),
        quantity: document.getElementById('itemQuantity').value.trim() || 'x1',
        stock: parseInt(document.getElementById('itemStock').value) || 1,
        tag: document.getElementById('itemTag').value.trim(),
        tagColor: document.getElementById('itemTagColor').value || 'new',
        status: document.getElementById('itemStatus').value.trim() || 'Редкий',
        statusColor: document.getElementById('itemStatusColor').value || 'rare'
    };

    // Validation
    if (!itemData.name) {
        if (window.Telegram?.WebApp?.showPopup) {
            window.Telegram.WebApp.showPopup({
                title: 'Ошибка',
                message: 'Введите название товара',
                buttons: [{ type: 'ok', text: 'OK' }]
            });
        }
        return;
    }

    if (!itemData.id || isNaN(itemData.id)) {
        if (window.Telegram?.WebApp?.showPopup) {
            window.Telegram.WebApp.showPopup({
                title: 'Ошибка',
                message: 'Введите корректный ID товара',
                buttons: [{ type: 'ok', text: 'OK' }]
            });
        }
        return;
    }

    if (tonPrice === 0 && starsPrice === 0 && rublesPrice === 0) {
        if (window.Telegram?.WebApp?.showPopup) {
            window.Telegram.WebApp.showPopup({
                title: 'Ошибка',
                message: 'Укажите хотя бы одну цену (TON, Stars или ₽)',
                buttons: [{ type: 'ok', text: 'OK' }]
            });
        }
        return;
    }

    try {
        let response;

        if (editingItemId) {
            // Edit existing item
            response = await fetch(`/api/items/${editingItemId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(itemData)
            });
        } else {
            // Add new item
            response = await fetch('/api/items', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(itemData)
            });
        }

        if (response.ok) {
            // Reload data from server to sync with all users
            await loadNFTs();
            renderAdminItems();
            closeAdminItemModal();

            console.log('Товар успешно сохранен');
        } else {
            const error = await response.json();
            console.log('Ошибка:', error.error || 'Не удалось сохранить товар');
        }
    } catch (error) {
        console.error('Error saving item:', error);
        console.log('Ошибка при сохранении товара');
    }
}

// Render NFT items
function renderNFTs(items) {
    nftGrid.innerHTML = '';

    if (items.length === 0) {
        nftGrid.innerHTML = `
            <div class="empty-market" style="grid-column: 1 / -1; text-align: center; padding: 40px 20px; color: #888;">
                <div style="font-size: 48px; margin-bottom: 16px; opacity: 0.5;">🛒</div>
                <div style="font-size: 16px; margin-bottom: 8px;">Магазин пуст</div>
                <div style="font-size: 14px; opacity: 0.7;">Товары появятся здесь</div>
            </div>
        `;
        return;
    }

    items.forEach(item => {
        const nftElement = createNFTElement(item);
        nftGrid.appendChild(nftElement);
    });
}

// Create NFT element
function createNFTElement(item) {
    const div = document.createElement('div');
    div.className = 'nft-item';
    div.onclick = () => openPurchaseModal(item);

    const imageContent = item.image && item.image.startsWith('http') ? 
        `<img src="${item.image}" alt="${item.name}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 8px;">` : 
        (item.image || '📦');

    // Определить какую цену показывать (приоритет: Stars, затем TON, затем рубли)
    let displayPrice = '';
    if (item.prices) {
        if (item.prices.STARS > 0) {
            displayPrice = `${item.prices.STARS} <img src="https://i.postimg.cc/3N3f5zhH/IMG-1243.png" style="width: 22px; height: 22px; margin-left: 4px;" alt="Stars">`;
        } else if (item.prices.TON > 0) {
            displayPrice = `${item.prices.TON} TON`;
        } else if (item.prices.RUB > 0) {
            displayPrice = `${item.prices.RUB} ₽`;
        }
    } else {
        // Для совместимости со старым форматом
        const starsPrice = Math.ceil(item.price * 100);
        displayPrice = `${starsPrice} <img src="https://i.postimg.cc/3N3f5zhH/IMG-1243.png" style="width: 22px; height: 22px; margin-left: 4px;" alt="Stars">`;
    }

    div.innerHTML = `
        <div class="nft-image">
            ${imageContent}
            <div class="nft-quantity">${item.quantity || 'x1'}</div>
            ${item.tag ? `<div class="nft-tag ${item.tagColor || 'new'}">${item.tag}</div>` : ''}
            ${item.status ? `<div class="nft-status ${item.statusColor || 'rare'}">${item.status}</div>` : ''}
        </div>
        <div class="nft-info">
            <h3>${item.name}</h3>
            <div class="nft-details">
                <div class="nft-id">#${item.id}</div>
                <div class="nft-price">
                    ${displayPrice}
                </div>
            </div>
        </div>
        <button class="buy-btn" onclick="event.stopPropagation(); console.log('Клик по кнопке купить, ID:', ${item.id}); buyItem(${item.id})" ${(item.stock === 0 || item.stock === undefined) ? 'disabled' : ''}>
            ${(item.stock === 0 || item.stock === undefined) ? 'Распродано' : 'Купить'}
        </button>
    `;

    return div;
}

// Buy item function with payment methods selection
async function buyItem(itemId) {
    console.log('Попытка покупки товара:', itemId);

    const item = nftItems.find(nft => nft.id === itemId);
    if (!item || item.stock <= 0) {
        console.log('Товар недоступен');
        if (window.Telegram?.WebApp?.showPopup) {
            window.Telegram.WebApp.showPopup({
                title: 'Ошибка',
                message: 'Товар недоступен или распродан',
                buttons: [{ type: 'ok', text: 'OK' }]
            });
        }
        return;
    }

    // Store current purchase item and open payment methods modal
    currentPurchaseItem = item;
    await openPaymentMethodsModal(item);
}

// Render activity items
function renderActivity() {
    if (activityItems.length === 0) {
        activityList.innerHTML = `
            <div class="empty-activity">
                <div class="empty-activity-icon">📦</div>
                <div class="empty-activity-text">Нет активности</div>
                <div class="empty-activity-subtext">Покупки будут отображаться здесь</div>
            </div>
        `;
        return;
    }

    activityList.innerHTML = '';

    activityItems.forEach(item => {
        const activityElement = createActivityElement(item);
        activityList.appendChild(activityElement);
    });
}

// Create activity element
function createActivityElement(item) {
    const div = document.createElement('div');
    div.className = 'activity-item';

    const imageContent = item.image && item.image.startsWith('http') ? 
        `<img src="${item.image}" alt="${item.name}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 8px;">` : 
        (item.image || '📦');

    // Определить цену для отображения
    let priceDisplay = '';

    // Приоритет: convertedPrice (реальная оплаченная цена) > prices.STARS > prices.TON > prices.RUB > старый price
    if (item.convertedPrice && !isNaN(item.convertedPrice) && item.convertedPrice > 0) {
        // Использовать convertedPrice из заявки на покупку (реальная оплаченная цена)
        priceDisplay = `<img src="https://i.postimg.cc/3N3f5zhH/IMG-1243.png" style="width: 12px; height: 12px; margin-right: 4px;" alt="Stars">${item.convertedPrice}`;
    } else if (item.prices) {
        // Новый формат с объектом prices
        if (item.prices.STARS > 0) {
            priceDisplay = `<img src="https://i.postimg.cc/3N3f5zhH/IMG-1243.png" style="width: 12px; height: 12px; margin-right: 4px;" alt="Stars">${item.prices.STARS}`;
        } else if (item.prices.TON > 0) {
            const starsEquivalent = Math.ceil(item.prices.TON * 100);
            priceDisplay = `<img src="https://i.postimg.cc/3N3f5zhH/IMG-1243.png" style="width: 12px; height: 12px; margin-right: 4px;" alt="Stars">${starsEquivalent}`;
        } else if (item.prices.RUB > 0) {
            priceDisplay = `${item.prices.RUB} ₽`;
        }
    } else if (item.price && !isNaN(item.price) && item.price > 0) {
        // Старый формат с полем price
        const starsPrice = Math.ceil(item.price * 100);
        priceDisplay = `<img src="https://i.postimg.cc/3N3f5zhH/IMG-1243.png" style="width: 12px; height: 12px; margin-right: 4px;" alt="Stars">${starsPrice}`;
    } else {
        // Резервное значение если нет цены (не должно происходить)
        priceDisplay = `<img src="https://i.postimg.cc/3N3f5zhH/IMG-1243.png" style="width: 12px; height: 12px; margin-right: 4px;" alt="Stars">1`;
    }

    div.innerHTML = `
        <div class="activity-image">
            ${imageContent}
        </div>
        <div class="activity-info">
            <h3 class="activity-title">${item.name}</h3>
            <div class="activity-id">#${item.id}</div>
        </div>
        <div class="activity-details">
            <div class="activity-action">Покупка</div>
            <div class="activity-price">
                ${priceDisplay}
            </div>
            <div class="activity-date">${item.date} ${item.time}</div>
        </div>
    `;

    return div;
}

// Render inventory items
function renderInventory() {
    if (inventoryItems.length === 0) {
        inventoryGrid.innerHTML = `
            <div class="empty-inventory" style="grid-column: 1 / -1;">
                <div class="empty-inventory-icon">🎒</div>
                <div class="empty-inventory-text">Инвентарь пуст</div>
                <div class="empty-inventory-subtext">Купленные предметы будут отображаться здесь</div>
            </div>
        `;
        return;
    }

    inventoryGrid.innerHTML = '';

    inventoryItems.forEach(item => {
        const inventoryElement = createInventoryElement(item);
        inventoryGrid.appendChild(inventoryElement);
    });
}

// Create inventory element
function createInventoryElement(item) {
    const div = document.createElement('div');
    div.className = 'inventory-item';
    div.onclick = () => openInventoryModal(item);

    const imageContent = item.image.startsWith('http') ? 
        `<img src="${item.image}" alt="${item.name}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 8px;">` : 
        item.image;

    div.innerHTML = `
        <div class="inventory-image">
            ${imageContent}
            <div class="inventory-quantity">${item.quantity}</div>
        </div>
        <div class="inventory-info">
            <h3>${item.name}</h3>
        </div>
    `;

    return div;
}

// Inventory modal functions
function openInventoryModal(item) {
    currentInventoryItem = item;
    const modal = document.getElementById('inventoryModal');
    const modalImage = document.getElementById('inventoryModalImage');
    const modalTitle = document.getElementById('inventoryModalTitle');
    const modalPrice = document.getElementById('inventoryModalPrice');
    const modalOwner = document.getElementById('inventoryModalOwner');
    const modalId = document.getElementById('inventoryModalId');
    const modalComment = document.getElementById('inventoryModalComment');
    const commentRow = document.getElementById('commentRow');

    // Set modal content
    modalTitle.textContent = item.name;

    // Определить цену для отображения
    let priceDisplay = '';

    // Приоритет: convertedPrice (реальная оплаченная цена) > prices.STARS > prices.TON > prices.RUB > старый price
    if (item.convertedPrice && !isNaN(item.convertedPrice) && item.convertedPrice > 0) {
        // Использовать convertedPrice из заявки на покупку (реальная оплаченная цена)
        priceDisplay = `${item.convertedPrice} <img src="https://i.postimg.cc/3N3f5zhH/IMG-1243.png" style="width: 14px; height: 14px; margin-left: 4px;" alt="Stars">`;
    } else if (item.prices) {
        // Новый формат с объектом prices
        if (item.prices.STARS > 0) {
            priceDisplay = `${item.prices.STARS} <img src="https://i.postimg.cc/3N3f5zhH/IMG-1243.png" style="width: 14px; height: 14px; margin-left: 4px;" alt="Stars">`;
        } else if (item.prices.TON > 0) {
            const starsEquivalent = Math.ceil(item.prices.TON * 100);
            priceDisplay = `${starsEquivalent} <img src="https://i.postimg.cc/3N3f5zhH/IMG-1243.png" style="width: 14px; height: 14px; margin-left: 4px;" alt="Stars">`;
        } else if (item.prices.RUB > 0) {
            priceDisplay = `${item.prices.RUB} ₽`;
        }
    } else if (item.price && !isNaN(item.price) && item.price > 0) {
        // Старый формат с полем price - показываем в TON
        priceDisplay = `${item.price} <img src="https://ton.org/download/ton_symbol.png" style="width: 14px; height: 14px; margin-left: 4px;" alt="TON">`;
    } else {
        // Резервное значение если нет цены (не должно происходить)
        priceDisplay = `1 <img src="https://i.postimg.cc/3N3f5zhH/IMG-1243.png" style="width: 14px; height: 14px; margin-left: 4px;" alt="Stars">`;
    }

    modalPrice.innerHTML = priceDisplay;
    modalId.textContent = `#${item.id}`;

    // Set owner with username or nickname
    const ownerText = item.username ? `@${item.username}` : (item.nickname || 'UQDy...liDW');
    modalOwner.textContent = ownerText;

    // Show comment if exists
    if (item.comment && item.comment.trim()) {
        modalComment.textContent = item.comment;
        commentRow.style.display = 'flex';
    } else {
        commentRow.style.display = 'none';
    }

    // Set image
    if (item.image.startsWith('http')) {
        modalImage.innerHTML = `
            <img src="${item.image}" alt="${item.name}">
            <div class="modal-quantity">${item.quantity}</div>
        `;
    } else {
        modalImage.innerHTML = `
            ${item.image}
            <div class="modal-quantity">${item.quantity}</div>
        `;
    }

    // Show modal
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeInventoryModal() {
    const modal = document.getElementById('inventoryModal');
    modal.classList.remove('active');
    document.body.style.overflow = '';
    currentInventoryItem = null;
}

function withdrawItem() {
    if (window.Telegram?.WebApp?.showPopup) {
        try {
            window.Telegram.WebApp.showPopup({
                title: 'Вывод',
                message: 'Подарок можно будет вывести в профиль в скором времени.',
                buttons: [{ type: 'ok', text: 'Понятно' }]
            });
        } catch (error) {
            console.log('Функция вывода будет доступна в ближайшее время');
        }
    } else {
        console.log('Функция вывода будет доступна в ближайшее время');
    }
}

// Current item being transferred
let currentTransferItem = null;

function openTransferModal(inventoryItem) {
    if (!inventoryItem) {
        console.error('No inventory item provided to openTransferModal');
        return;
    }

    currentInventoryItem = inventoryItem;
    console.log('Opening transfer modal for:', currentInventoryItem);

    // Reload inventory to get the most up-to-date data
    loadInventory().then(() => {
        // Find the exact item in the current inventory data to ensure it's still available
        const userInventory = inventoryItems.filter(item => item.userId === currentUser.id);

        let exactItem;

        // Try to find by inventoryId first if available
        if (currentInventoryItem.inventoryId) {
            exactItem = inventoryItems.find(invItem => 
                invItem.inventoryId === currentInventoryItem.inventoryId && 
                invItem.userId === currentUser.id
            );
            console.log('Searching by inventoryId:', currentInventoryItem.inventoryId);
        }

        // If not found by inventoryId, try by other criteria
        if (!exactItem) {
            exactItem = inventoryItems.find(invItem => 
                invItem.userId === currentUser.id && 
                invItem.id === currentInventoryItem.id &&
                invItem.name === currentInventoryItem.name &&
                Math.abs((invItem.price || 0) - (currentInventoryItem.price || 0)) < 0.01
            );
            console.log('Searching by criteria match');
        }

        if (!exactItem) {
            console.error('Could not find exact item in inventory');
            console.log('Looking for:', currentInventoryItem);
            console.log('Available items:', inventoryItems.filter(item => item.userId === currentUser.id));
            if (window.Telegram?.WebApp?.showPopup) {
                window.Telegram.WebApp.showPopup({
                    title: 'Ошибка',
                    message: 'Предмет не найден в инвентаре',
                    buttons: [{ type: 'ok', text: 'OK' }]
                });
            }
            return;
        }

        // Create a deep copy to avoid reference issues
        currentTransferItem = JSON.parse(JSON.stringify(exactItem));
        console.log('Transfer modal opened for item:', currentTransferItem);

        // Проверка что currentTransferItem корректно установлен
        if (!currentTransferItem || !currentTransferItem.name) {
            console.error('Failed to set currentTransferItem properly:', currentTransferItem);
            if (window.Telegram?.WebApp?.showPopup) {
                window.Telegram.WebApp.showPopup({
                    title: 'Ошибка',
                    message: 'Ошибка загрузки данных предмета',
                    buttons: [{ type: 'ok', text: 'OK' }]
                });
            }
            return;
        }

        // Получаем элементы модального окна передачи
        const modal = document.getElementById('transferModal');
        const itemImage = document.getElementById('transferItemImage');
        const itemName = document.getElementById('transferItemName');

        // Очищаем поля ввода
        document.getElementById('transferUsername').value = '';
        document.getElementById('transferComment').value = '';

        // Безопасная проверка основных элементов
        if (!itemName || !itemImage || !modal) {
            console.error('Не найдены основные элементы модального окна передачи');
            if (window.Telegram?.WebApp?.showPopup) {
                window.Telegram.WebApp.showPopup({
                    title: 'Ошибка',
                    message: 'Ошибка интерфейса модального окна',
                    buttons: [{ type: 'ok', text: 'OK' }]
                });
            }
            return;
        }

        // Заполняем информацию о предмете
        itemName.textContent = currentTransferItem.name || 'Подарок';

        // Определить цену для отображения с проверками безопасности
        let transferPriceDisplay = '';

        // Приоритет: convertedPrice (реальная оплаченная цена) > prices.STARS > prices.TON > prices.RUB > старый price
        if (currentTransferItem.convertedPrice && !isNaN(currentTransferItem.convertedPrice) && currentTransferItem.convertedPrice > 0) {
            // Использовать convertedPrice из заявки на покупку (реальная оплаченная цена)
            transferPriceDisplay = `${currentTransferItem.convertedPrice} <img src="https://i.postimg.cc/3N3f5zhH/IMG-1243.png" style="width: 16px; height: 16px; margin-left: 4px;" alt="Stars">`;
        } else if (currentTransferItem.prices && typeof currentTransferItem.prices === 'object') {
            // Новый формат с объектом prices
            if (currentTransferItem.prices.STARS && currentTransferItem.prices.STARS > 0) {
                transferPriceDisplay = `${currentTransferItem.prices.STARS} <img src="https://i.postimg.cc/3N3f5zhH/IMG-1243.png" style="width: 16px; height: 16px; margin-left: 4px;" alt="Stars">`;
            } else if (currentTransferItem.prices.TON && currentTransferItem.prices.TON > 0) {
                const starsEquivalent = Math.ceil(currentTransferItem.prices.TON * 100);
                transferPriceDisplay = `${starsEquivalent} <img src="https://i.postimg.cc/3N3f5zhH/IMG-1243.png" style="width: 16px; height: 16px; margin-left: 4px;" alt="Stars">`;
            } else if (currentTransferItem.prices.RUB && currentTransferItem.prices.RUB > 0) {
                transferPriceDisplay = `${currentTransferItem.prices.RUB} ₽`;
            }
        } else if (currentTransferItem.price && !isNaN(currentTransferItem.price) && currentTransferItem.price > 0) {
            // Старый формат с полем price
            const starsPrice = Math.ceil(currentTransferItem.price * 100);
            transferPriceDisplay = `${starsPrice} <img src="https://i.postimg.cc/3N3f5zhH/IMG-1243.png" style="width: 16px; height: 16px; margin-left: 4px;" alt="Stars">`;
        } else {
            // Резервное значение если нет цены (не должно происходить)
            transferPriceDisplay = `1 <img src="https://i.postimg.cc/3N3f5zhH/IMG-1243.png" style="width: 16px; height: 16px; margin-left: 4px;" alt="Stars">`;
        }

        // Создаем HTML структуру для мета-информации
        const metaHTML = `
            <div class="transfer-item-price">${transferPriceDisplay}</div>
            <div class="transfer-item-id">#${currentTransferItem.id || '0000'}</div>
        `;

        // Найдем или создадим контейнер для мета-информации
        let metaContainer = document.querySelector('.transfer-item-meta');
        if (metaContainer) {
            metaContainer.innerHTML = metaHTML;
        }

        // Set image with safety checks
        if (currentTransferItem.image && currentTransferItem.image.startsWith('http')) {
            itemImage.innerHTML = `<img src="${currentTransferItem.image}" alt="${currentTransferItem.name || 'Подарок'}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 8px;">`;
        } else {
            itemImage.innerHTML = currentTransferItem.image || '🎁';
        }

        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }).catch(error => {
        console.error('Error loading inventory for transfer:', error);
        if (window.Telegram?.WebApp?.showPopup) {
            window.Telegram.WebApp.showPopup({
                title: 'Ошибка',
                message: 'Ошибка загрузки инвентаря',
                buttons: [{ type: 'ok', text: 'OK' }]
            });
        }
    });
}

function closeTransferModal() {
    const modal = document.getElementById('transferModal');
    modal.classList.remove('active');
    document.body.style.overflow = '';
    currentTransferItem = null;
}

async function confirmTransfer() {
    if (!currentTransferItem || !currentUser) {
        console.log('Нет данных для передачи');
        if (window.Telegram?.WebApp?.showPopup) {
            window.Telegram.WebApp.showPopup({
                title: 'Ошибка',
                message: 'Нет данных для передачи',
                buttons: [{ type: 'ok', text: 'OK' }]
            });
        }
        return;
    }

    const recipientUsername = document.getElementById('transferUsername').value.trim();
    const comment = document.getElementById('transferComment').value.trim();

    if (!recipientUsername) {
        if (window.Telegram?.WebApp?.showPopup) {
            window.Telegram.WebApp.showPopup({
                title: 'Ошибка',
                message: 'Введите username получателя',
                buttons: [{ type: 'ok', text: 'OK' }]
            });
        }
        return;
    }

    // Remove @ if present and validate
    const cleanUsername = recipientUsername.replace('@', '').trim();

    if (!cleanUsername || cleanUsername.length === 0) {
        if (window.Telegram?.WebApp?.showPopup) {
            window.Telegram.WebApp.showPopup({
                title: 'Ошибка',
                message: 'Введите корректное имя пользователя',
                buttons: [{ type: 'ok', text: 'OK' }]
            });
        }
        return;
    }

    // Get current user's username for comparison
    const currentUsername = currentUser.username || currentUser.first_name || 'user';

    // Check if trying to send to self
    if (cleanUsername.toLowerCase() === currentUsername.toLowerCase()) {
        if (window.Telegram?.WebApp?.showPopup) {
            window.Telegram.WebApp.showPopup({
                title: 'Ошибка',
                message: 'Нельзя передать подарок самому себе',
                buttons: [{ type: 'ok', text: 'OK' }]
            });
        }
        return;
    }

    // Disable transfer button to prevent double-clicking
    const transferBtn = document.querySelector('.transfer-send-btn');
    if (!transferBtn) {
        console.error('Transfer button not found');
        return;
    }

    const originalText = transferBtn.textContent;
    transferBtn.disabled = true;
    transferBtn.textContent = 'Передача...';

    try {
        // Validate item data before sending
        if (!currentTransferItem.id || !currentTransferItem.name) {
            throw new Error('Неполные данные предмета');
        }

        console.log('Transferring item:', currentTransferItem);

        const transferData = {
            itemId: currentTransferItem.id,
            fromUserId: currentUser.id,
            fromUsername: currentUsername,
            toUsername: cleanUsername,
            comment: comment,
            item: {
                ...currentTransferItem,
                // Ensure we have all necessary data
                inventoryId: currentTransferItem.inventoryId,
                id: currentTransferItem.id,
                name: currentTransferItem.name,
                image: currentTransferItem.image,
                price: currentTransferItem.price,
                quantity: currentTransferItem.quantity
            }
        };

        console.log('Sending transfer request:', transferData);

        const response = await fetch('/api/transfer-item', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(transferData)
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('HTTP error:', response.status, errorText);
            throw new Error(`HTTP ${response.status}: ${errorText}`);
        }

        const result = await response.json();
        console.log('Transfer response:', result);

        if (result.success) {
            closeTransferModal();

            // Перезагружаем инвентарь чтобы отобразить изменения
            await loadInventory();

            console.log(`Передача успешна: "${currentTransferItem.name}" отправлен @${cleanUsername}`);

            // Показываем успешное сообщение с информацией о доставке
            if (window.Telegram?.WebApp?.showPopup) {
                window.Telegram.WebApp.showPopup({
                    title: 'Подарок передан! 🎉',
                    message: `Подарок "${currentTransferItem.name}" успешно передан пользователю @${cleanUsername}!\n\nПолучатель получит уведомление в боте.`,
                    buttons: [{ type: 'ok', text: 'Отлично!' }]
                });
            } else {
                alert(`Подарок "${currentTransferItem.name}" успешно передан пользователю @${cleanUsername}!\n\nПолучатель получит уведомление в боте.`);
            }

            // Очищаем данные текущей передачи
            currentTransferItem = null;
            return;
        } else {
            throw new Error(result.error || 'Неизвестная ошибка сервера');
        }
    } catch (error) {
        console.error('Ошибка при передаче предмета:', error);

        let errorMessage = 'Произошла ошибка при передаче подарка. Попробуйте еще раз.';

        // Обрабатываем различные типы ошибок
        if (error.message.includes('HTTP 404') || error.message.includes('не найден в боте')) {
            errorMessage = `Пользователь @${cleanUsername} не найден в боте.\n\nПолучатель должен:\n• Зайти в бот хотя бы один раз\n• Или быть в списке активных пользователей`;
        } else if (error.message.includes('HTTP 400')) {
            errorMessage = 'Неверные данные для передачи. Проверьте правильность username.';
        } else if (error.message.includes('HTTP')) {
            errorMessage = 'Ошибка соединения с сервером. Проверьте интернет-соединение.';
        } else if (error.message) {
            // Используем сообщение об ошибке с сервера
            errorMessage = error.message;
        }

        if (window.Telegram?.WebApp?.showPopup) {
            window.Telegram.WebApp.showPopup({
                title: 'Ошибка передачи',
                message: errorMessage,
                buttons: [{ type: 'ok', text: 'Понятно' }]
            });
        } else {
            alert(`Ошибка: ${errorMessage}`);
        }
    } finally {
        // Re-enable transfer button
        if (transferBtn) {
            transferBtn.disabled = false;
            transferBtn.textContent = originalText;
        }
    }
}

// Sorting functionality removed

// Navigation functionality
document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', function() {
        // Remove active class from all items
        document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
        // Add active class to clicked item
        this.classList.add('active');

        const section = this.querySelector('.nav-text').textContent;

        // Show/hide sections based on navigation
        if (section === 'Маркет') {
            marketSection.style.display = 'block';
            activitySection.style.display = 'none';
            inventorySection.style.display = 'none';
            document.getElementById('adminSection').style.display = 'none';
            document.getElementById('profileSection').style.display = 'none';
        } else if (section === 'Активность') {
            marketSection.style.display = 'none';
            activitySection.style.display = 'block';
            inventorySection.style.display = 'none';
            document.getElementById('adminSection').style.display = 'none';
            document.getElementById('profileSection').style.display = 'none';
            renderActivity();
        } else if (section === 'Инвентарь') {
            marketSection.style.display = 'none';
            activitySection.style.display = 'none';
            inventorySection.style.display = 'block';
            document.getElementById('adminSection').style.display = 'none';
            document.getElementById('profileSection').style.display = 'none';
            renderInventory();
        } else if (section === 'Профиль') {
            marketSection.style.display = 'none';
            activitySection.style.display = 'none';
            inventorySection.style.display = 'none';
            document.getElementById('adminSection').style.display = 'none';
            document.getElementById('profileSection').style.display = 'block';
            updateStatsDisplay();
        } else if (section === 'Админ') {
            marketSection.style.display = 'none';
            activitySection.style.display = 'none';
            inventorySection.style.display = 'none';
            document.getElementById('profileSection').style.display = 'none';
            document.getElementById('adminSection').style.display = 'block';
            renderAdminItems();
        } else {
            marketSection.style.display = 'none';
            activitySection.style.display = 'none';
            inventorySection.style.display = 'none';
            document.getElementById('adminSection').style.display = 'none';
            document.getElementById('profileSection').style.display = 'none';
            console.log(`Переход в раздел: ${section}`);
        }
    });
});

// Channel subscription functions
function showChannelSubscriptionModal() {
    // Check if user has already seen the modal (localStorage)
    const hasSeenChannelModal = localStorage.getItem('hasSeenChannelModal');
    
    if (!hasSeenChannelModal) {
        setTimeout(() => {
            const modal = document.getElementById('channelSubscriptionModal');
            modal.classList.add('active');
            document.body.style.overflow = 'hidden';
        }, 2000); // Show after 2 seconds
    }
}

function closeChannelModal() {
    const modal = document.getElementById('channelSubscriptionModal');
    modal.classList.remove('active');
    document.body.style.overflow = '';
    
    // Mark as seen so it won't show again
    localStorage.setItem('hasSeenChannelModal', 'true');
}

function subscribeToChannel() {
    const channelUrl = 'https://t.me/MetaGift_News';
    
    if (window.Telegram?.WebApp?.openTelegramLink) {
        window.Telegram.WebApp.openTelegramLink(channelUrl);
    } else {
        window.open(channelUrl, '_blank');
    }
    
    // Close modal and mark as seen
    closeChannelModal();
}

// Initialize app
document.addEventListener('DOMContentLoaded', async () => {
    // Ensure market section is visible by default
    document.getElementById('marketSection').style.display = 'block';
    document.getElementById('activitySection').style.display = 'none';
    document.getElementById('inventorySection').style.display = 'none';
    document.getElementById('adminSection').style.display = 'none';
    document.getElementById('profileSection').style.display = 'none';

    // Load all data from server
    await loadNFTs();
    await loadActivity();
    await loadInventory();
    if (currentUser) {
        await loadUserBalance(currentUser.id);
    }

    // Show channel subscription modal
    showChannelSubscriptionModal();

    // Handle Telegram WebApp events
    if (window.Telegram && window.Telegram.WebApp) {
        window.Telegram.WebApp.onEvent('mainButtonClicked', () => {
            console.log('Функция покупки будет добавлена позже');
        });
    }
});

// Current top up amount
let currentTopUpAmount = 0;

// Top Up Stars Modal Functions
function openTopUpModal() {
    const modal = document.getElementById('topUpModal');
    document.getElementById('topUpAmount').value = '';
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeTopUpModal() {
    const modal = document.getElementById('topUpModal');
    modal.classList.remove('active');
    document.body.style.overflow = '';
    // Don't reset currentTopUpAmount here, it's needed for payment modal
}

function proceedToTopUpPayment() {
    const amountInput = document.getElementById('topUpAmount');
    const amount = parseInt(amountInput.value);

    console.log('Input value:', amountInput.value, 'Parsed amount:', amount);

    if (!amount || amount < 1) {
        if (window.Telegram?.WebApp?.showPopup) {
            window.Telegram.WebApp.showPopup({
                title: 'Ошибка',
                message: 'Введите корректное количество Stars (минимум 1)',
                buttons: [{ type: 'ok', text: 'OK' }]
            });
        }
        return;
    }

    currentTopUpAmount = amount;
    console.log('Set currentTopUpAmount to:', currentTopUpAmount);

    // Close top up modal and open payment modal
    closeTopUpModal();
    openTopUpPaymentModal();
}

function openTopUpPaymentModal() {
    const modal = document.getElementById('topUpPaymentModal');
    const priceElement = document.getElementById('topUpPaymentPrice');
    const starsAmountElement = document.getElementById('topUpStarsAmount');

    // Set payment info - make sure currentTopUpAmount is used correctly
    console.log('Current top up amount:', currentTopUpAmount);
    priceElement.innerHTML = `${currentTopUpAmount} <img src="https://i.postimg.cc/3N3f5zhH/IMG-1243.png" style="width: 16px; height: 16px; margin-left: 4px;" alt="Stars">`;
    starsAmountElement.textContent = currentTopUpAmount;

    // Show modal
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeTopUpPaymentModal() {
    const modal = document.getElementById('topUpPaymentModal');
    modal.classList.remove('active');
    document.body.style.overflow = '';
    currentTopUpAmount = 0; // Reset only when payment modal is closed
}

async function confirmTopUpPayment() {
    if (!currentUser || !currentTopUpAmount) {
        console.log('Нет данных для подтверждения пополнения');
        return;
    }

    try {
        const response = await fetch('/api/topup-request', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                userId: currentUser.id,
                username: currentUser.username || currentUser.first_name || 'user',
                amount: currentTopUpAmount,
                type: 'stars_topup'
            })
        });

        if (response.ok) {
            closeTopUpPaymentModal();

            let successMessage = `Ваша заявка на пополнение отправлена в модерацию. Ожидайте подтверждения от 1 минуты.`;

            if (window.Telegram?.WebApp?.showPopup) {
                window.Telegram.WebApp.showPopup({
                    title: 'Заявка отправлена',
                    message: successMessage,
                    buttons: [{ type: 'ok', text: 'OK' }]
                });
            }

            currentTopUpAmount = 0;
        } else {
            console.log('Ошибка при отправке заявки на пополнение');
        }
    } catch (error) {
        console.error('Error submitting top up request:', error);
    }
}

// Close button functionality removed (element not found)

// Purchase modal functionality
function openPurchaseModal(item) {
    const modal = document.getElementById('purchaseModal');
    const modalImage = document.getElementById('modalImage');
    const modalTitle = document.getElementById('modalTitle');
    const modalId = document.getElementById('modalId');
    const modalPrice = document.getElementById('modalPrice');
    const modalBuyBtn = document.getElementById('modalBuyBtn');

    // Set modal content
    modalTitle.textContent = item.name;
    modalId.textContent = `#${item.id}`;

    // Показать все доступные цены
    let pricesDisplay = '';
    if (item.prices) {
        const prices = [];
        if (item.prices.TON > 0) prices.push(`${item.prices.TON} TON`);
        if (item.prices.STARS > 0) prices.push(`${item.prices.STARS} <img src="https://i.postimg.cc/3N3f5zhH/IMG-1243.png" style="width: 20px; height: 20px; vertical-align: middle;" alt="Stars">`);
        if (item.prices.RUB > 0) prices.push(`${item.prices.RUB} ₽`);
        pricesDisplay = prices.join(' | ');
    } else {
        // Для совместимости со старым форматом
        const starsPrice = Math.ceil(item.price * 100);
        pricesDisplay = `${starsPrice} <img src="https://i.postimg.cc/3N3f5zhH/IMG-1243.png" style="width: 20px; height: 20px; vertical-align: middle; margin-left: 4px;" alt="Stars">`;
    }
    modalPrice.innerHTML = pricesDisplay;

    // Set image
    if (item.image.startsWith('http')) {
        modalImage.innerHTML = `
            <img src="${item.image}" alt="${item.name}">
            <div class="modal-quantity">${item.quantity}</div>
        `;
    } else {
        modalImage.innerHTML = `
            ${item.image}
            <div class="modal-quantity">${item.quantity}</div>
        `;
    }

    // Set buy button action
    modalBuyBtn.onclick = () => {
        buyItem(item.id);
        closePurchaseModal();
    };

    // Show modal
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closePurchaseModal() {
    const modal = document.getElementById('purchaseModal');
    modal.classList.remove('active');
    document.body.style.overflow = '';
}

// Fullscreen toggle functionality
function toggleFullscreen() {
    if (window.Telegram && window.Telegram.WebApp) {
        const tg = window.Telegram.WebApp;
        try {
            if (tg.isFullscreen && tg.exitFullscreen) {
                tg.exitFullscreen();
            } else if (tg.requestFullscreen) {
                tg.requestFullscreen();
            }
        } catch (error) {
            console.log('Fullscreen not supported or error:', error);
        }
    }
}

// Profile Section Functions
function setUserProfileInfo(user) {
    const profileUsername = document.getElementById('profileUsername');
    const userAvatar = document.getElementById('userAvatar');
    const headerUsername = document.getElementById('headerUsername');
    const headerUserAvatar = document.getElementById('headerUserAvatar');
    const referralLinkInput = document.getElementById('referralLinkInput');
    const inviteModalLink = document.getElementById('inviteModalLink');

    if (user) {
        const username = `@${user.username || user.first_name || 'user'}`;

        // Set profile section
        profileUsername.textContent = username;

        // Set header user info
        headerUsername.textContent = username;

        // Set user avatar if available
        if (user.photo_url) {
            userAvatar.src = user.photo_url;
            headerUserAvatar.src = user.photo_url;
        }

        // Generate referral link
        const referralLink = `https://t.me/MetaGiftRobot/OpenApp?startapp=r_${user.id}`;
        referralLinkInput.value = referralLink;
        inviteModalLink.value = referralLink;
    }
}

async function loadUserStats(userId) {
    try {
        const response = await fetch(`/api/user-stats/${userId}`);
        if (response.ok) {
            userStats = await response.json();
            updateStatsDisplay();
        }
    } catch (error) {
        console.error('Error loading user stats:', error);
    }
}

async function updateUserUsername(userId, newUsername) {
    if (!userId || !newUsername) return;

    try {
        // Get current username from localStorage or previous data
        const storedUsername = localStorage.getItem(`username_${userId}`);

        // Only update if username has changed
        if (storedUsername && storedUsername !== newUsername) {
            const response = await fetch('/api/update-username', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    userId: userId,
                    oldUsername: storedUsername,
                    newUsername: newUsername
                })
            });

            if (response.ok) {
                console.log(`Username updated from ${storedUsername} to ${newUsername}`);
            }
        }

        // Store current username
        localStorage.setItem(`username_${userId}`, newUsername);

    } catch (error) {
        console.error('Error updating username:', error);
    }
}

function updateStatsDisplay() {
    document.getElementById('totalPurchases').textContent = userStats.totalPurchases;
    document.getElementById('totalSpent').innerHTML = `${userStats.totalSpent} <img src="https://i.postimg.cc/3N3f5zhH/IMG-1243.png" style="width: 14px; height: 14px;" alt="Stars">`;
    document.getElementById('referralCount').textContent = userStats.referralCount;
    document.getElementById('referralEarnings').innerHTML = `${userStats.referralEarnings} <img src="https://i.postimg.cc/3N3f5zhH/IMG-1243.png" style="width: 14px; height: 14px;" alt="Stars">`;
}

function updateBalanceDisplay() {
    // Update any UI elements that display the user's star balance
    const balanceElements = document.querySelectorAll('.user-balance-stars');
    balanceElements.forEach(el => {
        el.textContent = userBalance.stars;
    });

    // Update balance in header if exists
    const headerBalance = document.querySelector('.balance-amount');
    if (headerBalance) {
        headerBalance.textContent = userBalance.stars;
    }

    // Update balance display in profile section
    const profileBalance = document.getElementById('profileStarsBalance');
    if (profileBalance) {
        profileBalance.textContent = userBalance.stars;
    }
}


// Invite modal functions
function openInviteModal() {
    const modal = document.getElementById('inviteModal');
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeInviteModal() {
    const modal = document.getElementById('inviteModal');
    modal.classList.remove('active');
    document.body.style.overflow = '';
}

function copyReferralLink() {
    const referralLinkInput = document.getElementById('referralLinkInput');
    const linkText = referralLinkInput.value;

    // Try modern Clipboard API first
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(linkText).then(() => {
            console.log('Ссылка скопирована в буфер обмена');

            if (window.Telegram?.WebApp?.showPopup) {
                window.Telegram.WebApp.showPopup({
                    title: 'Успешно',
                    message: 'Ссылка скопирована в буфер обмена',
                    buttons: [{ type: 'ok', text: 'OK' }]
                });
            }
        }).catch(() => {
            // Fallback to old method
            fallbackCopy(referralLinkInput);
        });
    } else {
        // Fallback to old method
        fallbackCopy(referralLinkInput);
    }
}

function fallbackCopy(input) {
    try {
        input.select();
        input.setSelectionRange(0, 99999);
        document.execCommand('copy');
        console.log('Ссылка скопирована в буфер обмена');

        if (window.Telegram?.WebApp?.showPopup) {
            window.Telegram.WebApp.showPopup({
                title: 'Успешно',
                message: 'Ссылка скопирована в буфер обмена',
                buttons: [{ type: 'ok', text: 'OK' }]
            });
        }
    } catch (error) {
        console.log('Не удалось скопировать ссылку');
    }
}

function copyInviteLink() {
    const referralLinkInput = document.getElementById('inviteModalLink');
    const linkText = referralLinkInput.value;

    // Try modern Clipboard API first
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(linkText).then(() => {
            console.log('Ссылка скопирована в буфер обмена');

            if (window.Telegram?.WebApp?.showPopup) {
                window.Telegram.WebApp.showPopup({
                    title: 'Успешно',
                    message: 'Ссылка скопирована в буфер обмена',
                    buttons: [{ type: 'ok', text: 'OK' }]
                });
            }
        }).catch(() => {
            // Fallback to old method
            fallbackCopy(inviteModalLink);
        });
    } else {
        // Fallback to old method
        fallbackCopy(inviteModalLink);
    }
}

function shareToTelegram() {
    const referralLink = document.getElementById('inviteModalLink').value;
    const message = `Присоединяйся к MetaGifts и получи крутые подарки! 🎁\n\n${referralLink}`;

    if (window.Telegram?.WebApp?.openTelegramLink) {
        const telegramShareUrl = `https://t.me/share/url?url=${encodeURIComponent(referralLink)}&text=${encodeURIComponent('Присоединяйся к MetaGifts и получи крутые подарки! 🎁')}`;
        window.Telegram.WebApp.openTelegramLink(telegramShareUrl);
    } else {
        // Fallback for web version
        const telegramShareUrl = `https://t.me/share/url?url=${encodeURIComponent(referralLink)}&text=${encodeURIComponent('Присоединяйся к MetaGifts и получи крутые подарки! 🎁')}`;
        window.open(telegramShareUrl, '_blank');
    }

    closeInviteModal();
}

// Payment Methods Modal Functions
async function openPaymentMethodsModal(item) {
    try {
        const response = await fetch(`/api/payment-methods/${item.id}`);
        if (!response.ok) {
            throw new Error('Failed to load payment methods');
        }

        const data = await response.json();
        currentPaymentMethods = data.paymentMethods;

        // Add balance payment method if user has enough stars
        let starsPrice = 0;
        if (item.prices && item.prices.STARS > 0) {
            starsPrice = item.prices.STARS;
        } else if (item.price) {
            starsPrice = Math.ceil(item.price * 100);
        }

        console.log('User balance:', userBalance.stars, 'Required stars:', starsPrice);

        if (userBalance.stars >= starsPrice && starsPrice > 0) {
            currentPaymentMethods.unshift({
                id: 'BALANCE',
                name: 'Оплата с баланса',
                icon: 'https://i.postimg.cc/3N3f5zhH/IMG-1243.png',
                price: starsPrice,
                description: `У вас: ${userBalance.stars} Stars`
            });
        }

        const modal = document.getElementById('paymentMethodsModal');

        // Set item info in payment methods modal
        const itemImageElement = document.getElementById('paymentMethodsItemImage');
        const itemNameElement = document.getElementById('paymentMethodsItemName');

        if (itemImageElement && itemNameElement) {
            // Set item image
            if (item.image && item.image.startsWith('http')) {
                itemImageElement.innerHTML = `<img src="${item.image}" alt="${item.name}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 12px;">`;
            } else {
                itemImageElement.innerHTML = item.image || '📦';
            }

            // Set item name
            itemNameElement.textContent = item.name;
        }

        // Get methods list element
        const methodsList = document.getElementById('paymentMethodsList') || 
                           document.querySelector('.payment-methods-list') ||
                           document.querySelector('#paymentMethodsModal .payment-methods');

        if (!methodsList) {
            console.error('Payment methods list element not found');
            return;
        }

        // Render payment methods
        methodsList.innerHTML = '';
        currentPaymentMethods.forEach(method => {
            // Add icon for TON Wallet
            if (method.id === 'TON') {
                method.icon = 'https://ton.org/download/ton_symbol.png';
            }
            const methodElement = createPaymentMethodElement(method);
            methodsList.appendChild(methodElement);
        });

        // Close purchase modal and show payment methods modal
        closePurchaseModal();
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';

    } catch (error) {
        console.error('Error loading payment methods:', error);
        if (window.Telegram?.WebApp?.showPopup) {
            window.Telegram.WebApp.showPopup({
                title: 'Ошибка',
                message: 'Не удалось загрузить способы оплаты',
                buttons: [{ type: 'ok', text: 'OK' }]
            });
        }
    }
}

function createPaymentMethodElement(method) {
    const div = document.createElement('div');
    div.className = 'payment-method-item';
    div.onclick = () => selectPaymentMethod(method);

    let priceText = '';
    let currencySymbol = '';

    switch (method.id) {
        case 'STARS':
            priceText = `${method.price} `;
            currencySymbol = '';
            break;
        case 'YOOMONEY':
            priceText = `${method.price} ₽`;
            currencySymbol = '₽';
            break;
        case 'TON':
            priceText = `${method.price} TON`;
            currencySymbol = 'TON';
            break;
        case 'BALANCE': // Handle new balance payment method
            priceText = `${method.price} `;
            currencySymbol = '';
            break;
    }

    div.innerHTML = `
        <div class="payment-method-icon">
            <img src="${method.icon}" alt="${method.name}">
        </div>
        <div class="payment-method-info">
            <div class="payment-method-name">${method.name}</div>
            <div class="payment-method-price">${priceText}</div>
            ${method.description ? `<div class="payment-method-description">${method.description}</div>` : ''}
        </div>
        <div class="payment-method-arrow">→</div>
    `;

    return div;
}

function selectPaymentMethod(method) {
    selectedPaymentMethod = method;
    closePaymentMethodsModal();

    // Handle different payment methods
    if (method.id === 'BALANCE') {
        confirmBalancePayment();
    } else {
        openPaymentModal(currentPurchaseItem, method);
    }
}

function closePaymentMethodsModal() {
    const modal = document.getElementById('paymentMethodsModal');
    modal.classList.remove('active');
    document.body.style.overflow = '';
}

// Payment Modal Functions
function openPaymentModal(item, paymentMethod) {
    const modal = document.getElementById('paymentModal');
    const itemImage = document.getElementById('paymentItemImage');
    const itemName = document.getElementById('paymentItemName');
    const itemPrice = document.getElementById('paymentItemPrice');
    const paymentInstructions = document.getElementById('paymentInstructions');

    // Set item info
    itemName.textContent = item.name;

    // Set price based on payment method
    let priceText = '';
    let methodIcon = '';

    switch (paymentMethod.id) {
        case 'STARS':
            priceText = `${paymentMethod.price} `;
            methodIcon = `<img src="${paymentMethod.icon}" style="width: 16px; height: 16px; margin-right: 4px;" alt="Stars">`;
            break;
        case 'YOOMONEY':
            priceText = `${paymentMethod.price} ₽`;
            methodIcon = `<img src="${paymentMethod.icon}" style="width: 16px; height: 16px; margin-right: 4px;" alt="ЮMoney">`;
            break;
        case 'TON':
            methodIcon = `<div class="ton-icon" style="width: 16px; height: 16px; display: inline-block; margin-right: 4px;"></div>`;
            priceText = `${paymentMethod.price} TON`;
            break;
    }

    itemPrice.innerHTML = `${methodIcon}${priceText}`;

    // Set image
    if (item.image && item.image.startsWith('http')) {
        itemImage.innerHTML = `<img src="${item.image}" alt="${item.name}">`;
    } else {
        itemImage.innerHTML = item.image || '📦';
    }

    // Update payment instructions based on method
    updatePaymentInstructions(paymentMethod);

    // Show modal
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function updatePaymentInstructions(paymentMethod) {
    const paymentInstructions = document.getElementById('paymentInstructions');

    let instructionsHTML = '';

    switch (paymentMethod.id) {
        case 'STARS':
            instructionsHTML = `
                <div class="payment-step">
                    <div class="step-number">1</div>
                    <div class="step-text">Отправьте ${paymentMethod.price} <img src="https://i.postimg.cc/3N3f5zhH/IMG-1243.png" style="width: 14px; height: 14px; vertical-align: middle;" alt="Stars"> Telegram Stars менеджеру обычным подарком:</div>
                </div>
                <div class="payment-contact">
                    <div class="contact-label">Менеджер поддержки:</div>
                    <div class="contact-info">
                        <span>${paymentMethod.contact}</span>
                        <button class="contact-btn" onclick="openTelegramContact('${paymentMethod.contact}')">Написать</button>
                    </div>
                </div>
                <div class="payment-step">
                    <div class="step-number">2</div>
                    <div class="step-text">После отправки звезд обычным подарком нажмите кнопку "Я оплатил"</div>
                </div>
            `;
            break;

        case 'YOOMONEY':
            instructionsHTML = `
                <div class="payment-step">
                    <div class="step-number">1</div>
                    <div class="step-text">Переведите ${paymentMethod.price} ₽ на кошелек ЮMoney:</div>
                </div>
                <div class="payment-wallet">
                    <div class="wallet-label">Номер кошелька ЮMoney:</div>
                    <div class="wallet-address">
                        <span id="yoomoneyWallet">${paymentMethod.wallet}</span>
                        <button class="copy-wallet-btn" onclick="copyYoomoneyWallet()">Копировать</button>
                    </div>
                </div>
                <div class="payment-step">
                    <div class="step-number">2</div>
                    <div class="step-text">После перевода нажмите кнопку "Оплачено"</div>
                </div>
            `;
            break;

        case 'TON':
            instructionsHTML = `
                <div class="payment-step">
                    <div class="step-number">1</div>
                    <div class="step-text">Переведите ${paymentMethod.price} TON на кошелек:</div>
                </div>
                <div class="payment-wallet">
                    <div class="wallet-label">TON кошелек:</div>
                    <div class="wallet-address">
                        <span id="walletAddressText">${paymentMethod.wallet}</span>
                        <button class="copy-wallet-btn" onclick="copyWalletAddress()">Копировать</button>
                    </div>
                </div>
                <div class="payment-step">
                    <div class="step-number">2</div>
                    <div class="step-text">После перевода нажмите кнопку "Оплачено"</div>
                </div>
            `;
            break;
    }

    paymentInstructions.innerHTML = instructionsHTML;
}

function closePaymentModal() {
    const modal = document.getElementById('paymentModal');
    modal.classList.remove('active');
    document.body.style.overflow = '';
    currentPurchaseItem = null;
}

function copyWalletAddress() {
    const walletText = document.getElementById('walletAddressText').textContent;

    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(walletText).then(() => {
            console.log('Адрес кошелька скопирован');

            if (window.Telegram?.WebApp?.showPopup) {
                window.Telegram.WebApp.showPopup({
                    title: 'Успешно',
                    message: 'Адрес кошелька скопирован в буфер обмена',
                    buttons: [{ type: 'ok', text: 'OK' }]
                });
            }
        }).catch(() => {
            fallbackCopyWallet();
        });
    } else {
        fallbackCopyWallet();
    }
}

function fallbackCopyWallet() {
    try {
        const walletElement = document.getElementById('walletAddressText');
        const walletText = walletElement ? walletElement.textContent : MERCHANT_WALLET;

        const textArea = document.createElement('textarea');
        textArea.value = walletText;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);

        console.log('Адрес кошелька скопирован');

        if (window.Telegram?.WebApp?.showPopup) {
            window.Telegram.WebApp.showPopup({
                title: 'Успешно',
                message: 'Адрес кошелька скопирован в буфер обмена',
                buttons: [{ type: 'ok', text: 'OK' }]
            });
        }
    } catch (error) {
        console.log('Не удалось скопировать адрес кошелька');
    }
}

function copyYoomoneyWallet() {
    const walletText = document.getElementById('yoomoneyWallet').textContent;

    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(walletText).then(() => {
            console.log('Номер кошелька ЮMoney скопирован');

            if (window.Telegram?.WebApp?.showPopup) {
                window.Telegram.WebApp.showPopup({
                    title: 'Успешно',
                    message: 'Номер кошелька ЮMoney скопирован в буфер обмена',
                    buttons: [{ type: 'ok', text: 'OK' }]
                });
            }
        }).catch(() => {
            fallbackCopyYoomoney();
        });
    } else {
        fallbackCopyYoomoney();
    }
}

function fallbackCopyYoomoney() {
    try {
        const textArea = document.createElement('textarea');
        textArea.value = document.getElementById('yoomoneyWallet').textContent;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);

        console.log('Номер кошелька ЮMoney скопирован');

        if (window.Telegram?.WebApp?.showPopup) {
            window.Telegram.WebApp.showPopup({
                title: 'Успешно',
                message: 'Номер кошелька ЮMoney скопирован в буфер обмена',
                buttons: [{ type: 'ok', text: 'OK' }]
            });
        }
    } catch (error) {
        console.log('Не удалось скопировать номер кошелька ЮMoney');
    }
}

function openTelegramContact(username) {
    const telegramUrl = `https://t.me/${username.replace('@', '')}`;

    if (window.Telegram?.WebApp?.openTelegramLink) {
        window.Telegram.WebApp.openTelegramLink(telegramUrl);
    } else {
        window.open(telegramUrl, '_blank');
    }
}

async function confirmPayment() {
    if (!currentPurchaseItem || !currentUser || !selectedPaymentMethod) {
        console.log('Нет данных для подтверждения оплаты');
        return;
    }

    try {
        const response = await fetch('/api/payment-request', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                itemId: currentPurchaseItem.id,
                userId: currentUser.id,
                username: currentUser.username || currentUser.first_name || 'user',
                price: currentPurchaseItem.price,
                convertedPrice: selectedPaymentMethod.price,
                paymentMethod: selectedPaymentMethod.id,
                itemName: currentPurchaseItem.name,
                itemImage: currentPurchaseItem.image,
                referrerId: getReferrerId()
            })
        });

        if (response.ok) {
            closePaymentModal();

            let methodName = selectedPaymentMethod.name;
            let successMessage = `Ваша заявка на оплату через ${methodName} отправлена kepada администратору. Ожидайте подтверждения.`;

            if (window.Telegram?.WebApp?.showPopup) {
                window.Telegram.WebApp.showPopup({
                    title: 'Заявка отправлена',
                    message: successMessage,
                    buttons: [{ type: 'ok', text: 'OK' }]
                });
            }
        } else {
            console.log('Ошибка при отправке заявки на оплату');
        }
    } catch (error) {
        console.error('Error submitting payment request:', error);
    }
}

async function confirmBalancePayment() {
    if (!currentPurchaseItem || !currentUser || !selectedPaymentMethod) {
        console.log('Нет данных для подтверждения оплаты с баланса');
        return;
    }

    try {
        const response = await fetch('/api/purchase-with-balance', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                itemId: currentPurchaseItem.id,
                userId: currentUser.id,
                username: currentUser.username || currentUser.first_name || 'user',
                starsPrice: selectedPaymentMethod.price, // Price in stars
                referrerId: getReferrerId()
            })
        });

        if (response.ok) {
            const result = await response.json();
            closePaymentMethodsModal();

            // Update user balance from server response
            userBalance.stars = result.newBalance || 0;
            updateBalanceDisplay();

            // Reload user balance from server to ensure sync
            await loadUserBalance(currentUser.id);

            // Update inventory and other relevant data
            await loadInventory();
            await loadUserStats(currentUser.id); // Update stats if necessary

            let successMessage = `Поздравляем! Вы успешно приобрели "${currentPurchaseItem.name}" за ${selectedPaymentMethod.price} Stars.`;

            if (window.Telegram?.WebApp?.showPopup) {
                window.Telegram.WebApp.showPopup({
                    title: 'Покупка успешна!',
                    message: successMessage,
                    buttons: [{ type: 'ok', text: 'Отлично!' }]
                });
            }
        } else {
            const error = await response.json();
            console.error('Error confirming balance payment:', error.error || 'Неизвестная ошибка');
            if (window.Telegram?.WebApp?.showPopup) {
                window.Telegram.WebApp.showPopup({
                    title: 'Ошибка оплаты',
                    message: error.error || 'Не удалось завершить покупку с баланса. Попробуйте еще раз.',
                    buttons: [{ type: 'ok', text: 'Понятно' }]
                });
            }
        }
    } catch (error) {
        console.error('Error confirming balance payment:', error);
        if (window.Telegram?.WebApp?.showPopup) {
            window.Telegram.WebApp.showPopup({
                title: 'Ошибка оплаты',
                message: 'Произошла ошибка при попытке оплаты с баланса. Попробуйте еще раз.',
                buttons: [{ type: 'ok', text: 'OK' }]
            });
        }
    }
}


// Admin Panel Functions
function showAdminTab(tab) {
    // Update tab buttons
    document.querySelectorAll('.admin-tab').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');

    // Show/hide content
    if (tab === 'items') {
        document.getElementById('adminItems').style.display = 'block';
        document.getElementById('adminPayments').style.display = 'none';
        renderAdminItems();
    } else if (tab === 'payments') {
        document.getElementById('adminItems').style.display = 'none';
        document.getElementById('adminPayments').style.display = 'block';
        loadPaymentRequests();
    }
}

async function loadPaymentRequests() {
    try {
        const response = await fetch('/api/payment-requests');
        if (response.ok) {
            const requests = await response.json();
            renderPaymentRequests(requests);
        }
    } catch (error) {
        console.error('Error loading payment requests:', error);
    }
}

function renderPaymentRequests(requests) {
    const adminPayments = document.getElementById('adminPayments');

    if (requests.length === 0) {
        adminPayments.innerHTML = `
            <div class="admin-empty">
                <div class="admin-empty-icon">💳</div>
                <div class="admin-empty-text">Нет заявок на оплату</div>
                <div class="admin-empty-subtext">Заявки будут отображаться здесь</div>
            </div>
        `;
        return;
    }

    adminPayments.innerHTML = '';

    requests.forEach(request => {
        const requestElement = createPaymentRequestElement(request);
        adminPayments.appendChild(requestElement);
    });
}

function createPaymentRequestElement(request) {
    const div = document.createElement('div');
    div.className = 'payment-request';

    // Check if this is a top up request
    if (request.type === 'stars_topup') {
        div.innerHTML = `
            <div class="payment-request-header">
                <div class="payment-request-status pending">В ожидании</div>
                <div class="request-date">${new Date(request.date).toLocaleString('ru-RU')}</div>
            </div>
            <div class="payment-request-info">
                <div class="payment-request-image">
                    ⭐
                </div>
                <div class="payment-request-details">
                    <h4>Пополнение Stars</h4>
                    <div class="request-user">@${request.username}</div>
                    <div class="request-price">${request.amount} <img src="https://i.postimg.cc/3N3f5zhH/IMG-1243.png" style="width: 14px; height: 14px;" alt="Stars"></div>
                </div>
            </div>
            <div class="payment-request-actions">
                <button class="approve-btn" onclick="approveTopUp('${request.id}')">Принять</button>
                <button class="reject-btn" onclick="rejectPayment('${request.id}')">Отклонить</button>
            </div>
        `;
    } else {
        // Regular item purchase request
        const imageContent = request.itemImage && request.itemImage.startsWith('http') ? 
            `<img src="${request.itemImage}" alt="${request.itemName}">` : 
            (request.itemImage || '📦');

        div.innerHTML = `
            <div class="payment-request-header">
                <div class="payment-request-status pending">В ожидании</div>
                <div class="request-date">${new Date(request.date).toLocaleString('ru-RU')}</div>
            </div>
            <div class="payment-request-info">
                <div class="payment-request-image">
                    ${imageContent}
                </div>
                <div class="payment-request-details">
                    <h4>${request.itemName}</h4>
                    <div class="request-user">@${request.username}</div>
                    <div class="request-price">${request.price} TON</div>
                </div>
            </div>
            <div class="payment-request-actions">
                <button class="approve-btn" onclick="approvePayment('${request.id}')">Принять</button>
                <button class="reject-btn" onclick="rejectPayment('${request.id}')">Отклонить</button>
            </div>
        `;
    }

    return div;
}

async function approvePayment(requestId) {
    try {
        const response = await fetch(`/api/payment-request/${requestId}/approve`, {
            method: 'POST'
        });

        if (response.ok) {
            loadPaymentRequests();
            console.log('Заявка на оплату одобрена');

            // Reload other data to sync
            await loadNFTs();
            await loadActivity();
            await loadInventory();
        }
    } catch (error) {
        console.error('Error approving payment:', error);
    }
}

async function approveTopUp(requestId) {
    try {
        const response = await fetch(`/api/topup-request/${requestId}/approve`, {
            method: 'POST'
        });

        if (response.ok) {
            loadPaymentRequests();
            console.log('Заявка на пополнение одобрена');
        }
    } catch (error) {
        console.error('Error approving top up:', error);
    }
}

async function rejectPayment(requestId) {
    try {
        const response = await fetch(`/api/payment-request/${requestId}/reject`, {
            method: 'POST'
        });

        if (response.ok) {
            loadPaymentRequests();
            console.log('Заявка на оплату отклонена');
        }
    } catch (error) {
        console.error('Error rejecting payment:', error);
    }
}

// Referral system functions
function getReferrerId() {
    // Check Telegram WebApp start param first
    if (window.Telegram && window.Telegram.WebApp) {
        const startParam = window.Telegram.WebApp.initDataUnsafe?.start_param;
        if (startParam && startParam.startsWith('r_')) {
            const referrerId = startParam.substring(2);
            localStorage.setItem('referrerId', referrerId);
            return referrerId;
        }
    }

    // Check if user came from referral link in URL
    const urlParams = new URLSearchParams(window.location.search);
    const referralParam = urlParams.get('startapp');
    if (referralParam && referralParam.startsWith('r_')) {
        const referrerId = referralParam.substring(2);
        localStorage.setItem('referrerId', referralParam.substring(2));
        return referrerId;
    }

    // Return stored referrer ID
    return localStorage.getItem('referrerId');
}