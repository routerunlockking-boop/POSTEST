const mongoose = require('mongoose');

// Global variable to cache the mongoose connection
let cachedDb = null;

const connectDB = async () => {
    if (cachedDb) {
        console.log('Using cached MongoDB connection');
        return cachedDb;
    }

    try {
        const uri = process.env.MONGO_URI || 'mongodb+srv://Admin:Admin%4012345@cluster0.czllghf.mongodb.net/myDatabase?retryWrites=true&w=majority';
        const db = await mongoose.connect(uri, {
            serverSelectionTimeoutMS: 5000 // Tweak timeout down so Serverless fails faster instead of hanging
        });

        cachedDb = db;
        console.log('Connected to MongoDB database');
        return db;
    } catch (err) {
        console.error('Error connecting to MongoDB:', err.message);
        throw err; // don't process.exit(1) in serverless!
    }
};

// -- SCHEMAS --

const UserSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    business_name: { type: String, required: true },
    whatsapp_number: { type: String },
    marketplace_enabled: { type: Boolean, default: false },
    role: { type: String, default: 'user' },
    is_active: { type: Boolean, default: false },
    delete_request: { type: Boolean, default: false }
});

const ProductSchema = new mongoose.Schema({
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true },
    quantity: { type: Number, default: 0 },
    barcode: { type: String, default: '' },
    cost_price: { type: Number, default: 0.0 },
    price: { type: Number, default: 0.0 },
    image: { type: String }
});

const InvoiceItemSchema = new mongoose.Schema({
    product_name: { type: String, required: true },
    quantity: { type: Number, required: true },
    cost_price: { type: Number, default: 0.0 },
    price: { type: Number, required: true },
    subtotal: { type: Number, required: true },
    profit: { type: Number, default: 0.0 }
});

const InvoiceSchema = new mongoose.Schema({
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    invoice_number: { type: String, required: true },
    date: { type: String, required: true }, // Format: YYYY-MM-DD
    time: { type: String, required: true }, // Format: HH:MM
    customer_name: { type: String, default: '' },
    customer_phone: { type: String, default: '' },
    cashier_name: { type: String, default: 'System' },
    payment_method: { type: String, default: 'Cash' },
    total_amount: { type: Number, default: 0.0 },
    amount_paid: { type: Number, default: 0.0 },
    total_profit: { type: Number, default: 0.0 },
    items: [InvoiceItemSchema]
});

// -- MODELS --
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
        let queryString = 'SELECT * FROM users WHERE ';
        const values = [];
        const conditions = [];
        
        Object.keys(criteria).forEach((key, index) => {
            if (typeof criteria[key] === 'object' && criteria[key].$ne) {
                conditions.push(`${key} != $${index + 1}`);
                values.push(criteria[key].$ne);
            } else {
                conditions.push(`${key} = $${index + 1}`);
                values.push(criteria[key]);
            }
        });
        
        queryString += conditions.join(' AND ');
        const result = await query(queryString, values);
        return result.rows[0] || null;
    },

    findById: async (id) => {
        const result = await query('SELECT * FROM users WHERE id = $1', [id]);
        return result.rows[0] || null;
    },

    updateOne: async (criteria, updateData) => {
        let whereClause = '';
        const whereValues = [];
        const whereConditions = [];
        
        Object.keys(criteria).forEach((key, index) => {
            whereConditions.push(`${key} = $${index + 1}`);
            whereValues.push(criteria[key]);
        });
        whereClause = whereConditions.join(' AND ');
        
        const setValues = [];
        const updateValues = [];
        Object.keys(updateData).forEach((key, index) => {
            setValues.push(`${key} = $${index + whereValues.length + 1}`);
            updateValues.push(updateData[key]);
        });
        
        const setClause = setValues.join(', ');
        const allValues = [...whereValues, ...updateValues];
        const result = await query(`UPDATE users SET ${setClause}, updated_at = CURRENT_TIMESTAMP WHERE ${whereClause} RETURNING *`, allValues);
        return result.rows[0];
    },

    deleteOne: async (criteria) => {
        let whereClause = '';
        const values = [];
        const conditions = [];
        
        Object.keys(criteria).forEach((key, index) => {
            conditions.push(`${key} = $${index + 1}`);
            values.push(criteria[key]);
        });
        whereClause = conditions.join(' AND ');
        
        const result = await query(`DELETE FROM users WHERE ${whereClause}`, values);
        return result.rowCount > 0;
    },

    deleteMany: async (criteria) => {
        let whereClause = '';
        const values = [];
        const conditions = [];
        
        Object.keys(criteria).forEach((key, index) => {
            conditions.push(`${key} = $${index + 1}`);
            values.push(criteria[key]);
        });
        whereClause = conditions.join(' AND ');
        
        const result = await query(`DELETE FROM users WHERE ${whereClause}`, values);
        return result.rowCount;
    },

    find: async (criteria) => {
        let queryString = 'SELECT * FROM users WHERE ';
        const values = [];
        const conditions = [];
        
        Object.keys(criteria).forEach((key, index) => {
            if (typeof criteria[key] === 'object' && criteria[key].$ne) {
                conditions.push(`${key} != $${index + 1}`);
                values.push(criteria[key].$ne);
            } else {
                conditions.push(`${key} = $${index + 1}`);
                values.push(criteria[key]);
            }
        });
        
        queryString += conditions.join(' AND ');
        const result = await query(queryString, values);
        return result.rows;
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
        let queryString = 'SELECT * FROM products WHERE ';
        const values = [];
        const conditions = [];
        
        Object.keys(criteria).forEach((key, index) => {
            if (typeof criteria[key] === 'object') {
                if (criteria[key].$lte) {
                    conditions.push(`${key} <= $${index + 1}`);
                    values.push(criteria[key].$lte);
                } else if (criteria[key].$gt) {
                    conditions.push(`${key} > $${index + 1}`);
                    values.push(criteria[key].$gt);
                }
            } else {
                conditions.push(`${key} = $${index + 1}`);
                values.push(criteria[key]);
            }
        });
        
        queryString += conditions.join(' AND ');
        const result = await query(queryString, values);
        return result.rows;
    },

    findById: async (id) => {
        const result = await query('SELECT * FROM products WHERE id = $1', [id]);
        return result.rows[0] || null;
    },

    updateOne: async (criteria, updateData) => {
        let whereClause = '';
        const whereValues = [];
        const whereConditions = [];
        
        Object.keys(criteria).forEach((key, index) => {
            whereConditions.push(`${key} = $${index + 1}`);
            whereValues.push(criteria[key]);
        });
        whereClause = whereConditions.join(' AND ');
        
        const setValues = [];
        const updateValues = [];
        Object.keys(updateData).forEach((key, index) => {
            if (typeof updateData[key] === 'object' && updateData[key].$inc) {
                setValues.push(`${key} = ${key} + $${index + whereValues.length + 1}`);
                updateValues.push(updateData[key].$inc);
            } else {
                setValues.push(`${key} = $${index + whereValues.length + 1}`);
                updateValues.push(updateData[key]);
            }
        });
        
        const setClause = setValues.join(', ');
        const allValues = [...whereValues, ...updateValues];
        const result = await query(`UPDATE products SET ${setClause}, updated_at = CURRENT_TIMESTAMP WHERE ${whereClause} RETURNING *`, allValues);
        return result.rows[0];
    },

    deleteOne: async (criteria) => {
        let whereClause = '';
        const values = [];
        const conditions = [];
        
        Object.keys(criteria).forEach((key, index) => {
            conditions.push(`${key} = $${index + 1}`);
            values.push(criteria[key]);
        });
        whereClause = conditions.join(' AND ');
        
        const result = await query(`DELETE FROM products WHERE ${whereClause}`, values);
        return result.rowCount > 0;
    },

    deleteMany: async (criteria) => {
        let whereClause = '';
        const values = [];
        const conditions = [];
        
        Object.keys(criteria).forEach((key, index) => {
            conditions.push(`${key} = $${index + 1}`);
            values.push(criteria[key]);
        });
        whereClause = conditions.join(' AND ');
        
        const result = await query(`DELETE FROM products WHERE ${whereClause}`, values);
        return result.rowCount;
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
        let queryString = 'SELECT * FROM invoices WHERE ';
        const values = [];
        const conditions = [];
        
        Object.keys(criteria).forEach((key, index) => {
            if (typeof criteria[key] === 'object' && criteria[key].$like) {
                conditions.push(`${key} LIKE $${index + 1}`);
                values.push(criteria[key].$like);
            } else {
                conditions.push(`${key} = $${index + 1}`);
                values.push(criteria[key]);
            }
        });
        
        queryString += conditions.join(' AND ');
        queryString += ' ORDER BY date DESC, time DESC';
        const result = await query(queryString, values);
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
    },

    deleteOne: async (criteria) => {
        let whereClause = '';
        const values = [];
        const conditions = [];
        
        Object.keys(criteria).forEach((key, index) => {
            conditions.push(`${key} = $${index + 1}`);
            values.push(criteria[key]);
        });
        whereClause = conditions.join(' AND ');
        
        const result = await query(`DELETE FROM invoices WHERE ${whereClause}`, values);
        return result.rowCount > 0;
    },

    deleteMany: async (criteria) => {
        let whereClause = '';
        const values = [];
        const conditions = [];
        
        Object.keys(criteria).forEach((key, index) => {
            conditions.push(`${key} = $${index + 1}`);
            values.push(criteria[key]);
        });
        whereClause = conditions.join(' AND ');
        
        const result = await query(`DELETE FROM invoices WHERE ${whereClause}`, values);
        return result.rowCount;
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
        let queryString = 'SELECT * FROM invoice_items WHERE ';
        const values = [];
        const conditions = [];
        
        Object.keys(criteria).forEach((key, index) => {
            conditions.push(`${key} = $${index + 1}`);
            values.push(criteria[key]);
        });
        queryString += conditions.join(' AND ');
        const result = await query(queryString, values);
        return result.rows;
    },

    deleteMany: async (criteria) => {
        let whereClause = '';
        const values = [];
        const conditions = [];
        
        Object.keys(criteria).forEach((key, index) => {
            conditions.push(`${key} = $${index + 1}`);
            values.push(criteria[key]);
        });
        whereClause = conditions.join(' AND ');
        
        const result = await query(`DELETE FROM invoice_items WHERE ${whereClause}`, values);
        return result.rowCount;
    }
};

// Create default admin user
const initializeDatabase = async () => {
    try {
        const adminExists = await User.findOne({ role: 'admin' });
        if (!adminExists) {
            await User.create({
                email: 'smartzonelk101@gmail.com',
                password: '200723800385@',
                business_name: 'SMART ZONE',
                role: 'admin',
                is_active: true
            });
            console.log('Admin user created.');
        } else {
            await User.updateOne(
                { id: adminExists.id },
                {
                    email: 'smartzonelk101@gmail.com',
                    password: '200723800385@',
                    business_name: 'SMART ZONE',
                    role: 'admin',
                    is_active: true
                }
            );
            console.log('Admin credentials updated for existing admin user.');
        }

        console.log('Database tables initialized successfully');
    } catch (err) {
        console.error('Error initializing database:', err.message);
        throw err;
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
