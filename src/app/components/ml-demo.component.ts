import { Component, OnInit, ViewChild, ElementRef, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import * as tf from '@tensorflow/tfjs';
import * as tfvis from '@tensorflow/tfjs-vis';

// Import specific models (updated package names)
import * as mobilenet from '@tensorflow-models/mobilenet';
import * as posenet from '@tensorflow-models/posenet';
import * as cocoSsd from '@tensorflow-models/coco-ssd';

@Component({
  selector: 'app-ml-demo',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="ml-demo-container">
      <h2>TensorFlow.js Libraries Demo</h2>
      
      <!-- Core TensorFlow.js Demo -->
      <section class="demo-section">
        <h3>1. Core TensorFlow.js - Linear Regression</h3>
        <button (click)="trainLinearModel()" [disabled]="training()">
          {{ training() ? 'Training...' : 'Train Linear Model' }}
        </button>
        <div id="linear-model-plot"></div>
        <p *ngIf="linearModelResult()">
          Model trained! Loss: {{ linearModelResult()?.loss | number:'1.4-4' }}
        </p>
      </section>

      <!-- Pre-trained Models Demo -->
      <section class="demo-section">
        <h3>2. Pre-trained Models - Image Classification</h3>
        <input type="file" (change)="onImageSelected($event)" accept="image/*">
        <canvas #imageCanvas width="224" height="224"></canvas>
        <div *ngIf="imageClassification()">
          <h4>Predictions:</h4>
          <ul>
            <li *ngFor="let pred of imageClassification()">
              {{ pred.className }}: {{ (pred.probability * 100) | number:'1.1-1' }}%
            </li>
          </ul>
        </div>
      </section>

      <!-- Object Detection Demo -->
      <section class="demo-section">
        <h3>3. Object Detection (COCO-SSD)</h3>
        <video #videoElement width="640" height="480" autoplay></video>
        <canvas #detectionCanvas width="640" height="480"></canvas>
        <button (click)="startObjectDetection()" [disabled]="detectingObjects()">
          {{ detectingObjects() ? 'Detecting...' : 'Start Object Detection' }}
        </button>
        <button (click)="stopObjectDetection()" [disabled]="!detectingObjects()">
          Stop Detection
        </button>
      </section>

      <!-- Pose Estimation Demo -->
      <section class="demo-section">
        <h3>4. Pose Estimation</h3>
        <canvas #poseCanvas width="640" height="480"></canvas>
        <button (click)="startPoseEstimation()" [disabled]="estimatingPose()">
          {{ estimatingPose() ? 'Estimating...' : 'Start Pose Estimation' }}
        </button>
      </section>

      <!-- Data Pipeline Demo -->
      <section class="demo-section">
        <h3>5. TensorFlow.js Data Pipeline</h3>
        <button (click)="demonstrateDataPipeline()">
          Process Dataset
        </button>
        <div *ngIf="datasetResult()">
          <p>Processed {{ datasetResult()?.count }} samples</p>
          <p>Average value: {{ datasetResult()?.average | number:'1.2-2' }}</p>
        </div>
      </section>
    </div>
  `,
  styles: [`
    .ml-demo-container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 20px;
    }

    .demo-section {
      margin: 30px 0;
      padding: 20px;
      border: 1px solid #ddd;
      border-radius: 8px;
    }

    .demo-section h3 {
      color: #2196F3;
      margin-bottom: 15px;
    }

    button {
      background: #2196F3;
      color: white;
      border: none;
      padding: 10px 20px;
      border-radius: 4px;
      cursor: pointer;
      margin: 10px 5px;
    }

    button:disabled {
      background: #ccc;
      cursor: not-allowed;
    }

    canvas, video {
      border: 1px solid #ccc;
      margin: 10px 0;
      display: block;
    }

    ul {
      list-style-type: none;
      padding: 0;
    }

    li {
      background: #f5f5f5;
      margin: 5px 0;
      padding: 10px;
      border-radius: 4px;
    }
  `]
})
export class MlDemoComponent implements OnInit {
  @ViewChild('imageCanvas', { static: true }) imageCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('videoElement', { static: true }) videoElement!: ElementRef<HTMLVideoElement>;
  @ViewChild('detectionCanvas', { static: true }) detectionCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('poseCanvas', { static: true }) poseCanvas!: ElementRef<HTMLCanvasElement>;

  // Signals for reactive state management
  training = signal(false);
  detectingObjects = signal(false);
  estimatingPose = signal(false);
  linearModelResult = signal<{ loss: number } | null>(null);
  imageClassification = signal<Array<{ className: string; probability: number }> | null>(null);
  datasetResult = signal<{ count: number; average: number } | null>(null);

  // Models
  private mobilenetModel: any = null;
  private cocoSsdModel: any = null;
  private posenetModel: any = null;
  private detectionInterval: any = null;

  async ngOnInit() {
    console.log('TensorFlow.js version:', tf.version);
    await this.loadModels();
  }

  private async loadModels() {
    try {
      console.log('Loading pre-trained models...');
      
      // Load MobileNet for image classification
      this.mobilenetModel = await mobilenet.load();
      console.log('MobileNet loaded');

      // Load COCO-SSD for object detection
      this.cocoSsdModel = await cocoSsd.load();
      console.log('COCO-SSD loaded');

      // Load PoseNet for pose estimation
      this.posenetModel = await posenet.load();
      console.log('PoseNet loaded');

    } catch (error) {
      console.error('Error loading models:', error);
    }
  }

  // 1. Core TensorFlow.js - Linear Regression
  async trainLinearModel() {
    this.training.set(true);

    try {
      // Generate synthetic data
      const xs = tf.randomUniform([100, 1]);
      const ys = xs.mul(3).add(2).add(tf.randomNormal([100, 1], 0, 0.1));

      // Create a simple linear model
      const model = tf.sequential({
        layers: [
          tf.layers.dense({ inputShape: [1], units: 1 })
        ]
      });

      // Compile the model
      model.compile({
        optimizer: tf.train.sgd(0.1),
        loss: 'meanSquaredError'
      });

      // Visualize training progress
      const surface = tfvis.visor().surface({ name: 'Loss', tab: 'Training' });

      // Train the model
      const history = await model.fitDataset(
        tf.data.zip({
          xs: tf.data.array((xs.arraySync() as number[][]).map((v: number[]) => v[0])),
          ys: tf.data.array((ys.arraySync() as number[][]).map((v: number[]) => v[0]))
        }).batch(10),
        {
          epochs: 50,
          callbacks: tfvis.show.fitCallbacks(surface, ['loss'])
        }
      );

      const finalLoss = history.history['loss'][history.history['loss'].length - 1] as number;
      this.linearModelResult.set({ loss: finalLoss });

      // Clean up tensors
      xs.dispose();
      ys.dispose();
      model.dispose();

    } catch (error) {
      console.error('Error training model:', error);
    } finally {
      this.training.set(false);
    }
  }

  // 2. Image Classification with MobileNet
  async onImageSelected(event: any) {
    const file = event.target.files[0];
    if (!file || !this.mobilenetModel) return;

    const canvas = this.imageCanvas.nativeElement;
    const ctx = canvas.getContext('2d')!;
    
    const img = new Image();
    img.onload = async () => {
      // Draw image to canvas
      ctx.drawImage(img, 0, 0, 224, 224);
      
      // Classify the image
      const predictions = await this.mobilenetModel.classify(canvas);
      this.imageClassification.set(predictions.slice(0, 3)); // Top 3 predictions
    };
    
    img.src = URL.createObjectURL(file);
  }

  // 3. Object Detection with COCO-SSD
  async startObjectDetection() {
    if (!this.cocoSsdModel) {
      console.error('COCO-SSD model not loaded');
      return;
    }

    this.detectingObjects.set(true);

    try {
      // Get user media
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { width: 640, height: 480 } 
      });
      
      const video = this.videoElement.nativeElement;
      video.srcObject = stream;
      
      const canvas = this.detectionCanvas.nativeElement;
      const ctx = canvas.getContext('2d')!;

      // Detection loop
      this.detectionInterval = setInterval(async () => {
        if (video.readyState === 4) {
          // Draw video frame to canvas
          ctx.drawImage(video, 0, 0, 640, 480);
          
          // Detect objects
          const predictions = await this.cocoSsdModel.detect(canvas);
          
          // Draw bounding boxes
          predictions.forEach((prediction: any) => {
            const [x, y, width, height] = prediction.bbox;
            
            ctx.strokeStyle = '#2196F3';
            ctx.lineWidth = 2;
            ctx.strokeRect(x, y, width, height);
            
            ctx.fillStyle = '#2196F3';
            ctx.font = '16px Arial';
            ctx.fillText(
              `${prediction.class} (${Math.round(prediction.score * 100)}%)`,
              x, y > 20 ? y - 5 : y + 20
            );
          });
        }
      }, 100);

    } catch (error) {
      console.error('Error starting object detection:', error);
      this.detectingObjects.set(false);
    }
  }

  stopObjectDetection() {
    if (this.detectionInterval) {
      clearInterval(this.detectionInterval);
      this.detectionInterval = null;
    }
    
    // Stop video stream
    const video = this.videoElement.nativeElement;
    if (video.srcObject) {
      const stream = video.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      video.srcObject = null;
    }
    
    this.detectingObjects.set(false);
  }

  // 4. Pose Estimation with PoseNet
  async startPoseEstimation() {
    if (!this.posenetModel) {
      console.error('PoseNet model not loaded');
      return;
    }

    this.estimatingPose.set(true);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { width: 640, height: 480 } 
      });
      
      const canvas = this.poseCanvas.nativeElement;
      const ctx = canvas.getContext('2d')!;

      const video = document.createElement('video');
      video.srcObject = stream;
      video.play();

      video.onloadedmetadata = () => {
        const detectPoses = async () => {
          if (video.readyState === 4) {
            const pose = await this.posenetModel.estimateSinglePose(video);
            
            // Clear canvas
            ctx.clearRect(0, 0, 640, 480);
            
            // Draw keypoints
            pose.keypoints.forEach((keypoint: any) => {
              if (keypoint.score > 0.5) {
                ctx.beginPath();
                ctx.arc(keypoint.position.x, keypoint.position.y, 5, 0, 2 * Math.PI);
                ctx.fillStyle = '#FF6B6B';
                ctx.fill();
              }
            });
          }
          
          if (this.estimatingPose()) {
            requestAnimationFrame(detectPoses);
          }
        };
        
        detectPoses();
      };

    } catch (error) {
      console.error('Error starting pose estimation:', error);
      this.estimatingPose.set(false);
    }
  }

  // 5. Data Pipeline Demo
  async demonstrateDataPipeline() {
    try {
      // Create a dataset from array
      const data = Array.from({ length: 1000 }, () => Math.random() * 100);
      
      // Create TensorFlow.js dataset
      const dataset = tf.data.array(data)
        .map(x => tf.scalar(x))
        .filter(x => x.dataSync()[0] > 50) // Filter values > 50
        .map(x => x.mul(2)) // Multiply by 2
        .batch(32); // Batch size 32

      // Process the dataset
      let count = 0;
      let sum = 0;
      
      await dataset.forEachAsync((batch: tf.TensorContainer) => {
        let values: number[] = [];
        if (Array.isArray(batch)) {
          batch.forEach(tensor => {
            const tensorValues = (tensor as tf.Tensor).dataSync();
            values.push(...tensorValues);
            (tensor as tf.Tensor).dispose();
          });
        } else {
          values = Array.from((batch as tf.Tensor).dataSync());
          (batch as tf.Tensor).dispose();
        }
        count += values.length;
        sum += values.reduce((a, b) => a + b, 0);
      });

      this.datasetResult.set({
        count,
        average: sum / count
      });

    } catch (error) {
      console.error('Error processing dataset:', error);
    }
  }

  ngOnDestroy() {
    this.stopObjectDetection();
    this.estimatingPose.set(false);
    
    // Clean up models
    if (this.mobilenetModel) this.mobilenetModel.dispose();
    if (this.cocoSsdModel) this.cocoSsdModel.dispose();
    if (this.posenetModel) this.posenetModel.dispose();
  }
}