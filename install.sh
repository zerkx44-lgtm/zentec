#!/bin/bash
# ============================================
# Script de instalación - Panel Zentec
# Ubuntu 24.04 - Ejecutar como root o con sudo
# ============================================

echo "=== Instalando dependencias ==="
apt update -y
apt install -y nginx curl

# Instalar Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

echo "=== Versiones instaladas ==="
node -v
npm -v
nginx -v

echo "=== Construyendo el panel ==="
cd /var/www/zentec-panel
npm install
npm run build

echo "=== Configurando Nginx ==="
cat > /etc/nginx/sites-available/zentec-panel << 'NGINX'
server {
    listen 80;
    server_name _;

    root /var/www/zentec-panel/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml text/javascript;
}
NGINX

ln -sf /etc/nginx/sites-available/zentec-panel /etc/nginx/sites-enabled/zentec-panel
rm -f /etc/nginx/sites-enabled/default

nginx -t && systemctl restart nginx
systemctl enable nginx

echo ""
echo "=== ¡Listo! ==="
echo "Panel disponible en: http://TU_IP_VPS"
echo "Para ver logs de Nginx: sudo tail -f /var/log/nginx/error.log"
