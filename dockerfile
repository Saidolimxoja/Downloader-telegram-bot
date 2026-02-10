# ========================
# BASE IMAGE
# ========================
FROM node:18-alpine

# ========================
# INSTALL SYSTEM DEPENDENCIES
# ========================
RUN apk add --no-cache \
    python3 \
    py3-pip \
    ffmpeg \
    bash \
    curl \
    tar \
    xz \
    git \
    && python3 -m ensurepip \
    && pip3 install --upgrade pip

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

# ========================
# INSTALL NODE DEPENDENCIES
# ========================
RUN npm ci

# ========================
# INSTALL PYTHON DEPENDENCIES
# ========================
# yt-dlp через pip
RUN pip3 install yt-dlp

# ========================
# COPY REST OF PROJECT
# ========================
COPY . .

# ========================
# PRISMA GENERATE & BUILD
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
# Ждём PostgreSQL, потом запускаем NestJS
CMD ["sh", "-c", "/wait-for-it.sh $POSTGRES_HOST:$POSTGRES_PORT -- npm run start:prod"]
