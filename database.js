const mongoose = require('mongoose');

// Global variable to cache the mongoose connection
let cachedDb = null;

const connectDB = async () => {
    if (cachedDb) {
        console.log('Using cached MongoDB connection');
        return cachedDb;
    }

    try {
        const uri = process.env.MONGO_URI || 'mongodb+srv://ravimotors:10669Abc@cluster0.mqdicae.mongodb.net/testdb?retryWrites=true&w=majority';
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
    role: { type: String, default: 'user' }
});

const ProductSchema = new mongoose.Schema({
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true },
    quantity: { type: Number, default: 0 },
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
    total_amount: { type: Number, default: 0.0 },
    total_profit: { type: Number, default: 0.0 },
    items: [InvoiceItemSchema]
});

// -- MODELS --
const User = mongoose.model('User', UserSchema);
const Product = mongoose.model('Product', ProductSchema);
const Invoice = mongoose.model('Invoice', InvoiceSchema);

// Create default admin user
const initializeDatabase = async () => {
    try {
        const adminExists = await User.findOne({ role: 'admin' });
        if (!adminExists) {
            await User.create({
                email: 'Admin',
                password: 'Admin',
                business_name: 'Admin Portal',
                role: 'admin'
            });
            console.log('Admin user created.');
        } else {
            await User.updateOne(
                { _id: adminExists._id },
                {
                    email: 'smartzonelk101@gmail.com',
                    password: '200723800385@',
                    role: 'admin'
                }
            );
            // Also clean up the old 'Admin' text if it exists but wasn't caught by the role query
            // just to be thorough, but we updated by ID anyway
            console.log('Admin credentials updated for existing admin user.');
        }
    } catch (err) {
        console.error('Error initializing default user:', err.message);
    }
};

module.exports = {
    connectDB,
    initializeDatabase,
    User,
    Product,
    Invoice
};
