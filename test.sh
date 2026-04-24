#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== Advanced Test & Coverage System ===${NC}"

run_backend() {
    local use_local=$1
    echo -e "\n${BLUE}--- Running Backend Tests & Coverage ---${NC}"
    
    if [ "$use_local" = "true" ]; then
        echo -e "${BLUE}Mode: LOCAL machine${NC}"
        if [ -f .env ]; then
            export $(grep -v '^#' .env | xargs)
        fi
        cd backend && cargo tarpaulin --out Html --output-dir coverage
        cd ..
    else
        echo -e "${BLUE}Mode: DOCKER container${NC}"
        docker compose run --rm backend-test cargo tarpaulin --out Html --output-dir /usr/src/app/coverage
    fi
    echo -e "${GREEN}Backend coverage report generated in backend/coverage/tarpaulin-report.html${NC}"
}

run_frontend() {
    local use_local=$1
    echo -e "\n${BLUE}--- Running Frontend Tests & Coverage ---${NC}"
    
    if [ "$use_local" = "true" ]; then
        echo -e "${BLUE}Mode: LOCAL machine${NC}"
        if [ -f .env ]; then
            export $(grep -v '^#' .env | xargs)
        fi
        cd frontend && npm run test:coverage
        cd ..
    else
        echo -e "${BLUE}Mode: DOCKER container${NC}"
        if [ "$(docker ps -q -f name=frontend-dev)" ]; then
            docker compose exec frontend-dev npm run test:coverage
        else
            docker compose run --rm frontend-dev npm run test:coverage
        fi
    fi
    echo -e "${GREEN}Frontend coverage report generated in frontend/coverage/lcov-report/index.html${NC}"
}

USE_LOCAL="false"
if [[ " $* " == *" --local "* ]]; then
    USE_LOCAL="true"
fi

case "$1" in
    --backend)
        run_backend $USE_LOCAL
        ;;
    --frontend)
        run_frontend $USE_LOCAL
        ;;
    --all)
        run_backend $USE_LOCAL
        run_frontend $USE_LOCAL
        ;;
    *)
        echo "Usage: $0 {--backend|--frontend|--all} [--local]"
        exit 1
        ;;
esac
