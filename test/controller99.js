// Settings after all tests

import { dbService } from '../dist/api/services/endorser.db.service'
import testUtil from './util'
const creds = testUtil.ethrCredData

describe('99 - Settings after all tests', () => {
  it('should update registration limits', async () => {
    // This is in a test because anything outside "it" runs immediately; may be able to use "after".
    await dbService.registrationUpdateMaxClaimsForTests(creds[0].did, 10000)
    await dbService.registrationUpdateMaxRegsForTests(creds[0].did, 1000)
  })
})
