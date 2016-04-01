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
  'someBinData': new Binary('1234')  //Binary.SUBTYPE_BYTE_ARRAY
}];
