import { test, expect } from '@playwright/test'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const fixturePath = path.join(__dirname, 'fixtures', 'sample.dxf')
const diagnosticsByPage = new WeakMap()

test.beforeEach(async ({ page }) => {
  const diagnostics = {
    consoleErrors: [],
    pageErrors: [],
    failedRequests: [],
    expectedConsoleErrors: [],
  }
  diagnosticsByPage.set(page, diagnostics)

  page.on('console', (message) => {
    if (message.type() === 'error') diagnostics.consoleErrors.push(message.text())
  })
  page.on('pageerror', (error) => diagnostics.pageErrors.push(error.message))
  page.on('requestfailed', (request) => {
    diagnostics.failedRequests.push({
      method: request.method(),
      url: request.url(),
      failure: request.failure()?.errorText || 'unknown request failure',
    })
  })
})

test.afterEach(async ({ page }, testInfo) => {
  const diagnostics = diagnosticsByPage.get(page)
  await testInfo.attach('browser-diagnostics', {
    body: JSON.stringify(diagnostics, null, 2),
    contentType: 'application/json',
  })

  if (testInfo.status === testInfo.expectedStatus) {
    const unmatchedExpected = [...diagnostics.expectedConsoleErrors]
    const unexpectedConsoleErrors = diagnostics.consoleErrors.filter((message) => {
      const matchIndex = unmatchedExpected.indexOf(message)
      if (matchIndex === -1) return true
      unmatchedExpected.splice(matchIndex, 1)
      return false
    })
    expect(unexpectedConsoleErrors, 'unexpected browser console errors').toEqual([])
    expect(unmatchedExpected, 'expected browser console errors that did not occur').toEqual([])
    expect(diagnostics.pageErrors, 'unexpected uncaught browser errors').toEqual([])
  }
})

function expectConsoleError(page, message) {
  diagnosticsByPage.get(page).expectedConsoleErrors.push(message)
}

async function expectUploadStep(page) {
  await expect(page.getByRole('button', { name: 'Choose DXF floor plan' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Upload & Next' })).toBeDisabled()
}

function backendOffsetFor(compassBearing) {
  return ((-compassBearing % 360) + 360) % 360
}

function matchesJsonRequest(response, pathname, predicate) {
  if (!response.url().endsWith(pathname) || response.request().method() !== 'POST') return false
  if (!predicate) return true
  try {
    return predicate(response.request().postDataJSON())
  } catch {
    return false
  }
}

async function uploadFixtureToOrientation(page, bearings = [0]) {
  await page.goto('/')
  await expectUploadStep(page)
  await page.getByLabel('DXF floor plan file').setInputFiles(fixturePath)

  const uploadButton = page.getByRole('button', { name: 'Upload & Next' })
  await expect(uploadButton).toBeEnabled()
  const uploadResponse = page.waitForResponse((response) => (
    matchesJsonRequest(response, '/api/upload')
  ))
  await uploadButton.click()
  expect((await uploadResponse).ok()).toBe(true)

  const orientationInput = page.getByRole('spinbutton', { name: 'Compass orientation in degrees' })
  await expect(orientationInput).toBeVisible()
  const finalBearing = bearings.at(-1)
  const previewResponse = page.waitForResponse((response) => matchesJsonRequest(
    response,
    '/api/preview',
    (body) => body.north_offset === backendOffsetFor(finalBearing),
  ))
  for (const bearing of bearings) await orientationInput.fill(String(bearing))
  expect((await previewResponse).ok()).toBe(true)
  await expect(orientationInput).toHaveValue(String(finalBearing))
  await expect(page.getByRole('button', { name: 'Next', exact: true })).toBeEnabled()
  return orientationInput
}

async function reachCenterStep(page, bearings = [0]) {
  await uploadFixtureToOrientation(page, bearings)
  await page.getByRole('button', { name: 'Next', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Set Brahmasthan' })).toBeVisible()
}

async function analyzeToRoomLabels(page) {
  const analysisResponse = page.waitForResponse((response) => (
    matchesJsonRequest(response, '/api/analyze')
  ))
  await page.getByRole('button', { name: 'Next', exact: true }).click()
  const response = await analysisResponse
  expect(response.ok()).toBe(true)
  await expect(page.getByRole('heading', { name: 'Verify Room Labels' })).toBeVisible()
  return response
}

async function clickPlanFractions(page, fractions) {
  const image = page.getByAltText('Floor Plan')
  await expect(image).toBeVisible()
  const container = image.locator('..')
  const geometry = await image.evaluate((element) => {
    const rect = element.parentElement.getBoundingClientRect()
    const naturalWidth = element.naturalWidth || 1500
    const naturalHeight = element.naturalHeight || 1500
    const imageAspect = naturalWidth / naturalHeight
    const containerAspect = rect.width / rect.height
    if (imageAspect > containerAspect) {
      const renderedWidth = rect.width
      const renderedHeight = renderedWidth / imageAspect
      return {
        renderedWidth,
        renderedHeight,
        offsetX: 0,
        offsetY: (rect.height - renderedHeight) / 2,
      }
    }
    const renderedHeight = rect.height
    const renderedWidth = renderedHeight * imageAspect
    return {
      renderedWidth,
      renderedHeight,
      offsetX: (rect.width - renderedWidth) / 2,
      offsetY: 0,
    }
  })

  for (const [fractionX, fractionY] of fractions) {
    await container.click({
      position: {
        x: geometry.offsetX + fractionX * geometry.renderedWidth,
        y: geometry.offsetY + fractionY * geometry.renderedHeight,
      },
    })
  }
}

async function expectRoomAtDrawingPoint(page, roomType, dxfX, dxfY, imageExtent) {
  const chip = page.getByRole('button', { name: `Room label for ${roomType}` })
  const fractionX = (dxfX - imageExtent.x_min) / (imageExtent.x_max - imageExtent.x_min)
  const fractionY = 1 - (dxfY - imageExtent.y_min) / (imageExtent.y_max - imageExtent.y_min)
  await expect.poll(async () => chip.evaluate((element) => parseFloat(element.style.left)))
    .toBeCloseTo(fractionX * 100, 3)
  await expect.poll(async () => chip.evaluate((element) => parseFloat(element.style.top)))
    .toBeCloseTo(fractionY * 100, 3)
}

test('app loads successfully', async ({ page }) => {
  await page.goto('/')
  await expectUploadStep(page)
})

test('synthetic DXF completes the critical wizard journey', async ({ page }) => {
  await reachCenterStep(page, [22.5])
  await page.getByRole('button', { name: 'Automatic Center' }).click()
  await analyzeToRoomLabels(page)

  const kitchenChip = page.getByRole('button', { name: 'Room label for Kitchen' })
  await expect(kitchenChip).toBeVisible()
  await kitchenChip.click()
  await page.getByRole('button', { name: /Edit Label/ }).click()
  await page.getByRole('button', { name: 'Dining', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Room label for Dining' })).toBeVisible()

  await page.getByRole('button', { name: 'Undo (Ctrl+Z)', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Room label for Kitchen' })).toBeVisible()
  await page.getByRole('button', { name: 'Redo (Ctrl+Shift+Z)', exact: true }).click()
  const diningChip = page.getByRole('button', { name: 'Room label for Dining' })
  await expect(diningChip).toBeVisible()
  await diningChip.press('ArrowRight')

  const bedroomChip = page.getByRole('button', { name: 'Room label for Master Bedroom' })
  await bedroomChip.click()
  await page.getByTitle('Delete selected label').click()
  await expect(bedroomChip).toHaveCount(0)

  await page.getByRole('button', { name: '+ Add Room' }).click()
  await page.getByRole('button', { name: 'Generic Room', exact: true }).click()
  await clickPlanFractions(page, [[0.5, 0.85]])
  await expect(page.getByRole('button', { name: 'Room label for Generic Room' })).toBeVisible()

  const finalAnalysisResponse = page.waitForResponse((response) => matchesJsonRequest(
    response,
    '/api/analyze',
    (body) => body.rooms.some((room) => room.type === 'Generic Room'),
  ))
  await page.getByRole('button', { name: 'Submit', exact: true }).click()
  const response = await finalAnalysisResponse
  expect(response.ok()).toBe(true)
  const request = response.request().postDataJSON()
  expect(request.north_offset).toBe(337.5)
  expect(request.rooms.find((room) => room.type === 'Dining').x).toBeGreaterThan(25)
  expect(request.rooms.map((room) => room.type)).toEqual(expect.arrayContaining(['Dining', 'Generic Room']))
  expect(request.rooms.map((room) => room.type)).not.toContain('Master Bedroom')

  await expect(page.getByRole('button', { name: 'Print Vastu Report' })).toBeVisible()
  await expect(page.getByRole('cell', { name: 'Dining' })).toBeVisible()
  await expect(page.getByRole('cell', { name: 'Generic Room' })).toBeVisible()
  await expect(page.getByRole('cell', { name: 'Master Bedroom' })).toHaveCount(0)
})

test('unsupported upload is rejected before a backend request', async ({ page }) => {
  const uploadRequests = []
  page.on('request', (request) => {
    if (request.url().endsWith('/api/upload')) uploadRequests.push(request.url())
  })

  await page.goto('/')
  await page.getByLabel('DXF floor plan file').setInputFiles({
    name: 'not-a-floor-plan.png',
    mimeType: 'image/png',
    buffer: Buffer.from('synthetic image bytes'),
  })

  await expect(page.getByRole('alert')).toContainText('Invalid file type')
  await expect(page.getByRole('button', { name: 'Upload & Next' })).toBeDisabled()
  expect(uploadRequests).toEqual([])
})

test('concave boundary uses the boundary centre and discloses excluded rooms', async ({ page }) => {
  await reachCenterStep(page)
  const planImage = page.getByAltText('Floor Plan')
  const stablePlanSource = await planImage.getAttribute('src')
  await page.getByRole('button', { name: 'Define Boundary' }).click()
  const trianglePreview = page.waitForResponse((response) => matchesJsonRequest(
    response,
    '/api/preview',
    (body) => body.center_mode === 'boundary' && body.house_boundary?.length === 3,
  ))
  await clickPlanFractions(page, [
    [0.10, 0.10],
    [0.60, 0.10],
    [0.60, 0.50],
  ])
  expect((await trianglePreview).ok()).toBe(true)
  await expect(planImage).toHaveAttribute('src', stablePlanSource)

  const fourthPreview = page.waitForResponse((response) => matchesJsonRequest(
    response,
    '/api/preview',
    (body) => body.center_mode === 'boundary' && body.house_boundary?.length === 4,
  ))
  await clickPlanFractions(page, [
    [0.45, 0.50],
  ])
  const fourthResponse = await fourthPreview
  expect(fourthResponse.ok()).toBe(true)
  const fourthPoint = fourthResponse.request().postDataJSON().house_boundary[3]
  expect(fourthPoint.x).toBeCloseTo(42.5, 0)
  expect(fourthPoint.y).toBeCloseTo(50, 0)
  await expect(planImage).toHaveAttribute('src', stablePlanSource)

  await clickPlanFractions(page, [
    [0.45, 0.90],
    [0.10, 0.90],
  ])
  await expect(page.getByRole('slider', { name: 'Boundary point 6' })).toBeVisible()

  await page.getByRole('button', { name: 'Undo (Ctrl+Z)', exact: true }).click()
  await expect(page.getByRole('slider', { name: 'Boundary point 6' })).toHaveCount(0)
  const refreshedPreview = page.waitForResponse((response) => matchesJsonRequest(
    response,
    '/api/preview',
    (body) => body.center_mode === 'boundary' && body.house_boundary?.length === 6,
  ))
  await page.getByRole('button', { name: 'Redo (Ctrl+Shift+Z)', exact: true }).click()
  expect((await refreshedPreview).ok()).toBe(true)

  const firstAnalysis = await analyzeToRoomLabels(page)
  const firstResult = await firstAnalysis.json()
  expect(firstResult.center_mode).toBe('boundary')
  expect(firstResult.excluded_room_ids).toHaveLength(1)
  expect(firstResult.warnings.map((warning) => warning.code)).toContain('rooms_excluded_by_boundary')
  await expect(page.getByAltText('Floor Plan')).toHaveAttribute('src', stablePlanSource)
  await expect(page.getByRole('button', { name: 'Room label for Kitchen' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Room label for Master Bedroom' })).toBeVisible()
  const drawingExtent = { x_min: -25, x_max: 125, y_min: -25, y_max: 125 }
  await expectRoomAtDrawingPoint(page, 'Kitchen', 25, 25, drawingExtent)
  await expectRoomAtDrawingPoint(page, 'Master Bedroom', 75, 75, drawingExtent)

  const finalAnalysis = page.waitForResponse((response) => matchesJsonRequest(
    response,
    '/api/analyze',
    (body) => body.center_mode === 'boundary' && body.house_boundary?.length === 6,
  ))
  await page.getByRole('button', { name: 'Submit', exact: true }).click()
  expect((await finalAnalysis).ok()).toBe(true)

  await expect(page.getByText('Analysis notes')).toBeVisible()
  await expect(page.getByText(/outside the selected house boundary/)).toBeVisible()
  await expect(page.getByRole('cell', { name: 'Kitchen' })).toBeVisible()
  await expect(page.getByRole('cell', { name: 'Master Bedroom' })).toHaveCount(0)
})

test('latest fractional orientation and manual centre reach the report', async ({ page }) => {
  await reachCenterStep(page, [10.5, 355.5, 20.5])
  await page.getByRole('button', { name: 'Manual Position' }).click()

  const centerMarker = page.getByRole('slider', { name: 'Brahmasthan center point' })
  await expect(centerMarker).toBeVisible()
  await centerMarker.press('ArrowRight')
  await page.getByRole('button', { name: 'Undo (Ctrl+Z)', exact: true }).click()
  await page.getByRole('button', { name: 'Redo (Ctrl+Shift+Z)', exact: true }).click()
  await centerMarker.press('ArrowRight')

  const latestPreview = page.waitForResponse((response) => matchesJsonRequest(
    response,
    '/api/preview',
    (body) => (
      body.north_offset === 339.5
      && body.center_mode === 'manual'
      && body.manual_center?.x === 52
      && body.manual_center?.y === 51
    ),
  ))
  await centerMarker.press('ArrowUp')
  expect((await latestPreview).ok()).toBe(true)

  const firstAnalysis = await analyzeToRoomLabels(page)
  const firstResult = await firstAnalysis.json()
  expect(firstResult.north_offset).toBe(339.5)
  expect(firstResult.center_mode).toBe('manual')
  expect(firstResult.effective_center).toEqual({ x: 52, y: 51 })

  const finalAnalysis = page.waitForResponse((response) => matchesJsonRequest(
    response,
    '/api/analyze',
    (body) => body.north_offset === 339.5 && body.manual_center?.x === 52,
  ))
  await page.getByRole('button', { name: 'Submit', exact: true }).click()
  const finalResponse = await finalAnalysis
  expect(finalResponse.ok()).toBe(true)
  expect((await finalResponse.json()).effective_center).toEqual({ x: 52, y: 51 })
  await expect(page.getByRole('button', { name: 'Print Vastu Report' })).toBeVisible()
})

test('expired persisted session returns to a recoverable upload state', async ({ page }) => {
  expectConsoleError(page, 'Failed to load resource: the server responded with a status of 404 (Not Found)')
  await page.addInitScript(() => {
    localStorage.setItem('vastu.wizard.session.v2', JSON.stringify({
      schemaVersion: 2,
      savedAt: new Date().toISOString(),
      session: {
        currentStep: 3,
        fileId: 'unknown-after-backend-restart',
        filename: 'expired-plan.dxf',
        sourceKind: 'dxf',
        rooms: [],
        originalRooms: [],
        drawingBounds: { min_x: 0, max_x: 100, min_y: 0, max_y: 100 },
        imageExtent: { x_min: -5, x_max: 105, y_min: -5, y_max: 105 },
        northOffset: 0,
        centerMode: 'automatic',
        manualCenter: null,
        houseBoundary: null,
      },
    }))
  })

  await page.goto('/')
  await expect(page.getByRole('status')).toContainText('previous session expired')
  await expectUploadStep(page)

  await page.getByLabel('DXF floor plan file').setInputFiles(fixturePath)
  const uploadResponse = page.waitForResponse((response) => matchesJsonRequest(response, '/api/upload'))
  await page.getByRole('button', { name: 'Upload & Next' }).click()
  expect((await uploadResponse).ok()).toBe(true)
  await expect(page.getByRole('spinbutton', { name: 'Compass orientation in degrees' })).toBeVisible()
  await expect(page.getByRole('status')).toHaveCount(0)
})

test('invalid boundary and empty-room analysis fail safely without crashing', async ({ page }) => {
  expectConsoleError(page, 'Failed to load resource: the server responded with a status of 422 (Unprocessable Entity)')
  await reachCenterStep(page)
  await page.getByRole('button', { name: 'Define Boundary' }).click()
  const invalidPreview = page.waitForResponse((response) => matchesJsonRequest(
    response,
    '/api/preview',
    (body) => body.house_boundary?.length === 4,
  ))
  await clickPlanFractions(page, [
    [0.20, 0.20],
    [0.80, 0.80],
    [0.25, 0.70],
    [0.80, 0.20],
  ])
  expect((await invalidPreview).status()).toBe(422)
  await expect(page.getByRole('alert')).toContainText('must not self-intersect')

  await page.getByRole('button', { name: 'Clear Boundary' }).click()
  await expect(page.getByRole('alert')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Next', exact: true })).toBeEnabled()
  await analyzeToRoomLabels(page)

  for (const type of ['Kitchen', 'Master Bedroom']) {
    await page.getByRole('button', { name: `Room label for ${type}` }).click()
    await page.getByTitle('Delete selected label').click()
  }
  await expect(page.getByText(/No room labels detected/)).toBeVisible()

  const emptyAnalysis = page.waitForResponse((response) => matchesJsonRequest(
    response,
    '/api/analyze',
    (body) => Array.isArray(body.rooms) && body.rooms.length === 0,
  ))
  await page.getByRole('button', { name: 'Submit', exact: true }).click()
  const emptyResponse = await emptyAnalysis
  expect(emptyResponse.ok()).toBe(true)
  expect((await emptyResponse.json()).rows).toEqual([])
  await expect(page.getByRole('button', { name: 'Print Vastu Report' })).toBeVisible()
})
