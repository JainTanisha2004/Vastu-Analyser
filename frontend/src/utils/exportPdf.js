/**
 * Render a DOM element to a single-page A4 landscape PDF and trigger a download.
 * Uses html2canvas-pro (which understands Tailwind v4's oklch() colors, unlike
 * the original html2canvas). The heavy PDF libraries are loaded on demand so
 * they stay out of the initial bundle. Returns true on success.
 */
export async function downloadElementAsPdf(element, filename = 'vastu-report.pdf') {
  if (!element) return false

  const [{ jsPDF }, { default: html2canvas }] = await Promise.all([
    import('jspdf'),
    import('html2canvas-pro'),
  ])

  const canvas = await html2canvas(element, {
    scale: 2,
    backgroundColor: '#ffffff',
    useCORS: true,
    logging: false,
  })

  const imgData = canvas.toDataURL('image/png')
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const pageW = pdf.internal.pageSize.getWidth()
  const pageH = pdf.internal.pageSize.getHeight()

  // Fit the captured image within the page, preserving aspect ratio.
  const imgRatio = canvas.width / canvas.height
  const pageRatio = pageW / pageH
  let w, h
  if (imgRatio > pageRatio) {
    w = pageW
    h = pageW / imgRatio
  } else {
    h = pageH
    w = pageH * imgRatio
  }
  const x = (pageW - w) / 2
  const y = (pageH - h) / 2

  pdf.addImage(imgData, 'PNG', x, y, w, h)
  pdf.save(filename)
  return true
}
