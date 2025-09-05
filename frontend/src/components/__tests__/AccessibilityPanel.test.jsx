import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import AccessibilityPanel from '../AccessibilityPanel.jsx'

// Mock the API module
vi.mock('../../utils/mlApi.js', () => {
  return {
    checkAccessibilityAPI: async (elements) => {
      return { results: elements.map((e) => ({ id: e.id, contrast: 4.5, passAA: true, passLarge: true, recommendation: 'OK' })) }
    }
  }
})

test('renders AccessibilityPanel and runs check', async () => {
  render(<AccessibilityPanel />)
  const runBtn = screen.getByText(/Run Check/i)
  fireEvent.click(runBtn)
  await waitFor(() => expect(screen.getByText(/Results/i)).toBeInTheDocument())
  expect(screen.getByText(/Contrast:/i)).toBeInTheDocument()
})
