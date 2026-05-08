// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: © 2026 James Cropcho <numerate_penniless652@dralias.com>
import { ObjectId } from 'mongodb';

export default [{
  _id: new ObjectId('64b64c09f5f0f064d0000001'),
  name: 'Ada',
  status: 'active',
  rank: 3,
  profile: {
    address: {
      city: 'London',
      postalCode: 'NW1',
    },
    score: 8,
  },
  tags: ['founder', 'math'],
  audit: {
    createdAt: new Date('2021-01-01T00:00:00.000Z'),
  },
}, {
  _id: new ObjectId('64b64c09f5f0f064d0000002'),
  name: 'Grace',
  status: 'active',
  rank: 1,
  profile: {
    address: {
      city: 'Arlington',
      postalCode: '22207',
    },
    score: 10,
  },
  tags: ['navy', 'compiler'],
  audit: {
    createdAt: new Date('2021-01-02T00:00:00.000Z'),
  },
}, {
  _id: new ObjectId('64b64c09f5f0f064d0000003'),
  name: 'Katherine',
  status: 'inactive',
  rank: 2,
  profile: {
    score: 9,
  },
  tags: [],
  audit: {
    createdAt: new Date('2021-01-03T00:00:00.000Z'),
  },
}, {
  _id: new ObjectId('64b64c09f5f0f064d0000004'),
  name: 'Dorothy',
  status: 'active',
  rank: 4,
  profile: {
    address: {
      city: 'Washington',
      postalCode: '20001',
    },
    score: 7,
  },
  tags: ['programming'],
  audit: {
    createdAt: new Date('2021-01-04T00:00:00.000Z'),
  },
}, {
  _id: new ObjectId('64b64c09f5f0f064d0000005'),
  name: 'Mary',
  status: 'inactive',
  rank: 5,
  profile: {
    address: {
      city: 'Cambridge',
      postalCode: '02142',
    },
    score: 6,
  },
  tags: ['assembly', 'space'],
  audit: {
    createdAt: new Date('2021-01-05T00:00:00.000Z'),
  },
}];
