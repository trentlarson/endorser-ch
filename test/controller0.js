
// Set Up Tests

import { dbService } from '../server/api/services/endorser.db.service'
import testUtil from './util'

const credentials = testUtil.credentials

describe('0 - Setup', () => {

  it('should register initial user', () =>
    dbService.registrationInsert({ did: testUtil.creds[0].did })
  )

})
