# 3D Modeling Technical Documentation

This document provides comprehensive technical documentation for all 3D modeling functionality in the wedding planning platform, including code snippets, line numbers, and detailed explanations.

---

## Table of Contents

1. [Upload 3D File (Vendor Listing Management)](#51-upload-3d-file-vendor-listing-management)
2. [Save 3D File (Vendor Listing Management)](#52-save-3d-file-vendor-listing-management)
3. [Loading 3D Scene (Venue Designer)](#53-loading-3d-scene-venue-designer)
4. [Adjusting 3D Model Dimensions](#54-adjusting-3d-model-dimensions)
5. [Floorplan to 3D Conversion](#55-floorplan-to-3d-conversion)
6. [Save Scene (Venue Designer)](#56-save-scene-venue-designer)

---

## 5.1 Upload 3D File (Vendor Listing Management)

### 5.1.1 Frontend: File Validation and Upload Handler

**File:** `src/pages/ManageListings/ManageListings.jsx`  
**Lines:** 1185-1212

```javascript
const handle3DModelChange = (e) => {
  const file = e.target.files[0];
  if (file) {
    // Validate 3D model file type - only .glb allowed
    const fileName = file.name.toLowerCase();
    if (!fileName.endsWith('.glb')) {
      setToastNotification({ open: true, message: 'Please select a .glb file (GLTF Binary format)', severity: 'error' });
      if (e.target) {
        e.target.value = '';
      }
      return;
    }

    // Check file size (max 150MB for 3D models)
    const maxSize = 150 * 1024 * 1024;
    if (file.size > maxSize) {
      setToastNotification({ open: true, message: '3D model file size must be less than 150MB', severity: 'error' });
      if (e.target) {
        e.target.value = '';
      }
      return;
    }

    setModel3DFile(file);
    setModel3DPreview(file.name);
    setError('');
  }
};
```

**Explanation:**

This function handles the frontend validation and state management when a vendor selects a 3D model file for upload. The implementation performs two critical validations before accepting the file. First, it checks that the file extension is `.glb` (GLTF Binary format), which is the standard format for 3D models in web applications due to its efficient binary encoding and wide browser support. If the file type is invalid, it displays an error notification and clears the file input to prevent invalid submissions.

Second, the function validates file size against a maximum limit of 150MB. This limit prevents excessive memory usage and ensures reasonable upload times. Large 3D models can significantly impact performance, so this constraint helps maintain system responsiveness. Upon successful validation, the file is stored in component state (`model3DFile`) along with its preview name, and any previous error messages are cleared. The file input is also cleared after validation to allow users to re-select files if needed.

---

### 5.1.2 Frontend: Multiple File Upload Handler

**File:** `src/pages/ManageListings/ManageListings.jsx`  
**Lines:** 1214-1257

```javascript
// Handle multiple 3D model files for bundle services
const handle3DModelsChange = (e) => {
  const files = Array.from(e.target.files);
  if (files.length === 0) return;

  const maxSize = 150 * 1024 * 1024; // 150MB per file
  const validFiles = [];
  const invalidFiles = [];

  files.forEach((file) => {
    const fileName = file.name.toLowerCase();
    if (!fileName.endsWith('.glb')) {
      invalidFiles.push(`${file.name}: Not a .glb file`);
      return;
    }
    if (file.size > maxSize) {
      invalidFiles.push(`${file.name}: File size exceeds 150MB`);
      return;
    }
    validFiles.push(file);
  });

  if (invalidFiles.length > 0) {
    setToastNotification({ open: true, message: `Some files were rejected:\n${invalidFiles.join('\n')}`, severity: 'error' });
  }

  if (validFiles.length > 0) {
    setModel3DFiles(validFiles);
    setModel3DPreviews(validFiles.map((file) => ({
      name: file.name,
      size: file.size,
      id: `preview-${Date.now()}-${Math.random()}`,
    })));
    setModel3DFileMeta(validFiles.map(() => createDefaultPhysicalProps()));
    if (invalidFiles.length === 0) {
      setError('');
    }
  }

  // Clear file input
  if (e.target) {
    e.target.value = '';
  }
};
```

**Explanation:**

This function extends the single file upload handler to support multiple file uploads for bundle services, where vendors may need to upload several 3D models simultaneously. The implementation processes an array of files, applying the same validation rules (`.glb` format and 150MB size limit) to each file individually. Files are categorized into `validFiles` and `invalidFiles` arrays, allowing partial success scenarios where some files pass validation while others fail.

The function provides detailed feedback by listing all rejected files with specific reasons, enabling vendors to understand exactly which files need correction. For valid files, it creates preview objects containing metadata (name, size, unique ID) and initializes default physical properties for each file. This approach maintains a clean separation between valid and invalid files, ensuring only properly validated files proceed to upload while giving users actionable feedback about validation failures.

---

### 5.1.3 Backend: Multer Configuration for 3D Model Upload

**File:** `server/routes/serviceListing.routes.js`  
**Lines:** 893-914

```javascript
const createModel3DUpload = (listingId) => {
  const model3DStorage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, model3DUploadDir),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname) || '.glb';
      cb(null, `${listingId}${ext}`);
    },
  });

  return multer({
    storage: model3DStorage,
    limits: { fileSize: 150 * 1024 * 1024 }, // 150MB max
    fileFilter: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      if (ext === '.glb') {
        cb(null, true);
      } else {
        cb(new Error('Only .glb files are allowed (GLTF Binary format)'), false);
      }
    },
  });
};
```

**Explanation:**

This function creates a configured Multer middleware instance specifically for 3D model uploads. Multer is a Node.js middleware for handling `multipart/form-data`, which is essential for file uploads. The configuration uses `diskStorage` to save files to the filesystem rather than memory, which is appropriate for large 3D model files that could exceed memory limits.

The storage configuration generates filenames based on the listing ID, ensuring each listing has a unique, predictable filename. This approach simplifies file management and prevents naming conflicts. The file extension is preserved from the original filename, defaulting to `.glb` if no extension is present. The middleware enforces a 150MB file size limit and validates file extensions server-side, providing a security layer that complements frontend validation. Server-side validation is critical because frontend validation can be bypassed, and this ensures only valid `.glb` files are stored on the server.

---

### 5.1.4 Backend: Single 3D Model Upload Endpoint

**File:** `server/routes/serviceListing.routes.js`  
**Lines:** 916-1023

```javascript
// POST /service-listings/:id/model3d - Upload 3D model for a service listing (single model for non-bundle services)
router.post('/:id/model3d', requireAuth, async (req, res, next) => {
  try {
    if (req.user.role !== 'vendor') {
      return res.status(403).json({ error: 'Vendor access required' });
    }

    // Check if listing exists and belongs to vendor
    const existingListing = await prisma.serviceListing.findFirst({
      where: {
        id: req.params.id,
        vendorId: req.user.sub,
      },
    });

    if (!existingListing) {
      return res.status(404).json({ error: 'Service listing not found' });
    }

    const model3DUpload = createModel3DUpload(req.params.id);

    model3DUpload.single('model3D')(req, res, async (err) => {
      if (err) {
        return res.status(400).json({ error: err.message });
      }

      if (!req.file) {
        return res.status(400).json({ error: 'No 3D model file provided' });
      }

      try {
        // Extract additional fields
        const isStackable = req.body.isStackable === 'true';
        let dimensions = null;
        if (req.body.dimensions) {
          try {
            dimensions = JSON.parse(req.body.dimensions);
          } catch (e) {
            console.warn('Invalid dimensions JSON:', e);
          }
        }

        // Create or update DesignElement
        const modelPath = `/uploads/models3d/${req.file.filename}`;
        
        // Check if designElementId exists
        let designElement;
        if (existingListing.designElementId) {
          // Delete old file if exists
          const oldElement = await prisma.designElement.findUnique({
            where: { id: existingListing.designElementId },
          });
          if (oldElement && oldElement.modelFile) {
            const oldPath = path.join(__dirname, '..', oldElement.modelFile);
            if (fs.existsSync(oldPath)) {
              fs.unlinkSync(oldPath);
            }
          }
          // Update existing design element
          designElement = await prisma.designElement.update({
            where: { id: existingListing.designElementId },
            data: { 
              modelFile: modelPath,
              isStackable: isStackable,
              dimensions: dimensions || undefined,
            },
          });
        } else {
          // Create new design element
          designElement = await prisma.designElement.create({
            data: {
              vendorId: req.user.sub,
              name: existingListing.name,
              elementType: existingListing.category,
              modelFile: modelPath,
              isStackable: isStackable,
              dimensions: dimensions || undefined,
            },
          });
        }

        // Update service listing with designElementId and compute has3DModel
        const has3D = await computeHas3DModel(req.params.id);
        await prisma.serviceListing.update({
          where: { id: req.params.id },
          data: {
            designElementId: designElement.id,
            has3DModel: has3D,
          },
        });

        res.json({
          message: '3D model uploaded successfully',
          has3DModel: true,
          designElement: designElement,
        });
      } catch (dbErr) {
        // Delete uploaded file if database operation fails
        if (req.file && fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
        }
        next(dbErr);
      }
    });
  } catch (err) {
    next(err);
  }
});
```

**Explanation:**

This endpoint handles the complete workflow for uploading a single 3D model file for a service listing. The implementation begins with authorization checks, ensuring only vendors can upload models and that they own the listing being modified. This security layer prevents unauthorized access and data modification.

The endpoint uses the Multer middleware configured earlier to process the file upload. After successful file upload, it extracts additional metadata from the request body, including `isStackable` (a boolean indicating whether the item can be stacked) and `dimensions` (physical dimensions in JSON format). The dimensions are parsed from JSON with error handling to gracefully handle malformed data.

The core logic handles two scenarios: updating an existing design element or creating a new one. When updating, the system first deletes the old 3D model file from the filesystem to prevent storage bloat, then updates the database record. When creating new, it generates a new `DesignElement` record linking the vendor, listing name, category, and uploaded file path.

The endpoint includes robust error handling: if database operations fail after file upload, it automatically deletes the uploaded file to prevent orphaned files. Finally, it updates the service listing to reference the design element and recalculates the `has3DModel` flag, which is used throughout the application to determine if a listing has 3D visualization capabilities.

---

## 5.2 Save 3D File (Vendor Listing Management)

### 5.2.1 Frontend: Form Data Preparation and Upload

**File:** `src/pages/ManageListings/ManageListings.jsx`  
**Lines:** 953-967

```javascript
} else if (model3DFile) {
  // Upload new 3D model
  const formData3D = new FormData();
  formData3D.append('model3D', model3DFile);
  formData3D.append('isStackable', String(isStackable));
  const listingDimensions = buildDimensionsPayloadFromState(modelDimensions);
  if (listingDimensions) {
    formData3D.append('dimensions', JSON.stringify(listingDimensions));
  }

  await apiFetch(`/service-listings/${newListing.id}/model3d`, {
    method: 'POST',
    body: formData3D,
  });
}
```

**Explanation:**

This code snippet demonstrates the frontend preparation and submission of 3D model files to the backend API. The implementation uses the `FormData` API, which is essential for multipart/form-data uploads that include both files and metadata. The `FormData` object is constructed by appending the 3D model file, stackable flag, and optional dimensions data.

The `isStackable` boolean is converted to a string because FormData only accepts strings, numbers, or File objects. The dimensions are built from component state using a helper function (`buildDimensionsPayloadFromState`) that validates and formats dimension values, then serialized as JSON before appending. This approach allows the backend to receive structured dimension data alongside the binary file.

The upload is performed using a custom `apiFetch` utility that handles authentication headers and error management. The endpoint URL includes the newly created listing ID, establishing the relationship between the listing and its 3D model. This pattern ensures that 3D models are always associated with valid listings and prevents orphaned files.

---

### 5.2.2 Backend: Multiple 3D Models Upload for Bundle Services

**File:** `server/routes/serviceListing.routes.js`  
**Lines:** 1025-1132

```javascript
// POST /service-listings/:id/model3d/bundle - Upload multiple 3D models for bundle services
// Each file creates a DesignElement that can be used in components
router.post('/:id/model3d/bundle', requireAuth, async (req, res, next) => {
  try {
    if (req.user.role !== 'vendor') {
      return res.status(403).json({ error: 'Vendor access required' });
    }

    // Check if listing exists and belongs to vendor
    const existingListing = await prisma.serviceListing.findFirst({
      where: {
        id: req.params.id,
        vendorId: req.user.sub,
      },
    });

    if (!existingListing) {
      return res.status(404).json({ error: 'Service listing not found' });
    }

    // Create multer instance for multiple files
    const model3DStorage = multer.diskStorage({
      destination: (_req, _file, cb) => cb(null, model3DUploadDir),
      filename: (req, file, cb) => {
        const listingId = req.params.id;
        const timestamp = Date.now();
        const random = Math.floor(Math.random() * 10000);
        const ext = path.extname(file.originalname) || '.glb';
        cb(null, `${listingId}_${timestamp}_${random}${ext}`);
      },
    });

    const model3DUploadMultiple = multer({
      storage: model3DStorage,
      limits: { fileSize: 150 * 1024 * 1024 }, // 150MB max per file
      fileFilter: (_req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        if (ext === '.glb') {
          cb(null, true);
        } else {
          cb(new Error('Only .glb files are allowed (GLTF Binary format)'), false);
        }
      },
    });

    model3DUploadMultiple.array('model3DFiles', 10)(req, res, async (err) => {
      if (err) {
        return res.status(400).json({ error: err.message });
      }

      if (!req.files || req.files.length === 0) {
        return res.status(400).json({ error: 'No 3D model files provided' });
      }

      try {
        const createdElements = [];

        // Create a DesignElement for each uploaded file
        for (const file of req.files) {
          const modelPath = `/uploads/models3d/${file.filename}`;
          const elementName = req.body[`elementName_${file.originalname}`] || file.originalname.replace('.glb', '');
          const elementType = req.body[`elementType_${file.originalname}`] || existingListing.category;
          const isStackable = req.body[`isStackable_${file.originalname}`] === 'true';
          
          let dimensions = null;
          const dimsRaw = req.body[`dimensions_${file.originalname}`];
          if (dimsRaw) {
            try {
              dimensions = JSON.parse(dimsRaw);
            } catch (e) {
              console.warn('Invalid dimensions JSON:', e);
            }
          }

          const designElement = await prisma.designElement.create({
            data: {
              vendorId: req.user.sub,
              name: elementName,
              elementType: elementType,
              modelFile: modelPath,
              isStackable: isStackable,
              dimensions: dimensions || undefined,
            },
          });

          createdElements.push(designElement);
        }

        res.json({
          message: `${createdElements.length} 3D model(s) uploaded successfully`,
          designElements: createdElements,
        });
      } catch (dbErr) {
        // Delete uploaded files if database operation fails
        if (req.files) {
          req.files.forEach((file) => {
            if (fs.existsSync(file.path)) {
              fs.unlinkSync(file.path);
            }
          });
        }
        next(dbErr);
      }
    });
  } catch (err) {
    next(err);
  }
});
```

**Explanation:**

This endpoint extends the single file upload functionality to support bundle services, where vendors upload multiple 3D models that become individual components of a service bundle. The implementation uses Multer's `array()` method instead of `single()`, allowing up to 10 files per request. This limit prevents abuse while accommodating typical bundle sizes.

The filename generation strategy differs from single uploads: it includes a timestamp and random number to ensure uniqueness when multiple files are uploaded simultaneously. This prevents filename collisions that could occur if multiple vendors upload files with the same name. The pattern `${listingId}_${timestamp}_${random}${ext}` creates unique identifiers while maintaining traceability to the source listing.

The endpoint processes each uploaded file sequentially, extracting metadata from the request body using a naming convention that includes the original filename (`elementName_${file.originalname}`). This allows vendors to provide custom names and properties for each component. Each file creates a separate `DesignElement` record, enabling flexible component management where individual elements can be reused across different bundles.

Error handling includes cleanup logic that deletes all uploaded files if any database operation fails, preventing orphaned files and maintaining data consistency. The response includes all created design elements, allowing the frontend to immediately display the uploaded models and their associated metadata.

---

## 5.3 Loading 3D Scene (Venue Designer)

### 5.3.1 Loading GLTF Model with useGLTF Hook

**File:** `src/pages/VenueDesigner/Scene3D.jsx`  
**Lines:** 69-125

```javascript
const VenueModel = ({ modelUrl, onBoundsCalculated }) => {
  const { scene } = useGLTF(modelUrl);

  const venueScene = useMemo(() => {
    if (!scene) return null;
    const copy = scene.clone(true);
    copy.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        if (child.material) {
          child.material = child.material.clone();
        }
      }
    });

    const bbox = new THREE.Box3().setFromObject(copy);
    const center = bbox.getCenter(new THREE.Vector3());
    copy.position.sub(center);

    const size = bbox.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    let normalization = 1;
    if (maxDim > 80) {
      normalization = 80 / maxDim;
    } else if (maxDim < 10) {
      normalization = 10 / maxDim;
    }
    copy.scale.setScalar(normalization);

    // After scaling, realign so the venue floor sits on y=0
    const alignedBox = new THREE.Box3().setFromObject(copy);
    const minY = alignedBox.min.y;
    copy.position.y -= minY;

    // Calculate final bounds after all transformations
    const finalBox = new THREE.Box3().setFromObject(copy);
    
    // Notify parent of calculated bounds
    if (onBoundsCalculated) {
      onBoundsCalculated({
        minX: finalBox.min.x,
        maxX: finalBox.max.x,
        minY: finalBox.min.y,
        maxY: finalBox.max.y,
        minZ: finalBox.min.z,
        maxZ: finalBox.max.z,
      });
    }

    return copy;
  }, [scene, onBoundsCalculated]);

  if (!venueScene) return null;

  return <primitive object={venueScene} />;
};
```

**Explanation:**

This component handles the loading and preprocessing of venue 3D models in the venue designer scene. The `useGLTF` hook from `@react-three/drei` provides automatic GLTF/GLB loading with caching, significantly improving performance when the same model is loaded multiple times. The hook returns the loaded Three.js scene object, which contains all meshes, materials, and transformations from the GLTF file.

The preprocessing logic performs several critical transformations to ensure consistent rendering. First, it clones the scene to avoid mutating the cached original, which could affect other components using the same model. During traversal, it enables shadow casting and receiving for all meshes, creating realistic lighting interactions. Materials are cloned to allow per-instance modifications without affecting the cached model.

The normalization process ensures venues render at appropriate scales regardless of their original dimensions. Models larger than 80 units are scaled down, while models smaller than 10 units are scaled up, maintaining visual consistency across different venue sizes. The centering operation moves the model's geometric center to the origin (0,0,0), simplifying camera positioning and element placement calculations.

The ground alignment step ensures the venue floor sits at y=0, which is critical for placing elements correctly on the venue surface. This transformation calculates the bounding box after scaling and adjusts the vertical position accordingly. Finally, the component calculates and reports the final bounding box to the parent component, enabling collision detection and boundary enforcement for placed elements.

---

### 5.3.2 URL Normalization for Model Loading

**File:** `src/pages/VenueDesigner/Scene3D.jsx`  
**Lines:** 58-67

```javascript
const normalizeUrl = (url) => {
  if (!url) return null;
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  if (url.startsWith('/uploads')) {
    return `http://localhost:4000${url}`;
  }
  return url;
};
```

**Explanation:**

This utility function standardizes 3D model URLs to ensure consistent loading across different storage scenarios. The function handles three URL formats: absolute URLs (already complete), relative paths starting with `/uploads` (server-hosted files), and other relative paths. For server-hosted files, it prepends the backend server URL (`http://localhost:4000`), enabling the frontend to load files from the backend's static file server.

This normalization is essential because the application stores file paths in the database as relative paths (e.g., `/uploads/models3d/file.glb`), but the frontend needs absolute URLs to fetch these files. The function provides a centralized location for URL transformation logic, making it easy to update the backend URL if the deployment configuration changes. The implementation prioritizes absolute URLs, ensuring that external URLs (CDN, cloud storage) work without modification.

---

## 5.4 Adjusting 3D Model Dimensions

### 5.4.1 Dimension Handle Component for Interactive Resizing

**File:** `src/components/ModelDimensionEditor/Viewer3D.jsx`  
**Lines:** 22-225

```javascript
const DimensionHandle = ({ start, end, offset, label, axis, onDrag, setInteracting, color = "#ffffff" }) => {
  const { camera, raycaster } = useThree();
  const [isHovered, setIsHovered] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef(null);

  // Geometric Calculations
  const { p1, p2, dir, length, center, isValid } = useMemo(() => {
     if (!isValidVector(start) || !isValidVector(end) || !isValidVector(offset)) {
         return { p1: new THREE.Vector3(), p2: new THREE.Vector3(), dir: new THREE.Vector3(), length: 0, center: new THREE.Vector3(), isValid: false };
     }

     let safeOffset = offset.clone();
     if (safeOffset.lengthSq() < 0.00001) {
         safeOffset = new THREE.Vector3(0, 1, 0); 
     }

     // P1 and P2 are the points on the dimension line (offset from object)
     const p1 = start.clone().add(offset);
     const p2 = end.clone().add(offset);
     const dVec = p2.clone().sub(p1);
     const length = dVec.length();
     const dir = dVec.clone().normalize();
     const center = p1.clone().add(p2).multiplyScalar(0.5);

     return { p1, p2, dir, length, center, isValid: true };
  }, [start, end, offset]);

  const labelPosition = useMemo(() => {
      let safeOffset = offset.clone();
      if (safeOffset.lengthSq() < 0.00001) safeOffset = new THREE.Vector3(0, 1, 0);
      return center.clone().add(safeOffset.normalize().multiplyScalar(0.25));
  }, [center, offset]);

  // Handle Interaction
  const handlePointerDown = (e) => {
    e.stopPropagation();
    if (e.target) {
      e.target.setPointerCapture(e.pointerId);
    }
    
    const plane = new THREE.Plane();
    const viewDir = new THREE.Vector3();
    camera.getWorldDirection(viewDir);
    plane.setFromNormalAndCoplanarPoint(viewDir.negate(), center);

    const intersect = new THREE.Vector3();
    raycaster.ray.intersectPlane(plane, intersect);
    
    if (intersect && isValidVector(intersect)) {
        dragStartRef.current = { point: intersect };
        setIsDragging(true);
        setInteracting(true);
    }
  };

  const handlePointerMove = (e) => {
    if (!isDragging || !dragStartRef.current) return;
    e.stopPropagation();

    const plane = new THREE.Plane();
    const viewDir = new THREE.Vector3();
    camera.getWorldDirection(viewDir);
    plane.setFromNormalAndCoplanarPoint(viewDir.negate(), center);

    const intersect = new THREE.Vector3();
    raycaster.ray.intersectPlane(plane, intersect);

    if (intersect && isValidVector(intersect)) {
        const startPoint = dragStartRef.current.point;
        const diff = intersect.clone().sub(startPoint);
        
        let delta = 0;
        if (axis === 'x') delta = diff.x;
        if (axis === 'y') delta = diff.y;
        if (axis === 'z') delta = diff.z;
        
        if (!isNaN(delta)) {
            onDrag(delta);
            dragStartRef.current = { point: intersect };
        }
    }
  };

  const handlePointerUp = (e) => {
    setIsDragging(false);
    setInteracting(false);
    dragStartRef.current = null;
    if (e.target) {
      e.target.releasePointerCapture(e.pointerId);
    }
  };

  // ... rendering code with arrows and hit area ...
};
```

**Explanation:**

This component implements an interactive 3D dimension handle that allows users to resize 3D models by dragging along specific axes. The handle visualizes model dimensions with arrows and labels, providing intuitive visual feedback about the current size. The implementation uses advanced 3D interaction techniques, including plane-based raycasting and pointer capture for smooth dragging.

The geometric calculations compute the handle's visual representation by offsetting the start and end points of the dimension from the model's bounding box. This offset ensures the handle is visible and doesn't overlap with the model geometry. The direction vector and length are calculated to position arrows and connecting lines correctly. The center point serves as both the visual center and the interaction point for dragging.

The interaction system uses a plane-based approach for dragging, which provides more intuitive control than direct 3D raycasting. The plane is constructed perpendicular to the camera's view direction, ensuring that dragging movements translate directly to screen space movements. This creates a natural feel where users drag along the axis they're viewing, regardless of camera angle.

The pointer capture mechanism (`setPointerCapture`/`releasePointerCapture`) ensures that dragging continues smoothly even if the pointer moves outside the handle's bounds, which is essential for a good user experience. The `setInteracting` callback notifies the parent component to disable camera controls during dragging, preventing conflicts between dimension adjustment and camera movement.

---

### 5.4.2 Bounding Box Calculation and Original Size Detection

**File:** `src/components/ModelDimensionEditor/Viewer3D.jsx`  
**Lines:** 287-344

```javascript
// Calculate bounding box and original size (only when scene changes)
useLayoutEffect(() => {
  if (scene) {
    scene.scale.set(1, 1, 1);
    scene.updateMatrixWorld(true);

    const box = new THREE.Box3();
    box.makeEmpty();
    
    let hasMesh = false;
    scene.traverse((child) => {
        if (child.isMesh) {
            const mesh = child;
            if (mesh.geometry) {
                if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
                const meshBox = mesh.geometry.boundingBox;
                if (meshBox && !meshBox.isEmpty()) {
                    const worldBox = meshBox.clone().applyMatrix4(mesh.matrixWorld);
                    box.union(worldBox);
                    hasMesh = true;
                }
            }
        }
    });

    if (box.isEmpty() || !hasMesh) {
        box.setFromObject(scene);
    }
    
    if (box.isEmpty() || !isFinite(box.min.x)) {
        const defaultSz = new THREE.Vector3(1, 1, 1);
        setOriginalSize(defaultSz);
        setModelCenter(new THREE.Vector3(0,0,0));
        onDimensionsChangeRef.current({ x: 1, y: 1, z: 1 });
        return;
    }

    const sz = new THREE.Vector3();
    box.getSize(sz);
    const ctr = new THREE.Vector3();
    box.getCenter(ctr);

    if (sz.x === 0) sz.x = 0.01;
    if (sz.y === 0) sz.y = 0.01;
    if (sz.z === 0) sz.z = 0.01;
    
    setOriginalSize(sz);
    setModelCenter(ctr);
    
    if (!isInitializedRef.current) {
      isInitializedRef.current = true;
      if (!targetDimensions || !targetDimensions.width || !targetDimensions.height || !targetDimensions.depth) {
        // No target dimensions, use original size
        onDimensionsChangeRef.current({ x: sz.x, y: sz.y, z: sz.z });
      }
    }
  }
}, [scene]);
```

**Explanation:**

This effect calculates the original bounding box and dimensions of a loaded 3D model, which serves as the baseline for dimension adjustments. The implementation uses `useLayoutEffect` instead of `useEffect` to ensure calculations occur synchronously before the browser paints, preventing visual glitches during initialization.

The bounding box calculation employs a sophisticated traversal approach that computes bounding boxes for individual mesh geometries and transforms them to world space using each mesh's transformation matrix. This method is more accurate than `setFromObject` for complex models with multiple meshes and transformations, as it accounts for all geometric data including scaled, rotated, or translated meshes.

The code includes multiple fallback strategies: if geometry-based calculation fails, it falls back to `setFromObject`; if that also fails, it uses default dimensions. This robust error handling ensures the editor always has valid dimension data, even for malformed or unusual models. The minimum dimension check (0.01) prevents division by zero errors in scaling calculations.

The original size is stored in component state and used as the reference for all scaling operations. When users drag dimension handles, the new dimensions are calculated as `originalSize * scale`, maintaining the relationship between the model's original geometry and its displayed size. This approach allows precise dimension control while preserving the model's aspect ratios and proportions.

---

### 5.4.3 Real-time Dimension Updates During Resize

**File:** `src/components/ModelDimensionEditor/Viewer3D.jsx`  
**Lines:** 406-436

```javascript
const handleResize = (axis, delta) => {
  setScale(prev => {
      const next = prev.clone();
      const baseSize = originalSize[axis];
      if (baseSize === 0) return prev;

      const currentDim = baseSize * prev[axis];
      const newDim = Math.max(0.01, currentDim + delta);
      const newScale = newDim / baseSize;
      
      // Validate scale to prevent NaN, Infinity, or extreme values
      if (!isFinite(newScale) || newScale <= 0 || newScale > 1000) {
        return prev;
      }
      
      next[axis] = newScale;
      
      // Immediately notify parent of dimension change during drag
      const newDims = {
        x: axis === 'x' ? newDim : (originalSize.x * next.x),
        y: axis === 'y' ? newDim : (originalSize.y * next.y),
        z: axis === 'z' ? newDim : (originalSize.z * next.z),
      };
      console.log('Viewer3D: handleResize - notifying dimension change:', newDims);
      if (onDimensionsChangeRef.current) {
        onDimensionsChangeRef.current(newDims);
      }
      
      return next;
  });
};
```

**Explanation:**

This function handles real-time dimension updates as users drag dimension handles. The implementation uses React's functional state update pattern (`setScale(prev => ...)`) to ensure state updates are based on the most current values, preventing race conditions and stale closures.

The resize calculation converts the drag delta (movement in world space) into a scale factor by dividing the new dimension by the original size. This approach maintains the relationship between the model's original geometry and its displayed size, allowing precise control while preserving proportions. The minimum dimension check (0.01) prevents models from becoming invisible or causing mathematical errors.

The validation logic prevents invalid scale values that could break rendering or cause performance issues. Scales must be finite numbers, positive, and less than 1000x the original size. These constraints prevent both mathematical errors (NaN, Infinity) and performance degradation from extremely large models.

The function immediately notifies the parent component of dimension changes during dragging, enabling real-time UI updates (such as dimension labels) without waiting for the drag to complete. This creates a responsive user experience where feedback is instantaneous. The notification includes all three dimensions, recalculating the non-dragged axes based on their current scale values, ensuring the parent always has complete dimension information.

---

## 5.5 Floorplan to 3D Conversion

### 5.5.1 Floorplan Export to GLB Format

**File:** `src/components/BlueprintEditor/Room3D.jsx`  
**Lines:** 292-338

```javascript
const SceneExporter = ({ onExportRef, onExport, data }) => {
  const { scene } = useThree();

  useEffect(() => {
    if (onExportRef) {
      onExportRef.current = () => {
        const roomContent = scene.getObjectByName('room-content');
        if (!roomContent) {
            console.error("Room content not found");
            return;
        }

        const exporter = new GLTFExporter();
        exporter.parse(
          roomContent,
          (result) => {
            if (result instanceof ArrayBuffer) {
              // If onExport callback is provided, call it with the blob and floorplan data
              if (onExport) {
                const blob = new Blob([result], { type: 'model/gltf-binary' });
                onExport({
                  glbBlob: blob,
                  glbFileName: 'venue-model.glb',
                  floorplan: data // Include full floorplan data with doors, windows, stages
                });
              } else {
                // Otherwise, download directly
                saveArrayBuffer(result, 'plancraft-room.glb');
              }
            } else {
              console.error("Export failed: Output is not ArrayBuffer");
            }
          },
          (error) => {
            console.error('An error happened during export:', error);
          },
          { binary: true }
        );
      };
    }
    return () => {
      if (onExportRef) onExportRef.current = null;
    };
  }, [scene, onExportRef, onExport, data]);

  return null;
};
```

**Explanation:**

This component provides the functionality to export a 3D floorplan scene to GLB format, enabling vendors to convert 2D floorplan designs into 3D venue models. The implementation uses the `GLTFExporter` from Three.js, which converts Three.js scene graphs into the GLTF/GLB format used throughout the application.

The export function is exposed via a ref callback pattern, allowing parent components to trigger exports programmatically (e.g., from a button click). The function locates the `room-content` group in the scene, which contains all floorplan geometry (walls, floors, doors, windows). This selective export ensures only relevant geometry is included, excluding UI elements, helpers, and other non-essential objects.

The exporter is configured with `{ binary: true }`, which generates GLB (binary GLTF) format instead of JSON-based GLTF. GLB is preferred because it's more compact, loads faster, and includes embedded textures and binary data in a single file. The export result is an `ArrayBuffer` containing the binary GLB data.

The component supports two usage modes: callback-based export (for integration with the listing creation workflow) and direct download (for standalone use). When a callback is provided, it passes both the GLB blob and the original floorplan data, enabling the parent to save the model file while preserving the floorplan structure for future editing. This dual-data approach allows vendors to both use the 3D model in the venue designer and maintain the ability to edit the original floorplan.

---

### 5.5.2 Room Shape Generation from Floorplan Points

**File:** `src/components/BlueprintEditor/Room3D.jsx`  
**Lines:** 193-249

```javascript
// Helper function to get room shape (reused for floor and ceiling)
const useRoomShape = (data) => {
  return useMemo(() => {
    const s = new THREE.Shape();
    if (data.walls.length < 3) return null;

    const adj = new Map();
    data.walls.forEach(w => {
      if (!adj.has(w.startPointId)) adj.set(w.startPointId, []);
      if (!adj.has(w.endPointId)) adj.set(w.endPointId, []);
      adj.get(w.startPointId).push(w.endPointId);
      adj.get(w.endPointId).push(w.startPointId);
    });

    const startNodeId = Array.from(adj.keys()).find(k => adj.get(k).length >= 2);
    if (!startNodeId) return null;

    const path = [startNodeId];
    const visited = new Set();
    visited.add(startNodeId);

    let curr = startNodeId;
    let prev = null;
    
    for(let i = 0; i < data.points.length * 2; i++) {
       const neighbors = adj.get(curr);
       if (!neighbors) break;

       const next = neighbors.find(n => n !== prev);
       
       if (next === startNodeId && path.length > 2) {
          break; 
       }

       if (next && !visited.has(next)) {
         visited.add(next);
         path.push(next);
         prev = curr;
         curr = next;
       } else {
         break; 
       }
    }

    if (path.length < 3) return null;

    const pathPoints = path.map(id => data.points.find(p => p.id === id)).filter(p => !!p);
    if (pathPoints.length !== path.length) return null;

    s.moveTo(pathPoints[0].x / PIXELS_PER_METER, -pathPoints[0].y / PIXELS_PER_METER);
    for (let i = 1; i < pathPoints.length; i++) {
      s.lineTo(pathPoints[i].x / PIXELS_PER_METER, -pathPoints[i].y / PIXELS_PER_METER);
    }
    s.closePath();
    return s;
  }, [data]);
};
```

**Explanation:**

This function converts a floorplan's wall structure into a Three.js `Shape` object that can be used to generate floor and ceiling geometry. The implementation uses graph traversal algorithms to reconstruct the room's perimeter from wall connections, handling complex floorplans with multiple rooms and irregular shapes.

The algorithm begins by building an adjacency map that represents the floorplan as a graph, where points are nodes and walls are edges. This graph structure enables efficient traversal to find connected paths. The function identifies a starting node (a point connected to at least two walls) and begins traversing the graph, following walls to construct a closed path around the room perimeter.

The traversal uses a depth-first search approach with cycle detection to prevent infinite loops. It tracks visited nodes and ensures the path closes by checking if it returns to the starting point. The iteration limit (`data.points.length * 2`) provides a safety mechanism to prevent infinite loops in malformed floorplan data.

Coordinate conversion transforms pixel coordinates (from the 2D floorplan editor) to 3D world coordinates by dividing by `PIXELS_PER_METER`, which defines the scale relationship between the 2D editor and 3D scene. The Y-coordinate is negated to account for the difference between 2D screen coordinates (Y-down) and 3D world coordinates (Y-up).

The resulting `Shape` object is used to generate `ShapeGeometry`, which creates the floor and ceiling meshes. This approach ensures that the 3D representation accurately reflects the 2D floorplan geometry, maintaining spatial relationships and proportions.

---

### 5.5.3 Complex Wall Mesh with Doors and Windows

**File:** `src/components/BlueprintEditor/Room3D.jsx`  
**Lines:** 55-157

```javascript
// Complex wall mesh that handles doors and windows by splitting into segments
const ComplexWallMesh = ({ wall, start, end, doors, windows, enableShadows = true }) => {
  const { totalLength, thickness, height, angle, midX, midY, segments } = useMemo(() => {
    const len = Math.sqrt(Math.pow(end.x - start.x, 2) + Math.pow(end.y - start.y, 2)) / PIXELS_PER_METER;
    const thick = wall.thickness / PIXELS_PER_METER;
    const h = wall.height || DEFAULT_WALL_HEIGHT;
    const ang = Math.atan2(end.y - start.y, end.x - start.x);

    // Combine and sort openings
    const openings = [
      ...(doors || []).map(d => ({ type: 'DOOR', offset: d.offset, width: d.width, height: d.height, elevation: 0, id: d.id })),
      ...(windows || []).map(w => ({ type: 'WINDOW', offset: w.offset, width: w.width, height: w.height, elevation: w.heightFromGround || 0, id: w.id }))
    ].sort((a, b) => a.offset - b.offset);
    
    const segs = [];
    let currentPos = 0;

    openings.forEach(op => {
      const opStart = (op.offset - op.width / 2) / PIXELS_PER_METER;
      const opEnd = (op.offset + op.width / 2) / PIXELS_PER_METER;
      const opWidth = op.width / PIXELS_PER_METER;

      // Wall before opening
      if (opStart > currentPos) {
        const segLen = opStart - currentPos;
        segs.push({
          length: segLen,
          height: h,
          centerX: currentPos + segLen / 2,
          centerY: h / 2,
        });
      }

      // Opening segments
      if (op.type === 'WINDOW') {
        // Sill (below window)
        if (op.elevation > 0) {
          segs.push({
            length: opWidth,
            height: op.elevation,
            centerX: opStart + opWidth / 2,
            centerY: op.elevation / 2
          });
        }
        // Header (above window)
        const topH = h - (op.elevation + op.height);
        if (topH > 0) {
          segs.push({
            length: opWidth,
            height: topH,
            centerX: opStart + opWidth / 2,
            centerY: h - topH / 2
          });
        }
      } else { // DOOR
        // Header (above door)
        const topH = h - op.height;
        if (topH > 0) {
          segs.push({
            length: opWidth,
            height: topH,
            centerX: opStart + opWidth / 2,
            centerY: h - topH / 2
          });
        }
      }

      currentPos = opEnd;
    });

    // Final segment after last opening
    if (currentPos < len) {
      const segLen = len - currentPos;
      segs.push({
        length: segLen,
        height: h,
        centerX: currentPos + segLen / 2,
        centerY: h / 2
      });
    }

    return { totalLength: len, thickness: thick, height: h, angle: ang, midX: mx, midY: my, segments: segs };
  }, [wall, start, end, doors, windows]);

  return (
    <group position={[midX, 0, midY]} rotation={[0, -angle, 0]}>
      {segments.map((seg, idx) => (
        <WallSegmentMesh
          key={`${wall.id}-${idx}`}
          length={seg.length}
          height={seg.height}
          thickness={thickness}
          position={[seg.centerX - totalLength / 2, seg.centerY, 0]}
          rotation={[0, 0, 0]}
          texture={wall.texture}
          enableShadows={enableShadows}
        />
      ))}
    </group>
  );
};
```

**Explanation:**

This component generates 3D wall geometry from 2D floorplan data, handling complex cases where walls contain doors and windows. The implementation splits walls into segments around openings, creating realistic 3D representations that accurately reflect architectural features.

The algorithm processes openings (doors and windows) by sorting them by offset position along the wall, then iteratively creates wall segments before, between, and after openings. For windows, it creates three segments: the wall below the window (sill), the opening itself (handled separately with glass), and the wall above the window (header). For doors, it creates a header segment above the door opening.

The coordinate transformations convert 2D floorplan coordinates to 3D world space, accounting for wall angle, position, and scale. The wall is positioned at its midpoint and rotated to match its orientation in the floorplan. Each segment is positioned relative to the wall's local coordinate system, with the center point calculated to ensure proper alignment.

The segmentation approach enables efficient rendering by creating only the necessary geometry. Solid wall segments use standard box geometry, while openings are left empty (or filled with specialized geometry like window glass). This method provides both visual accuracy and performance optimization, as it avoids creating unnecessary geometry for empty spaces.

---

### 5.5.4 Frontend: Handling Floorplan Export

**File:** `src/pages/ManageListings/ManageListings.jsx`  
**Lines:** 1277-1301

```javascript
// Floorplan editor handlers
const handleFloorplanExport = async (exportData) => {
  try {
    // Convert the GLB blob to a File object
    const glbFile = new File(
      [exportData.glbBlob],
      exportData.glbFileName || 'venue-model.glb',
      { type: 'model/gltf-binary' }
    );

    // Set as the model file
    setModel3DFile(glbFile);
    setModel3DPreview('venue-floorplan.glb');
    setFloorplanData(exportData.floorplan);
    setFloorplanEditorOpen(false);
    setToastNotification({
      open: true,
      message: 'Floorplan exported successfully! The 3D model will be saved when you save the listing.',
      severity: 'success',
    });
  } catch (err) {
    console.error('Error handling floorplan export:', err);
    setToastNotification({ open: true, message: err.message || 'Failed to export floorplan', severity: 'error' });
  }
};
```

**Explanation:**

This function handles the integration between the floorplan editor and the listing creation workflow. When vendors export a floorplan from the 2D editor, it generates a GLB file that can be uploaded as a 3D model for the venue listing. The implementation converts the exported blob into a `File` object, which is compatible with the existing file upload infrastructure.

The conversion from `Blob` to `File` preserves the binary data and MIME type, ensuring the file is handled correctly by the upload system. The function stores both the GLB file and the original floorplan data, enabling future editing of the floorplan if needed. This dual storage approach provides flexibility: vendors can use the 3D model immediately while retaining the ability to modify the source floorplan.

The function closes the floorplan editor and provides user feedback through toast notifications, guiding vendors through the workflow. The success message explicitly states that the model will be saved when the listing is saved, setting clear expectations about when the upload occurs. Error handling ensures that any issues during export are communicated to the user, preventing silent failures that could confuse vendors.

---

## 5.6 Save Scene (Venue Designer)

### 5.6.1 Backend: Save Venue Design Endpoint

**File:** `server/routes/venueDesign.routes.js`  
**Lines:** 2795-2848

```javascript
router.post('/:projectId/save', requireAuth, async (req, res, next) => {
  try {
    if (req.user.role !== 'couple') {
      return res.status(403).json({ error: 'Couple access required' });
    }

    const payload = SAVE_SCHEMA.parse(req.body);

    const project = await fetchProject(req.params.projectId, req.user.sub);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Check if project is archived
    await checkProjectCanBeModified(req.params.projectId, req.user.sub);

    const venueDesign = await getOrCreateVenueDesign(project);
    const layoutData = venueDesign.layoutData || {};

    const updatedLayout = {
      ...layoutData,
      ...(payload.layoutData || {}),
      placementsMeta: payload.layoutData?.placementsMeta || layoutData.placementsMeta || {},
      lastSavedAt: new Date().toISOString(),
    };

    await prisma.venueDesign.update({
      where: { id: venueDesign.id },
      data: {
        layoutData: updatedLayout,
      },
    });

    return res.json({
      message: 'Design saved successfully',
      layoutData: updatedLayout,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      const issues = err.issues.map((issue) => ({
        field: issue.path?.[0] ?? 'unknown',
        message: issue.message,
      }));
      return res.status(400).json({
        error: issues[0]?.message || 'Invalid input',
        issues,
      });
    }
    if (err.statusCode) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    return next(err);
  }
});
```

**Explanation:**

This endpoint handles saving venue design state to the database, preserving the layout configuration, camera positions, and metadata for a couple's wedding project. The implementation includes comprehensive authorization checks, ensuring only the project owner can save designs and that archived projects cannot be modified.

The endpoint uses Zod schema validation (`SAVE_SCHEMA.parse`) to ensure incoming data matches expected structure, preventing invalid data from corrupting the database. The validation provides detailed error messages if the payload structure is incorrect, helping developers and users understand what went wrong.

The save operation merges new layout data with existing data, preserving any fields not included in the update. This partial update pattern allows the frontend to send only changed data, reducing payload size and improving performance. The `placementsMeta` field is handled specially to ensure it's always an object, preventing null reference errors.

The `lastSavedAt` timestamp is automatically updated on every save, enabling the frontend to display when the design was last saved. This timestamp helps users track their work and provides a reference point for conflict resolution if multiple users edit the same design.

The endpoint returns the updated layout data, allowing the frontend to confirm the save was successful and update its local state. Error handling covers validation errors, custom application errors, and unexpected errors, ensuring all failure modes are handled gracefully.

---

### 5.6.2 Frontend: Save Design Handler

**File:** `src/pages/VenueDesigner/Scene3D.jsx`  
**Lines:** 986-989

```javascript
const isProjectMode = designerMode === 'project';
const handleSaveClick = useCallback(() => {
  onSaveDesign?.();
}, [onSaveDesign]);
```

**Explanation:**

This simple callback handler triggers the save operation when users click the save button in the venue designer. The implementation uses React's `useCallback` hook to memoize the function, preventing unnecessary re-renders of child components that receive this function as a prop.

The handler delegates to the `onSaveDesign` callback provided by the parent component, following the inversion of control pattern. This separation of concerns allows the Scene3D component to focus on rendering and user interaction, while the parent component (typically VenueDesignerContext) handles the actual save logic, including API calls and state management.

The optional chaining (`onSaveDesign?.()`) ensures the component doesn't crash if no save handler is provided, making the component more flexible and reusable in different contexts. The `isProjectMode` check indicates that save functionality may behave differently depending on whether the designer is being used for a project or a package template.

---

### 5.6.3 Placement Update and Commit

**File:** `src/pages/VenueDesigner/Scene3D.jsx`  
**Lines:** 764-885

```javascript
const handleTransformCommit = useCallback(
  async (placementId, nextState) => {
    if (!placementId || !nextState) return;
    const payload = {};
    if (nextState.position) {
      payload.position = nextState.position;
    }
    if (typeof nextState.rotation === 'number') {
      payload.rotation = nextState.rotation;
    }
    if (nextState.parentElementId !== undefined) {
      payload.parentElementId = nextState.parentElementId;
    }
    if (Object.keys(payload).length === 0) return;
    
    // Clear drag session after commit
    selectedInitialPositionsRef.current.clear();
    currentDragSessionRef.current = null;
    
    try {
      const draggedPlacement = placements.find((p) => p.id === placementId);
      if (!draggedPlacement) return;

      // Calculate offset for multi-selection movement
      const isMultiSelect = selectedIds.length > 1 && selectedIds.includes(placementId);
      let positionOffset = null;
      let rotationOffset = null;
      
      if (isMultiSelect && nextState.position) {
        const oldPos = draggedPlacement.position || { x: 0, y: 0, z: 0 };
        positionOffset = {
          x: nextState.position.x - oldPos.x,
          y: nextState.position.y - oldPos.y,
          z: nextState.position.z - oldPos.z,
        };
      }
      
      if (isMultiSelect && typeof nextState.rotation === 'number' && draggedPlacement.rotation !== undefined) {
        rotationOffset = nextState.rotation - draggedPlacement.rotation;
      }

      // Update the dragged element
      await onUpdatePlacement?.(placementId, payload);

      // Update all other selected elements (multi-selection movement)
      if (isMultiSelect) {
        const otherSelected = placements.filter(
          (p) => selectedIds.includes(p.id) && p.id !== placementId && !p.isLocked
        );
        
        for (const other of otherSelected) {
          const otherPayload = {};
          
          if (positionOffset) {
            const otherPos = other.position || { x: 0, y: 0, z: 0 };
            otherPayload.position = {
              x: otherPos.x + positionOffset.x,
              y: otherPos.y + positionOffset.y,
              z: otherPos.z + positionOffset.z,
            };
          }
          
          if (rotationOffset !== null && other.rotation !== undefined) {
            otherPayload.rotation = (other.rotation || 0) + rotationOffset;
          }
          
          if (Object.keys(otherPayload).length > 0) {
            await onUpdatePlacement?.(other.id, otherPayload);
          }
        }
      }

      // If this element has children, update their positions/rotations (parent-child relationship)
      if (draggedPlacement && draggedPlacement.parentElementId === null && (nextState.position || typeof nextState.rotation === 'number')) {
        const children = placements.filter((p) => p.parentElementId === placementId);
        
        if (children.length > 0) {
          const draggedRef = selectedElementRefs.current.get(placementId);
          const parentVisualPos = draggedRef?.groupRef?.current?.position 
            ? { 
                x: draggedRef.groupRef.current.position.x,
                y: draggedRef.groupRef.current.position.y,
                z: draggedRef.groupRef.current.position.z,
              }
            : (nextState.position || draggedPlacement.position || { x: 0, y: 0, z: 0 });
          
          for (const child of children) {
            const childRef = selectedElementRefs.current.get(child.id);
            const childVisualPos = childRef?.groupRef?.current?.position
              ? {
                  x: childRef.groupRef.current.position.x,
                  y: childRef.groupRef.current.position.y,
                  z: childRef.groupRef.current.position.z,
                }
              : (child.position || { x: 0, y: 0, z: 0 });
              
            await onUpdatePlacement?.(child.id, {
              position: {
                x: Number(childVisualPos.x.toFixed(3)),
                y: Number(childVisualPos.y.toFixed(3)),
                z: Number(childVisualPos.z.toFixed(3)),
              },
            });
          }
        }
      }
    } catch (err) {
      // Errors already handled upstream, no-op to keep interaction smooth
    }
  },
  [onUpdatePlacement, placements, selectedIds]
);
```

**Explanation:**

This function handles committing placement transformations (position, rotation) to the database after users finish dragging or rotating elements in the 3D scene. The implementation supports three scenarios: single element updates, multi-selection updates, and parent-child relationship updates.

The function builds a payload containing only the changed properties, minimizing database updates and network traffic. It clears drag session state after commit, preventing stale data from affecting future interactions. The early return if no payload is built prevents unnecessary API calls.

For multi-selection scenarios, the function calculates the offset (change in position or rotation) from the dragged element and applies the same offset to all other selected elements. This maintains relative positioning between selected elements, creating a natural group movement experience. Locked elements are excluded from updates to prevent accidental modifications.

The parent-child relationship handling ensures that when a parent element is moved or rotated, all child elements maintain their relative positions. The implementation uses visual positions from the 3D scene refs rather than database positions, ensuring that real-time visual updates are accurately persisted. This approach handles complex scenarios where elements are moved multiple times before commit, always saving the final visual state.

Position values are rounded to 3 decimal places before saving, balancing precision with database storage efficiency. The function uses sequential `await` calls for child updates to ensure they complete before the function returns, maintaining data consistency. Error handling is minimal because errors are handled upstream, allowing this function to focus on the commit logic without cluttering error management.

---

---

## 5.7 Loading Placed Elements in Scene

### 5.7.1 Rendering Placed Elements in Venue Scene

**File:** `src/pages/VenueDesigner/Scene3D.jsx`  
**Lines:** 1243-1271

```javascript
<Suspense fallback={null}>
  {placements.map((placement) => (
      <PlacedElement
        key={placement.id}
        placement={placement}
        isSelected={selectedIds.includes(placement.id)}
        selectedIds={selectedIds}
        onSelect={handleSelect}
        availability={availabilityMap[placement.metadata?.serviceListingId]}
        snapIncrement={effectiveGrid.snapToGrid ? effectiveGrid.size || 1 : null}
        onOrbitToggle={setOrbitEnabled}
        onTransformCommit={handleTransformCommit}
        allPlacements={placements}
        removable={true}
        onDelete={handleDeletePlacement}
        onDuplicate={onDuplicatePlacement ? handleDuplicatePlacement : undefined}
        onToggleLock={handleTogglePlacementLock}
        onShowDetails={sceneOptions.onShowDetails}
        onClose={handleCloseSelection}
        venueBounds={venueBounds}
        onOpenTaggingModal={handleOpenTaggingModal}
        onRegisterElementRef={(id, ref) => {
          selectedElementRefs.current.set(id, ref);
        }}
        onUpdateOtherSelected={handleUpdateOtherSelected}
        onInitializeDragSession={handleInitializeDragSession}
      />
    ))}
</Suspense>
```

**Explanation:**

This code snippet demonstrates how placed elements are rendered in the 3D venue scene. The implementation uses React's `Suspense` component to handle asynchronous loading of 3D models, providing a smooth user experience while GLTF files are being fetched and parsed. The `fallback={null}` ensures no loading indicator is shown, maintaining visual continuity in the scene.

Each placement is rendered as a `PlacedElement` component, which encapsulates the 3D model, interaction handlers, and visual state. The component receives comprehensive props including selection state, availability information, grid snapping settings, and various callback functions for user interactions. The `key` prop uses the placement ID to ensure React can efficiently track and update individual elements when the placements array changes.

The selection state is determined by checking if the placement ID exists in the `selectedIds` array, enabling multi-selection support. The `availabilityMap` provides real-time availability information for service listings, allowing the UI to visually indicate when items are unavailable. Grid snapping is conditionally enabled based on user preferences, providing precise alignment when needed while allowing free movement otherwise.

The component registers element references via `onRegisterElementRef`, enabling the parent component to access 3D scene objects for advanced operations like multi-selection movement and parent-child relationships. This pattern allows the Scene3D component to coordinate complex interactions between multiple elements without tightly coupling the PlacedElement component to the scene's internal state management.

---

### 5.7.2 GLTF Instance Loading and Scaling

**File:** `src/pages/VenueDesigner/PlacedElement.jsx`  
**Lines:** 33-112

```javascript
const GltfInstance = ({ url, scaleMultiplier = 1, verticalOffset = 0, targetDimensions = null }) => {
  const { scene } = useGLTF(url);
  const parsedTargetDimensions = useMemo(() => parseDimensions(targetDimensions), [targetDimensions]);

  const cloned = useMemo(() => {
    if (!scene) return null;
    const copy = scene.clone(true);
    copy.traverse((child) => {
      if (child.isMesh && child.material) {
        child.castShadow = true;
        child.receiveShadow = true;
        child.material = child.material.clone();
      }
    });

    const bbox = new THREE.Box3().setFromObject(copy);
    const center = bbox.getCenter(new THREE.Vector3());
    copy.position.sub(center);

    const size = bbox.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);

    let scaleX = 1;
    let scaleY = 1;
    let scaleZ = 1;

    if (parsedTargetDimensions) {
      const ratioX =
        parsedTargetDimensions.width && size.x > 0 ? parsedTargetDimensions.width / size.x : null;
      const ratioY =
        parsedTargetDimensions.height && size.y > 0 ? parsedTargetDimensions.height / size.y : null;
      const ratioZ =
        parsedTargetDimensions.depth && size.z > 0 ? parsedTargetDimensions.depth / size.z : null;

      const ratios = [ratioX, ratioY, ratioZ].filter((value) => Number.isFinite(value));

      if (ratios.length === 1) {
        const uniformScale = ratios[0] || 1;
        scaleX = scaleY = scaleZ = uniformScale;
      } else if (ratios.length > 1) {
        scaleX = ratioX || ratios[0];
        scaleY = ratioY || ratios[0];
        scaleZ = ratioZ || ratios[0];
      } else if (maxDim > 0) {
        const fitScale = 2 / maxDim;
        scaleX = scaleY = scaleZ = fitScale;
      }
    } else if (maxDim > 0) {
      let normalization = 1;
      if (maxDim > 5) {
        normalization = 5 / maxDim;
      } else if (maxDim < 0.5) {
        normalization = 0.5 / maxDim;
      }
      scaleX = scaleY = scaleZ = normalization;
    }

    if (Number.isFinite(scaleMultiplier) && scaleMultiplier > 0) {
      scaleX *= scaleMultiplier;
      scaleY *= scaleMultiplier;
      scaleZ *= scaleMultiplier;
    }

    copy.scale.set(scaleX, scaleY, scaleZ);

    const alignedBox = new THREE.Box3().setFromObject(copy);
    copy.position.y -= alignedBox.min.y;
    if (verticalOffset) {
      copy.position.y += verticalOffset;
    }

    return copy;
  }, [scene, scaleMultiplier, verticalOffset, parsedTargetDimensions]);

  if (!cloned) {
    return null;
  }

  return <primitive object={cloned} />;
};
```

**Explanation:**

This component handles the loading and preprocessing of GLTF models for individual placed elements. The `useGLTF` hook provides automatic caching, ensuring that the same model file is only loaded once even when used by multiple placements, significantly improving performance and memory usage.

The preprocessing pipeline performs several critical transformations. First, it clones the scene to avoid mutating the cached original, which could affect other instances. During traversal, it enables shadow casting and receiving for all meshes, creating realistic lighting interactions. Materials are cloned to allow per-instance modifications without affecting the cached model.

The scaling logic supports two modes: target dimensions mode and normalization mode. When target dimensions are provided, it calculates scale ratios for each axis independently, enabling non-uniform scaling to match specific physical dimensions. If only one dimension is provided, it applies uniform scaling. If no target dimensions are provided, it normalizes the model to a reasonable size range (0.5 to 5 units), ensuring consistent visual scale across different models.

The centering operation moves the model's geometric center to the origin, simplifying position calculations. The ground alignment step ensures the model's bottom sits at y=0, with optional vertical offset for fine-tuning. This preprocessing ensures that all models render consistently regardless of their original orientation or scale, simplifying the placement and interaction logic.

---

## 5.8 Element Selection and Manipulation

### 5.8.1 Element Selection Handler

**File:** `src/pages/VenueDesigner/Scene3D.jsx`  
**Lines:** 318-346

```javascript
const handleSelect = useCallback((placementId, isShiftKey = false) => {
  if (isShiftKey) {
    // Toggle selection: add if not selected, remove if already selected
    setSelectedIds((prev) => {
      const newSelection = prev.includes(placementId)
        ? prev.filter((id) => id !== placementId)
        : [...prev, placementId];
      // Update ref immediately
      selectedIdsRef.current = newSelection;
      // Clear all drag state when selection changes
      selectedInitialPositionsRef.current.clear();
      currentDragSessionRef.current = null;
      // Reset to default move mode when selection changes
      if (newSelection.length > 1) {
        setGroupInteractionMode('translate');
      }
      return newSelection;
    });
  } else {
    // Single selection: replace current selection
    const newSelection = [placementId];
    selectedIdsRef.current = newSelection;
    setSelectedIds(newSelection);
    // Clear all drag state when selection changes
    selectedInitialPositionsRef.current.clear();
    currentDragSessionRef.current = null;
    setGroupInteractionMode('translate');
  }
}, []);
```

**Explanation:**

This function handles element selection in the 3D scene, supporting both single and multi-selection modes. The implementation uses React's `useCallback` hook to memoize the function, preventing unnecessary re-renders of child components that receive this function as a prop.

When the Shift key is held, the function toggles the selection state of the clicked element. If the element is already selected, it's removed from the selection; if not, it's added. This provides intuitive multi-selection behavior similar to desktop file managers. The selection state is stored both in React state (`selectedIds`) and a ref (`selectedIdsRef.current`), ensuring that drag handlers always have access to the current selection without stale closures.

When Shift is not held, the function replaces the current selection with a single-element selection. This provides clear visual feedback and prevents confusion about which elements are selected. The function clears all drag-related state when selection changes, preventing bugs where drag operations could affect newly selected elements.

The group interaction mode is reset to 'translate' (move mode) when selection changes, ensuring users start with the expected interaction mode. This prevents scenarios where users might be in rotate mode from a previous selection and accidentally rotate newly selected elements.

---

### 5.8.2 Element Drag and Transform Handling

**File:** `src/pages/VenueDesigner/PlacedElement.jsx`  
**Lines:** 330-373

```javascript
const handlePointerDown = useCallback(
  (event) => {
    event.stopPropagation();
    if (!isSelected) {
      const isShiftKey = event.nativeEvent?.shiftKey || false;
      onSelect?.(placement.id, isShiftKey);
      return;
    }
    if (!groupRef.current || isLockedLocal) return;

    const state = dragStateRef.current;
    
    state.initialPosition = groupRef.current.position.clone();
    
    if (selectedIds.length > 1 && selectedIds.includes(placement.id)) {
      if (onInitializeDragSession) {
        onInitializeDragSession(placement.id, {
          x: state.initialPosition.x,
          y: state.initialPosition.y,
          z: state.initialPosition.z,
        });
      }
    }
    
    if (interactionMode === 'translate') {
      if (event.ray.intersectPlane(state.plane, state.intersection)) {
        state.offset.copy(groupRef.current.position).sub(state.intersection);
      } else {
        state.offset.set(0, 0, 0);
      }
      state.mode = 'translate';
    } else if (interactionMode === 'rotate') {
      state.startPointerX = event.clientX ?? event.nativeEvent?.clientX ?? 0;
      state.startRotation = groupRef.current.rotation.y;
      state.mode = 'rotate';
    }

    onOrbitToggle?.(false);
    state.pointerId = event.pointerId;
    state.captureTarget = event.target;
    state.captureTarget?.setPointerCapture?.(event.pointerId);
  },
  [onSelect, placement.id, onOrbitToggle, isSelected, isLockedLocal, interactionMode, selectedIds, allPlacements]
);
```

**Explanation:**

This function initiates drag operations for placed elements, handling both translation (movement) and rotation modes. The implementation uses pointer capture to ensure smooth dragging even when the pointer moves outside the element's bounds, which is essential for a good user experience.

When an unselected element is clicked, it selects the element instead of starting a drag operation. This provides clear visual feedback and prevents accidental movements. Locked elements cannot be dragged, preventing accidental modifications to finalized designs.

For multi-selection scenarios, the function initializes a drag session that captures the initial positions of all selected elements. This enables synchronized movement of multiple elements, maintaining their relative positions. The drag session is initialized through a callback to the parent component, allowing the Scene3D component to coordinate multi-element operations.

In translate mode, the function calculates an offset between the element's current position and the intersection point of the ray with the ground plane. This offset is maintained throughout the drag, ensuring the element follows the cursor smoothly. In rotate mode, it captures the initial pointer X position and current rotation, enabling rotation based on horizontal mouse movement.

The function disables orbit controls during dragging to prevent conflicts between element manipulation and camera movement. Pointer capture ensures that drag operations continue smoothly even if the pointer temporarily leaves the element, which is common during fast movements.

---

## 5.9 Model Preview Components

### 5.9.1 Model3DViewer Component

**File:** `src/components/Model3DViewer/Model3DViewer.jsx`  
**Lines:** 95-237

```javascript
function Model({ url, onError, targetDimensions }) {
  const { scene, error } = useGLTF(url);
  const modelRef = useRef();
  const parsedTargetDimensions = useMemo(() => parseDimensions(targetDimensions), [targetDimensions]);
  
  // Calculate scale separately so React Three Fiber can detect changes
  const scaleArray = useMemo(() => {
    if (!scene) {
      return [1, 1, 1];
    }
    
    if (!parsedTargetDimensions) {
      // Default scale for fitting
      const box = new THREE.Box3().setFromObject(scene);
      const size = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z);
      if (maxDim > 0) {
        const fitScale = 2 / maxDim;
        return [fitScale, fitScale, fitScale];
      }
      return [1, 1, 1];
    }

    const box = new THREE.Box3().setFromObject(scene);
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);

    let scaleX = 1;
    let scaleY = 1;
    let scaleZ = 1;

    const ratioX =
      parsedTargetDimensions.width && size.x > 0
        ? parsedTargetDimensions.width / size.x
        : null;
    const ratioY =
      parsedTargetDimensions.height && size.y > 0
        ? parsedTargetDimensions.height / size.y
        : null;
    const ratioZ =
      parsedTargetDimensions.depth && size.z > 0
        ? parsedTargetDimensions.depth / size.z
        : null;

    const ratios = [ratioX, ratioY, ratioZ].filter((value) => Number.isFinite(value));

    if (ratios.length === 1) {
      const uniformScale = ratios[0] || 1;
      scaleX = scaleY = scaleZ = uniformScale;
    } else if (ratios.length > 1) {
      scaleX = ratioX || ratios[0] || 1;
      scaleY = ratioY || ratios[0] || 1;
      scaleZ = ratioZ || ratios[0] || 1;
    } else if (maxDim > 0) {
      const fitScale = 2 / maxDim;
      scaleX = scaleY = scaleZ = fitScale;
    }

    // Prevent zero/NaN
    const safeScale = (value) => (Number.isFinite(value) && value > 0 ? value : 1);
    scaleX = safeScale(scaleX);
    scaleY = safeScale(scaleY);
    scaleZ = safeScale(scaleZ);

    const result = [scaleX, scaleY, scaleZ];
    return result;
  }, [scene, parsedTargetDimensions]);

  // Clone and prepare the scene
  const processedScene = useMemo(() => {
    if (!scene) return null;
    
    try {
      const copy = scene.clone(true);
      copy.traverse((child) => {
        if (child.isMesh && child.material) {
          child.material = child.material.clone();
        }
      });

      const box = new THREE.Box3().setFromObject(copy);
      const center = box.getCenter(new THREE.Vector3());
      copy.position.sub(center);

      // Align to ground (y=0) - will be done after scaling
      return copy;
    } catch (err) {
      console.error('Error processing 3D model:', err);
      if (onError) onError(err.message);
      return null;
    }
  }, [scene, onError]);

  // Apply alignment in a separate effect (scale is applied via group prop)
  useEffect(() => {
    if (!processedScene) return;
    
    // Reset position to center first
    const box = new THREE.Box3().setFromObject(processedScene);
    const center = box.getCenter(new THREE.Vector3());
    processedScene.position.sub(center);
    
    // Align to ground (y=0)
    const alignedBox = new THREE.Box3().setFromObject(processedScene);
    processedScene.position.y -= alignedBox.min.y;
    
    // Force update
    processedScene.updateMatrixWorld(true);
  }, [processedScene, scaleArray]);

  if (error || !processedScene) {
    return null;
  }

  // Use group with scale prop so React Three Fiber detects changes
  return (
    <group ref={modelRef} scale={scaleArray}>
      <primitive object={processedScene} />
    </group>
  );
}
```

**Explanation:**

This component provides a reusable 3D model viewer for displaying models in listings, catalogs, and preview contexts. The implementation separates scale calculation from scene processing, enabling React Three Fiber to detect changes and trigger re-renders when dimensions change.

The scale calculation supports two modes: automatic fitting and target dimensions. In automatic mode, it calculates a scale factor to fit the model within a 2-unit bounding box, ensuring consistent visual size across different models. In target dimensions mode, it calculates independent scale factors for each axis, enabling precise dimension matching.

The scale calculation includes robust error handling, filtering out invalid ratios and providing safe defaults. The `safeScale` function prevents mathematical errors (NaN, Infinity, zero) that could break rendering. The logic handles partial dimension specifications gracefully, applying uniform scaling when only one dimension is provided.

The scene processing pipeline clones the model, centers it, and aligns it to the ground plane. The centering operation simplifies camera positioning and ensures models render consistently regardless of their original coordinate system. The ground alignment step ensures models sit properly on the preview surface, creating a professional appearance.

The component uses a `group` element with a `scale` prop rather than modifying the scene's scale directly. This approach allows React Three Fiber to detect scale changes and trigger re-renders, ensuring the UI stays synchronized with dimension updates. The separation of scale calculation and scene processing enables efficient updates without recreating the entire scene graph.

---

### 5.9.2 Camera Controller for Model Preview

**File:** `src/components/Model3DViewer/Model3DViewer.jsx`  
**Lines:** 8-78

```javascript
function CameraController({ autoRotate = false }) {
  const { camera, scene } = useThree();
  const controlsRef = useRef();

  useEffect(() => {
    if (!scene || !camera) return;
    
    // Wait for scene to load
    const timer = setTimeout(() => {
      const box = new THREE.Box3();
      box.makeEmpty();
      
      scene.traverse((child) => {
        if (child.isMesh) {
          if (child.geometry) {
            if (!child.geometry.boundingBox) {
              child.geometry.computeBoundingBox();
            }
            const meshBox = child.geometry.boundingBox;
            if (meshBox && !meshBox.isEmpty()) {
              const worldBox = meshBox.clone().applyMatrix4(child.matrixWorld);
              box.union(worldBox);
            }
          }
        }
      });

      if (!box.isEmpty()) {
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        
        // Calculate distance to fit the model with a tighter framing
        const distance = maxDim * 1.0;
        const fov = camera.fov * (Math.PI / 180);
        const cameraZ = Math.abs(distance / Math.sin(fov / 2));
        
        // Position camera to view the model from an angle
        camera.position.set(
          center.x + cameraZ * 0.5,
          center.y + cameraZ * 0.5,
          center.z + cameraZ * 0.8
        );
        camera.lookAt(center);
        camera.updateProjectionMatrix();
        
        // Update controls target
        if (controlsRef.current) {
          controlsRef.current.target.copy(center);
          controlsRef.current.update();
        }
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [camera, scene]);

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      enablePan={false}
      enableZoom={true}
      enableRotate={true}
      autoRotate={autoRotate}
      autoRotateSpeed={0.6}
      minDistance={0.5}
      maxDistance={10}
    />
  );
}
```

**Explanation:**

This component automatically positions the camera to frame the 3D model optimally in preview contexts. The implementation calculates the model's bounding box by traversing all meshes and computing their world-space bounding boxes, accounting for transformations applied to the scene graph.

The camera positioning algorithm uses the model's maximum dimension to calculate an appropriate viewing distance. It converts the camera's field of view from degrees to radians and uses trigonometry to determine the distance needed to fit the model within the view frustum. The camera is positioned at an angle (45 degrees horizontally, slightly elevated) to provide a three-quarter view that showcases the model's form effectively.

The bounding box calculation handles complex models with multiple meshes and transformations. It computes bounding boxes for individual mesh geometries and transforms them to world space using each mesh's transformation matrix. This approach is more accurate than using `setFromObject` directly, as it accounts for all geometric data including scaled, rotated, or translated meshes.

The component includes a delay (100ms) before calculating the bounding box, allowing the scene to fully load and all transformations to be applied. This prevents incorrect camera positioning due to incomplete scene data. The cleanup function ensures the timeout is cleared if the component unmounts before the timer fires.

The OrbitControls configuration disables panning to keep the model centered, enables zooming and rotation for user interaction, and supports optional auto-rotation for product showcases. The distance limits prevent users from zooming too close (which could cause clipping) or too far (which would make the model too small to see).

---

## 5.10 Collision Detection

### 5.10.1 Frontend: Real-time Collision Detection During Drag

**File:** `src/pages/VenueDesigner/PlacedElement.jsx`  
**Lines:** 466-493

```javascript
let collisionFound = false;
// Check collisions
for (const other of allPlacements) {
  if (other.id === placement.id) continue;

  const otherPos = other.position || {};
  const dx = nextX - (otherPos.x || 0);
  const dz = nextZ - (otherPos.z || 0);
  const distance = Math.sqrt(dx * dx + dz * dz);
  const otherRadius = getFootprintRadius(other);
  
  const clearance = 0.02;
  const threshold = Math.max(0.1, footprintRadius + otherRadius - clearance);
  const isIntersecting = distance < threshold;

  if (isIntersecting) {
    if (nextY > 0.1) {
      // We are stacked, ignore floor-level collisions
    } else {
      // We are on floor, so collide with floor items
      const otherY = other.position?.y || 0;
      if (otherY < 0.1) {
        collisionFound = true;
        break;
      }
    }
  }
}
```

**Explanation:**

This code implements real-time collision detection during element dragging, preventing elements from overlapping inappropriately. The implementation uses a circular footprint approximation, which provides good performance while maintaining reasonable accuracy for most use cases.

The collision detection algorithm calculates the 2D distance between element centers in the X-Z plane (ignoring vertical position for floor-level collisions). It compares this distance to a threshold calculated from the sum of both elements' footprint radii, minus a small clearance value. This clearance prevents elements from appearing to touch exactly, which can look unnatural.

The algorithm handles stacking scenarios by checking vertical positions. Elements positioned above the ground (y > 0.1) are considered stacked and don't collide with floor-level elements. This enables realistic scenarios like centerpieces on tables or decorations on surfaces. Floor-level elements (y < 0.1) only collide with other floor-level elements, preventing unrealistic intersections while allowing vertical stacking.

The footprint radius calculation considers both explicit metadata and derived dimensions from the design element. This provides flexibility for vendors to specify custom collision radii while falling back to automatic calculation based on model dimensions. The default radius (0.4 units) ensures reasonable collision detection even for models without dimension data.

The early exit optimization (`break` when collision is found) improves performance by avoiding unnecessary checks once a collision is detected. This is particularly important when dragging elements through scenes with many placements, as it reduces computational overhead during real-time interactions.

---

### 5.10.2 Backend: Non-Overlapping Position Finder

**File:** `server/routes/venueDesign.routes.js`  
**Lines:** 1747-1824

```javascript
const findNonOverlappingPosition = (desiredPos, existingPlacements, designElement) => {
  const COLLISION_RADIUS_DEFAULT = 0.4;
  const CLEARANCE = 0.02;
  
  // Get footprint radius for the new element
  let footprintRadius = COLLISION_RADIUS_DEFAULT;
  if (designElement?.dimensions) {
    const width = Number(designElement.dimensions.width) || 0;
    const depth = Number(designElement.dimensions.depth) || 0;
    const derived = Math.max(width, depth) / 2;
    if (derived > 0) footprintRadius = derived;
  }
  
  // Try the desired position first
  let testPos = { ...desiredPos };
  let attempts = 0;
  const maxAttempts = 100;
  const searchRadius = 20; // Maximum search radius
  const angleStep = Math.PI / 4; // 45 degrees
  
  while (attempts < maxAttempts) {
    let hasCollision = false;
    
    // Check collision with all existing placements
    for (const existing of existingPlacements) {
      if (!existing.position) continue;
      
      const existingPos = existing.position;
      const dx = testPos.x - existingPos.x;
      const dz = testPos.z - existingPos.z;
      const distance = Math.sqrt(dx * dx + dz * dz);
      
      // Get footprint radius for existing element
      let existingRadius = COLLISION_RADIUS_DEFAULT;
      if (existing.designElement?.dimensions) {
        const width = Number(existing.designElement.dimensions.width) || 0;
        const depth = Number(existing.designElement.dimensions.depth) || 0;
        const derived = Math.max(width, depth) / 2;
        if (derived > 0) existingRadius = derived;
      }
      
      const threshold = Math.max(0.1, footprintRadius + existingRadius - CLEARANCE);
      if (distance < threshold) {
        hasCollision = true;
        break;
      }
    }
    
    if (!hasCollision) {
      return testPos;
    }
    
    // Try next position in a spiral pattern
    attempts++;
    const ring = Math.floor(Math.sqrt(attempts));
    const angle = (attempts - ring * ring) * angleStep;
    const radius = ring * (footprintRadius * 2 + CLEARANCE);
    testPos = {
      x: desiredPos.x + radius * Math.cos(angle),
      y: desiredPos.y,
      z: desiredPos.z + radius * Math.sin(angle),
    };
    
    // Check if we've gone too far
    const distanceFromOrigin = Math.sqrt(testPos.x * testPos.x + testPos.z * testPos.z);
    if (distanceFromOrigin > searchRadius) {
      // Reset to a closer position
      testPos = {
        x: desiredPos.x + (ring % 4) * (footprintRadius * 2 + CLEARANCE),
        y: desiredPos.y,
        z: desiredPos.z + Math.floor(ring / 4) * (footprintRadius * 2 + CLEARANCE),
      };
    }
  }
  
  // If we couldn't find a position, return the original (user can manually adjust)
  return desiredPos;
};
```

**Explanation:**

This function finds a non-overlapping position for newly placed elements when the desired position conflicts with existing placements. The implementation uses a spiral search pattern that efficiently explores positions around the desired location, finding the closest available space.

The algorithm begins by attempting the desired position, which provides the best user experience when no collisions exist. If a collision is detected, it calculates the next position using a spiral pattern. The spiral is generated by converting attempt numbers into ring and angle coordinates, creating a pattern that expands outward from the desired position.

The ring calculation uses the square root of the attempt number, creating rings that grow at a rate proportional to the square of the radius. This ensures that positions are evenly distributed around the desired location, avoiding clustering in specific directions. The angle calculation distributes positions evenly within each ring, using 45-degree steps for efficient coverage.

The search includes a maximum radius constraint to prevent elements from being placed unreasonably far from the desired location. When the search radius is exceeded, the algorithm resets to a grid-based pattern that ensures positions remain within bounds. This fallback prevents infinite loops and ensures the function always returns a valid position.

The collision detection uses the same circular footprint approximation as the frontend, ensuring consistency between server-side placement and client-side validation. The threshold calculation includes a clearance value to prevent elements from appearing to touch exactly, which improves visual quality.

The function includes a maximum attempt limit (100) to prevent excessive computation. If no valid position is found within the limit, it returns the original desired position, allowing users to manually adjust if needed. This graceful degradation ensures the system remains responsive even in crowded scenes.

---

## 5.11 Package Preview 3D

### 5.11.1 Package Preview Component

**File:** `src/components/PackagePreview3D/PackagePreview3D.jsx`  
**Lines:** 78-277

```javascript
const PackagePreview3D = ({ packageId, height = '500px' }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [designData, setDesignData] = useState(null);

  useEffect(() => {
    const fetchDesign = async () => {
      try {
        setLoading(true);
        const response = await fetch(`http://localhost:4000/packages/${packageId}/preview`, {
          credentials: 'include',
        });
        if (!response.ok) {
          throw new Error('Failed to load package preview');
        }
        const data = await response.json();
        setDesignData(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    if (packageId) {
      fetchDesign();
    }
  }, [packageId]);

  const venueModelUrl = useMemo(
    () => (designData?.venue?.modelFile ? normalizeUrl(designData.venue.modelFile) : null),
    [designData?.venue?.modelFile]
  );

  const placements = useMemo(() => designData?.design?.placedElements || [], [designData?.design?.placedElements]);

  // Minimal context for preview mode (PlacedElement needs this but won't use most values)
  const previewContextValue = useMemo(() => ({
    projectId: null,
    packageId: packageId || null,
    mode: 'package',
    resourceId: packageId || null,
    placements: placements,
    projectServices: [],
    isLoading: false,
    availabilityMap: {},
    venueInfo: designData?.venue || null,
    venueDesignId: null,
    refreshAvailability: () => {},
    onToggleLock: () => {},
    onRemovePlacement: () => {},
    onRemoveProjectService: () => {},
    setToastNotification: () => {},
    onUpdatePlacement: () => {},
    onDuplicatePlacement: undefined,
    onDuplicateMultiple: undefined,
    onDeleteMultiple: undefined,
    onLockMultiple: () => {},
    onReloadDesign: () => {},
    savingState: { loading: false, lastSaved: null },
    designLayout: {},
  }), [packageId, placements, designData?.venue]);

  if (loading) {
    return (
      <Box sx={{ width: '100%', height, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f5f5f5', borderRadius: 2 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error || !designData) {
    return (
      <Box sx={{ width: '100%', height, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f5f5f5', borderRadius: 2, flexDirection: 'column', gap: 1 }}>
        <Typography variant="body2" color="text.secondary">
          {error || 'Preview not available'}
        </Typography>
      </Box>
    );
  }

  return (
    <VenueDesignerProvider value={previewContextValue}>
      <Box sx={{ width: '100%', height, borderRadius: 2, overflow: 'hidden', backgroundColor: '#cbd2de', position: 'relative', border: '1px solid #e0e0e0' }}>
        <Canvas shadows camera={{ position: [14, 16, 18], fov: 42, near: 0.1, far: 500 }} dpr={[1, 2]}>
          <color attach="background" args={['#cbd2de']} />
          <fog attach="fog" args={['#efe9e4', 60, 220]} />
          <ambientLight intensity={0.65} />
          <directionalLight
            position={[18, 30, 20]}
            intensity={1.2}
            castShadow
            shadow-mapSize={[2048, 2048]}
            shadow-camera-left={-100}
            shadow-camera-right={100}
            shadow-camera-top={100}
            shadow-camera-bottom={-100}
            shadow-camera-near={0.1}
            shadow-camera-far={100}
            shadow-bias={-0.0001}
          />
          <directionalLight position={[-20, 15, -10]} intensity={0.4} />

          <SceneGround size={200} />

          {venueModelUrl && (
            <Suspense fallback={null}>
              <VenueModel modelUrl={venueModelUrl} />
            </Suspense>
          )}

          <ContactShadows position={[0, 0.001, 0]} opacity={0.12} width={200} height={200} blur={3.5} far={50} scale={1.2} />

          <Suspense fallback={null}>
            {placements.map((placement) => (
              <PlacedElement
                key={placement.id}
                placement={placement}
                isSelected={false}
                onSelect={() => {}}
                availability={null}
                snapIncrement={null}
                onOrbitToggle={() => {}}
                onTransformCommit={() => {}}
                allPlacements={placements}
                removable={false}
                onDelete={() => {}}
                onToggleLock={() => {}}
                onShowDetails={null}
                onClose={() => {}}
              />
            ))}
          </Suspense>

          <Environment preset="sunset" />

          <OrbitControls
            makeDefault
            enableDamping
            dampingFactor={0.08}
            minDistance={6}
            maxDistance={45}
            minPolarAngle={0.05}
            maxPolarAngle={Math.PI / 2.05}
            target={[0, 2, 0]}
          />
        </Canvas>
        <Box sx={{ position: 'absolute', bottom: 12, left: 12, backgroundColor: 'rgba(0, 0, 0, 0.6)', color: 'white', px: 1.5, py: 0.75, borderRadius: 1, fontSize: '0.75rem' }}>
          Drag to rotate • Scroll to zoom
        </Box>
      </Box>
    </VenueDesignerProvider>
  );
};
```

**Explanation:**

This component provides a read-only 3D preview of wedding package designs, enabling couples to visualize package templates before selecting them. The implementation fetches package design data from the backend and renders it using the same 3D rendering infrastructure as the interactive venue designer, ensuring visual consistency.

The component uses a minimal context provider that supplies only the necessary data for rendering, with all interaction callbacks set to no-ops. This approach allows reuse of the `PlacedElement` component without enabling editing functionality, reducing code duplication while maintaining separation of concerns.

The data fetching includes comprehensive error handling, displaying loading states and error messages appropriately. The loading state shows a spinner, while errors display a user-friendly message. This provides clear feedback during the asynchronous data loading process.

The 3D scene configuration matches the interactive venue designer, using the same lighting, shadows, and environment settings. This ensures that package previews look identical to the actual designs when couples create projects from packages, preventing confusion from visual differences.

The component disables all interaction capabilities by passing empty functions and `false` values to `PlacedElement` props. Elements cannot be selected, moved, rotated, or deleted, creating a true preview experience. The OrbitControls remain enabled, allowing users to rotate and zoom the view, which is essential for exploring the 3D design.

The context value is memoized to prevent unnecessary re-renders of child components. The dependencies include only the data that affects rendering (packageId, placements, venue), ensuring the context updates only when necessary. This optimization is important because the context is consumed by many child components, and unnecessary updates could cause performance issues.

---

## 5.12 Element Positioning Logic

### 5.12.1 Footprint Radius Calculation

**File:** `src/pages/VenueDesigner/PlacedElement.jsx`  
**Lines:** 147-162

```javascript
const COLLISION_RADIUS_DEFAULT = 0.4;

const getFootprintRadius = (placement) => {
  const metaRadius = parseFloat(placement.metadata?.footprintRadius);
  if (Number.isFinite(metaRadius) && metaRadius > 0) {
    return metaRadius;
  }
  const dims = placement.designElement?.dimensions;
  if (dims) {
    const width = Number(dims.width) || 0;
    const depth = Number(dims.depth) || 0;
    const derived = Math.max(width, depth) / 2;
    if (derived > 0) return derived;
  }
  return COLLISION_RADIUS_DEFAULT;
};
```

**Explanation:**

This function calculates the collision footprint radius for placement elements, which is used for collision detection and boundary enforcement. The implementation provides a flexible hierarchy of radius sources, allowing vendors to specify custom radii while falling back to automatic calculation.

The function first checks for an explicit footprint radius in the placement metadata. This allows vendors to override automatic calculations when needed, such as for irregularly shaped items or items with extended parts (like tablecloths that extend beyond the table edge). The explicit radius takes precedence to ensure vendor intentions are respected.

If no explicit radius is provided, the function derives the radius from the design element's dimensions. It uses the maximum of width and depth, divided by two, to create a circular approximation of the element's footprint. This approach works well for most rectangular items like tables, chairs, and decorations.

The dimension-based calculation handles missing or invalid dimension data gracefully. If width or depth is missing or zero, it falls back to the default radius. This ensures that collision detection always has a valid radius, even for models without dimension information.

The default radius (0.4 units) is chosen to provide reasonable collision detection for typical wedding items. This value prevents most overlaps while allowing items to be placed reasonably close together. The function validates all values to ensure they are finite positive numbers, preventing mathematical errors in collision calculations.

---

### 5.12.2 Stacking Detection and Parent-Child Relationships

**File:** `src/pages/VenueDesigner/PlacedElement.jsx`  
**Lines:** 399-464

```javascript
if (isStackable(placement)) {
   raycaster.setFromCamera(event.pointer, camera);
   
   const intersects = raycaster.intersectObjects(scene.children, true);
   
   let foundValidParent = false;
   for (const hit of intersects) {
     let isSelf = false;
     hit.object.traverseAncestors((a) => {
       if (a === groupRef.current) isSelf = true;
     });
     if (isSelf) continue;

     if (hit.object.userData?.isGround) continue;

     // If we hit a Placement, stack on top
     let isPlacement = false;
     if (hit.object.userData?.isPlacement) isPlacement = true;
     else {
       hit.object.traverseAncestors((a) => {
         if (a.userData?.isPlacement) isPlacement = true;
       });
     }

     if (isPlacement) {
       foundValidParent = true;
       // Get the world bounding box of the hit object (or the specific mesh)
       const box = new THREE.Box3().setFromObject(hit.object);
       // Stack on top
       nextY = box.max.y;
       
       // Find the parent placement ID by traversing up to find the placement group
       let parentGroup = hit.object;
       while (parentGroup && !parentGroup.userData?.placementId) {
         if (!parentGroup.parent) break;
         parentGroup = parentGroup.parent;
       }
      const detectedParentId = parentGroup?.userData?.placementId;
      
      if (detectedParentId && 
          typeof detectedParentId === 'string') {
        const trimmedId = detectedParentId.trim();
        if (trimmedId !== '' && trimmedId !== placement.id) {
          dragStateRef.current.parentElementId = trimmedId;
          console.log('[Parent-Child] Detected parent during drag:', trimmedId, 'for child:', placement.id);
        } else {
          dragStateRef.current.parentElementId = null;
          console.log('[Parent-Child] Self-reference detected, clearing parent');
        }
      } else {
        dragStateRef.current.parentElementId = null;
        console.log('[Parent-Child] No valid parent found, clearing parent');
      }
       break;
     }
   }
   
   if (!foundValidParent) {
     dragStateRef.current.parentElementId = null;
     console.log('[Parent-Child] No placement found (on ground), clearing parent for:', placement.id);
   }
}
```

**Explanation:**

This code implements automatic stacking detection for stackable items, enabling realistic placement scenarios like centerpieces on tables or decorations on surfaces. The implementation uses raycasting to detect what surface an item is being placed on, then positions it on top of that surface and establishes a parent-child relationship.

The raycasting algorithm casts a ray from the camera through the mouse pointer into the 3D scene, finding all intersecting objects. It filters out the element being dragged (to prevent self-detection) and the ground plane (to allow placement on surfaces rather than always stacking). The algorithm traverses ancestor objects to find placement groups, handling complex scene hierarchies where meshes may be nested within groups.

When a valid parent placement is found, the algorithm calculates the vertical position by getting the maximum Y coordinate of the parent's bounding box. This ensures the child element sits on top of the parent, regardless of the parent's geometry. The parent-child relationship is established by storing the parent's placement ID in the drag state, which is later committed to the database.

The parent ID detection traverses up the scene graph to find the placement group, which contains the `placementId` in its `userData`. This approach handles cases where the ray hits a child mesh rather than the placement group directly. The algorithm validates the parent ID to prevent self-references and empty strings, ensuring data integrity.

The stacking detection only activates for stackable items, as determined by the `isStackable` helper function. This function checks metadata, design element properties, and item names to determine if an item can be stacked. This prevents inappropriate stacking scenarios while enabling realistic decoration placement.

When no valid parent is found (the item is being placed on the ground), the parent ID is cleared, ensuring the item is treated as a floor-level element. This maintains correct collision detection and visual rendering for items that are not stacked.

---

## Summary

This documentation covers the complete 3D modeling workflow in the wedding planning platform, from vendor file uploads through venue design creation and editing. Each code snippet includes line numbers for easy reference and detailed explanations of the technical implementation, algorithms, and design decisions.

The system provides a comprehensive 3D modeling solution that enables vendors to upload and manage 3D models, couples to design their wedding venues in 3D space, and the platform to convert 2D floorplans into 3D models. All components work together to create an intuitive, performant, and robust 3D design experience.

Key features covered include:
- File upload and validation (sections 5.1-5.2)
- Scene loading and model preprocessing (section 5.3)
- Interactive dimension editing (section 5.4)
- Floorplan to 3D conversion (section 5.5)
- Scene persistence (section 5.6)
- Element rendering and placement (section 5.7)
- Selection and manipulation (section 5.8)
- Model preview components (section 5.9)
- Collision detection algorithms (section 5.10)
- Package preview functionality (section 5.11)
- Positioning and stacking logic (section 5.12)

