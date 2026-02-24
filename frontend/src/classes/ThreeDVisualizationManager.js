/**
 * ThreeDVisualizationManager
 * --------------------------
 * Responsibilities:
 *   - Setting up Three.js scene, camera, renderer
 *   - Rendering point cloud colored by elevation (Z)
 *   - Rendering extracted contour as a 3D line
 *   - Handling OrbitControls for rotate / zoom / pan
 *   - Cleaning up on unmount
 * Collaborators: InputDataProcessor (points), ContourOptimizer (contour)
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';

export class ThreeDVisualizationManager {
  constructor(canvas) {
    this.canvas   = canvas;
    this.scene    = null;
    this.camera   = null;
    this.renderer = null;
    this.controls = null;
    this.animFrameId = null;

    // Track mesh references so we can remove/replace them
    this._pointsMesh   = null;
    this._contourLines = null;
    this._axesHelper   = null;

    this._init();
  }

  // ── Initialisation ───────────────────────────────────────────────────────

  _init() {
    const w = this.canvas.clientWidth  || this.canvas.width;
    const h = this.canvas.clientHeight || this.canvas.height;

    // Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x020617);  // same dark bg as 2D

    // Camera
    this.camera = new THREE.PerspectiveCamera(60, w / h, 0.01, 100000);
    this.camera.position.set(0, -200, 150);
    this.camera.up.set(0, 0, 1);

    // Renderer
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
    this.renderer.setSize(w, h);
    this.renderer.setPixelRatio(window.devicePixelRatio);

    // Orbit controls
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.screenSpacePanning = true;

    // Ambient light (needed for any MeshBasicMaterial-based items)
    this.scene.add(new THREE.AmbientLight(0xffffff, 1));

    // Start render loop
    this._animate();
  }

  _animate() {
    this.animFrameId = requestAnimationFrame(() => this._animate());
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  /**
   * Map a normalised value (0–1) to a colour gradient:
   * blue (low) → cyan → green → yellow → red (high)
   */
  _elevationColor(t) {
    // 4-stop gradient: blue → cyan → green → yellow → red
    const stops = [
      [0.00, new THREE.Color(0x1e40af)],  // blue
      [0.25, new THREE.Color(0x06b6d4)],  // cyan
      [0.50, new THREE.Color(0x22c55e)],  // green
      [0.75, new THREE.Color(0xfacc15)],  // yellow
      [1.00, new THREE.Color(0xef4444)],  // red
    ];
    let lo = stops[0], hi = stops[stops.length - 1];
    for (let i = 0; i < stops.length - 1; i++) {
      if (t >= stops[i][0] && t <= stops[i + 1][0]) {
        lo = stops[i]; hi = stops[i + 1]; break;
      }
    }
    const alpha = (t - lo[0]) / (hi[0] - lo[0] + 1e-9);
    return lo[1].clone().lerp(hi[1], alpha);
  }

  /** Centre + normalise raw points so the scene is always well-framed. */
  _normalise(points) {
    const xs = points.map(p => p[0]);
    const ys = points.map(p => p[1]);
    const zs = points.map(p => p[2] ?? 0);
    const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
    const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
    const cz = (Math.min(...zs) + Math.max(...zs)) / 2;
    const span = Math.max(
      Math.max(...xs) - Math.min(...xs),
      Math.max(...ys) - Math.min(...ys),
      1
    );
    return { cx, cy, cz, span, minZ: Math.min(...zs), maxZ: Math.max(...zs) };
  }

  // ── Public API ────────────────────────────────────────────────────────────

  /**
   * Render the point cloud.
   * points: array of [x, y, z]  (z can be 0 for 2-D data)
   */
  plotPointCloud(points) {
    // Remove old mesh
    if (this._pointsMesh) {
      this.scene.remove(this._pointsMesh);
      this._pointsMesh.geometry.dispose();
      this._pointsMesh.material.dispose();
      this._pointsMesh = null;
    }
    if (!points || points.length === 0) return;

    const { cx, cy, cz, span, minZ, maxZ } = this._normalise(points);
    const scale = 200 / span;   // fit into a ~200-unit bounding box
    const zRange = maxZ - minZ || 1;

    const positions = new Float32Array(points.length * 3);
    const colors    = new Float32Array(points.length * 3);

    points.forEach((p, i) => {
      positions[i * 3]     = (p[0] - cx) * scale;
      positions[i * 3 + 1] = (p[1] - cy) * scale;
      positions[i * 3 + 2] = ((p[2] ?? 0) - cz) * scale;

      const t = ((p[2] ?? minZ) - minZ) / zRange;
      const c = this._elevationColor(t);
      colors[i * 3]     = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    });

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color',    new THREE.BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
      size: 0.8,
      vertexColors: true,
      sizeAttenuation: true,
    });

    this._pointsMesh = new THREE.Points(geometry, material);
    this._pointsMesh.userData = { cx, cy, cz, scale }; // save for contour use
    this.scene.add(this._pointsMesh);

    // Frame camera
    this.camera.position.set(0, -span * scale * 0.8, span * scale * 0.6);
    this.controls.target.set(0, 0, 0);
    this.controls.update();
  }

  /**
   * Render the extracted contour as a bright line loop.
   * contour: array of [x, y]  (2-D, elevated to average Z)
   * points:  original point array used to infer Z offset
   */
  overlayContour(contour, points) {
    // Remove old contour
    if (this._contourLines) {
      this.scene.remove(this._contourLines);
      this._contourLines.geometry.dispose();
      this._contourLines.material.dispose();
      this._contourLines = null;
    }
    if (!contour || contour.length < 2) return;

    // Reuse transform from the point mesh
    const ud = this._pointsMesh?.userData;
    if (!ud) return;
    const { cx, cy, cz, scale } = ud;

    // Elevation: use the average Z of the point cloud as a flat plane
    const avgZ = points
      ? points.reduce((s, p) => s + (p[2] ?? 0), 0) / points.length
      : 0;

    const pts3D = contour.map(p => new THREE.Vector3(
      (p[0] - cx) * scale,
      (p[1] - cy) * scale,
      (avgZ   - cz) * scale + 1   // +1 so it sits just above the point cloud
    ));

    // Close the loop
    if (!pts3D[0].equals(pts3D[pts3D.length - 1])) {
      pts3D.push(pts3D[0].clone());
    }

    const geometry = new THREE.BufferGeometry().setFromPoints(pts3D);
    const material = new THREE.LineBasicMaterial({
      color: 0xef4444,   // red, matching 2D view
      linewidth: 2,
    });

    this._contourLines = new THREE.Line(geometry, material);
    this.scene.add(this._contourLines);
  }

  /** Full render: points then contour. */
  render(points, contour) {
    this.plotPointCloud(points);
    if (contour && contour.length > 0) {
      this.overlayContour(contour, points);
    }
  }

  /** Call this when the panel is resized. */
  resize() {
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    if (!w || !h) return;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  /** Call this when the component unmounts to avoid memory leaks. */
  dispose() {
    cancelAnimationFrame(this.animFrameId);
    this.controls.dispose();
    this.renderer.dispose();
    if (this._pointsMesh) {
      this._pointsMesh.geometry.dispose();
      this._pointsMesh.material.dispose();
    }
    if (this._contourLines) {
      this._contourLines.geometry.dispose();
      this._contourLines.material.dispose();
    }
  }
}