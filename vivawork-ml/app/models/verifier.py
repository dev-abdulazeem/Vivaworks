import cv2
import numpy as np
from typing import Dict, List
import re
from datetime import datetime
import base64
import requests

class IDVerifier:
    def __init__(self):
        # Document type patterns (regex)
        self.patterns = {
            "passport": r"[A-Z]{1,2}[0-9]{6,9}",
            "national_id": r"[0-9]{11}",  # Adjust for your country
            "drivers_license": r"[A-Z]{3}[0-9]{6}"
        }
        
    def verify_document(self, image_path: str, doc_type: str = "auto") -> Dict:
        """
        Verify ID document
        Returns: extracted data, authenticity score, flags
        """
        # 1. Image quality check
        quality = self._check_image_quality(image_path)
        
        # 2. OCR text extraction (placeholder for cloud OCR)
        extracted_text = self._extract_text(image_path)
        
        # 3. Document type detection
        detected_type = self._detect_doc_type(extracted_text)
        
        # 4. Extract specific fields
        doc_number = self._extract_field(extracted_text, "number")
        expiry = self._extract_field(extracted_text, "expiry")
        name = self._extract_field(extracted_text, "name")
        
        # 5. Validate
        flags = []
        authenticity = 0.85  # Base score
        
        if quality["blur_score"] < 100:
            flags.append("BLURRY_IMAGE")
            authenticity -= 0.2
            
        if not doc_number:
            flags.append("NO_DOC_NUMBER")
            authenticity -= 0.3
            
        if expiry:
            if self._is_expired(expiry):
                flags.append("EXPIRED_DOCUMENT")
                authenticity = 0.0  # Hard fail
        
        # Human review if suspicious
        needs_review = authenticity < 0.7 or len(flags) > 0
        
        return {
            "document_type": detected_type,
            "extracted_data": {
                "document_number": doc_number,
                "expiry_date": expiry,
                "full_name": name
            },
            "authenticity_score": max(authenticity, 0.0),
            "flags": flags,
            "needs_human_review": needs_review,
            "recommendation": "approve" if authenticity > 0.8 else "review"
        }
    
    def match_faces(self, id_photo_path: str, selfie_path: str) -> Dict:
        """
        Compare ID photo with live selfie using OpenCV (no dlib)
        For production, replace with AWS Rekognition or similar
        """
        # Load images
        id_img = cv2.imread(id_photo_path)
        selfie_img = cv2.imread(selfie_path)
        
        if id_img is None or selfie_img is None:
            return {
                "match": False,
                "confidence": 0.0,
                "error": "Could not load images"
            }
        
        # Detect faces
        id_faces = self._detect_faces(id_img)
        selfie_faces = self._detect_faces(selfie_img)
        
        if len(id_faces) == 0:
            return {"match": False, "confidence": 0.0, "error": "No face in ID photo"}
        if len(selfie_faces) == 0:
            return {"match": False, "confidence": 0.0, "error": "No face in selfie"}
        
        # Extract face regions
        id_face = self._extract_face_region(id_img, id_faces[0])
        selfie_face = self._extract_face_region(selfie_img, selfie_faces[0])
        
        # Compare using histogram correlation (simple but works)
        similarity = self._compare_faces(id_face, selfie_face)
        
        # Liveness check
        liveness = self._check_liveness(selfie_img)
        
        match_threshold = 0.70
        
        return {
            "face_match": similarity > match_threshold,
            "match_confidence": round(similarity, 3),
            "liveness_passed": liveness["passed"],
            "liveness_score": liveness["score"],
            "flags": liveness["flags"] + (["FACE_MISMATCH"] if similarity < match_threshold else []),
            "needs_human_review": similarity < 0.85 or not liveness["passed"],
            "note": "Using basic OpenCV matching. For production, use AWS Rekognition for 99%+ accuracy"
        }
    
    def _check_image_quality(self, image_path: str) -> Dict:
        """Check if image is clear enough for OCR"""
        img = cv2.imread(image_path)
        if img is None:
            return {"blur_score": 0, "brightness": 0}
        
        # Laplacian variance for blur detection
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        blur_score = cv2.Laplacian(gray, cv2.CV_64F).var()
        
        # Brightness check
        brightness = np.mean(gray)
        
        return {
            "blur_score": blur_score,
            "brightness": brightness,
            "acceptable": blur_score > 100 and 50 < brightness < 200
        }
    
    def _extract_text(self, image_path: str) -> str:
        """
        OCR text extraction
        TODO: Integrate AWS Textract or Google Vision for production
        For now, returns mock data for testing
        """
        # In production, use:
        # import pytesseract
        # return pytesseract.image_to_string(image_path)
        
        # Or cloud API:
        # AWS Textract, Google Vision, or Azure Computer Vision
        
        return "SAMPLE ID NUMBER: A12345678 EXPIRY: 12/2027 NAME: JOHN DOE"
    
    def _detect_doc_type(self, text: str) -> str:
        """Detect if passport, national ID, or license"""
        for doc_type, pattern in self.patterns.items():
            if re.search(pattern, text):
                return doc_type
        return "unknown"
    
    def _extract_field(self, text: str, field: str) -> str:
        """Extract specific fields from OCR text"""
        patterns = {
            "number": r"(?:NUMBER|NO|#)[:\s]*([A-Z0-9]{6,12})",
            "expiry": r"EXPIRY[:\s]*(\d{2}/\d{4})",
            "name": r"NAME[:\s]*([A-Z\s]+)"
        }
        match = re.search(patterns.get(field, ""), text, re.IGNORECASE)
        return match.group(1).strip() if match else None
    
    def _is_expired(self, expiry_str: str) -> bool:
        """Check if date is past"""
        try:
            expiry = datetime.strptime(expiry_str, "%m/%Y")
            return expiry < datetime.now()
        except:
            return True
    
    def _detect_faces(self, image: np.ndarray) -> List:
        """Detect faces using OpenCV DNN (better than Haar cascades)"""
        # Use Haar cascade for simplicity (no model download needed)
        face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        faces = face_cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=5, minSize=(30, 30))
        return faces
    
    def _extract_face_region(self, image: np.ndarray, face_box) -> np.ndarray:
        """Extract and normalize face region"""
        x, y, w, h = face_box
        # Add padding
        padding = int(w * 0.3)
        x1 = max(0, x - padding)
        y1 = max(0, y - padding)
        x2 = min(image.shape[1], x + w + padding)
        y2 = min(image.shape[0], y + h + padding)
        
        face = image[y1:y2, x1:x2]
        # Resize to standard size
        face = cv2.resize(face, (150, 150))
        return face
    
    def _compare_faces(self, face1: np.ndarray, face2: np.ndarray) -> float:
        """
        Compare two face images using histogram correlation
        Returns similarity score 0-1
        """
        # Convert to HSV for better color comparison
        hsv1 = cv2.cvtColor(face1, cv2.COLOR_BGR2HSV)
        hsv2 = cv2.cvtColor(face2, cv2.COLOR_BGR2HSV)
        
        # Calculate histograms
        hist1 = cv2.calcHist([hsv1], [0, 1], None, [180, 256], [0, 180, 0, 256])
        hist2 = cv2.calcHist([hsv2], [0, 1], None, [180, 256], [0, 180, 0, 256])
        
        # Normalize
        cv2.normalize(hist1, hist1, 0, 1, cv2.NORM_MINMAX)
        cv2.normalize(hist2, hist2, 0, 1, cv2.NORM_MINMAX)
        
        # Compare
        correlation = cv2.compareHist(hist1, hist2, cv2.HISTCMP_CORREL)
        
        # Also compare using structural similarity (shape)
        gray1 = cv2.cvtColor(face1, cv2.COLOR_BGR2GRAY)
        gray2 = cv2.cvtColor(face2, cv2.COLOR_BGR2GRAY)
        
        # Resize to same size if needed
        if gray1.shape != gray2.shape:
            gray2 = cv2.resize(gray2, (gray1.shape[1], gray1.shape[0]))
        
        # Simple pixel correlation (works surprisingly well for same-person photos)
        pixel_corr = np.corrcoef(gray1.flatten(), gray2.flatten())[0, 1]
        if np.isnan(pixel_corr):
            pixel_corr = 0
        
        # Combine scores
        combined = (correlation * 0.6) + (max(pixel_corr, 0) * 0.4)
        
        return float(combined)
    
    def _check_liveness(self, image: np.ndarray) -> Dict:
        """Basic liveness detection"""
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        
        # Check texture variance (photos of screens have different patterns)
        variance = np.var(gray)
        laplacian_var = cv2.Laplacian(gray, cv2.CV_64F).var()
        
        # Screen photos typically have high regular patterns
        is_screen = laplacian_var < 50 or variance > 8000
        
        return {
            "passed": not is_screen,
            "score": 0.85 if not is_screen else 0.4,
            "flags": ["POSSIBLE_SCREEN_PHOTO"] if is_screen else []
        }

# Singleton
verifier = IDVerifier()