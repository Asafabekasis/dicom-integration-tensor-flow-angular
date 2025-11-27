import { Component, OnInit, ViewChild, ElementRef, signal, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import * as tf from '@tensorflow/tfjs';

// For 3D rendering, we'll use Three.js (you'll need to install it)
// npm install three @types/three

interface Point3D {
  x: number;
  y: number;
  z: number;
}

interface TumorRegion3D {
  center: Point3D;
  volume: number;
  confidence: number;
  boundingBox: {
    min: Point3D;
    max: Point3D;
  };
}

@Component({
  selector: 'app-tumor-detection-3d',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="tumor-3d-container">
      <h2>🧠 3D Medical Tumor Detection & Visualization</h2>
      <p class="disclaimer">
        <strong>⚠️ Medical Disclaimer:</strong> For educational and research purposes only.
      </p>

      <!-- File Upload Section -->
      <section class="upload-section">
        <h3>📁 Upload 3D Medical Data</h3>
        <div class="upload-options">
          <!-- DICOM Stack Upload -->
          <div class="upload-option">
            <label for="dicomStack">🏥 DICOM Stack (Direct .dcm Support)</label>
            <input #dicomStack type="file" (change)="onDicomStackSelected($event)" 
                   multiple accept=".dcm,.dicom,.png,.jpg,.jpeg,.bmp,.gif">
            <small style="display: block; color: #4CAF50; margin-top: 5px;">
              ✅ Direct DICOM (.dcm) file support enabled!
            </small>
          </div>
          
          <!-- Simulated 3D Data -->
          <div class="upload-option">
            <button (click)="generateSample3DData()">
              🎲 Generate Sample 3D Brain Data
            </button>
            <button (click)="quickDemo()" style="margin-left: 10px; background: #ff4444; color: white; font-weight: bold;">
              🚀 INSTANT TUMOR DEMO
            </button>
            <button (click)="debugVolumeData()" *ngIf="volumeData()">
              🔍 Debug Volume Data
            </button>
            <button (click)="analyzeDicomData()" *ngIf="volumeData() && dataSource === 'uploaded'" style="margin-left: 10px;">
              🏥 Analyze DICOM
            </button>
            <button (click)="toggleInteractive3D()" *ngIf="volumeData()" 
                    [style]="'margin-left: 10px; background: ' + (interactive3D() ? '#4CAF50' : '#666')">
              🎮 {{ interactive3D() ? 'Interactive 3D: ON' : 'Interactive 3D: OFF' }}
            </button>
          </div>

          <!-- Multiple 2D Slices -->
          <div class="upload-option">
            <label for="imageStack">Image Stack (PNG/JPG Slices)</label>
            <input #imageStack type="file" (change)="onImageStackSelected($event)" 
                   multiple accept="image/*">
          </div>
        </div>
      </section>

      <!-- Volume Status -->
      <div class="status-bar" *ngIf="volumeData()">
        ✅ Volume loaded: {{ volumeDimensions().x }}×{{ volumeDimensions().y }}×{{ volumeDimensions().z }} voxels
      </div>

      <!-- 3D Visualization Section -->
      <section class="visualization-section" *ngIf="volumeData()">
        <div class="viz-container">
          <!-- 3D Renderer -->
          <div class="renderer-panel">
            <h4>🎮 3D Volume Visualization</h4>
            <canvas #volume3DCanvas width="600" height="400" class="volume-canvas"
                    (mousedown)="onMouseDown($event)"
                    (mousemove)="onMouseMove($event)"
                    (mouseup)="onMouseUp($event)"
                    (mouseleave)="onMouseUp($event)"
                    (wheel)="onMouseWheel($event)"></canvas>
            <div class="render-controls">
              <button (click)="render3DVolume()" [disabled]="!volumeData()">
                🎨 Render 3D Volume
              </button>
              <button (click)="rotate3DView()" [disabled]="!rendering()">
                {{ autoRotate() ? '⏸️ Stop' : '▶️ Auto Rotate' }}
              </button>
              <button (click)="toggleProjection()">
                {{ projectionType() === 'mip' ? '📊 Average' : '� Max Intensity' }}
              </button>
              <button (click)="resetView()">🎯 Reset View</button>
            </div>

            <!-- Manual Rotation Controls -->
            <div class="rotation-controls">
              <h5>🔄 Manual Rotation</h5>
              <div class="rotation-sliders">
                <label>
                  X-Axis: {{ rotation3D().x.toFixed(0) }}°
                  <input type="range" min="-180" max="180" step="5" 
                         [value]="rotation3D().x" 
                         (input)="updateRotation('x', $event)">
                  <button (click)="resetRotation('x')">↺</button>
                </label>
                <label>
                  Y-Axis: {{ rotation3D().y.toFixed(0) }}°
                  <input type="range" min="-180" max="180" step="5" 
                         [value]="rotation3D().y" 
                         (input)="updateRotation('y', $event)">
                  <button (click)="resetRotation('y')">↺</button>
                </label>
                <label>
                  Zoom: {{ (zoom3D() * 100).toFixed(0) }}%
                  <input type="range" min="50" max="300" step="10" 
                         [value]="zoom3D() * 100" 
                         (input)="updateZoom($event)">
                  <button (click)="resetZoom()">🔍</button>
                </label>
              </div>
              <div class="rotation-buttons">
                <button (click)="rotateBy(-15, 0)">⬅️ Left</button>
                <button (click)="rotateBy(15, 0)">➡️ Right</button>
                <button (click)="rotateBy(0, -15)">⬆️ Up</button>
                <button (click)="rotateBy(0, 15)">⬇️ Down</button>
                <button (click)="resetAllRotations()">🎯 Reset All</button>
              </div>
              <div class="interaction-help">
                <small>💡 <strong>Tip:</strong> Click and drag on canvas to rotate manually!</small>
              </div>
            </div>

            <div class="projection-info">
              <p><strong>Current View:</strong> {{ projectionType() === 'mip' ? 'Maximum Intensity Projection' : 'Average Intensity Projection' }}</p>
              <p><strong>Rotation:</strong> X:{{ rotation3D().x.toFixed(0) }}° Y:{{ rotation3D().y.toFixed(0) }}° Zoom:{{ (zoom3D()*100).toFixed(0) }}%</p>
            </div>
          </div>

          <!-- Slice Viewer -->
          <div class="slice-panel">
            <h4>📊 Cross-Sectional Views</h4>
            <div class="slice-controls">
              <label [style]="'color: ' + (interactive3D() ? '#4CAF50' : 'white')">
                🎮 Axial (Z): {{ currentSlice().z }} {{ interactive3D() ? '📡 LIVE 3D' : '' }}
                <input type="range" [min]="0" [max]="maxSlices().z" 
                       [value]="currentSlice().z" (input)="updateSlice('z', $event)"
                       [style]="'accent-color: ' + (interactive3D() ? '#4CAF50' : '#666')">
              </label>
              <label [style]="'color: ' + (interactive3D() ? '#4CAF50' : 'white')">
                🎮 Coronal (Y): {{ currentSlice().y }} {{ interactive3D() ? '📡 LIVE 3D' : '' }}
                <input type="range" [min]="0" [max]="maxSlices().y" 
                       [value]="currentSlice().y" (input)="updateSlice('y', $event)"
                       [style]="'accent-color: ' + (interactive3D() ? '#4CAF50' : '#666')">
              </label>
              <label [style]="'color: ' + (interactive3D() ? '#4CAF50' : 'white')">
                🎮 Sagittal (X): {{ currentSlice().x }} {{ interactive3D() ? '📡 LIVE 3D' : '' }}
                <input type="range" [min]="0" [max]="maxSlices().x" 
                       [value]="currentSlice().x" (input)="updateSlice('x', $event)"
                       [style]="'accent-color: ' + (interactive3D() ? '#4CAF50' : '#666')">
              </label>
            </div>
            
            <div class="slice-canvases">
              <canvas #axialCanvas width="256" height="256"></canvas>
              <canvas #coronalCanvas width="256" height="256"></canvas>
              <canvas #sagittalCanvas width="256" height="256"></canvas>
            </div>
          </div>
        </div>
      </section>

      <!-- 3D Analysis Section -->
      <section class="analysis-section" *ngIf="volumeData()">
        <h4>🔬 3D Tumor Analysis</h4>
        <div class="analysis-controls">
          <button (click)="detect3DTumors()" [disabled]="processing()">
            {{ processing() ? 'Analyzing 3D Volume...' : '🎯 Detect 3D Tumors' }}
          </button>
          <button (click)="segment3DTumors()" [disabled]="!detectionResults() || processing()">
            🎨 Segment & Visualize
          </button>
          <button (click)="calculate3DMetrics()" [disabled]="!detectionResults()">
            📐 Calculate 3D Metrics
          </button>
        </div>

        <!-- Processing Progress -->
        <div class="progress-section" *ngIf="processing()">
          <div class="progress-bar">
            <div class="progress-fill" [style.width.%]="processingProgress()"></div>
          </div>
          <p>Processing slice {{ currentProcessingSlice() }} of {{ totalSlices() }} 
             ({{ processingProgress() | number:'1.0-0' }}%)</p>
          <button (click)="cancelProcessing()" class="cancel-btn">❌ Cancel Processing</button>
        </div>

        <!-- 3D Results -->
        <div class="results-3d" *ngIf="detectionResults()">
          <h5>📊 3D Analysis Results</h5>
          <div class="results-grid">
            <div class="result-card" *ngFor="let tumor of detectionResults(); let i = index">
              <h6>Tumor Region {{ i + 1 }}</h6>
              <div class="metric">
                <strong>Volume:</strong> {{ tumor.volume | number:'1.0-0' }} mm³
              </div>
              <div class="metric">
                <strong>Center:</strong> 
                ({{ tumor.center.x | number:'1.1-1' }}, 
                 {{ tumor.center.y | number:'1.1-1' }}, 
                 {{ tumor.center.z | number:'1.1-1' }})
              </div>
              <div class="metric">
                <strong>Confidence:</strong> 
                <span [class]="getConfidenceClass(tumor.confidence)">
                  {{ (tumor.confidence * 100) | number:'1.1-1' }}%
                </span>
              </div>
              <div class="metric">
                <strong>Bounding Box:</strong>
                <small>
                  Min: ({{ tumor.boundingBox.min.x | number:'1.0-0' }}, 
                        {{ tumor.boundingBox.min.y | number:'1.0-0' }}, 
                        {{ tumor.boundingBox.min.z | number:'1.0-0' }})
                  <br>
                  Max: ({{ tumor.boundingBox.max.x | number:'1.0-0' }}, 
                        {{ tumor.boundingBox.max.y | number:'1.0-0' }}, 
                        {{ tumor.boundingBox.max.z | number:'1.0-0' }})
                </small>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- 3D Model Configuration -->
      <section class="config-section" *ngIf="volumeData()">
        <h4>⚙️ 3D Visualization Settings</h4>
        <div class="config-grid">
          <label>
            Opacity: {{ opacity() }}
            <input type="range" min="0.1" max="1" step="0.1" 
                   [value]="opacity()" (input)="updateOpacity($event)">
          </label>
          <label>
            Threshold: {{ threshold() }}
            <input type="range" min="0" max="255" step="5" 
                   [value]="threshold()" (input)="updateThreshold($event)">
          </label>
          <label>
            Tumor Color:
            <input type="color" [value]="tumorColor()" (input)="updateTumorColor($event)">
          </label>
          <label>
            Background Color:
            <input type="color" [value]="backgroundColor()" (input)="updateBackgroundColor($event)">
          </label>
        </div>
      </section>

      <!-- Volume Statistics -->
      <section class="stats-section" *ngIf="volumeData()">
        <h4>📈 Volume Statistics</h4>
        <div class="stats-grid">
          <div class="stat-item">
            <strong>Dimensions:</strong>
            {{ volumeDimensions().x }}×{{ volumeDimensions().y }}×{{ volumeDimensions().z }}
          </div>
          <div class="stat-item">
            <strong>Voxel Size:</strong>
            {{ voxelSize().x }}×{{ voxelSize().y }}×{{ voxelSize().z }} mm
          </div>
          <div class="stat-item">
            <strong>Total Volume:</strong>
            {{ totalVolume() | number:'1.0-0' }} mm³
          </div>
          <div class="stat-item">
            <strong>Tumor Volume:</strong>
            {{ tumorVolume() | number:'1.0-0' }} mm³ ({{ tumorPercentage() | number:'1.1-1' }}%)
          </div>
        </div>
      </section>
    </div>
  `,
  styles: [`
    .tumor-3d-container {
      max-width: 1600px;
      margin: 0 auto;
      padding: 20px;
    }

    .disclaimer {
      background: #fff3cd;
      border: 1px solid #ffeaa7;
      padding: 15px;
      border-radius: 8px;
      margin-bottom: 20px;
      color: #856404;
    }

    .upload-section, .visualization-section, .analysis-section, 
    .config-section, .stats-section {
      background: white;
      border: 1px solid #dee2e6;
      border-radius: 8px;
      padding: 20px;
      margin: 20px 0;
    }

    .upload-options {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      gap: 15px;
    }

    .upload-option {
      border: 2px dashed #007bff;
      padding: 20px;
      border-radius: 8px;
      text-align: center;
    }

    .viz-container {
      display: grid;
      grid-template-columns: 2fr 1fr;
      gap: 20px;
    }

    .threejs-container {
      width: 100%;
      height: 400px;
      border: 1px solid #ced4da;
      border-radius: 8px;
      background: #000;
    }

    .slice-canvases {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 10px;
      margin-top: 15px;
    }

    .slice-canvases canvas {
      border: 1px solid #ced4da;
      border-radius: 4px;
      width: 100%;
    }

    .volume-canvas {
      border: 2px solid #007bff;
      border-radius: 8px;
      background: #000;
      display: block;
      margin: 10px 0;
      box-shadow: 0 4px 15px rgba(0, 123, 255, 0.2);
      cursor: grab;
      transition: box-shadow 0.2s ease;
    }

    .volume-canvas:active {
      cursor: grabbing;
      box-shadow: 0 6px 20px rgba(0, 123, 255, 0.4);
    }

    .volume-canvas:hover {
      box-shadow: 0 5px 18px rgba(0, 123, 255, 0.3);
    }

    .projection-info {
      background: #f8f9fa;
      border: 1px solid #dee2e6;
      border-radius: 6px;
      padding: 10px;
      margin-top: 10px;
      font-size: 14px;
    }

    .projection-info p {
      margin: 5px 0;
    }

    .render-controls, .analysis-controls {
      display: flex;
      gap: 10px;
      margin-top: 15px;
      flex-wrap: wrap;
    }

    .rotation-controls {
      margin-top: 15px;
      padding: 15px;
      background: rgba(255, 255, 255, 0.05);
      border-radius: 8px;
      border: 1px solid rgba(255, 255, 255, 0.1);
    }

    .rotation-controls h5 {
      margin: 0 0 10px 0;
      color: #4CAF50;
      font-size: 14px;
    }

    .rotation-sliders {
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin-bottom: 10px;
    }

    .rotation-sliders label {
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: 12px;
      color: #ccc;
    }

    .rotation-sliders input[type="range"] {
      flex: 1;
      min-width: 100px;
    }

    .rotation-sliders button {
      min-width: 30px;
      height: 25px;
      padding: 0;
      font-size: 12px;
    }

    .rotation-buttons {
      display: flex;
      gap: 5px;
      flex-wrap: wrap;
      margin-bottom: 10px;
    }

    .rotation-buttons button {
      padding: 5px 10px;
      font-size: 12px;
      min-width: 60px;
    }

    .interaction-help {
      text-align: center;
      margin-top: 10px;
    }

    .interaction-help small {
      color: #FFD700;
      font-size: 11px;
    }

    .slice-controls {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .slice-controls label {
      display: flex;
      flex-direction: column;
      gap: 5px;
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

    .results-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      gap: 15px;
      margin-top: 15px;
    }

    .result-card {
      background: #f8f9fa;
      border: 1px solid #dee2e6;
      border-radius: 8px;
      padding: 15px;
    }

    .result-card h6 {
      color: #495057;
      margin-bottom: 10px;
    }

    .metric {
      margin: 8px 0;
      padding: 5px 0;
      border-bottom: 1px solid #e9ecef;
    }

    .config-grid, .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 15px;
    }

    .config-grid label {
      display: flex;
      flex-direction: column;
      gap: 5px;
    }

    .stat-item {
      background: #f8f9fa;
      padding: 15px;
      border-radius: 8px;
      border: 1px solid #dee2e6;
    }

    .confidence-high { color: #28a745; font-weight: bold; }
    .confidence-medium { color: #ffc107; font-weight: bold; }
    .confidence-low { color: #dc3545; font-weight: bold; }

    .cancel-btn {
      background: #dc3545;
      margin-top: 10px;
    }

    .cancel-btn:hover {
      background: #c82333;
    }

    .status-bar {
      background: #d4edda;
      border: 1px solid #c3e6cb;
      color: #155724;
      padding: 10px;
      border-radius: 8px;
      margin: 10px 0;
      font-weight: 500;
    }

    button {
      background: #007bff;
      color: white;
      border: none;
      padding: 8px 16px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 14px;
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

    input[type="color"] {
      width: 50px;
      height: 30px;
      border: none;
      border-radius: 4px;
      cursor: pointer;
    }
  `]
})
export class TumorDetection3DComponent implements OnInit, AfterViewInit {
  // Make Math available to template
  Math = Math;
  
  @ViewChild('threejsContainer', { static: false }) threejsContainer!: ElementRef<HTMLDivElement>;
  @ViewChild('axialCanvas', { static: false }) axialCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('coronalCanvas', { static: false }) coronalCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('sagittalCanvas', { static: false }) sagittalCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('volume3DCanvas', { static: false }) volume3DCanvas!: ElementRef<HTMLCanvasElement>;

  // 3D Volume Data
  volumeData = signal<Float32Array | null>(null);
  volumeDimensions = signal<Point3D>({ x: 256, y: 256, z: 128 });
  voxelSize = signal<Point3D>({ x: 1.0, y: 1.0, z: 1.0 }); // mm
  
  // Slice Navigation
  currentSlice = signal<Point3D>({ x: 128, y: 128, z: 64 });
  maxSlices = signal<Point3D>({ x: 255, y: 255, z: 127 });

  // Processing State
  processing = signal(false);
  processingProgress = signal(0);
  currentProcessingSlice = signal(0);
  totalSlices = signal(0);
  rendering = signal(false);

  // 3D Visualization Settings
  autoRotate = signal(false);
  wireframe = signal(false);
  opacity = signal(0.8);
  threshold = signal(128);
  tumorColor = signal('#ff0000');
  backgroundColor = signal('#000000');
  projectionType = signal<'mip' | 'average'>('mip'); // Maximum Intensity Projection or Average
  rotationAngle = signal(0);

  // Interactive 3D Controls
  rotation3D = signal({ x: 0, y: 0 });
  zoom3D = signal(1.0);
  sliceMode = signal(false);
  slicePosition = signal(0);
  sliceThickness = signal(5);
  interactive3D = signal(true); // Real-time 3D slice interaction

  // Mouse interaction state
  private mouseDown = false;
  private lastMouseX = 0;
  private lastMouseY = 0;
  
  // Data source tracking (public for template access)
  dataSource: 'sample' | 'uploaded' = 'sample';

  // Detection Results
  detectionResults = signal<TumorRegion3D[] | null>(null);
  tumorVolume = signal(0);
  totalVolume = signal(0);
  tumorPercentage = signal(0);

  // Tumor Masks for each slice (for 3D visualization)
  tumorMasks: Float32Array[] = [];

  // Processing Control
  private processingCancelled = false;

  // Three.js Objects (we'll need to install Three.js for full implementation)
  private scene: any = null;
  private camera: any = null;
  private renderer: any = null;
  private volumeMesh: any = null;

  async ngOnInit() {
    console.log('3D Tumor Detection Component initialized');
    this.calculateTotalVolume();
  }

  async ngAfterViewInit() {
    // Initialize Three.js renderer when view is ready
    // For now, we'll use a canvas-based 3D visualization
    await this.initializeCanvas3D();
  }

  // Initialize canvas-based 3D visualization (simplified version without Three.js)
  private async initializeCanvas3D() {
    // This is a simplified version. For full 3D, install Three.js:
    // npm install three @types/three
    console.log('Initializing canvas-based 3D visualization');
  }

  // Generate sample 3D brain data with simulated tumors
  generateSample3DData() {
    console.log('Generating sample 3D brain data...');
    
    const dims = this.volumeDimensions();
    const totalVoxels = dims.x * dims.y * dims.z;
    const volume = new Float32Array(totalVoxels);

    // Generate brain-like structure
    const centerX = dims.x / 2;
    const centerY = dims.y / 2;
    const centerZ = dims.z / 2;

    for (let z = 0; z < dims.z; z++) {
      for (let y = 0; y < dims.y; y++) {
        for (let x = 0; x < dims.x; x++) {
          const index = z * dims.x * dims.y + y * dims.x + x;
          
          // Distance from center
          const dx = (x - centerX) / centerX;
          const dy = (y - centerY) / centerY;
          const dz = (z - centerZ) / centerZ;
          const distFromCenter = Math.sqrt(dx*dx + dy*dy + dz*dz);

          // Create brain-like shape
          let intensity = 0;
          if (distFromCenter < 0.8) {
            // Brain tissue
            intensity = 100 + Math.random() * 50;
            
            // Add some structure variation
            if (distFromCenter < 0.3) {
              intensity += 30; // Inner brain regions
            }
          }

          // Add simulated tumors
          this.addSimulatedTumors(x, y, z, dims, index, volume, intensity);
          
          if (volume[index] === 0) {
            volume[index] = intensity;
          }
        }
      }
    }

    this.volumeData.set(volume);
    this.totalSlices.set(dims.z);
    this.dataSource = 'sample'; // Mark as sample data
    this.calculateTotalVolume();
    this.renderSlices();
    
    console.log('Sample 3D data generated successfully');
  }

  // 🚀 INSTANT DEMO: Generate data + detect tumors automatically
  async quickDemo() {
    console.log('🚀 Starting instant tumor detection demo...');
    
    // Step 1: Generate test data with obvious tumors
    const dims = { x: 128, y: 128, z: 24 }; // Smaller for speed
    this.volumeDimensions.set(dims);
    const totalVoxels = dims.x * dims.y * dims.z;
    const volume = new Float32Array(totalVoxels);

    // Generate brain-like background
    for (let z = 0; z < dims.z; z++) {
      for (let y = 0; y < dims.y; y++) {
        for (let x = 0; x < dims.x; x++) {
          const index = z * dims.x * dims.y + y * dims.x + x;
          
          // Brain tissue background (medium intensity)
          let intensity = 60 + Math.random() * 60;
          
          // Add 2 VERY SMALL, PERFECT tumor regions for testing
          // Tumor 1: Small, perfect sphere (30 pixels)
          const dist1 = (x - 45) * (x - 45) + (y - 55) * (y - 55) + (z - 10) * (z - 10);
          if (dist1 < 30) {
            intensity = 255; // Maximum brightness
          }
          
          // Tumor 2: Another small, perfect sphere (25 pixels)  
          const dist2 = (x - 75) * (x - 75) + (y - 35) * (y - 35) + (z - 18) * (z - 18);
          if (dist2 < 25) {
            intensity = 250; // Very bright
          }
          
          volume[index] = intensity;
        }
      }
    }

    // Step 2: Load the data
    this.volumeData.set(volume);
    this.totalSlices.set(dims.z);
    this.dataSource = 'sample';
    this.calculateTotalVolume();
    
    console.log('✅ Test data generated, starting automatic tumor detection...');
    
    // Step 3: Automatically detect tumors
    setTimeout(async () => {
      await this.detect3DTumors();
      console.log('🎉 Demo complete! You should see red tumors in 3D view!');
    }, 500);
  }

  // 🏥 Analyze DICOM data characteristics
  analyzeDicomData() {
    if (!this.volumeData()) return;
    
    const volume = this.volumeData()!;
    const dims = this.volumeDimensions();
    
    console.log('🏥 DICOM Data Analysis:');
    
    // Analyze intensity distribution
    const stats = this.analyzeVolumeData(volume);
    const adaptiveThreshold = this.calculateAdaptiveThreshold(stats);
    
    console.log(`📊 Intensity Stats:`);
    console.log(`   Min: ${stats.min}`);
    console.log(`   Max: ${stats.max}`);
    console.log(`   Mean: ${stats.mean.toFixed(1)}`);
    console.log(`   Range: ${stats.max - stats.min}`);
    console.log(`   Detected as: ${stats.isDicom ? 'DICOM' : 'Regular Image'}`);
    console.log(`🎯 Adaptive Threshold: ${adaptiveThreshold.toFixed(1)}`);
    
    // Test detection on middle slice
    const midSlice = Math.floor(dims.z / 2);
    const brightPixels = this.findBrightPixels(volume, dims, midSlice, adaptiveThreshold, stats);
    console.log(`🔍 Test on slice ${midSlice}: Found ${brightPixels.length} potential tumor pixels`);
    
    alert(`DICOM Analysis:\nRange: ${stats.min}-${stats.max}\nType: ${stats.isDicom ? 'DICOM' : 'Image'}\nThreshold: ${adaptiveThreshold.toFixed(1)}\nTest pixels: ${brightPixels.length}`);
  }

  private addSimulatedTumors(x: number, y: number, z: number, dims: Point3D, index: number, volume: Float32Array, baseIntensity: number) {
    // Tumor 1: Spherical tumor
    const tumor1Center = { x: dims.x * 0.3, y: dims.y * 0.4, z: dims.z * 0.6 };
    const tumor1Radius = 15;
    const dist1 = Math.sqrt(
      Math.pow(x - tumor1Center.x, 2) + 
      Math.pow(y - tumor1Center.y, 2) + 
      Math.pow(z - tumor1Center.z, 2)
    );
    
    if (dist1 < tumor1Radius) {
      const tumorIntensity = 200 + Math.random() * 55;
      volume[index] = tumorIntensity;
      return;
    }

    // Tumor 2: Irregular tumor
    const tumor2Center = { x: dims.x * 0.7, y: dims.y * 0.6, z: dims.z * 0.4 };
    const dist2 = Math.sqrt(
      Math.pow(x - tumor2Center.x, 2) + 
      Math.pow(y - tumor2Center.y, 2) + 
      Math.pow(z - tumor2Center.z, 2)
    );
    
    if (dist2 < 12 && Math.random() > 0.3) { // Irregular shape
      const tumorIntensity = 180 + Math.random() * 75;
      volume[index] = tumorIntensity;
      return;
    }
  }

  // Handle DICOM stack upload with direct DICOM support
  onDicomStackSelected(event: any) {
    const files = Array.from(event.target.files) as File[];
    if (files.length === 0) return;

    console.log(`Processing ${files.length} DICOM files...`);
    
    // Check if files are DICOM (.dcm) files
    const dicomFiles = files.filter(f => f.name.toLowerCase().endsWith('.dcm'));
    
    if (dicomFiles.length > 0) {
      console.log(`🏥 Direct DICOM processing: ${dicomFiles.length} DICOM files detected`);
      this.processingCancelled = false;
      this.processDicomStack(dicomFiles);
      return;
    }
    
    // Process non-DICOM files as regular images
    console.log(`📷 Processing as image files...`);
    this.processingCancelled = false;
    this.processImageStack(files);
  }

  // Handle image stack upload (multiple 2D slices)
  onImageStackSelected(event: any) {
    const files = Array.from(event.target.files) as File[];
    if (files.length === 0) return;

    // Validate that files are images
    const validImageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/bmp'];
    const invalidFiles = files.filter(file => !validImageTypes.includes(file.type));
    
    if (invalidFiles.length > 0) {
      alert(`Invalid file types detected: ${invalidFiles.map(f => f.name).join(', ')}\nPlease upload only image files (JPG, PNG, GIF, BMP)`);
      return;
    }

    if (files.length > 500) {
      if (!confirm(`You're uploading ${files.length} files. This might take a while. Continue?`)) {
        return;
      }
    }

    console.log(`Processing ${files.length} image slices...`);
    this.processingCancelled = false; // Reset cancel flag
    this.processImageStack(files);
  }

  // Cancel processing
  cancelProcessing() {
    console.log('Processing cancelled by user');
    this.processingCancelled = true;
    this.processing.set(false);
    this.processingProgress.set(0);
  }

  // Process DICOM files directly
  private async processDicomStack(files: File[]) {
    this.processing.set(true);
    this.totalSlices.set(files.length);
    this.processingProgress.set(0);

    try {
      console.log(`🏥 Starting direct DICOM processing for ${files.length} files...`);
      
      let dims = { x: 512, y: 512, z: files.length }; // Default DICOM dimensions
      let volume = new Float32Array(dims.x * dims.y * dims.z);
      let actualDims = { x: 0, y: 0, z: files.length };

      for (let i = 0; i < files.length; i++) {
        if (this.processingCancelled) {
          console.log('DICOM processing cancelled');
          return;
        }

        console.log(`🔍 Processing DICOM slice ${i + 1}/${files.length}: ${files[i].name}`);
        
        this.currentProcessingSlice.set(i + 1);
        this.processingProgress.set(((i + 1) / files.length) * 100);

        try {
          const dicomData = await this.loadDicomFile(files[i]);
          
          if (dicomData) {
            // Update dimensions from first successful DICOM
            if (i === 0) {
              actualDims.x = dicomData.width;
              actualDims.y = dicomData.height;
              dims = actualDims;
              this.volumeDimensions.set(dims);
              
              // Recreate volume array with correct dimensions
              const newTotalVoxels = dims.x * dims.y * dims.z;
              volume = new Float32Array(newTotalVoxels);
            }
            
            this.copyDicomSliceToVolume(dicomData, i, dims, volume);
            console.log(`✅ DICOM slice ${i + 1} processed: ${dicomData.width}x${dicomData.height}`);
          }
        } catch (error) {
          console.error(`❌ Error processing DICOM slice ${i + 1}:`, error);
          // Continue with next slice
        }

        if (i % 3 === 0) {
          await new Promise(resolve => requestAnimationFrame(resolve));
        }
      }

      console.log('🏥 All DICOM slices processed, setting volume data...');
      this.volumeData.set(volume);
      this.dataSource = 'uploaded';
      this.maxSlices.set({ x: dims.x - 1, y: dims.y - 1, z: dims.z - 1 });
      this.calculateTotalVolume();
      
      console.log('🎨 Rendering DICOM slices...');
      setTimeout(() => {
        this.renderSlices();
        setTimeout(() => {
          this.render3DVolume();
        }, 300);
      }, 100);

    } catch (error) {
      console.error('❌ DICOM processing failed:', error);
      alert('❌ DICOM processing failed. Files may be corrupted or unsupported format.');
    } finally {
      this.processing.set(false);
      this.processingProgress.set(100);
      console.log('🏁 DICOM processing completed');
    }
  }

  // Load DICOM file and extract pixel data
  private async loadDicomFile(file: File): Promise<{width: number, height: number, pixelData: Uint16Array | Uint8Array} | null> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (event) => {
        try {
          const arrayBuffer = event.target?.result as ArrayBuffer;
          const dicomData = this.parseDicomBuffer(arrayBuffer);
          resolve(dicomData);
        } catch (error) {
          console.error('Error parsing DICOM:', error);
          resolve(null);
        }
      };
      
      reader.onerror = () => {
        console.error('Error reading DICOM file:', file.name);
        resolve(null);
      };
      
      reader.readAsArrayBuffer(file);
    });
  }

  // Basic DICOM parser (simplified version)
  private parseDicomBuffer(buffer: ArrayBuffer): {width: number, height: number, pixelData: Uint16Array | Uint8Array} | null {
    try {
      const dataView = new DataView(buffer);
      
      // Check for DICOM header
      const prefix = new Uint8Array(buffer, 128, 4);
      const prefixString = String.fromCharCode(...prefix);
      
      if (prefixString !== 'DICM') {
        console.log('⚠️ Not a standard DICOM file, attempting raw data extraction...');
        // Try to extract as raw pixel data
        return this.extractRawDicomData(buffer);
      }
      
      console.log('📋 Valid DICOM header found, parsing metadata...');
      
      // Parse DICOM tags to find image dimensions and pixel data
      let width = 512;  // Default
      let height = 512; // Default
      let pixelDataOffset = 0;
      let bitsAllocated = 16;
      
      // Simple tag scanning (this is a basic implementation)
      let offset = 132; // Start after DICM header
      
      while (offset < buffer.byteLength - 8) {
        const group = dataView.getUint16(offset, true);
        const element = dataView.getUint16(offset + 2, true);
        const vr = String.fromCharCode(dataView.getUint8(offset + 4), dataView.getUint8(offset + 5));
        
        let length = 0;
        let valueOffset = 0;
        
        // Handle different VR formats
        if (['OB', 'OW', 'SQ', 'UN'].includes(vr)) {
          length = dataView.getUint32(offset + 8, true);
          valueOffset = offset + 12;
        } else {
          length = dataView.getUint16(offset + 6, true);
          valueOffset = offset + 8;
        }
        
        // Look for specific tags
        if (group === 0x0028 && element === 0x0010) { // Rows
          height = dataView.getUint16(valueOffset, true);
          console.log(`📐 DICOM Height: ${height}`);
        } else if (group === 0x0028 && element === 0x0011) { // Columns
          width = dataView.getUint16(valueOffset, true);
          console.log(`📐 DICOM Width: ${width}`);
        } else if (group === 0x0028 && element === 0x0100) { // Bits Allocated
          bitsAllocated = dataView.getUint16(valueOffset, true);
          console.log(`🔢 Bits Allocated: ${bitsAllocated}`);
        } else if (group === 0x7FE0 && element === 0x0010) { // Pixel Data
          pixelDataOffset = valueOffset;
          console.log(`🖼️ Pixel Data found at offset: ${pixelDataOffset}`);
          break;
        }
        
        offset = valueOffset + length;
        
        // Safety check
        if (offset > buffer.byteLength) break;
      }
      
      if (pixelDataOffset === 0) {
        console.warn('⚠️ No pixel data found in DICOM, using raw extraction...');
        return this.extractRawDicomData(buffer);
      }
      
      // Extract pixel data
      const pixelDataLength = width * height;
      let pixelData: Uint16Array | Uint8Array;
      
      if (bitsAllocated === 16) {
        pixelData = new Uint16Array(buffer, pixelDataOffset, pixelDataLength);
      } else {
        pixelData = new Uint8Array(buffer, pixelDataOffset, pixelDataLength);
      }
      
      console.log(`✅ DICOM parsed: ${width}x${height}, ${bitsAllocated} bits, ${pixelData.length} pixels`);
      
      return { width, height, pixelData };
      
    } catch (error) {
      console.error('❌ DICOM parsing error:', error);
      return this.extractRawDicomData(buffer);
    }
  }

  // Fallback: Extract raw data when DICOM parsing fails
  private extractRawDicomData(buffer: ArrayBuffer): {width: number, height: number, pixelData: Uint16Array | Uint8Array} | null {
    console.log('🔄 Attempting raw DICOM data extraction...');
    
    // Try common DICOM sizes
    const commonSizes = [
      {w: 512, h: 512}, {w: 256, h: 256}, {w: 1024, h: 1024}, 
      {w: 320, h: 320}, {w: 480, h: 480}, {w: 640, h: 640}
    ];
    
    for (const size of commonSizes) {
      const expectedPixels = size.w * size.h;
      const bytes16 = expectedPixels * 2; // 16-bit
      const bytes8 = expectedPixels;       // 8-bit
      
      // Try 16-bit data from end of file
      if (buffer.byteLength >= bytes16) {
        const offset16 = buffer.byteLength - bytes16;
        const pixelData16 = new Uint16Array(buffer, offset16, expectedPixels);
        
        // Check if data looks reasonable (not all zeros)
        let nonZeroCount = 0;
        for (let i = 0; i < Math.min(1000, pixelData16.length); i++) {
          if (pixelData16[i] > 0) nonZeroCount++;
        }
        
        if (nonZeroCount > 100) { // At least 10% non-zero in sample
          console.log(`✅ Extracted raw 16-bit data: ${size.w}x${size.h}`);
          return { width: size.w, height: size.h, pixelData: pixelData16 };
        }
      }
      
      // Try 8-bit data
      if (buffer.byteLength >= bytes8) {
        const offset8 = buffer.byteLength - bytes8;
        const pixelData8 = new Uint8Array(buffer, offset8, expectedPixels);
        
        let nonZeroCount = 0;
        for (let i = 0; i < Math.min(1000, pixelData8.length); i++) {
          if (pixelData8[i] > 0) nonZeroCount++;
        }
        
        if (nonZeroCount > 100) {
          console.log(`✅ Extracted raw 8-bit data: ${size.w}x${size.h}`);
          return { width: size.w, height: size.h, pixelData: pixelData8 };
        }
      }
    }
    
    console.warn('❌ Could not extract meaningful pixel data from DICOM file');
    return null;
  }

  // Copy DICOM slice data to volume
  private copyDicomSliceToVolume(dicomData: {width: number, height: number, pixelData: Uint16Array | Uint8Array}, sliceIndex: number, dims: Point3D, volume: Float32Array) {
    const { width, height, pixelData } = dicomData;
    
    for (let y = 0; y < Math.min(height, dims.y); y++) {
      for (let x = 0; x < Math.min(width, dims.x); x++) {
        const srcIndex = y * width + x;
        const dstIndex = sliceIndex * dims.x * dims.y + y * dims.x + x;
        
        if (srcIndex < pixelData.length && dstIndex < volume.length) {
          // Normalize pixel values to 0-255 range
          let intensity = pixelData[srcIndex];
          
          if (pixelData instanceof Uint16Array) {
            // 16-bit to 8-bit conversion with windowing
            intensity = Math.min(255, intensity / 256);
          }
          
          volume[dstIndex] = intensity;
        }
      }
    }
  }

  // Debug volume data
  debugVolumeData() {
    const volume = this.volumeData();
    const dims = this.volumeDimensions();
    
    if (!volume) {
      console.log('❌ No volume data available');
      alert('No volume data available');
      return;
    }

    console.log('📊 Volume Debug Info:');
    console.log(`Dimensions: ${dims.x} x ${dims.y} x ${dims.z}`);
    console.log(`Total voxels: ${volume.length}`);
    console.log(`Expected voxels: ${dims.x * dims.y * dims.z}`);
    
    // Sample some values
    const sampleIndices = [0, 1000, 10000, 50000, volume.length - 1];
    console.log('Sample values:');
    sampleIndices.forEach(i => {
      if (i < volume.length) {
        console.log(`  Index ${i}: ${volume[i]}`);
      }
    });

    // Check for non-zero values
    let nonZeroCount = 0;
    let minVal = Infinity;
    let maxVal = -Infinity;
    
    for (let i = 0; i < Math.min(volume.length, 100000); i++) {
      if (volume[i] !== 0) {
        nonZeroCount++;
        minVal = Math.min(minVal, volume[i]);
        maxVal = Math.max(maxVal, volume[i]);
      }
    }
    
    console.log(`Non-zero values in first 100k: ${nonZeroCount}`);
    console.log(`Value range: ${minVal} to ${maxVal}`);
    
    // Check ViewChild status
    console.log('Canvas availability:');
    console.log(`  Axial: ${!!this.axialCanvas?.nativeElement}`);
    console.log(`  Coronal: ${!!this.coronalCanvas?.nativeElement}`);
    console.log(`  Sagittal: ${!!this.sagittalCanvas?.nativeElement}`);
    
    alert(`Volume loaded: ${dims.x}×${dims.y}×${dims.z}\nNon-zero values: ${nonZeroCount}\nRange: ${minVal} to ${maxVal}`);
    
    // Force re-render
    console.log('🔄 Forcing slice re-render...');
    this.renderSlices();
  }

  private async processImageStack(files: File[]) {
    this.processing.set(true);
    this.totalSlices.set(files.length);
    this.processingProgress.set(0);

    try {
      console.log(`Starting to process ${files.length} image slices...`);
      
      const dims = { x: 256, y: 256, z: files.length };
      this.volumeDimensions.set(dims);
      
      const totalVoxels = dims.x * dims.y * dims.z;
      const volume = new Float32Array(totalVoxels);

      for (let i = 0; i < files.length; i++) {
        // Check if processing was cancelled
        if (this.processingCancelled) {
          console.log('Processing cancelled, stopping...');
          return;
        }

        console.log(`Processing slice ${i + 1}/${files.length}: ${files[i].name}`);
        
        this.currentProcessingSlice.set(i + 1);
        this.processingProgress.set(((i + 1) / files.length) * 100);

        try {
          const slice = await this.loadImageSlice(files[i]);
          
          // Check cancellation again after async operation
          if (this.processingCancelled) {
            console.log('Processing cancelled during slice loading');
            return;
          }
          
          this.copySliceToVolume(slice, i, dims, volume);
          console.log(`Slice ${i + 1} processed successfully`);
        } catch (sliceError) {
          console.error(`Error processing slice ${i + 1}:`, sliceError);
          // Continue with next slice instead of failing completely
        }

        // Use requestAnimationFrame for better UI responsiveness
        if (i % 3 === 0) { // Update UI every 3 slices for better responsiveness
          await new Promise(resolve => requestAnimationFrame(resolve));
        }
      }

      console.log('All slices processed, setting volume data...');
      this.volumeData.set(volume);
      this.dataSource = 'uploaded'; // Mark as real uploaded data
      this.maxSlices.set({ x: dims.x - 1, y: dims.y - 1, z: dims.z - 1 });
      this.calculateTotalVolume();
      
      console.log('Rendering slices...');
      setTimeout(() => {
        this.renderSlices();
        // Also render 3D volume automatically
        setTimeout(() => {
          this.render3DVolume();
        }, 300);
      }, 100);

      console.log('Image stack processing completed successfully!');

    } catch (error) {
      console.error('Error processing image stack:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      alert(`Error processing images: ${errorMessage}`);
    } finally {
      this.processing.set(false);
      this.processingProgress.set(100);
    }
  }

  private loadImageSlice(file: File): Promise<ImageData> {
    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        reject(new Error('Could not get canvas context'));
        return;
      }

      const img = new Image();
      
      // Set up timeout
      const timeout = setTimeout(() => {
        reject(new Error(`Timeout loading image: ${file.name}`));
      }, 10000); // 10 second timeout
      
      img.onload = () => {
        clearTimeout(timeout);
        try {
          canvas.width = 256;
          canvas.height = 256;
          ctx.drawImage(img, 0, 0, 256, 256);
          const imageData = ctx.getImageData(0, 0, 256, 256);
          URL.revokeObjectURL(img.src); // Clean up memory
          resolve(imageData);
        } catch (error) {
          reject(new Error(`Error processing image: ${file.name}`));
        }
      };

      img.onerror = () => {
        clearTimeout(timeout);
        URL.revokeObjectURL(img.src);
        reject(new Error(`Failed to load image: ${file.name}`));
      };
      
      try {
        img.src = URL.createObjectURL(file);
      } catch (error) {
        clearTimeout(timeout);
        reject(new Error(`Could not create URL for file: ${file.name}`));
      }
    });
  }

  private copySliceToVolume(imageData: ImageData, sliceIndex: number, dims: Point3D, volume: Float32Array) {
    const data = imageData.data;
    
    for (let y = 0; y < dims.y; y++) {
      for (let x = 0; x < dims.x; x++) {
        const pixelIndex = (y * dims.x + x) * 4;
        const volumeIndex = sliceIndex * dims.x * dims.y + y * dims.x + x;
        
        // Convert to grayscale
        const gray = (data[pixelIndex] + data[pixelIndex + 1] + data[pixelIndex + 2]) / 3;
        volume[volumeIndex] = gray;
      }
    }
  }

  // Update slice view with real-time 3D interaction
  updateSlice(axis: 'x' | 'y' | 'z', event: any) {
    const value = parseInt(event.target.value);
    const current = this.currentSlice();
    
    this.currentSlice.set({
      ...current,
      [axis]: value
    });
    
    // 🎬 Real-time updates: Update both 2D slices and 3D view
    this.renderSlices();
    
    // 🎮 Interactive 3D: Update 3D visualization to show current slice position
    this.updateInteractive3D(axis, value);
  }

  // 🎮 Update 3D visualization based on slice position
  private updateInteractive3D(axis: 'x' | 'y' | 'z', value: number) {
    // Only update 3D if interactive mode is enabled
    if (!this.interactive3D()) {
      return;
    }
    
    // Enable slice mode and update position for interactive slicing
    this.sliceMode.set(true);
    this.slicePosition.set(value);
    
    // Set slice thickness based on axis for better visualization
    if (axis === 'z') {
      this.sliceThickness.set(5); // Show 5 slices around current axial position
    } else if (axis === 'y') {
      this.sliceThickness.set(3); // Show 3 slices for coronal
    } else {
      this.sliceThickness.set(1); // Single slice for sagittal
    }
    
    // 🎬 Render 3D with current slice highlighted - throttled for performance
    if (!this.rendering()) {
      setTimeout(() => {
        this.render3DVolume();
      }, 100); // Throttled for smooth interaction
    }
    
    console.log(`🎮 Interactive 3D: ${axis.toUpperCase()} slice ${value} - 3D view updated`);
  }

  // Toggle interactive 3D mode
  toggleInteractive3D() {
    const newValue = !this.interactive3D();
    this.interactive3D.set(newValue);
    
    if (!newValue) {
      // Disable slice mode when turning off interactive 3D
      this.sliceMode.set(false);
      this.render3DVolume();
    }
    
    console.log(`🎮 Interactive 3D mode: ${newValue ? 'ENABLED' : 'DISABLED'}`);
  }

  // Render 2D slices
  renderSlices() {
    if (!this.volumeData()) {
      console.log('No volume data available for rendering');
      return;
    }

    console.log('Rendering slices...');
    
    // Give time for ViewChild to initialize, then render
    setTimeout(() => {
      console.log('Starting slice rendering...');
      this.renderAxialSlice();
      this.renderCoronalSlice();
      this.renderSagittalSlice();
      console.log('Slice rendering completed');
    }, 200);
  }

  private renderAxialSlice() {
    if (!this.axialCanvas?.nativeElement || !this.volumeData()) {
      console.log('Axial canvas or volume data not available');
      return;
    }

    console.log('Rendering axial slice...');
    const canvas = this.axialCanvas.nativeElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      console.error('Could not get axial canvas context');
      return;
    }

    const volume = this.volumeData()!;
    const dims = this.volumeDimensions();
    const z = Math.min(this.currentSlice().z, dims.z - 1);

    console.log(`Axial slice - Z: ${z}, Dims: ${dims.x}x${dims.y}x${dims.z}`);

    const imageData = ctx.createImageData(canvas.width, canvas.height);
    
    for (let y = 0; y < Math.min(canvas.height, dims.y); y++) {
      for (let x = 0; x < Math.min(canvas.width, dims.x); x++) {
        const volumeIndex = z * dims.x * dims.y + y * dims.x + x;
        const pixelIndex = (y * canvas.width + x) * 4;
        
        const intensity = Math.min(255, Math.max(0, volume[volumeIndex] || 0));
        imageData.data[pixelIndex] = intensity;     // R
        imageData.data[pixelIndex + 1] = intensity; // G
        imageData.data[pixelIndex + 2] = intensity; // B
        imageData.data[pixelIndex + 3] = 255;       // A
      }
    }
    
    ctx.putImageData(imageData, 0, 0);
    console.log('Axial slice rendered successfully');
  }

  private renderCoronalSlice() {
    if (!this.coronalCanvas?.nativeElement || !this.volumeData()) {
      console.log('Coronal canvas or volume data not available');
      return;
    }

    console.log('Rendering coronal slice...');
    const canvas = this.coronalCanvas.nativeElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      console.error('Could not get coronal canvas context');
      return;
    }

    const volume = this.volumeData()!;
    const dims = this.volumeDimensions();
    const y = Math.min(this.currentSlice().y, dims.y - 1);

    console.log(`Coronal slice - Y: ${y}, Dims: ${dims.x}x${dims.y}x${dims.z}`);

    const imageData = ctx.createImageData(canvas.width, canvas.height);
    
    // Map volume coordinates to canvas coordinates
    for (let canvasZ = 0; canvasZ < canvas.height; canvasZ++) {
      for (let canvasX = 0; canvasX < canvas.width; canvasX++) {
        // Scale from canvas coordinates to volume coordinates
        const volumeZ = Math.floor((canvasZ / canvas.height) * dims.z);
        const volumeX = Math.floor((canvasX / canvas.width) * dims.x);
        
        if (volumeZ < dims.z && volumeX < dims.x && y < dims.y) {
          const volumeIndex = volumeZ * dims.x * dims.y + y * dims.x + volumeX;
          const pixelIndex = (canvasZ * canvas.width + canvasX) * 4;
          
          const intensity = Math.min(255, Math.max(0, volume[volumeIndex] || 0));
          imageData.data[pixelIndex] = intensity;
          imageData.data[pixelIndex + 1] = intensity;
          imageData.data[pixelIndex + 2] = intensity;
          imageData.data[pixelIndex + 3] = 255;
        }
      }
    }
    
    ctx.putImageData(imageData, 0, 0);
    console.log('Coronal slice rendered successfully');
  }

  private renderSagittalSlice() {
    if (!this.sagittalCanvas?.nativeElement || !this.volumeData()) {
      console.log('Sagittal canvas or volume data not available');
      return;
    }

    console.log('Rendering sagittal slice...');
    const canvas = this.sagittalCanvas.nativeElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      console.error('Could not get sagittal canvas context');
      return;
    }

    const volume = this.volumeData()!;
    const dims = this.volumeDimensions();
    const x = Math.min(this.currentSlice().x, dims.x - 1);

    console.log(`Sagittal slice - X: ${x}, Dims: ${dims.x}x${dims.y}x${dims.z}`);

    const imageData = ctx.createImageData(canvas.width, canvas.height);
    
    // Map volume coordinates to canvas coordinates
    for (let canvasZ = 0; canvasZ < canvas.height; canvasZ++) {
      for (let canvasY = 0; canvasY < canvas.width; canvasY++) {
        // Scale from canvas coordinates to volume coordinates
        const volumeZ = Math.floor((canvasZ / canvas.height) * dims.z);
        const volumeY = Math.floor((canvasY / canvas.width) * dims.y);
        
        if (volumeZ < dims.z && volumeY < dims.y && x < dims.x) {
          const volumeIndex = volumeZ * dims.x * dims.y + volumeY * dims.x + x;
          const pixelIndex = (canvasZ * canvas.width + canvasY) * 4;
          
          const intensity = Math.min(255, Math.max(0, volume[volumeIndex] || 0));
          imageData.data[pixelIndex] = intensity;
          imageData.data[pixelIndex + 1] = intensity;
          imageData.data[pixelIndex + 2] = intensity;
          imageData.data[pixelIndex + 3] = 255;
        }
      }
    }
    
    ctx.putImageData(imageData, 0, 0);
    console.log('Sagittal slice rendered successfully');
  }

  // 🎯 AI-Powered Tumor Detection with Background Removal
  async detect3DTumors() {
    if (!this.volumeData()) return;

    this.processing.set(true);
    this.processingProgress.set(0);

    try {
      console.log('🔬 Starting AI-powered tumor detection...');
      const volume = this.volumeData()!;
      const dims = this.volumeDimensions();
      const threshold = this.threshold();
      
      // 🧹 Clear existing masks
      this.tumorMasks = [];
      
      // � ADAPTIVE THRESHOLDING: Detect data type (DICOM vs Image)
      const dataStats = this.analyzeVolumeData(volume);
      const adaptiveThreshold = this.calculateAdaptiveThreshold(dataStats);
      
      console.log(`🎯 Data analysis: Range ${dataStats.min}-${dataStats.max}, Type: ${dataStats.isDicom ? 'DICOM' : 'Image'}`);
      console.log(`🎯 Adaptive threshold: ${adaptiveThreshold} (base: ${threshold})`);
      
      // �🎯 BLOB-BASED TUMOR DETECTION: Only detect connected regions
      console.log(`🎯 Processing ${dims.z} slices with blob detection...`);
      
      let totalTumorVoxels = 0;
      
      for (let sliceIndex = 0; sliceIndex < dims.z; sliceIndex++) {
        this.processingProgress.set((sliceIndex / dims.z) * 100);
        this.currentProcessingSlice.set(sliceIndex);
        
        // 🔍 STEP 1: Find bright regions (potential tumors)
        const brightPixels = this.findBrightPixels(volume, dims, sliceIndex, adaptiveThreshold, dataStats);
        
        // 🧩 STEP 2: Group into connected components (blobs)
        const tumorBlobs = this.findConnectedComponents(brightPixels, dims);
        
        // 🎯 STEP 3: Filter blobs - only keep tumor-sized ones
        const validTumors = this.filterTumorBlobs(tumorBlobs, dims);
        
        // 🎨 STEP 4: Create mask from valid tumor blobs only
        const tumorMask = new Float32Array(dims.x * dims.y);
        for (const blob of validTumors) {
          for (const pixel of blob.pixels) {
            const maskIndex = pixel.y * dims.x + pixel.x;
            tumorMask[maskIndex] = 1.0;
            totalTumorVoxels++;
          }
        }
        
        this.tumorMasks[sliceIndex] = tumorMask;
        
        console.log(`Slice ${sliceIndex}: Found ${validTumors.length} tumor blobs`);
        
        // Allow UI updates
        if (sliceIndex % 3 === 0) {
          await new Promise(resolve => setTimeout(resolve, 5));
        }
      }

      // Generate summary tumor regions
      const detectedRegions = this.generateTumorSummary(totalTumorVoxels, dims);
      this.detectionResults.set(detectedRegions);
      this.calculateTumorMetrics(detectedRegions);
      
      // 🎨 Re-render everything with tumor highlighting
      this.renderSlices();
      this.render3DVolume();
      
      console.log(`✅ Tumor detection completed!`);
      console.log(`📊 Results: ${totalTumorVoxels} tumor voxels across ${dims.z} slices`);
      console.log(`🏥 Data type: ${dataStats.isDicom ? 'DICOM' : 'Regular image'}`);
      console.log(`🎯 Threshold used: ${adaptiveThreshold} (range: ${dataStats.min}-${dataStats.max})`);

    } catch (error) {
      console.error('❌ Error in tumor detection:', error);
    } finally {
      this.processing.set(false);
      this.processingProgress.set(0);
    }
  }

  // 🎯 Calculate tumor probability - VERY selective detection
  private calculateTumorProbability(volume: Float32Array, dims: Point3D, x: number, y: number, z: number, intensity: number): number {
    // Multi-criteria tumor detection to avoid marking normal tissue
    
    // 1. Check if it's in a spherical/compact region (tumors are usually round)
    const compactness = this.checkRegionCompactness(volume, dims, x, y, z, intensity);
    
    // 2. Check intensity contrast with surroundings
    const contrast = this.checkIntensityContrast(volume, dims, x, y, z, intensity);
    
    // 3. Check if it's part of a distinct bright region (not just noise)
    const regionSize = this.checkBrightRegionSize(volume, dims, x, y, z, intensity);
    
    // 4. Exclude edge artifacts and noise
    const isEdge = x < 5 || x >= dims.x - 5 || y < 5 || y >= dims.y - 5;
    if (isEdge) return 0;
    
    // Combine all criteria - all must be high for tumor detection
    const tumorScore = (compactness * 0.4) + (contrast * 0.4) + (regionSize * 0.2);
    
    return tumorScore;
  }

  // Check if the region is compact/round (tumor-like)
  private checkRegionCompactness(volume: Float32Array, dims: Point3D, x: number, y: number, z: number, centerIntensity: number): number {
    const radius = 8;
    let brightPixelsInCircle = 0;
    let totalPixelsChecked = 0;
    
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance <= radius) {
          const nx = x + dx;
          const ny = y + dy;
          
          if (nx >= 0 && nx < dims.x && ny >= 0 && ny < dims.y) {
            const index = z * dims.x * dims.y + ny * dims.x + nx;
            const intensity = volume[index];
            
            totalPixelsChecked++;
            // Check if intensity is similar to center (indicating a coherent region)
            if (Math.abs(intensity - centerIntensity) < 30) {
              brightPixelsInCircle++;
            }
          }
        }
      }
    }
    
    return totalPixelsChecked > 0 ? brightPixelsInCircle / totalPixelsChecked : 0;
  }

  // Check intensity contrast with background
  private checkIntensityContrast(volume: Float32Array, dims: Point3D, x: number, y: number, z: number, centerIntensity: number): number {
    // Check surrounding ring for contrast
    let backgroundSum = 0;
    let backgroundCount = 0;
    
    for (let dy = -15; dy <= 15; dy++) {
      for (let dx = -15; dx <= 15; dx++) {
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance > 10 && distance < 15) { // Ring around the center
          const nx = x + dx;
          const ny = y + dy;
          
          if (nx >= 0 && nx < dims.x && ny >= 0 && ny < dims.y) {
            const index = z * dims.x * dims.y + ny * dims.x + nx;
            backgroundSum += volume[index];
            backgroundCount++;
          }
        }
      }
    }
    
    if (backgroundCount === 0) return 0;
    
    const avgBackground = backgroundSum / backgroundCount;
    const contrast = (centerIntensity - avgBackground) / Math.max(avgBackground, 1);
    
    // Only high contrast regions (at least 50% brighter than surroundings)
    return Math.min(1.0, Math.max(0, (contrast - 0.5) * 2));
  }

  // Check if it's part of a reasonably sized bright region
  private checkBrightRegionSize(volume: Float32Array, dims: Point3D, x: number, y: number, z: number, intensity: number): number {
    let similarPixels = 0;
    const threshold = intensity - 20; // Similar intensity range
    
    for (let dy = -6; dy <= 6; dy++) {
      for (let dx = -6; dx <= 6; dx++) {
        const nx = x + dx;
        const ny = y + dy;
        
        if (nx >= 0 && nx < dims.x && ny >= 0 && ny < dims.y) {
          const index = z * dims.x * dims.y + ny * dims.x + nx;
          if (volume[index] > threshold) {
            similarPixels++;
          }
        }
      }
    }
    
    // Tumor should have 20-100 similar pixels (not too small, not too big)
    if (similarPixels < 20) return 0; // Too small - likely noise
    if (similarPixels > 100) return 0.3; // Too big - likely normal tissue
    
    return 1.0; // Good tumor size
  }

  // 🏥 Analyze volume data to determine if it's DICOM or regular image
  private analyzeVolumeData(volume: Float32Array): {min: number, max: number, mean: number, isDicom: boolean} {
    let min = Infinity, max = -Infinity, sum = 0;
    let nonZeroCount = 0;
    
    // Sample every 100th pixel for speed
    for (let i = 0; i < volume.length; i += 100) {
      const value = volume[i];
      if (value > 0) {
        min = Math.min(min, value);
        max = Math.max(max, value);
        sum += value;
        nonZeroCount++;
      }
    }
    
    const mean = nonZeroCount > 0 ? sum / nonZeroCount : 0;
    
    // DICOM typically has higher intensity ranges (> 300) and different characteristics
    const isDicom = max > 300 && (max - min) > 200;
    
    return { min, max, mean, isDicom };
  }

  // 🎯 Calculate CONSERVATIVE adaptive threshold - avoid false positives
  private calculateAdaptiveThreshold(dataStats: {min: number, max: number, mean: number, isDicom: boolean}): number {
    if (dataStats.isDicom) {
      // DICOM: Much higher threshold - only very bright regions
      const range = dataStats.max - dataStats.min;
      return dataStats.mean + (range * 0.6); // 60% above mean (much higher)
    } else {
      // PNG/JPG: Conservative threshold
      return dataStats.mean + 70; // Higher threshold for images
    }
  }

  // 🔍 STEP 1: Find bright pixels that could be tumors (DICOM-aware)
  private findBrightPixels(volume: Float32Array, dims: Point3D, sliceIndex: number, adaptiveThreshold: number, dataStats: {min: number, max: number, mean: number, isDicom: boolean}): Point3D[] {
    const brightPixels: Point3D[] = [];
    
    for (let y = 0; y < dims.y; y++) {
      for (let x = 0; x < dims.x; x++) {
        const volumeIndex = sliceIndex * dims.x * dims.y + y * dims.x + x;
        const intensity = volume[volumeIndex];
        
        // 🎯 ULTRA-SELECTIVE tumor detection - minimize false positives
        let isTumorCandidate = false;
        
        if (dataStats.isDicom) {
          // DICOM: Very strict detection - only top 5% of intensities
          const relativeIntensity = (intensity - dataStats.min) / (dataStats.max - dataStats.min);
          isTumorCandidate = intensity > adaptiveThreshold * 1.5 && relativeIntensity > 0.95; // Top 5% only
        } else {
          // PNG/JPG: Much higher threshold - only extremely bright pixels
          isTumorCandidate = intensity > Math.max(adaptiveThreshold + 80, 200); // Very bright pixels only
        }
        
        if (isTumorCandidate) {
          brightPixels.push({ x, y, z: sliceIndex });
        }
      }
    }
    
    console.log(`Slice ${sliceIndex}: Found ${brightPixels.length} bright pixels`);
    return brightPixels;
  }

  // 🧩 STEP 2: Group bright pixels into connected blobs
  private findConnectedComponents(brightPixels: Point3D[], dims: Point3D): Array<{pixels: Point3D[], size: number}> {
    const visited = new Set<string>();
    const blobs: Array<{pixels: Point3D[], size: number}> = [];
    
    for (const pixel of brightPixels) {
      const key = `${pixel.x},${pixel.y}`;
      if (visited.has(key)) continue;
      
      // Start a new blob with flood fill
      const blob = this.floodFillBlob(pixel, brightPixels, dims, visited);
      if (blob.pixels.length > 0) {
        blobs.push(blob);
      }
    }
    
    return blobs;
  }

  // Flood fill to find connected blob
  private floodFillBlob(startPixel: Point3D, brightPixels: Point3D[], dims: Point3D, visited: Set<string>): {pixels: Point3D[], size: number} {
    const blob: Point3D[] = [];
    const stack = [startPixel];
    const brightPixelSet = new Set(brightPixels.map(p => `${p.x},${p.y}`));
    
    while (stack.length > 0) {
      const pixel = stack.pop()!;
      const key = `${pixel.x},${pixel.y}`;
      
      if (visited.has(key)) continue;
      visited.add(key);
      blob.push(pixel);
      
      // Check 8-connected neighbors
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          
          const nx = pixel.x + dx;
          const ny = pixel.y + dy;
          const nkey = `${nx},${ny}`;
          
          if (nx >= 0 && nx < dims.x && ny >= 0 && ny < dims.y && 
              !visited.has(nkey) && brightPixelSet.has(nkey)) {
            stack.push({ x: nx, y: ny, z: pixel.z });
          }
        }
      }
    }
    
    return { pixels: blob, size: blob.length };
  }

  // 🎯 STEP 3: ULTRA-STRICT blob filtering - eliminate false positives
  private filterTumorBlobs(blobs: Array<{pixels: Point3D[], size: number}>, dims: Point3D): Array<{pixels: Point3D[], size: number}> {
    return blobs.filter(blob => {
      // 📏 STRICT SIZE CRITERIA: Only very specific tumor sizes
      const minSize = 25;  // Minimum 25 pixels (bigger minimum)
      const maxSize = 100; // Maximum 100 pixels (smaller maximum)
      
      if (blob.size < minSize || blob.size > maxSize) {
        return false;
      }
      
      // 🔵 ROUNDNESS CHECK: Must be very round (tumor-like)
      const compactness = this.calculateBlobCompactness(blob.pixels);
      if (compactness < 0.7) { // Much stricter roundness
        return false;
      }
      
      // 📍 POSITION CHECK: Avoid edge artifacts
      const centerX = blob.pixels.reduce((sum, p) => sum + p.x, 0) / blob.pixels.length;
      const centerY = blob.pixels.reduce((sum, p) => sum + p.y, 0) / blob.pixels.length;
      
      // Must be away from edges (tumors rarely at exact edges)
      const edgeBuffer = Math.min(dims.x, dims.y) * 0.1; // 10% from edges
      if (centerX < edgeBuffer || centerX > dims.x - edgeBuffer || 
          centerY < edgeBuffer || centerY > dims.y - edgeBuffer) {
        return false;
      }
      
      // 🎯 DENSITY CHECK: Must be a dense, solid blob
      const density = this.calculateBlobDensity(blob.pixels);
      return density > 0.8; // Very dense blobs only
    });
  }

  // Calculate blob density (how "solid" it is)
  private calculateBlobDensity(pixels: Point3D[]): number {
    if (pixels.length === 0) return 0;
    
    // Find bounding box
    let minX = pixels[0].x, maxX = pixels[0].x;
    let minY = pixels[0].y, maxY = pixels[0].y;
    
    for (const pixel of pixels) {
      minX = Math.min(minX, pixel.x);
      maxX = Math.max(maxX, pixel.x);
      minY = Math.min(minY, pixel.y);
      maxY = Math.max(maxY, pixel.y);
    }
    
    const boundingBoxArea = (maxX - minX + 1) * (maxY - minY + 1);
    return boundingBoxArea > 0 ? pixels.length / boundingBoxArea : 0;
  }

  // Calculate how round/compact a blob is (tumors are usually round)
  private calculateBlobCompactness(pixels: Point3D[]): number {
    if (pixels.length === 0) return 0;
    
    // Find centroid
    let centerX = 0, centerY = 0;
    for (const pixel of pixels) {
      centerX += pixel.x;
      centerY += pixel.y;
    }
    centerX /= pixels.length;
    centerY /= pixels.length;
    
    // Calculate average distance from center
    let totalDistance = 0;
    let maxDistance = 0;
    for (const pixel of pixels) {
      const distance = Math.sqrt((pixel.x - centerX) ** 2 + (pixel.y - centerY) ** 2);
      totalDistance += distance;
      maxDistance = Math.max(maxDistance, distance);
    }
    
    const avgDistance = totalDistance / pixels.length;
    
    // Compactness: more compact blobs have smaller variance in distance from center
    return maxDistance > 0 ? avgDistance / maxDistance : 0;
  }

  // Generate tumor region summary
  private generateTumorSummary(totalTumorVoxels: number, dims: Point3D): TumorRegion3D[] {
    if (totalTumorVoxels === 0) return [];
    
    return [{
      center: { x: dims.x / 2, y: dims.y / 2, z: dims.z / 2 },
      volume: totalTumorVoxels * this.voxelSize().x * this.voxelSize().y * this.voxelSize().z,
      confidence: Math.min(0.95, totalTumorVoxels / 1000),
      boundingBox: {
        min: { x: 0, y: 0, z: 0 },
        max: { x: dims.x, y: dims.y, z: dims.z }
      }
    }];
  }

  private floodFill3D(volume: Float32Array, dims: Point3D, startX: number, startY: number, startZ: number, threshold: number, visited: Set<number>): TumorRegion3D {
    const stack = [{ x: startX, y: startY, z: startZ }];
    const regionVoxels: Point3D[] = [];
    let minX = startX, maxX = startX;
    let minY = startY, maxY = startY;
    let minZ = startZ, maxZ = startZ;

    while (stack.length > 0) {
      const { x, y, z } = stack.pop()!;
      const index = z * dims.x * dims.y + y * dims.x + x;

      if (visited.has(index) || 
          x < 0 || x >= dims.x || 
          y < 0 || y >= dims.y || 
          z < 0 || z >= dims.z ||
          volume[index] < threshold) {
        continue;
      }

      visited.add(index);
      regionVoxels.push({ x, y, z });

      // Update bounding box
      minX = Math.min(minX, x); maxX = Math.max(maxX, x);
      minY = Math.min(minY, y); maxY = Math.max(maxY, y);
      minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z);

      // Add neighbors
      const neighbors = [
        { x: x+1, y, z }, { x: x-1, y, z },
        { x, y: y+1, z }, { x, y: y-1, z },
        { x, y, z: z+1 }, { x, y, z: z-1 }
      ];

      for (const neighbor of neighbors) {
        stack.push(neighbor);
      }
    }

    // Calculate center and metrics
    const centerX = regionVoxels.reduce((sum, v) => sum + v.x, 0) / regionVoxels.length;
    const centerY = regionVoxels.reduce((sum, v) => sum + v.y, 0) / regionVoxels.length;
    const centerZ = regionVoxels.reduce((sum, v) => sum + v.z, 0) / regionVoxels.length;

    const voxelSize = this.voxelSize();
    const volumeMm3 = regionVoxels.length * voxelSize.x * voxelSize.y * voxelSize.z;

    // Calculate confidence based on intensity uniformity and size
    const avgIntensity = regionVoxels.reduce((sum, v) => {
      const idx = v.z * dims.x * dims.y + v.y * dims.x + v.x;
      return sum + volume[idx];
    }, 0) / regionVoxels.length;

    const confidence = Math.min(avgIntensity / 255, 1) * Math.min(volumeMm3 / 1000, 1);

    return {
      center: { x: centerX, y: centerY, z: centerZ },
      volume: volumeMm3,
      confidence,
      boundingBox: {
        min: { x: minX, y: minY, z: minZ },
        max: { x: maxX, y: maxY, z: maxZ }
      }
    };
  }

  // Segment and visualize 3D tumors
  segment3DTumors() {
    console.log('Starting 3D tumor segmentation...');
    // This would create 3D meshes for the detected tumors
    // For now, we'll highlight them in the slice views
    this.renderSlices();
  }

  // Calculate 3D metrics
  calculate3DMetrics() {
    const results = this.detectionResults();
    if (!results) return;

    console.log('Calculating 3D metrics...');
    
    // Calculate additional metrics like surface area, compactness, etc.
    results.forEach((tumor, index) => {
      const volume = tumor.volume;
      const sphereRadius = Math.cbrt(3 * volume / (4 * Math.PI));
      const sphereSurfaceArea = 4 * Math.PI * sphereRadius * sphereRadius;
      
      console.log(`Tumor ${index + 1}:`, {
        volume: volume.toFixed(2) + ' mm³',
        equivalentSphereRadius: sphereRadius.toFixed(2) + ' mm',
        estimatedSurfaceArea: sphereSurfaceArea.toFixed(2) + ' mm²',
        compactness: (volume / sphereRadius).toFixed(2)
      });
    });
  }

  private calculateTumorMetrics(regions: TumorRegion3D[]) {
    const totalTumorVol = regions.reduce((sum, region) => sum + region.volume, 0);
    this.tumorVolume.set(totalTumorVol);
    
    const total = this.totalVolume();
    this.tumorPercentage.set(total > 0 ? (totalTumorVol / total) * 100 : 0);
  }

  private calculateTotalVolume() {
    const dims = this.volumeDimensions();
    const voxel = this.voxelSize();
    const total = dims.x * dims.y * dims.z * voxel.x * voxel.y * voxel.z;
    this.totalVolume.set(total);
  }

  // 3D Volume Rendering with Interactive DICOM Slice Visualization
  render3DVolume() {
    if (!this.volumeData() || !this.volume3DCanvas?.nativeElement) {
      console.log('❌ No volume data or canvas not available for 3D rendering');
      const canvas = this.volume3DCanvas?.nativeElement;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = '#333333';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.fillStyle = '#ffffff';
          ctx.font = '16px Arial';
          ctx.textAlign = 'center';
          ctx.fillText('Please upload DICOM files first', canvas.width/2, canvas.height/2);
          ctx.textAlign = 'left';
        }
      }
      return;
    }

    console.log('🎨 Rendering interactive DICOM 3D slice stack...');
    this.rendering.set(true);

    const canvas = this.volume3DCanvas.nativeElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      console.error('Could not get 3D canvas context');
      return;
    }

    const volume = this.volumeData()!;
    const dims = this.volumeDimensions();
    
    // Debug volume data
    console.log('Volume dimensions:', dims);
    console.log('Volume data length:', volume.length);
    console.log('Expected volume size:', dims.x * dims.y * dims.z);
    
    // Check if we have actual data - sample more thoroughly for DICOM
    let nonZeroCount = 0;
    let minVal = Infinity;
    let maxVal = -Infinity;
    let sampleCount = 0;
    
    // Sample every 100th voxel across the entire volume for better detection
    for (let i = 0; i < volume.length; i += 100) {
      const value = volume[i];
      if (value !== 0) nonZeroCount++;
      minVal = Math.min(minVal, value);
      maxVal = Math.max(maxVal, value);
      sampleCount++;
    }
    
    console.log(`Volume stats - Sampled ${sampleCount} voxels, Non-zero: ${nonZeroCount}, Min: ${minVal}, Max: ${maxVal}`);

    // Check if we have valid data - for DICOM, even if mostly zeros, we should have some variation
    if (volume.length === 0 || (minVal === maxVal && minVal === 0)) {
      console.warn('⚠️ No valid volume data found! Check DICOM loading.');
      ctx.fillStyle = '#333333';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#ffffff';
      ctx.font = '16px Arial';
      ctx.fillText('No DICOM data loaded', canvas.width/2 - 80, canvas.height/2);
      return;
    }
    
    console.log('✅ Valid volume data detected, proceeding with 3D rendering...');

    // Clear canvas with dark background
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    console.log(`🎮 Slice mode: ${this.sliceMode()}, rendering method: ${this.sliceMode() ? 'Single slice' : '3D stack'}`);

    if (this.sliceMode()) {
      // Render single slice or slice range
      console.log('📋 Rendering slice mode...');
      this.renderSliceMode(ctx, volume, dims, canvas.width, canvas.height);
    } else {
      // Render stacked 3D DICOM slices
      console.log('📚 Rendering 3D DICOM slice stack...');
      this.render3DDicomSliceStack(ctx, volume, dims, canvas.width, canvas.height);
    }

    this.rendering.set(false);
    console.log('✅ 3D DICOM slice stack rendering completed');
  }

  private renderSliceMode(
    ctx: CanvasRenderingContext2D, 
    volume: Float32Array, 
    dims: Point3D, 
    canvasWidth: number, 
    canvasHeight: number
  ) {
    // Render single slice or range of slices with 3D perspective
    const slicePos = this.slicePosition();
    const thickness = this.sliceThickness();
    const rotation = this.rotation3D();
    const zoom = this.zoom3D();

    const centerX = canvasWidth / 2;
    const centerY = canvasHeight / 2;
    
    // Draw slice range
    for (let t = 0; t < thickness; t++) {
      const currentZ = Math.min(dims.z - 1, slicePos + t);
      const alpha = 0.8 - (t / thickness) * 0.6; // Fade slices behind
      
      this.drawDicomSliceAt3D(ctx, volume, dims, currentZ, centerX, centerY, rotation, zoom, alpha);
    }

    // Add slice position indicator
    ctx.strokeStyle = '#00ff00';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.strokeRect(50, 50, canvasWidth - 100, canvasHeight - 100);
    ctx.setLineDash([]);

    // Add slice info
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 16px Arial';
    ctx.fillText(`DICOM Slice ${slicePos}/${dims.z - 1}`, 10, 25);
  }

  private render3DDicomSliceStack(
    ctx: CanvasRenderingContext2D, 
    volume: Float32Array, 
    dims: Point3D, 
    canvasWidth: number, 
    canvasHeight: number
  ) {
    console.log('🚀 Starting render3DDicomSliceStack method');
    
    // Render multiple DICOM slices stacked in 3D space
    const rotation = this.rotation3D();
    const zoom = this.zoom3D();
    const centerX = canvasWidth / 2;
    const centerY = canvasHeight / 2;
    
    console.log(`📐 Canvas: ${canvasWidth}x${canvasHeight}, Center: (${centerX}, ${centerY})`);
    console.log(`🎛️ Controls - Rotation: (${rotation.x}, ${rotation.y}), Zoom: ${zoom}`);

    // Calculate slice spacing for 3D effect - show more slices for better visibility
    const maxSlicesToShow = Math.min(30, dims.z);
    const sliceStep = Math.max(1, Math.floor(dims.z / maxSlicesToShow));
    
    console.log(`Rendering ${maxSlicesToShow} DICOM slices with step ${sliceStep} from ${dims.z} total slices`);
    
    // Render slices from back to front for proper depth
    const slicesToRender = [];
    for (let z = 0; z < dims.z; z += sliceStep) {
      slicesToRender.push(z);
    }

    // Sort by depth (considering rotation)
    slicesToRender.sort((a, b) => {
      const depthA = this.calculateSliceDepth(a, dims, rotation);
      const depthB = this.calculateSliceDepth(b, dims, rotation);
      return depthB - depthA; // Back to front
    });

    // Render each DICOM slice with higher opacity for better visibility
    console.log(`🎨 About to render ${slicesToRender.length} slices:`, slicesToRender.slice(0, 5));
    
    if (slicesToRender.length === 0) {
      console.warn('⚠️ No slices to render! Adding middle slice as fallback.');
      slicesToRender.push(Math.floor(dims.z / 2));
    }
    
    slicesToRender.forEach((z, index) => {
      const alpha = 0.9 + (index / slicesToRender.length) * 0.1; // Even higher opacity
      console.log(`🔸 Rendering slice ${z} (${index + 1}/${slicesToRender.length}) with alpha ${alpha.toFixed(2)}`);
      this.drawDicomSliceAt3D(ctx, volume, dims, z, centerX, centerY, rotation, zoom, alpha);
    });

    // Add 3D axes indicator
    this.draw3DAxes(ctx, centerX, centerY, rotation, zoom);
    
    // Add info text with data source
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 14px Arial';
    ctx.fillText(`${slicesToRender.length} Slices Rendered (${dims.z} total)`, 10, canvasHeight - 45);
    
    // Add data type indicator
    ctx.font = '12px Arial';
    ctx.fillStyle = '#cccccc';
    const dataType = this.dataSource === 'uploaded' ? 'Real DICOM Data' : 'Sample Data';
    ctx.fillText(`Data Source: ${dataType}`, 10, canvasHeight - 25);
    
    console.log(`✅ Completed rendering ${slicesToRender.length} slices from ${dataType}`);
  }

  private drawDicomSliceAt3D(
    ctx: CanvasRenderingContext2D,
    volume: Float32Array,
    dims: Point3D,
    sliceZ: number,
    centerX: number,
    centerY: number,
    rotation: { x: number, y: number },
    zoom: number,
    alpha: number
  ) {
    console.log(`🔸 Drawing DICOM slice ${sliceZ} with alpha ${alpha.toFixed(2)}`);
    
    // Create DICOM slice image with better sizing
    const sliceSize = Math.max(dims.x, dims.y);
    const baseSize = Math.min(centerX, centerY) * 0.8; // Use more of the available space
    const scale = zoom * (baseSize / sliceSize);
    
    console.log(`📏 Slice ${sliceZ}: size=${sliceSize}, baseSize=${baseSize}, scale=${scale.toFixed(3)}`);

    // Calculate 3D position offset based on rotation
    const rotX = rotation.x * Math.PI / 180;
    const rotY = rotation.y * Math.PI / 180;
    
    // Enhanced Z offset for better 3D depth perception
    const normalizedZ = (sliceZ - dims.z / 2) / dims.z;
    const zOffset = normalizedZ * baseSize * 0.6; // More pronounced depth effect
    const xOffset = zOffset * Math.sin(rotY);
    const yOffset = zOffset * Math.sin(rotX) * 0.5; // Less Y offset for better view

    // Extract slice data with proper DICOM contrast
    const imageData = ctx.createImageData(sliceSize, sliceSize);
    const data = imageData.data;

    // Find min/max for proper medical image contrast
    let minVal = Infinity;
    let maxVal = -Infinity;
    
    for (let y = 0; y < Math.min(sliceSize, dims.y); y++) {
      for (let x = 0; x < Math.min(sliceSize, dims.x); x++) {
        const voxelIndex = sliceZ * dims.x * dims.y + y * dims.x + x;
        const intensity = volume[voxelIndex] || 0;
        minVal = Math.min(minVal, intensity);
        maxVal = Math.max(maxVal, intensity);
      }
    }

    // Render DICOM slice with medical windowing
    for (let y = 0; y < sliceSize; y++) {
      for (let x = 0; x < sliceSize; x++) {
        if (x < dims.x && y < dims.y) {
          const voxelIndex = sliceZ * dims.x * dims.y + y * dims.x + x;
          const intensity = volume[voxelIndex] || 0;
          
          // Normalize to 0-255 with medical image contrast enhancement
          let normalizedIntensity = 0;
          if (maxVal > minVal) {
            normalizedIntensity = Math.round(((intensity - minVal) / (maxVal - minVal)) * 255);
          }
          
          // Apply medical windowing for better visualization
          const windowedIntensity = Math.max(0, Math.min(255, normalizedIntensity * 1.8));
          
          // 🚀 BACKGROUND REMOVAL: Skip very low-intensity pixels (true background only)
          const backgroundThreshold = 30; // Lower threshold to keep more tissue visible
          if (windowedIntensity < backgroundThreshold) {
            const pixelIndex = (y * sliceSize + x) * 4;
            data[pixelIndex] = 0;     // R - transparent
            data[pixelIndex + 1] = 0; // G - transparent  
            data[pixelIndex + 2] = 0; // B - transparent
            data[pixelIndex + 3] = 0; // A - fully transparent
            continue;
          }
          
          // 🎯 TUMOR DETECTION: Check if this pixel is a tumor
          let isTumor = false;
          if (this.tumorMasks && this.tumorMasks[sliceZ]) {
            const maskIndex = y * dims.x + x;
            isTumor = this.tumorMasks[sliceZ][maskIndex] > 0.5;
          } else {
            // 🚫 VERY CONSERVATIVE fallback detection - almost no false positives
            if (this.dataSource === 'uploaded') {
              // Uploaded data - extremely high threshold
              isTumor = windowedIntensity > 240; // Only maximum intensity pixels
            } else {
              // Sample data - only detect our perfect test tumors
              isTumor = windowedIntensity >= 250; // Only our test tumor intensities
            }
          }
          
          const pixelIndex = (y * sliceSize + x) * 4;
          
          if (isTumor) {
            // 🔴 TUMOR PIXELS: Bright red
            data[pixelIndex] = 255;   // R - bright red
            data[pixelIndex + 1] = 0; // G - no green
            data[pixelIndex + 2] = 0; // B - no blue
          } else {
            // 🫁 TISSUE PIXELS: Grayscale
            data[pixelIndex] = windowedIntensity;     // R
            data[pixelIndex + 1] = windowedIntensity; // G
            data[pixelIndex + 2] = windowedIntensity; // B
          }
          data[pixelIndex + 3] = alpha * 255;       // A
        }
      }
    }

    console.log(`🔍 Slice ${sliceZ} stats: minVal=${minVal}, maxVal=${maxVal}, sliceSize=${sliceSize}x${sliceSize}`);
    
    // Create temporary canvas for this DICOM slice
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = sliceSize;
    tempCanvas.height = sliceSize;
    const tempCtx = tempCanvas.getContext('2d');
    if (!tempCtx) {
      console.error('❌ Failed to get temp canvas context for slice', sliceZ);
      return;
    }

    tempCtx.putImageData(imageData, 0, 0);
    console.log(`✅ Created temp canvas ${sliceSize}x${sliceSize} for slice ${sliceZ}`);

    // Apply 3D transformation and draw DICOM slice
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(centerX + xOffset, centerY + yOffset);
    
    // Apply rotation transforms for 3D effect
    if (rotation.y !== 0) {
      ctx.transform(Math.cos(rotY), 0, -Math.sin(rotY) * 0.4, 1, 0, 0);
    }
    if (rotation.x !== 0) {
      ctx.transform(1, -Math.sin(rotX) * 0.4, 0, Math.cos(rotX), 0, 0);
    }
    
    ctx.scale(scale, scale);
    
    console.log(`🎨 Drawing slice ${sliceZ} at position (${(centerX + xOffset).toFixed(1)}, ${(centerY + yOffset).toFixed(1)}) with scale ${scale.toFixed(3)} and alpha ${alpha.toFixed(2)}`);
    
    ctx.drawImage(tempCanvas, -sliceSize/2, -sliceSize/2);
    ctx.restore();
    
    console.log(`✅ Finished drawing slice ${sliceZ}`);
  }

  private calculateSliceDepth(sliceZ: number, dims: Point3D, rotation: { x: number, y: number }): number {
    // Calculate apparent depth considering rotation
    const normalizedZ = (sliceZ - dims.z / 2) / dims.z;
    const rotX = rotation.x * Math.PI / 180;
    const rotY = rotation.y * Math.PI / 180;
    
    // Simple depth calculation
    return normalizedZ * Math.cos(rotY) * Math.cos(rotX);
  }

  private draw3DAxes(
    ctx: CanvasRenderingContext2D,
    centerX: number,
    centerY: number,
    rotation: { x: number, y: number },
    zoom: number
  ) {
    const axisLength = 40 * zoom;
    ctx.lineWidth = 2;
    ctx.font = 'bold 12px Arial';

    // X axis (red)
    ctx.strokeStyle = '#ff4444';
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.lineTo(centerX + axisLength, centerY);
    ctx.stroke();
    ctx.fillStyle = '#ff4444';
    ctx.fillText('X', centerX + axisLength + 5, centerY - 5);

    // Y axis (green)
    ctx.strokeStyle = '#44ff44';
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.lineTo(centerX, centerY - axisLength);
    ctx.stroke();
    ctx.fillStyle = '#44ff44';
    ctx.fillText('Y', centerX - 10, centerY - axisLength - 5);

    // Z axis (blue) - affected by rotation
    const rotY = rotation.y * Math.PI / 180;
    const zEndX = centerX + axisLength * Math.sin(rotY);
    const zEndY = centerY + axisLength * 0.2; // Slight offset for visibility
    
    ctx.strokeStyle = '#4444ff';
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.lineTo(zEndX, zEndY);
    ctx.stroke();
    ctx.fillStyle = '#4444ff';
    ctx.fillText('Z', zEndX + 5, zEndY + 5);
  }

  private renderVolumeProjection(
    ctx: CanvasRenderingContext2D, 
    volume: Float32Array, 
    dims: Point3D, 
    canvasWidth: number, 
    canvasHeight: number,
    rotationAngle: number
  ) {
    const imageData = ctx.createImageData(canvasWidth, canvasHeight);
    const data = imageData.data;

    const centerX = canvasWidth / 2;
    const centerY = canvasHeight / 2;
    const scale = Math.min(canvasWidth, canvasHeight) / Math.max(dims.x, dims.y, dims.z) * 0.8;

    console.log(`Rendering with rotation: ${rotationAngle * 180 / Math.PI}°`);

    for (let screenY = 0; screenY < canvasHeight; screenY++) {
      for (let screenX = 0; screenX < canvasWidth; screenX++) {
        // Convert screen coordinates to 3D space
        const worldX = (screenX - centerX) / scale;
        const worldY = (screenY - centerY) / scale;

        // Apply rotation around Y axis
        const rotatedX = worldX * Math.cos(rotationAngle) + dims.z/2 * Math.sin(rotationAngle);
        const rotatedZ = -worldX * Math.sin(rotationAngle) + dims.z/2 * Math.cos(rotationAngle);

        // Cast ray through volume
        let intensity = 0;
        let samples = 0;

        // Ray casting from front to back
        for (let step = 0; step < dims.z; step++) {
          const z = rotatedZ + step - dims.z/2;
          const x = rotatedX + dims.x/2;
          const y = worldY + dims.y/2;

          // Check bounds
          if (x >= 0 && x < dims.x && y >= 0 && y < dims.y && z >= 0 && z < dims.z) {
            const voxelIndex = Math.floor(z) * dims.x * dims.y + Math.floor(y) * dims.x + Math.floor(x);
            const voxelValue = volume[voxelIndex] || 0;

            if (this.projectionType() === 'mip') {
              // Maximum Intensity Projection
              intensity = Math.max(intensity, voxelValue);
            } else {
              // Average Intensity Projection
              intensity += voxelValue;
              samples++;
            }
          }
        }

        if (this.projectionType() === 'average' && samples > 0) {
          intensity /= samples;
        }

        // Apply threshold and opacity
        if (intensity > this.threshold()) {
          intensity = Math.min(255, intensity * this.opacity());
          
          const pixelIndex = (screenY * canvasWidth + screenX) * 4;
          data[pixelIndex] = intensity;     // R
          data[pixelIndex + 1] = intensity; // G  
          data[pixelIndex + 2] = intensity; // B
          data[pixelIndex + 3] = 255;       // A
        }
      }
    }

    ctx.putImageData(imageData, 0, 0);

    // Add tumor highlighting if detected
    this.highlightTumorsIn3D(ctx, canvasWidth, canvasHeight, scale, rotationAngle);
  }

  private highlightTumorsIn3D(
    ctx: CanvasRenderingContext2D,
    canvasWidth: number,
    canvasHeight: number,
    scale: number,
    rotationAngle: number
  ) {
    const results = this.detectionResults();
    if (!results) return;

    ctx.strokeStyle = this.tumorColor();
    ctx.lineWidth = 3;

    const centerX = canvasWidth / 2;
    const centerY = canvasHeight / 2;

    results.forEach((tumor, index) => {
      // Transform tumor center to screen coordinates
      const worldX = tumor.center.x - this.volumeDimensions().x/2;
      const worldY = tumor.center.y - this.volumeDimensions().y/2;
      
      // Apply rotation
      const rotatedX = worldX * Math.cos(rotationAngle);
      const screenX = centerX + rotatedX * scale;
      const screenY = centerY + worldY * scale;

      // Draw tumor marker
      ctx.beginPath();
      const radius = Math.sqrt(tumor.volume / Math.PI) * scale * 0.1;
      ctx.arc(screenX, screenY, Math.max(5, radius), 0, 2 * Math.PI);
      ctx.stroke();

      // Add label
      ctx.fillStyle = this.tumorColor();
      ctx.font = 'bold 14px Arial';
      ctx.fillText(
        `T${index + 1} (${(tumor.confidence * 100).toFixed(1)}%)`,
        screenX + radius + 5,
        screenY - 5
      );
    });
  }

  // 3D Visualization Controls
  rotate3DView() {
    this.autoRotate.set(!this.autoRotate());
    
    if (this.autoRotate()) {
      this.startAutoRotation();
    } else {
      this.stopAutoRotation();
    }
    
    console.log('Auto rotate:', this.autoRotate());
  }

  private rotationInterval: any = null;

  private startAutoRotation() {
    this.stopAutoRotation(); // Clear any existing interval
    
    this.rotationInterval = setInterval(() => {
      const newAngle = (this.rotationAngle() + 2) % 360;
      this.rotationAngle.set(newAngle);
      this.render3DVolume();
    }, 50); // Rotate every 50ms for smooth animation
  }

  private stopAutoRotation() {
    if (this.rotationInterval) {
      clearInterval(this.rotationInterval);
      this.rotationInterval = null;
    }
  }

  toggleProjection() {
    const current = this.projectionType();
    this.projectionType.set(current === 'mip' ? 'average' : 'mip');
    console.log('Projection type:', this.projectionType());
    
    // Re-render with new projection
    if (this.volumeData()) {
      this.render3DVolume();
    }
  }

  resetView() {
    console.log('Resetting 3D view');
    
    // Reset rotation
    this.stopAutoRotation();
    this.autoRotate.set(false);
    this.rotationAngle.set(0);
    
    // Reset slice positions
    const dims = this.volumeDimensions();
    this.currentSlice.set({
      x: Math.floor(dims.x / 2),
      y: Math.floor(dims.y / 2),
      z: Math.floor(dims.z / 2)
    });
    
    // Re-render everything
    this.renderSlices();
    if (this.volumeData()) {
      this.render3DVolume();
    }
  }

  // === MANUAL ROTATION CONTROLS ===

  // Mouse interaction handlers
  onMouseDown(event: MouseEvent) {
    this.mouseDown = true;
    this.lastMouseX = event.clientX;
    this.lastMouseY = event.clientY;
    event.preventDefault();
  }

  onMouseMove(event: MouseEvent) {
    if (!this.mouseDown) return;
    
    const deltaX = event.clientX - this.lastMouseX;
    const deltaY = event.clientY - this.lastMouseY;
    
    // Sensitivity factor for mouse rotation
    const sensitivity = 0.5;
    
    const currentRotation = this.rotation3D();
    this.rotation3D.set({
      x: currentRotation.x + (deltaY * sensitivity),
      y: currentRotation.y + (deltaX * sensitivity)
    });
    
    this.lastMouseX = event.clientX;
    this.lastMouseY = event.clientY;
    
    // Re-render with new rotation
    if (this.volumeData()) {
      this.render3DVolume();
    }
    
    event.preventDefault();
  }

  onMouseUp(event: MouseEvent) {
    this.mouseDown = false;
    event.preventDefault();
  }

  onMouseWheel(event: WheelEvent) {
    const zoomDelta = event.deltaY > 0 ? -0.1 : 0.1;
    const newZoom = Math.max(0.5, Math.min(3.0, this.zoom3D() + zoomDelta));
    this.zoom3D.set(newZoom);
    
    if (this.volumeData()) {
      this.render3DVolume();
    }
    
    event.preventDefault();
  }

  // Manual rotation slider controls
  updateRotation(axis: 'x' | 'y', event: any) {
    const value = parseFloat(event.target.value);
    const currentRotation = this.rotation3D();
    
    if (axis === 'x') {
      this.rotation3D.set({ x: value, y: currentRotation.y });
    } else {
      this.rotation3D.set({ x: currentRotation.x, y: value });
    }
    
    if (this.volumeData()) {
      this.render3DVolume();
    }
  }

  updateZoom(event: any) {
    const zoomPercent = parseFloat(event.target.value);
    this.zoom3D.set(zoomPercent / 100);
    
    if (this.volumeData()) {
      this.render3DVolume();
    }
  }

  // Rotation buttons
  rotateBy(deltaX: number, deltaY: number) {
    const currentRotation = this.rotation3D();
    this.rotation3D.set({
      x: currentRotation.x + deltaY,
      y: currentRotation.y + deltaX
    });
    
    if (this.volumeData()) {
      this.render3DVolume();
    }
  }

  // Reset functions
  resetRotation(axis: 'x' | 'y') {
    const currentRotation = this.rotation3D();
    
    if (axis === 'x') {
      this.rotation3D.set({ x: 0, y: currentRotation.y });
    } else {
      this.rotation3D.set({ x: currentRotation.x, y: 0 });
    }
    
    if (this.volumeData()) {
      this.render3DVolume();
    }
  }

  resetZoom() {
    this.zoom3D.set(1.0);
    
    if (this.volumeData()) {
      this.render3DVolume();
    }
  }

  resetAllRotations() {
    this.rotation3D.set({ x: 0, y: 0 });
    this.zoom3D.set(1.0);
    
    if (this.volumeData()) {
      this.render3DVolume();
    }
  }

  // Update visualization settings
  updateOpacity(event: any) {
    this.opacity.set(parseFloat(event.target.value));
  }

  updateThreshold(event: any) {
    this.threshold.set(parseInt(event.target.value));
  }

  updateTumorColor(event: any) {
    this.tumorColor.set(event.target.value);
  }

  updateBackgroundColor(event: any) {
    this.backgroundColor.set(event.target.value);
  }

  // Helper methods
  getConfidenceClass(confidence: number): string {
    if (confidence > 0.7) return 'confidence-high';
    if (confidence > 0.4) return 'confidence-medium';
    return 'confidence-low';
  }

  ngOnDestroy() {
    // Clean up rotation animation
    this.stopAutoRotation();
    
    // Clean up Three.js resources if initialized
    if (this.renderer) {
      this.renderer.dispose();
    }
  }
}