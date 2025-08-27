// Shared logo schema (frontend side)
// This defines the properties we collect and send to the backend AI.

export const defaultLogoSchema = {
  companyName: '',
  industry: 'general',
  initials: '',
  tagline: '',

  // Color + gradient
  colors: {
    primary: '#f97316',
    secondary: '#111827',
    background: 'transparent',
    gradient: {
      enabled: true,
      type: 'linear', // linear|radial
      angle: 45,
      stops: [
        { color: '#f97316', at: 0 },
        { color: '#111827', at: 100 }
      ]
    }
  },

  // Icon generation controls
  icon: {
    family: 'abstract', // abstract|monogram|geometric|leaf|shield|link|orbit|chevron
    style: 'duotone',
    strokeWidth: 10,
    cornerRadius: 8,
    symmetry: 'none', // none|radial|bilateral|grid
    rotation: 0,
    complexity: 'medium', // minimal|medium|rich
  },

  // Layout controls
  layout: {
    template: 'abstract-duotone-procedural',
    spacing: 'regular', // tight|regular|roomy
    alignment: 'center', // left|center|right
    iconPlacement: 'top', // top|left|right|center-only
  },

  // Typography
  typography: {
    font: 'Inter',
    weight: 700,
    letterSpacing: 0,
  },

  // Output options for server-side SVG generation (optional)
  output: {
    width: 256,
    height: 256,
    background: 'transparent'
  }
}

export function buildLogoRequestFromState(state) {
  // state is LogoCreator internal state; map to schema
  const {
    companyName = '',
    industry = 'general',
    initials = '',
    tagline = '',
    primaryColor,
    secondaryColor,
    backgroundColor,
    selectedExampleTemplateId,
    selectedFont,
    strokeWidth,
    cornerRadius,
    spacing,
    alignment,
    iconFamily,
    iconStyle,
    symmetry,
    rotation,
    complexity,
    gradient
  } = state || {}

  return {
    companyName,
    industry,
    initials,
    tagline,
    colors: {
      primary: primaryColor || defaultLogoSchema.colors.primary,
      secondary: secondaryColor || defaultLogoSchema.colors.secondary,
      background: backgroundColor ?? defaultLogoSchema.colors.background,
      gradient: gradient || defaultLogoSchema.colors.gradient,
    },
    icon: {
      family: iconFamily || defaultLogoSchema.icon.family,
      style: iconStyle || defaultLogoSchema.icon.style,
      strokeWidth: strokeWidth ?? defaultLogoSchema.icon.strokeWidth,
      cornerRadius: cornerRadius ?? defaultLogoSchema.icon.cornerRadius,
      symmetry: symmetry || defaultLogoSchema.icon.symmetry,
      rotation: rotation ?? defaultLogoSchema.icon.rotation,
      complexity: complexity || defaultLogoSchema.icon.complexity,
    },
    layout: {
      template: selectedExampleTemplateId || defaultLogoSchema.layout.template,
      spacing: spacing || defaultLogoSchema.layout.spacing,
      alignment: alignment || defaultLogoSchema.layout.alignment,
      iconPlacement: defaultLogoSchema.layout.iconPlacement,
    },
    typography: {
      font: selectedFont || defaultLogoSchema.typography.font,
      weight: defaultLogoSchema.typography.weight,
      letterSpacing: defaultLogoSchema.typography.letterSpacing,
    },
    output: defaultLogoSchema.output
  }
}
