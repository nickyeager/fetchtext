import { useRef, useEffect, useState, useCallback } from 'react'

/**
 * DocumentFactoryAnimation - Isometric View
 *
 * An isometric generative art component showing documents being processed.
 * Documents flow along a conveyor belt, get stamped, and transform from
 * raw unstructured data to clean extracted fields.
 */

interface Document {
  progress: number // 0-1 along the belt
  isTransformed: boolean
  transformProgress: number
  wasStamped: boolean
  textLines: Array<{ y: number; width: number; x: number }>
  bobOffset: number
}

// Seeded random for reproducibility
function seededRandom(seed: number) {
  const m = 2147483647
  const a = 16807
  let s = seed % m
  return () => {
    s = (s * a) % m
    return (s - 1) / (m - 1)
  }
}

// Isometric projection helpers
const ISO_ANGLE = Math.PI / 6 // 30 degrees
const COS_ISO = Math.cos(ISO_ANGLE)
const SIN_ISO = Math.sin(ISO_ANGLE)

function toIso(x: number, y: number, z: number): { x: number; y: number } {
  return {
    x: (x - y) * COS_ISO,
    y: (x + y) * SIN_ISO - z
  }
}

export function DocumentFactoryAnimation({
  className = '',
  seed = 2025
}: {
  className?: string
  seed?: number
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const animationRef = useRef<number>()
  const [isVisible, setIsVisible] = useState(false)

  const getThemeColors = useCallback(() => {
    const root = document.documentElement
    const isDark = root.classList.contains('dark')

    // Monochromatic black & white design
    if (isDark) {
      return {
        bg: '#0a0a0a',
        bgGradient: '#111111',
        floor: '#1a1a1a',
        floorLight: '#2a2a2a',
        conveyor: '#1a1a1a',
        conveyorTop: '#252525',
        conveyorLine: '#333333',
        metal: '#3a3a3a',
        metalLight: '#555555',
        metalDark: '#222222',
        accent: '#ffffff',
        accentGlow: 'rgba(255, 255, 255, 0.1)',
        paper: '#e0e0e0',
        paperSide: '#b0b0b0',
        paperWhite: '#ffffff',
        ink: '#444444',
        stampColor: '#333333',
        stampDark: '#1a1a1a',
        success: '#ffffff',
        warning: '#888888',
        highlight: '#ffffff',
        particleA: '#ffffff',
        particleB: '#cccccc'
      }
    } else {
      return {
        bg: '#ffffff',
        bgGradient: '#f5f5f5',
        floor: '#e5e5e5',
        floorLight: '#f0f0f0',
        conveyor: '#2a2a2a',
        conveyorTop: '#3a3a3a',
        conveyorLine: '#4a4a4a',
        metal: '#1a1a1a',
        metalLight: '#3a3a3a',
        metalDark: '#0a0a0a',
        accent: '#000000',
        accentGlow: 'rgba(0, 0, 0, 0.08)',
        paper: '#f8f8f8',
        paperSide: '#d0d0d0',
        paperWhite: '#ffffff',
        ink: '#333333',
        stampColor: '#1a1a1a',
        stampDark: '#000000',
        success: '#000000',
        warning: '#666666',
        highlight: '#000000',
        particleA: '#000000',
        particleB: '#444444'
      }
    }
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const observer = new IntersectionObserver(
      ([entry]) => setIsVisible(entry.isIntersecting),
      { threshold: 0.1 }
    )
    observer.observe(canvas)

    // Setup dimensions with DPR
    const rect = container.getBoundingClientRect()
    const dpr = window.devicePixelRatio || 1
    canvas.width = rect.width * dpr
    canvas.height = rect.height * dpr
    ctx.scale(dpr, dpr)
    canvas.style.width = `${rect.width}px`
    canvas.style.height = `${rect.height}px`

    const width = rect.width
    const height = rect.height
    const random = seededRandom(seed)

    // Center point for isometric view - positioned higher
    const centerX = width / 2
    const centerY = height * 0.55

    // Conveyor dimensions - extends to corners
    // Calculate length needed to reach canvas corners in isometric projection
    const diagonalLength = Math.hypot(width, height)
    const BELT_LENGTH = diagonalLength * 1.2 // Extend beyond corners
    const BELT_WIDTH = 180
    const BELT_HEIGHT = 26
    const DOC_SIZE = 110

    // State
    let frameCounter = 0
    let conveyorOffset = 0
    const documents: Document[] = []
    let stampY = 0 // Height above belt
    let isStamping = false
    let stampTimer = 0
    let stampCooldown = 0
    const STAMP_POSITION = 0.5 // Progress along belt where stamp is

    // Initialize documents
    function createDocument(progress: number): Document {
      const textLines = []
      const numLines = Math.floor(random() * 4) + 5
      for (let i = 0; i < numLines; i++) {
        textLines.push({
          y: 8 + i * 5,
          width: random() * 30 + 20,
          x: random() * 3 + 4
        })
      }

      return {
        progress,
        isTransformed: false,
        transformProgress: 0,
        wasStamped: false,
        textLines,
        bobOffset: random() * Math.PI * 2
      }
    }

    // Initialize document queue
    for (let i = 0; i < 6; i++) {
      documents.push(createDocument(i * 0.2 - 0.2))
    }

    // Convert belt progress to 3D position
    function getDocPosition(progress: number): { x: number; y: number; z: number } {
      // Belt runs diagonally in isometric space
      const x = (progress - 0.5) * BELT_LENGTH
      const y = 0
      const z = BELT_HEIGHT + DOC_SIZE / 2
      return { x, y, z }
    }

    // Draw isometric box (for conveyor, documents, etc.)
    function drawIsoBox(
      x: number,
      y: number,
      z: number,
      w: number,
      d: number,
      h: number,
      topColor: string,
      leftColor: string,
      rightColor: string
    ) {
      // Top face
      const topPts = [
        toIso(x - w / 2, y - d / 2, z + h),
        toIso(x + w / 2, y - d / 2, z + h),
        toIso(x + w / 2, y + d / 2, z + h),
        toIso(x - w / 2, y + d / 2, z + h)
      ]

      ctx.fillStyle = topColor
      ctx.beginPath()
      ctx.moveTo(centerX + topPts[0].x, centerY + topPts[0].y)
      for (let i = 1; i < 4; i++) {
        ctx.lineTo(centerX + topPts[i].x, centerY + topPts[i].y)
      }
      ctx.closePath()
      ctx.fill()

      // Left face
      const leftPts = [
        toIso(x - w / 2, y + d / 2, z + h),
        toIso(x + w / 2, y + d / 2, z + h),
        toIso(x + w / 2, y + d / 2, z),
        toIso(x - w / 2, y + d / 2, z)
      ]

      ctx.fillStyle = leftColor
      ctx.beginPath()
      ctx.moveTo(centerX + leftPts[0].x, centerY + leftPts[0].y)
      for (let i = 1; i < 4; i++) {
        ctx.lineTo(centerX + leftPts[i].x, centerY + leftPts[i].y)
      }
      ctx.closePath()
      ctx.fill()

      // Right face
      const rightPts = [
        toIso(x + w / 2, y - d / 2, z + h),
        toIso(x + w / 2, y + d / 2, z + h),
        toIso(x + w / 2, y + d / 2, z),
        toIso(x + w / 2, y - d / 2, z)
      ]

      ctx.fillStyle = rightColor
      ctx.beginPath()
      ctx.moveTo(centerX + rightPts[0].x, centerY + rightPts[0].y)
      for (let i = 1; i < 4; i++) {
        ctx.lineTo(centerX + rightPts[i].x, centerY + rightPts[i].y)
      }
      ctx.closePath()
      ctx.fill()
    }

    function drawBackground(colors: ReturnType<typeof getThemeColors>) {
      // Clean solid background
      ctx.fillStyle = colors.bg
      ctx.fillRect(0, 0, width, height)

      // Subtle isometric grid - very faint
      ctx.strokeStyle = colors.floorLight + '15'
      ctx.lineWidth = 1

      for (let i = -8; i <= 8; i++) {
        const start = toIso(i * 40, -200, 0)
        const end = toIso(i * 40, 200, 0)
        ctx.beginPath()
        ctx.moveTo(centerX + start.x, centerY + start.y)
        ctx.lineTo(centerX + end.x, centerY + end.y)
        ctx.stroke()

        const start2 = toIso(-200, i * 40, 0)
        const end2 = toIso(200, i * 40, 0)
        ctx.beginPath()
        ctx.moveTo(centerX + start2.x, centerY + start2.y)
        ctx.lineTo(centerX + end2.x, centerY + end2.y)
        ctx.stroke()
      }
    }

    function drawConveyorBelt(colors: ReturnType<typeof getThemeColors>) {
      // Slower conveyor movement
      conveyorOffset = (conveyorOffset + 0.003) % 1

      // Generate leg positions dynamically based on belt length
      const legSpacing = 120 // Distance between legs
      const numLegs = Math.ceil(BELT_LENGTH / legSpacing)
      for (let i = 0; i < numLegs; i++) {
        const legX = (i / (numLegs - 1) - 0.5) * BELT_LENGTH * 0.9
        drawIsoBox(legX, 0, 0, 12, BELT_WIDTH * 0.6, BELT_HEIGHT, colors.metalDark, colors.metal, colors.metalLight)
      }

      // Main belt body - thicker and more prominent
      drawIsoBox(0, 0, BELT_HEIGHT - 3, BELT_LENGTH, BELT_WIDTH, 6, colors.conveyorTop, colors.conveyor, colors.metalLight)

      // Draw moving track lines on belt surface - scale with belt length
      ctx.strokeStyle = colors.conveyorLine
      ctx.lineWidth = 2
      const numLines = Math.ceil(BELT_LENGTH / 40) // One line every ~40 units
      for (let i = 0; i < numLines; i++) {
        const t = ((i / numLines + conveyorOffset) % 1) * BELT_LENGTH - BELT_LENGTH / 2
        const lineStart = toIso(t, -BELT_WIDTH / 2 + 8, BELT_HEIGHT + 3.5)
        const lineEnd = toIso(t, BELT_WIDTH / 2 - 8, BELT_HEIGHT + 3.5)
        ctx.beginPath()
        ctx.moveTo(centerX + lineStart.x, centerY + lineStart.y)
        ctx.lineTo(centerX + lineEnd.x, centerY + lineEnd.y)
        ctx.stroke()
      }

      // Minimal side rails
      drawIsoBox(0, -BELT_WIDTH / 2 - 4, BELT_HEIGHT, BELT_LENGTH + 15, 4, 6, colors.metalLight, colors.metal, colors.metalDark)
      drawIsoBox(0, BELT_WIDTH / 2 + 4, BELT_HEIGHT, BELT_LENGTH + 15, 4, 6, colors.metalLight, colors.metal, colors.metalDark)
    }

    function drawDocument(doc: Document, colors: ReturnType<typeof getThemeColors>) {
      const pos = getDocPosition(doc.progress)
      // Slower bobbing motion
      const bob = Math.sin(frameCounter * 0.03 + doc.bobOffset) * 2

      const docW = DOC_SIZE
      const docD = DOC_SIZE * 0.7
      const docH = 3

      if (doc.isTransformed) {
        const p = doc.transformProgress
        // Transformed document - clean white
        drawIsoBox(
          pos.x,
          pos.y,
          pos.z + bob,
          docW,
          docD,
          docH,
          colors.paperWhite,
          colors.paperSide,
          colors.paper
        )

        // Subtle glow effect
        if (p > 0.5) {
          const glowPos = toIso(pos.x, pos.y, pos.z + bob + docH)
          ctx.fillStyle = colors.accentGlow
          ctx.beginPath()
          ctx.arc(centerX + glowPos.x, centerY + glowPos.y, DOC_SIZE * 0.5 * p, 0, Math.PI * 2)
          ctx.fill()
        }

        // Clean horizontal lines representing extracted fields
        ctx.strokeStyle = colors.accent + Math.floor(p * 200).toString(16).padStart(2, '0')
        ctx.lineWidth = 2
        for (let i = 0; i < 4; i++) {
          const lineY = (i / 4 - 0.4) * docD * 0.6
          const lineStart = toIso(pos.x - docW * 0.35, pos.y + lineY, pos.z + bob + docH + 0.5)
          const lineEnd = toIso(pos.x + docW * 0.25, pos.y + lineY, pos.z + bob + docH + 0.5)
          ctx.beginPath()
          ctx.moveTo(centerX + lineStart.x, centerY + lineStart.y)
          ctx.lineTo(centerX + lineEnd.x, centerY + lineEnd.y)
          ctx.stroke()
        }

        // Simple checkmark in corner
        if (p > 0.8) {
          const checkPos = toIso(pos.x + docW * 0.3, pos.y - docD * 0.3, pos.z + bob + docH + 5)
          ctx.fillStyle = colors.accent
          ctx.beginPath()
          ctx.arc(centerX + checkPos.x, centerY + checkPos.y, 5, 0, Math.PI * 2)
          ctx.fill()
        }
      } else {
        // Raw document - cream colored with messy lines
        drawIsoBox(
          pos.x,
          pos.y,
          pos.z + bob,
          docW,
          docD,
          docH,
          colors.paper,
          colors.paperSide,
          colors.paper
        )

        // Draw messy text lines on top face
        ctx.fillStyle = colors.ink + '50'
        doc.textLines.forEach((line) => {
          const lineY = (line.y / 40 - 0.5) * docD * 0.6
          const lineStart = toIso(pos.x - docW * 0.35, pos.y + lineY, pos.z + bob + docH + 0.5)
          const lineW = (line.width / 50) * docW * 0.5
          const lineEnd = toIso(pos.x - docW * 0.35 + lineW, pos.y + lineY, pos.z + bob + docH + 0.5)

          ctx.beginPath()
          ctx.moveTo(centerX + lineStart.x, centerY + lineStart.y)
          ctx.lineTo(centerX + lineEnd.x, centerY + lineEnd.y)
          ctx.lineWidth = 2
          ctx.strokeStyle = colors.ink + '40'
          ctx.stroke()
        })
      }
    }

    // Split stamp mechanism into three layers for proper depth ordering
    const STAMP_BASE_HEIGHT = 155
    const STAMP_HEAD_HEIGHT = 16
    const STAMP_HOUSING_HEIGHT = 32
    const STAMP_LEG_WIDTH = 24
    const STAMP_LEG_DEPTH = 24

    // Layer 1: Back leg only (drawn before documents)
    function drawStampFrameBack(colors: ReturnType<typeof getThemeColors>) {
      const stampPos = getDocPosition(STAMP_POSITION)
      // Back leg
      drawIsoBox(stampPos.x, stampPos.y - BELT_WIDTH / 2 - STAMP_LEG_DEPTH, 0, STAMP_LEG_WIDTH, STAMP_LEG_DEPTH, STAMP_BASE_HEIGHT + STAMP_HOUSING_HEIGHT, colors.metal, colors.metalDark, colors.metalLight)
    }

    // Layer 2: Front leg and crossbar (drawn after documents, before stamp head)
    function drawStampFrameFront(colors: ReturnType<typeof getThemeColors>) {
      const stampPos = getDocPosition(STAMP_POSITION)

      // Top crossbar connecting legs
      drawIsoBox(stampPos.x, stampPos.y, STAMP_BASE_HEIGHT + STAMP_HOUSING_HEIGHT - 5, STAMP_LEG_WIDTH, BELT_WIDTH + STAMP_LEG_DEPTH * 2 + 20, 10, colors.metalLight, colors.metal, colors.metalDark)

      // Front leg
      drawIsoBox(stampPos.x, stampPos.y + BELT_WIDTH / 2 + STAMP_LEG_DEPTH, 0, STAMP_LEG_WIDTH, STAMP_LEG_DEPTH, STAMP_BASE_HEIGHT + STAMP_HOUSING_HEIGHT, colors.metal, colors.metalDark, colors.metalLight)
    }

    // Layer 4: Housing (drawn after stamp head to cover the piston rod)
    function drawStampHousing(colors: ReturnType<typeof getThemeColors>) {
      const stampPos = getDocPosition(STAMP_POSITION)

      // Top housing/frame - covers the piston rod when retracted
      drawIsoBox(stampPos.x, stampPos.y, STAMP_BASE_HEIGHT, 78, 78, STAMP_HOUSING_HEIGHT, colors.metalDark, colors.metal, colors.metalLight)
    }

    function drawStampHead(colors: ReturnType<typeof getThemeColors>) {
      const stampPos = getDocPosition(STAMP_POSITION)

      // Stamp head Z position
      const stampHeadZ = STAMP_BASE_HEIGHT - stampY - STAMP_HEAD_HEIGHT

      // Vertical rod/piston (connects stamp to top)
      const rodHeight = stampY + 12
      drawIsoBox(stampPos.x, stampPos.y, stampHeadZ + STAMP_HEAD_HEIGHT, 16, 16, rodHeight, colors.metalLight, colors.metal, colors.metalDark)

      // Stamp head (drawn on top of document)
      drawIsoBox(stampPos.x, stampPos.y, stampHeadZ, 65, 65, STAMP_HEAD_HEIGHT, colors.stampColor, colors.stampDark, colors.metal)

      // Impact flash effect - simple white flash
      if (stampTimer >= 18 && stampTimer <= 25) {
        const flashPos = toIso(stampPos.x, stampPos.y, stampHeadZ)
        const flashIntensity = 1 - (stampTimer - 18) / 7
        ctx.fillStyle = colors.accent + Math.floor(flashIntensity * 80).toString(16).padStart(2, '0')
        ctx.beginPath()
        ctx.arc(centerX + flashPos.x, centerY + flashPos.y, 45, 0, Math.PI * 2)
        ctx.fill()
      }
    }

    function updateStamp() {
      if (stampCooldown > 0) stampCooldown--

      const docInPosition = documents.some(
        (d) => d.progress > STAMP_POSITION - 0.05 && d.progress < STAMP_POSITION + 0.05 && !d.wasStamped
      )

      if (docInPosition && stampCooldown === 0 && !isStamping) {
        isStamping = true
        stampTimer = 0
      }

      if (isStamping) {
        stampTimer++

        // Target descent: stop just above document surface
        // Document top is at BELT_HEIGHT + DOC_SIZE/2 + docHeight ≈ 84
        // Stamp head bottom at rest is at baseHeight (155)
        // We want stamp to stop at ~90, so descent = 155 - 90 = 65
        const targetDescent = 65

        if (stampTimer < 20) {
          // Slower descent
          stampY += (targetDescent - stampY) * 0.15
        } else if (stampTimer === 20) {
          // Impact frame - stamp the document
          documents.forEach((doc) => {
            if (doc.progress > STAMP_POSITION - 0.05 && doc.progress < STAMP_POSITION + 0.05 && !doc.wasStamped) {
              doc.wasStamped = true
              doc.isTransformed = true
            }
          })
        } else if (stampTimer < 35) {
          // Hold longer at impact
        } else if (stampTimer < 60) {
          // Slower ascent
          stampY += (0 - stampY) * 0.08
        } else {
          isStamping = false
          stampCooldown = 40 // Longer cooldown between stamps
          stampY = 0
        }
      }
    }

    function updateDocuments() {
      documents.forEach((doc) => {
        // Slower document movement along belt
        doc.progress += 0.0015

        if (doc.isTransformed && doc.transformProgress < 1) {
          // Slower transformation animation
          doc.transformProgress += 0.015
        }
      })

      // Recycle documents
      for (let i = documents.length - 1; i >= 0; i--) {
        if (documents[i].progress > 1.1) {
          documents[i] = createDocument(-0.15)
        }
      }
    }

    function drawVignette() {
      const gradient = ctx.createRadialGradient(width / 2, height / 2, 100, width / 2, height / 2, width * 0.7)
      gradient.addColorStop(0, 'rgba(0,0,0,0)')
      gradient.addColorStop(1, 'rgba(0,0,0,0.15)')
      ctx.fillStyle = gradient
      ctx.fillRect(0, 0, width, height)
    }

    // Animation loop
    function animate() {
      if (!isVisible) {
        animationRef.current = requestAnimationFrame(animate)
        return
      }

      frameCounter++
      const colors = getThemeColors()

      ctx.clearRect(0, 0, width, height)

      drawBackground(colors)
      drawConveyorBelt(colors)

      updateDocuments()
      updateStamp()

      // Sort documents by depth (back to front)
      const sortedDocs = [...documents].sort((a, b) => a.progress - b.progress)

      // Layer 1: Back leg (behind documents)
      drawStampFrameBack(colors)

      // Layer 2: All documents
      sortedDocs.forEach((doc) => drawDocument(doc, colors))

      // Layer 3: Front leg and crossbar (in front of documents)
      drawStampFrameFront(colors)

      // Layer 4: Stamp head with piston rod
      drawStampHead(colors)

      // Layer 5: Housing (covers piston rod when retracted)
      drawStampHousing(colors)

      drawVignette()

      animationRef.current = requestAnimationFrame(animate)
    }

    animate()

    return () => {
      observer.disconnect()
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [seed, isVisible, getThemeColors])

  return (
    <div ref={containerRef} className={`w-full aspect-[16/9] ${className}`}>
      <canvas ref={canvasRef} className="w-full h-full rounded-xl shadow-lg" />
    </div>
  )
}
