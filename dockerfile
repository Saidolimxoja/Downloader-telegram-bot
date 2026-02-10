# ========================
# BASE IMAGE
# ========================
FROM node:22-bookworm-slim

# ========================
# SYSTEM DEPENDENCIES
# ========================
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 python3-venv python3-pip ffmpeg bash curl git \
    && rm -rf /var/lib/apt/lists/*

# ========================
# CREATE PYTHON VENV
# ========================
RUN python3 -m venv /opt/venv

# Делаем venv доступным в runtime (очень важно!)
ENV PATH="/opt/venv/bin:$PATH"

# ========================
# INSTALL PYTHON PACKAGES
# ========================
RUN pip install --no-cache-dir --upgrade pip yt-dlp

# Проверка (оставляем для отладки, можно убрать позже)
RUN which yt-dlp && yt-dlp --version

# ========================
# WORKDIR
# ========================
WORKDIR /app

# ========================
# COPY PROJECT FILES
# ========================
COPY package*.json ./
COPY prisma ./prisma/
COPY wait-for-it.sh /wait-for-it.sh

# Копируем куки-файл (теперь он всегда будет в контейнере)
COPY youtube_cookies.txt ./youtube_cookies.txt

# ========================
# INSTALL NODE DEPENDENCIES
# ========================
RUN npm ci --omit=dev

# ========================
# COPY REST OF PROJECT
# ========================
COPY . .

# ========================
# PRISMA & BUILD
# ========================
RUN npx prisma generate
RUN npm run build

# ========================
# EXPOSE PORT
# ========================
EXPOSE 3000

# ========================
# START COMMAND
# ========================
CMD ["sh", "-c", "/wait-for-it.sh $POSTGRES_HOST:$POSTGRES_PORT -- npm run start:prod"]