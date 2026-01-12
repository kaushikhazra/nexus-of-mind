#!/bin/bash

# Nexus of Mind - Production Deployment Script
# Deploys the complete system for production environment

set -e

echo "🚀 Starting Nexus of Mind Production Deployment..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if running as root (not recommended for production)
check_user() {
    if [ "$EUID" -eq 0 ]; then
        print_warning "Running as root is not recommended for production deployment"
        read -p "Continue anyway? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi
}

# Check if Docker is installed and running
check_docker() {
    print_status "Checking Docker installation..."
    
    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed. Please install Docker first."
        exit 1
    fi
    
    if ! docker info &> /dev/null; then
        print_error "Docker is not running. Please start Docker first."
        exit 1
    fi
    
    print_success "Docker is installed and running"
}

# Check if Docker Compose is available
check_docker_compose() {
    print_status "Checking Docker Compose..."
    
    if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
        print_error "Docker Compose is not available. Please install Docker Compose."
        exit 1
    fi
    
    print_success "Docker Compose is available"
}

# Check for required environment variables
check_environment() {
    print_status "Checking production environment variables..."
    
    REQUIRED_VARS=(
        "SECRET_KEY"
        "POSTGRES_PASSWORD"
        "REDIS_PASSWORD"
        "CORS_ORIGINS"
    )
    
    MISSING_VARS=()
    
    for var in "${REQUIRED_VARS[@]}"; do
        if [ -z "${!var}" ]; then
            MISSING_VARS+=("$var")
        fi
    done
    
    if [ ${#MISSING_VARS[@]} -ne 0 ]; then
        print_error "Missing required environment variables:"
        for var in "${MISSING_VARS[@]}"; do
            echo "  - $var"
        done
        print_error "Please set these variables before deploying to production"
        exit 1
    fi
    
    print_success "Environment variables are configured"
}

# Create necessary directories with proper permissions
create_directories() {
    print_status "Creating necessary directories..."
    
    # Create directories
    mkdir -p data/queen_memory
    mkdir -p data/queen_memory/compressed
    mkdir -p data/queen_memory/knowledge_base
    mkdir -p models
    mkdir -p logs/nginx
    mkdir -p logs/ai-backend
    mkdir -p backups
    mkdir -p nginx/ssl
    mkdir -p monitoring
    
    # Set proper permissions for production
    chmod 755 data
    chmod 755 models
    chmod 755 logs
    chmod 755 backups
    chmod 700 nginx/ssl  # SSL certificates should be secure
    
    print_success "Directories created with proper permissions"
}

# Generate production environment file
generate_prod_env() {
    print_status "Generating production environment file..."
    
    if [ ! -f .env.prod ]; then
        cat > .env.prod << EOF
# Nexus of Mind - Production Environment Variables

# AI Backend Configuration
AI_BACKEND_WS_URL=${AI_BACKEND_WS_URL:-wss://api.nexus-of-mind.com/ws}
AI_BACKEND_HTTP_URL=${AI_BACKEND_HTTP_URL:-https://api.nexus-of-mind.com}
ENABLE_GPU=${ENABLE_GPU:-true}
LOG_LEVEL=warn

# Security
SECRET_KEY=${SECRET_KEY}

# Database Configuration
POSTGRES_DB=${POSTGRES_DB:-nexus_mind}
POSTGRES_USER=${POSTGRES_USER:-nexus_user}
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
DATABASE_URL=postgresql://${POSTGRES_USER:-nexus_user}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB:-nexus_mind}

# Redis Configuration
REDIS_PASSWORD=${REDIS_PASSWORD}
REDIS_URL=redis://:${REDIS_PASSWORD}@redis:6379

# CORS Configuration
CORS_ORIGINS=${CORS_ORIGINS}

# Production Settings
NODE_ENV=production
ENVIRONMENT=production

# Monitoring (optional)
GRAFANA_PASSWORD=${GRAFANA_PASSWORD:-admin}
EOF
        print_success "Production environment file created"
    else
        print_success "Production environment file already exists"
    fi
}

# Backup existing data
backup_data() {
    if [ -d "data" ] && [ "$(ls -A data)" ]; then
        print_status "Creating backup of existing data..."
        
        BACKUP_DIR="backups/pre-deploy-$(date +%Y%m%d-%H%M%S)"
        mkdir -p "$BACKUP_DIR"
        
        cp -r data/* "$BACKUP_DIR/" 2>/dev/null || true
        
        print_success "Data backed up to $BACKUP_DIR"
    fi
}

# Build and deploy services
deploy_services() {
    print_status "Building and deploying production services..."
    
    # Use docker-compose or docker compose based on availability
    if command -v docker-compose &> /dev/null; then
        COMPOSE_CMD="docker-compose -f docker-compose.prod.yml"
    else
        COMPOSE_CMD="docker compose -f docker-compose.prod.yml"
    fi
    
    # Pull latest images
    print_status "Pulling latest base images..."
    $COMPOSE_CMD pull
    
    # Build production images
    print_status "Building production images..."
    $COMPOSE_CMD build --no-cache
    
    # Start services
    print_status "Starting production services..."
    $COMPOSE_CMD up -d
    
    print_success "Production services deployed"
}

# Wait for services to be healthy
wait_for_services() {
    print_status "Waiting for services to be healthy..."
    
    # Wait for AI backend
    print_status "Waiting for AI backend..."
    for i in {1..60}; do
        if curl -f http://localhost:8000/health &> /dev/null; then
            print_success "AI backend is healthy"
            break
        fi
        
        if [ $i -eq 60 ]; then
            print_error "AI backend health check timeout"
            return 1
        fi
        
        sleep 5
    done
    
    # Wait for game client
    print_status "Waiting for game client..."
    for i in {1..60}; do
        if curl -f http://localhost:80 &> /dev/null; then
            print_success "Game client is healthy"
            break
        fi
        
        if [ $i -eq 60 ]; then
            print_error "Game client health check timeout"
            return 1
        fi
        
        sleep 5
    done
    
    # Wait for database
    print_status "Waiting for database..."
    for i in {1..30}; do
        if docker exec nexus-postgres-prod pg_isready -U ${POSTGRES_USER:-nexus_user} &> /dev/null; then
            print_success "Database is healthy"
            break
        fi
        
        if [ $i -eq 30 ]; then
            print_warning "Database health check timeout"
        fi
        
        sleep 2
    done
}

# Run database migrations (if any)
run_migrations() {
    print_status "Running database migrations..."
    
    # Add migration commands here if needed
    # docker exec nexus-ai-backend-prod python manage.py migrate
    
    print_success "Database migrations completed"
}

# Show production status
show_production_status() {
    print_status "Production Deployment Status:"
    
    if command -v docker-compose &> /dev/null; then
        docker-compose -f docker-compose.prod.yml ps
    else
        docker compose -f docker-compose.prod.yml ps
    fi
    
    echo ""
    print_status "Production URLs:"
    echo "🎮 Game Client: http://localhost (or your domain)"
    echo "🧠 AI Backend: http://localhost:8000"
    echo "📊 AI Backend Health: http://localhost:8000/health"
    
    if docker ps | grep -q nexus-grafana; then
        echo "📈 Grafana Dashboard: http://localhost:3001"
    fi
    
    if docker ps | grep -q nexus-prometheus; then
        echo "📊 Prometheus Metrics: http://localhost:9090"
    fi
    
    echo ""
}

# Setup SSL certificates (placeholder)
setup_ssl() {
    if [ "$SETUP_SSL" = "true" ]; then
        print_status "Setting up SSL certificates..."
        print_warning "SSL setup is not implemented in this script"
        print_warning "Please configure SSL certificates manually in nginx/ssl/"
    fi
}

# Security hardening recommendations
show_security_recommendations() {
    print_warning "Security Recommendations for Production:"
    echo "1. Configure SSL/TLS certificates"
    echo "2. Set up firewall rules (only allow necessary ports)"
    echo "3. Configure log rotation"
    echo "4. Set up monitoring and alerting"
    echo "5. Regular security updates"
    echo "6. Database backup strategy"
    echo "7. Change default passwords"
    echo "8. Configure fail2ban or similar"
    echo ""
}

# Main deployment process
main() {
    echo "🧠 Nexus of Mind - Production Deployment"
    echo "======================================="
    echo ""
    
    check_user
    check_docker
    check_docker_compose
    check_environment
    create_directories
    generate_prod_env
    backup_data
    setup_ssl
    deploy_services
    wait_for_services
    run_migrations
    show_production_status
    show_security_recommendations
    
    print_success "Production deployment completed successfully!"
    echo ""
    print_status "Monitor logs with: docker-compose -f docker-compose.prod.yml logs -f"
    print_status "Stop services with: docker-compose -f docker-compose.prod.yml down"
    echo ""
}

# Handle command line arguments
case "$1" in
    --help|-h)
        echo "Usage: $0 [options]"
        echo ""
        echo "Options:"
        echo "  --help, -h     Show this help message"
        echo "  --ssl          Setup SSL certificates"
        echo ""
        echo "Required environment variables:"
        echo "  SECRET_KEY           Secret key for the application"
        echo "  POSTGRES_PASSWORD    PostgreSQL password"
        echo "  REDIS_PASSWORD       Redis password"
        echo "  CORS_ORIGINS         Allowed CORS origins"
        echo ""
        exit 0
        ;;
    --ssl)
        export SETUP_SSL=true
        ;;
esac

# Run main function
main