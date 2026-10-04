# Embedding Evaluation

Tools for choosing the embedding spec, tuning its similarity threshold, and
checking that any runtime reproduces its vectors. See
`CHANGE/PLAN-interest-matching-architecture.md` sections 3, 7, and 8.

These scripts are not mocha specs (mocha loads only top-level `test/*.js`).
The engine's mocha tests are in `test/controller-partner-8-embedding-engine.js`.

| File | Purpose |
|---|---|
| `corpus.json` | Profiles, projects (plans), and queries in 12 languages, with human-judged pairs. |
| `candidates.js` | Candidate specs. The first entry is the production default from `src/api/services/embedding-specs.js`. |
| `run-eval.js` | Embeds the corpus with each candidate and writes `results.md` and `results.json`. |
| `generate-golden.js` | Writes `golden/<specId>.json`: fixed inputs and this server's vectors. |
| `golden/` | Golden vectors, used by the engine tests and by client conformance checks. |
| `generate-test-vectors.js` | Embeds 28 test profiles (two with empty text, so no vector) into `test-vectors.json`. |
| `test-vectors.json` | Vectors read by the group-matching tests (`test/controller-partner-3-group-matching-funs.js`) and the visualizer. |
| `review-judgments.js` | Shows each corpus pair without its grade, asks for yours, and lists where you differ (`npm run embedding:review`; answers go to `review-answers.json`, not committed). |
| `similarity-visualizer.js` | Writes an interactive radial view of pairwise similarities: `similarities.html` from the test profiles, or `corpus-similarities.html` (not committed) from the whole corpus with `--corpus`. |

## Running

From the repo root:

```bash
npm run embedding:eval                                       # all candidates
pkgx node test/embedding-eval/run-eval.js <specId> [...]     # a subset
npm run embedding:golden                                     # default spec only
npm run embedding:test-vectors                               # after changing the test profiles or the default spec
npm run embedding:visualize                                  # test profiles -> similarities.html
pkgx node test/embedding-eval/similarity-visualizer.js --corpus
```

Models download on first use into `EMBEDDING_MODEL_DIR` (default
`~/.cache/endorser-embedding-models`); all candidates together are about 1.7 GB.

## Corpus

- **Subjects** have `type` `profile` (`description`), `plan` (`name`,
  `description`), or `query` (`text`), and a `lang`.
- **Pairs** are `[subjectA, subjectB, grade, tag?]`:
  - `2` strong: show it when viewing the other.
  - `1` moderate: related; belongs lower in a list.
  - `0` weak or unrelated.
  - Tag `hard-negative`: the texts share words but not meaning ("python
    programming" vs. a snake breeder).
  - Tag `truncation`: the relevant content is at the end of a long text.
- Pairs whose subjects have different `lang` values count as cross-lingual.

Judgments are the point of the corpus. Edit them when you disagree; the metrics
follow.

## Metrics in `results.md`

- **Anchored**: for each subject, every two judged partners with different
  grades should be ordered by similarity; this is the fraction that are. It is
  the closest measure of "are the top matches for X the right ones". The
  cross-lingual, hard-negative, and truncation columns restrict it to
  comparisons that involve at least one pair of that kind.
- **AUC 2v0**: probability that a random strong pair scores above a random
  unrelated pair, across all anchors. Measures whether one global threshold can
  work.
- **Threshold (bal. acc.)**: the similarity cut that best separates strong from
  unrelated pairs, and its balanced accuracy. Candidate `minimumSimilarity`;
  it is specific to the spec.
- **Spearman**: rank correlation between similarity and grade over all pairs.
- **Mean sim 0 / 1 / 2**: average similarity per grade. Models differ widely in
  their baseline, which is why thresholds belong to the spec.
- **Load s / ms/text**: model load time and per-text embedding time on the
  machine that ran the evaluation.

The "Worst inversions" sections list, per spec, the orderings it got most
wrong: either model weaknesses or judgments worth revisiting.
