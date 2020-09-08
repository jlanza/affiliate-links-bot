import { Telegraf, Context as TelegrafContext } from 'telegraf';
import { MessageEntity } from 'telegram-typings';
import { menuMiddleware, affiliateQuestionMiddleware } from './settings-menu';

import dotEnvExtended from 'dotenv-extended';
dotEnvExtended.load({includeProcessEnv:true, errorOnMissing: true, errorOnExtra: false});

import { logger } from './logger';

import { AffiliateSQLiteDb } from './sqlitedb';
import { AffiliateReplacer } from './replacer';

import {fullDomainsArray, shortDomains} from './config';


async function createDatabase() {
  const DATABASE_URL = process.env.DATABASE_URL;
  const db = new AffiliateSQLiteDb(DATABASE_URL!.toString(), fullDomainsArray);
  await db.initializeDatabase();
  return db;
}

function markdownTextLinkEntities(msg: string, entities: Array<MessageEntity>) {
  let output: string = '';
  let offset: number = 0;
  for (const entity of entities) {
    if (entity.type == 'text_link') {
      output += msg.substring(offset, entity.offset);
      output += '[' + msg.substr(entity.offset, entity.length) + ']';
      output += '(' + entity.url + ')';
      offset = entity.offset + entity.length;
    }
  }

  output += msg.substring(offset);

  return output;
}

async function handleMessage(ctx: TelegrafContext) {
  const msg = ctx.message!;
  let input = ctx.message!.text!;

  // TODO: Handle everything working with entities
  // Only handle text_links as the rest of the work will be done by Anchorme
  if (msg.entities) {
    input = markdownTextLinkEntities(input, msg.entities);
  }

  const replacer: AffiliateReplacer = (ctx as any).data.replacer;
  let { output: reply, modified } = await replacer.parseAndModify(input, msg.chat.id);

  // Prepend a message to inform of the modification
  if (modified) {
    reply = '_A message by _'
      + '[' + msg.from!.username + '](tg://user?id=' + msg.from!.id + ')'
      + '_ with affiliate links has been modified_\n\n'
      + reply;
    ctx.reply(reply, {
      reply_to_message_id: msg.reply_to_message ? msg.reply_to_message.message_id : 0,
      parse_mode: "Markdown",
    });
    ctx.deleteMessage(msg.message_id);
  }
}

async function handleNewChatMember(ctx: TelegrafContext, botId: number) {
  const isNewChat = ctx.message!.new_chat_members!.some(
    item => (item.is_bot && item.id === botId)
  );

  if (isNewChat) {
    const chatId = ctx.message!.chat.id;
    // Perform database initialization
    const db: AffiliateSQLiteDb = (ctx as any).db;
    await db.setChat(chatId, {});
  }
}

async function handleLeftChatMember(ctx: TelegrafContext, botId: number) {
  const left_chat_member = ctx.message!.left_chat_member!;
  const isExitChat =
    (left_chat_member.is_bot &&
      left_chat_member!.id == botId);

  if (isExitChat) {
    const chatId = ctx.message!.chat.id;
    // Perform database cleanup?
  }
}

async function handleSetAffiliate(ctx: TelegrafContext) {
  const msg = ctx.message!.text;
  const params = msg!.split(' ');
  params.shift();
  const [shop, newAffiliate] = params;

  const chatId = ctx.message!.chat.id;
  const db: AffiliateSQLiteDb = (ctx as any).data.db;
  const shopKeys = db.getShopKeys();
  if (!shopKeys.includes(shop)) {
    return ctx.reply(`Shop identifier ${shop ? shop : ''} not found`);
  }
  const affiliate = await db.getChatShop(chatId, shop);
  affiliate.value = newAffiliate;
  await db.setChat(chatId, {[shop]: affiliate });
  return ctx.reply(`Affiliate for *${db.getShopNames([shop])[0]}* updated with value *${newAffiliate}*`,
    {
      parse_mode: "Markdown"
    }
  );
}

async function handleEnableAffiliate(ctx: TelegrafContext) {
  const msg = ctx.message!.text;
  const params = msg!.split(' ');
  params.shift();
  const [shop, statusString] = params;
  const status: boolean = (statusString.toLowerCase() === 'true');

  const chatId = ctx.message!.chat.id;
  const db: AffiliateSQLiteDb = (ctx as any).data.db;
  const shopKeys = db.getShopKeys();
  if (!shopKeys.includes(shop)) {
    return ctx.reply(`Shop identifier ${shop} not found`);
  }
  const affiliate = await db.getChatShop(chatId, shop);
  affiliate.enabled = status;
  await db.setChat(chatId, {[shop]: affiliate });
  return ctx.reply(`Affiliate for *${db.getShopNames([shop])[0]}* *${status ? 'enabled' : 'disabled'}*`, 
    {
      parse_mode: "Markdown"
    }
  );
}


async function configureBot(bot: Telegraf<TelegrafContext>) {
  // Bot id can be extracted from token (split(':')[0]
  const botInfo = await bot.telegram.getMe();

  const db = await createDatabase(); 
  const replacer = new AffiliateReplacer(db, fullDomainsArray, shortDomains);
  (bot.context as any).data = {
    db: db,
    replacer: replacer
  }

  bot.command('ping', (ctx) => ctx.reply("hola"));

  // Handle received commands
  bot.command('set_affiliate', async (ctx) => await handleSetAffiliate(ctx));
  bot.command('enable_affiliate', async (ctx) => await handleEnableAffiliate(ctx));

  // bot.use(async (ctx, next) => {
  //   if (ctx.callbackQuery) {
  //     if (ctx.callbackQuery.data)
  //       console.log('another callbackQuery happened', ctx.callbackQuery.data.length, ctx.callbackQuery.data)
  //   }

  //   return next()
  // })

  // Menu
  bot.command('settings_menu', async (ctx) => menuMiddleware.replyToContext(ctx));
  bot.use(menuMiddleware.middleware());
  bot.use(affiliateQuestionMiddleware);

  // Handle received messages
  bot.on('new_chat_members', async (ctx) => handleNewChatMember(ctx, botInfo.id));
  bot.on('left_chat_member', async (ctx) => handleLeftChatMember(ctx, botInfo.id));
  bot.on('text', async (ctx) => handleMessage(ctx));

  await bot.telegram.setMyCommands([
		{command: 'settings_menu', description: 'Configure bot using menu'},
    {command: 'set_affiliate', description: 'Change an affiliate'},
    {command: 'enable_affiliate', description: 'Activate handling affiliate links'},
    {command: 'help', description: 'Show help'}
	])

  bot.catch((e: any) => {
    logger.error('Telegraf captured error', e.stack);
  });
  
  return bot;
}

export async function createBot(token: string) {
  const bot = new Telegraf(token);
  return await configureBot(bot);
}