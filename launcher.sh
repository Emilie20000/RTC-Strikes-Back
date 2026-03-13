#!/bin/bash

echo "Nettoyage des services Docker..."
docker compose down

echo "Lancement des services Docker"
docker compose up --build -d

echo "Lancement de l'application Tauri..."
cd frontend
npm install
npm run tauri dev
