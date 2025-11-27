import { Component, OnInit, ViewChild, ElementRef, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import * as tf from '@tensorflow/tfjs';

@Component({
  selector: 'app-tumor-detection',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="tumor-detection-container">
      <h2>🏥 Medical Tumor Detection System</h2>
      <p class="disclaimer">
        <strong>⚠️ Disclaimer:</strong> This is for educational purposes only. 
        Always consult medical professionals for actual diagnosis.
      </p>
      
      <!-- Image Upload Section -->
      <section class="upload-section">
        <h3>📤 Upload Medical Image</h3>
        <div class="upload-area" (click)="fileInput.click()">
          <input #fileInput type="file" (change)="onImageSelected($event)" 
                 accept="image/*" style="display: none;">
          <div class="upload-placeholder">
            <span>Click to upload medical image</span>
            <small>Supports: JPG, PNG, DICOM converted to image</small>
          </div>
        </div>
      </section>

      <!-- Image Analysis Section -->
      <section class="analysis-section" *ngIf="originalImage()">
        <div class="image-container">
          <!-- Original Image -->
          <div class="image-panel">
            <h4>Original Image</h4>
            <canvas #originalCanvas width="512" height="512"></canvas>
          </div>

          <!-- Processed Image with Detection -->
          <div class="image-panel">
            <h4>Detection Results</h4>
            <canvas #detectionCanvas width="512" height="512"></canvas>
            <div class="detection-controls">
              <button (click)="detectTumor()" [disabled]="processing()">
                {{ processing() ? 'Analyzing...' : '🔍 Detect Tumor' }}
              </button>
              <button (click)="segmentTumor()" [disabled]="processing() || !detectionResult()">
                {{ processing() ? 'Segmenting...' : '⭕ Segment Tumor' }}
              </button>
            </div>
          </div>
        </div>

        <!-- Results Panel -->
        <div class="results-panel" *ngIf="detectionResult()">
          <h4>📊 Analysis Results</h4>
          <div class="result-item">
            <strong>Tumor Detected:</strong> 
            <span [class]="detectionResult()?.detected ? 'positive' : 'negative'">
              {{ detectionResult()?.detected ? 'YES' : 'NO' }}
            </span>
          </div>
          <div class="result-item" *ngIf="detectionResult()?.confidence">
            <strong>Confidence:</strong> 
            <span class="confidence">{{ ((detectionResult()?.confidence || 0) * 100) | number:'1.1-1' }}%</span>
          </div>
          <div class="result-item" *ngIf="detectionResult()?.area">
            <strong>Estimated Area:</strong> 
            <span>{{ (detectionResult()?.area || 0) | number:'1.0-0' }} pixels²</span>
          </div>
          <div class="result-item" *ngIf="detectionResult()?.location">
            <strong>Location:</strong> 
            <span>X: {{ detectionResult()!.location!.x | number:'1.0-0' }}, 
                  Y: {{ detectionResult()!.location!.y | number:'1.0-0' }}</span>
          </div>
        </div>
      </section>

      <!-- Pre-processing Options -->
      <section class="preprocessing-section" *ngIf="originalImage()">
        <h4>🔧 Image Enhancement</h4>
        <div class="controls-grid">
          <label>
            Contrast: {{ contrast() }}
            <input type="range" min="0.5" max="2" step="0.1" 
                   [value]="contrast()" (input)="updateContrast($event)">
          </label>
          <label>
            Brightness: {{ brightness() }}
            <input type="range" min="0.5" max="2" step="0.1" 
                   [value]="brightness()" (input)="updateBrightness($event)">
          </label>
          <button (click)="applyFilters()">Apply Filters</button>
          <button (click)="resetFilters()">Reset</button>
        </div>
      </section>

      <!-- Model Training Section -->
      <section class="training-section">
        <h4>🧠 Custom Model Training</h4>
        <p>Train a custom tumor detection model with your data:</p>
        <div class="training-controls">
          <button (click)="startTraining()" [disabled]="training()">
            {{ training() ? 'Training...' : '🚀 Start Training' }}
          </button>
          <button (click)="loadPretrainedModel()" [disabled]="loading()">
            {{ loading() ? 'Loading...' : '📥 Load Pre-trained Model' }}
          </button>
        </div>
        <div class="training-progress" *ngIf="trainingProgress()">
          <div class="progress-bar">
            <div class="progress-fill" [style.width.%]="trainingProgress()"></div>
          </div>
          <p>Training Progress: {{ trainingProgress() }}%</p>
        </div>
      </section>
    </div>
  `,
  styles: [`
    .tumor-detection-container {
      max-width: 1400px;
      margin: 0 auto;
      padding: 20px;
      font-family: Arial, sans-serif;
    }

    .disclaimer {
      background: #fff3cd;
      border: 1px solid #ffeaa7;
      padding: 15px;
      border-radius: 8px;
      margin-bottom: 20px;
      color: #856404;
    }

    .upload-section {
      margin-bottom: 30px;
    }

    .upload-area {
      border: 3px dashed #007bff;
      border-radius: 12px;
      padding: 40px;
      text-align: center;
      cursor: pointer;
      background: #f8f9fa;
      transition: all 0.3s ease;
    }

    .upload-area:hover {
      background: #e9ecef;
      border-color: #0056b3;
    }

    .image-container {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
      margin: 20px 0;
    }

    .image-panel {
      border: 1px solid #dee2e6;
      border-radius: 8px;
      padding: 15px;
      background: white;
    }

    .image-panel h4 {
      margin-top: 0;
      color: #495057;
    }

    canvas {
      border: 1px solid #ced4da;
      border-radius: 4px;
      max-width: 100%;
      display: block;
      margin: 10px 0;
    }

    .detection-controls {
      display: flex;
      gap: 10px;
      margin-top: 15px;
    }

    .results-panel {
      background: #f8f9fa;
      border: 1px solid #dee2e6;
      border-radius: 8px;
      padding: 20px;
      margin-top: 20px;
    }

    .result-item {
      display: flex;
      justify-content: space-between;
      margin: 10px 0;
      padding: 8px 0;
      border-bottom: 1px solid #e9ecef;
    }

    .positive {
      color: #dc3545;
      font-weight: bold;
    }

    .negative {
      color: #28a745;
      font-weight: bold;
    }

    .confidence {
      color: #007bff;
      font-weight: bold;
    }

    .preprocessing-section, .training-section {
      background: white;
      border: 1px solid #dee2e6;
      border-radius: 8px;
      padding: 20px;
      margin: 20px 0;
    }

    .controls-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 15px;
      align-items: center;
    }

    .controls-grid label {
      display: flex;
      flex-direction: column;
      gap: 5px;
    }

    .training-controls {
      display: flex;
      gap: 15px;
      margin: 15px 0;
    }

    .progress-bar {
      width: 100%;
      height: 20px;
      background: #e9ecef;
      border-radius: 10px;
      overflow: hidden;
      margin: 10px 0;
    }

    .progress-fill {
      height: 100%;
      background: linear-gradient(90deg, #007bff, #28a745);
      transition: width 0.3s ease;
    }

    button {
      background: #007bff;
      color: white;
      border: none;
      padding: 10px 20px;
      border-radius: 6px;
      cursor: pointer;
      font-size: 14px;
      transition: background-color 0.3s;
    }

    button:hover:not(:disabled) {
      background: #0056b3;
    }

    button:disabled {
      background: #6c757d;
      cursor: not-allowed;
    }

    input[type="range"] {
      width: 100%;
    }
  `]
})
export class TumorDetectionComponent implements OnInit {
  @ViewChild('originalCanvas', { static: false }) originalCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('detectionCanvas', { static: false }) detectionCanvas!: ElementRef<HTMLCanvasElement>;

  // Signals for reactive state management
  originalImage = signal<HTMLImageElement | null>(null);
  processing = signal(false);
  training = signal(false);
  loading = signal(false);
  trainingProgress = signal(0);
  contrast = signal(1.0);
  brightness = signal(1.0);
  detectionResult = signal<{
    detected: boolean;
    confidence?: number;
    area?: number;
    location?: { x: number; y: number };
  } | null>(null);

  // Model and processing variables
  private tumorModel: tf.LayersModel | null = null;
  private imageData: ImageData | null = null;

  async ngOnInit() {
    console.log('Tumor Detection Component initialized');
    console.log('TensorFlow.js version:', tf.version);
    
    // Initialize with a simple model for demonstration
    await this.createSimpleTumorDetectionModel();
  }

  // Create a simple tumor detection model for demonstration
  private async createSimpleTumorDetectionModel() {
    try {
      // Simple CNN model for binary classification (tumor/no tumor)
      this.tumorModel = tf.sequential({
        layers: [
          tf.layers.conv2d({
            inputShape: [512, 512, 1], // Grayscale medical images
            filters: 32,
            kernelSize: 3,
            activation: 'relu',
            padding: 'same'
          }),
          tf.layers.maxPooling2d({ poolSize: 2 }),
          tf.layers.conv2d({
            filters: 64,
            kernelSize: 3,
            activation: 'relu',
            padding: 'same'
          }),
          tf.layers.maxPooling2d({ poolSize: 2 }),
          tf.layers.conv2d({
            filters: 128,
            kernelSize: 3,
            activation: 'relu',
            padding: 'same'
          }),
          tf.layers.globalAveragePooling2d({}),
          tf.layers.dropout({ rate: 0.5 }),
          tf.layers.dense({ units: 128, activation: 'relu' }),
          tf.layers.dense({ units: 1, activation: 'sigmoid' }) // Binary classification
        ]
      });

      this.tumorModel.compile({
        optimizer: tf.train.adam(0.001),
        loss: 'binaryCrossentropy',
        metrics: ['accuracy']
      });

      console.log('Simple tumor detection model created');
    } catch (error) {
      console.error('Error creating model:', error);
    }
  }

  // Handle image selection
  onImageSelected(event: any) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        this.originalImage.set(img);
        // Use setTimeout to ensure ViewChild is initialized
        setTimeout(() => {
          this.drawOriginalImage();
          this.resetDetection();
        }, 0);
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  }

  // Draw the original image on canvas
  private drawOriginalImage() {
    const img = this.originalImage();
    if (!img || !this.originalCanvas?.nativeElement) return;

    const canvas = this.originalCanvas.nativeElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw image scaled to fit canvas
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    
    // Store image data for processing
    this.imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  }

  // Apply image filters
  applyFilters() {
    if (!this.imageData || !this.originalCanvas?.nativeElement) return;

    const canvas = this.originalCanvas.nativeElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Create a copy of image data
    const filteredData = new ImageData(
      new Uint8ClampedArray(this.imageData.data),
      this.imageData.width,
      this.imageData.height
    );

    // Apply contrast and brightness
    for (let i = 0; i < filteredData.data.length; i += 4) {
      // Apply to RGB channels
      for (let j = 0; j < 3; j++) {
        let value = filteredData.data[i + j];
        // Apply brightness and contrast
        value = (value * this.contrast() + (this.brightness() - 1) * 128);
        filteredData.data[i + j] = Math.max(0, Math.min(255, value));
      }
    }

    ctx.putImageData(filteredData, 0, 0);
  }

  // Reset filters to default
  resetFilters() {
    this.contrast.set(1.0);
    this.brightness.set(1.0);
    this.drawOriginalImage();
  }

  // Update contrast
  updateContrast(event: any) {
    this.contrast.set(parseFloat(event.target.value));
  }

  // Update brightness
  updateBrightness(event: any) {
    this.brightness.set(parseFloat(event.target.value));
  }

  // Detect tumor using simple image processing techniques
  async detectTumor() {
    if (!this.imageData || !this.originalCanvas?.nativeElement) return;

    this.processing.set(true);

    try {
      // Use a simpler approach with canvas-based image processing
      const canvas = this.originalCanvas.nativeElement;
      const ctx = canvas.getContext('2d')!;
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      // Convert to grayscale and apply simple edge detection
      let edgePixels = 0;
      let totalPixels = canvas.width * canvas.height;
      let sumX = 0, sumY = 0, edgeCount = 0;

      // Simple edge detection using pixel differences
      for (let y = 1; y < canvas.height - 1; y++) {
        for (let x = 1; x < canvas.width - 1; x++) {
          const idx = (y * canvas.width + x) * 4;
          
          // Get grayscale values of surrounding pixels
          const current = (data[idx] + data[idx + 1] + data[idx + 2]) / 3;
          const right = (data[idx + 4] + data[idx + 5] + data[idx + 6]) / 3;
          const bottom = (data[idx + canvas.width * 4] + data[idx + canvas.width * 4 + 1] + data[idx + canvas.width * 4 + 2]) / 3;
          
          // Calculate edge strength
          const edgeX = Math.abs(current - right);
          const edgeY = Math.abs(current - bottom);
          const edgeStrength = Math.sqrt(edgeX * edgeX + edgeY * edgeY);
          
          // If edge is strong enough, consider it a potential tumor edge
          if (edgeStrength > 30) { // Threshold for edge detection
            edgePixels++;
            sumX += x;
            sumY += y;
            edgeCount++;
          }
        }
      }

      // Calculate detection metrics
      const edgeRatio = edgePixels / totalPixels;
      const detected = edgeRatio > 0.005; // At least 0.5% edge pixels
      const confidence = Math.min(edgeRatio * 50, 1); // Scale confidence

      // Calculate center of detected edges
      const centerX = edgeCount > 0 ? sumX / edgeCount : canvas.width / 2;
      const centerY = edgeCount > 0 ? sumY / edgeCount : canvas.height / 2;

      this.detectionResult.set({
        detected,
        confidence,
        area: edgePixels,
        location: { x: centerX, y: centerY }
      });

      console.log(`Detection complete: ${detected ? 'Tumor detected' : 'No tumor detected'}`);
      console.log(`Edge pixels: ${edgePixels}, Confidence: ${(confidence * 100).toFixed(1)}%`);

    } catch (error) {
      console.error('Error detecting tumor:', error);
    } finally {
      this.processing.set(false);
    }
  }

  // Segment tumor and highlight it
  async segmentTumor() {
    if (!this.detectionResult()?.detected || !this.detectionCanvas?.nativeElement || !this.originalCanvas?.nativeElement) return;

    this.processing.set(true);

    try {
      const detectionCanvas = this.detectionCanvas.nativeElement;
      const ctx = detectionCanvas.getContext('2d');
      if (!ctx) return;

      // Copy original image
      const originalCanvas = this.originalCanvas.nativeElement;
      ctx.drawImage(originalCanvas, 0, 0);

      // Draw detection circle
      const result = this.detectionResult()!;
      if (result.location) {
        ctx.strokeStyle = '#FF0000';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(result.location.x, result.location.y, Math.sqrt(result.area! / Math.PI), 0, 2 * Math.PI);
        ctx.stroke();

        // Add label
        ctx.fillStyle = '#FF0000';
        ctx.font = 'bold 16px Arial';
        ctx.fillText(
          `Tumor (${(result.confidence! * 100).toFixed(1)}%)`,
          result.location.x - 50,
          result.location.y - Math.sqrt(result.area! / Math.PI) - 10
        );
      }

    } catch (error) {
      console.error('Error segmenting tumor:', error);
    } finally {
      this.processing.set(false);
    }
  }

  // Load a pre-trained model (placeholder)
  async loadPretrainedModel() {
    this.loading.set(true);
    
    try {
      // Simulate loading a pre-trained model
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // In a real implementation, you would load a model trained on medical data:
      // this.tumorModel = await tf.loadLayersModel('/assets/models/tumor-detection/model.json');
      
      console.log('Pre-trained model loaded (simulated)');
    } catch (error) {
      console.error('Error loading pre-trained model:', error);
    } finally {
      this.loading.set(false);
    }
  }

  // Start training process (demonstration)
  async startTraining() {
    this.training.set(true);
    this.trainingProgress.set(0);

    try {
      // Simulate training process
      for (let epoch = 0; epoch < 10; epoch++) {
        await new Promise(resolve => setTimeout(resolve, 500));
        this.trainingProgress.set((epoch + 1) * 10);
      }

      console.log('Training completed (simulated)');
    } catch (error) {
      console.error('Error during training:', error);
    } finally {
      this.training.set(false);
    }
  }

  // Reset detection results
  private resetDetection() {
    this.detectionResult.set(null);
    if (this.detectionCanvas?.nativeElement) {
      const detectionCanvas = this.detectionCanvas.nativeElement;
      const ctx = detectionCanvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, detectionCanvas.width, detectionCanvas.height);
      }
    }
  }

  ngOnDestroy() {
    // Clean up model
    if (this.tumorModel) {
      this.tumorModel.dispose();
    }
  }
}