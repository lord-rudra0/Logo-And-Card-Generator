import request from 'supertest'
import express from 'express'
import mlRoutes from '../routes/ml.js'

const app = express()
app.use(express.json())
app.use('/api/ml', mlRoutes)

describe('ML routes', () => {
  test('check-accessibility returns expected structure', async () => {
    const res = await request(app)
      .post('/api/ml/check-accessibility')
      .send({ elements: [{ id: 't', textColor: '#000000', bgColor: '#ffffff' }] })
    expect(res.statusCode).toBe(200)
    expect(res.body).toHaveProperty('success', true)
    expect(res.body.report).toHaveProperty('results')
    expect(Array.isArray(res.body.report.results)).toBe(true)
  })
})
