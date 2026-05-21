import { useEffect, useState } from 'react'
import { PitchDetector } from 'pitchy'

export default function PitchTest() {
  const [pitch, setPitch] = useState<number>(0)
  const [clarity, setClarity] = useState<number>(0)
  const [status, setStatus] = useState<string>('Initializing...')

  useEffect(() => {
    let cancelled = false
    let audioContext: AudioContext | null = null
    let stream: MediaStream | null = null
    let rafId: number | null = null

    const start = async (): Promise<void> => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true })

        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }

        audioContext = new AudioContext()
        const source = audioContext.createMediaStreamSource(stream)
        const analyser = audioContext.createAnalyser()
        analyser.fftSize = 2048
        source.connect(analyser)

        const detector = PitchDetector.forFloat32Array(analyser.fftSize)
        const input = new Float32Array(detector.inputLength)

        setStatus('Mic connected, listening...')

        const update = (): void => {
          if (cancelled || !audioContext) return
          analyser.getFloatTimeDomainData(input)
          const [hz, clar] = detector.findPitch(input, audioContext.sampleRate)
          if (clar > 0.9) {
            setPitch(Math.round(hz))
            setClarity(clar)
          }
          rafId = requestAnimationFrame(update)
        }
        update()
      } catch (err) {
        const e = err as Error
        setStatus(`Error: ${e.name} - ${e.message}`)
        console.error('Mic error:', err)
      }
    }

    start()

    return () => {
      cancelled = true
      if (rafId !== null) cancelAnimationFrame(rafId)
      if (stream) stream.getTracks().forEach((t) => t.stop())
      if (audioContext && audioContext.state !== 'closed') {
        audioContext.close()
      }
    }
  }, [])

  return (
    <div className="p-8">
      <div className="text-lg mb-2">Status: {status}</div>
      <div className="text-2xl">Detected: {pitch} Hz</div>
      <div className="text-sm text-gray-500">Clarity: {clarity.toFixed(2)}</div>
    </div>
  )
}