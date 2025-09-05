// Simple in-memory job queue for PoC
const jobs = new Map()
let seq = 1

export function createJob(runner) {
  const id = String(Date.now()) + '-' + (seq++)
  const job = { id, status: 'queued', progress: 0, createdAt: Date.now(), updatedAt: Date.now(), result: null, error: null }
  jobs.set(id, job)

  // start processing asynchronously
  ;(async () => {
    try {
      job.status = 'running'
      job.updatedAt = Date.now()
      const update = (p) => { job.progress = Math.max(0, Math.min(100, Math.floor(p))); job.updatedAt = Date.now() }
      const res = await runner(update)
      job.result = res
      job.progress = 100
      job.status = 'done'
      job.updatedAt = Date.now()
    } catch (err) {
      job.status = 'failed'
      job.error = String(err && err.message) || String(err)
      job.updatedAt = Date.now()
    }
  })()

  return job
}

export function getJob(id) {
  return jobs.get(id) || null
}

export function listJobs() {
  return Array.from(jobs.values())
}
