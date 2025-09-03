const express = require('express');
const path = require('path');
const fs = require('fs');
const { initializeDatabase, getUserBalance, updateUserBalance, getUserStats, getAllItems, client } = require('./database');
const app = express();

app.use(express.static('public'));
app.use(express.json());

// Initialize database on startup
initializeDatabase();

// Telegram Bot Configuration
const BOT_TOKEN = process.env.BOT_TOKEN || '7867539237:AAF2j0xWMlBNKEf6HBklZzxgMC6cPEEhX8I'; // Замените на ваш реальный токен

// Handle Telegram webhook
app.post('/webhook', (req, res) => {
  console.log('Received webhook:', JSON.stringify(req.body, null, 2));
  const update = req.body;
  
  if (update.message) {
    const chatId = update.message.chat.id;
    const text = update.message.text;
    
    if (text === '/start') {
      const welcomeMessage = `🎁 <b>Добро пожаловать в MetaGift!</b>

Покупайте и дарите уникальные подарки в Telegram!

🌟 <b>Что вас ждет:</b>
• Эксклюзивные цифровые подарки
• Передача подарков друзьям
• Пополнение баланса Stars
• Реферальная программа

Нажмите кнопку ниже чтобы открыть магазин! 👇`;

      const keyboard = {
        inline_keyboard: [[
          {
            text: "🛍️ Открыть магазин",
            web_app: {
              url: "https://metagift-market.replit.app"
            }
          }
        ]]
      };

      sendTelegramMessageWithKeyboard(chatId, welcomeMessage, keyboard);
    } else if (text === '/stars') {
      const starsMessage = `⭐ <b>Telegram Stars</b>

Используйте Telegram Stars для покупки подарков!

💰 <b>Преимущества Stars:</b>
• Быстрая и безопасная оплата
• Мгновенное зачисление на баланс
• Покупка подарков одним кликом

Откройте магазин чтобы пополнить баланс Stars! 👇`;

      const keyboard = {
        inline_keyboard: [[
          {
            text: "⭐ Открыть магазин Stars",
            web_app: {
              url: "https://metagift-market.replit.app"
            }
          }
        ]]
      };

      sendTelegramMessageWithKeyboard(chatId, starsMessage, keyboard);
    }
  }
  
  res.status(200).send('OK');
});

// Currency rates and payment configuration
const CURRENCY_RATES = {
  TON_TO_STARS: 100, // 1 TON = 100 Stars
  TON_TO_RUBLE: 300, // 1 TON = 300 рублей (примерный курс)
  STARS_TO_RUBLE: 3   // 1 Star = 3 рубля
};

const PAYMENT_METHODS = {
  STARS: {
    name: 'Telegram Stars',
    icon: 'https://i.postimg.cc/3N3f5zhH/IMG-1243.png',
    contact: '@MetaGift_support'
  },
  YOOMONEY: {
    name: 'ЮMoney',
    icon: 'https://thumb.tildacdn.com/tild6365-6562-4437-a465-306531386233/-/format/webp/4.png',
    wallet: '4100118542839036'
  },
  TON: {
    name: 'TON Wallet',
    icon: 'https://ton.org/download/ton_symbol.png',
    wallet: 'UQDy5hhPvhwcNY9g-lP-nkjdmx4rAVZGFEnhOKzdF-JcIiDW'
  }
};

// Convert TON price to other currencies
function convertPrice(tonPrice, targetCurrency) {
  switch (targetCurrency) {
    case 'STARS':
      return Math.ceil(tonPrice * CURRENCY_RATES.TON_TO_STARS);
    case 'YOOMONEY':
      return Math.ceil(tonPrice * CURRENCY_RATES.TON_TO_RUBLE);
    case 'TON':
      return tonPrice;
    default:
      return tonPrice;
  }
}

// Function to send message via Telegram Bot API
async function sendTelegramMessage(userId, message, parse_mode = 'HTML') {
  if (!BOT_TOKEN || BOT_TOKEN === 'YOUR_BOT_TOKEN_HERE') {
    console.log('Bot token not configured, skipping message send');
    return false;
  }

  try {
    const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: userId,
        text: message,
        parse_mode: parse_mode
      })
    });

    const result = await response.json();

    if (result.ok) {
      console.log(`✅ Message sent successfully to user ${userId}`);
      return true;
    } else {
      console.log(`❌ Failed to send message to user ${userId}:`, result.description);
      return false;
    }
  } catch (error) {
    console.error(`Error sending message to user ${userId}:`, error);
    return false;
  }
}

// Function to send message with inline keyboard
async function sendTelegramMessageWithKeyboard(chatId, message, keyboard, parse_mode = 'HTML') {
  if (!BOT_TOKEN || BOT_TOKEN === 'YOUR_BOT_TOKEN_HERE') {
    console.log('Bot token not configured, skipping message send');
    return false;
  }

  try {
    const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: parse_mode,
        reply_markup: keyboard
      })
    });

    const result = await response.json();

    if (result.ok) {
      console.log(`✅ Message with keyboard sent successfully to chat ${chatId}`);
      return true;
    } else {
      console.log(`❌ Failed to send message with keyboard to chat ${chatId}:`, result.description);
      return false;
    }
  } catch (error) {
    console.error(`Error sending message with keyboard to chat ${chatId}:`, error);
    return false;
  }
}

// Data file paths
const DATA_FILE = path.join(__dirname, 'data.json');
const ACTIVITY_FILE = path.join(__dirname, 'activity.json');
const INVENTORY_FILE = path.join(__dirname, 'inventory.json');
const USER_STATS_FILE = path.join(__dirname, 'user-stats.json');
const REFERRALS_FILE = path.join(__dirname, 'referrals.json');
const PAYMENT_REQUESTS_FILE = path.join(__dirname, 'payment-requests.json');
const USER_BALANCE_FILE = path.join(__dirname, 'user-balance.json');

// Load data from files or use defaults
function loadData() {
    try {
        if (fs.existsSync(DATA_FILE)) {
            const data = fs.readFileSync(DATA_FILE, 'utf8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.log('Error loading data file, using defaults');
    }

    return [
  {
    id: 9181,
    name: "Pink Flamingo x1 Co...",
    image: "https://i.postimg.cc/Y02HBW8v/IMG-1194.png",
    price: 10,
    quantity: "x1",
    stock: 3,
    tag: "NEW",
    tagColor: "new"
  },
  {
    id: 9180,
    name: "Sand Castle x1",
    image: "🏰",
    price: 3.3,
    quantity: "x1",
    stock: 5,
    tag: "HOT",
    tagColor: "hot"
  },
  {
    id: 9179,
    name: "Sand Castle x1",
    image: "🏰",
    price: 3.68,
    quantity: "x1",
    stock: 2,
    tag: "",
    tagColor: "new"
  },
  {
    id: 9178,
    name: "Eagle x2",
    image: "🦅",
    price: 150,
    quantity: "x2",
    stock: 1,
    tag: "RARE",
    tagColor: "rare"
  },
  {
    id: 7549,
    name: "Case x1",
    image: "💼",
    price: 39,
    quantity: "x1",
    stock: 4,
    tag: "TOP",
    tagColor: "top"
  },
  {
    id: 7539,
    name: "Case x1",
    image: "💼",
    price: 41,
    quantity: "x1",
    stock: 2,
    tag: "SALE",
    tagColor: "sale"
  }
];
}

function loadActivityData() {
    try {
        if (fs.existsSync(ACTIVITY_FILE)) {
            const data = fs.readFileSync(ACTIVITY_FILE, 'utf8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.log('Error loading activity file');
    }
    return [];
}

function loadInventoryData() {
    try {
        if (fs.existsSync(INVENTORY_FILE)) {
            const data = fs.readFileSync(INVENTORY_FILE, 'utf8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.log('Error loading inventory file');
    }
    return [];
}

function saveData(data) {
    try {
        fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
    } catch (error) {
        console.log('Error saving data:', error);
    }
}

function saveActivityData(data) {
    try {
        fs.writeFileSync(ACTIVITY_FILE, JSON.stringify(data, null, 2));
    } catch (error) {
        console.log('Error saving activity:', error);
    }
}

function saveInventoryData(data) {
    try {
        fs.writeFileSync(INVENTORY_FILE, JSON.stringify(data, null, 2));
    } catch (error) {
        console.log('Error saving inventory:', error);
    }
}

function loadUserStatsData() {
    try {
        if (fs.existsSync(USER_STATS_FILE)) {
            const data = fs.readFileSync(USER_STATS_FILE, 'utf8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.log('Error loading user stats file');
    }
    return {};
}

function saveUserStatsData(data) {
    try {
        fs.writeFileSync(USER_STATS_FILE, JSON.stringify(data, null, 2));
    } catch (error) {
        console.log('Error saving user stats:', error);
    }
}

function loadReferralsData() {
    try {
        if (fs.existsSync(REFERRALS_FILE)) {
            const data = fs.readFileSync(REFERRALS_FILE, 'utf8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.log('Error loading referrals file');
    }
    return {};
}

function saveReferralsData(data) {
    try {
        fs.writeFileSync(REFERRALS_FILE, JSON.stringify(data, null, 2));
    } catch (error) {
        console.log('Error saving referrals:', error);
    }
}

function loadPaymentRequestsData() {
    try {
        if (fs.existsSync(PAYMENT_REQUESTS_FILE)) {
            const data = fs.readFileSync(PAYMENT_REQUESTS_FILE, 'utf8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.log('Error loading payment requests file');
    }
    return [];
}

function savePaymentRequestsData(data) {
    try {
        fs.writeFileSync(PAYMENT_REQUESTS_FILE, JSON.stringify(data, null, 2));
    } catch (error) {
        console.log('Error saving payment requests:', error);
    }
}

function loadUserBalanceData() {
    try {
        if (fs.existsSync(USER_BALANCE_FILE)) {
            const data = fs.readFileSync(USER_BALANCE_FILE, 'utf8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.log('Error loading user balance file');
    }
    return {};
}

function saveUserBalanceData(data) {
    try {
        fs.writeFileSync(USER_BALANCE_FILE, JSON.stringify(data, null, 2));
    } catch (error) {
        console.log('Error saving user balance:', error);
    }
}

// Load initial data
let nftItems = loadData();
let activityItems = loadActivityData();
let inventoryItems = loadInventoryData();
let userStatsData = loadUserStatsData();
let referralsData = loadReferralsData();
let paymentRequestsData = loadPaymentRequestsData();
let userBalanceData = loadUserBalanceData();

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/tonconnect-manifest.json', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'tonconnect-manifest.json'));
});

app.get('/api/items', async (req, res) => {
  try {
    const items = await getAllItems();
    res.json(items);
  } catch (error) {
    console.error('Error getting items:', error);
    res.json([]);
  }
});

app.get('/api/activity', (req, res) => {
  res.json(activityItems);
});

app.get('/api/inventory', (req, res) => {
  res.json(inventoryItems);
});

app.get('/api/inventory/:userId', (req, res) => {
  const userId = parseInt(req.params.userId);
  const userInventory = inventoryItems.filter(item => item.userId === userId);
  res.json(userInventory);
});

app.get('/api/user-stats/:userId', (req, res) => {
  const userId = req.params.userId;
  const stats = userStatsData[userId] || {
    totalPurchases: 0,
    totalSpent: 0,
    referralCount: 0,
    referralEarnings: 0
  };
  res.json(stats);
});

app.get('/api/user-balance/:userId', async (req, res) => {
  const userId = req.params.userId;
  try {
    const stars = await getUserBalance(userId);
    res.json({ stars });
  } catch (error) {
    console.error('Error getting user balance:', error);
    res.json({ stars: 0 });
  }
});

// Get payment methods and converted prices for an item
app.get('/api/payment-methods/:itemId', (req, res) => {
  const itemId = parseInt(req.params.itemId);
  const data = loadData();
  const item = data.find(item => item.id === itemId);

  if (!item) {
    return res.status(404).json({ error: 'Item not found' });
  }

  const paymentMethods = [];

  // Check if item has new price format
  if (item.prices) {
    // Add Stars payment method if price is set
    if (item.prices.STARS > 0) {
      paymentMethods.push({
        id: 'STARS',
        name: 'Telegram Stars',
        icon: PAYMENT_METHODS.STARS.icon,
        price: item.prices.STARS,
        contact: PAYMENT_METHODS.STARS.contact
      });
    }

    // Add ЮMoney payment method if price is set
    if (item.prices.RUB > 0) {
      paymentMethods.push({
        id: 'YOOMONEY',
        name: 'ЮMoney (₽)',
        icon: PAYMENT_METHODS.YOOMONEY.icon,
        price: item.prices.RUB,
        wallet: PAYMENT_METHODS.YOOMONEY.wallet
      });
    }

    // Add TON payment method if price is set
    if (item.prices.TON > 0) {
      paymentMethods.push({
        id: 'TON',
        name: 'TON Wallet',
        icon: PAYMENT_METHODS.TON.icon,
        price: item.prices.TON,
        wallet: PAYMENT_METHODS.TON.wallet
      });
    }
  } else {
    // Fallback to old format - convert TON price to other currencies
    const starsPrice = Math.ceil(item.price * CURRENCY_RATES.TON_TO_STARS);
    const rublePrice = Math.ceil(item.price * CURRENCY_RATES.TON_TO_RUBLE);

    paymentMethods.push({
      id: 'STARS',
      name: 'Telegram Stars',
      icon: PAYMENT_METHODS.STARS.icon,
      price: starsPrice,
      contact: PAYMENT_METHODS.STARS.contact
    });

    paymentMethods.push({
      id: 'YOOMONEY',
      name: 'ЮMoney (₽)',
      icon: PAYMENT_METHODS.YOOMONEY.icon,
      price: rublePrice,
      wallet: PAYMENT_METHODS.YOOMONEY.wallet
    });

    paymentMethods.push({
      id: 'TON',
      name: 'TON Wallet',
      icon: PAYMENT_METHODS.TON.icon,
      price: item.price,
      wallet: PAYMENT_METHODS.TON.wallet
    });
  }

  res.json({ paymentMethods });
});

// Add new item (admin only)
app.post('/api/items', (req, res) => {
  const newItem = req.body;

  // Check if item with same ID exists
  if (nftItems.find(item => item.id === newItem.id)) {
    return res.status(400).json({ error: 'Item with this ID already exists' });
  }

  nftItems.push(newItem);
  saveData(nftItems);
  res.json({ success: true });
});

// Update item (admin only)
app.put('/api/items/:id', (req, res) => {
  const itemId = parseInt(req.params.id);
  const updatedItem = req.body;

  const itemIndex = nftItems.findIndex(item => item.id === itemId);
  if (itemIndex === -1) {
    return res.status(404).json({ error: 'Item not found' });
  }

  nftItems[itemIndex] = { ...nftItems[itemIndex], ...updatedItem };
  saveData(nftItems);
  res.json({ success: true });
});

// Delete item (admin only)
app.delete('/api/items/:id', (req, res) => {
  const itemId = parseInt(req.params.id);

  const itemIndex = nftItems.findIndex(item => item.id === itemId);
  if (itemIndex === -1) {
    return res.status(404).json({ error: 'Item not found' });
  }

  nftItems.splice(itemIndex, 1);
  saveData(nftItems);
  res.json({ success: true });
});

// Buy item
app.post('/api/buy/:id', (req, res) => {
  const itemId = parseInt(req.params.id);
  const { userId, username, referrerId } = req.body;

  const item = nftItems.find(nft => nft.id === itemId);
  if (!item || item.stock <= 0) {
    return res.status(400).json({ error: 'Item not available' });
  }

  // Decrease stock
  item.stock -= 1;

  // Remove item if stock is 0
  if (item.stock === 0) {
    nftItems = nftItems.filter(nft => nft.id !== itemId);
  }

  saveData(nftItems);

  // Update user stats
  if (!userStatsData[userId]) {
    userStatsData[userId] = {
      totalPurchases: 0,
      totalSpent: 0,
      referralCount: 0,
      referralEarnings: 0
    };
  }

  userStatsData[userId].totalPurchases += 1;
  userStatsData[userId].totalSpent += item.price;

  // Handle referral earnings
  if (referrerId && referrerId !== userId) {
    const referralEarning = item.price * 0.25; // 25% commission

    if (!userStatsData[referrerId]) {
      userStatsData[referrerId] = {
        totalPurchases: 0,
        totalSpent: 0,
        referralCount: 0,
        referralEarnings: 0
      };
    }

    userStatsData[referrerId].referralEarnings += referralEarning;

    // Track referral relationship
    if (!referralsData[referrerId]) {
      referralsData[referrerId] = [];
    }

    if (!referralsData[referrerId].includes(userId)) {
      referralsData[referrerId].push(userId);
      userStatsData[referrerId].referralCount = referralsData[referrerId].length;
    }

    saveReferralsData(referralsData);
  }

  saveUserStatsData(userStatsData);

  // Add to activity
  const activityItem = {
    id: item.id,
    name: item.name,
    image: item.image,
    price: item.price,
    prices: item.prices, // Сохраняем объект цен
    convertedPrice: convertedPrice, // Сохраняем реальную оплаченную цену
    userId: userId,
    username: username,
    date: new Date().toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit', 
      year: 'numeric'
    }),
    time: new Date().toLocaleTimeString('ru-RU', {
      hour: '2-digit',
      minute: '2-digit'
    })
  };

  // Add to inventory with unique inventory ID
  const inventoryItem = {
    inventoryId: Date.now() + Math.random(), // Unique inventory ID
    id: item.id,
    name: item.name,
    image: item.image,
    price: item.price,
    prices: item.prices, // Сохраняем объект цен
    convertedPrice: convertedPrice, // Сохраняем реальную оплаченную цену
    quantity: item.quantity,
    owner: 'UQDy...liDW',
    userId: userId,
    username: username || 'user',
    nickname: null,
    status: 'Редкий',
    createdAt: new Date().toISOString()
  };

  inventoryItems.push(inventoryItem);
  activityItems.unshift(activityItem);

  saveActivityData(activityItems);
  saveInventoryData(inventoryItems);

  res.json({ success: true });
});

// Purchase with balance endpoint
app.post('/api/purchase-with-balance', (req, res) => {
  const { itemId, userId, username, starsPrice, referrerId } = req.body;

  const item = nftItems.find(nft => nft.id === itemId);
  if (!item || item.stock <= 0) {
    return res.status(400).json({ error: 'Товар недоступен или распродан' });
  }

  // Check user balance
  const userBalance = userBalanceData[userId] || { stars: 0 };
  if (userBalance.stars < starsPrice) {
    return res.status(400).json({ error: 'Недостаточно Stars на балансе' });
  }

  // Decrease user balance
  userBalance.stars -= starsPrice;
  userBalanceData[userId] = userBalance;
  saveUserBalanceData(userBalanceData);

  // Decrease item stock
  item.stock -= 1;
  if (item.stock === 0) {
    nftItems = nftItems.filter(nft => nft.id !== itemId);
  }
  saveData(nftItems);

  // Update user stats
  if (!userStatsData[userId]) {
    userStatsData[userId] = {
      totalPurchases: 0,
      totalSpent: 0,
      referralCount: 0,
      referralEarnings: 0
    };
  }

  const tonEquivalent = starsPrice / 100; // 100 stars = 1 TON
  userStatsData[userId].totalPurchases += 1;
  userStatsData[userId].totalSpent += tonEquivalent;

  // Handle referral earnings
  if (referrerId && referrerId !== userId) {
    const referralEarning = tonEquivalent * 0.25;

    if (!userStatsData[referrerId]) {
      userStatsData[referrerId] = {
        totalPurchases: 0,
        totalSpent: 0,
        referralCount: 0,
        referralEarnings: 0
      };
    }

    userStatsData[referrerId].referralEarnings += referralEarning;

    if (!referralsData[referrerId]) {
      referralsData[referrerId] = [];
    }

    if (!referralsData[referrerId].includes(userId)) {
      referralsData[referrerId].push(userId);
      userStatsData[referrerId].referralCount = referralsData[referrerId].length;
    }

    saveReferralsData(referralsData);
  }

  saveUserStatsData(userStatsData);

  // Add to activity
  const activityItem = {
    id: item.id,
    name: item.name,
    image: item.image,
    price: tonEquivalent,
    convertedPrice: starsPrice,
    userId: userId,
    username: username,
    date: new Date().toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit', 
      year: 'numeric'
    }),
    time: new Date().toLocaleTimeString('ru-RU', {
      hour: '2-digit',
      minute: '2-digit'
    })
  };

  // Add to inventory
  const inventoryItem = {
    inventoryId: Date.now() + Math.random(),
    id: item.id,
    name: item.name,
    image: item.image,
    price: tonEquivalent,
    convertedPrice: starsPrice,
    quantity: item.quantity,
    owner: '@' + username,
    userId: userId,
    username: username,
    nickname: null,
    status: 'Редкий',
    createdAt: new Date().toISOString()
  };

  inventoryItems.push(inventoryItem);
  activityItems.unshift(activityItem);

  saveActivityData(activityItems);
  saveInventoryData(inventoryItems);

  res.json({ 
    success: true, 
    newBalance: userBalance.stars,
    message: 'Покупка успешна!'
  });
});

// Top up request endpoint
app.post('/api/topup-request', (req, res) => {
  const { userId, username, amount, type } = req.body;

  const topUpRequest = {
    id: Date.now().toString(),
    userId: parseInt(userId),
    username: username,
    amount: parseInt(amount),
    type: type || 'stars_topup',
    status: 'pending',
    date: new Date().toISOString()
  };

  paymentRequestsData.push(topUpRequest);
  savePaymentRequestsData(paymentRequestsData);

  res.json({ success: true });
});

// Payment request endpoints
app.post('/api/payment-request', (req, res) => {
  const { itemId, userId, username, price, itemName, itemImage, referrerId, paymentMethod, convertedPrice } = req.body;

  const paymentRequest = {
    id: Date.now().toString(),
    itemId: parseInt(itemId),
    userId: parseInt(userId),
    username: username,
    price: price,
    convertedPrice: convertedPrice || price,
    paymentMethod: paymentMethod || 'TON',
    itemName: itemName,
    itemImage: itemImage,
    referrerId: referrerId,
    status: 'pending',
    date: new Date().toISOString()
  };

  paymentRequestsData.push(paymentRequest);
  savePaymentRequestsData(paymentRequestsData);

  res.json({ success: true });
});

app.get('/api/payment-requests', (req, res) => {
  const pendingRequests = paymentRequestsData.filter(request => request.status === 'pending');
  res.json(pendingRequests);
});

app.post('/api/payment-request/:id/approve', (req, res) => {
  const requestId = req.params.id;
  const request = paymentRequestsData.find(r => r.id === requestId);

  if (!request) {
    return res.status(404).json({ error: 'Payment request not found' });
  }

  // Mark request as approved
  request.status = 'approved';

  // Find the item
  const item = nftItems.find(nft => nft.id === request.itemId);
  if (item && item.stock > 0) {
    // Decrease stock
    item.stock -= 1;

    // Remove item if stock is 0
    if (item.stock === 0) {
      nftItems = nftItems.filter(nft => nft.id !== request.itemId);
    }

    saveData(nftItems);

    // Update user stats
    if (!userStatsData[request.userId]) {
      userStatsData[request.userId] = {
        totalPurchases: 0,
        totalSpent: 0,
        referralCount: 0,
        referralEarnings: 0
      };
    }

    userStatsData[request.userId].totalPurchases += 1;
    userStatsData[request.userId].totalSpent += request.price;

    // Handle referral earnings
    if (request.referrerId && request.referrerId !== request.userId) {
      const referralEarning = request.price * 0.25; // 25% commission

      if (!userStatsData[request.referrerId]) {
        userStatsData[request.referrerId] = {
          totalPurchases: 0,
          totalSpent: 0,
          referralCount: 0,
          referralEarnings: 0
        };
      }

      userStatsData[request.referrerId].referralEarnings += referralEarning;

      // Track referral relationship
      if (!referralsData[request.referrerId]) {
        referralsData[request.referrerId] = [];
      }

      if (!referralsData[request.referrerId].includes(request.userId)) {
        referralsData[request.referrerId].push(request.userId);
        userStatsData[request.referrerId].referralCount = referralsData[request.referrerId].length;
      }

      saveReferralsData(referralsData);
    }

    saveUserStatsData(userStatsData);

    // Add to activity
    const activityItem = {
      id: request.itemId,
      name: request.itemName,
      image: request.itemImage,
      price: request.price,
      userId: request.userId,
      username: request.username,
      date: new Date().toLocaleDateString('ru-RU', {
        day: '2-digit',
        month: '2-digit', 
        year: 'numeric'
      }),
      time: new Date().toLocaleTimeString('ru-RU', {
        hour: '2-digit',
        minute: '2-digit'
      })
    };

    // Add to inventory
    const inventoryItem = {
      inventoryId: Date.now() + Math.random(), // Unique inventory ID
      id: request.itemId,
      name: request.itemName,
      image: request.itemImage,
      price: request.price,
      quantity: item.quantity,
      owner: 'UQDy...liDW',
      userId: request.userId,
      username: request.username,
      nickname: null,
      status: 'Редкий',
      createdAt: new Date().toISOString()
    };

    inventoryItems.push(inventoryItem);
    activityItems.unshift(activityItem);

    saveActivityData(activityItems);
    saveInventoryData(inventoryItems);
  }

  savePaymentRequestsData(paymentRequestsData);
  res.json({ success: true });
});

app.post('/api/topup-request/:id/approve', (req, res) => {
  const requestId = req.params.id;
  const request = paymentRequestsData.find(r => r.id === requestId && r.type === 'stars_topup');

  if (!request) {
    return res.status(404).json({ error: 'Top up request not found' });
  }

  // Mark request as approved
  request.status = 'approved';
  savePaymentRequestsData(paymentRequestsData);

  // Update user balance
  if (!userBalanceData[request.userId]) {
    userBalanceData[request.userId] = { stars: 0 };
  }

  userBalanceData[request.userId].stars += request.amount;
  saveUserBalanceData(userBalanceData);

  console.log(`Approved top up of ${request.amount} Stars for user ${request.username}. New balance: ${userBalanceData[request.userId].stars}`);

  // Send notification to user
  const message = `💰 <b>Пополнение баланса подтверждено!</b>\n\n` +
    `⭐ Начислено: ${request.amount} Stars\n` +
    `💳 Текущий баланс: ${userBalanceData[request.userId].stars} Stars\n\n` +
    `Теперь вы можете покупать подарки с баланса! 🎁`;

  sendTelegramMessage(request.userId, message)
    .then(sent => {
      if (sent) {
        console.log(`📨 Balance notification sent to user ${request.username}`);
      }
    })
    .catch(error => {
      console.error(`Error sending balance notification:`, error);
    });

  res.json({ success: true });
});

app.post('/api/payment-request/:id/reject', (req, res) => {
  const requestId = req.params.id;
  const request = paymentRequestsData.find(r => r.id === requestId);

  if (!request) {
    return res.status(404).json({ error: 'Payment request not found' });
  }

  // Mark request as rejected
  request.status = 'rejected';
  savePaymentRequestsData(paymentRequestsData);

  res.json({ success: true });
});

// Update username endpoint
app.post('/api/update-username', (req, res) => {
  const { userId, oldUsername, newUsername } = req.body;

  if (!userId || !newUsername) {
    return res.status(400).json({ error: 'Missing required data' });
  }

  const userIdInt = parseInt(userId);
  let updated = false;

  // Update username in inventory
  inventoryItems.forEach(item => {
    if (item.userId === userIdInt) {
      if (oldUsername && item.username && item.username.toLowerCase() === oldUsername.toLowerCase()) {
        item.username = newUsername;
        updated = true;
      } else if (!item.username || item.username === 'user') {
        item.username = newUsername;
        updated = true;
      }
    }
  });

  // Update username in activity
  activityItems.forEach(item => {
    if (item.userId === userIdInt) {
      if (oldUsername && item.username && item.username.toLowerCase() === oldUsername.toLowerCase()) {
        item.username = newUsername;
        updated = true;
      } else if (!item.username || item.username === 'user') {
        item.username = newUsername;
        updated = true;
      }
    }
  });

  if (updated) {
    saveInventoryData(inventoryItems);
    saveActivityData(activityItems);
    console.log(`Username updated from ${oldUsername} to ${newUsername} for user ${userId}`);
  }

  res.json({ success: true, updated });
});

// Transfer item endpoint
app.post('/api/transfer-item', (req, res) => {
  const { itemId, fromUserId, fromUsername, toUsername, comment, item } = req.body;

  console.log(`Transfer request: ${fromUsername} -> ${toUsername}, item: ${itemId}, fromUserId: ${fromUserId}`);
  console.log('Current inventory items for user:', inventoryItems.filter(invItem => invItem.userId === parseInt(fromUserId)));

  // Validate input data
  if (!item || !item.id || !item.name || !fromUserId || !fromUsername || !toUsername) {
    console.log('Missing required data in request');
    return res.status(400).json({ error: 'Отсутствуют обязательные данные для передачи' });
  }

  // Validate username format
  const cleanToUsername = toUsername.trim().replace('@', '');
  const cleanFromUsername = fromUsername.trim().replace('@', '');

  if (!cleanToUsername || cleanToUsername.length === 0) {
    return res.status(400).json({ error: 'Введите корректное имя пользователя' });
  }

  // Check if trying to send to self
  if (cleanFromUsername.toLowerCase() === cleanToUsername.toLowerCase()) {
    return res.status(400).json({ error: 'Нельзя передать подарок самому себе' });
  }

  // Список известных пользователей бота
  const knownUsers = {
    'caps_durova': 7867539237,
    'watch_durova': 7789155034,
    'mem_otc': 1948801972,
    'metagift_support': 7867539237
  };

  // Расширенный поиск пользователя в системе
  function findUserInSystem(username) {
    const lowerUsername = username.toLowerCase().replace('@', '');
    
    console.log(`Searching for user: "${lowerUsername}"`);

    // 1. Проверяем известных пользователей
    if (knownUsers[lowerUsername]) {
      console.log(`Found in known users: ${knownUsers[lowerUsername]}`);
      return {
        found: true,
        userId: knownUsers[lowerUsername],
        source: 'known_users'
      };
    }

    // 2. Ищем в инвентаре (точное совпадение)
    const inventoryUser = inventoryItems.find(item => 
      item.username && item.username.toLowerCase().replace('@', '') === lowerUsername
    );
    if (inventoryUser) {
      console.log(`Found in inventory: ${inventoryUser.userId}`);
      return {
        found: true,
        userId: inventoryUser.userId,
        source: 'inventory'
      };
    }

    // 3. Ищем в активности (точное совпадение)
    const activityUser = activityItems.find(item => 
      item.username && item.username.toLowerCase().replace('@', '') === lowerUsername
    );
    if (activityUser) {
      console.log(`Found in activity: ${activityUser.userId}`);
      return {
        found: true,
        userId: activityUser.userId,
        source: 'activity'
      };
    }

    // 4. Поиск по частичному совпадению в инвентаре
    const inventoryUserPartial = inventoryItems.find(item => 
      item.username && item.username.toLowerCase().replace('@', '').includes(lowerUsername)
    );
    if (inventoryUserPartial) {
      console.log(`Found partial match in inventory: ${inventoryUserPartial.userId}`);
      return {
        found: true,
        userId: inventoryUserPartial.userId,
        source: 'inventory_partial'
      };
    }

    // 5. Поиск по частичному совпадению в активности
    const activityUserPartial = activityItems.find(item => 
      item.username && item.username.toLowerCase().replace('@', '').includes(lowerUsername)
    );
    if (activityUserPartial) {
      console.log(`Found partial match in activity: ${activityUserPartial.userId}`);
      return {
        found: true,
        userId: activityUserPartial.userId,
        source: 'activity_partial'
      };
    }

    // 6. Ищем в статистике пользователей
    for (const userId in userStatsData) {
      // Попробуем найти пользователя по ID в инвентаре или активности
      const userInInventory = inventoryItems.find(item => item.userId === parseInt(userId));
      const userInActivity = activityItems.find(item => item.userId === parseInt(userId));

      if (userInInventory && userInInventory.username && 
          userInInventory.username.toLowerCase().replace('@', '') === lowerUsername) {
        console.log(`Found in stats via inventory: ${userId}`);
        return {
          found: true,
          userId: parseInt(userId),
          source: 'stats_inventory'
        };
      }

      if (userInActivity && userInActivity.username && 
          userInActivity.username.toLowerCase().replace('@', '') === lowerUsername) {
        console.log(`Found in stats via activity: ${userId}`);
        return {
          found: true,
          userId: parseInt(userId),
          source: 'stats_activity'
        };
      }
    }

    // 7. Последняя попытка - поиск среди всех уникальных пользователей
    const allUsers = new Set();
    
    inventoryItems.forEach(item => {
      if (item.username && item.userId) {
        allUsers.add(JSON.stringify({
          username: item.username.toLowerCase().replace('@', ''),
          userId: item.userId
        }));
      }
    });
    
    activityItems.forEach(item => {
      if (item.username && item.userId) {
        allUsers.add(JSON.stringify({
          username: item.username.toLowerCase().replace('@', ''),
          userId: item.userId
        }));
      }
    });

    for (const userStr of allUsers) {
      const user = JSON.parse(userStr);
      if (user.username.includes(lowerUsername) || lowerUsername.includes(user.username)) {
        console.log(`Found fuzzy match: ${user.userId} for username ${user.username}`);
        return {
          found: true,
          userId: user.userId,
          source: 'fuzzy_match'
        };
      }
    }

    console.log(`User not found: "${lowerUsername}"`);
    console.log('Available users in inventory:', inventoryItems.map(item => ({username: item.username, userId: item.userId})));
    console.log('Available users in activity:', activityItems.map(item => ({username: item.username, userId: item.userId})));
    
    return { found: false };
  }

  const userSearch = findUserInSystem(cleanToUsername);

  let recipientUserId;
  
  if (userSearch.found) {
    recipientUserId = userSearch.userId;
    console.log(`Найден получатель: ${cleanToUsername}, ID: ${userSearch.userId}, источник: ${userSearch.source}`);
  } else {
    // Если пользователь не найден в системе, создаем временный ID на основе username
    // Это позволит передавать подарки любым пользователям Telegram
    recipientUserId = `temp_${cleanToUsername}_${Date.now()}`;
    console.log(`Пользователь ${cleanToUsername} не найден в системе, создаем временную запись с ID: ${recipientUserId}`);
  }

  try {
    // Find the item in sender's inventory with better matching
    let inventoryItemIndex = -1;
    const fromUserIdInt = parseInt(fromUserId);

    console.log(`Starting search for item: inventoryId=${item.inventoryId}, id=${item.id}, name="${item.name}", fromUserId=${fromUserIdInt}`);
    console.log('All inventory items for user:', inventoryItems.filter(invItem => invItem.userId === fromUserIdInt));

    // First try to find by inventoryId if available - this is the most reliable method
    if (item.inventoryId) {
      inventoryItemIndex = inventoryItems.findIndex(invItem => 
        invItem.inventoryId === item.inventoryId && invItem.userId === fromUserIdInt
      );
      console.log(`Looking for item by inventoryId: ${item.inventoryId}, found at index: ${inventoryItemIndex}`);
    }

    // If not found by inventoryId, try by multiple criteria with exact matching
    if (inventoryItemIndex === -1) {
      inventoryItemIndex = inventoryItems.findIndex(invItem => {
        const userMatch = invItem.userId === fromUserIdInt;
        const idMatch = invItem.id === parseInt(itemId);
        const nameMatch = invItem.name === item.name;
        const priceMatch = Math.abs(invItem.price - item.price) < 0.01;

        console.log(`Checking item ${invItem.inventoryId}: user=${userMatch}, id=${idMatch}, name=${nameMatch}, price=${priceMatch}`);

        return userMatch && idMatch && nameMatch && priceMatch;
      });
      console.log(`Looking for item by criteria, found at index: ${inventoryItemIndex}`);
    }

    // If still not found, try by exact name and user match
    if (inventoryItemIndex === -1) {
      inventoryItemIndex = inventoryItems.findIndex(invItem => 
        invItem.userId === fromUserIdInt && 
        invItem.name === item.name &&
        invItem.id === parseInt(itemId)
      );
      console.log(`Looking for item by userId, name and id, found at index: ${inventoryItemIndex}`);
    }

    if (inventoryItemIndex === -1) {
      console.log('Item not found in sender inventory');
      console.log('Available items for user:', inventoryItems.filter(invItem => invItem.userId === fromUserIdInt));
      return res.status(404).json({ error: 'Предмет не найден в вашем инвентаре' });
    }

    // Get the item to transfer
    const transferredItem = inventoryItems[inventoryItemIndex];
    console.log('Found item to transfer:', transferredItem);

    // Create backup before making changes
    const inventoryBackup = [...inventoryItems];

    // Create new inventory item for recipient
    const newInventoryItem = {
      inventoryId: Date.now() + Math.random(),
      id: transferredItem.id,
      name: transferredItem.name,
      image: transferredItem.image,
      price: transferredItem.price,
      convertedPrice: transferredItem.convertedPrice, // Сохраняем реальную оплаченную цену
      prices: transferredItem.prices, // Сохраняем объект цен
      quantity: transferredItem.quantity,
      owner: `@${cleanToUsername}`,
      userId: recipientUserId,
      username: cleanToUsername,
      nickname: null,
      status: transferredItem.status || 'Редкий',
      comment: comment && comment.trim() ? comment.trim() : null,
      transferDate: new Date().toISOString(),
      fromUsername: cleanFromUsername,
      originalOwner: transferredItem.originalOwner || transferredItem.owner,
      transferHistory: [...(transferredItem.transferHistory || [])],
      createdAt: transferredItem.createdAt || new Date().toISOString()
    };

    // Add transfer to history
    newInventoryItem.transferHistory.push({
      from: cleanFromUsername,
      to: cleanToUsername,
      date: new Date().toISOString(),
      comment: comment || null
    });

    console.log('Creating new inventory item:', newInventoryItem);

    // Remove item from sender
    inventoryItems.splice(inventoryItemIndex, 1);
    console.log('Removed item from sender');

    // Add item to recipient
    inventoryItems.push(newInventoryItem);
    console.log('Added item to recipient');

    // Save the changes
    try {
      saveInventoryData(inventoryItems);
      console.log('Inventory data saved successfully');

      // Force reload the inventory data from file to ensure consistency
      inventoryItems = loadInventoryData();

      // Verify the transfer was successful
      const recipientHasItem = inventoryItems.some(item => 
        item.userId === recipientUserId && 
        item.name === transferredItem.name &&
        item.fromUsername === cleanFromUsername &&
        item.transferDate === newInventoryItem.transferDate
      );

      const senderStillHasItem = inventoryItems.some(item => 
        item.userId === fromUserIdInt && 
        item.inventoryId === transferredItem.inventoryId
      );

      console.log(`Verification - Recipient has item: ${recipientHasItem}, Sender still has item: ${senderStillHasItem}`);

      if (!recipientHasItem) {
        console.error('Transfer verification failed: recipient did not receive item');
        throw new Error('Ошибка передачи: получатель не получил предмет');
      }

      if (senderStillHasItem) {
        console.error('Transfer verification failed: sender still has item');
        // Try to remove the duplicate item
        const duplicateIndex = inventoryItems.findIndex(item => 
          item.userId === fromUserIdInt && 
          item.inventoryId === transferredItem.inventoryId
        );
        if (duplicateIndex !== -1) {
          inventoryItems.splice(duplicateIndex, 1);
          saveInventoryData(inventoryItems);
          console.log('Removed duplicate item from sender');
        }
      }

      console.log(`✅ Transfer successful: "${transferredItem.name}" from ${cleanFromUsername} to ${cleanToUsername}`);

      // Отправляем уведомление получателю
      const giftMessage = `🎁 <b>Вы получили подарок!</b>\n\n` +
        `📦 <b>${transferredItem.name}</b>\n` +
        `💰 Стоимость: ${transferredItem.price} TON\n` +
        `👤 От: @${cleanFromUsername}\n` +
        (comment ? `💬 Сообщение: "${comment}"\n\n` : '\n') +
        `Подарок добавлен в ваш инвентарь! 🎒`;

      // Отправляем сообщение получателю только если это не временный ID
      if (typeof recipientUserId === 'number') {
        sendTelegramMessage(recipientUserId, giftMessage)
          .then(sent => {
            if (sent) {
              console.log(`📨 Notification sent to recipient ${cleanToUsername}`);
            } else {
              console.log(`⚠️ Failed to send notification to recipient ${cleanToUsername}`);
            }
          })
          .catch(error => {
            console.error(`Error sending notification to ${cleanToUsername}:`, error);
          });
      } else {
        console.log(`📝 Подарок передан новому пользователю ${cleanToUsername}, уведомление будет отправлено когда пользователь зайдет в бот`);
      }

      res.json({ 
        success: true, 
        message: `Подарок "${transferredItem.name}" успешно передан пользователю @${cleanToUsername}`,
        recipientUserId: recipientUserId,
        transferredItem: newInventoryItem
      });

    } catch (saveError) {
      console.error('Error saving inventory data:', saveError);
      // Restore backup
      inventoryItems.length = 0;
      inventoryItems.push(...inventoryBackup);
      return res.status(500).json({ error: 'Ошибка при сохранении данных. Передача отменена.' });
    }

  } catch (error) {
    console.error('Error during transfer:', error);
    res.status(500).json({ error: 'Произошла ошибка при передаче подарка. Попробуйте еще раз.' });
  }
});

// Set webhook endpoint (call once to setup)
app.get('/set-webhook', async (req, res) => {
  if (!BOT_TOKEN || BOT_TOKEN === 'YOUR_BOT_TOKEN_HERE') {
    return res.status(400).json({ error: 'Bot token not configured' });
  }

  try {
    const webhookUrl = `https://metagift-market.replit.app/webhook`;
    const url = `https://api.telegram.org/bot${BOT_TOKEN}/setWebhook`;
    
    console.log('Setting webhook to:', webhookUrl);
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: webhookUrl,
        allowed_updates: ["message"]
      })
    });

    const result = await response.json();
    console.log('Webhook response:', result);
    
    if (result.ok) {
      console.log('✅ Webhook set successfully to:', webhookUrl);
      res.json({ 
        success: true, 
        message: 'Webhook set successfully',
        webhook_url: webhookUrl,
        result: result
      });
    } else {
      console.log('❌ Failed to set webhook:', result.description);
      res.status(400).json({ 
        error: result.description,
        full_response: result
      });
    }
  } catch (error) {
    console.error('Error setting webhook:', error);
    res.status(500).json({ error: 'Failed to set webhook', details: error.message });
  }
});

// Get webhook info endpoint
app.get('/webhook-info', async (req, res) => {
  if (!BOT_TOKEN || BOT_TOKEN === 'YOUR_BOT_TOKEN_HERE') {
    return res.status(400).json({ error: 'Bot token not configured' });
  }

  try {
    const url = `https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo`;
    
    const response = await fetch(url);
    const result = await response.json();
    
    console.log('Current webhook info:', result);
    res.json(result);
  } catch (error) {
    console.error('Error getting webhook info:', error);
    res.status(500).json({ error: 'Failed to get webhook info' });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
  console.log('Bot token configured:', BOT_TOKEN ? 'Yes' : 'No');
  console.log('To set webhook, visit: https://metagift-market.replit.app/set-webhook');
  console.log('To check webhook, visit: https://metagift-market.replit.app/webhook-info');
});