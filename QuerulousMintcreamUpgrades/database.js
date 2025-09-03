
const { Client } = require('pg');

// Database connection
const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Initialize database tables
async function initializeDatabase() {
  try {
    await client.connect();
    console.log('Connected to PostgreSQL');

    // Create tables
    await client.query(`
      CREATE TABLE IF NOT EXISTS items (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        image TEXT,
        description TEXT,
        price_ton DECIMAL(10,4),
        price_stars INTEGER,
        price_rub INTEGER,
        quantity VARCHAR(50),
        stock INTEGER DEFAULT 0,
        tag VARCHAR(50),
        tag_color VARCHAR(50),
        status VARCHAR(50),
        status_color VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS user_balances (
        user_id BIGINT PRIMARY KEY,
        stars INTEGER DEFAULT 0,
        username VARCHAR(255),
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS user_stats (
        user_id BIGINT PRIMARY KEY,
        total_purchases INTEGER DEFAULT 0,
        total_spent DECIMAL(10,4) DEFAULT 0,
        referral_count INTEGER DEFAULT 0,
        referral_earnings DECIMAL(10,4) DEFAULT 0,
        username VARCHAR(255),
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS inventory (
        inventory_id BIGSERIAL PRIMARY KEY,
        item_id INTEGER,
        user_id BIGINT NOT NULL,
        username VARCHAR(255),
        item_name VARCHAR(255),
        item_image TEXT,
        price_paid DECIMAL(10,4),
        converted_price INTEGER,
        quantity VARCHAR(50),
        owner_display VARCHAR(255),
        status VARCHAR(50),
        comment TEXT,
        transfer_date TIMESTAMP,
        from_username VARCHAR(255),
        original_owner VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS activity (
        id SERIAL PRIMARY KEY,
        item_id INTEGER,
        user_id BIGINT NOT NULL,
        username VARCHAR(255),
        item_name VARCHAR(255),
        item_image TEXT,
        price_paid DECIMAL(10,4),
        converted_price INTEGER,
        activity_type VARCHAR(50) DEFAULT 'purchase',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS payment_requests (
        id VARCHAR(255) PRIMARY KEY,
        item_id INTEGER,
        user_id BIGINT NOT NULL,
        username VARCHAR(255),
        price DECIMAL(10,4),
        converted_price INTEGER,
        payment_method VARCHAR(50),
        item_name VARCHAR(255),
        item_image TEXT,
        referrer_id BIGINT,
        amount INTEGER,
        request_type VARCHAR(50) DEFAULT 'purchase',
        status VARCHAR(50) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS referrals (
        referrer_id BIGINT NOT NULL,
        referred_id BIGINT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (referrer_id, referred_id)
      );
    `);

    console.log('✅ Database tables initialized successfully');
  } catch (error) {
    console.error('❌ Error initializing database:', error);
  }
}

// Database helper functions
async function getUserBalance(userId) {
  try {
    const result = await client.query('SELECT stars FROM user_balances WHERE user_id = $1', [userId]);
    return result.rows[0] ? result.rows[0].stars : 0;
  } catch (error) {
    console.error('Error getting user balance:', error);
    return 0;
  }
}

async function updateUserBalance(userId, stars, username) {
  try {
    await client.query(`
      INSERT INTO user_balances (user_id, stars, username) 
      VALUES ($1, $2, $3) 
      ON CONFLICT (user_id) 
      DO UPDATE SET stars = $2, username = $3, updated_at = CURRENT_TIMESTAMP
    `, [userId, stars, username]);
  } catch (error) {
    console.error('Error updating user balance:', error);
  }
}

async function getUserStats(userId) {
  try {
    const result = await client.query('SELECT * FROM user_stats WHERE user_id = $1', [userId]);
    return result.rows[0] || {
      total_purchases: 0,
      total_spent: 0,
      referral_count: 0,
      referral_earnings: 0
    };
  } catch (error) {
    console.error('Error getting user stats:', error);
    return { total_purchases: 0, total_spent: 0, referral_count: 0, referral_earnings: 0 };
  }
}

async function getAllItems() {
  try {
    const result = await client.query('SELECT * FROM items ORDER BY created_at DESC');
    return result.rows.map(row => ({
      id: row.id,
      name: row.name,
      image: row.image,
      description: row.description,
      price: row.price_ton,
      prices: {
        TON: row.price_ton,
        STARS: row.price_stars,
        RUB: row.price_rub
      },
      quantity: row.quantity,
      stock: row.stock,
      tag: row.tag,
      tagColor: row.tag_color,
      status: row.status,
      statusColor: row.status_color
    }));
  } catch (error) {
    console.error('Error getting items:', error);
    return [];
  }
}

module.exports = {
  client,
  initializeDatabase,
  getUserBalance,
  updateUserBalance,
  getUserStats,
  getAllItems
};
