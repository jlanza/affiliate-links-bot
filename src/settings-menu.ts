import { Context as TelegrafContext, Extra, Markup } from 'telegraf'
import { MenuTemplate, MenuMiddleware } from 'telegraf-inline-menu';
import TelegrafStatelessQuestion from 'telegraf-stateless-question';
import { logger } from './logger';

import type { AffiliateSQLiteDb } from './sqlitedb';

const menu = new MenuTemplate<TelegrafContext>(() => 'Main Menu\n' + new Date().toISOString())

async function getChatShop(ctx: TelegrafContext, shopName: string) {
  const chatId = (await ctx.getChat()).id;
  const db: AffiliateSQLiteDb = (ctx as any).data.db;
  const shopKey = db.getShopKeys([ shopName ])[0];  
  const affiliate = await db.getChatShop(chatId, shopKey);
  return { affiliate: affiliate, chatId, shopKey, db };  
}


async function getAffiliate(ctx: TelegrafContext, shopName: string) {
  const { affiliate: affiliate }  = await getChatShop(ctx, shopName);
  // To avoid button not to have text and not being displayed
  return affiliate.value || ' ';
}

const shopMenuTemplate = new MenuTemplate<TelegrafContext>(ctx => `Affiliate for ${ctx.match![1]}`)
const affiliateQuestion = new TelegrafStatelessQuestion('affiliate_question', async (ctx) => {
  try {
    const newAffiliate = ctx.message.text!;
    const chatId = ctx.message.chat.id;
    const shopRegex = new RegExp('(/configure_affiliates/shop:(.*)/)set$');
    const res = ctx.message.reply_to_message.entities![0].url!.match(shopRegex);
    // '/configure_affiliates/shop:Amazon/set',
    // '/configure_affiliates/shop:Amazon',
    // 'Amazon',
    const shopName = res![2];
    const menuPath = res![1];
    const db: AffiliateSQLiteDb = (ctx as any).data.db;
    const shopKey = db.getShopKeys([ shopName ])[0];
    const affiliate = await db.getChatShop(chatId, shopKey);
    affiliate.value = newAffiliate;
    await db.setChat(chatId, {[shopKey]: affiliate });
    //await replyMenuToContext(shopMenuTemplate, ctx, `${menuPath}/set`);
    // As from #119 path must end in /
    await menuMiddleware.replyToContext(ctx, menuPath)
    const msg = await ctx.reply(`New affiliate for ${shopName} set`, Extra.markup({
      remove_keyboard: true
    }));
    await ctx.deleteMessage(msg.message_id);
  } catch (e) {
    logger.error(e.stack);
    await ctx.answerCbQuery('Unable to apply new affiliate');
  }
});

export const affiliateQuestionMiddleware = affiliateQuestion.middleware();

let mainToggle: boolean = false
shopMenuTemplate.toggle('Enabled', 'status', {
	set: async (ctx, choice) => {
    const shopName = ctx.match![1];
    const { affiliate: affiliate, chatId, shopKey, db }  = await getChatShop(ctx, shopName);
    affiliate.enabled = choice;
    await db.setChat(chatId, {[shopKey]: affiliate });
		return true
	},
	isSet: async (ctx) => {
    const shopName = ctx.match![1];
    const { affiliate: affiliate }  = await getChatShop(ctx, shopName);
		return affiliate.enabled;
	}
});

shopMenuTemplate.interact(async (ctx) => getAffiliate(ctx, `${ctx.match![1]}`), 'set', {
  do: async (ctx, path) => {
    affiliateQuestion.replyWithMarkdown(ctx,
      'Please enter the new affiliate for ' + ctx.match![1] + '.[ ](http://t.me/#menupath'
      + path //ctx.match![0] 
      + ')');

    // ctx.replyWithMarkdown('Please enter the new affiliate for ' + ctx.match![1] 
    //   + '.[ ](http://t.me/#menupath' + path //ctx.match![0] 
    //   + ')' + affiliateQuestion.messageSuffixMarkdown, 
    //   Extra.markdown().markup(Markup.forceReply().oneTime())
    // );

    return false;
  }
});
shopMenuTemplate.interact('Default', 'default', {
  do: async (ctx) => {
    try {
      const chatId = ctx.callbackQuery!.message!.chat.id;
      const db: AffiliateSQLiteDb = (ctx as any).data.db;
      const shopKey = db.getShopKeys([ ctx.match![1] ] );
      await db.defaultChat(chatId, shopKey);
      await ctx.answerCbQuery('Default affiliate applied for ' + ctx.match![1]);
      return true;
    } catch (e) {
      logger.error(e.message);
      await ctx.answerCbQuery('Unable to apply default affiliate');
      return false;
    }

  }
});
shopMenuTemplate.interact('Clear', 'clear', {
  joinLastRow: true,
  do: async (ctx) => {
    try {
      const chatId = ctx.callbackQuery!.message!.chat.id;
      const db: AffiliateSQLiteDb = (ctx as any).data.db;
      const shopKey = db.getShopKeys([ ctx.match![1] ] );
      await db.clearChat(chatId, shopKey);
      await ctx.answerCbQuery('Affiliate cleared for ' + ctx.match![1]);
      return true;
    } catch (e) {
      logger.error(e.message);
      await ctx.answerCbQuery('Unable to clear affiliate for ' + ctx.match![1]);
      return false;
    }
  }
});

// shopMenuTemplate.manualRow(createBackMainMenuButtons())
shopMenuTemplate.interact('Back', 'backshop', {
  do: async ctx => {
    return '..';
  }
});

//menuTemplate.chooseIntoSubmenu('unique', Object.values(fullDomains).map(value => value.name), submenuTemplate)
const shopMenu = new MenuTemplate<TelegrafContext>('Configure affiliates')
shopMenu.chooseIntoSubmenu(
  'shop', 
  async (ctx) => await (ctx as any).data.db.getShopNames(),
  shopMenuTemplate, 
  { columns: 1 }
);

shopMenu.interact('Back', 'backshops', {
  do: async context => {
    return '..';
  }
});

menu.submenu('Configure affiliates', 'configure_affiliates', shopMenu);

menu.url('Source code', 'https://github.com/jlanza/affiliate-links-bot');

menu.url('Donate', 'https://www.paypal.me/jlanza');

// Not working
// menu.interact('Exit', 'exit', {
//   do: async (ctx) => {
//     await deleteMenuFromContext(ctx);
//     return true;
//   }
// });

export const menuMiddleware = new MenuMiddleware<TelegrafContext>('/', menu);

