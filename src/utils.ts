import { isNullOrUndefined, isString, isNumber, isUndefined } from 'util';


// https://stackoverflow.com/questions/17781472/how-to-get-a-subset-of-a-javascript-objects-properties
export function pick<T extends object, U extends keyof T>(obj: T, paths: U | Array<U>) {
  const items = Array.isArray(paths) ? paths : [ paths ];
  return items.reduce((o, k) => {
    if (!isUndefined(obj[k])) {
      o[k] = obj[k];
    }
    return o;
  }, Object.create(null));

  // return Object.fromEntries(
  //   Object.entries(obj)
  //     .filter(([key]) => paths.includes(key));
}

export function keyBy<T extends object, U extends keyof T>(objArray: Array<T>, key: U) {
  const out: Record<string | number, T> = Object.create(null);
  objArray.forEach(obj => {
    const k = obj[key];
    if (isString(k) || isNumber(k)) {
      out[k] = obj;
    } else {
      throw new TypeError(`Object value for  ${key} is neither string nor number`);
    }
  })

  return out;
}


export * as Utils from './utils';

