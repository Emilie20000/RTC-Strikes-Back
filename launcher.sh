#!/bin/bash

MODE=$1

if [ "$MODE" == "--prod" ]; then
    echo "🚀 Mode PRODUCTION"
    echo "Nettoyage des services Docker..."
    docker compose down
    
    echo "Lancement des services Backend (Prod)..."
    docker compose up --build -d backend pgadmin redis frontend-web
    
    echo "Lancement du Build Tauri..."
    cd frontend
    npm install
    npm run tauri build
    echo "✅ Build terminé. AppImage disponible dans frontend/src-tauri/target/release/bundle/appimage/"

elif [ "$MODE" == "--dev" ]; then
    echo "🛠️ Mode DEVELOPMENT"
    echo "Nettoyage des services Docker..."
    docker compose down
    
    echo "Lancement des services Backend & Frontend (Dev)..."
    docker compose up --build -d backend pgadmin redis frontend-dev
    
    echo "Lancement de Tauri en mode Dev..."
    cd frontend
    npm install
    npm run tauri dev

else
    echo "Usage: ./launcher.sh [--dev | --prod]"
    exit 1
fi
