FROM node:18-alpine

WORKDIR /app


# Установим зависимости системы и бинарь yt-dlp + ffmpeg
RUN curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp \
    && chmod +x /usr/local/bin/yt-dlp \
    && ls -l /usr/local/bin/

RUN which yt-dlp
RUN yt-dlp --version

# Копируем файлы проекта
COPY package*.json ./
COPY prisma ./prisma/
COPY wait-for-it.sh /wait-for-it.sh

RUN npm ci

COPY . .

RUN npx prisma generate
RUN npm run build

EXPOSE 3000

CMD ["sh", "-c", "until pg_isready -h postgres -p 5432; do echo waiting for db; sleep 2; done; npm run start:prod"]


