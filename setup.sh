#!/bin/bash

# 🚀 TutorConnect Automated Setup Script
# This script will set up your complete development environment

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Emojis for better UX
CHECK="✅"
ARROW="➡️"
ROCKET="🚀"
WARNING="⚠️"
ERROR="❌"

echo -e "${BLUE}${ROCKET} TutorConnect Setup${NC}"
echo "================================================"
echo "Setting up your TutorConnect development environment..."
echo ""

# Function to print status
print_status() {
    echo -e "${GREEN}${CHECK} $1${NC}"
}

print_step() {
    echo -e "\n${BLUE}${ARROW} $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}${WARNING} $1${NC}"
}

print_error() {
    echo -e "${RED}${ERROR} $1${NC}"
}

# Check prerequisites
print_step "Checking prerequisites..."

# Check Node.js
if ! command -v node &> /dev/null; then
    print_error "Node.js is not installed. Please install Node.js 18+ from https://nodejs.org/"
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    print_error "Node.js version 18+ is required. Current version: $(node -v)"
    exit 1
fi
print_status "Node.js $(node -v) detected"

# Check npm
if ! command -v npm &> /dev/null; then
    print_error "npm is not installed"
    exit 1
fi
print_status "npm $(npm -v) detected"

# Check Docker
if ! command -v docker &> /dev/null; then
    print_error "Docker is not installed. Please install Docker from https://docs.docker.com/get-docker/"
    exit 1
fi
print_status "Docker $(docker --version | cut -d' ' -f3 | cut -d',' -f1) detected"

# Check Docker Compose
if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    print_error "Docker Compose is not installed"
    exit 1
fi
print_status "Docker Compose detected"

echo ""

# Step 1: Install dependencies
print_step "Installing dependencies..."
npm install
print_status "Dependencies installed"

# Step 2: Environment setup
print_step "Setting up environment configuration..."

if [ ! -f .env ]; then
    if [ -f env.example ]; then
        cp env.example .env
        print_status "Created .env from template"
    else
        print_error "env.example file not found!"
        exit 1
    fi
else
    print_warning ".env file already exists, skipping..."
fi

# Generate JWT secrets if they're still default
if grep -q "your-super-secret-jwt-key" .env; then
    print_step "Generating JWT secrets..."
    
    # Check if openssl is available
    if command -v openssl &> /dev/null; then
        JWT_SECRET=$(openssl rand -base64 32)
        JWT_REFRESH_SECRET=$(openssl rand -base64 32)
        
        # Update .env file
        if [[ "$OSTYPE" == "darwin"* ]]; then
            # macOS
            sed -i '' "s/your-super-secret-jwt-key-at-least-32-characters-long-change-this/${JWT_SECRET}/" .env
            sed -i '' "s/your-super-secret-refresh-key-at-least-32-characters-long-change-this/${JWT_REFRESH_SECRET}/" .env
        else
            # Linux
            sed -i "s/your-super-secret-jwt-key-at-least-32-characters-long-change-this/${JWT_SECRET}/" .env
            sed -i "s/your-super-secret-refresh-key-at-least-32-characters-long-change-this/${JWT_REFRESH_SECRET}/" .env
        fi
        
        print_status "JWT secrets generated and updated in .env"
    else
        print_warning "OpenSSL not found. Please manually update JWT_SECRET and JWT_REFRESH_SECRET in .env"
        echo "You can generate secrets using: openssl rand -base64 32"
    fi
fi

# Step 3: Start Docker services
print_step "Starting database services with Docker..."

# Check if Docker is running
if ! docker info &> /dev/null; then
    print_error "Docker is not running. Please start Docker and try again."
    exit 1
fi

# Start services
docker-compose up -d postgres redis

print_status "PostgreSQL and Redis containers started"

# Wait for services to be ready
print_step "Waiting for database services to be ready..."
echo "This may take up to 30 seconds..."

# Wait for PostgreSQL
for i in {1..30}; do
    if docker exec tutorconnect-db pg_isready -U postgres > /dev/null 2>&1; then
        break
    fi
    echo -n "."
    sleep 1
done

if ! docker exec tutorconnect-db pg_isready -U postgres > /dev/null 2>&1; then
    print_error "PostgreSQL failed to start"
    exit 1
fi

# Wait for Redis
for i in {1..30}; do
    if docker exec tutorconnect-redis redis-cli ping > /dev/null 2>&1; then
        break
    fi
    echo -n "."
    sleep 1
done

if ! docker exec tutorconnect-redis redis-cli ping > /dev/null 2>&1; then
    print_error "Redis failed to start"
    exit 1
fi

echo ""
print_status "Database services are ready"

# Step 4: Setup database
print_step "Setting up database schema and seed data..."

# Build packages first
npm run build

# Setup database (generate, migrate, seed)
cd packages/database
npm run setup
cd ../..

print_status "Database setup completed with sample data"

# Step 5: Final verification
print_step "Verifying installation..."

# Check if we can connect to the database
if npm run --silent db:migrate > /dev/null 2>&1; then
    print_status "Database connection verified"
else
    print_warning "Database connection test failed, but setup appears complete"
fi

echo ""
echo "================================================"
echo -e "${GREEN}${ROCKET} Setup Complete!${NC}"
echo ""
echo "Your TutorConnect development environment is ready!"
echo ""
echo "📊 What was set up:"
echo "  ${CHECK} PostgreSQL database with full schema"
echo "  ${CHECK} Redis for caching and sessions"
echo "  ${CHECK} Sample data including test users"
echo "  ${CHECK} Environment configuration"
echo ""
echo "🔑 Test login credentials:"
echo "  Parent:    parent@example.com / password123"
echo "  Student:   student@example.com / password123" 
echo "  Tutor 1:   tutor1@example.com / password123"
echo "  Tutor 2:   tutor2@example.com / password123"
echo ""
echo "🚀 To start development:"
echo "  npm run dev                 # Start all services"
echo "  npm run db:studio           # Open database GUI"
echo ""
echo "📖 Useful URLs:"
echo "  API Health: http://localhost:3001/health"
echo "  Database Studio: http://localhost:5555"
echo "  PgAdmin: http://localhost:5050"
echo ""
echo "📚 Next steps:"
echo "  1. Run 'npm run dev' to start the development server"
echo "  2. Visit http://localhost:3001/health to verify the API"
echo "  3. Open Prisma Studio to explore the database"
echo "  4. Start building the frontend (see PROJECT_INITIALIZATION_PLAN.md)"
echo ""
echo "🆘 Need help? Check QUICK_START.md for troubleshooting"
echo ""
echo -e "${GREEN}Happy coding! 🎉${NC}" 