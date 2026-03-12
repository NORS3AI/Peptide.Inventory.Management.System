#!/bin/bash

# Oath Peptide Inventory System - Development Startup Script
# This script starts both the backend API server and frontend development server

set -e

echo "🚀 Starting Oath Peptide Inventory System..."
echo ""

# Check if backend dependencies are installed
if [ ! -d "backend/node_modules" ]; then
    echo "📦 Installing backend dependencies..."
    cd backend
    npm install
    cd ..
fi

# Check if frontend dependencies are installed
if [ ! -d "frontend/node_modules" ]; then
    echo "📦 Installing frontend dependencies..."
    cd frontend
    npm install
    cd ..
fi

# Create backend data directory if it doesn't exist
mkdir -p backend/data

echo ""
echo "✅ Dependencies installed"
echo ""
echo "🔧 Starting backend server on http://localhost:3001..."
echo "   Database: backend/data/inventory.db"
echo ""

# Start backend in background
cd backend
npm start > ../backend.log 2>&1 &
BACKEND_PID=$!
cd ..

# Wait for backend to start
sleep 2

# Check if backend started successfully
if ps -p $BACKEND_PID > /dev/null 2>&1; then
    echo "✅ Backend server started (PID: $BACKEND_PID)"
else
    echo "❌ Backend server failed to start. Check backend.log for errors."
    exit 1
fi

echo ""
echo "🎨 Starting frontend development server on http://localhost:5173..."
echo ""

# Start frontend (this runs in foreground)
cd frontend
npm run dev

# When frontend stops (Ctrl+C), kill the backend
echo ""
echo "🛑 Shutting down backend server..."
kill $BACKEND_PID 2>/dev/null || true
echo "✅ All services stopped"
