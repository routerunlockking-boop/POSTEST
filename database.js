const { Pool } = require('pg');

// Global variable to cache the database connection
let pool = null;

const connectDB = async () => {
    if (pool) {
        console.log('Using cached Supabase connection');
        return pool;
    }

    try {
        const connectionString = process.env.DATABASE_URL;
        pool = new Pool({
            connectionString,
            ssl: {
                rejectUnauthorized: false // Required for Supabase
            }
        });

        // Test the connection
        const client = await pool.connect();
        console.log('Connected to Supabase PostgreSQL database');
        client.release();
        
        return pool;
    } catch (err) {
        console.error('Error connecting to Supabase:', err.message);
        throw err;
    }
};

// Helper function to execute queries
const query = async (text, params) => {
    const client = await pool.connect();
    try {
        const result = await client.query(text, params);
        return result;
    } finally {
        client.release();
    }
};

// Initialize database tables
const initializeDatabase = async () => {
    try {
        // Create users table
        await query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                email VARCHAR(255) UNIQUE NOT NULL,
                password VARCHAR(255) NOT NULL,
                business_name VARCHAR(255) NOT NULL,
                whatsapp_number VARCHAR(50),
                marketplace_enabled BOOLEAN DEFAULT false,
                role VARCHAR(50) DEFAULT 'user',
                is_active BOOLEAN DEFAULT false,
                delete_request BOOLEAN DEFAULT false,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Create products table
        await query(`
            CREATE TABLE IF NOT EXISTS products (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                name VARCHAR(255) NOT NULL,
                quantity INTEGER DEFAULT 0,
                barcode VARCHAR(255) DEFAULT '',
                cost_price DECIMAL(10,2) DEFAULT 0.00,
                price DECIMAL(10,2) DEFAULT 0.00,
                image TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Create invoices table
        await query(`
            CREATE TABLE IF NOT EXISTS invoices (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                invoice_number VARCHAR(255) NOT NULL,
                date VARCHAR(10) NOT NULL,
                time VARCHAR(5) NOT NULL,
                customer_name VARCHAR(255) DEFAULT '',
                customer_phone VARCHAR(50) DEFAULT '',
                cashier_name VARCHAR(255) DEFAULT 'System',
                payment_method VARCHAR(50) DEFAULT 'Cash',
                total_amount DECIMAL(10,2) DEFAULT 0.00,
                amount_paid DECIMAL(10,2) DEFAULT 0.00,
                total_profit DECIMAL(10,2) DEFAULT 0.00,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Create invoice_items table
        await query(`
            CREATE TABLE IF NOT EXISTS invoice_items (
                id SERIAL PRIMARY KEY,
                invoice_id INTEGER REFERENCES invoices(id) ON DELETE CASCADE,
                product_name VARCHAR(255) NOT NULL,
                quantity INTEGER NOT NULL,
                cost_price DECIMAL(10,2) DEFAULT 0.00,
                price DECIMAL(10,2) NOT NULL,
                subtotal DECIMAL(10,2) NOT NULL,
                profit DECIMAL(10,2) DEFAULT 0.00,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Create default admin user
        const adminExists = await query('SELECT * FROM users WHERE role = $1', ['admin']);
        if (adminExists.rows.length === 0) {
            await query(`
                INSERT INTO users (email, password, business_name, role, is_active)
                VALUES ($1, $2, $3, $4, $5)
            `, ['smartzonelk101@gmail.com', '200723800385@', 'SMART ZONE', 'admin', true]);
            console.log('Admin user created.');
        } else {
            await query(`
                UPDATE users 
                SET email = $1, password = $2, business_name = $3, role = $4, is_active = $5
                WHERE id = $6
            `, ['smartzonelk101@gmail.com', '200723800385@', 'SMART ZONE', 'admin', true, adminExists.rows[0].id]);
            console.log('Admin credentials updated for existing admin user.');
        }

        console.log('Database tables initialized successfully');
    } catch (err) {
        console.error('Error initializing database:', err.message);
        throw err;
    }
};

// User model functions
const User = {
    create: async (userData) => {
        const { email, password, business_name, whatsapp_number, marketplace_enabled, role, is_active, delete_request } = userData;
        const result = await query(`
            INSERT INTO users (email, password, business_name, whatsapp_number, marketplace_enabled, role, is_active, delete_request)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING *
        `, [email, password, business_name, whatsapp_number, marketplace_enabled, role, is_active, delete_request]);
        return result.rows[0];
    },

    findOne: async (criteria) => {
        const keys = Object.keys(criteria);
        const values = Object.values(criteria);
        const whereClause = keys.map((key, index) => `${key} = $${index + 1}`).join(' AND ');
        const result = await query(`SELECT * FROM users WHERE ${whereClause}`, values);
        return result.rows[0] || null;
    },

    findById: async (id) => {
        const result = await query('SELECT * FROM users WHERE id = $1', [id]);
        return result.rows[0] || null;
    },

    updateOne: async (criteria, updateData) => {
        const keys = Object.keys(criteria);
        const values = Object.values(criteria);
        const whereClause = keys.map((key, index) => `${key} = $${index + 1}`).join(' AND ');
        
        const updateKeys = Object.keys(updateData);
        const updateValues = Object.values(updateData);
        const setClause = updateKeys.map((key, index) => `${key} = $${index + values.length + 1}`).join(', ');
        
        const allValues = [...values, ...updateValues];
        const result = await query(`UPDATE users SET ${setClause}, updated_at = CURRENT_TIMESTAMP WHERE ${whereClause} RETURNING *`, allValues);
        return result.rows[0];
    }
};

// Product model functions
const Product = {
    create: async (productData) => {
        const { user_id, name, quantity, barcode, cost_price, price, image } = productData;
        const result = await query(`
            INSERT INTO products (user_id, name, quantity, barcode, cost_price, price, image)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *
        `, [user_id, name, quantity, barcode, cost_price, price, image]);
        return result.rows[0];
    },

    find: async (criteria) => {
        const keys = Object.keys(criteria);
        const values = Object.values(criteria);
        const whereClause = keys.map((key, index) => `${key} = $${index + 1}`).join(' AND ');
        const result = await query(`SELECT * FROM products WHERE ${whereClause}`, values);
        return result.rows;
    },

    findById: async (id) => {
        const result = await query('SELECT * FROM products WHERE id = $1', [id]);
        return result.rows[0] || null;
    },

    updateOne: async (criteria, updateData) => {
        const keys = Object.keys(criteria);
        const values = Object.values(criteria);
        const whereClause = keys.map((key, index) => `${key} = $${index + 1}`).join(' AND ');
        
        const updateKeys = Object.keys(updateData);
        const updateValues = Object.values(updateData);
        const setClause = updateKeys.map((key, index) => `${key} = $${index + values.length + 1}`).join(', ');
        
        const allValues = [...values, ...updateValues];
        const result = await query(`UPDATE products SET ${setClause}, updated_at = CURRENT_TIMESTAMP WHERE ${whereClause} RETURNING *`, allValues);
        return result.rows[0];
    },

    deleteOne: async (criteria) => {
        const keys = Object.keys(criteria);
        const values = Object.values(criteria);
        const whereClause = keys.map((key, index) => `${key} = $${index + 1}`).join(' AND ');
        const result = await query(`DELETE FROM products WHERE ${whereClause}`, values);
        return result.rowCount > 0;
    }
};

// Invoice model functions
const Invoice = {
    create: async (invoiceData) => {
        const { user_id, invoice_number, date, time, customer_name, customer_phone, cashier_name, payment_method, total_amount, amount_paid, total_profit } = invoiceData;
        const result = await query(`
            INSERT INTO invoices (user_id, invoice_number, date, time, customer_name, customer_phone, cashier_name, payment_method, total_amount, amount_paid, total_profit)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            RETURNING *
        `, [user_id, invoice_number, date, time, customer_name, customer_phone, cashier_name, payment_method, total_amount, amount_paid, total_profit]);
        return result.rows[0];
    },

    find: async (criteria) => {
        const keys = Object.keys(criteria);
        const values = Object.values(criteria);
        const whereClause = keys.map((key, index) => `${key} = $${index + 1}`).join(' AND ');
        const result = await query(`SELECT * FROM invoices WHERE ${whereClause}`, values);
        return result.rows;
    },

    findById: async (id) => {
        const result = await query('SELECT * FROM invoices WHERE id = $1', [id]);
        return result.rows[0] || null;
    },

    findByIdWithItems: async (id) => {
        const invoiceResult = await query('SELECT * FROM invoices WHERE id = $1', [id]);
        if (invoiceResult.rows.length === 0) return null;
        
        const itemsResult = await query('SELECT * FROM invoice_items WHERE invoice_id = $1', [id]);
        
        return {
            ...invoiceResult.rows[0],
            items: itemsResult.rows
        };
    }
};

// InvoiceItem model functions
const InvoiceItem = {
    create: async (itemData) => {
        const { invoice_id, product_name, quantity, cost_price, price, subtotal, profit } = itemData;
        const result = await query(`
            INSERT INTO invoice_items (invoice_id, product_name, quantity, cost_price, price, subtotal, profit)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *
        `, [invoice_id, product_name, quantity, cost_price, price, subtotal, profit]);
        return result.rows[0];
    },

    find: async (criteria) => {
        const keys = Object.keys(criteria);
        const values = Object.values(criteria);
        const whereClause = keys.map((key, index) => `${key} = $${index + 1}`).join(' AND ');
        const result = await query(`SELECT * FROM invoice_items WHERE ${whereClause}`, values);
        return result.rows;
    }
};

module.exports = {
    connectDB,
    initializeDatabase,
    query,
    User,
    Product,
    Invoice,
    InvoiceItem
};
