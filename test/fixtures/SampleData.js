// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: © 2026 James Kirk Cropcho <numerate_penniless652@dralias.com>
import { Binary } from 'mongodb';

export default [{
  'name': 'Tom',
  'bio': 'A nice guy.',
  'pets': ['monkey', 'fish'],
  'someWeirdLegacyKey': 'I like Ike!'
}, {
  'name': 'Dick',
  'bio': 'I swordfight.',
  'birthday': new Date(1974,2,14)
}, {
  'name': 'Harry',
  'pets': 'egret',
  'birthday': new Date(1984,2,14)
}, {
  'name': 'Geneviève',
  'bio': 'Ça va?'
}, {
  'name': 'Jim',
  'someBinData': new Binary(Uint8Array.from([49, 50, 51, 52]))  //Binary.SUBTYPE_BYTE_ARRAY
}];
