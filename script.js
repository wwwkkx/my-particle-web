let scene, camera, renderer, particles;
let leftArrow, rightArrow;
let raycaster = new THREE.Raycaster();
let mouse = new THREE.Vector2();
let currentShape = 'scatter';
let currentTheme = 'christmas'; // 'christmas' | 'pluto'
let isAnimating = false;
let isColorAnimating = false;
let currentColorTween = null;
let currentCameraTween = null;
let currentMorphTween = null;
let themeBeforeSolar = 'christmas';
let appStarted = false;

const themeNames = {
    sun: '太阳', mercury: '水星', venus: '金星', earth: '地球', mars: '火星',
    jupiter: '木星', saturn: '土星', uranus: '天王星', neptune: '海王星',
    pluto: '冥王星', christmas: '圣诞树', black_hole: '卡冈图亚'
};

function shapeForTheme(theme = currentTheme) {
    return theme === 'christmas' ? 'tree' : theme;
}
const PARTICLE_COUNT = 15000; 
const STAR_PARTICLE_COUNT = 500; 
const TREE_PARTICLE_COUNT = PARTICLE_COUNT - STAR_PARTICLE_COUNT;
const treePos = [], scatterPos = [], plutoPos = [], uranusPos = [], sunPos = [], mercuryPos = [];
const marsPos = [], earthPos = [], saturnPos = [], jupiterPos = [], neptunePos = [], solarSystemPos = [], venusPos = [], blackHolePos = [];
const christmasColors = new Float32Array(PARTICLE_COUNT * 3);
const plutoColors = new Float32Array(PARTICLE_COUNT * 3);
const uranusColors = new Float32Array(PARTICLE_COUNT * 3);
const sunColors = new Float32Array(PARTICLE_COUNT * 3);
const mercuryColors = new Float32Array(PARTICLE_COUNT * 3);
const venusColors = new Float32Array(PARTICLE_COUNT * 3);
const marsColors = new Float32Array(PARTICLE_COUNT * 3);
const earthColors = new Float32Array(PARTICLE_COUNT * 3);
const saturnColors = new Float32Array(PARTICLE_COUNT * 3);
const jupiterColors = new Float32Array(PARTICLE_COUNT * 3);
const neptuneColors = new Float32Array(PARTICLE_COUNT * 3);
const solarSystemColors = new Float32Array(PARTICLE_COUNT * 3);
const blackHoleColors = new Float32Array(PARTICLE_COUNT * 3);

const solarSystemPlanets = [
    { name: 'sun', pos: new THREE.Vector3(0,0,0), r: 2.8 }, 
    { name: 'mercury', pos: new THREE.Vector3(4,0,0), r: 0.8 }, 
    { name: 'venus', pos: new THREE.Vector3(6 * Math.cos(Math.PI/4), 0, 6 * Math.sin(Math.PI/4)), r: 1.0 }, 
    { name: 'earth', pos: new THREE.Vector3(8 * Math.cos(Math.PI/2), 0, 8 * Math.sin(Math.PI/2)), r: 1.0 }, 
    { name: 'mars', pos: new THREE.Vector3(10 * Math.cos(3*Math.PI/4), 0, 10 * Math.sin(3*Math.PI/4)), r: 0.8 }, 
    { name: 'jupiter', pos: new THREE.Vector3(14 * Math.cos(Math.PI), 0, 14 * Math.sin(Math.PI)), r: 2.2 }, 
    { name: 'saturn', pos: new THREE.Vector3(18 * Math.cos(5*Math.PI/4), 0, 18 * Math.sin(5*Math.PI/4)), r: 3.5 }, 
    { name: 'uranus', pos: new THREE.Vector3(22 * Math.cos(3*Math.PI/2), 0, 22 * Math.sin(3*Math.PI/2)), r: 1.2 }, 
    { name: 'neptune', pos: new THREE.Vector3(26 * Math.cos(7*Math.PI/4), 0, 26 * Math.sin(7*Math.PI/4)), r: 1.2 }, 
    { name: 'pluto', pos: new THREE.Vector3(30 * Math.cos(0.5), 0, 30 * Math.sin(0.5)), r: 1.5 }, 
    { name: 'christmas', pos: new THREE.Vector3(-10, 6, -3), r: 2.5 } 
];

function getIntersectedPlanet(normalizedMouse) {
    if (currentShape !== 'solar_system' || isAnimating || !particles) return null;
    particles.updateMatrixWorld(true);
    camera.updateMatrixWorld(true);
    
    raycaster.setFromCamera(normalizedMouse, camera);
    
    let closestDist = Infinity;
    let selectedPlanet = null;
    
    // Transform ray to local space of particles to account for rotation
    const inverseMatrix = new THREE.Matrix4();
    inverseMatrix.copy(particles.matrixWorld).invert();
    
    const rayOrigin = raycaster.ray.origin.clone().applyMatrix4(inverseMatrix);
    const rayDir = raycaster.ray.direction.clone().transformDirection(inverseMatrix).normalize();
    
    for (let p of solarSystemPlanets) {
        const L = new THREE.Vector3().subVectors(p.pos, rayOrigin);
        const tca = L.dot(rayDir);
        
        const d2 = L.dot(L) - tca * tca;
        const radius2 = p.r * p.r;
        
        if (d2 > radius2) continue;
        
        const thc = Math.sqrt(radius2 - d2);
        const t0 = tca - thc;
        const t1 = tca + thc;
        
        let t = t0;
        if (t < 0) t = t1;
        
        if (t < 0) continue;
        
        if (t < closestDist) {
            closestDist = t;
            selectedPlanet = p.name;
        }
    }
    
    return selectedPlanet;
}

// --- Utilities ---
function randomRange(min, max) {
    return Math.random() * (max - min) + min;
}

// Point inside star logic
function isInsideStar(x, y, outerRadius, innerRadius) {
    // Convert to polar coordinates
    const angle = Math.atan2(y, x) + Math.PI / 2; // Rotate to point up
    const r = Math.sqrt(x * x + y * y);
    
    // Star boundary function
    // 5 points means periodicity of 2*PI / 5
    // The radius varies between innerRadius and outerRadius
    // Formula for n-pointed star radius at angle theta:
    // R(theta) = r_inner * r_outer / (r_inner * |cos(n/2 * theta)| + r_outer * |sin(n/2 * theta)|) ... approximate?
    // Let's use a simpler polygon winding or angle check.
    
    // Actually, simpler geometric approach for random sampling:
    // A 5-pointed star is a central pentagon + 5 triangles.
    // Or just check against the 10 edges.
    
    // Let's use a parametric approach to generate points ON the star, then add noise to fill?
    // Or Rejection Sampling:
    // 1. Generate random point in bounding box [-R, R] x [-R, R]
    // 2. Check if inside star.
    
    // Check algorithm:
    // Vertices of the star:
    // 10 points. Even indices are outer, odd are inner.
    const n = 5;
    // We can map the angle to a segment [0, 2PI/5]
    let a = angle;
    const sector = Math.PI * 2 / n;
    
    // Normalize angle to [-sector/2, sector/2]
    while(a < -Math.PI) a += Math.PI * 2;
    while(a > Math.PI) a -= Math.PI * 2;
    
    // Rotate so we are looking at one point up.
    // Actually, let's just use the known "distance to star boundary" function.
    // r_max at k*sector. r_min at (k+0.5)*sector.
    
    // Local angle in sector [0, 2PI/5]
    // We want the pattern to repeat 5 times.
    let theta = Math.abs((angle % sector) - sector/2); // 0 to sector/2
    
    // Now we have a triangle formed by (0,0), OuterPoint (at angle 0 in this frame), InnerPoint (at angle sector/2)
    // Actually it's simpler:
    // The boundary line connects (0, innerRadius) and (outerRadius * sin(sector/2), outerRadius * cos(sector/2)) ?? No.
    
    // Let's use a simpler approach: Rejection sampling with a robust check.
    // Or just combine 5 triangles and a pentagon.
    return true; // Placeholder if we don't implement full check, but let's implement a simple generator instead.
}

function getStarPoint(outerRadius, innerRadius) {
    // Generates a random point inside a 5-pointed star
    let x, y, r, a;
    while(true) {
        x = randomRange(-outerRadius, outerRadius);
        y = randomRange(-outerRadius, outerRadius);
        
        // Polar
        a = Math.atan2(y, x) + Math.PI / 2; // Shift so 0 is up
        r = Math.sqrt(x*x + y*y);
        
        // 5-fold symmetry
        const n = 5;
        const sector = Math.PI * 2 / n;
        // Normalize angle to [0, sector]
        let localA = a % sector;
        if (localA < 0) localA += sector;
        // Further fold to [0, sector/2] because symmetric
        if (localA > sector / 2) localA = sector - localA;
        
        // Now we are in a triangle bounded by angle 0 (outer tip direction) and angle sector/2 (inner valley)
        // The boundary is the line segment connecting:
        // P1: (0, outerRadius) ? No, in local coords:
        // Angle 0 corresponds to the Outer Vertex. Distance is outerRadius.
        // Angle sector/2 corresponds to Inner Vertex. Distance is innerRadius.
        
        // Polar equation of a line passing through (r1, 0) and (r2, alpha):
        // r(theta) = (r1*r2*sin(alpha)) / (r1*sin(alpha-theta) + r2*sin(theta))
        
        // Here:
        // Theta goes from 0 to sector/2
        // r(0) = outerRadius
        // r(sector/2) = innerRadius
        // Line connects (outerRadius, 0) and (innerRadius, sector/2) in polar
        
        const alpha = sector / 2;
        const maxR = (outerRadius * innerRadius * Math.sin(alpha)) / 
                     (outerRadius * Math.sin(alpha - localA) + innerRadius * Math.sin(localA));
                     
        if (r <= maxR) {
            return { x, y };
        }
    }
}


// --- Textures ---
function createParticleTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 32; canvas.height = 32;
    const ctx = canvas.getContext('2d');
    const gradient = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
    gradient.addColorStop(0, 'rgba(255,255,255,1)');
    gradient.addColorStop(0.2, 'rgba(255,255,255,0.8)');
    gradient.addColorStop(0.5, 'rgba(255,255,255,0.2)');
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 32, 32);
    return new THREE.CanvasTexture(canvas);
}

function createStarTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 64; canvas.height = 64;
    const ctx = canvas.getContext('2d');
    const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0, 'rgba(255,255,220,1)');
    gradient.addColorStop(0.4, 'rgba(255,215,0,0.6)');
    gradient.addColorStop(1, 'rgba(255,215,0,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(canvas);
}

function initThree() {
    scene = new THREE.Scene();
    // Darker, bluish-black background for contrast
    scene.fog = new THREE.FogExp2(0x050505, 0.05);

    camera = new THREE.PerspectiveCamera(75, window.innerWidth/window.innerHeight, 0.01, 1000);
    camera.position.z = 12;
    camera.position.y = 2;
    camera.lookAt(0, 0, 0);

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    document.body.appendChild(renderer.domElement);

    setupPointerControls(renderer.domElement);

    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(PARTICLE_COUNT * 3);
    const colors = new Float32Array(PARTICLE_COUNT * 3);
    const color = new THREE.Color();

    // Christmas Palette
    const christmasPalette = [
        { c: 0x2ed573, w: 0.6 }, // Green
        { c: 0xff4757, w: 0.1 }, // Red
        { c: 0xffa502, w: 0.1 }, // Gold
        { c: 0xffffff, w: 0.2 }  // White
    ];

    // Pluto Palette
    const plutoPalette = [
        { c: 0x8B7355, w: 0.4 }, // BurlyWood
        { c: 0xA9A9A9, w: 0.3 }, // DarkGray
        { c: 0xD2B48C, w: 0.2 }, // Tan
        { c: 0xFFFFFF, w: 0.1 }  // White
    ];

    // Uranus Palette (Blue/White/Gray)
    const uranusPalette = [
        { c: 0xAFEEEE, w: 0.5 }, // PaleTurquoise
        { c: 0x00CED1, w: 0.2 }, // DarkTurquoise
        { c: 0xF0F8FF, w: 0.2 }, // AliceBlue
        { c: 0x708090, w: 0.1 }  // SlateGray
    ];

    // Sun Palette (Red/Orange/Yellow)
    const sunPalette = [
        { c: 0xFF4500, w: 0.3 }, // OrangeRed
        { c: 0xFFA500, w: 0.3 }, // Orange
        { c: 0xFFD700, w: 0.2 }, // Gold
        { c: 0xFFFF00, w: 0.2 }  // Yellow
    ];

    // Mercury Palette (Gray/Brown)
    const mercuryPalette = [
        { c: 0xA9A9A9, w: 0.4 }, // DarkGray
        { c: 0x808080, w: 0.3 }, // Gray
        { c: 0x696969, w: 0.2 }, // DimGray
        { c: 0xD3D3D3, w: 0.1 }  // LightGray
    ];

    // Venus Palette (Yellow/White/Golden)
    const venusPalette = [
        { c: 0xEEDD82, w: 0.4 }, // LightGoldenrod
        { c: 0xFFFACD, w: 0.3 }, // LemonChiffon
        { c: 0xF0E68C, w: 0.2 }, // Khaki
        { c: 0xFFFFFF, w: 0.1 }  // White
    ];

    // Mars Palette (Red/Orange)
    const marsPalette = [
        { c: 0xC1440E, w: 0.5 }, // Rust
        { c: 0xE77D11, w: 0.3 }, // Orange
        { c: 0x8B0000, w: 0.2 }, // DarkRed
    ];

    // Earth Palette (Blue/Green/White)
    const earthPalette = [
        { c: 0x1E90FF, w: 0.5 }, // DodgerBlue (Ocean)
        { c: 0x228B22, w: 0.25 }, // ForestGreen (Land)
        { c: 0xFFFFFF, w: 0.25 }  // White (Clouds)
    ];

    // Saturn Palette (Gold/Beige)
    const saturnPalette = [
        { c: 0xF4C542, w: 0.4 }, // Gold
        { c: 0xE6DBAC, w: 0.3 }, // Beige
        { c: 0xA0522D, w: 0.1 }, // Sienna
        { c: 0x808080, w: 0.2 }  // Grey
    ];

    // Jupiter Palette (Banded Brown/Orange)
    const jupiterPalette = [
        { c: 0xC88B3A, w: 0.3 }, // Peru
        { c: 0xF5DEB3, w: 0.3 }, // Wheat
        { c: 0x8B4513, w: 0.2 }, // SaddleBrown
        { c: 0xFFFFFF, w: 0.2 }  // White
    ];

    // Neptune Palette (Deep Blue)
    const neptunePalette = [
        { c: 0x00008B, w: 0.4 }, // DarkBlue
        { c: 0x4169E1, w: 0.4 }, // RoyalBlue
        { c: 0x00FFFF, w: 0.2 }  // Cyan
    ];

    // Black Hole Palette (Gargantua)
    const blackHolePalette = [
        { c: 0x000000, w: 0.6 }, // Black (Event Horizon)
        { c: 0xFF4500, w: 0.2 }, // OrangeRed (Accretion Disk Hot)
        { c: 0xFFA500, w: 0.1 }, // Orange
        { c: 0xFFFFFF, w: 0.1 }  // White (Core Ring)
    ];

    function getRandomColor(palette) {
        const r = Math.random();
        let sum = 0;
        for(let p of palette) {
            sum += p.w;
            if(r < sum) return p.c;
        }
        return palette[0].c;
    }

    for (let i = 0; i < PARTICLE_COUNT; i++) {
        // 1. Scatter Positions
        const r = randomRange(5, 15);
        const theta = randomRange(0, Math.PI * 2);
        const phi = randomRange(0, Math.PI);
        
        const sx = r * Math.sin(phi) * Math.cos(theta);
        const sy = r * Math.sin(phi) * Math.sin(theta);
        const sz = r * Math.cos(phi);
        
        scatterPos.push(sx, sy, sz);
        positions[i*3] = sx; positions[i*3+1] = sy; positions[i*3+2] = sz;

        // 2. Tree Positions
        if (i < TREE_PARTICLE_COUNT) {
            const h = (i / TREE_PARTICLE_COUNT) * 10 - 5; 
            const normH = 1 - (h + 5) / 10; 
            const radius = normH * 4.5; 
            const spiral = i * 0.15;
            const noise = 0.3;
            const tx = Math.cos(spiral) * radius + randomRange(-noise, noise);
            const ty = h;
            const tz = Math.sin(spiral) * radius + randomRange(-noise, noise);
            treePos.push(tx, ty, tz);
        } else {
            // Star (Christmas Mode)
            const starCenterY = 5.2; 
            const starOuterR = 0.8;
            const starInnerR = 0.35;
            const starThickness = 0.5;
            const pt = getStarPoint(starOuterR, starInnerR);
            const zOffset = randomRange(-starThickness/2, starThickness/2);
            treePos.push(pt.x, starCenterY + pt.y, zOffset);
        }

        // 3. Pluto Positions (Sphere with Heart)
        const pR = 4.5;
        const pTheta = Math.random() * Math.PI * 2;
        const pPhi = Math.acos(2 * Math.random() - 1);
        
        const px = pR * Math.sin(pPhi) * Math.cos(pTheta);
        const py = pR * Math.sin(pPhi) * Math.sin(pTheta);
        const pz = pR * Math.cos(pPhi);
        
        let isHeart = false;
        if (pz > 0) {
            const hScale = 1.8;
            const nx = px / hScale;
            const ny = (py - 0.5) / hScale; 
            const eq = Math.pow(nx*nx + ny*ny - 1, 3) - nx*nx * Math.pow(ny, 3);
            if (eq <= 0) isHeart = true;
        }
        plutoPos.push(px, py, pz);

        // 4. Uranus Positions (Sphere + Vertical Rings)
        let ux, uy, uz;
        const isUranusRing = (Math.random() > 0.7);
        if (isUranusRing) {
            const rRing = randomRange(6, 10);
            const thetaRing = Math.random() * Math.PI * 2;
            ux = rRing * Math.cos(thetaRing);
            uy = randomRange(-0.1, 0.1); 
            uz = rRing * Math.sin(thetaRing);
        } else {
            const uR = 4.0;
            const uTheta = Math.random() * Math.PI * 2;
            const uPhi = Math.acos(2 * Math.random() - 1);
            ux = uR * Math.sin(uPhi) * Math.cos(uTheta);
            uy = uR * Math.sin(uPhi) * Math.sin(uTheta);
            uz = uR * Math.cos(uPhi);
        }
        
        // Uranus Tilt (~90 deg)
        const uTilt = 80 * (Math.PI / 180);
        const ux1 = ux * Math.cos(uTilt) - uy * Math.sin(uTilt);
        const uy1 = ux * Math.sin(uTilt) + uy * Math.cos(uTilt);
        const uz1 = uz;
        const uTiltX = 15 * (Math.PI / 180);
        const ux2 = ux1;
        const uy2 = uy1 * Math.cos(uTiltX) - uz1 * Math.sin(uTiltX);
        const uz2 = uy1 * Math.sin(uTiltX) + uz1 * Math.cos(uTiltX);
        uranusPos.push(ux2, uy2, uz2);

        // 5. Sun Positions
        const sunR = 5.5;
        const sunTheta = Math.random() * Math.PI * 2;
        const sunPhi = Math.acos(2 * Math.random() - 1);
        let sx2 = sunR * Math.sin(sunPhi) * Math.cos(sunTheta);
        let sy2 = sunR * Math.sin(sunPhi) * Math.sin(sunTheta);
        let sz2 = sunR * Math.cos(sunPhi);
        const noiseS = randomRange(-0.2, 0.2);
        sx2 += noiseS; sy2 += noiseS; sz2 += noiseS;
        sunPos.push(sx2, sy2, sz2);

        // 6. Mercury Positions
        const merR = 3.0;
        const merTheta = Math.random() * Math.PI * 2;
        const merPhi = Math.acos(2 * Math.random() - 1);
        let mx = merR * Math.sin(merPhi) * Math.cos(merTheta);
        let my = merR * Math.sin(merPhi) * Math.sin(merTheta);
        let mz = merR * Math.cos(merPhi);
        const noiseM = randomRange(-0.1, 0.1);
        mx += noiseM; my += noiseM; mz += noiseM;
        mercuryPos.push(mx, my, mz);

        // 6.5 Venus Positions
        const venusR = 3.2;
        const venusTheta = Math.random() * Math.PI * 2;
        const venusPhi = Math.acos(2 * Math.random() - 1);
        let vx = venusR * Math.sin(venusPhi) * Math.cos(venusTheta);
        let vy = venusR * Math.sin(venusPhi) * Math.sin(venusTheta);
        let vz = venusR * Math.cos(venusPhi);
        const noiseV = randomRange(-0.1, 0.1);
        vx += noiseV; vy += noiseV; vz += noiseV;
        venusPos.push(vx, vy, vz);

        // 7. Mars Positions
        const marsR = 3.2;
        const marsTheta = Math.random() * Math.PI * 2;
        const marsPhi = Math.acos(2 * Math.random() - 1);
        let marX = marsR * Math.sin(marsPhi) * Math.cos(marsTheta);
        let marY = marsR * Math.sin(marsPhi) * Math.sin(marsTheta);
        let marZ = marsR * Math.cos(marsPhi);
        const noiseMars = randomRange(-0.1, 0.1);
        marX += noiseMars; marY += noiseMars; marZ += noiseMars;
        marsPos.push(marX, marY, marZ);

        // 8. Earth Positions
        const earthR = 3.5;
        // Moon parameters
        const moonR = 1.0; 
        const moonDist = 6.0; // Distance from Earth center
        
        let ex, ey, ez;
        
        // Reserve last 800 particles for Moon
        if (i > PARTICLE_COUNT - 800) {
            // Moon
            const mTheta = Math.random() * Math.PI * 2;
            const mPhi = Math.acos(2 * Math.random() - 1);
            ex = moonDist + moonR * Math.sin(mPhi) * Math.cos(mTheta);
            ey = moonR * Math.sin(mPhi) * Math.sin(mTheta);
            ez = moonR * Math.cos(mPhi);
            // Tilt/Orbit? Let's just place it static relative to Earth for now.
            // Or maybe orbit it? The particles are static relative to the group, but group rotates.
        } else {
            // Earth
            const earthTheta = Math.random() * Math.PI * 2;
            const earthPhi = Math.acos(2 * Math.random() - 1);
            ex = earthR * Math.sin(earthPhi) * Math.cos(earthTheta);
            ey = earthR * Math.sin(earthPhi) * Math.sin(earthTheta);
            ez = earthR * Math.cos(earthPhi);
        }
        earthPos.push(ex, ey, ez);

        // 9. Saturn Positions
        const saturnR = 4.5;
        const isSaturnRing = (Math.random() > 0.6); // More rings
        let satX, satY, satZ;
        if (isSaturnRing) {
             const rRing = randomRange(6, 11); // Wider rings
             const thetaRing = Math.random() * Math.PI * 2;
             satX = rRing * Math.cos(thetaRing);
             satY = randomRange(-0.05, 0.05); // Thin rings
             satZ = rRing * Math.sin(thetaRing);
        } else {
             const sTheta = Math.random() * Math.PI * 2;
             const sPhi = Math.acos(2 * Math.random() - 1);
             satX = saturnR * Math.sin(sPhi) * Math.cos(sTheta);
             satY = saturnR * Math.sin(sPhi) * Math.sin(sTheta);
             satZ = saturnR * Math.cos(sPhi);
        }
        // Saturn Tilt (~27 deg)
        const sTilt = 27 * (Math.PI / 180);
        const satX1 = satX * Math.cos(sTilt) - satY * Math.sin(sTilt);
        const satY1 = satX * Math.sin(sTilt) + satY * Math.cos(sTilt);
        const satZ1 = satZ;
        saturnPos.push(satX1, satY1, satZ1);

        // 10. Jupiter Positions
        const jupR = 5.8;
        const jTheta = Math.random() * Math.PI * 2;
        const jPhi = Math.acos(2 * Math.random() - 1);
        let jX = jupR * Math.sin(jPhi) * Math.cos(jTheta);
        let jY = jupR * Math.sin(jPhi) * Math.sin(jTheta);
        let jZ = jupR * Math.cos(jPhi);
        jupiterPos.push(jX, jY, jZ);

        // 11. Neptune Positions
        const nepR = 3.8;
        const nTheta = Math.random() * Math.PI * 2;
        const nPhi = Math.acos(2 * Math.random() - 1);
        let nX = nepR * Math.sin(nPhi) * Math.cos(nTheta);
        let nY = nepR * Math.sin(nPhi) * Math.sin(nTheta);
        let nZ = nepR * Math.cos(nPhi);
        neptunePos.push(nX, nY, nZ);

        // 12. Solar System Overview
        // Distribute particles among planets
        // Total 15000
        // Sun: 3000, Jup: 1500, Sat: 1500, Others: ~500-800, Stars/Dust: Rest
        
        let ssX, ssY, ssZ;
        // Basic scale for solar system view (not real scale)
        // Sun at 0,0,0
        // Mercury at 4
        // Venus at 6
        // Earth at 8
        // Mars at 10
        // Jupiter at 14
        // Saturn at 18
        // Uranus at 22
        // Neptune at 26
        // Pluto at 30
        
        // Mini Tree at (12, 12, 0)
        
        if (i < 3000) {
            // Sun
            const r = 2.5; // Scaled down Sun
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(2 * Math.random() - 1);
            ssX = r * Math.sin(phi) * Math.cos(theta);
            ssY = r * Math.sin(phi) * Math.sin(theta);
            ssZ = r * Math.cos(phi);
            
            // Brighter Sun for Solar System view with reasonable colors
            const rnd = Math.random();
            if (rnd > 0.7) color.setHex(0xFFFFFF); // White core (30%)
            else if (rnd > 0.4) color.setHex(0xFFFF00); // Bright Yellow (30%)
            else if (rnd > 0.2) color.setHex(0xFFD700); // Gold (20%)
            else color.setHex(0xFF4500); // OrangeRed (20%) - Fire edge
        } else if (i < 3600) {
            // Mercury (dist 4)
            const r = 0.4;
            const dist = 4;
            const angle = 0; // Fixed angle for static view or random? Let's spread them on orbit? No, grouped.
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(2 * Math.random() - 1);
            ssX = dist + r * Math.sin(phi) * Math.cos(theta);
            ssY = r * Math.sin(phi) * Math.sin(theta);
            ssZ = r * Math.cos(phi);
            
            color.setHex(getRandomColor(mercuryPalette));
        } else if (i < 4200) {
            // Venus (dist 6) - reusing Mercury palette approx or white/yellow
            const r = 0.6;
            const dist = 6;
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(2 * Math.random() - 1);
            // Place at different angle around sun
            const orbitAngle = Math.PI / 4;
            const lx = r * Math.sin(phi) * Math.cos(theta);
            const ly = r * Math.sin(phi) * Math.sin(theta);
            const lz = r * Math.cos(phi);
            
            ssX = lx + dist * Math.cos(orbitAngle);
            ssY = ly;
            ssZ = lz + dist * Math.sin(orbitAngle);
            
            color.setHex(0xEEDD82); // Light Goldenrod
        } else if (i < 5000) {
            // Earth (dist 8)
            const r = 0.6;
            const dist = 8;
            const orbitAngle = Math.PI / 2;
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(2 * Math.random() - 1);
            
            const lx = r * Math.sin(phi) * Math.cos(theta);
            const ly = r * Math.sin(phi) * Math.sin(theta);
            const lz = r * Math.cos(phi);
            
            ssX = lx + dist * Math.cos(orbitAngle);
            ssY = ly;
            ssZ = lz + dist * Math.sin(orbitAngle);
            
            // Simple Earth Color
            if (Math.random() > 0.5) color.setHex(0x1E90FF); else color.setHex(0x228B22);
        } else if (i < 5600) {
            // Mars (dist 10)
            const r = 0.5;
            const dist = 10;
            const orbitAngle = 3 * Math.PI / 4;
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(2 * Math.random() - 1);
             
            const lx = r * Math.sin(phi) * Math.cos(theta);
            const ly = r * Math.sin(phi) * Math.sin(theta);
            const lz = r * Math.cos(phi);
            
            ssX = lx + dist * Math.cos(orbitAngle);
            ssY = ly;
            ssZ = lz + dist * Math.sin(orbitAngle);
            
            color.setHex(getRandomColor(marsPalette));
        } else if (i < 7100) {
            // Jupiter (dist 14)
            const r = 1.8;
            const dist = 14;
            const orbitAngle = Math.PI;
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(2 * Math.random() - 1);
            
            const lx = r * Math.sin(phi) * Math.cos(theta);
            const ly = r * Math.sin(phi) * Math.sin(theta);
            const lz = r * Math.cos(phi);
            
            ssX = lx + dist * Math.cos(orbitAngle);
            ssY = ly;
            ssZ = lz + dist * Math.sin(orbitAngle);
            
            color.setHex(getRandomColor(jupiterPalette));
        } else if (i < 8600) {
            // Saturn (dist 18)
            const r = 1.5;
            const dist = 18;
            const orbitAngle = 5 * Math.PI / 4;
            
            // Rings logic scaled down
            let lx, ly, lz;
            if (Math.random() > 0.5) {
                // Ring
                const rRing = randomRange(2.0, 3.5);
                const tRing = Math.random() * Math.PI * 2;
                lx = rRing * Math.cos(tRing);
                ly = randomRange(-0.05, 0.05);
                lz = rRing * Math.sin(tRing);
            } else {
                // Sphere
                const theta = Math.random() * Math.PI * 2;
                const phi = Math.acos(2 * Math.random() - 1);
                lx = r * Math.sin(phi) * Math.cos(theta);
                ly = r * Math.sin(phi) * Math.sin(theta);
                lz = r * Math.cos(phi);
            }
            
            // Tilt
            const tilt = 27 * Math.PI/180;
            const lx2 = lx * Math.cos(tilt) - ly * Math.sin(tilt);
            const ly2 = lx * Math.sin(tilt) + ly * Math.cos(tilt);
            
            ssX = lx2 + dist * Math.cos(orbitAngle);
            ssY = ly2;
            ssZ = lz + dist * Math.sin(orbitAngle);
            
            color.setHex(getRandomColor(saturnPalette));
        } else if (i < 9400) {
            // Uranus (dist 22)
            const r = 1.0;
            const dist = 22;
            const orbitAngle = 3 * Math.PI / 2;
             const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(2 * Math.random() - 1);
            
            const lx = r * Math.sin(phi) * Math.cos(theta);
            const ly = r * Math.sin(phi) * Math.sin(theta);
            const lz = r * Math.cos(phi);
            
            ssX = lx + dist * Math.cos(orbitAngle);
            ssY = ly;
            ssZ = lz + dist * Math.sin(orbitAngle);
             
            color.setHex(getRandomColor(uranusPalette));
        } else if (i < 10200) {
            // Neptune (dist 26)
            const r = 1.0;
            const dist = 26;
            const orbitAngle = 7 * Math.PI / 4;
             const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(2 * Math.random() - 1);
            
            const lx = r * Math.sin(phi) * Math.cos(theta);
            const ly = r * Math.sin(phi) * Math.sin(theta);
            const lz = r * Math.cos(phi);
            
            ssX = lx + dist * Math.cos(orbitAngle);
            ssY = ly;
            ssZ = lz + dist * Math.sin(orbitAngle);
            
            color.setHex(getRandomColor(neptunePalette));
        } else if (i < 10800) {
             // Pluto (dist 30)
             const r = 0.4;
             const dist = 30;
             const orbitAngle = 0.5; // Offset
              const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(2 * Math.random() - 1);
            
            const lx = r * Math.sin(phi) * Math.cos(theta);
            const ly = r * Math.sin(phi) * Math.sin(theta);
            const lz = r * Math.cos(phi);
            
            ssX = lx + dist * Math.cos(orbitAngle);
            ssY = ly;
            ssZ = lz + dist * Math.sin(orbitAngle);
             
             color.setHex(getRandomColor(plutoPalette));
        } else if (i < 11500) {
            // Mini Christmas Tree Drifting
            // Position somewhere random-ish, e.g. (-15, 10, -5) -> (-10, 6, -3)
            const cx = -10;
            const cy = 6;
            const cz = -3;
            
            // Normalized tree construction
            // Use subset i from 10800 to 11500 (700 particles)
            const localI = i - 10800;
            const total = 700;
            const h = (localI / total) * 4 - 2; 
            const normH = 1 - (h + 2) / 4; 
            const radius = normH * 1.5; 
            const spiral = localI * 0.5;
            
            const lx = Math.cos(spiral) * radius;
            const ly = h;
            const lz = Math.sin(spiral) * radius;
            
            // Rotation/Tumble
            const time = Date.now() * 0.001; // Static snapshot for position array? 
            // We can't animate position array here easily without updating it in animate loop.
            // So just place it statically tilted.
            const tilt = 45 * Math.PI/180;
            const lx2 = lx * Math.cos(tilt) - ly * Math.sin(tilt);
            const ly2 = lx * Math.sin(tilt) + ly * Math.cos(tilt);
            
            ssX = cx + lx2;
            ssY = cy + ly2;
            ssZ = cz + lz;
            
            color.setHex(getRandomColor(christmasPalette));
        } else {
            // Stars / Dust
            // Spread wide
             const r = randomRange(30, 60);
            const theta = randomRange(0, Math.PI * 2);
            const phi = randomRange(0, Math.PI);
            
            ssX = r * Math.sin(phi) * Math.cos(theta);
            ssY = r * Math.sin(phi) * Math.sin(theta);
            ssZ = r * Math.cos(phi);
            
            color.setHex(0xFFFFFF);
        }
        
        solarSystemPos.push(ssX, ssY, ssZ);
        solarSystemColors[i*3] = color.r; solarSystemColors[i*3+1] = color.g; solarSystemColors[i*3+2] = color.b;

        // 13. Black Hole Positions
        let bhX, bhY, bhZ;
        const rndBH = Math.random();
        
        // Distribution:
         // 40% Photon Shell (Ultra dense, blindingly bright inner edge)
          // 40% Accretion Disk (Swirling)
          // 20% Lensed Halo (Vertical/Spherical wrapping for 3D depth)
          
          if (rndBH < 0.40) {
              // Photon Shell (Inner brightness)
              // Create a TIGHT, THICK shell from r=2.1 to 2.5
              // Increased density in smaller volume = Overexposure brightness
              const minR = 2.1;
              const maxR = 2.5;
              
              const r = minR + (maxR - minR) * Math.pow(Math.random(), 2); 
              
              const theta = Math.random() * Math.PI * 2;
              const phi = Math.acos(2 * Math.random() - 1);
              
              bhX = r * Math.sin(phi) * Math.cos(theta);
              bhY = r * Math.sin(phi) * Math.sin(theta);
              bhZ = r * Math.cos(phi);
              
          } else if (rndBH < 0.80) {
             // Accretion Disk (Horizontal)
             const minR = 3.0;
             const maxR = 14.0;
             const r = minR + (maxR - minR) * Math.pow(Math.random(), 3); 
             const theta = Math.random() * Math.PI * 2;
             
             const thickness = 0.05 + (r / maxR) * 1.0;
             const h = randomRange(-thickness, thickness);
             
             bhX = r * Math.cos(theta);
             bhY = h;
             bhZ = r * Math.sin(theta);
             
         } else {
              // Lensed Halo / Vertical Flow
              // To make it look 3D, we add particles wrapping around vertically
              const minR = 2.6;
              const maxR = 8.0;
              const r = minR + (maxR - minR) * Math.pow(Math.random(), 2);
              
              // Vertical Ring (Y-Z plane mostly)
              const angle = Math.random() * Math.PI * 2;
              
              // Create a "shell" that wraps around
              bhX = randomRange(-1.0, 1.0); // Thin in X
              bhY = r * Math.sin(angle);
              bhZ = r * Math.cos(angle);
              
              // Apply some noise
              bhX += randomRange(-0.5, 0.5);
         }
         
         // Apply Tilt
         const tilt = 20 * Math.PI / 180; 
         const y2 = bhY * Math.cos(tilt) - bhZ * Math.sin(tilt);
         const z2 = bhY * Math.sin(tilt) + bhZ * Math.cos(tilt);
  
         blackHolePos.push(bhX, y2, z2);

        // --- Colors Setup ---
        
        // Christmas
        if (i < TREE_PARTICLE_COUNT) {
            color.setHex(getRandomColor(christmasPalette));
        } else {
            color.setHex(0xFFD700); 
            if (Math.random() > 0.8) color.setHex(0xFFFACD);
        }
        christmasColors[i*3] = color.r; christmasColors[i*3+1] = color.g; christmasColors[i*3+2] = color.b;
        
        // Pluto
        if (isHeart) {
            const cVal = randomRange(0.9, 1.0);
            color.setRGB(cVal, cVal, cVal);
        } else {
            color.setHex(getRandomColor(plutoPalette));
        }
        plutoColors[i*3] = color.r; plutoColors[i*3+1] = color.g; plutoColors[i*3+2] = color.b;

        // Uranus
        color.setHex(getRandomColor(uranusPalette));
        if (isUranusRing) color.setHex(0xFFFFFF);
        uranusColors[i*3] = color.r; uranusColors[i*3+1] = color.g; uranusColors[i*3+2] = color.b;

        // Sun
        color.setHex(getRandomColor(sunPalette));
        sunColors[i*3] = color.r; sunColors[i*3+1] = color.g; sunColors[i*3+2] = color.b;

        // Mercury
        color.setHex(getRandomColor(mercuryPalette));
        mercuryColors[i*3] = color.r; mercuryColors[i*3+1] = color.g; mercuryColors[i*3+2] = color.b;

        // Venus
        color.setHex(getRandomColor(venusPalette));
        venusColors[i*3] = color.r; venusColors[i*3+1] = color.g; venusColors[i*3+2] = color.b;

        // Mars
        color.setHex(getRandomColor(marsPalette));
        marsColors[i*3] = color.r; marsColors[i*3+1] = color.g; marsColors[i*3+2] = color.b;

        // Earth
        // Simple land/ocean noise
        const eNoise = Math.sin(ex*1.5) + Math.sin(ey*1.5) + Math.sin(ez*1.5);
        if (eNoise > 0.5) {
             // Land
             color.setHex(0x228B22); // Green
        } else {
             // Ocean
             color.setHex(0x1E90FF); // Blue
        }
        // Clouds
        if (Math.random() > 0.85) color.setHex(0xFFFFFF);
        
        // Moon Color override
        if (i > PARTICLE_COUNT - 800) {
            color.setHex(0xD3D3D3); // LightGrey
            if (Math.random() > 0.8) color.setHex(0xFFFFFF);
        }

        earthColors[i*3] = color.r; earthColors[i*3+1] = color.g; earthColors[i*3+2] = color.b;

        // Saturn
        color.setHex(getRandomColor(saturnPalette));
        if (isSaturnRing) {
             // Rings variation
             if (Math.random() > 0.5) color.setHex(0xCD853F); // Peru
             else color.setHex(0xF4C542); // Gold
        }
        saturnColors[i*3] = color.r; saturnColors[i*3+1] = color.g; saturnColors[i*3+2] = color.b;

        // Jupiter
        // Bands based on Y
        const jBand = Math.abs(jY);
        if (jBand < 1.0) color.setHex(0xC88B3A); // Dark band
        else if (jBand < 2.0) color.setHex(0xF5DEB3); // Light band
        else if (jBand < 3.0) color.setHex(0xCD853F); // Darker
        else color.setHex(0xF5DEB3); // Polar
        // Red Spot? (Approx)
        if (jY > -1.5 && jY < -0.5 && jX > 1 && jX < 3 && jZ > 0) {
             color.setHex(0x8B0000); // Red spot
        }
        jupiterColors[i*3] = color.r; jupiterColors[i*3+1] = color.g; jupiterColors[i*3+2] = color.b;

        // Neptune
        color.setHex(getRandomColor(neptunePalette));
        neptuneColors[i*3] = color.r; neptuneColors[i*3+1] = color.g; neptuneColors[i*3+2] = color.b;

        // Black Hole
        const bx = blackHolePos[i*3];
        const by = blackHolePos[i*3+1];
        const bz = blackHolePos[i*3+2];
        const bd = Math.sqrt(bx*bx + by*by + bz*bz);
        
        // Jets Logic (High Y, Low XZ radius)
        
        if (bd < 2.8) {
             // Photon Shell (Ultra Bright)
             color.setHex(0xFFFFFF);
             // Boost brightness manually since setHex clamps to 1.0 usually, 
             // but we will rely on density for initial look.
             // The loop animation will overdrive it to 1.5.
        } else {
             // Disk or Halo
             // Check if it's a Halo/Lensed particle (High Y relative to radius)
             // Or just use distance gradient for everything to look unified.
             
             // Disk Gradient
             // Map radius 3.0 -> 14.0
             const t = (bd - 2.8) / (14.0 - 2.8);
             
             if (t < 0.1) color.setHex(0xFFFFFF); // Still white hot
             else if (t < 0.25) color.setHex(0xFFD700); // Gold
             else if (t < 0.5) color.setHex(0xFF4500); // OrangeRed
             else if (t < 0.8) color.setHex(0x8B0000); // DarkRed
             else color.setHex(0x330000); // Very dark fade
        }
        blackHoleColors[i*3] = color.r; blackHoleColors[i*3+1] = color.g; blackHoleColors[i*3+2] = color.b;
        
        // Manual boost for initial state if in inner shell
        if (bd < 2.8) {
             blackHoleColors[i*3] = 1.5;
             blackHoleColors[i*3+1] = 1.5;
             blackHoleColors[i*3+2] = 1.5;
        }

        // Initial Colors (Christmas)
    colors[i*3] = christmasColors[i*3];
    colors[i*3+1] = christmasColors[i*3+1];
    colors[i*3+2] = christmasColors[i*3+2];
}

// --- COUNTDOWN INTEGRATION (Merged into main system) ---
// To make the countdown "form by particles" like the tree, we should really include it in the main particle system
// instead of a separate object.
// But we ran out of particles (15000 fixed).
// However, the user wants it to "transform" and "rotate with tree".
// The rotation part is solved by parenting.
// The "transform" part (morphing) is currently just toggling visibility.
// If we want it to morph, we need to reserve particles for it in the main array.
// But resizing the main array is hard.
// Let's fake the "morph" by animating the countdown particles from random positions when they appear?
// Or, since it's a separate system attached to the parent, it rotates correctly.
// To make it look like it's "formed by free particles", we can animate the positions in updateCountdownParticles?
// No, updateCountdownParticles is called every frame to update text.
// Actually, only the text content updates every second.
// We can animate the transition from "scattered" to "text" when it first appears.

// Let's add a transition logic for countdown particles.
if (countdownParticles && countdownParticles.visible) {
    // If we just became visible? 
    // We don't track state easily here.
    // But since it's attached to 'particles', it rotates with the tree.
    // The user said "also formed by free particle contraction".
    // This implies an animation.
    
    // Let's add a simple "convergence" animation to the countdown particles themselves.
    // We can store "target" positions (the text) and "current" positions.
    // But our updateCountdownParticles function overwrites positions every frame based on text.
    // If text doesn't change often (every second), we can interpolate.
    
    // Actually, simply adding it to the `particles` group solves the "rotate with tree" requirement perfectly.
    // The "formed by contraction" might be acceptable as just appearing, or we can animate opacity.
    // Given the constraints, parenting it to `particles` is the key fix for rotation.
}

geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const mat = new THREE.PointsMaterial({
        size: 0.15,
        map: createParticleTexture(),
        vertexColors: true,
        blending: THREE.AdditiveBlending,
        transparent: true,
        opacity: 0.9,
        depthWrite: false
    });

    particles = new THREE.Points(geo, mat);
    // Disable frustum culling to prevent particles from disappearing when zoomed/moved
    particles.frustumCulled = false;
    scene.add(particles);

    // --- Star Sprite Removed ---
    // The star is now part of the particle system (particles indices >= TREE_PARTICLE_COUNT)

    createArrows();
}

let countdownParticles;
let fireworksParticles = [];
let textCanvas, textCtx;
let lastCountdownText = '';

function createCountdownParticles() {
    // 1. Setup Canvas for Text
    textCanvas = document.createElement('canvas');
    textCanvas.width = 512;
    textCanvas.height = 64;
    textCtx = textCanvas.getContext('2d');
    
    // 2. Setup Particle System for Countdown
    // Increased particle count for thickness and milliseconds
    const maxParticles = 8000;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(maxParticles * 3);
    const col = new Float32Array(maxParticles * 3);
    
    // Initialize off-screen
    for(let i=0; i<maxParticles*3; i++) pos[i] = 9999;
    
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    
    const mat = new THREE.PointsMaterial({
        size: 0.22, // Increased size for brightness
        map: createParticleTexture(),
        vertexColors: true,
        blending: THREE.AdditiveBlending,
        transparent: true,
        opacity: 1.0, 
        depthWrite: false
    });
    
    countdownParticles = new THREE.Points(geo, mat);
    countdownParticles.frustumCulled = false;
    // Add to the main particles group if possible, or scene?
    // If we add to scene, it rotates with camera if we rotate camera? No.
    // The main 'particles' object is rotated in animate().
    // To make countdown rotate WITH the tree, we must add it as a child of 'particles' OR apply the same rotation.
    
    // Adding as child of 'particles' is tricky because 'particles' is a Points object, 
    // and Three.js Points usually don't have children rendered in the same draw call easily if different material?
    // Actually, THREE.Points extends THREE.Object3D, so it CAN have children.
    // Let's try adding it to the 'particles' object so it inherits rotation automatically.
    
    if (particles) {
        particles.add(countdownParticles);
    } else {
        scene.add(countdownParticles);
    }
}

function updateCountdownParticles(text) {
    if (!countdownParticles) createCountdownParticles();
    
    // Ensure it is attached to particles if particles exists now
    if (particles && countdownParticles.parent !== particles) {
        scene.remove(countdownParticles);
        particles.add(countdownParticles);
    }
    
    countdownParticles.visible = true;
    if (text === lastCountdownText) return;
    lastCountdownText = text;
    
    // Draw Text
    textCtx.clearRect(0, 0, textCanvas.width, textCanvas.height);
    textCtx.font = "bold 50px Arial"; // Larger font for better resolution
    textCtx.fillStyle = "white";
    textCtx.textAlign = "center";
    textCtx.textBaseline = "middle";
    textCtx.fillText(text, textCanvas.width/2, textCanvas.height/2);
    
    // Get Pixels
    const imgData = textCtx.getImageData(0, 0, textCanvas.width, textCanvas.height);
    const data = imgData.data;
    
    const positions = countdownParticles.geometry.attributes.position.array;
    const colors = countdownParticles.geometry.attributes.color.array;
    
    let pIndex = 0;
    
    // Scale and Offset
    const scale = 0.025; 
    const offsetX = 8.5; // Moved further right
    const offsetY = 2.0; 
    const offsetZ = 0.0;
    const thickness = 0.6; 
    
    // Scan Grid
    const step = 4; // Skip pixels
    const maxP = 8000;
    
    // Pseudo-random generator for stable visuals
    // Returns 0.0 to 1.0 based on inputs
    const stableRandom = (x, y, z) => {
        const dot = x * 12.9898 + y * 78.233 + z * 151.7182;
        return Math.abs(Math.sin(dot) * 43758.5453) % 1;
    };
    
    for (let y = 0; y < textCanvas.height; y += step) {
        for (let x = 0; x < textCanvas.width; x += step) {
            const index = (y * textCanvas.width + x) * 4;
            if (data[index + 3] > 128) { // Alpha threshold
                
                const localX = (x - textCanvas.width/2) * scale;
                const localY = (textCanvas.height/2 - y) * scale;
                const px = offsetX + localX;
                const py = offsetY + localY;

                for(let k=0; k<3; k++) {
                    if (pIndex >= maxP) break;

                    // Stable Z within thickness
                    // Use x,y,k as seed so it doesn't "boil" every frame
                    const rndZ = stableRandom(x, y, k);
                    const pz = offsetZ + (rndZ - 0.5) * thickness;
                    
                    positions[pIndex*3] = px;
                    positions[pIndex*3+1] = py;
                    positions[pIndex*3+2] = pz;
                    
                    // Stable Colors (No Flashing)
                    // Use x coordinate to determine color theme or just random stable mix
                    const rndColor = stableRandom(x, y, k + 10);
                    
                    // Reduced brightness to be comfortable (0.8 - 1.2 range instead of 1.5)
                    if (rndColor < 0.33) { 
                        colors[pIndex*3] = 1.0; colors[pIndex*3+1] = 0.2; colors[pIndex*3+2] = 0.2; // Red
                    } else if (rndColor < 0.66) { 
                        colors[pIndex*3] = 0.2; colors[pIndex*3+1] = 1.0; colors[pIndex*3+2] = 0.2; // Green
                    } else { 
                        colors[pIndex*3] = 1.0; colors[pIndex*3+1] = 0.8; colors[pIndex*3+2] = 0.2; // Gold
                    }
                    
                    pIndex++;
                }
            }
        }
    }
    
    // Hide remaining
    for (let i = pIndex; i < maxP; i++) {
        positions[i*3] = 9999;
    }
    
    countdownParticles.geometry.attributes.position.needsUpdate = true;
    countdownParticles.geometry.attributes.color.needsUpdate = true;
}

function hideCountdownParticles() {
    if (countdownParticles) countdownParticles.visible = false;
    for (const firework of fireworksParticles) {
        scene.remove(firework.mesh);
        firework.mesh.geometry.dispose();
        if (firework.mesh.material.map) firework.mesh.material.map.dispose();
        firework.mesh.material.dispose();
    }
    fireworksParticles.length = 0;
}

// --- Fireworks System ---
function updateFireworks(time) {
    if (countdownParticles) countdownParticles.visible = false; // Hide text during fireworks
    
    // 1. Spawn Logic
    if (Math.random() < 0.05) { // 5% chance per frame
        spawnFirework();
    }
    
    // 2. Update existing
    for (let i = fireworksParticles.length - 1; i >= 0; i--) {
        const fw = fireworksParticles[i];
        if (!fw.update(time)) {
            fw.mesh.visible = false;
            // Recycle or remove?
            scene.remove(fw.mesh);
            fw.mesh.geometry.dispose();
            if (fw.mesh.material.map) fw.mesh.material.map.dispose();
            fw.mesh.material.dispose();
            fireworksParticles.splice(i, 1);
        }
    }
}

function spawnFirework() {
    const fw = new Firework();
    fireworksParticles.push(fw);
    scene.add(fw.mesh);
}

class Firework {
    constructor() {
        this.isExploded = false;
        this.life = 1.0;
        this.particleCount = 100;
        
        // Launch position
        this.x = randomRange(-8, 8);
        this.y = -8;
        this.z = randomRange(-5, 5);
        
        this.targetY = randomRange(0, 8);
        this.velY = 0.3; // Launch speed
        
        const geo = new THREE.BufferGeometry();
        const pos = new Float32Array(this.particleCount * 3);
        const col = new Float32Array(this.particleCount * 3);
        const vel = new Float32Array(this.particleCount * 3);
        
        // Initialize as single point
        for(let i=0; i<this.particleCount; i++) {
            pos[i*3] = this.x;
            pos[i*3+1] = this.y;
            pos[i*3+2] = this.z;
            
            // Random explosion velocities (stored for later)
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.random() * Math.PI;
            const speed = randomRange(0.05, 0.2);
            
            vel[i*3] = speed * Math.sin(phi) * Math.cos(theta);
            vel[i*3+1] = speed * Math.sin(phi) * Math.sin(theta);
            vel[i*3+2] = speed * Math.cos(phi);
            
            col[i*3] = 1; col[i*3+1] = 1; col[i*3+2] = 1; // White trail
        }
        
        geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
        geo.setAttribute('velocity', new THREE.BufferAttribute(vel, 3));
        
        this.mesh = new THREE.Points(geo, new THREE.PointsMaterial({
            size: 0.2,
            map: createParticleTexture(),
            vertexColors: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            transparent: true
        }));
        
        // Random Color for explosion
        this.color = new THREE.Color();
        this.color.setHSL(Math.random(), 1.0, 0.5);
    }
    
    update(time) {
        const positions = this.mesh.geometry.attributes.position.array;
        const velocities = this.mesh.geometry.attributes.velocity.array;
        const colors = this.mesh.geometry.attributes.color.array;
        
        if (!this.isExploded) {
            // Launch Phase
            this.y += this.velY;
            
            // Update all particles to follow the "rocket"
            for(let i=0; i<this.particleCount; i++) {
                positions[i*3] = this.x + randomRange(-0.1, 0.1);
                positions[i*3+1] = this.y + randomRange(-0.5, 0.0); // Trail
                positions[i*3+2] = this.z + randomRange(-0.1, 0.1);
            }
            
            if (this.y >= this.targetY) {
                this.isExploded = true;
                // Initialize Colors for explosion
                for(let i=0; i<this.particleCount; i++) {
                    colors[i*3] = this.color.r;
                    colors[i*3+1] = this.color.g;
                    colors[i*3+2] = this.color.b;
                }
            }
        } else {
            // Explosion Phase
            this.life -= 0.02;
            this.mesh.material.opacity = this.life;
            
            for(let i=0; i<this.particleCount; i++) {
                // Apply Velocity
                positions[i*3] += velocities[i*3];
                positions[i*3+1] += velocities[i*3+1];
                positions[i*3+2] += velocities[i*3+2];
                
                // Gravity
                velocities[i*3+1] -= 0.005;
                
                // Drag
                velocities[i*3] *= 0.95;
                velocities[i*3+1] *= 0.95;
                velocities[i*3+2] *= 0.95;
            }
        }
        
        this.mesh.geometry.attributes.position.needsUpdate = true;
        this.mesh.geometry.attributes.color.needsUpdate = true;
        
        return this.life > 0;
    }
}

function createArrows() {
    const arrowGeo = new THREE.BufferGeometry();
    const arrowCount = 200;
    const positions = new Float32Array(arrowCount * 3);
    const colors = new Float32Array(arrowCount * 3);
    const sizes = new Float32Array(arrowCount);

    // Create a simple arrow shape pointing right using particles
    // > shape
    for(let i=0; i<arrowCount; i++) {
        // Parametric equation for a chevron/arrow
        // t from 0 to 1
        const t = Math.random();
        // Upper wing: y = x, Lower wing: y = -x
        const side = Math.random() > 0.5 ? 1 : -1;
        
        // x goes from -1 to 0 (tip at 0,0?) No, let's make tip at (1,0)
        // Let's make a standard ">"
        // x from -0.5 to 0.5
        // y = |x - 0.5| * slope ?
        
        // Simpler: 
        // Tip at (0.5, 0). Base at (-0.5, +/- 0.5)
        
        const lx = randomRange(-0.5, 0.5);
        // The closer lx is to 0.5, the closer y is to 0
        const distFromTip = 0.5 - lx;
        const ly = distFromTip * side * 0.8 + randomRange(-0.05, 0.05);
        
        positions[i*3] = lx;
        positions[i*3+1] = ly;
        positions[i*3+2] = randomRange(-0.1, 0.1);
        
        colors[i*3] = 1.0;
        colors[i*3+1] = 1.0;
        colors[i*3+2] = 1.0;
        
        sizes[i] = randomRange(0.1, 0.2);
    }
    
    arrowGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    arrowGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    // arrowGeo.setAttribute('size', new THREE.BufferAttribute(sizes, 1)); // Size attenuation usually handled by material size or shader

    const arrowMat = new THREE.PointsMaterial({
        size: 0.1,
        color: 0xffffff,
        transparent: true,
        opacity: 0.4,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    });

    // Right Arrow
    rightArrow = new THREE.Points(arrowGeo.clone(), arrowMat.clone());
    rightArrow.name = "next_theme";
    scene.add(rightArrow);

    // Left Arrow
    leftArrow = new THREE.Points(arrowGeo.clone(), arrowMat.clone());
    leftArrow.rotation.z = Math.PI; // Rotate 180 deg
    leftArrow.name = "prev_theme";
    scene.add(leftArrow);
    
    updateArrowPositions();
}

function updateArrowPositions() {
    if (!leftArrow || !rightArrow || !camera) return;
    
    // Calculate visible width at z=0 (where arrows are roughly located)
    // Camera is at z=12.
    // We want arrows at z=0 plane? Yes.
    
    const dist = camera.position.z; // 12
    const vFOV = THREE.MathUtils.degToRad(camera.fov); // fov in radians
    const height = 2 * Math.tan(vFOV / 2) * dist;
    const width = height * camera.aspect;
    
    // Place at edges with padding
    const padding = 1.5; // Slightly off the absolute edge
    const xPos = (width / 2) - padding;
    
    rightArrow.position.set(xPos, 0, 0);
    leftArrow.position.set(-xPos, 0, 0);
    
    // Scale arrows based on resolution? 
    // Maybe keep them constant size in world space.
    // They are currently scale (2,2,2)
    rightArrow.scale.set(2, 2, 2);
    leftArrow.scale.set(2, 2, 2);
}

function changeTheme(newTheme) {
    if (!particles || (currentTheme === newTheme && !isColorAnimating)) return;
    if (currentColorTween) currentColorTween.stop();
    currentTheme = newTheme;
    isColorAnimating = true;

    const palettes = {
        christmas: christmasColors, pluto: plutoColors, uranus: uranusColors,
        sun: sunColors, mercury: mercuryColors, venus: venusColors,
        mars: marsColors, earth: earthColors, jupiter: jupiterColors,
        saturn: saturnColors, neptune: neptuneColors,
        black_hole: blackHoleColors, solar_system: solarSystemColors
    };
    const targetColors = palettes[newTheme] || christmasColors;
    const currentColors = particles.geometry.attributes.color.array;
    const startColors = currentColors.slice();
    currentColorTween = new TWEEN.Tween({ t: 0 })
        .to({ t: 1 }, 1000)
        .easing(TWEEN.Easing.Linear.None)
        .onUpdate(({ t }) => {
            for (let i = 0; i < currentColors.length; i++) {
                currentColors[i] = startColors[i] + (targetColors[i] - startColors[i]) * t;
            }
            particles.geometry.attributes.color.needsUpdate = true;
        })
        .onComplete(() => {
            currentColors.set(targetColors);
            particles.geometry.attributes.color.needsUpdate = true;
            isColorAnimating = false;
            currentColorTween = null;
            updateSceneControls();
        })
        .start();
}

function morph(targetType) {
    if (!particles || currentShape === targetType) return;
    if (currentMorphTween) currentMorphTween.stop();
    if (targetType === 'scatter' && currentTheme === 'solar_system') {
        changeTheme(themeBeforeSolar);
    }
    if (targetType !== 'tree') hideCountdownParticles();
    
    // Immediate state update to handle UI logic during transition
    currentShape = targetType;
    isAnimating = true;

    resetView(targetType, true);
    if (targetType === 'solar_system') particles.rotation.set(0, 0, 0);

    // Toggle Arrows
    if (leftArrow && rightArrow) {
        if (targetType === 'scatter') {
            leftArrow.visible = true;
            rightArrow.visible = true;
        } else {
            leftArrow.visible = false;
            rightArrow.visible = false;
        }
    }
    
    let targetData;
    if (targetType === 'tree') targetData = treePos;
    else if (targetType === 'pluto') targetData = plutoPos;
    else if (targetType === 'uranus') targetData = uranusPos;
    else if (targetType === 'sun') targetData = sunPos;
    else if (targetType === 'mercury') targetData = mercuryPos;
    else if (targetType === 'venus') targetData = venusPos;
    else if (targetType === 'mars') targetData = marsPos;
    else if (targetType === 'earth') targetData = earthPos;
    else if (targetType === 'jupiter') targetData = jupiterPos;
    else if (targetType === 'saturn') targetData = saturnPos;
    else if (targetType === 'neptune') targetData = neptunePos;
    else if (targetType === 'black_hole') targetData = blackHolePos;
    else if (targetType === 'solar_system') targetData = solarSystemPos;
    else targetData = scatterPos;

    updateSceneControls();

    // Rotation Logic: Stop rotation in Solar System mode
    if (targetType === 'solar_system') {
        targetRotationSpeedY = 0;
    } else {
        targetRotationSpeedY = 0.0005;
    }

    const currentData = particles.geometry.attributes.position.array;
    
    // Using a simpler tween approach
    const duration = 1600;
    const startData = currentData.slice();
    
    currentMorphTween = new TWEEN.Tween({ t: 0 })
        .to({ t: 1 }, duration)
        .easing(TWEEN.Easing.Elastic.Out) // Bouncy effect for fun
        .onUpdate((obj) => {
            for (let i = 0; i < currentData.length; i++) {
                currentData[i] = startData[i] + (targetData[i] - startData[i]) * obj.t;
            }


            particles.geometry.attributes.position.needsUpdate = true;
        })
        .onComplete(() => {
            currentData.set(targetData);
            particles.geometry.attributes.position.needsUpdate = true;
            currentShape = targetType;
            isAnimating = false;
            updateSceneControls();
            currentMorphTween = null;
        })
        .start();
}

function enterSolarSystem() {
    if (!particles) return;
    if (currentShape === 'solar_system') {
        returnToScatter();
        return;
    }
    if (currentTheme !== 'solar_system') themeBeforeSolar = currentTheme;
    changeTheme('solar_system');
    morph('solar_system');
    updateStatusText('🌌 太阳系全景：点击行星探索 · 双指或滚轮缩放');
}

function returnToScatter() {
    morph('scatter');
    updateStatusText('✨ 自由星云：左右切换主题，点击「凝聚」查看');
}

function toggleShape() {
    if (currentShape !== 'scatter') {
        returnToScatter();
        return;
    }
    morph(shapeForTheme());
    updateStatusText('✨ ' + themeNames[currentTheme] + ' · 拖动旋转');
}

function explorePlanet(name) {
    if (!Object.hasOwn(themeNames, name)) return;
    changeTheme(name);
    morph(shapeForTheme(name));
    updateStatusText('🚀 正在探索：' + themeNames[name] + ' · 拖动旋转');
}

function updateSceneControls() {
    const solarButton = document.getElementById('solar-system-btn');
    if (solarButton) {
        solarButton.style.display = 'block';
        solarButton.textContent = currentShape === 'solar_system' ? '返回星云' : '太阳系全景';
    }
    const shapeButton = document.getElementById('shape-btn');
    if (shapeButton) shapeButton.textContent = currentShape === 'scatter' ? '凝聚' : '返回星云';
    for (const id of ['prev-theme-btn', 'next-theme-btn']) {
        const button = document.getElementById(id);
        if (button) button.disabled = currentShape !== 'scatter' || isColorAnimating;
    }
    const selectedName = document.getElementById('selected-planet-name');
    if (selectedName) selectedName.textContent = themeNames[currentTheme] || '选择星球';
    for (const option of document.querySelectorAll('[data-theme]')) {
        option.setAttribute('aria-pressed', String(option.dataset.theme === currentTheme));
    }
}


function closePlanetPanel(restoreFocus = true) {
    const panel = document.getElementById('planet-panel');
    if (!panel || !panel.open) return;
    panel.open = false;
    if (restoreFocus) document.getElementById('planet-picker-trigger').focus({ preventScroll: true });
}

function choosePlanet(name) {
    explorePlanet(name);
    closePlanetPanel();
}

const planetPanel = document.getElementById('planet-panel');
if (planetPanel) {
    planetPanel.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && planetPanel.open) {
            event.preventDefault();
            event.stopPropagation();
            closePlanetPanel();
        }
    });
    planetPanel.addEventListener('toggle', () => {
        if (planetPanel.open) document.querySelector('.help-control').open = false;
    });
    document.addEventListener('click', (event) => {
        if (planetPanel.open && !planetPanel.contains(event.target)) closePlanetPanel(false);
    });
    const help = document.querySelector('.help-control');
    help.addEventListener('toggle', () => { if (help.open) closePlanetPanel(false); });
}

function viewPosition(shape) {
    if (shape === 'scatter') return { x: 0, y: 2, z: 12 };
    const halfVertical = THREE.MathUtils.degToRad(camera.fov) / 2;
    const halfHorizontal = Math.atan(Math.tan(halfVertical) * camera.aspect);
    const halfFov = Math.min(halfVertical, halfHorizontal);
    const radii = { solar_system: 33, tree: 16, sun: 6, mercury: 3.3, venus: 3.5,
        earth: 7.3, mars: 3.5, jupiter: 6.1, saturn: 11.4,
        uranus: 10.4, neptune: 4, pluto: 4.7, black_hole: 15.5 };
    const distance = Math.max(12, (radii[shape] || 12) * 1.12 / Math.sin(halfFov));
    return shape === 'solar_system'
        ? { x: 0, y: distance * 0.65, z: distance * Math.sqrt(1 - 0.65 ** 2) }
        : { x: 0, y: distance * 0.1, z: distance * Math.sqrt(0.99) };
}

function resetView(shape = currentShape, animated = false) {
    if (!camera) return;
    if (currentCameraTween) currentCameraTween.stop();
    const position = viewPosition(shape);
    if (scene && scene.fog) scene.fog.density = shape === 'solar_system' ? 0.004 : 0.45 / Math.hypot(position.x, position.y, position.z);
    if (animated) {
        currentCameraTween = new TWEEN.Tween(camera.position)
            .to(position, 1000).easing(TWEEN.Easing.Cubic.Out)
            .onUpdate(() => camera.lookAt(0, 0, 0))
            .onComplete(() => { currentCameraTween = null; updateArrowPositions(); })
            .start();
    } else {
        camera.position.set(position.x, position.y, position.z);
        camera.lookAt(0, 0, 0);
        updateArrowPositions();
    }
}

function setupPointerControls(canvas) {
    const pointers = new Map();
    let lastPinchDistance = null;
    let didDrag = false;

    const normalizedPoint = (x, y) => {
        const rect = canvas.getBoundingClientRect();
        return new THREE.Vector2(((x - rect.left) / rect.width) * 2 - 1,
            -((y - rect.top) / rect.height) * 2 + 1);
    };
    const pinchDistance = () => {
        const points = [...pointers.values()];
        return Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
    };
    const zoom = (amount, point = new THREE.Vector2(0, 0)) => {
        if (currentShape !== 'solar_system' || isAnimating) return;
        camera.updateMatrixWorld(true);
        raycaster.setFromCamera(point, camera);
        const next = camera.position.clone().addScaledVector(raycaster.ray.direction, amount);
        const maxDistance = Math.max(150, Math.hypot(...Object.values(viewPosition('solar_system'))) * 2);
        if (next.length() >= 4 && next.length() <= maxDistance) camera.position.copy(next);
    };

    canvas.addEventListener('pointerdown', (event) => {
        if (event.pointerType === 'mouse' && event.button !== 0) return;
        if (!pointers.size) {
            didDrag = false;
            clickStartTime = Date.now();
            clickStartPos = { x: event.clientX, y: event.clientY };
        } else didDrag = true;
        pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
        canvas.setPointerCapture(event.pointerId);
        isMouseDragging = true;
        lastPinchDistance = pointers.size === 2 ? pinchDistance() : null;
    });
    canvas.addEventListener('pointermove', (event) => {
        if (!pointers.has(event.pointerId)) {
            const planet = getIntersectedPlanet(normalizedPoint(event.clientX, event.clientY));
            canvas.style.cursor = planet ? 'pointer' : 'grab';
            return;
        }
        const previous = pointers.get(event.pointerId);
        pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
        if (Math.hypot(event.clientX - clickStartPos.x, event.clientY - clickStartPos.y) > 8) didDrag = true;
        if (pointers.size >= 2) {
            didDrag = true;
            const distance = pinchDistance();
            if (lastPinchDistance !== null) zoom((distance - lastPinchDistance) * 0.12);
            lastPinchDistance = distance;
        } else if (particles && !isAnimating) {
            particles.rotation.y += (event.clientX - previous.x) * 0.005;
            particles.rotation.x += (event.clientY - previous.y) * 0.005;
        }
    });
    const endPointer = (event) => {
        if (!pointers.has(event.pointerId)) return;
        const isClick = event.type === 'pointerup' && !didDrag && pointers.size === 1 &&
            Date.now() - clickStartTime < 600 && !isAnimating;
        pointers.delete(event.pointerId);
        isMouseDragging = pointers.size > 0;
        lastPinchDistance = null;
        if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
        if (!isClick) return;
        const point = normalizedPoint(event.clientX, event.clientY);
        if (currentShape === 'solar_system') {
            const planet = getIntersectedPlanet(point);
            if (planet) explorePlanet(planet);
        } else if (currentShape === 'scatter') {
            raycaster.setFromCamera(point, camera);
            raycaster.params.Points.threshold = 0.5;
            const hit = raycaster.intersectObjects([leftArrow, rightArrow].filter(arrow => arrow && arrow.visible), false);
            if (hit.length) cycleNextTheme(hit[0].object.name === 'next_theme' ? 1 : -1);
        }
    };
    for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) canvas.addEventListener(name, endPointer);
    window.addEventListener('blur', () => { pointers.clear(); isMouseDragging = false; lastPinchDistance = null; });
    canvas.addEventListener('wheel', (event) => {
        event.preventDefault();
        if (isAnimating || event.deltaY === 0) return;
        if (currentShape === 'solar_system') {
            zoom(-Math.sign(event.deltaY) * 2, normalizedPoint(event.clientX, event.clientY));
        } else if (event.deltaY > 0) returnToScatter();
        else if (currentShape === 'scatter') toggleShape();
    }, { passive: false });
}

let targetRotationSpeedY = 0.0005;
let targetRotationSpeedX = 0;
let manualRotationSpeedY = 0;
let manualRotationSpeedX = 0;
let isManualControl = false;
let lastThemeSwitchTime = 0;
let isWarping = false;
let warpStartTime = 0;
let isMouseDragging = false;
let previousMousePosition = { x: 0, y: 0 };
let clickStartTime = 0;
let clickStartPos = { x: 0, y: 0 };

function updateStatusText(text) {
    const statusEl = document.getElementById('status');
    if (statusEl) {
        statusEl.innerText = text.replace(/^[^\p{L}\p{N}]+/u, '');
        statusEl.classList.add('active');
        // Clear active class after some time? No, the original code keeps it active or relies on transitions.
        // Actually original code doesn't remove 'active'. It just updates text.
    }
}

function cycleNextTheme(direction = 1) {
    if (currentShape !== 'scatter') return;
    if (isAnimating || isColorAnimating) return;

    const now = Date.now();
    if (now - lastThemeSwitchTime <= 1000) return; // Debounce slightly faster
    lastThemeSwitchTime = now;
    
    // Order: Sun -> Mercury -> Venus -> Earth -> Mars -> Jupiter -> Saturn -> Uranus -> Neptune -> Pluto -> Christmas -> BlackHole
    const themes = ['sun', 'mercury', 'venus', 'earth', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto', 'christmas', 'black_hole'];
    let idx = themes.indexOf(currentTheme);
    if (idx === -1) idx = 0;
    
    idx += direction;
    if (idx >= themes.length) idx = 0;
    if (idx < 0) idx = themes.length - 1;
    
    const newTheme = themes[idx];
    
    changeTheme(newTheme);
    updateSceneControls();
    
    let text = "";
    if (newTheme === 'christmas') text = "🎄 切换主题：圣诞树";
    else if (newTheme === 'pluto') text = "🪐 切换主题：冥王星";
    else if (newTheme === 'uranus') text = "❄️ 切换主题：天王星";
    else if (newTheme === 'sun') text = "☀️ 切换主题：太阳";
    else if (newTheme === 'mercury') text = "🌑 切换主题：水星";
    else if (newTheme === 'venus') text = "🌕 切换主题：金星";
    else if (newTheme === 'mars') text = "🔴 切换主题：火星";
    else if (newTheme === 'earth') text = "🌍 切换主题：地球";
    else if (newTheme === 'jupiter') text = "🟠 切换主题：木星";
    else if (newTheme === 'saturn') text = "🪐 切换主题：土星";
    else if (newTheme === 'neptune') text = "🔵 切换主题：海王星";
    else if (newTheme === 'black_hole') text = "⚫ 切换主题：卡冈图亚";
    
    updateStatusText(text);
}

let hands;
let isCameraActive = false;
let cameraStream = null;
let cameraRequestId = 0;
let cameraFrameId = null;
let cameraProcessing = false;

function initMediaPipe() {
    if (hands) return;

    hands = new Hands({
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
    });

    hands.setOptions({
        maxNumHands: 1,
        modelComplexity: 1,
        minDetectionConfidence: 0.6,
        minTrackingConfidence: 0.5
    });

    hands.onResults((res) => {
        if (!isCameraActive) return;
        
        if (res.multiHandLandmarks && res.multiHandLandmarks.length > 0) {
            const lm = res.multiHandLandmarks[0];
            
            const fingerTips = [8, 12, 16, 20];
            const fingerPips = [6, 10, 14, 18];
            
            // Count folded fingers (excluding thumb)
            let foldedCount = 0;
            let isIndexFolded = lm[8].y > lm[6].y;
            let isMiddleFolded = lm[12].y > lm[10].y;
            let isRingFolded = lm[16].y > lm[14].y;
            let isPinkyFolded = lm[20].y > lm[18].y;

            if (isIndexFolded) foldedCount++;
            if (isMiddleFolded) foldedCount++;
            if (isRingFolded) foldedCount++;
            if (isPinkyFolded) foldedCount++;
            
            // Logic:
            // 0. OK Gesture: Toggle Theme (Christmas <-> Pluto)
            // 1. Fist: All 4 folded (foldedCount == 4) -> Tree/Pluto Mode (Auto Rotate)
            // 2. Open Hand: foldedCount < 3 -> Scatter Mode (Manual Control)
            
            // OK Gesture Detection
            // Thumb (4) and Index (8) close.
            // Middle, Ring, Pinky extended.
            const distThumbIndex = Math.hypot(lm[4].x - lm[8].x, lm[4].y - lm[8].y);
            const isOk = (distThumbIndex < 0.08 && !isMiddleFolded && !isRingFolded && !isPinkyFolded);

            // Only allow theme switch if in Scatter mode and not currently animating/warping
            if (isOk && currentShape === 'scatter' && !isAnimating) {
                cycleNextTheme();
            } else {
                const isFist = (foldedCount === 4);

                if (isFist) {
                    // Tree/Pluto/Uranus/Sun/Mercury Mode
                    isManualControl = false;
                    const targetShape = currentTheme === 'solar_system' ? 'solar_system' : shapeForTheme();
                    

                    if (currentShape !== targetShape) {
                        morph(targetShape);
                        let text = "";
                        if (currentTheme === 'christmas') text = "🎄 握拳召唤：圣诞树模式";
                        else if (currentTheme === 'pluto') text = "🪐 握拳召唤：冥王星模式";
                        else if (currentTheme === 'uranus') text = "❄️ 握拳召唤：天王星模式";
                        else if (currentTheme === 'sun') text = "☀️ 握拳召唤：太阳模式";
                        else if (currentTheme === 'mercury') text = "🌑 握拳召唤：水星模式";
                        else if (currentTheme === 'venus') text = "🌕 握拳召唤：金星模式";
                        else if (currentTheme === 'mars') text = "🔴 握拳召唤：火星模式";
                        else if (currentTheme === 'earth') text = "🌍 握拳召唤：地球模式";
                        else if (currentTheme === 'jupiter') text = "🟠 握拳召唤：木星模式";
                        else if (currentTheme === 'saturn') text = "🪐 握拳召唤：土星模式";
                        else if (currentTheme === 'neptune') text = "🔵 握拳召唤：海王星模式";
                        else if (currentTheme === 'black_hole') text = "⚫ 握拳召唤：卡冈图亚模式";
                        
                        updateStatusText(text);
                    }
                } else {
                    // Open Hand / Scatter Mode
                    isManualControl = true;
                    if (currentShape !== 'scatter') {
                        morph('scatter');
                        updateStatusText("✨ 张开手掌：自由操控星云");
                    }
                    
                    // Control rotation based on Palm position (Index 0 or 9)
                    // Let's use Index 9 (Middle Finger MCP) as center anchor
                    const handX = lm[9].x;
                    const handY = lm[9].y;
                    
                    // Center is 0.5, 0.5
                    // Sensitivity factor
                    const sensitivity = 0.1;
                    
                    manualRotationSpeedY = (0.5 - handX) * sensitivity; 
                    manualRotationSpeedX = (0.5 - handY) * sensitivity;
                }
            }
        } else {
             // No hand detected
             isManualControl = false;
        }
    });

}


const songList = [
    'Abyss Pulse.wav',
    'Gravity Echo.wav',
    'Monument Zero.wav',
    'Pluto.wav',
    'Przybylski’s Star.wav'
];
let currentSongIndex = 0;

function updateMusicInfo() {
    const nameEl = document.getElementById('music-name');
    if (nameEl) {
        // Remove extension
        const name = songList[currentSongIndex].replace(/\.[^/.]+$/, "");
        nameEl.innerText = name;
    }
}

let musicRequestId = 0;

async function playMusic() {
    const bgm = document.getElementById('bgm');
    const toggle = document.getElementById('music-toggle');
    const requestId = ++musicRequestId;
    if (!bgm || !toggle.checked) return;
    try {
        await bgm.play();
    } catch (error) {
        if (requestId !== musicRequestId || !toggle.checked) return;
        toggle.checked = false;
        updateStatusText(error.name === 'NotAllowedError'
            ? '🎵 音乐未播放，请点击音乐开关重试'
            : '🎵 音乐加载失败，可切换下一首或重试');
    }
}

function playSong(index) {
    currentSongIndex = (index + songList.length) % songList.length;
    const bgm = document.getElementById('bgm');
    if (!bgm) return;
    ++musicRequestId;
    bgm.pause();
    bgm.src = 'music/' + encodeURIComponent(songList[currentSongIndex]);
    bgm.load();
    updateMusicInfo();
    if (document.getElementById('music-toggle').checked) void playMusic();
}

function nextSong() { playSong(currentSongIndex + 1); }
function prevSong() { playSong(currentSongIndex - 1); }

function toggleMusic(checkbox) {
    const bgm = document.getElementById('bgm');
    if (!bgm) return;
    if (checkbox.checked) {
        if (!bgm.getAttribute('src')) playSong(currentSongIndex);
        else void playMusic();
    } else {
        ++musicRequestId;
        bgm.pause();
    }
}

document.getElementById('bgm').addEventListener('error', () => {
    ++musicRequestId;
    document.getElementById('music-toggle').checked = false;
    updateStatusText('🎵 当前音乐加载失败，请切换下一首或重试');
});

function stopCamera() {
    ++cameraRequestId;
    isCameraActive = false;
    isManualControl = false;
    if (cameraFrameId !== null) cancelAnimationFrame(cameraFrameId);
    cameraFrameId = null;
    const video = document.getElementById('input_video');
    const streams = new Set([cameraStream, video.srcObject]);
    for (const stream of streams) {
        if (stream && typeof stream.getTracks === 'function') {
            for (const track of stream.getTracks()) track.stop();
        }
    }
    cameraStream = null;
    video.pause();
    video.srcObject = null;
    document.getElementById('video-container').style.display = 'none';
    document.getElementById('camera-toggle').checked = false;
}

function processCameraFrame(requestId) {
    if (!isCameraActive || requestId !== cameraRequestId) return;
    cameraFrameId = requestAnimationFrame(async () => {
        const video = document.getElementById('input_video');
        if (!isCameraActive || requestId !== cameraRequestId) return;
        if (!cameraProcessing && video.readyState >= 2) {
            cameraProcessing = true;
            try {
                await hands.send({ image: video });
            } catch (error) {
                if (requestId === cameraRequestId) {
                    stopCamera();
                    updateStatusText('🖐️ 手势识别加载失败，请重试；仍可拖动操作');
                }
            } finally {
                cameraProcessing = false;
            }
        }
        processCameraFrame(requestId);
    });
}

async function toggleCamera(checkbox) {
    if (!checkbox.checked) {
        stopCamera();
        updateStatusText('🖱️ 摄像头已关闭，可使用拖动操作');
        return;
    }
    const requestId = ++cameraRequestId;
    updateStatusText('🖐️ 正在启动摄像头…');
    try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            throw new Error('此浏览器不支持摄像头');
        }
        initMediaPipe();
        const stream = await navigator.mediaDevices.getUserMedia({
            audio: false, video: { width: { ideal: 480 }, height: { ideal: 360 }, facingMode: 'user' }
        });
        if (requestId !== cameraRequestId || !checkbox.checked) {
            stream.getTracks().forEach(track => track.stop());
            return;
        }
        cameraStream = stream;
        const video = document.getElementById('input_video');
        video.srcObject = stream;
        await video.play();
        if (requestId !== cameraRequestId || !checkbox.checked) return;
        isCameraActive = true;
        document.getElementById('video-container').style.display = 'block';
        processCameraFrame(requestId);
        updateStatusText('🖐️ 手势已开启：握拳凝聚 · 张手散开 · OK 切换主题');
    } catch (error) {
        if (requestId !== cameraRequestId) return;
        stopCamera();
        const denied = error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError';
        updateStatusText(denied ? '🖐️ 摄像头权限未开启，仍可使用拖动操作'
            : '🖐️ 摄像头启动失败，请检查设备或重试');
    }
}

window.addEventListener('pagehide', stopCamera);

window.addEventListener('keydown', (event) => {
    if (!appStarted || event.repeat || event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.target && (event.target.closest('input, select, textarea, summary') ||
        event.target.isContentEditable)) return;
    if (event.code === 'Space' && event.target && event.target.closest('button')) return;
    if (event.key === 'Escape') {
        event.preventDefault();
        returnToScatter();
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault();
        cycleNextTheme(event.key === 'ArrowRight' ? 1 : -1);
    } else if (event.code === 'Space') {
        event.preventDefault();
        toggleShape();
    }
});

function animate() {
    requestAnimationFrame(animate);
    TWEEN.update();
    
    const time = Date.now() * 0.001;
    
    if (particles) {
        // --- Countdown Logic ---
        if (currentShape === 'tree') {
            const now = new Date();
            const currentYear = now.getFullYear();
            let nextChristmas = new Date(currentYear, 11, 25); // Dec 25
            if (now > nextChristmas && now.getDate() !== 25) {
                nextChristmas = new Date(currentYear + 1, 11, 25);
            }
            
            // Check if today is Christmas (Dec 25)
            const isChristmasDay = (now.getMonth() === 11 && now.getDate() === 25);
            
            if (isChristmasDay) {
                // FIREWORKS MODE
                updateFireworks(time);
            } else {
                // COUNTDOWN MODE
                const diff = nextChristmas - now;
                
                // Format: DDD HH:MM:SS
                const days = Math.floor(diff / (1000 * 60 * 60 * 24));
                const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                const seconds = Math.floor((diff % (1000 * 60)) / 1000);
                const text = `${days}d ${hours}h ${minutes}m ${seconds}s`;
                updateCountdownParticles(text);
            }
        } else {
            // Hide countdown/fireworks if not tree
            hideCountdownParticles();
        }

        // Black Hole "Accretion" Animation
        if (currentShape === 'black_hole' && !isAnimating) {
             const positions = particles.geometry.attributes.position.array;
             const colors = particles.geometry.attributes.color.array;
             
             const tilt = 20 * Math.PI / 180;
             // Rotation Axis (Tilted Y)
             // Original Y is (0,1,0). Tilted by 20 deg around X.
             // New Y' = (0, cos(tilt), sin(tilt))
             const ny = Math.cos(tilt);
             const nz = Math.sin(tilt);
             
             // Speed factors
             const infallSpeedBase = 0.05;
             const rotateSpeedBase = 0.02;
             
             let needsUpdate = false;
             
             for(let i=0; i<PARTICLE_COUNT; i++) {
                 let px = positions[i*3];
                 let py = positions[i*3+1];
                 let pz = positions[i*3+2];
                 
                 // Distance from center
                 const d2 = px*px + py*py + pz*pz;
                 const d = Math.sqrt(d2);
                 
                 // Skip if too far (e.g. background stars not part of the hole structure)
                 // But user wants "surrounding particles collapsing".
                 // Let's affect everything within a large radius.
                 
                 if (d < 30.0) {
                     // 1. Infall
                     // Speed increases as 1/r
                     const speed = infallSpeedBase * (5.0 / (d + 0.1));
                     
                     // Move towards center
                     // Normalize vector P is (px/d, py/d, pz/d)
                     // P_new = P - P_norm * speed
                     const factor = 1.0 - (speed / d);
                     
                     px *= factor;
                     py *= factor;
                     pz *= factor;
                     
                     // 2. Swirl (Rotation around Axis)
                     // Angular velocity increases as 1/r^2 (Conservation of angular momentum)
                     // But let's cap it to avoid chaos
                     let angSpeed = rotateSpeedBase * (10.0 / (d + 0.1));
                     if (angSpeed > 0.2) angSpeed = 0.2;
                     
                     // Rotate P around Axis (0, ny, nz)
                     // Rodrigues' rotation formula simplification for this specific axis?
                     // Or just general vector rotation.
                     // Axis A = (0, ny, nz). Point P.
                     // P_rot = P*cos(theta) + (A x P)*sin(theta) + A*(A.P)*(1-cos(theta))
                     
                     const cosT = Math.cos(angSpeed);
                     const sinT = Math.sin(angSpeed);
                     
                     const dot = py*ny + pz*nz; // A.P (since Ax=0)
                     
                     // Cross Product (A x P)
                     // Cx = ny*pz - nz*py
                     // Cy = nz*px - 0
                     // Cz = 0 - ny*px
                     const cx = ny*pz - nz*py;
                     const cy = nz*px;
                     const cz = -ny*px;
                     
                     // Formula
                     const px_new = px*cosT + cx*sinT + 0; // Ax is 0
                     const py_new = py*cosT + cy*sinT + ny*dot*(1-cosT);
                     const pz_new = pz*cosT + cz*sinT + nz*dot*(1-cosT);
                     
                     px = px_new;
                     py = py_new;
                     pz = pz_new;
                     
                     // 3. Reset if swallowed (Event Horizon radius ~2.0 to 2.2)
                     // Let's swallow at r < 2.0
                     const newD = Math.sqrt(px*px + py*py + pz*pz);
                     if (newD < 2.1) {
                         // Respawn at outer edge of disk
                         const rRespawn = randomRange(13.0, 15.0);
                         const theta = Math.random() * Math.PI * 2;
                         
                         // Respawn on the main disk plane (tilted)
                         // Flat coords
                         const fx = rRespawn * Math.cos(theta);
                         const fy = randomRange(-0.2, 0.2); // Thin
                         const fz = rRespawn * Math.sin(theta);
                         
                         // Tilt it
                         px = fx;
                         py = fy * ny - fz * nz;
                         pz = fy * nz + fz * ny;
                         
                         // Reset color to dark red/brown (outer edge)
                         colors[i*3] = 0.2; 
                         colors[i*3+1] = 0.0; 
                         colors[i*3+2] = 0.0;
                     } else {
                         // Update Color based on new radius (Redshift/Heat)
                         // 2.1 -> 14.0
                         // Inner: White/Blue. Mid: Gold/Orange. Outer: Red.
                         
                         // Skip color update for Lensed particles? Hard to track index type.
                         // Just update all based on radius, it looks consistent.
                         
                         let rCol, gCol, bCol;
                           if (newD < 2.8) { // Ultra Bright Zone (Inner Edge)
                               // Boost values > 1.0 for simulated HDR/Overexposure in Additive Blending
                               rCol=1.5; gCol=1.5; bCol=1.5; 
                           } else if (newD < 5.0) {
                               // Gold/Yellow
                               rCol=1.0; gCol=0.9; bCol=0.5;
                          } else if (newD < 8.0) {
                              // Orange
                              rCol=1.0; gCol=0.4; bCol=0.0;
                          } else if (newD < 12.0) {
                              // Red
                              rCol=0.8; gCol=0.1; bCol=0.0;
                          } else {
                              // Dark Red/Black
                              rCol=0.3; gCol=0.0; bCol=0.0;
                          }
                          
                          // Blend faster for responsiveness
                          const blend = 0.2;
                          colors[i*3] += (rCol - colors[i*3]) * blend;
                          colors[i*3+1] += (gCol - colors[i*3+1]) * blend;
                          colors[i*3+2] += (bCol - colors[i*3+2]) * blend;
                     }
                     
                     positions[i*3] = px;
                     positions[i*3+1] = py;
                     positions[i*3+2] = pz;
                     
                     needsUpdate = true;
                 }
             }
             
             if (needsUpdate) {
                 particles.geometry.attributes.position.needsUpdate = true;
                 particles.geometry.attributes.color.needsUpdate = true;
             }
        }

        // Normal behavior
        // Continuous slow rotation or manual control
        if (isMouseDragging) {
             // Mouse has control, pause auto-rotation
        } else if (isManualControl && isCameraActive) {
            particles.rotation.y += manualRotationSpeedY;
            particles.rotation.x += manualRotationSpeedX;
        } else {
            // Auto rotate only Y in tree mode
            particles.rotation.y += targetRotationSpeedY;
            // Slowly restore X to 0 if it was changed
            if (currentShape !== 'solar_system') particles.rotation.x *= 0.95;
        }
        
        // Twinkle effect
        // Breathing
        const scale = 1 + Math.sin(time * 0.5) * 0.02;
        particles.scale.set(scale, scale, scale);
    }
    
    renderer.render(scene, camera);
}

async function startApp() {
    if (appStarted) return;
    const btn = document.getElementById('start-btn');
    const overlay = document.getElementById('overlay');
    
    btn.disabled = true;
    btn.innerText = "正在进入…";

    try {
        initThree();
        animate();
        appStarted = true;
        document.querySelector('.scene-controls').hidden = false;
        document.querySelector('.help-control').hidden = false;
        updateSceneControls();
        // Play within the entry click so browser autoplay policies can allow it.
        playSong(0);
        
        // Transition UI
        overlay.style.opacity = '0';
        setTimeout(() => {
            overlay.style.display = 'none';
            
            // Show Controls after launch
            const controls = document.querySelector('.controls-container');
            if (controls) controls.style.display = 'flex';
            
            // Music playback was requested synchronously from the entry click.
            
            // Show Solar System button if in scatter mode (default is scatter)
            // But wait, initial state is 'scatter'. 
            // So we should show it.
            const ssBtn = document.getElementById('solar-system-btn');
            if (ssBtn && currentShape === 'scatter') ssBtn.style.display = 'block';
            
        }, 800);
        
        document.getElementById('status').classList.add('active');
        updateStatusText('✨ 拖动旋转 · 点击「凝聚」探索 · 查看右下角操作说明');

    } catch (e) {
        console.error(e);
        alert("Initialization Failed: " + e.message);
        btn.disabled = false;
        btn.innerText = "重新尝试";
    }
}

// Window Resize
window.addEventListener('resize', () => {
    if(!camera || !renderer) return;
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    if (currentShape !== 'scatter') resetView(currentShape);
    else updateArrowPositions();
});

