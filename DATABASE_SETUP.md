# Supabase Database Setup Guide

## Overview
This guide will help you set up the Supabase database for the POS system. All tables and indexes required for the system to function properly will be created.

## Prerequisites
- Supabase account (free tier is sufficient)
- Access to your Supabase project dashboard
- Supabase credentials in `.env` file (already configured)

## Setup Steps

### Step 1: Access Supabase SQL Editor
1. Log in to your Supabase Dashboard: https://app.supabase.com
2. Select your project
3. Go to **SQL Editor** in the left sidebar
4. Click **New Query**

### Step 2: Create Tables
1. Open the file `supabase_init.sql` in your project root
2. Copy the entire content
3. Paste it into the Supabase SQL Editor
4. Click **Run** to execute the script

**Expected Output:**
```
Query returned 0 rows
```

The script will create:
- ✅ `products` table (7 columns, 3 indexes)
- ✅ `transactions` table (7 columns, 2 indexes)
- ✅ `transaction_items` table (7 columns, 2 indexes)
- ✅ `categories` table (5 columns, with 7 default categories)
- ✅ `discounts` table (10 columns)
- ✅ `users` table (7 columns)

### Step 3: Verify Table Creation
1. Go to **Table Editor** in the left sidebar
2. You should see all 6 tables listed:
   - ✅ products
   - ✅ transactions
   - ✅ transaction_items
   - ✅ categories
   - ✅ discounts
   - ✅ users

3. Click on each table to verify the columns are created correctly

## Database Schema Details

### Products Table
- Stores all product information
- Columns: id, name, category, price, cost, quantity, image_url, barcode, sku, created_at, updated_at
- Supports: Base64 encoded images, barcode/SKU tracking, category organization

### Transactions Table
- Stores transaction summaries for each sale
- Columns: id, transaction_date, total_amount, discount_amount, tax_amount, payment_method, user_id, created_at
- Automatically records: timestamp, tax (5% hardcoded), discount applied, payment method

### Transaction Items Table
- Stores individual items sold in each transaction
- Columns: id, transaction_id, product_id, quantity, unit_price, discount, subtotal
- Maintains referential integrity with CASCADE delete

### Categories Table
- Pre-populated with 7 default sports shop categories
- Default Categories:
  - Sports Shoes (#FF6B6B - Red)
  - School Shoes (#4ECDC4 - Teal)
  - Travel Bags (#45B7D1 - Blue)
  - School Bags (#F7DC6F - Yellow)
  - Slippers (#BB8FCE - Purple)
  - Sandals (#85C1E2 - Light Blue)
  - Belts (#F8B88B - Orange)

### Discounts Table
- Stores discount rules (product-level, category-level, bundle)
- Supports percentage and fixed amount discounts
- Can set minimum quantity requirements

### Users Table
- For future multi-user support
- Supports role-based access: admin, manager, cashier
- Tracks last login and account status

## Important Notes

### Currency
- All prices are stored as DECIMAL(10, 2) in **Sri Lankan Rupees (LKR)**
- Display format: `/=` (e.g., 1,500/=)
- Tax rate: 5% (hardcoded in application)

### Image Storage
- Images are stored as **base64 encoded strings** in the `image_url` field
- Maximum recommended size: 500KB per image (for performance)
- Alternative: Use Supabase Storage bucket and store URLs

### Security
- Row Level Security (RLS) is NOT currently enabled
- For production, consider enabling RLS policies:
  - Admin: full access
  - Cashier: read products, write transactions
  - Manager: read-only analytics

### Backups
- Supabase automatically backs up your data
- Free tier: Daily backups
- Pro tier: Point-in-time recovery available

## Testing the Setup

### Test 1: Add a Product
1. Go to http://localhost:3000/products
2. Click "Add Product"
3. Fill in the form:
   - Name: "Test Shoe"
   - Category: "Sports Shoes"
   - Price: 2500
   - Cost: 1500
   - Quantity: 10
   - Upload an image (or use placeholder)
   - SKU: "TEST-001"
   - Barcode: "123456789"
4. Click "Save Product"
5. ✅ Product should appear in the table
6. ✅ Refresh the page - product should still be there
7. ✅ Check Supabase Table Editor → products → should see 1 row

### Test 2: Make a Transaction
1. Go to http://localhost:3000/pos
2. Click on the test product
3. Add to cart
4. Click "Checkout"
5. Select payment method
6. Complete sale
7. ✅ Transaction should appear in Transactions page
8. ✅ Check Supabase:
   - transactions table → 1 row
   - transaction_items table → 1 row with product details

### Test 3: Data Persistence
1. Add a product
2. Hard refresh the browser (Ctrl+F5)
3. ✅ Product should still be visible
4. ✅ Go to Transactions page - transactions should still be there

## Troubleshooting

### Error: "Relation does not exist"
**Cause:** Tables haven't been created yet
**Solution:** Run the `supabase_init.sql` script in SQL Editor

### Error: "Connection refused"
**Cause:** Invalid Supabase credentials
**Solution:** 
1. Check `.env` file for correct URLs and keys
2. Verify credentials in Supabase Dashboard → Settings → API

### Error: "Column does not exist"
**Cause:** Schema mismatch - old version of table structure
**Solution:** 
1. Delete existing tables in Supabase Table Editor
2. Run `supabase_init.sql` again from scratch

### Application shows "Loading products..." but data doesn't appear
**Cause:** Supabase connection issue or RLS policy blocking queries
**Solution:**
1. Check browser console for errors (F12 → Console)
2. Verify Supabase URL and key in `.env`
3. Check Supabase logs for query errors

## Next Steps

1. ✅ Run `supabase_init.sql` to create tables
2. ✅ Start the development server: `npm run dev`
3. ✅ Test adding products and making transactions
4. ✅ Verify data persists after page refresh
5. 🔄 (Optional) Enable Row Level Security for production
6. 🔄 (Optional) Set up Supabase Storage for image backups
7. 🔄 (Optional) Configure automated backups

## Support

If you encounter issues:
1. Check Supabase logs: Dashboard → Logs
2. Verify network connection: Browser DevTools → Network tab
3. Check application logs: Terminal where `npm run dev` is running
4. Review error messages in the application toast notifications

---

**Setup Complete!** 🎉

Your POS system is now ready to use. Start adding products and making sales!
