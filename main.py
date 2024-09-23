from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import tempfile
import os
from video_processor import VideoProcessor
from collections import Counter
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

print("Starting the application...")

app = FastAPI()

print("FastAPI app created...")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

print("CORS middleware added...")

video_processor = VideoProcessor()

print("VideoProcessor initialized...")

@app.post("/analyze-video/")
async def analyze_video(file: UploadFile = File(...)):
    logger.info("Received video analysis request...")
    if not file.filename.lower().endswith(('.mp4', '.avi', '.mov')):
        raise HTTPException(status_code=400, detail="Invalid file format. Please upload a video file.")

    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=os.path.splitext(file.filename)[1]) as temp_file:
            temp_file.write(await file.read())
            temp_file_path = temp_file.name

        logger.info("Processing video...")
        results, fps = video_processor.process_video(temp_file_path)
        os.unlink(temp_file_path)

        if not results:
            logger.warning("No vehicles detected in the video.")
            return {"message": "No vehicles detected in the video."}

        # Count vehicles by class
        vehicle_counts = Counter()
        for frame in results:
            for vehicle in frame['vehicles']:
                vehicle_counts[vehicle['class']] += 1

        total_vehicles = sum(vehicle_counts.values())

        logger.info(f"Video processing completed. Total vehicles detected: {total_vehicles}")
        return {
            "total_vehicles": total_vehicles,
            "vehicle_counts": dict(vehicle_counts),
            "detections": results,
            "fps": fps
        }
    except Exception as e:
        logger.error(f"Error occurred: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"An error occurred while processing the video: {str(e)}")

if __name__ == "__main__":
    logger.info("Starting Uvicorn server...")
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

logger.info("Script execution completed.")