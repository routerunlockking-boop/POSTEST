const express = require('express');
const cors = require('cors');
const path = require('path');
const { connectDB, initializeDatabase, User, Product, Invoice, Customer, Voucher } = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

// Connect to MongoDB when running locally
if (process.env.NODE_ENV !== 'production') {
    connectDB().then(() => {
        initializeDatabase();
    });
}

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Ensure DB connection for all API routes (important for Vercel serverless)
app.use('/api', async (req, res, next) => {
    try {
        await connectDB();
        // Try to initialize default admin (safe to call multiple times if users collection exists)
        if (req.path === '/auth/login' || req.path === '/auth/register') {
             initializeDatabase(); // non-blocking
        }
        next();
    } catch (err) {
        return res.status(500).json({ error: 'Database connection failed' });
    }
});

// ==== AUTH API ====

app.post('/api/auth/register', async (req, res) => {
    const { email, password, business_name, whatsapp_number, shop_type } = req.body;
    if (!email || !password || !business_name || !whatsapp_number) {
        return res.status(400).json({ error: 'Missing required fields' });
    }
    
    try {
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ error: 'User already exists' });
        }
        const finalShopType = shop_type || 'new_shop';
        // Auto-approve users if it's just a new shop (optional, based on requirement, but user complained they can't login, so let's set is_active: true for new shops)
        const is_active = finalShopType === 'new_shop' ? true : false;
        
        const user = await User.create({ email, password, business_name, whatsapp_number, is_active: is_active, marketplace_enabled: true, shop_type: finalShopType });
        res.status(201).json({ 
            message: is_active ? 'Account creation successful. You can now log in.' : 'Account creation successful. Pending admin approval.'
        });
    } catch (err) {
        console.error("INVOICE SAVE ERROR:", err);
        return res.status(500).json({ error: err.message });
    }
});

app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    try {
        const user = await User.findOne({ email, password });
        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        if (!user.is_active && user.role !== 'admin') {
            return res.status(403).json({ error: 'Account pending admin approval' });
        }
        res.json({ token: user._id.toString(), business_name: user.business_name, role: user.role });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

app.post('/api/auth/reset-password', async (req, res) => {
    const { email, business_name, new_password } = req.body;
    if (!email || !business_name || !new_password) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    try {
        const user = await User.findOne({ email, business_name });
        if (!user) {
            return res.status(404).json({ error: 'Account not found with this email and business name' });
        }
        
        user.password = new_password;
        await user.save();
        res.json({ message: 'Password reset successful. You can now login.' });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// ==== AUTH MIDDLEWARE ====
const authMiddleware = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'Unauthorized' });
    
    const token = authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    
    try {
        const user = await User.findById(token);
        if (!user) return res.status(401).json({ error: 'Unauthorized' });
        req.user = user;
        next();
    } catch (err) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
};

app.use('/api', (req, res, next) => {
    if (req.path.startsWith('/auth') || req.path.startsWith('/public')) return next();
    return authMiddleware(req, res, next);
});

app.post('/api/user/request-disconnect', async (req, res) => {
    try {
        await User.findByIdAndUpdate(req.user._id, { delete_request: true });
        res.json({ message: 'Disconnect request sent to admin successfully' });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// ==== ADMIN API ====

const adminMiddleware = (req, res, next) => {
    if (req.user && req.user.role === 'admin') {
        next();
    } else {
        res.status(403).json({ error: 'Forbidden: Admins only' });
    }
};

app.get('/api/admin/users', adminMiddleware, async (req, res) => {
    try {
        const users = await User.find({ role: { $ne: 'admin' } }).select('-password');
        const mappedUsers = users.map(u => ({
            id: u._id.toString(),
            email: u.email,
            business_name: u.business_name,
            whatsapp_number: u.whatsapp_number,
            marketplace_enabled: u.marketplace_enabled,
            role: u.role,
            is_active: u.is_active,
            delete_request: u.delete_request
        }));
        res.json(mappedUsers);
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

app.put('/api/admin/users/:id', adminMiddleware, async (req, res) => {
    const { email, business_name, whatsapp_number, marketplace_enabled, is_active } = req.body;
    try {
        const user = await User.findByIdAndUpdate(
            req.params.id,
            { email, business_name, whatsapp_number, marketplace_enabled, is_active },
            { new: true }
        ).select('-password');
        if (!user) return res.status(404).json({ error: 'User not found' });
        res.json({ message: 'User updated successfully' });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

app.delete('/api/admin/users/:id', adminMiddleware, async (req, res) => {
    try {
        const userId = req.params.id;
        const user = await User.findByIdAndDelete(userId);
        if (!user) return res.status(404).json({ error: 'User not found' });
        
        // Also delete associated products and invoices
        await Product.deleteMany({ user_id: userId });
        await Invoice.deleteMany({ user_id: userId });
        
        res.json({ message: 'User and all associated data deleted successfully' });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// ==== DASHBOARD API ====

app.get('/api/dashboard', async (req, res) => {
    const todayDate = new Date();
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Colombo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(todayDate);
    const currentMonth = today.slice(0, 7); // YYYY-MM
    
    // Admin query filter bypass
    const queryFilter = req.user.role === 'admin' ? {} : { user_id: req.user._id };
    
    try {
        // Daily Stats
        const dailyInvoices = await Invoice.find({ ...queryFilter, date: today });
        const totalBillsToday = dailyInvoices.length;
        const dailyIncome = dailyInvoices.reduce((sum, inv) => sum + inv.total_amount, 0);
        const dailyProfit = dailyInvoices.reduce((sum, inv) => sum + (inv.total_profit || 0), 0);

        // Monthly Stats
        const monthlyInvoices = await Invoice.find({ ...queryFilter, date: new RegExp('^' + currentMonth) });
        const totalBillsMonth = monthlyInvoices.length;
        const monthlyIncome = monthlyInvoices.reduce((sum, inv) => sum + inv.total_amount, 0);
        const monthlyProfit = monthlyInvoices.reduce((sum, inv) => sum + (inv.total_profit || 0), 0);

        // Product Stats
        const totalProducts = await Product.countDocuments(queryFilter);
        const lowStockProducts = await Product.countDocuments({ ...queryFilter, quantity: { $lte: 10 } });

        res.json({
            totalBillsToday,
            dailyIncome,
            dailyProfit,
            totalBillsMonth,
            monthlyIncome,
            monthlyProfit,
            totalProducts,
            lowStockProducts
        });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

app.get('/api/dashboard/low-stock', async (req, res) => {
    try {
        const queryFilter = req.user.role === 'admin' ? {} : { user_id: req.user._id };
        const products = await Product.find({ ...queryFilter, quantity: { $lte: 10 } })
            .populate('user_id', 'business_name')
            .sort({ quantity: 1 })
            .limit(10);
            
        const mappedProducts = products.map(p => ({
            id: p._id.toString(),
            name: p.name,
            quantity: p.quantity,
            price: p.price,
            owner_name: p.user_id ? p.user_id.business_name : 'Unknown'
        }));
        
        res.json(mappedProducts);
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// ==== INVENTORY (PRODUCTS) API ====

app.get('/api/products', async (req, res) => {
    try {
        const { lite } = req.query;
        const queryFilter = req.user.role === 'admin' ? {} : { user_id: req.user._id };
        
        // Use select to exclude image if lite is true
        let query = Product.find(queryFilter)
            .populate('user_id', 'business_name')
            .sort({ name: 1 });
            
        if (lite === 'true') {
            query = query.select('-image');
        }
        
        const products = await query;
        
        // Map _id to id for the frontend
        const mappedProducts = products.map(p => {
            const result = {
                id: p._id.toString(),
                name: p.name,
                barcode: p.barcode || '',
                quantity: p.quantity,
                cost_price: p.cost_price,
                price: p.price,
                owner_name: p.user_id ? p.user_id.business_name : 'Unknown'
            };
            if (lite !== 'true') {
                result.image = p.image;
            }
            return result;
        });
        
        res.json(mappedProducts);
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

app.get('/api/products/:id/image', async (req, res) => {
    try {
        const queryFilter = req.user.role === 'admin' ? { _id: req.params.id } : { _id: req.params.id, user_id: req.user._id };
        const product = await Product.findOne(queryFilter).select('image');
        if (!product) return res.status(404).json({ error: 'Product not found' });
        res.json({ image: product.image });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

app.post('/api/products', async (req, res) => {
    const { name, barcode, quantity, cost_price, price, image } = req.body;
    if (!name || quantity === undefined || price === undefined) {
        return res.status(400).json({ error: 'Missing required fields' });
    }
    
    try {
        const product = await Product.create({
            user_id: req.user._id,
            name,
            barcode: barcode || '',
            quantity,
            cost_price: cost_price || 0,
            price,
            image
        });
        res.status(201).json({ id: product._id.toString(), name, barcode: product.barcode, quantity, cost_price: product.cost_price, price, image });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

app.put('/api/products/:id', async (req, res) => {
    const { name, barcode, quantity, cost_price, price, image } = req.body;
    try {
        const queryFilter = req.user.role === 'admin' ? { _id: req.params.id } : { _id: req.params.id, user_id: req.user._id };
        const product = await Product.findOneAndUpdate(
            queryFilter,
            { name, barcode: barcode || '', quantity, cost_price: cost_price || 0, price, image },
            { new: true }
        );
        if (!product) return res.status(404).json({ error: 'Product not found' });
        res.json({ message: 'Product updated successfully' });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

app.delete('/api/products/:id', async (req, res) => {
    try {
        const queryFilter = req.user.role === 'admin' ? { _id: req.params.id } : { _id: req.params.id, user_id: req.user._id };
        const product = await Product.findOneAndDelete(queryFilter);
        if (!product) return res.status(404).json({ error: 'Product not found' });
        res.json({ message: 'Product deleted successfully' });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// ==== CUSTOMERS API ====

app.get('/api/customers', async (req, res) => {
    try {
        const queryFilter = req.user.role === 'admin' ? {} : { user_id: req.user._id };
        const customers = await Customer.find(queryFilter).sort({ name: 1 });
        const mappedCustomers = customers.map(c => ({
            id: c._id.toString(),
            name: c.name,
            phone: c.phone,
            email: c.email || '',
            address: c.address || '',
            created_date: c.created_date
        }));
        res.json(mappedCustomers);
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

app.post('/api/customers', async (req, res) => {
    const { name, phone, email, address } = req.body;
    if (!name || !phone) {
        return res.status(400).json({ error: 'Missing required fields: name, phone' });
    }
    
    try {
        const customer = await Customer.create({
            user_id: req.user._id,
            name,
            phone,
            email: email || '',
            address: address || ''
        });
        res.status(201).json({
            id: customer._id.toString(),
            name: customer.name,
            phone: customer.phone,
            email: customer.email,
            address: customer.address,
            created_date: customer.created_date
        });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

app.put('/api/customers/:id', async (req, res) => {
    const { name, phone, email, address } = req.body;
    try {
        const queryFilter = req.user.role === 'admin' ? { _id: req.params.id } : { _id: req.params.id, user_id: req.user._id };
        const customer = await Customer.findOneAndUpdate(
            queryFilter,
            { name, phone, email: email || '', address: address || '' },
            { new: true }
        );
        if (!customer) return res.status(404).json({ error: 'Customer not found' });
        res.json({ message: 'Customer updated successfully' });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

app.delete('/api/customers/:id', async (req, res) => {
    try {
        const queryFilter = req.user.role === 'admin' ? { _id: req.params.id } : { _id: req.params.id, user_id: req.user._id };
        const customer = await Customer.findOneAndDelete(queryFilter);
        if (!customer) return res.status(404).json({ error: 'Customer not found' });
        res.json({ message: 'Customer deleted successfully' });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// ==== VOUCHERS API ====

app.get('/api/vouchers', async (req, res) => {
    try {
        const queryFilter = req.user.role === 'admin' ? {} : { user_id: req.user._id };
        const vouchers = await Voucher.find(queryFilter).sort({ expiry_date: -1 });
        const mappedVouchers = vouchers.map(v => ({
            id: v._id.toString(),
            code: v.code,
            discount_type: v.discount_type,
            discount_value: v.discount_value,
            usage_limit: v.usage_limit,
            used_count: v.used_count,
            expiry_date: v.expiry_date,
            status: v.status
        }));
        res.json(mappedVouchers);
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

app.post('/api/vouchers', async (req, res) => {
    const { code, discount_type, discount_value, usage_limit, expiry_date, status } = req.body;
    if (!code || !discount_type || discount_value === undefined || !expiry_date) {
        return res.status(400).json({ error: 'Missing required fields' });
    }
    
    try {
        const existing = await Voucher.findOne({ code: code.toUpperCase(), user_id: req.user._id });
        if (existing) return res.status(400).json({ error: 'Voucher code already exists' });

        const voucher = await Voucher.create({
            user_id: req.user._id,
            code: code.toUpperCase(),
            discount_type,
            discount_value,
            usage_limit: usage_limit || null,
            expiry_date,
            status: status || 'active'
        });
        res.status(201).json({ message: 'Voucher created successfully', id: voucher._id.toString() });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

app.put('/api/vouchers/:id', async (req, res) => {
    const { code, discount_type, discount_value, usage_limit, expiry_date, status } = req.body;
    try {
        const queryFilter = req.user.role === 'admin' ? { _id: req.params.id } : { _id: req.params.id, user_id: req.user._id };
        const voucher = await Voucher.findOneAndUpdate(
            queryFilter,
            { code: code ? code.toUpperCase() : undefined, discount_type, discount_value, usage_limit: usage_limit || null, expiry_date, status },
            { new: true }
        );
        if (!voucher) return res.status(404).json({ error: 'Voucher not found' });
        res.json({ message: 'Voucher updated successfully' });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

app.delete('/api/vouchers/:id', async (req, res) => {
    try {
        const queryFilter = req.user.role === 'admin' ? { _id: req.params.id } : { _id: req.params.id, user_id: req.user._id };
        const voucher = await Voucher.findOneAndDelete(queryFilter);
        if (!voucher) return res.status(404).json({ error: 'Voucher not found' });
        res.json({ message: 'Voucher deleted successfully' });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

app.post('/api/vouchers/validate', async (req, res) => {
    const { code } = req.body;
    if (!code) return res.status(400).json({ error: 'Voucher code required' });
    
    try {
        const voucher = await Voucher.findOne({ code: code.toUpperCase(), user_id: req.user._id });
        if (!voucher) return res.status(404).json({ error: 'Invalid voucher code' });
        if (voucher.status !== 'active') return res.status(400).json({ error: 'Voucher is inactive' });
        
        const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Colombo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
        if (voucher.expiry_date < today) return res.status(400).json({ error: 'Voucher has expired' });
        if (voucher.usage_limit !== null && voucher.used_count >= voucher.usage_limit) return res.status(400).json({ error: 'Voucher usage limit reached' });
        
        res.json({
            id: voucher._id.toString(),
            code: voucher.code,
            discount_type: voucher.discount_type,
            discount_value: voucher.discount_value
        });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// ==== INVOICES API ====

app.get('/api/invoices', async (req, res) => {
    const { date, month } = req.query;
    let query = req.user.role === 'admin' ? {} : { user_id: req.user._id };

    if (date) {
        query.date = date;
    } else if (month) {
        query.date = new RegExp('^' + month);
    }

    try {
        const invoices = await Invoice.find(query)
            .populate('user_id', 'business_name')
            .sort({ date: -1, time: -1 });
        
        // Map _id to id for frontend
        const mappedInvoices = invoices.map(inv => ({
            id: inv._id.toString(),
            invoice_number: inv.invoice_number,
            customer_name: inv.customer_name || '',
            customer_phone: inv.customer_phone || '',
            payment_method: inv.payment_method || 'Cash',
            date: inv.date,
            time: inv.time,
            total_amount: inv.total_amount,
            total_profit: inv.total_profit || 0,
            owner_name: inv.user_id ? inv.user_id.business_name : 'Unknown'
        }));
        
        res.json(mappedInvoices);
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

app.get('/api/invoices/:id', async (req, res) => {
    try {
        const queryFilter = req.user.role === 'admin' ? { _id: req.params.id } : { _id: req.params.id, user_id: req.user._id };
        const invoice = await Invoice.findOne(queryFilter).populate('user_id', 'business_name');
        if (!invoice) return res.status(404).json({ error: 'Invoice not found' });
        
        const response = {
            id: invoice._id.toString(),
            invoice_number: invoice.invoice_number,
            customer_name: invoice.customer_name || '',
            customer_phone: invoice.customer_phone || '',
            payment_method: invoice.payment_method || 'Cash',
            date: invoice.date,
            time: invoice.time,
            total_amount: invoice.total_amount,
            owner_name: invoice.user_id ? invoice.user_id.business_name : 'Unknown',
            items: invoice.items.map(item => ({
                id: item._id ? item._id.toString() : null,
                product_name: item.product_name,
                quantity: item.quantity,
                price: item.price,
                subtotal: item.subtotal
            }))
        };
        res.json(response);
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

app.post('/api/invoices', async (req, res) => {
    const { items, total_amount, amount_paid, cashier_name, customer_name, customer_phone, payment_method, voucher_code, voucher_discount, subtotal_amount } = req.body;
    
    const parsedTotal = parseFloat(total_amount) || 0;
    const parsedPaid = parseFloat(amount_paid) || 0;

    if (!items || items.length === 0 || !parsedTotal) {
        return res.status(400).json({ error: 'Invalid invoice data' });
    }

    const today = new Date();
    // Set invoice date and time to Sri Lanka time
    const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Colombo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(today);
    const time = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Colombo', hour: '2-digit', minute: '2-digit' }).format(today);
    const invoice_number = 'INV-' + today.getTime().toString().slice(-6);

    try {
        // Fetch current cost prices for products to calculate profit
        let total_profit = 0;
        const formattedItems = [];
        for (const item of items) {
            const product = await Product.findOne({ name: item.name, user_id: req.user._id });
            const item_cost_price = product ? product.cost_price || 0 : 0;
            const quantity = parseFloat(item.quantity) || 0;
            const price = parseFloat(item.price) || 0;
            const item_profit = (price - item_cost_price) * quantity;
            total_profit += item_profit;
            
            formattedItems.push({
                product_name: item.name,
                quantity: quantity,
                cost_price: item_cost_price,
                price: price,
                subtotal: quantity * price,
                profit: item_profit
            });
        }

        const invoice = await Invoice.create({
            user_id: req.user._id,
            invoice_number,
            customer_name,
            customer_phone,
            cashier_name: cashier_name || 'System',
            payment_method: payment_method || 'Cash',
            date,
            time,
            subtotal_amount: subtotal_amount || parsedTotal,
            voucher_code: voucher_code || '',
            voucher_discount: voucher_discount || 0,
            total_amount: parsedTotal,
            amount_paid: parsedPaid,
            total_profit,
            items: formattedItems
        });
        
        if (voucher_code) {
            await Voucher.findOneAndUpdate(
                { code: voucher_code.toUpperCase(), user_id: req.user._id },
                { $inc: { used_count: 1 } }
            );
        }
        
        // Update product stock manually in series or parallel
        for (const item of items) {
            const quantity = parseFloat(item.quantity) || 0;
            await Product.findOneAndUpdate(
                { name: item.name, user_id: req.user._id },
                { $inc: { quantity: -quantity } }
            );
        }

        res.status(201).json({ 
            message: 'Invoice created successfully',
            invoice: {
                id: invoice._id.toString(),
                invoice_number,
                customer_name,
                customer_phone,
                cashier_name: invoice.cashier_name,
                payment_method: payment_method || 'Cash',
                date,
                time,
                total_amount: parsedTotal,
                amount_paid: parsedPaid,
                owner_name: req.user.business_name,
                items: formattedItems
            }
        });
    } catch (err) {
        console.error("INVOICE SAVE ERROR:", err);
        return res.status(500).json({ error: err.message });
    }
});

app.delete('/api/invoices/:id', async (req, res) => {
    try {
        const queryFilter = req.user.role === 'admin' ? { _id: req.params.id } : { _id: req.params.id, user_id: req.user._id };
        const invoice = await Invoice.findOneAndDelete(queryFilter);
        if (!invoice) return res.status(404).json({ error: 'Invoice not found' });
        
        // Need to add back the stock quantities
        if (invoice.user_id) {
            for (const item of invoice.items) {
                await Product.findOneAndUpdate(
                    { name: item.product_name, user_id: invoice.user_id },
                    { $inc: { quantity: item.quantity } }
                );
            }
        }
        res.json({ message: 'Invoice deleted successfully. Inventory restocked.' });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// ==== REPORTS API ====

app.get('/api/reports/sales', async (req, res) => {
    try {
        const queryMatch = req.user.role === 'admin' ? {} : { user_id: req.user._id };
        const result = await Invoice.aggregate([
            { $match: queryMatch },
            { $group: { _id: "$date", total_sales: { $sum: "$total_amount" }, total_profit: { $sum: "$total_profit" } } },
            { $project: { date: "$_id", total_sales: 1, total_profit: 1, _id: 0 } },
            { $sort: { date: -1 } }
        ]);
        res.json(result);
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

app.get('/api/reports/product-sales', async (req, res) => {
    try {
        const queryMatch = req.user.role === 'admin' ? {} : { user_id: req.user._id };
        const result = await Invoice.aggregate([
            { $match: queryMatch },
            { $unwind: "$items" },
            { $group: { 
                _id: "$items.product_name", 
                quantity_sold: { $sum: "$items.quantity" },
                revenue: { $sum: "$items.subtotal" },
                profit: { $sum: "$items.profit" }
            }},
            { $project: { product_name: "$_id", quantity_sold: 1, revenue: 1, profit: 1, _id: 0 } },
            { $sort: { quantity_sold: -1 } }
        ]);
        res.json(result);
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// ==== MARKETPLACE API ====

app.post('/api/marketplace/enable', async (req, res) => {
    try {
        await User.findByIdAndUpdate(req.user._id, { marketplace_enabled: true });
        res.json({ message: 'Marketplace enabled successfully' });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

app.get('/api/public/store/:business_name', async (req, res) => {
    try {
        const storeOwner = await User.findOne({ business_name: req.params.business_name });
        if (!storeOwner || storeOwner.marketplace_enabled !== true) {
            return res.status(404).json({ error: 'Store not found or marketplace is disabled' });
        }
        
        // Return products that have stock
        const products = await Product.find({ user_id: storeOwner._id, quantity: { $gt: 0 } }).sort({ name: 1 });
        const mappedProducts = products.map(p => ({
            id: p._id.toString(),
            name: p.name,
            price: p.price,
            image: p.image
        }));
        
        // Return store info and products
        res.json({
            business_name: storeOwner.business_name,
            whatsapp_number: storeOwner.whatsapp_number,
            products: mappedProducts
        });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// Serves the public marketplace UI
app.get('/:business_name', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'marketplace.html'));
});

// Export app for Vercel, listen for local development
if (process.env.NODE_ENV !== 'production') {
    app.listen(PORT, () => {
        console.log(`Server is running on http://localhost:${PORT}`);
    });
}
module.exports = app;
