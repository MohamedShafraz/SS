# Sports Shop POS System

A modern, responsive Point of Sale (POS) system built with Next.js, TypeScript, and Supabase. Designed for sports retail shops selling sports shoes, school shoes, travel bags, school bags, slippers, sandals, and belts.

## Features

✅ **POS Interface**
- Fast checkout with barcode scanning support
- Product search and quick add to cart
- Flexible discounts (product-level, category, bundle, custom pricing)
- Multiple payment methods (Cash, Card, UPI, Check)
- Print receipts

✅ **Product Management**
- Add/edit/delete products with images
- Manage inventory and stock levels
- SKU and barcode management
- Generate barcode stickers for labeling
- Category-based organization

✅ **Analytics & Dashboard**
- Real-time sales metrics
- Profit/Loss tracking
- Revenue by category
- Date-range and category-wise filtering
- Visual charts and reports

✅ **Transactions**
- Complete transaction history
- Filter by date and payment method
- Print/download receipts
- Transaction details view

✅ **Settings**
- Shop configuration
- Barcode scanner settings
- Notification preferences
- Tax rate management

✅ **Responsive Design**
- Works on desktop, tablet, and mobile
- Mobile-optimized POS interface
- Touch-friendly controls
- PWA ready

## Tech Stack

- **Frontend**: Next.js 15+ with React 18
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth
- **Charts**: Recharts
- **Barcodes**: jsbarcode
- **PDF Export**: jsPDF, html2canvas
- **Notifications**: react-hot-toast
- **State Management**: Zustand
- **Deployment**: Vercel

## Prerequisites

- Node.js 18+ and npm/yarn
- Supabase account
- Git (optional)

## Installation

### 1. Clone or Setup Project

```bash
cd d:\Next\POS
npm install
```

### 2. Setup Supabase

1. Visit [supabase.com](https://supabase.com) and create an account
2. Create a new project
3. Go to Project Settings > API to get your credentials
4. Copy the `URL` and `anon key`

### 3. Configure Environment Variables

Create a `.env.local` file in the project root:

```bash
NEXT_PUBLIC_POS_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_POS_SUPABASE_ANON_KEY=your_supabase_anon_key
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 4. Setup Supabase Tables

Go to Supabase SQL Editor and run the following SQL to create tables:

```sql
-- Products table
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  category VARCHAR(100) NOT NULL,
  price INT NOT NULL,
  cost INT NOT NULL,
  quantity INT DEFAULT 0,
  image_url TEXT,
  barcode VARCHAR(50) UNIQUE,
  sku VARCHAR(50) UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Transactions table
CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  transaction_date DATE NOT NULL,
  total_amount INT NOT NULL,
  discount_amount INT DEFAULT 0,
  tax_amount INT DEFAULT 0,
  payment_method VARCHAR(50) NOT NULL,
  user_id UUID,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Transaction Items table
CREATE TABLE transaction_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  transaction_id UUID NOT NULL REFERENCES transactions(id),
  product_id UUID NOT NULL REFERENCES products(id),
  quantity INT NOT NULL,
  unit_price INT NOT NULL,
  discount INT DEFAULT 0,
  subtotal INT NOT NULL
);

-- Discounts table
CREATE TABLE discounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type VARCHAR(50) NOT NULL, -- 'product', 'category', 'bundle'
  name VARCHAR(255) NOT NULL,
  percentage FLOAT,
  amount INT,
  products TEXT[], -- JSON array of product IDs
  categories TEXT[], -- JSON array of category names
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Users table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255),
  role VARCHAR(50) DEFAULT 'user',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX idx_products_category ON products(category);
CREATE INDEX idx_products_barcode ON products(barcode);
CREATE INDEX idx_transactions_date ON transactions(transaction_date);
```

## Development

### Run Development Server

```bash
npm run dev
```

Visit `http://localhost:3000` in your browser.

### Build for Production

```bash
npm run build
npm run start
```

### Lint Code

```bash
npm run lint
```

## Usage

### Dashboard
- View sales metrics, profit/loss, and inventory value
- Filter by date range and product category
- See visual charts and trends

### POS System
1. Scan product barcode or search for product
2. Products appear in cart
3. Adjust quantity and apply discounts
4. Select payment method
5. Complete checkout and print receipt

### Product Management
1. Add new products with images
2. Generate barcode stickers for inventory labels
3. Track stock levels
4. Edit product details
5. Manage categories

### Transactions
- View all past sales
- Print or download receipts
- Filter by date and payment method

### Settings
- Configure shop information
- Enable/disable barcode scanner features
- Set tax rates
- Notification preferences

## Barcode Integration

### Connecting Barcode Reader

1. Most USB barcode scanners work as keyboard input devices
2. Enable barcode scanner in Settings
3. Focus on POS barcode input field
4. Scan product barcode - item will be added automatically

### Generating Barcode Stickers

1. Go to Products page
2. Click barcode icon on any product
3. Generates printable barcode sticker
4. Print and attach to product shelf

## Deployment to Vercel

### Prerequisites
- GitHub account (optional - can deploy without Git)
- Vercel account

### Steps

1. **Push to GitHub (Optional)**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/yourusername/pos-system.git
   git branch -M main
   git push -u origin main
   ```

2. **Deploy to Vercel**
   - Visit [vercel.com](https://vercel.com)
   - Click "New Project"
   - Import your GitHub repository or deploy directly
   - Add environment variables:
     - `NEXT_PUBLIC_POS_SUPABASE_URL`
     - `NEXT_PUBLIC_POS_SUPABASE_ANON_KEY`
   - Click "Deploy"

3. **Access Live System**
   - Your POS system will be live at `https://yourproject.vercel.app`

## Project Structure

```
src/
├── app/
│   ├── layout.tsx           # Root layout
│   ├── page.tsx             # Home page
│   ├── globals.css          # Global styles
│   ├── dashboard/           # Dashboard page
│   ├── pos/                 # POS interface
│   ├── products/            # Product management
│   ├── transactions/        # Transaction history
│   ├── settings/            # Settings page
│   └── api/                 # API routes
├── components/
│   └── layout.tsx           # Sidebar & navigation
├── lib/
│   └── supabase.ts          # Supabase client
├── types/
│   └── index.ts             # TypeScript types
└── hooks/                   # Custom React hooks
```

## Features Coming Soon

- Inventory alerts
- Multi-user support with roles
- Advanced analytics and reports
- Supplier management
- Customer loyalty program
- Payment gateway integration (Stripe, Razorpay)
- Mobile app (React Native)
- Dark mode
- Multiple language support

## Troubleshooting

### Barcode Scanner Not Working
- Ensure scanner is connected and driver installed
- Check "Enable Scanner" in Settings
- Verify barcode format matches product barcodes
- Test with manual barcode input

### Connection Issues
- Check Supabase URL and API key in `.env.local`
- Verify Supabase project is active
- Check internet connection
- Clear browser cache

### Slow Performance
- Check database indexes
- Optimize images before uploading
- Use browser DevTools to profile performance
- Consider caching strategies

## License

MIT License

## Support

For issues and feature requests, please contact: support@sportsshop.com

## Author

Built with ❤️ for modern retail POS systems.
