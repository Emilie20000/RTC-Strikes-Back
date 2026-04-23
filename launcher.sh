#!/bin/bash

set -euo pipefail

MODE=$1

if [ "$MODE" == "--prod" ]; then
    docker compose down -v
    echo "🚀 Mode PRODUCTION (Tauri Build & Launch)"
    
    rm -f frontend/src-tauri/target/release/bundle/appimage/*.AppImage
    
    echo "Lancement du Build Tauri..."
    cd frontend
    npm install --legacy-peer-deps
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
    docker compose down --remove-orphans
    
    echo "Lancement des services Backend (Dev)..."
    docker compose up --build -d backend pgadmin postgres redis

    echo "Vérification de la disponibilité du backend..."
    for _ in {1..30}; do
        if curl -sf "http://localhost:8080/api/hello" >/dev/null; then
            echo "✅ Backend disponible sur http://localhost:8080"
            break
        fi
        sleep 1
    done

    if ! curl -sf "http://localhost:8080/api/hello" >/dev/null; then
        echo "❌ Backend indisponible. Vérifie Docker (daemon, réseau, iptables), puis relance le script."
        exit 1
    fi
    
    # echo "Lancement de Tauri en mode Dev..."
    # cd frontend
    # npm install --legacy-peer-deps
    # npm run tauri dev

else
    echo "Usage: ./launcher.sh [--dev | --prod]"
    exit 1
fi
