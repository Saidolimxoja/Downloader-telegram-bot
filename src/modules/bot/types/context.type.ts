import { Context as GrammyContext } from 'grammy';

export interface SessionData {
  videoId?: string;
}

export type Context = GrammyContext & {
  session?: SessionData;
};