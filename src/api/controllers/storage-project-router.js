import { planService } from '../services/project.service'
import { hideDidsAndAddLinksToNetwork } from '../services/util-higher'

class PlanController {

  // gets info but not the full claim
  getPlanInfoByClaimIdOrHandleId(req, res) {
    planService
      .infoByClaimIdOrHandleId(req.params.id)
      .then(result => hideDidsAndAddLinksToNetwork(res.locals.authTokenIssuer, result, []))
      .then(r => {
        if (r) res.json(r);
        else res.status(404).end();
      })
      .catch(err => { console.log(err); res.status(500).json(""+err).end(); })
  }

  // gets info for multiple plans by handle IDs
  getPlanInfoByHandleIds(req, res) {
    try {
      let planHandleIds
      if (req.query.planHandleIds) {
        planHandleIds = JSON.parse(req.query.planHandleIds)
      } else {
        return res.status(400).json({ error: 'planHandleIds query parameter is required' })
      }

      if (!Array.isArray(planHandleIds)) {
        return res.status(400).json({ error: 'planHandleIds must be a JSON array' })
      }

      planService
        .infoByHandleIds(planHandleIds)
        .then(results => {
          // Apply hideDidsAndAddLinksToNetwork to each result
          const processedResults = results.map(result => 
            hideDidsAndAddLinksToNetwork(res.locals.authTokenIssuer, result, [])
          )
          return Promise.all(processedResults)
        })
        .then(processedResults => {
          res.json(processedResults)
        })
        .catch(err => { 
          console.log(err); 
          res.status(500).json(""+err).end(); 
        })
    } catch (error) {
      res.status(400).json({ error: 'Invalid JSON in planHandleIds parameter' })
    }
  }

}
const planController = new PlanController()





import * as express from 'express'

const planRouter = express
  .Router()
  .all('*', function (req, res, next) {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
    next();
  })

/**
 * Retrieve multiple plans by their handle IDs.
 *
 * @group storage of projects - Project storage
 * @route GET /api/plans
 * @param {string} planHandleIds.query.required - JSON array of plan handle IDs to retrieve
 * @returns {array.PlanSummary} Array of PlanSummary data for existing plans
 */
// This comment makes doctrine-file work with babel. See API docs after: npm run compile; npm start
  .get('/', planController.getPlanInfoByHandleIds)

/**
 * Retrieve the latest version of a plan based on the persistent ID.
 * The ID is typically supplied by the initial declaration of the plan;
 * if not, the claim ID is used. See handleId in the result after creation.
 *
 * @group storage of projects - Project storage
 * @route GET /api/plan/{id}
 * @param {string} id.path.required - the ID of the PlanAcation record to retrieve
 * @returns {PlanSummary} PlanSummary data if it exists (or 404)
 */
// This comment makes doctrine-file work with babel. See API docs after: npm run compile; npm start
  .get('/:id', planController.getPlanInfoByClaimIdOrHandleId)





module.exports = planRouter
