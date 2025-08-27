// Small modular font library with categories
// Uses web-safe stacks to avoid external dependencies

const FONT_GROUPS = [
  {
    id: 'modern',
    label: 'Modern',
    fonts: [
      { id: 'helvetica', label: 'Helvetica / Arial', stack: 'Helvetica, Arial, sans-serif' },
      { id: 'inter', label: 'Inter (fallback to system)', stack: 'Inter, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif' }
    ]
  },
  {
    id: 'serif',
    label: 'Serif',
    fonts: [
      { id: 'georgia', label: 'Georgia', stack: 'Georgia, serif' },
      { id: 'times', label: 'Times New Roman', stack: '"Times New Roman", Times, serif' }
    ]
  },
  {
    id: 'handwritten',
    label: 'Handwritten',
    fonts: [
      { id: 'comic', label: 'Comic Sans', stack: '"Comic Sans MS", "Comic Sans", cursive' },
      { id: 'caveat', label: 'Cursive (generic)', stack: 'cursive' }
    ]
  },
  {
    id: 'futuristic',
    label: 'Futuristic',
    fonts: [
      { id: 'orbitron', label: 'Orbitron (fallbacks)', stack: 'Orbitron, "Segoe UI", Tahoma, Geneva, Verdana, sans-serif' },
      { id: 'monospace', label: 'Monospace', stack: '"Courier New", Courier, monospace' }
    ]
  }
]

export default FONT_GROUPS
