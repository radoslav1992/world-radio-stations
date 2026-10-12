// Interactive 3D globe that plots radio stations as glowing points.
//
// Land is drawn as a dot matrix sampled from the country raster, so hovering a
// country can light up its dots and clicking it can select it. Stations are a
// single THREE.Points draw call; picking is done on the CPU by projecting the
// (few thousand) points to screen space, which is cheap and pixel-accurate.
import {
  AdditiveBlending,
  BackSide,
  BufferGeometry,
  Color,
  Float32BufferAttribute,
  Matrix4,
  Mesh,
  PerspectiveCamera,
  PlaneGeometry,
  Points,
  Quaternion,
  Raycaster,
  Scene,
  ShaderMaterial,
  Sphere,
  SphereGeometry,
  Vector2,
  Vector3,
  WebGLRenderer,
} from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { Station } from '../store';
import { countryName } from '../countries';
import { placeStations, type Placement } from './positions';
import { countryCode, countryIndex, countryIndexAt, countryMeta, getGrid } from './world';
import { RASTER_H, RASTER_W } from './world-data';

const DEG = Math.PI / 180;
const FOV = 34;
const MIN_DIST = 1.22;
const STATION_R = 1.006;
const LAND_R = 1.002;

const COLORS = {
  oceanDeep: new Color('#06112a'),
  oceanLit: new Color('#123063'),
  oceanRim: new Color('#2a64e8'),
  land: new Color('#4a6fb3'),
  landHover: new Color('#a9c3ff'),
  landSelected: new Color('#7ea6ff'),
  station: new Color('#ffb547'),
  stationHover: new Color('#fff3d6'),
  active: new Color('#ff6b3d'),
  atmosphere: new Color('#3a7bff'),
};

function toVec(lat: number, lng: number, r: number, out = new Vector3()): Vector3 {
  const la = lat * DEG;
  const ln = lng * DEG;
  return out.set(r * Math.cos(la) * Math.sin(ln), r * Math.sin(la), r * Math.cos(la) * Math.cos(ln));
}

function toLatLng(v: Vector3): { lat: number; lng: number } {
  const r = v.length() || 1;
  return { lat: Math.asin(Math.max(-1, Math.min(1, v.y / r))) / DEG, lng: Math.atan2(v.x, v.z) / DEG };
}

const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/** Rough "where is the viewer" guess from the UTC offset, so the globe opens on their side of the world. */
function homeDirection(): { lat: number; lng: number } {
  const lng = -new Date().getTimezoneOffset() / 4;
  return { lat: 28, lng: Math.max(-170, Math.min(170, lng)) };
}

const OCEAN_VERT = /* glsl */ `
  varying vec3 vN;
  varying vec3 vV;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vN = normalize(normalMatrix * normal);
    vV = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`;
const OCEAN_FRAG = /* glsl */ `
  uniform vec3 uDeep;
  uniform vec3 uLit;
  uniform vec3 uRim;
  varying vec3 vN;
  varying vec3 vV;
  void main() {
    float facing = clamp(dot(vN, vV), 0.0, 1.0);
    float light = clamp(dot(vN, normalize(vec3(-0.5, 0.6, 0.65))), 0.0, 1.0);
    vec3 col = mix(uDeep, uLit, 0.15 + 0.85 * light);
    col = mix(col, uRim, pow(1.0 - facing, 2.6) * 0.75);
    gl_FragColor = vec4(col, 1.0);
  }
`;

const ATMO_VERT = OCEAN_VERT;
const ATMO_FRAG = /* glsl */ `
  uniform vec3 uColor;
  varying vec3 vN;
  varying vec3 vV;
  void main() {
    float t = clamp(-dot(vN, vV) / 0.46, 0.0, 1.0);
    float a = pow(t, 2.4) * 0.6;
    gl_FragColor = vec4(uColor * a, a);
  }
`;

const LAND_VERT = /* glsl */ `
  uniform float uScale;
  uniform float uPR;
  uniform float uHover;
  uniform float uSel;
  attribute float aCountry;
  varying float vAlpha;
  varying float vHov;
  varying float vSel;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vec3 n = normalize(normalMatrix * position);
    vAlpha = smoothstep(0.0, 0.45, dot(n, normalize(-mv.xyz)));
    vHov = 1.0 - step(0.5, abs(aCountry - uHover));
    vSel = 1.0 - step(0.5, abs(aCountry - uSel));
    gl_PointSize = clamp(uScale * 0.0062 / -mv.z, 1.4 * uPR, 4.2 * uPR) * (1.0 + vHov * 0.2);
    gl_Position = projectionMatrix * mv;
  }
`;
const LAND_FRAG = /* glsl */ `
  uniform vec3 uColor;
  uniform vec3 uHoverColor;
  uniform vec3 uSelColor;
  varying float vAlpha;
  varying float vHov;
  varying float vSel;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    if (dot(c, c) > 0.25) discard;
    vec3 col = mix(uColor, uSelColor, vSel);
    col = mix(col, uHoverColor, vHov);
    gl_FragColor = vec4(col, vAlpha * mix(0.7, 1.0, max(vHov, vSel)));
  }
`;

const STATION_VERT = /* glsl */ `
  uniform float uScale;
  uniform float uPR;
  uniform float uHover;
  uniform float uActive;
  uniform float uTime;
  attribute float aIndex;
  attribute float aDim;
  varying float vFade;
  varying float vHov;
  varying float vDim;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vec3 n = normalize(normalMatrix * position);
    vFade = smoothstep(-0.02, 0.3, dot(n, normalize(-mv.xyz)));
    vHov = 1.0 - step(0.5, abs(aIndex - uHover));
    vDim = aDim;
    float twinkle = 0.88 + 0.12 * sin(uTime * 1.6 + aIndex * 12.9898);
    float s = mix(1.0, 0.6, aDim) * mix(twinkle, 1.7, vHov);
    float isActive = 1.0 - step(0.5, abs(aIndex - uActive));
    gl_PointSize = clamp(uScale * 0.03 / -mv.z, 9.0 * uPR, 26.0 * uPR) * s * (1.0 - isActive);
    gl_Position = projectionMatrix * mv;
  }
`;
const STATION_FRAG = /* glsl */ `
  uniform vec3 uColor;
  uniform vec3 uHoverColor;
  varying float vFade;
  varying float vHov;
  varying float vDim;
  void main() {
    float d = length(gl_PointCoord - 0.5) * 2.0;
    if (d > 1.0) discard;
    float core = 1.0 - smoothstep(0.2, 0.34, d);
    float halo = exp(-d * d * 5.5) * 0.6 * (1.0 - vDim * 0.75);
    vec3 col = mix(uColor, uHoverColor, vHov);
    col = mix(col, vec3(1.0), core * 0.45);
    float a = (core + halo) * vFade * mix(1.0, 0.3, vDim);
    gl_FragColor = vec4(col, a);
  }
`;

const MARKER_VERT = /* glsl */ `
  uniform float uScale;
  uniform float uPR;
  varying float vFade;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vec3 n = normalize(normalMatrix * position);
    vFade = smoothstep(-0.02, 0.3, dot(n, normalize(-mv.xyz)));
    gl_PointSize = clamp(uScale * 0.05 / -mv.z, 18.0 * uPR, 38.0 * uPR);
    gl_Position = projectionMatrix * mv;
  }
`;
const MARKER_FRAG = /* glsl */ `
  uniform vec3 uColor;
  varying float vFade;
  void main() {
    float d = length(gl_PointCoord - 0.5) * 2.0;
    if (d > 1.0) discard;
    float core = 1.0 - smoothstep(0.16, 0.26, d);
    float halo = exp(-d * d * 4.0) * 0.85;
    vec3 col = mix(uColor, vec3(1.0), core * 0.7);
    gl_FragColor = vec4(col, (core + halo) * vFade);
  }
`;

const RING_VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const RING_FRAG = /* glsl */ `
  uniform float uTime;
  uniform float uPlaying;
  uniform vec3 uColor;
  varying vec2 vUv;
  void main() {
    float r = length(vUv - 0.5) * 2.0;
    if (r > 1.0) discard;
    float a = 0.0;
    if (uPlaying > 0.5) {
      for (int i = 0; i < 3; i++) {
        float t = fract(uTime * 0.45 + float(i) / 3.0);
        float w = 0.035 + 0.04 * t;
        a += (1.0 - smoothstep(0.0, w, abs(r - t))) * (1.0 - t) * smoothstep(0.0, 0.12, t);
      }
    } else {
      a = (1.0 - smoothstep(0.0, 0.05, abs(r - 0.42))) * 0.55;
    }
    gl_FragColor = vec4(uColor, a);
  }
`;

export interface GlobeOptions {
  container: HTMLElement;
  /** Called when a station point is clicked/tapped. */
  onStationClick: (s: Station) => void;
  /** When provided, land is clickable and selects that country. */
  onCountryClick?: (code: string) => void;
  /** Called once the user first drags/zooms the globe (e.g. to hide hints). */
  onInteract?: () => void;
  reducedMotion?: boolean;
}

interface Flight {
  fromDir: Vector3;
  rot: Quaternion;
  fromDist: number;
  toDist: number;
  lift: number;
  start: number;
  dur: number;
}

export class RadioGlobe {
  private opts: GlobeOptions;
  private container: HTMLElement;
  private renderer: WebGLRenderer;
  private scene = new Scene();
  private camera = new PerspectiveCamera(FOV, 1, 0.05, 50);
  private controls: OrbitControls;
  private raycaster = new Raycaster();
  private unitSphere = new Sphere(new Vector3(), 1);
  private viewProj = new Matrix4();

  private landMat: ShaderMaterial;
  private stationMat: ShaderMaterial;
  private stationPoints: Points;
  private markerMat: ShaderMaterial;
  private marker: Points;
  private ringMat: ShaderMaterial;
  private ring: Mesh;

  private stations: Station[] = [];
  private placements: (Placement | null)[] = [];
  /** Point index → station index, and the flat xyz positions used for picking. */
  private pointStation: number[] = [];
  private pointPos = new Float32Array(0);
  private pointDim = new Uint8Array(0);
  private pointById = new Map<string, number>();
  private countByCountry = new Map<string, number>();

  private active: Station | null = null;
  private activePos: Vector3 | null = null;
  private activePlacement: Placement | null = null;
  private hoverPoint = -1;
  private listHoverPoint = -1;
  private selectedCountry = 0;

  private width = 1;
  private height = 1;
  private pointer: { x: number; y: number; type: string } | null = null;
  private pointerDirty = false;
  private down: { x: number; y: number; t: number } | null = null;
  private dragging = false;
  private interacted = false;
  private lastCam = new Vector3();
  private flight: Flight | null = null;
  private inView = true;
  private startTime = performance.now();

  private tip: HTMLElement;
  private tipLogo: HTMLElement;
  private tipTitle: HTMLElement;
  private tipMeta: HTMLElement;
  private tipHint: HTMLElement;
  private tipTimer: ReturnType<typeof setTimeout> | null = null;
  private zoomHint: HTMLElement;
  private zoomHintTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(opts: GlobeOptions) {
    this.opts = opts;
    this.container = opts.container;

    this.renderer = new WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setClearColor(0x000000, 0);
    const canvas = this.renderer.domElement;
    canvas.className = 'globe-canvas';
    canvas.setAttribute('aria-hidden', 'true');
    this.container.appendChild(canvas);

    // Ocean sphere + atmosphere
    const ocean = new Mesh(
      new SphereGeometry(1, 96, 64),
      new ShaderMaterial({
        vertexShader: OCEAN_VERT,
        fragmentShader: OCEAN_FRAG,
        uniforms: {
          uDeep: { value: COLORS.oceanDeep },
          uLit: { value: COLORS.oceanLit },
          uRim: { value: COLORS.oceanRim },
        },
      }),
    );
    ocean.renderOrder = 0;
    this.scene.add(ocean);

    const atmo = new Mesh(
      new SphereGeometry(1.13, 64, 48),
      new ShaderMaterial({
        vertexShader: ATMO_VERT,
        fragmentShader: ATMO_FRAG,
        uniforms: { uColor: { value: COLORS.atmosphere } },
        side: BackSide,
        blending: AdditiveBlending,
        transparent: true,
        depthWrite: false,
      }),
    );
    atmo.renderOrder = 4;
    this.scene.add(atmo);

    // Dotted land
    this.landMat = new ShaderMaterial({
      vertexShader: LAND_VERT,
      fragmentShader: LAND_FRAG,
      uniforms: {
        uScale: { value: 1000 },
        uPR: { value: 1 },
        uHover: { value: -1 },
        uSel: { value: -1 },
        uColor: { value: COLORS.land },
        uHoverColor: { value: COLORS.landHover },
        uSelColor: { value: COLORS.landSelected },
      },
      transparent: true,
      depthWrite: false,
    });
    const land = new Points(this.buildLandGeometry(), this.landMat);
    land.renderOrder = 1;
    this.scene.add(land);

    // Stations
    this.stationMat = new ShaderMaterial({
      vertexShader: STATION_VERT,
      fragmentShader: STATION_FRAG,
      uniforms: {
        uScale: { value: 1000 },
        uPR: { value: 1 },
        uHover: { value: -1 },
        uActive: { value: -1 },
        uTime: { value: 0 },
        uColor: { value: COLORS.station },
        uHoverColor: { value: COLORS.stationHover },
      },
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
    });
    this.stationPoints = new Points(new BufferGeometry(), this.stationMat);
    this.stationPoints.renderOrder = 2;
    this.stationPoints.frustumCulled = false;
    this.scene.add(this.stationPoints);

    // Active station: bright marker + broadcast rings
    this.markerMat = new ShaderMaterial({
      vertexShader: MARKER_VERT,
      fragmentShader: MARKER_FRAG,
      uniforms: { uScale: { value: 1000 }, uPR: { value: 1 }, uColor: { value: COLORS.active } },
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
    });
    const markerGeo = new BufferGeometry();
    markerGeo.setAttribute('position', new Float32BufferAttribute([0, 0, STATION_R], 3));
    this.marker = new Points(markerGeo, this.markerMat);
    this.marker.frustumCulled = false;
    this.marker.renderOrder = 3;
    this.marker.visible = false;
    this.scene.add(this.marker);

    this.ringMat = new ShaderMaterial({
      vertexShader: RING_VERT,
      fragmentShader: RING_FRAG,
      uniforms: { uTime: { value: 0 }, uPlaying: { value: 0 }, uColor: { value: COLORS.active } },
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
    });
    this.ring = new Mesh(new PlaneGeometry(1, 1), this.ringMat);
    this.ring.renderOrder = 3;
    this.ring.visible = false;
    this.scene.add(this.ring);

    // Camera + controls
    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enablePan = false;
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.07;
    this.controls.zoomSpeed = 0.7;
    this.controls.minDistance = MIN_DIST;
    this.controls.minPolarAngle = 0.2;
    this.controls.maxPolarAngle = Math.PI - 0.2;
    this.controls.autoRotate = !opts.reducedMotion;
    this.controls.autoRotateSpeed = -0.35;

    // Tooltip + zoom hint
    this.tip = document.createElement('div');
    this.tip.className = 'globe-tip';
    this.tip.hidden = true;
    this.tipLogo = document.createElement('div');
    this.tipLogo.className = 'globe-tip-logo';
    const tipText = document.createElement('div');
    tipText.className = 'globe-tip-text';
    this.tipTitle = document.createElement('strong');
    this.tipMeta = document.createElement('span');
    this.tipHint = document.createElement('span');
    this.tipHint.className = 'globe-tip-hint';
    tipText.append(this.tipTitle, this.tipMeta, this.tipHint);
    this.tip.append(this.tipLogo, tipText);
    this.container.appendChild(this.tip);

    this.zoomHint = document.createElement('div');
    this.zoomHint.className = 'globe-zoom-hint';
    this.zoomHint.textContent = /Mac|iPhone|iPad/.test(navigator.userAgent) ? 'Use ⌘ + scroll to zoom the globe' : 'Use Ctrl + scroll to zoom the globe';
    this.container.appendChild(this.zoomHint);

    this.resize();
    const home = homeDirection();
    toVec(home.lat, home.lng, this.worldDistance(), this.camera.position);
    this.camera.lookAt(0, 0, 0);
    this.controls.update();

    this.bindEvents(canvas);
    requestAnimationFrame(this.loop);
  }

  // ---------- Public API ----------

  /** Replace the plotted station set. */
  setStations(list: Station[]) {
    this.stations = list;
    this.placements = placeStations(list);
    const pos: number[] = [];
    const idx: number[] = [];
    this.pointStation = [];
    this.pointById.clear();
    this.countByCountry.clear();
    const v = new Vector3();
    list.forEach((s, i) => {
      const p = this.placements[i];
      if (!p) return;
      toVec(p.lat, p.lng, STATION_R, v);
      const point = this.pointStation.length;
      pos.push(v.x, v.y, v.z);
      idx.push(point);
      this.pointStation.push(i);
      this.pointById.set(s.stationuuid, point);
      const cc = (s.countrycode || '').toUpperCase();
      if (cc) this.countByCountry.set(cc, (this.countByCountry.get(cc) || 0) + 1);
    });
    this.pointPos = new Float32Array(pos);
    this.pointDim = new Uint8Array(this.pointStation.length);
    const geo = new BufferGeometry();
    geo.setAttribute('position', new Float32BufferAttribute(this.pointPos, 3));
    geo.setAttribute('aIndex', new Float32BufferAttribute(idx, 1));
    geo.setAttribute('aDim', new Float32BufferAttribute(new Float32Array(idx.length), 1));
    this.stationPoints.geometry.dispose();
    this.stationPoints.geometry = geo;
    this.hoverPoint = -1;
    this.listHoverPoint = -1;
    this.hideTip();
    this.syncHoverUniform();
    if (this.active) this.setActive(this.active);
  }

  /** Dim every station whose id is not in `ids` (null shows everything at full strength). */
  setFilter(ids: Set<string> | null) {
    const attr = this.stationPoints.geometry.getAttribute('aDim');
    if (!attr) return;
    for (let p = 0; p < this.pointStation.length; p++) {
      const s = this.stations[this.pointStation[p]];
      const dim = ids && !ids.has(s.stationuuid) ? 1 : 0;
      this.pointDim[p] = dim;
      attr.setX(p, dim);
    }
    attr.needsUpdate = true;
  }

  /** Mark the current station with a marker and broadcast rings. */
  setActive(s: Station | null) {
    this.active = s;
    if (!s) {
      this.activePos = null;
      this.activePlacement = null;
      this.marker.visible = false;
      this.ring.visible = false;
      this.stationMat.uniforms.uActive.value = -1;
      return;
    }
    const point = this.pointById.get(s.stationuuid);
    const placement = point !== undefined
      ? this.placements[this.pointStation[point]]
      : placeStations([s])[0];
    this.stationMat.uniforms.uActive.value = point ?? -1;
    this.activePlacement = placement;
    if (!placement) {
      this.activePos = null;
      this.marker.visible = false;
      this.ring.visible = false;
      return;
    }
    this.activePos = toVec(placement.lat, placement.lng, STATION_R);
    const attr = this.marker.geometry.getAttribute('position');
    attr.setXYZ(0, this.activePos.x, this.activePos.y, this.activePos.z);
    attr.needsUpdate = true;
    this.marker.visible = true;
    this.ring.position.copy(this.activePos).multiplyScalar(1.0015);
    this.ring.lookAt(this.activePos.clone().multiplyScalar(2));
    this.ring.visible = true;
  }

  setPlaying(playing: boolean) {
    this.ringMat.uniforms.uPlaying.value = playing ? 1 : 0;
    if (playing) this.controls.autoRotate = false;
  }

  /** Highlight a station from outside (e.g. hovering it in the list). */
  setListHover(id: string | null) {
    this.listHoverPoint = id ? this.pointById.get(id) ?? -1 : -1;
    this.syncHoverUniform();
  }

  setSelectedCountry(code: string | null) {
    this.selectedCountry = Math.max(0, countryIndex(code));
    this.landMat.uniforms.uSel.value = this.selectedCountry || -1;
  }

  /** Fly to a country, zooming according to its size. */
  focusCountry(code: string, animate = true) {
    const idx = countryIndex(code);
    const meta = countryMeta(idx);
    let lat: number, lng: number, area: number;
    if (meta) {
      ({ lat, lng, area } = meta);
    } else {
      const c = this.centerOf((s) => (s.countrycode || '').toUpperCase() === code.toUpperCase());
      if (!c) return;
      ({ lat, lng } = c);
      area = 1;
    }
    const radius = Math.sqrt(area / 1e4 / Math.PI);
    const dist = Math.min(this.worldDistance() * 0.85, Math.max(1.6, 1.5 + radius * 7));
    this.stopAutoRotate();
    this.flyTo(lat, lng, dist, animate ? 1500 : 0);
  }

  /** Turn the globe towards a station; `zoom` also moves in to a regional view (deep links). */
  focusStation(s: Station, opts: { zoom?: boolean } = {}) {
    const point = this.pointById.get(s.stationuuid);
    const placement = point !== undefined ? this.placements[this.pointStation[point]] : placeStations([s])[0];
    if (!placement) return;
    const target = toVec(placement.lat, placement.lng, 1);
    const camDir = this.camera.position.clone().normalize();
    const current = this.camera.position.length();
    const dist = opts.zoom ? Math.min(current, 2.4) : Math.min(current, this.worldDistance());
    // Already roughly centred: don't make the globe jump.
    if (camDir.angleTo(target) < 0.35 * (current - 1) / 2 && Math.abs(dist - current) < 0.05) return;
    this.stopAutoRotate();
    this.flyTo(placement.lat, placement.lng, dist, 1300);
  }

  /** Zoom out to show the whole planet, centred on the plotted stations or the viewer's region. */
  focusWorld(opts: { centerOnStations?: boolean; animate?: boolean } = {}) {
    let dir = opts.centerOnStations ? this.centerOf(() => true, 0.35) : null;
    if (!dir) {
      const cur = toLatLng(this.camera.position);
      dir = this.flight || this.interacted ? { lat: Math.max(-30, Math.min(45, cur.lat)), lng: cur.lng } : homeDirection();
    }
    this.flyTo(Math.max(-30, Math.min(40, dir.lat)), dir.lng, this.worldDistance(), opts.animate === false ? 0 : 1400);
  }

  zoom(factor: number) {
    const dist = Math.max(MIN_DIST, Math.min(this.controls.maxDistance, this.camera.position.length() * factor));
    const { lat, lng } = toLatLng(this.camera.position);
    this.stopAutoRotate();
    this.flyTo(lat, lng, dist, 450);
  }

  stopAutoRotate() {
    this.controls.autoRotate = false;
  }

  // ---------- Internals ----------

  private buildLandGeometry(): BufferGeometry {
    const grid = getGrid();
    const pos: number[] = [];
    const country: number[] = [];
    const rows = 260;
    const v = new Vector3();
    for (let r = 0; r < rows; r++) {
      const lat = -90 + ((r + 0.5) / rows) * 180;
      const n = Math.max(1, Math.round(rows * 2 * Math.cos(lat * DEG)));
      for (let i = 0; i < n; i++) {
        const lng = -180 + ((i + 0.5) / n) * 360;
        const col = Math.min(RASTER_W - 1, Math.floor(((lng + 180) / 360) * RASTER_W));
        const row = Math.min(RASTER_H - 1, Math.floor(((90 - lat) / 180) * RASTER_H));
        const c = grid[row * RASTER_W + col];
        if (!c) continue;
        toVec(lat, lng, LAND_R, v);
        pos.push(v.x, v.y, v.z);
        country.push(c);
      }
    }
    const geo = new BufferGeometry();
    geo.setAttribute('position', new Float32BufferAttribute(pos, 3));
    geo.setAttribute('aCountry', new Float32BufferAttribute(country, 1));
    return geo;
  }

  /** Mean direction of stations matching `pred`; null when they're too spread out to have a centre. */
  private centerOf(pred: (s: Station) => boolean, minConcentration = 0): { lat: number; lng: number } | null {
    const sum = new Vector3();
    const v = new Vector3();
    let n = 0;
    this.placements.forEach((p, i) => {
      if (!p || !pred(this.stations[i])) return;
      sum.add(toVec(p.lat, p.lng, 1, v));
      n++;
    });
    if (!n || sum.length() / n < Math.max(minConcentration, 1e-3)) return null;
    const c = toLatLng(sum);
    return { lat: Math.max(-55, Math.min(65, c.lat)), lng: c.lng };
  }

  private worldDistance(): number {
    const vFov = FOV * DEG;
    const hFov = 2 * Math.atan(Math.tan(vFov / 2) * this.camera.aspect);
    const half = Math.min(vFov, hFov) / 2;
    return Math.min(9, 1.17 / Math.sin(half));
  }

  private flyTo(lat: number, lng: number, dist: number, ms: number) {
    const clampedLat = Math.max(-70, Math.min(70, lat));
    const fromDir = this.camera.position.clone().normalize();
    const toDir = toVec(clampedLat, lng, 1);
    const fromDist = this.camera.position.length();
    if (ms <= 0 || this.opts.reducedMotion) {
      this.flight = null;
      this.camera.position.copy(toDir.multiplyScalar(dist));
      this.camera.lookAt(0, 0, 0);
      this.controls.update();
      return;
    }
    const angle = fromDir.angleTo(toDir);
    this.flight = {
      fromDir,
      rot: new Quaternion().setFromUnitVectors(fromDir, toDir),
      fromDist,
      toDist: dist,
      lift: angle > 0.5 ? Math.min(0.9, angle * 0.32) : 0,
      start: performance.now(),
      dur: ms * (0.7 + Math.min(1, angle / Math.PI) * 0.5),
    };
    this.controls.enabled = false;
  }

  private stepFlight(now: number) {
    const f = this.flight!;
    const t = Math.min(1, (now - f.start) / f.dur);
    const e = easeInOut(t);
    const q = new Quaternion().slerpQuaternions(new Quaternion(), f.rot, e);
    const dir = f.fromDir.clone().applyQuaternion(q);
    const dist = f.fromDist + (f.toDist - f.fromDist) * e + Math.sin(Math.PI * e) * f.lift;
    this.camera.position.copy(dir.multiplyScalar(dist));
    this.camera.lookAt(0, 0, 0);
    if (t >= 1) {
      this.flight = null;
      this.controls.enabled = true;
      this.controls.update();
    }
  }

  private cancelFlight() {
    if (!this.flight) return;
    this.flight = null;
    this.controls.enabled = true;
    this.controls.update();
  }

  private resize() {
    const rect = this.container.getBoundingClientRect();
    const w = Math.max(1, Math.round(rect.width));
    const h = Math.max(1, Math.round(rect.height));
    if (w === this.width && h === this.height) return;
    const prevWorld = this.worldDistance();
    this.width = w;
    this.height = h;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    const pr = this.renderer.getPixelRatio();
    const scale = (h * pr) / (2 * Math.tan((FOV * DEG) / 2));
    for (const m of [this.landMat, this.stationMat, this.markerMat]) {
      m.uniforms.uScale.value = scale;
      m.uniforms.uPR.value = pr;
    }
    const world = this.worldDistance();
    this.controls.maxDistance = world * 1.3;
    // Keep a "whole planet" view whole when the layout changes size.
    const d = this.camera.position.length();
    if (d > 0 && Math.abs(d - prevWorld) < 0.05) this.camera.position.setLength(world);
  }

  private bindEvents(canvas: HTMLCanvasElement) {
    new ResizeObserver(() => this.resize()).observe(this.container);
    new IntersectionObserver((entries) => {
      for (const e of entries) this.inView = e.isIntersecting;
    }).observe(this.container);

    // Plain wheel scrolls the page; Ctrl/⌘ + wheel (and trackpad pinch) zooms.
    this.container.addEventListener('wheel', (e) => {
      if (e.ctrlKey || e.metaKey) {
        this.cancelFlight();
        this.markInteracted();
        return;
      }
      e.stopPropagation();
      this.zoomHint.classList.add('visible');
      if (this.zoomHintTimer) clearTimeout(this.zoomHintTimer);
      this.zoomHintTimer = setTimeout(() => this.zoomHint.classList.remove('visible'), 1400);
    }, { capture: true, passive: true });

    canvas.addEventListener('pointerdown', (e) => {
      this.down = { x: e.offsetX, y: e.offsetY, t: performance.now() };
      this.cancelFlight();
      this.stopAutoRotate();
    });
    canvas.addEventListener('pointermove', (e) => {
      if (this.down && Math.hypot(e.offsetX - this.down.x, e.offsetY - this.down.y) > 5 && !this.dragging) {
        this.dragging = true;
        this.markInteracted();
        this.hideTip();
        canvas.style.cursor = 'grabbing';
      }
      this.pointer = { x: e.offsetX, y: e.offsetY, type: e.pointerType };
      this.pointerDirty = true;
    });
    const endDrag = (e: PointerEvent) => {
      const d = this.down;
      this.down = null;
      const wasDrag = this.dragging;
      this.dragging = false;
      canvas.style.cursor = '';
      if (!d || wasDrag || e.type !== 'pointerup') return;
      if (performance.now() - d.t > 600) return;
      this.handleTap(e.offsetX, e.offsetY, e.pointerType);
    };
    canvas.addEventListener('pointerup', endDrag);
    canvas.addEventListener('pointercancel', endDrag);
    canvas.addEventListener('pointerleave', () => {
      if (this.dragging) return;
      this.pointer = null;
      this.setPointerHover(-1, 0);
      if (!this.tipTimer) this.hideTip();
    });
  }

  private markInteracted() {
    if (this.interacted) return;
    this.interacted = true;
    this.opts.onInteract?.();
  }

  private handleTap(x: number, y: number, pointerType: string) {
    const touch = pointerType === 'touch';
    const hit = this.pickStation(x, y, touch ? 24 : 14);
    if (hit.marker && this.active) {
      if (touch) this.flashStationTip(this.active, this.activePlacement, x, y, true);
      return;
    }
    if (hit.point >= 0) {
      const s = this.stations[this.pointStation[hit.point]];
      if (touch) this.flashStationTip(s, this.placements[this.pointStation[hit.point]], x, y, true);
      this.opts.onStationClick(s);
      return;
    }
    const c = this.pickCountry(x, y);
    if (c && this.opts.onCountryClick) {
      this.opts.onCountryClick(countryCode(c));
    } else if (c && touch) {
      this.showCountryTip(c, x, y);
      this.tipTimer = setTimeout(() => { this.tipTimer = null; this.hideTip(); }, 2000);
    }
  }

  private updateViewProj() {
    this.camera.updateMatrixWorld();
    this.viewProj.multiplyMatrices(this.camera.projectionMatrix, this.camera.matrixWorldInverse);
  }

  private project(x: number, y: number, z: number): [number, number] | null {
    const c = this.camera.position;
    // Visible only on the camera-facing side of the sphere: C·P > |P|².
    if (c.x * x + c.y * y + c.z * z <= x * x + y * y + z * z + 0.004) return null;
    const e = this.viewProj.elements;
    const w = e[3] * x + e[7] * y + e[11] * z + e[15];
    const sx = ((e[0] * x + e[4] * y + e[8] * z + e[12]) / w * 0.5 + 0.5) * this.width;
    const sy = (0.5 - (e[1] * x + e[5] * y + e[9] * z + e[13]) / w * 0.5) * this.height;
    return [sx, sy];
  }

  private pickStation(px: number, py: number, radius: number): { point: number; marker: boolean } {
    this.updateViewProj();
    let best = -1;
    let bestD = radius * radius;
    const pos = this.pointPos;
    for (let p = 0; p < this.pointStation.length; p++) {
      const s = this.project(pos[p * 3], pos[p * 3 + 1], pos[p * 3 + 2]);
      if (!s) continue;
      let d = (s[0] - px) ** 2 + (s[1] - py) ** 2;
      if (this.pointDim[p]) d *= 3;
      if (d < bestD) { bestD = d; best = p; }
    }
    if (this.activePos && this.marker.visible) {
      const s = this.project(this.activePos.x, this.activePos.y, this.activePos.z);
      if (s && (s[0] - px) ** 2 + (s[1] - py) ** 2 <= Math.min(bestD, radius * radius) * 1.2) {
        return { point: -1, marker: true };
      }
    }
    return { point: best, marker: false };
  }

  private pickCountry(px: number, py: number): number {
    const ndc = new Vector2((px / this.width) * 2 - 1, -(py / this.height) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
    const hit = this.raycaster.ray.intersectSphere(this.unitSphere, new Vector3());
    if (!hit) return 0;
    const { lat, lng } = toLatLng(hit);
    return countryIndexAt(lat, lng);
  }

  private updatePointerHover() {
    const p = this.pointer;
    if (!p || this.dragging || p.type === 'touch') return;
    const hit = this.pickStation(p.x, p.y, 14);
    if (hit.marker && this.active) {
      this.setPointerHover(-1, 0);
      this.showStationTip(this.active, this.activePlacement, p.x, p.y, true);
      return;
    }
    if (hit.point >= 0) {
      this.setPointerHover(hit.point, 0);
      const i = this.pointStation[hit.point];
      this.showStationTip(this.stations[i], this.placements[i], p.x, p.y, false);
      return;
    }
    const c = this.pickCountry(p.x, p.y);
    this.setPointerHover(-1, c);
    if (c) this.showCountryTip(c, p.x, p.y);
    else this.hideTip();
  }

  private setPointerHover(point: number, country: number) {
    this.hoverPoint = point;
    this.landMat.uniforms.uHover.value = country || -1;
    this.syncHoverUniform();
    const clickable = point >= 0 || (country > 0 && !!this.opts.onCountryClick && country !== this.selectedCountry);
    this.renderer.domElement.style.cursor = this.dragging ? 'grabbing' : clickable ? 'pointer' : '';
  }

  private syncHoverUniform() {
    this.stationMat.uniforms.uHover.value = this.hoverPoint >= 0 ? this.hoverPoint : this.listHoverPoint;
  }

  private showStationTip(s: Station, placement: Placement | null, x: number, y: number, isActive: boolean) {
    this.tipLogo.textContent = '';
    const initial = (s.name || '?').trim().charAt(0).toUpperCase();
    if (s.favicon && s.favicon.startsWith('https://')) {
      const img = document.createElement('img');
      img.alt = '';
      img.referrerPolicy = 'no-referrer';
      img.src = s.favicon;
      img.onerror = () => { this.tipLogo.textContent = initial; };
      this.tipLogo.appendChild(img);
    } else {
      this.tipLogo.textContent = initial;
    }
    this.tipLogo.hidden = false;
    this.tipTitle.textContent = s.name;
    const tag = (s.tags || '').split(',')[0]?.trim();
    const parts = [countryName(s.countrycode) || s.country, tag].filter(Boolean);
    this.tipMeta.textContent = parts.join(' · ') + (placement?.approx ? ' · approx. location' : '');
    this.tipHint.textContent = isActive ? 'Now playing' : 'Click to play';
    this.placeTip(x, y);
  }

  private flashStationTip(s: Station, placement: Placement | null, x: number, y: number, isActive: boolean) {
    this.showStationTip(s, placement, x, y, isActive);
    this.tipHint.textContent = 'Now playing';
    if (this.tipTimer) clearTimeout(this.tipTimer);
    this.tipTimer = setTimeout(() => { this.tipTimer = null; this.hideTip(); }, 2200);
  }

  private showCountryTip(index: number, x: number, y: number) {
    const code = countryCode(index);
    const n = this.countByCountry.get(code) || 0;
    this.tipLogo.hidden = true;
    this.tipTitle.textContent = countryName(code);
    this.tipMeta.textContent = n ? `${n.toLocaleString('en')} station${n === 1 ? '' : 's'} on the map` : '';
    this.tipHint.textContent = this.opts.onCountryClick && index !== this.selectedCountry ? 'Click to tune in' : '';
    this.placeTip(x, y);
  }

  private placeTip(x: number, y: number) {
    this.tip.hidden = false;
    const tw = this.tip.offsetWidth;
    const th = this.tip.offsetHeight;
    let left = x + 16;
    let top = y + 16;
    if (left + tw > this.width - 8) left = Math.max(8, x - tw - 16);
    if (top + th > this.height - 8) top = Math.max(8, y - th - 16);
    this.tip.style.transform = `translate(${Math.round(left)}px, ${Math.round(top)}px)`;
  }

  private hideTip() {
    this.tip.hidden = true;
  }

  private loop = (now: number) => {
    requestAnimationFrame(this.loop);
    if (!this.inView || document.hidden) return;

    if (this.flight) this.stepFlight(now);
    else this.controls.update();

    const dist = this.camera.position.length();
    this.controls.rotateSpeed = 0.18 + (dist - 1) * 0.22;

    const t = (now - this.startTime) / 1000;
    this.stationMat.uniforms.uTime.value = t;
    this.ringMat.uniforms.uTime.value = t;
    if (this.ring.visible) this.ring.scale.setScalar(0.045 * dist);

    // Re-pick when the pointer moved or the globe turned under a still pointer.
    const camMoved = this.lastCam.distanceToSquared(this.camera.position) > 1e-8;
    if (this.pointer && (this.pointerDirty || camMoved)) {
      this.pointerDirty = false;
      this.updatePointerHover();
    }
    this.lastCam.copy(this.camera.position);

    this.renderer.render(this.scene, this.camera);
  };
}
