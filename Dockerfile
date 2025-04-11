FROM node:23-slim

WORKDIR /app

# Copier uniquement les fichiers nécessaires pour l'installation des dépendances
COPY ./package.json ./package-lock.json /app/

# Installer uniquement les dépendances de production
RUN npm install --global pm2 && npm ci

# Copier le reste des fichiers nécessaires
COPY ./dist /app
COPY ./docker/entrypoint.sh /app/entrypoint.sh

# Rendre le script d'entrée exécutable
RUN chmod +x /app/entrypoint.sh

# Exposer le port
EXPOSE 3000

# Définir le point d'entrée
ENTRYPOINT ["/app/entrypoint.sh"]