import { FullDomain } from './types';

export const fullDomainsArray: Array<FullDomain> = [
  {
    id: 'amazon',
    name: 'Amazon',
    domains: ['amazon.com', 'amazon.es'],
    queryparam: 'tag',
    default: 'amazon-jlanza-21'
  },
  {
    id: 'gearbest',
    name: 'Gearbest',
    domains: ['gearbest.com'],
    queryparam: 'lkid',
    default: 'gb-jlanza-21'
  },
  // Alibaba, aliexpress, etc. create an specific link
  // Have to look on how to create it with an API
];

export const shortDomains: Array<string> = [
  'tiny.cc',
  'bit.ly',
  'amzn.to',
  'amzn.com'
]
