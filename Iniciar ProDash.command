#!/bin/bash
# Doble clic en Finder para iniciar el dashboard en este Mac.
cd "$(dirname "$0")" || exit 1

if ! command -v node >/dev/null 2>&1; then
	echo "Falta Node.js. Instálalo desde https://nodejs.org (versión LTS) y vuelve a abrir este archivo."
	read -r -p "Pulsa Enter para cerrar."
	exit 1
fi

if [ ! -f .env ]; then
	cp .env.example .env
	echo "Se creó el archivo .env. Complétalo con tus datos de Jira y una contraseña, guárdalo y vuelve a abrir este archivo."
	open -e .env
	read -r -p "Pulsa Enter para cerrar."
	exit 0
fi

if [ ! -d node_modules ] || [ package.json -nt node_modules ]; then
	echo "Instalando dependencias (solo la primera vez)…"
	npm install || exit 1
fi

npm run build || exit 1
PORT=$(grep -E '^PORT=' .env | cut -d= -f2)
(sleep 2 && open "http://localhost:${PORT:-3100}") &
npm start
