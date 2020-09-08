import Koa from 'koa';
import cors from '@koa/cors';
import bodyParser from 'koa-bodyparser';
import Router from '@koa/router';

import dotEnvExtended from 'dotenv-extended';
const config = dotEnvExtended.load({includeProcessEnv:true, errorOnMissing: true, errorOnExtra: false});

import { createBot } from './bot';
import { logger } from './logger';

const BOT_WEBHOOK = process.env.BOT_WEBHOOK;
const BOT_TOKEN = process.env.BOT_TOKEN;

(async () => {
  const bot = await createBot(BOT_TOKEN!);

  if (BOT_WEBHOOK != '') {
    logger.info('Starting bot using webhook ', BOT_WEBHOOK);
    // Set telegram webhook
    bot.telegram.setWebhook(BOT_WEBHOOK!);

    const app = new Koa();
    app.use(cors());
    app.use(bodyParser());

    const router = new Router({
      prefix: '/api/v1',
    });

    //router.get('/', handleTelegramMessage);
    router.post('/', (ctx) => {
      // Must include status 
      ctx.status = 200;
      return bot.handleUpdate(ctx.request.body, ctx.res);
    });

    app.use(router.routes());
    app.use(router.allowedMethods());

    app.on('error', (err) => {
      logger.error('Koa captured error', err);
    });

    app.listen(process.env.PORT || 3000);

  } else {
    logger.info('Starting bot in polling mode');
    bot.launch();
  }
})();