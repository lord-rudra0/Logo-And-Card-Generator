// Prebuilt SVG icons for the card editor
// Each icon is a function that returns an SVG element so we can set size/color via props

export const ICONS = [
  {
    id: 'phone',
    label: 'Phone',
    Svg: ({ size = 24, color = 'currentColor' }) => (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M22 16.92v3a2 2 0 0 1-2.18 2A19.79 19.79 0 0 1 3.11 5.18 2 2 0 0 1 5.1 3h3a2 2 0 0 1 2 1.72c.12.81.3 1.6.54 2.36a2 2 0 0 1-.45 2.11L9 10a16 16 0 0 0 5 5l.78-1.21a2 2 0 0 1 2.11-.45c.76.24 1.55.42 2.36.54A2 2 0 0 1 22 16.92z" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    )
  },
  {
    id: 'email',
    label: 'Email',
    Svg: ({ size = 24, color = 'currentColor' }) => (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="m22 6-10 7L2 6" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    )
  },
  {
    id: 'globe',
    label: 'Website',
    Svg: ({ size = 24, color = 'currentColor' }) => (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="12" cy="12" r="10" stroke={color} strokeWidth="2"/>
        <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" stroke={color} strokeWidth="2" strokeLinecap="round"/>
      </svg>
    )
  },
  {
    id: 'location',
    label: 'Location',
    Svg: ({ size = 24, color = 'currentColor' }) => (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M21 10c0 6-9 13-9 13s-9-7-9-13a9 9 0 1 1 18 0Z" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        <circle cx="12" cy="10" r="3" stroke={color} strokeWidth="2"/>
      </svg>
    )
  },
  {
    id: 'linkedin',
    label: 'LinkedIn',
    Svg: ({ size = 24, color = 'currentColor' }) => (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-4 0v7h-4v-7a6 6 0 0 1 6-6Z" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        <rect x="2" y="9" width="4" height="12" rx="1" stroke={color} strokeWidth="2"/>
        <circle cx="4" cy="4" r="2" stroke={color} strokeWidth="2"/>
      </svg>
    )
  },
  {
    id: 'twitter',
    label: 'Twitter',
    Svg: ({ size = 24, color = 'currentColor' }) => (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M23 3s-2 .9-3 1a4.8 4.8 0 0 0-8.2 3v1A11 11 0 0 1 3 4s-4 9 5 13a12.6 12.6 0 0 1-7 2c9 5 20 0 20-11.5 0-.3 0-.7-.03-1A7.7 7.7 0 0 0 23 3Z" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    )
  },
  {
    id: 'instagram',
    label: 'Instagram',
    Svg: ({ size = 24, color = 'currentColor' }) => (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="2" y="2" width="20" height="20" rx="5" stroke={color} strokeWidth="2"/>
        <circle cx="12" cy="12" r="3.5" stroke={color} strokeWidth="2"/>
        <circle cx="17.5" cy="6.5" r="1.5" fill={color}/>
      </svg>
    )
  },
  {
    id: 'github',
    label: 'GitHub',
    Svg: ({ size = 24, color = 'currentColor' }) => (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 2C6.48 2 2 6.6 2 12.26c0 4.5 2.87 8.32 6.84 9.67.5.1.68-.23.68-.5v-1.78c-2.78.62-3.37-1.2-3.37-1.2-.46-1.2-1.12-1.52-1.12-1.52-.92-.64.07-.63.07-.63 1.02.07 1.56 1.08 1.56 1.08.9 1.59 2.36 1.13 2.94.86.09-.67.35-1.13.64-1.39-2.22-.27-4.56-1.16-4.56-5.14 0-1.14.39-2.07 1.03-2.8-.1-.27-.45-1.35.1-2.82 0 0 .84-.27 2.76 1.07.8-.23 1.64-.35 2.48-.35s1.68.12 2.48.35c1.92-1.34 2.76-1.07 2.76-1.07.55 1.47.2 2.55.1 2.82.64.73 1.03 1.66 1.03 2.8 0 4-2.34 4.86-4.57 5.12.36.32.68.95.68 1.92v2.85c0 .28.18.61.69.5A10.03 10.03 0 0 0 22 12.26C22 6.6 17.52 2 12 2Z" stroke={color} strokeWidth="1.5"/>
      </svg>
    )
  },
  {
    id: 'whatsapp',
    label: 'WhatsApp',
    Svg: ({ size = 24, color = 'currentColor' }) => (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M20 12a8 8 0 0 1-11.96 6.92L4 21l2.08-3.96A8 8 0 1 1 20 12Z" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M8.5 10.5c.5 1.5 2.5 3.5 4 4l1.5-1.5c.2-.2.5-.3.8-.2l2 .7c.4.1.6.6.5 1a4 4 0 0 1-2.4 2.4c-3 .7-7-3.3-7.8-6.3a4 4 0 0 1 2.4-2.4c.4-.1.9.1 1 .5l.7 2c.1.3 0 .6-.2.8l-1.5 1.5Z" fill={color}/>
      </svg>
    )
  }
]

export const getIconById = (id) => ICONS.find(i => i.id === id)
