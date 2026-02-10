# ========================
# BASE IMAGE
# ========================
FROM node:18-alpine

# ========================
# INSTALL SYSTEM DEPENDENCIES
# ========================
RUN apk add --no-cache python3 py3-pip ffmpeg bash curl \
    && python3 -m ensurepip \
    && pip3 install --upgrade pip \
    && pip3 install yt-dlp \
    && ln -s /usr/local/lib/python3.12/site-packages/yt_dlp/__main__.py /usr/local/bin/yt-dlp \
    && chmod +x /usr/local/bin/yt-dlp

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
RUN which yt-dlp
RUN yt-dlp --version
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
