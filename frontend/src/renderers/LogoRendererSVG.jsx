import React, { forwardRef } from 'react'

// A simple SVG renderer that takes a template definition and data
// Props:
// - template: { id, label, render(props) => JSX <svg> }
// - companyName, initials, primaryColor, secondaryColor, font, iconOptions, layoutOptions, gradient
// Forward ref is attached to the root <svg> for exporting outerHTML
const LogoRendererSVG = forwardRef(function LogoRendererSVG({ template, companyName, initials, primaryColor, secondaryColor, font, iconOptions, layoutOptions, gradient }, ref) {
  if (!template || typeof template.render !== 'function') return null
  return template.render({ ref, companyName, initials, primaryColor, secondaryColor, font, iconOptions, layoutOptions, gradient })
})

export default LogoRendererSVG
