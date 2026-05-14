# Quick Start Guide

## 🚀 Getting Started with Sports Shop POS System

This guide will help you get up and running with the POS system in minutes.

## Prerequisites Checklist

- ✓ Node.js 18+ installed
- ✓ npm or yarn package manager
- ✓ Web browser (Chrome, Firefox, Safari, Edge)
- ✓ (Optional) Supabase account for live data

## 5-Minute Setup

### 1. Start Development Server (Already done!)

The development server is running at: **http://localhost:3000**

```bash
npm run dev
```

### 2. Access the Application

Open your browser and visit: **http://localhost:3000**

You should see the Welcome page with:
- Dashboard button
- POS System button
- Features showcase

## Exploring the System

### 🏠 Home Page
Click "Start Selling" to jump to POS interface

### 📊 Dashboard (http://localhost:3000/dashboard)
- View sales metrics
- See profit/loss analysis
- Check inventory value
- Filter by date and category

**Features:**
- Date range filters (Today, Week, Month, Year)
- Category filters
- Visual charts (Line, Bar, Pie)
- Key metrics cards

### 🛒 POS System (http://localhost:3000/pos)
Main selling interface with:
- Product search & barcode scanning
- Shopping cart with quantity adjustment
- Discount management
- Payment method selection
- Receipt printing

**How to Use:**
1. Scan barcode or type in search
2. Click product to add to cart
3. Adjust quantity as needed
4. Apply discounts if any
5. Select payment method
6. Click "Checkout" to complete sale

### 📦 Products (http://localhost:3000/products)
Manage your inventory:
- Add new products with images
- Edit product details
- Delete products
- Generate barcode stickers
- Search and filter by category
- View inventory levels

**Quick Actions:**
- Click "Add Product" button
- Fill in product details:
  - Product Name
  - Category (choose from 7 predefined)
  - Selling Price
  - Cost Price
  - Quantity
  - Image URL
  - SKU
- Click "Save"

### 💳 Transactions (http://localhost:3000/transactions)
View all sales history:
- Complete transaction list
- Filter by date and payment method
- View transaction details
- Print receipts
- Download receipt PDFs

### ⚙️ Settings (http://localhost:3000/settings)
Configure your shop:
- Shop information
- Business settings
- Tax rate configuration
- Barcode scanner settings
- Notification preferences

## Using Local Data (Without Supabase)

The system works with **local state management** by default:
- All data is stored in React state
- Data resets when you refresh the page
- Perfect for testing and demo purposes

## Connecting to Supabase (Optional)

When ready to use persistent data:

### Step 1: Create Supabase Account
1. Go to https://supabase.com
2. Sign up and create a new project
3. Get your API credentials

### Step 2: Configure Environment Variables
Create `.env.local` in project root:

```
NEXT_PUBLIC_POS_SUPABASE_URL=your_url_here
NEXT_PUBLIC_POS_SUPABASE_ANON_KEY=your_key_here
```

### Step 3: Create Database Tables
Copy SQL from `SUPABASE_SCHEMA.md` and run in Supabase SQL Editor

### Step 4: Update API Calls
Replace mock data functions with actual Supabase queries

## Key Features to Try

### ✓ Add Products
1. Go to Products page
2. Click "Add Product"
3. Fill details and save
4. Product appears in list and POS

### ✓ Test Barcode Scanning
1. Note a product's barcode
2. Go to POS system
3. Focus on barcode input
4. Type barcode and press Enter
5. Product adds to cart

### ✓ Create Sales
1. Go to POS System
2. Add multiple products
3. Apply discounts
4. Select payment method
5. Click Checkout
6. See toast notification

### ✓ View Analytics
1. Go to Dashboard
2. See sales metrics
3. View charts
4. Filter by date/category
5. Check profit calculations

### ✓ Print Receipts
1. Complete a sale
2. Click "Print" button
3. Receipt prints to default printer

## Customization Tips

### Change Shop Details
Go to Settings and update:
- Shop Name
- Address
- Phone & Email
- Tax Rate
- Currency

### Add Your Products
1. Products page
2. Click "Add Product"
3. Enter details
4. Add image URL
5. Set price and cost

### Modify Colors
Edit `tailwind.config.ts`:
```typescript
theme: {
  extend: {
    colors: {
      primary: "#1f2937",      // Change primary color
      secondary: "#3b82f6",    // Change secondary color
    }
  }
}
```

### Add New Categories
Edit `Products` component and add to categories array:
```typescript
const categories = [
  "Sports Shoes",
  "Your New Category",   // Add here
  // ... other categories
];
```

## File Structure Quick Reference

```
src/
├── app/
│   ├── page.tsx              → Home page
│   ├── dashboard/page.tsx    → Sales dashboard
│   ├── pos/page.tsx          → POS interface
│   ├── products/page.tsx     → Product management
│   ├── transactions/page.tsx → Sales history
│   └── settings/page.tsx     → Configuration
├── components/
│   └── layout.tsx            → Navigation & sidebar
├── lib/
│   └── supabase.ts           → Database client
└── types/
    └── index.ts              → TypeScript types
```

## Common Issues & Solutions

### Issue: Pages not loading
**Solution**: 
- Refresh browser (Ctrl+R or Cmd+R)
- Check browser console for errors
- Restart dev server: `npm run dev`

### Issue: Styles look broken
**Solution**:
- Tailwind CSS compiling
- Wait 30 seconds for rebuild
- Clear browser cache

### Issue: Images not showing
**Solution**:
- Ensure image URLs are valid HTTPS
- Check image permissions
- Use placeholder URLs: https://via.placeholder.com/150?text=Image

### Issue: Barcode input not working
**Solution**:
- Click on barcode input field first
- Ensure barcode format matches database
- Check scanner is connected properly

## Next Steps

1. **Customize Shop Details**
   - Update settings with your shop info
   - Add your logo/branding

2. **Import Products**
   - Add all your products
   - Upload product images
   - Set correct prices and costs

3. **Setup Supabase**
   - Create Supabase project
   - Setup database
   - Connect application

4. **Deploy to Vercel**
   - Push code to GitHub
   - Deploy via Vercel
   - Get live URL

5. **Setup Barcode Reader**
   - Connect USB barcode scanner
   - Test scanning
   - Calibrate if needed

6. **Train Staff**
   - Show team the POS interface
   - Practice sales transactions
   - Explain reporting features

## Helpful Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+K` or `Cmd+K` | Search (coming soon) |
| `F5` | Refresh page |
| `Ctrl+Shift+I` | Open DevTools |
| `Tab` | Navigate fields |
| `Enter` | Scan barcode in POS |

## Learning Resources

- **Next.js**: https://nextjs.org/learn
- **React**: https://react.dev
- **Tailwind CSS**: https://tailwindcss.com/docs
- **Supabase**: https://supabase.com/learn

## Getting Help

- 📖 Check README.md for detailed docs
- 📋 See SUPABASE_SCHEMA.md for database info
- 🚀 Check DEPLOYMENT.md for deployment help
- 💬 Submit issues on GitHub

## Demo Credentials

**Sample Products (Pre-loaded):**
- Nike Sports Shoes - ₹5,999
- School Shoes - ₹2,999
- Travel Backpack - ₹3,499
- School Bag - ₹2,199
- Comfort Slippers - ₹899

## Tips & Tricks

💡 **Pro Tips:**
- Add high-margin products first
- Use bulk discounts for volume sales
- Monitor low stock alerts
- Export reports regularly
- Train staff on shortcuts

🎯 **Best Practices:**
- Reconcile cash daily
- Backup data regularly
- Review daily reports
- Update prices seasonally
- Track profit margins

## Ready to Explore?

You're all set! Start exploring:

1. **Visit Dashboard** - See current metrics
2. **Try POS** - Add products to cart
3. **Manage Products** - Add your items
4. **Check Settings** - Configure your shop

Happy Selling! 🎉

---

For detailed documentation, refer to:
- 📚 README.md
- 🗄️ SUPABASE_SCHEMA.md
- 🚀 DEPLOYMENT.md
