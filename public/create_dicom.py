import os
import numpy as np
import pydicom
from pydicom.dataset import Dataset, FileDataset
from pydicom.uid import generate_uid, CTImageStorage, ExplicitVRLittleEndian
import datetime

# --- Config ---
output_dir = "mock_brain_tumor_series"
num_slices = 6
rows = cols = 256
pixel_spacing = [0.5, 0.5]  # mm
slice_thickness = 2.0       # mm

os.makedirs(output_dir, exist_ok=True)

# Shared UIDs for the study/series
study_uid = generate_uid()
series_uid = generate_uid()

# Study/series date/time
now = datetime.datetime.now()
study_date = now.strftime("%Y%m%d")
study_time = now.strftime("%H%M%S")

for i in range(num_slices):
    # --- File Meta ---
    file_meta = Dataset()
    file_meta.MediaStorageSOPClassUID = CTImageStorage
    file_meta.MediaStorageSOPInstanceUID = generate_uid()
    file_meta.TransferSyntaxUID = ExplicitVRLittleEndian

    ds = FileDataset(
        "", {}, file_meta=file_meta, preamble=b"\0" * 128
    )

    # --- Patient / Study Info ---
    ds.PatientName = "Mock^BrainTumor"
    ds.PatientID = "MOCK123"
    ds.Modality = "CT"
    ds.StudyInstanceUID = study_uid
    ds.SeriesInstanceUID = series_uid
    ds.SOPInstanceUID = file_meta.MediaStorageSOPInstanceUID
    ds.SOPClassUID = CTImageStorage
    ds.StudyDate = study_date
    ds.StudyTime = study_time
    ds.SeriesNumber = 1
    ds.InstanceNumber = i + 1

    # --- Geometry ---
    ds.ImagePositionPatient = [0.0, 0.0, i * slice_thickness]  # z changes per slice
    ds.ImageOrientationPatient = [1, 0, 0, 0, 1, 0]            # axial
    ds.PixelSpacing = pixel_spacing
    ds.SliceThickness = slice_thickness

    # --- Create pixel data ---
    x = np.linspace(-1, 1, cols)
    y = np.linspace(-1, 1, rows)
    xx, yy = np.meshgrid(x, y)

    # "Brain" background – smooth blob
    brain = np.exp(-3 * (xx**2 + yy**2)) * 40 + 20  # 20–60 HU-ish

    # Fake "tumor" – bright blob, a bit off-center
    tumor_radius = 0.25
    tumor = np.exp(-((xx - 0.2) ** 2 + (yy + 0.1) ** 2) / (2 * tumor_radius**2))

    # Make tumor strongest near the middle slices, weaker on edges
    center = (num_slices - 1) / 2
    z_rel = abs(i - center) / center  # 0 at center, 1 at edges
    tumor_strength = max(0.0, 1.0 - z_rel * 1.2)  # fades faster toward edges

    tumor *= tumor_strength * 120  # higher intensity than background

    img = brain + tumor

    # Clip & convert to 8-bit
    img = np.clip(img, 0, 255).astype(np.uint8)

    # --- DICOM pixel info ---
    ds.Rows, ds.Columns = img.shape
    ds.SamplesPerPixel = 1
    ds.PhotometricInterpretation = "MONOCHROME2"
    ds.BitsAllocated = 8
    ds.BitsStored = 8
    ds.HighBit = 7
    ds.PixelRepresentation = 0  # unsigned
    ds.PixelData = img.tobytes()

    # --- Save slice ---
    filename = os.path.join(output_dir, f"slice_{i+1:03d}.dcm")
    ds.save_as(filename)
    print("Saved:", filename)

print("Done. Open the folder in your DICOM viewer.")
