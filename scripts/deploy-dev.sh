#!/bin/bash

# Nexus of Mind - Development Deployment Script
# Deploys the complete system for local development with enhanced integration testing

set -e

echo "🚀 Starting Nexus of Mind Development Deployment..."

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

# Create necessary directories
create_directories() {
    print_status "Creating necessary directories..."
    
    mkdir -p data/queen_memory
    mkdir -p data/queen_memory/compressed
    mkdir -p data/queen_memory/knowledge_base
    mkdir -p models
    mkdir -p logs/nginx
    mkdir -p logs/ai-backend
    mkdir -p logs/integration
    mkdir -p backups
    mkdir -p test-results
    
    print_success "Directories created"
}

# Generate environment file if it doesn't exist
generate_env_file() {
    print_status "Checking environment configuration..."
    
    if [ ! -f .env ]; then
        print_status "Creating .env file..."
        cat > .env << EOF
# Nexus of Mind - Development Environment Variables

# AI Backend Configuration
AI_BACKEND_URL=ws://localhost:8000/ws
AI_BACKEND_HTTP=http://localhost:8000
ENABLE_GPU=false
LOG_LEVEL=info
ENABLE_FILE_LOGGING=true
ENABLE_STRUCTURED_LOGGING=true
ENABLE_PERFORMANCE_LOGGING=true

# Database Configuration
POSTGRES_DB=nexus_mind
POSTGRES_USER=nexus_user
POSTGRES_PASSWORD=nexus_dev_password

# Redis Configuration
REDIS_PASSWORD=nexus_redis_password

# CORS Configuration
CORS_ORIGINS=http://localhost:3000,http://localhost:8080

# Development Settings
NODE_ENV=development
ENVIRONMENT=development

# Integration Testing
ENABLE_INTEGRATION_TESTS=true
TEST_TIMEOUT=60
EOF
        print_success ".env file created"
    else
        print_success ".env file already exists"
    fi
}

# Build and start services
start_services() {
    print_status "Building and starting services..."
    
    # Use docker-compose or docker compose based on availability
    if command -v docker-compose &> /dev/null; then
        COMPOSE_CMD="docker-compose"
    else
        COMPOSE_CMD="docker compose"
    fi
    
    # Build images
    print_status "Building Docker images..."
    $COMPOSE_CMD build
    
    # Start services
    print_status "Starting services..."
    $COMPOSE_CMD up -d
    
    print_success "Services started"
}

# Wait for services to be healthy
wait_for_services() {
    print_status "Waiting for services to be healthy..."
    
    # Wait for AI backend
    print_status "Waiting for AI backend..."
    for i in {1..30}; do
        if curl -f http://localhost:8000/health &> /dev/null; then
            print_success "AI backend is healthy"
            break
        fi
        
        if [ $i -eq 30 ]; then
            print_warning "AI backend health check timeout"
        fi
        
        sleep 2
    done
    
    # Wait for game client
    print_status "Waiting for game client..."
    for i in {1..30}; do
        if curl -f http://localhost:3000 &> /dev/null; then
            print_success "Game client is healthy"
            break
        fi
        
        if [ $i -eq 30 ]; then
            print_warning "Game client health check timeout"
        fi
        
        sleep 2
    done
}

# Run integration tests
run_integration_tests() {
    if [ "$1" = "--test" ] || [ "$1" = "-t" ]; then
        print_status "Running integration tests..."
        
        # Check if Python is available for integration tests
        if command -v python3 &> /dev/null; then
            cd server
            
            # Install test dependencies if needed
            if [ ! -f "test_requirements_installed" ]; then
                print_status "Installing test dependencies..."
                pip install websockets requests psutil &> /dev/null || true
                touch test_requirements_installed
            fi
            
            # Run integration test suite
            print_status "Executing integration test suite..."
            python3 integration_test_suite.py > ../test-results/integration_test_output.log 2>&1
            
            if [ $? -eq 0 ]; then
                print_success "Integration tests passed"
                
                # Show test summary if report exists
                if [ -f "integration_test_report.json" ]; then
                    print_status "Integration Test Summary:"
                    python3 -c "
import json
with open('integration_test_report.json', 'r') as f:
    report = json.load(f)
    summary = report['test_summary']
    print(f\"  Total Tests: {summary['total_tests']}\")
    print(f\"  Successful: {summary['successful_tests']}\")
    print(f\"  Failed: {summary['failed_tests']}\")
    print(f\"  Success Rate: {summary['success_rate']:.1%}\")
    print(f\"  Duration: {summary['total_duration']:.2f}s\")
" 2>/dev/null || print_status "Test report parsing failed"
                    
                    mv integration_test_report.json ../test-results/
                fi
            else
                print_warning "Integration tests failed - check logs for details"
                print_status "Test output saved to: test-results/integration_test_output.log"
            fi
            
            cd ..
        else
            print_warning "Python3 not available - skipping integration tests"
        fi
    fi
}

# Test system integration
test_system_integration() {
    print_status "Testing system integration..."
    
    # Test AI backend endpoints
    print_status "Testing AI backend endpoints..."
    
    # Test root endpoint
    if curl -f http://localhost:8000/ &> /dev/null; then
        print_success "Root endpoint accessible"
    else
        print_warning "Root endpoint not accessible"
    fi
    
    # Test health endpoint
    if curl -f http://localhost:8000/health &> /dev/null; then
        print_success "Health endpoint accessible"
    else
        print_warning "Health endpoint not accessible"
    fi
    
    # Test system status endpoint
    if curl -f http://localhost:8000/system/status &> /dev/null; then
        print_success "System status endpoint accessible"
    else
        print_warning "System status endpoint not accessible"
    fi
    
    # Test WebSocket connection (basic test)
    print_status "Testing WebSocket connectivity..."
    if command -v wscat &> /dev/null; then
        echo '{"type":"health_check","timestamp":1234567890}' | timeout 5 wscat -c ws://localhost:8000/ws &> /dev/null
        if [ $? -eq 0 ]; then
            print_success "WebSocket connection test passed"
        else
            print_warning "WebSocket connection test failed"
        fi
    else
        print_status "wscat not available - skipping WebSocket test"
    fi
}

# Show service status
show_status() {
    print_status "Service Status:"
    
    if command -v docker-compose &> /dev/null; then
        docker-compose ps
    else
        docker compose ps
    fi
    
    echo ""
    print_status "Service URLs:"
    echo "🎮 Game Client: http://localhost:3000"
    echo "🧠 AI Backend: http://localhost:8000"
    echo "📊 AI Backend Health: http://localhost:8000/health"
    echo "🔧 System Status: http://localhost:8000/system/status"
    echo "🗄️  PostgreSQL: localhost:5432"
    echo "🔴 Redis: localhost:6379"
    echo ""
    
    print_status "Integration Features:"
    echo "✅ End-to-end learning cycle"
    echo "✅ Comprehensive logging"
    echo "✅ Performance monitoring"
    echo "✅ Error recovery"
    echo "✅ Debug UI (in game client)"
    echo ""
}

# Show logs
show_logs() {
    if [ "$1" = "--logs" ] || [ "$1" = "-l" ]; then
        print_status "Showing service logs (Ctrl+C to exit)..."
        
        if command -v docker-compose &> /dev/null; then
            docker-compose logs -f
        else
            docker compose logs -f
        fi
    fi
}

# Show development commands
show_dev_commands() {
    print_status "Development Commands:"
    echo "📋 View logs: $0 --logs"
    echo "🧪 Run integration tests: $0 --test"
    echo "🔄 Restart services: docker-compose restart"
    echo "🛑 Stop services: docker-compose down"
    echo "🔨 Rebuild services: docker-compose up --build -d"
    echo "🧹 Clean up: docker-compose down -v --remove-orphans"
    echo ""
    echo "📊 Monitor logs:"
    echo "  AI Backend: tail -f logs/ai-backend/ai_backend.log"
    echo "  Integration: tail -f logs/integration/integration.log"
    echo "  Performance: tail -f logs/ai-backend/performance.log"
    echo ""
    echo "🔧 Debug endpoints:"
    echo "  System test: curl http://localhost:8000/system/test"
    echo "  Connection info: curl http://localhost:8000/connections"
    echo "  Message stats: curl http://localhost:8000/message-stats"
    echo ""
}

# Main deployment process
main() {
    echo "🧠 Nexus of Mind - AI-Powered RTS Game"
    echo "======================================"
    echo ""
    
    check_docker
    check_docker_compose
    create_directories
    generate_env_file
    start_services
    wait_for_services
    test_system_integration
    run_integration_tests "$1"
    show_status
    show_dev_commands
    
    print_success "Development deployment completed successfully!"
    echo ""
    
    show_logs "$1"
}

# Handle command line arguments
case "$1" in
    --help|-h)
        echo "Usage: $0 [options]"
        echo ""
        echo "Options:"
        echo "  --help, -h     Show this help message"
        echo "  --logs, -l     Show service logs after deployment"
        echo "  --test, -t     Run integration tests after deployment"
        echo ""
        echo "Examples:"
        echo "  $0              Deploy services"
        echo "  $0 --logs       Deploy and show logs"
        echo "  $0 --test       Deploy and run integration tests"
        echo ""
        exit 0
        ;;
esac

# Run main function with all arguments
main "$@"