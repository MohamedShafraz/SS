# Deployment Guide

## Deploying POS System to Vercel + Supabase

This guide walks you through deploying the Sports Shop POS System to production using Vercel and Supabase.

## Prerequisites

- Git installed on your computer
- GitHub account (free at github.com)
- Vercel account (free at vercel.com)
- Supabase account (free at supabase.com)
- Project code ready

## Step 1: Setup Supabase Project

### 1.1 Create Supabase Project
1. Go to [supabase.com](https://supabase.com)
2. Sign up or log in
3. Click "New Project"
4. Enter project name: `sports-shop-pos`
5. Set region (choose closest to your location)
6. Set database password (save this securely)
7. Click "Create new project"

### 1.2 Get API Credentials
1. Wait for project to initialize (2-3 minutes)
2. Go to **Settings > API**
3. Copy the following:
   - `Project URL` → NEXT_PUBLIC_POS_SUPABASE_URL
   - `anon (public)` key → NEXT_PUBLIC_POS_SUPABASE_ANON_KEY

### 1.3 Create Database Tables
1. Go to **SQL Editor**
2. Click "New Query"
3. Copy and paste the entire content from `SUPABASE_SCHEMA.md`
4. Click "Run"
5. Wait for confirmation

### 1.4 Setup Storage for Images
1. Go to **Storage**
2. Click "New bucket"
3. Name: `product-images`
4. Make it **Public**
5. Click "Create bucket"

## Step 2: Push Code to GitHub

### 2.1 Initialize Git Repository
```bash
cd d:\Next\POS
git init
```

### 2.2 Create GitHub Repository
1. Go to [github.com](https://github.com)
2. Click **"+"** → **New repository**
3. Repository name: `sports-shop-pos`
4. Description: "Modern POS System for Sports Shop"
5. Choose **Public** (can be Private too)
6. Click **"Create repository"**

### 2.3 Add Remote and Push Code
```bash
# Add remote
git remote add origin https://github.com/YOUR_USERNAME/sports-shop-pos.git

# Add all files
git add .

# Commit
git commit -m "Initial commit: Sports Shop POS System"

# Push to GitHub
git branch -M main
git push -u origin main
```

## Step 3: Deploy to Vercel

### 3.1 Connect Vercel to GitHub
1. Go to [vercel.com](https://vercel.com)
2. Sign up or log in with GitHub
3. Click **"Add New"** → **Project**
4. Click **"Import Git Repository"**
5. Search for `sports-shop-pos`
6. Click **Import**

### 3.2 Configure Environment Variables
1. After clicking Import, you'll see Project Settings
2. Go to **Environment Variables**
3. Add these variables:
   ```
   NEXT_PUBLIC_POS_SUPABASE_URL = (your URL from Supabase)
   NEXT_PUBLIC_POS_SUPABASE_ANON_KEY = (your anon key from Supabase)
   ```
4. Click **"Add"** for each variable
5. For each variable, select environments:
   - ✓ Production
   - ✓ Preview
   - ✓ Development

### 3.3 Deploy
1. Click **"Deploy"**
2. Wait for deployment (usually 2-5 minutes)
3. You'll see "✓ Deployment complete"
4. Click the project URL to view live system

## Step 4: Test Live System

### 4.1 Initial Testing
1. Open your Vercel deployment URL
2. Test navigation and all pages
3. Try adding a product
4. Test POS interface
5. Check dashboard metrics

### 4.2 Mobile Testing
1. Open URL on mobile device
2. Test responsive design
3. Test barcode scanning (if available)
4. Test touch interactions

## Step 5: Setup Custom Domain (Optional)

### 5.1 Add Custom Domain to Vercel
1. In Vercel project settings
2. Go to **Domains**
3. Enter your domain (e.g., pos.yourdomain.com)
4. Follow DNS configuration steps

### 5.2 Point Domain to Vercel
1. Get Vercel's DNS records from the setup wizard
2. Go to your domain registrar (GoDaddy, Namecheap, etc.)
3. Update DNS records
4. Wait for DNS propagation (up to 24 hours)

## Step 6: Setup Auto-Deployment

Auto-deployment is already enabled! Every time you push to GitHub main branch:
1. Vercel automatically detects changes
2. Runs build process
3. Deploys to production

To deploy:
```bash
# Make changes
git add .
git commit -m "Update description"
git push origin main
```

## Step 7: Database Backups

### Enable Automatic Backups in Supabase
1. Go to **Settings > Backups**
2. Backups are automatic (daily)
3. Keep backups for 7 days (default)

### Manual Backup
1. Go to **Settings > Database**
2. Click **"Download dump"**
3. Choose format: SQL or Custom
4. Save backup file securely

## Step 8: Monitor & Maintain

### Vercel Analytics
1. Go to **Analytics** tab
2. Monitor:
   - Web Vitals
   - Performance
   - Status
   - Deployments

### Supabase Monitoring
1. Go to Supabase **Dashboard**
2. Monitor:
   - Database connections
   - API performance
   - Storage usage
   - Real-time events

## Troubleshooting

### 502 Bad Gateway Error
**Cause**: Deployment issue or environment variables not set
**Solution**:
1. Check environment variables in Vercel
2. Redeploy: Go to Deployments → Redeploy

### "Supabase connection failed"
**Cause**: Wrong credentials or Supabase project not initialized
**Solution**:
1. Verify NEXT_PUBLIC_POS_SUPABASE_URL and key in `.env.local`
2. Check Supabase project status
3. Ensure database tables exist

### Pages not loading
**Cause**: Build errors
**Solution**:
1. Check Vercel Deployments tab for error logs
2. Fix errors locally and push again
3. Check console for runtime errors

### Images not displaying
**Cause**: Storage bucket not set up correctly
**Solution**:
1. Verify product-images bucket exists
2. Make bucket public
3. Check image URLs in products

## Performance Optimization

### Image Optimization
- Use Vercel's Image Optimization
- Compress images before uploading
- Use WebP format when possible

### Database Optimization
1. Add indexes (already done in schema)
2. Archive old transactions periodically
3. Use database views for complex queries

### Caching Strategy
1. Enable Vercel Edge Caching
2. Cache dashboard data for 60 seconds
3. Invalidate cache on transactions

## Security Best Practices

✅ **Enable Supabase Security Features**
1. Set up RLS policies for multi-user support
2. Enable 2FA on Supabase and Vercel
3. Use strong passwords

✅ **Environment Variables**
- Never commit .env files
- Rotate API keys periodically
- Use Vercel environment variable encryption

✅ **HTTPS**
- All connections are HTTPS by default
- Certificate auto-renewal

✅ **Data Protection**
- Regular backups
- Encryption at rest and in transit
- Access logs available

## Scaling for Multiple Stores

To expand to multiple shop locations:

1. **Create separate Supabase projects** (one per store)
   - Isolates data
   - Better performance

2. **Or use single Supabase with store_id**
   - Add `store_id` column to tables
   - Use RLS policies to isolate data
   - More cost-effective

3. **Create Vercel preview environments** for testing

## Advanced: CI/CD Pipeline

For professional teams, setup automated testing:

```yaml
# .github/workflows/deploy.yml
name: Deploy
on:
  push:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Install & Build
        run: npm install && npm run build
      - name: Lint
        run: npm run lint
```

## Support & Resources

- **Vercel Docs**: https://vercel.com/docs
- **Supabase Docs**: https://supabase.com/docs
- **Next.js Docs**: https://nextjs.org/docs
- **Troubleshooting**: Check deployment logs in Vercel dashboard

## Next Steps

After deployment:

1. **Add more users** via Supabase Auth
2. **Customize branding** (colors, logo)
3. **Setup payment integration** (Stripe/Razorpay)
4. **Create mobile app** (React Native)
5. **Monitor analytics** and optimize

---

**Congratulations!** Your POS System is now live! 🎉

For help, check the logs or contact support@sportsshop.com
