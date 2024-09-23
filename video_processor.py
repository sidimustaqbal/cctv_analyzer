import cv2
import torch
from ultralytics import YOLO
import numpy as np
import base64

print("Importing VideoProcessor dependencies...")

def calculate_iou(box1, box2):
    # Calculate the Intersection over Union of two bounding boxes
    x1 = max(box1[0], box2[0])
    y1 = max(box1[1], box2[1])
    x2 = min(box1[2], box2[2])
    y2 = min(box1[3], box2[3])

    intersection = max(0, x2 - x1) * max(0, y2 - y1)
    area1 = (box1[2] - box1[0]) * (box1[3] - box1[1])
    area2 = (box2[2] - box2[0]) * (box2[3] - box2[1])
    union = area1 + area2 - intersection

    return intersection / union if union > 0 else 0

class VideoProcessor:
    def __init__(self):
        print("Initializing VideoProcessor...")
        self.model = YOLO('yolov8n.pt')
        self.vehicle_classes = ['car', 'truck', 'bus', 'motorcycle']
        self.next_id = 1
        self.tracked_vehicles = []
        print("VideoProcessor initialized.")

    def process_frame(self, frame, frame_number):
        print(f"Processing frame {frame_number}...")
        results = self.model(frame, verbose=False)
        current_vehicles = []

        for r in results:
            boxes = r.boxes
            for box in boxes:
                cls = int(box.cls[0])
                conf = float(box.conf[0])
                if self.model.names[cls] in self.vehicle_classes and conf > 0.3:
                    x1, y1, x2, y2 = box.xyxy[0].tolist()
                    current_vehicles.append({
                        'class': self.model.names[cls],
                        'confidence': conf,
                        'bbox': [int(x1), int(y1), int(x2), int(y2)]
                    })

        # Match current vehicles with tracked vehicles
        matched_vehicle_ids = []
        for current_vehicle in current_vehicles:
            max_iou = 0
            best_match = None
            for tracked_vehicle in self.tracked_vehicles:
                iou = calculate_iou(current_vehicle['bbox'], tracked_vehicle['bbox'])
                if iou > max_iou:
                    max_iou = iou
                    best_match = tracked_vehicle

            if max_iou > 0.3:  # IOU threshold
                current_vehicle['id'] = best_match['id']
                matched_vehicle_ids.append(best_match['id'])
            else:
                current_vehicle['id'] = self.next_id
                self.next_id += 1

        # Update tracked vehicles
        self.tracked_vehicles = [v for v in current_vehicles if v['id'] not in matched_vehicle_ids] + \
                                [v for v in self.tracked_vehicles if v['id'] in matched_vehicle_ids]

        print(f"Processed frame {frame_number}. Detected {len(current_vehicles)} vehicles.")
        return current_vehicles

    def process_video(self, video_path):
        print(f"Processing video: {video_path}")
        cap = cv2.VideoCapture(video_path)
        fps = int(cap.get(cv2.CAP_PROP_FPS))
        frame_count = 0
        results = []

        while cap.isOpened():
            ret, frame = cap.read()
            if not ret:
                break

            frame_count += 1
            if frame_count % 5 == 0:  # Process every 5th frame
                try:
                    vehicles = self.process_frame(frame, frame_count)
                    
                    # Encode frame as base64
                    _, buffer = cv2.imencode('.jpg', frame)
                    frame_base64 = base64.b64encode(buffer).decode('utf-8')
                    
                    results.append({
                        'frame': frame_count,
                        'vehicles': vehicles,
                        'frame_data': frame_base64
                    })
                except Exception as e:
                    print(f"Error processing frame {frame_count}: {e}")

            if frame_count % 100 == 0:
                print(f"Processed {frame_count} frames...")

        cap.release()
        print(f"Video processing completed. Processed {frame_count} frames.")
        return results, fps

print("VideoProcessor class defined.")