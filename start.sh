#!/bin/bash

echo "=================================================="
echo "SAL NORTHSIDE FUND MANAGER - QUICK START"
echo "=================================================="
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js first."
    exit 1
fi

# Check if Python 3 is installed
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 is not installed. Please install Python 3 first."
    exit 1
fi

echo "✅ Node.js version: $(node --version)"
echo "✅ Python version: $(python3 --version)"
echo ""

# Navigate to backend
cd backend

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing backend dependencies..."
    npm install
    echo ""
fi

# Check if database exists
if [ ! -f "sal_funds.db" ]; then
    echo "🗄️  Initializing database..."
    npm run init-db
    echo ""
fi

# Navigate to admin
cd ../admin

# Install Python dependencies
echo "📦 Installing Python dependencies..."
pip3 install -r requirements.txt --quiet
echo ""

# Back to backend
cd ../backend

echo "=================================================="
echo "🚀 STARTING BACKEND SERVER"
echo "=================================================="
echo ""
echo "Backend API: http://localhost:3000/api"
echo "Web Interface: http://localhost:3000"
echo ""
echo "To use the admin tool, open a new terminal and run:"
echo "  cd admin"
echo "  python3 admin.py"
echo ""
echo "Press Ctrl+C to stop the server"
echo "=================================================="
echo ""

npm start