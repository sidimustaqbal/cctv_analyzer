'use client'

import { useState, useRef, useEffect } from 'react'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Loader2 } from "lucide-react"
import axios from 'axios'
import { Bar } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js'

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
)

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
const ALLOWED_FILE_TYPES = ['video/mp4', 'video/quicktime', 'video/x-msvideo'];

export default function Home() {
  const [file, setFile] = useState<File | null>(null)
  const [results, setResults] = useState<any>(null)
  const [uploading, setUploading] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [currentFrame, setCurrentFrame] = useState(0)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0]
    setError(null)

    if (selectedFile) {
      if (selectedFile.size > MAX_FILE_SIZE) {
        setError("File size exceeds 100MB limit.")
        return
      }
      if (!ALLOWED_FILE_TYPES.includes(selectedFile.type)) {
        setError("Invalid file type. Please upload MP4, MOV, or AVI.")
        return
      }
      setFile(selectedFile)
    }
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!file) return

    setUploading(true)
    setUploadProgress(0)
    setError(null)

    const formData = new FormData()
    formData.append('file', file)

    try {
      setUploading(true)
      const uploadResponse = await axios.post('http://localhost:8000/analyze-video/', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / (progressEvent.total ?? 1))
          setUploadProgress(percentCompleted)
        },
      })
      setUploading(false)
      setAnalyzing(true)

      setResults(uploadResponse.data)
    } catch (error) {
      console.error('Error uploading file:', error)
      setError('Error uploading or analyzing file. Please try again.')
    } finally {
      setUploading(false)
      setAnalyzing(false)
    }
  }

  useEffect(() => {
    if (results && results.detections && results.detections.length > 0) {
      const canvas = canvasRef.current
      if (!canvas) return

      const ctx = canvas.getContext('2d')
      if (!ctx) return

      const frameData = results.detections[currentFrame]
      const img = new Image()
      img.onload = () => {
        canvas.width = img.width
        canvas.height = img.height
        ctx.drawImage(img, 0, 0)

        frameData.vehicles.forEach((vehicle: any) => {
          const [x1, y1, x2, y2] = vehicle.bbox
          ctx.strokeStyle = 'red'
          ctx.lineWidth = 2
          ctx.strokeRect(x1, y1, x2 - x1, y2 - y1)

          ctx.fillStyle = 'red'
          ctx.font = '16px Arial'
          ctx.fillText(`${vehicle.class} (${vehicle.id})`, x1, y1 - 5)
        })
      }
      img.src = `data:image/jpeg;base64,${frameData.frame_data}`
    }
  }, [results, currentFrame])

  const vehicleChartData = results ? {
    labels: Object.keys(results.vehicle_counts),
    datasets: [
      {
        label: 'Vehicle Count',
        data: Object.values(results.vehicle_counts),
        backgroundColor: 'rgba(75, 192, 192, 0.6)',
      },
    ],
  } : null

  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-24">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>CCTV Video Analyzer</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              type="file"
              onChange={handleFileChange}
              accept=".mp4,.mov,.avi"
              className="w-full"
            />
            <Button type="submit" disabled={!file || uploading || analyzing} className="w-full">
              {uploading ? 'Uploading...' : analyzing ? 'Analyzing...' : 'Analyze Video'}
            </Button>
          </form>
          {(uploading || analyzing) && (
            <div className="mt-4">
              <Progress value={uploading ? uploadProgress : 100} className="w-full" />
              <p className="text-center mt-2">
                {uploading ? `${uploadProgress}% Uploaded` : 'Analyzing video...'}
              </p>
            </div>
          )}
          {error && (
            <Alert variant="destructive" className="mt-4">
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {analyzing && (
        <Card className="w-full max-w-md mt-8">
          <CardContent className="flex items-center justify-center p-6">
            <Loader2 className="mr-2 h-16 w-16 animate-spin" />
            <p className="text-lg font-semibold">Analyzing video...</p>
          </CardContent>
        </Card>
      )}

      {results && (
        <>
          <Card className="w-full max-w-2xl mt-8">
            <CardHeader>
              <CardTitle>Video Playback with Detections</CardTitle>
            </CardHeader>
            <CardContent>
              <canvas ref={canvasRef} className="w-full" />
              <div className="mt-4 flex justify-between items-center">
                <Button onClick={() => setCurrentFrame(Math.max(0, currentFrame - 1))}>Previous Frame</Button>
                <span>Frame {currentFrame + 1} / {results.detections.length}</span>
                <Button onClick={() => setCurrentFrame(Math.min(results.detections.length - 1, currentFrame + 1))}>Next Frame</Button>
              </div>
            </CardContent>
          </Card>

          <Card className="w-full max-w-2xl mt-8">
            <CardHeader>
              <CardTitle>Vehicle Type Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-lg font-semibold mb-4">
                Total Vehicles Detected: {results.total_vehicles}
              </p>
              {vehicleChartData && (
                <Bar
                  data={vehicleChartData}
                  options={{
                    responsive: true,
                    plugins: {
                      legend: {
                        position: 'top' as const,
                      },
                      title: {
                        display: true,
                        text: 'Vehicle Types',
                      },
                    },
                  }}
                />
              )}
            </CardContent>
          </Card>
        </>
      )}
    </main>
  )
}