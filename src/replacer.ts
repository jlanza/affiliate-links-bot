import anchorme from "anchorme";
import { URL } from 'url';
import got from 'got';
import tinyurl from 'tinyurl';

import { AffiliateSQLiteDb } from "./sqlitedb";
import { FullDomain } from './types';

// Helper function to check whether the result is not null nor undefined
// https://stackoverflow.com/a/54738437
function ensure<T>(argument: T | undefined | null, message: string = 'This value was promised to be there.'): T {
  if (argument === undefined || argument === null) {
    throw new TypeError(message);
  }

  return argument;
}

export class AffiliateReplacer {
  private readonly _fullDomains: Array<FullDomain>;
  private readonly _shortDomains: Array<string>;
  private readonly _fullDomainsRegex: Array<string>;
  private readonly _shortDomainsRegex: string;

  private readonly _db: AffiliateSQLiteDb;

  constructor(db: AffiliateSQLiteDb, fullDomains: Array<FullDomain>, shortDomains: Array<string>) {
    this._fullDomainsRegex = fullDomains.map(item => `(?:${item.domains.join('|').replace(/\./g, '\\.')})$`);
    this._shortDomainsRegex = `(?:${shortDomains.join('|').replace(/\./g, '\\.')})$`;
    this._fullDomains = fullDomains.slice();
    this._shortDomains = shortDomains.slice();
    this._db = db;
  }

  private id(index: number) {
    return this._fullDomains[index].id;
  }

  private static async unshortenLink(link: string | URL): Promise<URL> {
    const response = await got.get(link, { followRedirect: false });
    return new URL(ensure(response.headers.location));
  }

  // It is very simple to create by my own, but easier to use package
  // https://tinyurl.com/create.php?url='+encodeURIComponent(link)
  private static async shortenLink(link: string | URL): Promise<URL> {
    const response = await tinyurl.shorten(link);
    return new URL(ensure(response));
  }

  public async parseAndModify(input: string, chatId: number): Promise<{ output: string, modified: boolean }> {
    const list = anchorme.list(input);
    if (!(Array.isArray(list) && list.length)) {
      return { output: input, modified: false };
    }

    // Only retrieve affiliates if URLs within the message
    const affiliates = await this._db.getChat(chatId);

    let output: string = '';
    let offset: number = 0;
    let modified: boolean = false;
    for (const i of list) {
      output += input.substring(offset, i.start);
      offset = i.end;

      const s: string = i.string;
      if (!anchorme.validate.url(s) || s.startsWith('ftp://')) {
        output += s;
        continue;
      }

      // TODO: Chech ssh:// or similar. It has to be done using 'extensions'
      // I guess it would be better to create URL and then check if error

      // Create a valid URL to be parsed
      let url: URL =
        !(s.startsWith('http://') || s.startsWith('https://'))
          ? new URL('https://' + s)
          : new URL(s)
        ;

      // Check if shortened link
      let isShortLink = false;
      if (url.hostname.match(this._shortDomainsRegex)) {
        url = await AffiliateReplacer.unshortenLink(url);
        isShortLink = true;
      }

      // Deal with full domain links
      //const domain = Object.values(fullDomainsRegex).find(value => {
      const domain = this._fullDomainsRegex.findIndex((item, index) => {
        //const regex = `(?:${value.domains.join('|').replace(/\./g, '\\.')})$`;
        return url.hostname.match(this._fullDomainsRegex[index]);
      });

      if (domain == -1 || affiliates[this.id(domain)].enabled === false) {
        output += s;
      } else {
        modified = true;
        url.searchParams.set(
          this._fullDomains[domain].queryparam, affiliates[this.id(domain)].value
        );
        // Should we shorten the link again?
        if (isShortLink) {
          url = await AffiliateReplacer.shortenLink(url);
        }

        output += url.toString();
      }
    }

    output += input.substring(offset);

    return { output, modified };
  }
}