import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import stringify from 'json-stable-stringify'

import { Context as TelegrafContext } from 'telegraf'
import { isNullOrUndefined } from 'util';

import { Utils } from './utils';
import { FullDomain } from './types';

// export interface Chat {
//   [key: string]: string
// };


export interface Chat {
  [key:string]: {
    value: string,
    enabled: boolean
  }
}

export class AffiliateSQLiteDb {
  private readonly _url: string;
  // TODO: Change type to the appropiate one
  private _db: any;

  private readonly _defaultAffiliates: Chat; 
  private readonly _clearAffiliates: Chat;
  //private readonly _fullDomains: Record<string, FullDomain>;
  private readonly _fullDomains: Array<FullDomain>;

  constructor(url: string, domains: Array<FullDomain>) {
    this._url = url;

    let defaultAffiliate: Chat = {};
    let clearAffiliate: Chat = {};
    //let fulldomains: Record<string, FullDomain>;
    domains.forEach(item => {
      defaultAffiliate[item.id] = {
        value: item.default,
        enabled: true
      };
      clearAffiliate[item.id] = {
        value: '',
        enabled: true
      };
      //fullDomains[item.id] = item;
    });

    this._defaultAffiliates = defaultAffiliate;
    this._clearAffiliates = clearAffiliate;
    //this._fullDomains = fullDomains;
    this._fullDomains = domains.slice();
  }

  // Returns object like { string: string ...}
  public getDefaultAffiliates(shops?: Array<string>) {
    if (isNullOrUndefined(shops)) {
      return this._defaultAffiliates; 
    }
    return Utils.pick(this._defaultAffiliates, shops);
  }

  // Returns object like { string: string ...}
  public getClearAffiliates(shops?: Array<string>) {
    if (isNullOrUndefined(shops)) {
      return this._clearAffiliates; 
    }
    return Utils.pick(this._clearAffiliates, shops);
  }

  // Returns array [ string ]. If key is not found it is not returned
  public getShopNames(keys?: Array<string>) {
    if (isNullOrUndefined(keys)) {
      return this._fullDomains.map(item => item.name); 
    }

    return this._fullDomains.filter(item => keys.includes(item.id)).map(item => item.name);
  }

  // Returns array [ string ]. If namem is not found it is not returned
  public getShopKeys(names?: Array<string>) {
    if (isNullOrUndefined(names)) {
      return this._fullDomains.map(item => item.id); 
    }

    return this._fullDomains.filter(item => names.includes(item.name)).map(item => item.id);
  }

  public async initializeDatabase() {
    this._db = await open({
      filename: this._url,
      driver: sqlite3.cached.Database
      //driver: sqlite3.Database
    })

    await this._db.exec('CREATE TABLE IF NOT EXISTS chat_affiliates (id INTEGER PRIMARY KEY, shops TEXT NOT NULL)');
    await this._db.run('INSERT OR REPLACE INTO chat_affiliates VALUES(0, json(?))', stringify(this._defaultAffiliates));
  }

  public async getChat(id: number) {
    const chat = await this._db.get('SELECT shops FROM chat_affiliates WHERE id=?', id);
    return chat ? JSON.parse(chat.shops) : this._defaultAffiliates;
  }

  public async getChatShop(id: number, shop: string) {
    // This option is also valid and returns the value
    //const chat = await this._db.get(`SELECT json_extract(shops, \'$.${shop}.value\') AS list FROM chat_affiliates WHERE id=?`, id);
    const chat = await this._db.get(`SELECT json_extract(shops, \'$.${shop}\') AS list FROM chat_affiliates WHERE id=?`, id);
    // Check if shop is controlled by the program
    return chat ? JSON.parse(chat.list) : this._defaultAffiliates[shop];
  }

  // Merge with current values in database
  public async setChat(id: number, shops: Chat) {
    // Include shop affiliates that where not available
    const currentShops = { ...this._defaultAffiliates, ...await this.getChat(id)};
    await this._db.run('INSERT OR REPLACE INTO chat_affiliates VALUES(?, json_patch(?, ?))', id, stringify(currentShops), stringify(shops));
  }

  public async clearChat(id: number, shops: Array<string>) {
    await this.setChat(id, this.getClearAffiliates(shops));
  }

  public async defaultChat(id: number, shops: Array<string>) {
    await this.setChat(id, this.getDefaultAffiliates(shops));
  }

  public async enableChatShop(id: number, shops: Array<string>, enabled: boolean) {
    await this.setChat(id, 
      shops.reduce((acc, cur) => ({ ...acc, [cur]: { enabled: enabled }}), {}));
  }
}

// Won't be using it, but just to know that this can be done
export function middleware(): (ctx: TelegrafContext, next: () => Promise<void>) => Promise<void> {
  return async (ctx, next) => {
    const chatId = (await ctx.getChat()).id;
    const db: AffiliateSQLiteDb = (ctx as any).db;

    (ctx as any).state = await db.getChat(0);
    const before = (ctx as any).state;
    await next()
    const after = (ctx as any).state;
    // Debug
    // console.log('middleware', user)
    // console.log('before', before)
    // console.log('after ', after)

    // Database data has changed
    if (before !== after) {
      await (ctx as any).db.setChat(chatId, after);
    }
  }
}

// Testing functions
// (async () => {
//   const a: Chat = {
//     amazon: 'camino',
//   }
//   const db = new SetReferralBotDb('/tmp/jlanza.db');
//   await db.initializeDatabase();
//   await db.getChat(0);
//   await db.getChatReferral(0, 'amazon');
//   await db.setChat(2, a);
// })()
