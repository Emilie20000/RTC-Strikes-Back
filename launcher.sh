#!/bin/bash

MODE=$1

if [ "$MODE" == "--prod" ]; then
    docker compose down -v
    echo "🚀 Mode PRODUCTION (Tauri Build & Launch)"
    
    rm -f frontend/src-tauri/target/release/bundle/appimage/*.AppImage
    
    echo "Lancement du Build Tauri..."
    cd frontend
    npm install
    IS_TAURI=true npm run tauri build
    
    APP_IMAGE=$(find src-tauri/target/release/bundle/appimage -name "*.AppImage" | head -n 1)
    
    if [ -n "$APP_IMAGE" ]; then
        echo "✅ Build terminé : $APP_IMAGE"
        echo "🚀 Attribution des permissions et lancement..."
        chmod +x "$APP_IMAGE"
        ./"$APP_IMAGE"
    else
        echo "❌ Erreur : AppImage non trouvé."
        exit 1
    fi

elif [ "$MODE" == "--dev" ]; then
    echo "🛠️ Mode DEVELOPMENT"
    echo "Nettoyage des services Docker..."
    docker compose down
    
    echo "Lancement des services Backend & Frontend (Dev)..."
    docker compose up --build -d backend pgadmin redis frontend-dev
    
    # echo "Lancement de Tauri en mode Dev..."
    # cd frontend
    # npm install
    # npm run tauri dev

else
    echo "Usage: ./launcher.sh [--dev | --prod]"
    exit 1
fi
