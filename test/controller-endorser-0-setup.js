
// Set Up Tests

import { DateTime } from "luxon"
import { dbService } from '../dist/api/services/endorser.db.service'
import testUtil from './util'

describe('0 - Setup', () => {

  it('should register initial user', () => {
    // pretend they were registered last month so they can register everyone
    const lastMonthEpoch = DateTime.utc().minus({ month: 1 }).toSeconds();

    // beware: if you don't return the promise, the test will pass even if the promise rejects or errors out
    return dbService.registrationInsert({
      did: testUtil.ethrCredData[0].did,
      epoch: lastMonthEpoch,
      // make sure this isn't the default (which allows fewer registrations mid-month)
      maxRegs: 17, // later we bump this with dbService.registrationUpdateMaxRegsForTests
    })
  })

})
