FROM node:18-alpine

WORKDIR /app

# Установим зависимости системы и бинарь yt-dlp + ffmpeg
RUN apk add --no-cache ffmpeg curl tar xz
RUN curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp \
    && chmod +x /usr/local/bin/yt-dlp

# Копируем файлы проекта
COPY package*.json ./
COPY prisma ./prisma/

RUN npm ci

COPY . .

RUN npx prisma generate
RUN npm run build

EXPOSE 3000

CMD ["npm", "run", "start:prod"]
