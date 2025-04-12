FROM node:23-slim

RUN apt-get update && \
    apt-get install -yq procps docker git curl && \
    curl -L "https://github.com/docker/compose/releases/download/v2.24.6/docker-compose-linux-x86_64" -o /usr/local/bin/docker-compose && \
    chmod +x /usr/local/bin/docker-compose && \
    ln -s /usr/local/bin/docker-compose /usr/bin/docker-compose && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copier uniquement les fichiers nécessaires pour l'installation des dépendances
COPY . /app/

# Installer uniquement les dépendances de production
RUN npm install --global pm2 && npm install --global bun && cd /app && npm ci && npm run build && npm cache clean --force

# Rendre le script d'entrée exécutable
RUN chmod +x /app/docker/entrypoint.sh

# Exposer le port
EXPOSE 3000

# Définir le point d'entrée
CMD ["/bin/bash", "/app/docker/entrypoint.sh"]