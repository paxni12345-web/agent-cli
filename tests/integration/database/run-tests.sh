#!/bin/bash

# Database Integration Test Setup Script
# Sets up test databases and runs integration tests

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DOCKER_COMPOSE_FILE="$SCRIPT_DIR/docker-compose.test.yml"

# Functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Docker is installed
check_docker() {
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed. Please install Docker first."
        exit 1
    fi

    if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
        log_error "Docker Compose is not installed. Please install Docker Compose first."
        exit 1
    fi
}

# Start test databases
start_databases() {
    log_info "Starting test databases..."

    if docker compose version &> /dev/null; then
        docker compose -f "$DOCKER_COMPOSE_FILE" up -d
    else
        docker-compose -f "$DOCKER_COMPOSE_FILE" up -d
    fi

    log_info "Waiting for databases to be ready..."
    sleep 10

    # Wait for PostgreSQL
    log_info "Waiting for PostgreSQL..."
    for i in {1..30}; do
        if docker exec test-postgres pg_isready -U test_user -d test_db &> /dev/null; then
            log_info "PostgreSQL is ready!"
            break
        fi
        if [ $i -eq 30 ]; then
            log_error "PostgreSQL failed to start"
            exit 1
        fi
        sleep 1
    done
}

# Stop test databases
stop_databases() {
    log_info "Stopping test databases..."

    if docker compose version &> /dev/null; then
        docker compose -f "$DOCKER_COMPOSE_FILE" down
    else
        docker-compose -f "$DOCKER_COMPOSE_FILE" down
    fi
}

# Clean up test databases and volumes
cleanup_databases() {
    log_info "Cleaning up test databases and volumes..."

    if docker compose version &> /dev/null; then
        docker compose -f "$DOCKER_COMPOSE_FILE" down -v
    else
        docker-compose -f "$DOCKER_COMPOSE_FILE" down -v
    fi

    log_info "Cleanup complete!"
}

# Set environment variables
set_env_vars() {
    export DB_HOST=localhost
    export DB_PORT=5432
    export DB_NAME=test_db
    export DB_USER=test_user
    export DB_PASSWORD=test_password
    export DB_SSL=false
    export NODE_ENV=test

    log_info "Environment variables set"
}

# Run integration tests
run_tests() {
    log_info "Running integration tests..."

    cd "$SCRIPT_DIR/../../.."

    if [ -n "$1" ]; then
        # Run specific test file
        npm test -- "tests/integration/database/$1"
    else
        # Run all integration tests
        npm test -- tests/integration/database
    fi
}

# Run tests with coverage
run_tests_coverage() {
    log_info "Running integration tests with coverage..."

    cd "$SCRIPT_DIR/../../.."
    npm run test:coverage -- tests/integration/database
}

# Display database logs
show_logs() {
    log_info "Showing database logs..."

    if docker compose version &> /dev/null; then
        docker compose -f "$DOCKER_COMPOSE_FILE" logs -f
    else
        docker-compose -f "$DOCKER_COMPOSE_FILE" logs -f
    fi
}

# Display help
show_help() {
    cat << EOF
Database Integration Test Script

Usage: $0 [COMMAND] [OPTIONS]

Commands:
    start           Start test databases
    stop            Stop test databases
    cleanup         Stop databases and remove volumes
    test [file]     Run integration tests (optionally specify test file)
    coverage        Run tests with coverage report
    logs            Show database logs
    help            Show this help message

Examples:
    $0 start                                    # Start databases
    $0 test                                     # Run all tests
    $0 test database-connection.integration.test.ts  # Run specific test
    $0 coverage                                 # Run with coverage
    $0 cleanup                                  # Clean everything up

Environment Variables:
    DB_HOST         Database host (default: localhost)
    DB_PORT         Database port (default: 5432)
    DB_NAME         Database name (default: test_db)
    DB_USER         Database user (default: test_user)
    DB_PASSWORD     Database password (default: test_password)

EOF
}

# Main script
main() {
    case "${1:-help}" in
        start)
            check_docker
            start_databases
            log_info "Test databases are running!"
            log_info "PostgreSQL: localhost:5432"
            log_info "MySQL: localhost:3306"
            log_info "Redis: localhost:6379"
            log_info "MongoDB: localhost:27017"
            ;;
        stop)
            check_docker
            stop_databases
            log_info "Test databases stopped"
            ;;
        cleanup)
            check_docker
            cleanup_databases
            ;;
        test)
            check_docker
            set_env_vars
            start_databases
            run_tests "$2"
            TEST_EXIT_CODE=$?
            stop_databases
            exit $TEST_EXIT_CODE
            ;;
        coverage)
            check_docker
            set_env_vars
            start_databases
            run_tests_coverage
            TEST_EXIT_CODE=$?
            stop_databases
            exit $TEST_EXIT_CODE
            ;;
        logs)
            check_docker
            show_logs
            ;;
        help|--help|-h)
            show_help
            ;;
        *)
            log_error "Unknown command: $1"
            show_help
            exit 1
            ;;
    esac
}

# Run main
main "$@"
