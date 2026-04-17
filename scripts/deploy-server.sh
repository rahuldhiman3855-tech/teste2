#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/opt/perplexity-partner"
REPO_URL="git@github.com:rahuldhiman3855-tech/teste2.git"
SERVER_IP="216.23.92.96"
HOSTNAME_NAME="rdman-hk"
NVIDIA_API_KEY="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"
SUPABASE_PROJECT_ID="mniqfqaqqxqzqtoqbcda"
SUPABASE_URL="https://mniqfqaqqxqzqtoqbcda.supabase.co"
SUPABASE_PUBLISHABLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1uaXFmcWFxcXhxenF0b3FiY2RhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjcxNTg5NDcsImV4cCI6MjA4MjczNDk0N30.jvY1ZR5UKeqfAyWNtjSwEBgnzelliH4DNfrkxNscjLg"

: "${NVIDIA_API_KEY:?Set NVIDIA_API_KEY before running this script.}"

require_root() {
  if [ "${EUID:-$(id -u)}" -ne 0 ]; then
    echo "Run this script as root." >&2
    exit 1
  fi
}

install_packages() {
  apt update
  apt install -y git nginx python3-venv python3-pip build-essential curl
}

install_node() {
  if ! command -v node >/dev/null 2>&1 || ! node -e 'process.exit(Number(process.versions.node.split(".")[0]) >= 20 ? 0 : 1)'; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt install -y nodejs
  fi
}

fix_hosts() {
  if ! grep -q "${HOSTNAME_NAME}" /etc/hosts; then
    printf "127.0.0.1 localhost\n127.0.1.1 %s\n" "${HOSTNAME_NAME}" >> /etc/hosts
  fi
}

prepare_repo() {
  mkdir -p "${APP_DIR}"
  if [ ! -d "${APP_DIR}/.git" ]; then
    git clone "${REPO_URL}" "${APP_DIR}"
  fi
}

write_frontend_env() {
  cat >"${APP_DIR}/.env.production" <<EOF
VITE_SUPABASE_PROJECT_ID="${SUPABASE_PROJECT_ID}"
VITE_SUPABASE_PUBLISHABLE_KEY="${SUPABASE_PUBLISHABLE_KEY}"
VITE_SUPABASE_URL="${SUPABASE_URL}"
VITE_RAG_API_URL="http://${SERVER_IP}/rag"
VITE_CHAT_FUNCTION_URL="http://${SERVER_IP}/functions/v1/chat"
EOF
}

build_frontend() {
  cd "${APP_DIR}"
  npm ci
  NODE_OPTIONS='--max-old-space-size=1024' npm run build
}

setup_rag_venv() {
  cd "${APP_DIR}/rag-pipeline"
  if [ ! -d .venv ]; then
    python3 -m venv .venv
  fi
  . .venv/bin/activate
  pip install --upgrade pip
  pip install -r requirements.txt
  pip install gunicorn
  deactivate
}

write_systemd_env() {
  cat >/etc/perplexity-partner.env <<EOF
VITE_SUPABASE_PROJECT_ID=${SUPABASE_PROJECT_ID}
VITE_SUPABASE_PUBLISHABLE_KEY=${SUPABASE_PUBLISHABLE_KEY}
VITE_SUPABASE_URL=${SUPABASE_URL}
VITE_RAG_API_URL=http://127.0.0.1:8080
VITE_CHAT_FUNCTION_URL=http://127.0.0.1:8787/functions/v1/chat
NVIDIA_API_KEY=${NVIDIA_API_KEY}
EOF
  chmod 600 /etc/perplexity-partner.env
}

write_rag_service() {
  cat >/etc/systemd/system/rag-pipeline.service <<EOF
[Unit]
Description=RAG Pipeline
After=network.target

[Service]
Type=simple
WorkingDirectory=${APP_DIR}/rag-pipeline
EnvironmentFile=/etc/perplexity-partner.env
ExecStart=${APP_DIR}/rag-pipeline/.venv/bin/gunicorn -w 1 -b 127.0.0.1:8080 app:app
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF
}

write_proxy_service() {
  cat >/etc/systemd/system/chat-proxy.service <<EOF
[Unit]
Description=Chat Proxy
After=network.target rag-pipeline.service

[Service]
Type=simple
WorkingDirectory=${APP_DIR}
EnvironmentFile=/etc/perplexity-partner.env
Environment=CHAT_PROXY_HOST=127.0.0.1
Environment=CHAT_PROXY_PORT=8787
ExecStart=/usr/bin/node ${APP_DIR}/scripts/chat-proxy.mjs
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF
}

write_nginx_config() {
  cat >/etc/nginx/sites-available/perplexity-partner <<EOF
server {
    listen 80;
    server_name ${SERVER_IP};

    root ${APP_DIR}/dist;
    index index.html;

    location / {
        try_files \$uri /index.html;
    }

    location /functions/v1/chat {
        proxy_pass http://127.0.0.1:8787/functions/v1/chat;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    location /rag/ {
        proxy_pass http://127.0.0.1:8080/;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF

  ln -sf /etc/nginx/sites-available/perplexity-partner /etc/nginx/sites-enabled/perplexity-partner
  rm -f /etc/nginx/sites-enabled/default
  nginx -t
}

enable_services() {
  systemctl daemon-reload
  systemctl enable --now rag-pipeline
  systemctl enable --now chat-proxy
  systemctl restart nginx
}

main() {
  require_root
  install_packages
  install_node
  fix_hosts
  prepare_repo
  write_frontend_env
  build_frontend
  setup_rag_venv
  write_systemd_env
  write_rag_service
  write_proxy_service
  write_nginx_config
  enable_services

  cat <<MSG
Deployment complete.

App: http://${SERVER_IP}/
RAG: http://${SERVER_IP}/rag/
Chat: http://${SERVER_IP}/functions/v1/chat
MSG
}

main "$@"
