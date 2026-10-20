/* Glowing particle scenes beyond the solar system: nearby stars, the Milky Way, the Local Group.
   Physics lives in DeepData; this file only builds particles and moves them. */
(function deepSpaceRenderer(root) {
    'use strict';
    const X = root.DeepData;
    const SCALES = Object.freeze({
        stars:  {name: '近邻恒星', unit: '光年', radius: 13.5, center: [0, 0, 0],
                 rates: [[0, '暂停'], [10, '10 年 / 秒'], [100, '100 年 / 秒'], [1000, '1000 年 / 秒'], [10000, '1 万年 / 秒']], rate: 1000},
        galaxy: {name: '银河系', unit: '千光年', radius: 56, center: [0, 0, 0],
                 rates: [[0, '暂停'], [.1, '10 万年 / 秒'], [1, '100 万年 / 秒'], [10, '1000 万年 / 秒']], rate: 1},
        local:  {name: '本星系群', unit: '万光年', radius: 150, center: null,
                 rates: [[0, '暂停'], [10, '1000 万年 / 秒'], [100, '1 亿年 / 秒'], [300, '3 亿年 / 秒']], rate: 100}
    });
    const BINARY_DISPLAY_AU = .012;   // ly per AU on screen: separations are magnified ~760× so the pairs can be seen
    const BINARY_RATE_CAP = 160;      // °/s: faster than this, the pair turns at a display speed instead of strobing

    function seeded(seed) {
        let t = seed >>> 0;
        return () => { t += 0x6D2B79F5; let r = Math.imul(t ^ t >>> 15, 1 | t); r ^= r + Math.imul(r ^ r >>> 7, 61 | r); return ((r ^ r >>> 14) >>> 0) / 4294967296; };
    }
    const hex = value => [parseInt(value.slice(1, 3), 16) / 255, parseInt(value.slice(3, 5), 16) / 255, parseInt(value.slice(5, 7), 16) / 255];
    const gauss = random => Math.sqrt(-2 * Math.log(random() || 1e-9)) * Math.cos(2 * Math.PI * random());
    // Blackbody-like colour by spectral class (O … M), white dwarfs a cool white.
    function spectralColor(sp) {
        if (/^D/.test(sp)) return hex('#e2ebff');
        return hex({O: '#9bb0ff', B: '#aabfff', A: '#cad7ff', F: '#f8f7ff', G: '#fff1dc', K: '#ffcf96', M: '#ff9e5e'}[sp[0]] || '#ffffff');
    }
    // On-screen star radius from luminosity (ly): the Sun 0.12, Sirius ≈ 0.19, red dwarfs ≈ 0.06.
    const starRadius = lum => 2.2 * Math.max(.055, Math.min(.3, .12 + .05 * Math.log10(lum)));

    class DeepSpace {
        constructor(THREE, parent, texture) {
            Object.assign(this, {THREE, texture});
            this.groups = {};
            this.glow = this.makeGlowTexture();
            for (const scale of Object.keys(SCALES)) {
                const group = new THREE.Group(); group.visible = false; parent.add(group); this.groups[scale] = group;
            }
            this.buildStars();
            this.buildGalaxy();
            this.buildLocalGroup();
            this.binaryPhase = new Map();
        }
        makeGlowTexture() {
            const T = this.THREE;
            if (typeof document === 'undefined') return null;
            const canvas = document.createElement('canvas'); canvas.width = canvas.height = 128;
            const ctx = canvas.getContext('2d'), g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
            g.addColorStop(0, 'rgba(255,255,255,0.9)'); g.addColorStop(.2, 'rgba(255,255,255,0.35)');
            g.addColorStop(.5, 'rgba(255,255,255,0.08)'); g.addColorStop(1, 'rgba(255,255,255,0)');
            ctx.fillStyle = g; ctx.fillRect(0, 0, 128, 128);
            return new T.CanvasTexture(canvas);
        }
        points(positions, colors, size, opacity = .9) {
            const T = this.THREE, geometry = new T.BufferGeometry();
            geometry.setAttribute('position', positions instanceof Float32Array ? new T.BufferAttribute(positions, 3) : new T.Float32BufferAttribute(positions, 3));
            geometry.setAttribute('color', new T.Float32BufferAttribute(colors, 3));
            const mesh = new T.Points(geometry, new T.PointsMaterial({size, map: this.texture, vertexColors: true, transparent: true, opacity,
                blending: T.AdditiveBlending, depthWrite: false}));
            mesh.frustumCulled = false;
            return mesh;
        }
        halo(color, size, opacity = .55) {
            const T = this.THREE;
            if (!this.glow || !T.Sprite) return null;
            const sprite = new T.Sprite(new T.SpriteMaterial({map: this.glow, color: new T.Color(...color), blending: T.AdditiveBlending, transparent: true, depthWrite: false, opacity}));
            sprite.scale.set(size, size, 1);
            return sprite;
        }
        // A glowing particle ball, built like the sun: a palette of the star's colour, warmer edges and white sparks.
        starBall(radius, color, count, seed) {
            const random = seeded(seed), positions = [], colors = [];
            const warm = color.map((v, i) => Math.min(1, v * [1.05, .82, .6][i])), white = [1, 1, 1];
            for (let i = 0; i < count; i++) {
                const z = random() * 2 - 1, a = random() * Math.PI * 2, s = Math.sqrt(1 - z * z), r = radius * Math.cbrt(.35 + .65 * random());
                positions.push(s * Math.cos(a) * r, z * r, s * Math.sin(a) * r);
                const pick = random(); colors.push(...(pick > .75 ? white : pick > .45 ? color : warm));
            }
            const group = new this.THREE.Group();
            group.add(this.points(positions, colors, Math.max(.025, radius * .32), .85));
            const glow = this.halo(color, radius * 9, .7);
            if (glow) group.add(glow);
            return group;
        }

        // ---------- Nearby stars (1 unit = 1 light-year) ----------
        buildStars() {
            const group = this.groups.stars, T = this.THREE;
            this.starMeshes = new Map();
            X.STARS.forEach((star, index) => {
                const color = star.id === 'sun' ? hex('#ffe08a') : spectralColor(star.sp);
                const radius = starRadius(star.lum), count = Math.round(80 + 380 * radius);
                const mesh = this.starBall(radius, color, count, 900 + index * 31);
                group.add(mesh); this.starMeshes.set(star.id, mesh);
            });
            // Future path of each star over the next 10,000 years (straight-line space motion).
            this.starPaths = new T.Group(); group.add(this.starPaths);
            for (const star of X.STARS) {
                if (star.id === 'sun' || /B$/.test(star.id)) continue;
                const geometry = new T.BufferGeometry();
                geometry.setAttribute('position', new T.BufferAttribute(new Float32Array(6), 3));
                const line = new T.Line(geometry, new T.LineBasicMaterial({color: new T.Color(...spectralColor(star.sp)), transparent: true, opacity: .1}));
                line.frustumCulled = false; line.userData.star = star.id; this.starPaths.add(line);
            }
            // The Oort cloud around the Sun: inner edge ~2,000 AU, outer ~100,000 AU (≈ 1.6 ly), number density ∝ r^-3.5.
            const random = seeded(77), positions = [], colors = [];
            for (let i = 0; i < 5000; i++) {
                const u = random(), rAU = 2000 * Math.pow(1 - u * (1 - Math.pow(2000 / 100000, 2.5)), -1 / 2.5);
                const r = rAU / 63241.077, z = random() * 2 - 1, a = random() * Math.PI * 2, s = Math.sqrt(1 - z * z);
                const flatten = rAU < 20000 ? .45 : 1; // the inner (Hills) cloud is more disk-like
                positions.push(s * Math.cos(a) * r, z * r * flatten, s * Math.sin(a) * r);
                const shade = .35 + random() * .5; colors.push(.6 * shade, .75 * shade, shade);
            }
            this.oort = this.points(positions, colors, .07, .45); group.add(this.oort);
            // A faint grid of the galactic plane, 5 ly rings, for depth.
            for (const r of [5, 10]) {
                const ring = new Float32Array(129 * 3);
                for (let i = 0; i <= 128; i++) { const t = i / 128 * Math.PI * 2; ring.set([Math.cos(t) * r, 0, Math.sin(t) * r], i * 3); }
                const geometry = new T.BufferGeometry(); geometry.setAttribute('position', new T.BufferAttribute(ring, 3));
                const line = new T.Line(geometry, new T.LineBasicMaterial({color: 0x8fa3c8, transparent: true, opacity: .07}));
                line.frustumCulled = false; group.add(line);
            }
        }
        updateStars(years, dt, rate) {
            const year = 2026.8 + years;
            const positions = new Map(X.STARS.map(star => [star.id, X.starPosition(star.id, years)]));
            for (const binary of X.BINARIES) {
                // True orbital phase while it is watchable; otherwise a capped display spin keeps the pair from strobing.
                const wallRate = 360 / binary.period * rate;
                let phaseYear = year;
                if (Math.abs(wallRate) > BINARY_RATE_CAP) {
                    const previous = this.binaryPhase.get(binary.a) ?? year;
                    phaseYear = previous + BINARY_RATE_CAP / 360 * binary.period * dt;
                }
                this.binaryPhase.set(binary.a, phaseYear);
                const offset = X.binaryOffset(binary, phaseYear), centre = positions.get(binary.a);
                positions.set(binary.b, centre.map((v, i) => v + offset.b[i] * BINARY_DISPLAY_AU));
                positions.set(binary.a, centre.map((v, i) => v + offset.a[i] * BINARY_DISPLAY_AU));
            }
            for (const [id, mesh] of this.starMeshes) mesh.position.fromArray(positions.get(id));
            for (const line of this.starPaths.children) {
                const now = X.starPosition(line.userData.star, years), later = X.starPosition(line.userData.star, years + 10000);
                line.geometry.attributes.position.array.set([...now, ...later]);
                line.geometry.attributes.position.needsUpdate = true;
            }
        }

        // ---------- Milky Way (1 unit = 1,000 light-years) ----------
        // A barred spiral: bar and bulge, an exponential disk, and four logarithmic arms.
        spiralGalaxy({count, radius, scale, barHalf, barAngle, armPitch, seed, sizeFactor = 1, hii = true}) {
            const random = seeded(seed), stars = [], arms = [], bar = [];
            const bulge = [hex('#ffd9a0'), hex('#ffc078'), hex('#fff0d0')], disk = [hex('#fff4e0'), hex('#ffe2b8'), hex('#cfd8ff')];
            const armColors = [hex('#a9c4ff'), hex('#d6e2ff'), hex('#ffffff'), hex('#bcd0ff')], nebula = [hex('#ff7fb0'), hex('#ff9ad0')];
            const pick = (list) => list[Math.floor(random() * list.length)];
            const k = 1 / Math.tan(armPitch * X.DEG);
            for (let i = 0; i < count; i++) {
                const kind = random();
                if (kind < .2) {  // bar + bulge
                    const along = gauss(random) * barHalf * .5, across = gauss(random) * barHalf * .2, up = gauss(random) * barHalf * .14;
                    const a = barAngle * X.DEG, x = along * Math.cos(a) - across * Math.sin(a), y = along * Math.sin(a) + across * Math.cos(a);
                    bar.push({r: Math.hypot(x, y), theta: Math.atan2(y, x), z: up, color: pick(bulge)});
                } else if (kind < .58) {  // exponential disk
                    let r = -scale * Math.log(random() * random() || 1e-6) * .55;
                    if (r > radius) r = random() * radius;
                    stars.push({r, theta: random() * Math.PI * 2, z: gauss(random) * .35 * (1 - r / radius * .5), color: pick(disk)});
                } else {  // spiral arms (density wave), drawn in the pattern frame
                    const arm = Math.floor(random() * 4), r = barHalf * .8 + Math.pow(random(), .9) * (radius - barHalf * .8);
                    const spread = gauss(random) * (.9 + r * .03);
                    const theta = arm * Math.PI / 2 + k * Math.log(r / (radius * .5)) + spread / r;
                    arms.push({r, theta, z: gauss(random) * .18, color: hii && random() > .9 ? pick(nebula) : pick(armColors)});
                }
            }
            const build = (list, size, opacity) => {
                const positions = new Float32Array(list.length * 3), colors = [];
                for (const item of list) colors.push(...item.color.map(v => v * (.55 + random() * .45)));
                const mesh = this.points(positions, colors, size * sizeFactor, opacity);
                mesh.userData.items = list;
                return mesh;
            };
            return {stars: build(stars, .32, .55), arms: build(arms, .42, .7), bar: build(bar, .34, .6)};
        }
        // Place particles of a disk: rotated in-plane, then the disk tilted onto its normal.
        static placeDisk(mesh, angleOf, basis) {
            const array = mesh.geometry.attributes.position.array, items = mesh.userData.items;
            for (let i = 0; i < items.length; i++) {
                const {r, z} = items[i], t = angleOf(items[i]), x = r * Math.cos(t), y = r * Math.sin(t);
                // basis: in-plane axes u, v and normal n in world coordinates
                array[i * 3] = basis.o[0] + x * basis.u[0] + y * basis.v[0] + z * basis.n[0];
                array[i * 3 + 1] = basis.o[1] + x * basis.u[1] + y * basis.v[1] + z * basis.n[1];
                array[i * 3 + 2] = basis.o[2] + x * basis.u[2] + y * basis.v[2] + z * basis.n[2];
            }
            mesh.geometry.attributes.position.needsUpdate = true;
        }
        buildGalaxy() {
            const W = X.MILKY_WAY, group = this.groups.galaxy, T = this.THREE;
            // In-plane axes in galactic coordinates (x toward the centre from the Sun, y toward rotation) mapped to world.
            this.galaxyBasis = {o: [0, 0, 0], u: X.galacticToWorld([1, 0, 0]), v: X.galacticToWorld([0, 1, 0]), n: X.galacticToWorld([0, 0, 1])};
            // Bar near end points toward positive galactic longitude, 27° from the Sun–centre line.
            const parts = this.spiralGalaxy({count: 34000, radius: W.radius, scale: W.diskScale, barHalf: W.barHalfLength,
                barAngle: 180 - W.barAngle, armPitch: W.armPitch, seed: 4242});
            this.mwStars = parts.stars; this.mwArms = parts.arms; this.mwBar = parts.bar;
            // Arms in the pattern frame start with the Sun (at θ = 180°) between two arms, as in the Orion Spur.
            for (const item of this.mwArms.userData.items) item.theta += Math.PI + Math.PI / 4 - (1 / Math.tan(W.armPitch * X.DEG)) * Math.log(W.sunRadius / (W.radius * .5));
            group.add(this.mwStars); group.add(this.mwArms); group.add(this.mwBar);
            const core = this.halo(hex('#ffd59a'), 30, .55); if (core) group.add(core);
            // The Sun and its galactic orbit.
            this.sunMarker = this.starBall(.55, hex('#ffe08a'), 160, 11); group.add(this.sunMarker);
            const ring = new Float32Array(257 * 3);
            for (let i = 0; i <= 256; i++) { const t = i / 256 * Math.PI * 2; ring.set(X.galacticToWorld([W.sunRadius * Math.cos(t), W.sunRadius * Math.sin(t), 0]), i * 3); }
            const geometry = new T.BufferGeometry(); geometry.setAttribute('position', new T.BufferAttribute(ring, 3));
            this.sunOrbit = new T.Line(geometry, new T.LineBasicMaterial({color: 0xffd27a, transparent: true, opacity: .18}));
            this.sunOrbit.frustumCulled = false; group.add(this.sunOrbit);
        }
        updateGalaxy(myr) {
            const W = X.MILKY_WAY, basis = this.galaxyBasis;
            // Stars: differential rotation, Ω(r) = v(r)/r, clockwise seen from the north galactic pole.
            DeepSpace.placeDisk(this.mwStars, item => item.theta - X.angularSpeed(item.r) * myr, basis);
            // Arms: a density wave turning rigidly at the pattern speed.
            const pattern = X.patternSpeedRadPerMyr() * myr;
            DeepSpace.placeDisk(this.mwArms, item => item.theta - pattern, basis);
            // The bar is a separate, faster pattern (≈ 40 km/s/kpc).
            const barPattern = 40 * X.KLY_PER_MYR_PER_KMS / X.LY_PER_PC * myr;
            DeepSpace.placeDisk(this.mwBar, item => item.theta - barPattern, basis);
            const sunTheta = Math.PI - X.angularSpeed(W.sunRadius) * myr;
            this.sunMarker.position.fromArray(X.galacticToWorld([W.sunRadius * Math.cos(sunTheta), W.sunRadius * Math.sin(sunTheta), W.sunHeight]));
            this.sunTheta = sunTheta;
        }

        // ---------- Local Group (1 unit = 10,000 light-years) ----------
        buildLocalGroup() {
            const group = this.groups.local;
            this.localGalaxies = [];
            const specs = {milkyway: {count: 9000, seed: 1}, m31: {count: 14000, seed: 2}, m33: {count: 4000, seed: 3}, lmc: {count: 2200, seed: 4}, smc: {count: 1200, seed: 5}};
            for (const galaxy of X.GALAXIES) {
                // Distances are true; the three spirals are drawn 2× larger so their structure can be seen.
                const radius = galaxy.radiusKly / 10 * (galaxy.id === 'lmc' || galaxy.id === 'smc' ? 1 : 2);
                const parts = this.spiralGalaxy({count: specs[galaxy.id].count, radius, scale: radius * .3, barHalf: radius * (galaxy.id === 'm33' ? .08 : .25),
                    barAngle: 20, armPitch: galaxy.id === 'lmc' || galaxy.id === 'smc' ? 40 : 14, seed: specs[galaxy.id].seed, sizeFactor: .12 + radius * .012, hii: galaxy.id !== 'smc'});
                const n = galaxy.normal, ref = Math.abs(n[1]) < .9 ? [0, 1, 0] : [1, 0, 0];
                const u = [n[1] * ref[2] - n[2] * ref[1], n[2] * ref[0] - n[0] * ref[2], n[0] * ref[1] - n[1] * ref[0]], ul = Math.hypot(...u);
                const uu = u.map(v => v / ul), vv = [n[1] * uu[2] - n[2] * uu[1], n[2] * uu[0] - n[0] * uu[2], n[0] * uu[1] - n[1] * uu[0]];
                const basis = galaxy.id === 'milkyway' ? this.galaxyBasis && {...this.galaxyBasis, o: [0, 0, 0]} : {o: [0, 0, 0], u: uu, v: vv, n};
                group.add(parts.stars); group.add(parts.arms); group.add(parts.bar);
                const glow = this.halo(hex(galaxy.id === 'm31' ? '#ffe2b0' : '#dfe6ff'), radius * 1.4, .4);
                if (glow) group.add(glow);
                this.localGalaxies.push({galaxy, parts, basis, glow, radius});
            }
        }
        // Galaxy spin in this view is capped at a display speed: at 100 Myr/s a real disk turns ~0.6 times a second.
        updateLocalGroup(myr, spinMyr = myr) {
            const m31 = X.andromeda(myr), start = X.galaxyById.m31.distanceKly;
            for (const item of this.localGalaxies) {
                const {galaxy, parts, basis, glow} = item;
                let distance = galaxy.distanceKly;
                // Andromeda falls toward us under gravity; Triangulum, its satellite, comes along.
                if (galaxy.id === 'm31') distance = m31.distanceKly;
                const centre = galaxy.direction.map(v => v * distance / 10);
                if (galaxy.id === 'm33') {
                    const shift = X.galaxyById.m31.direction.map(v => v * (m31.distanceKly - start) / 10);
                    centre.forEach((v, i) => centre[i] = v + shift[i]);
                }
                basis.o = centre;
                const pattern = X.angularSpeed(item.radius * 5, galaxy.vRot) * spinMyr;
                DeepSpace.placeDisk(parts.stars, s => s.theta - X.angularSpeed(s.r * 10, galaxy.vRot) * spinMyr, basis);
                DeepSpace.placeDisk(parts.arms, s => s.theta - pattern, basis);
                DeepSpace.placeDisk(parts.bar, s => s.theta - pattern * 1.4, basis);
                if (glow) glow.position.fromArray(centre);
                item.centre = centre;
                if (galaxy.id === 'm31') this.m31State = m31;
            }
        }

        // Keep galaxy particles about 2 px wide at any distance, dimmed by how crowded they are on screen.
        adjust(scale, camera, perPixel) {
            if (scale !== 'local' || !this.localGalaxies) return;
            for (const item of this.localGalaxies) {
                if (!item.centre) continue;
                const d = Math.hypot(...item.centre.map((v, i) => v - [camera.x, camera.y, camera.z][i])) || 1;
                const radiusPx = item.radius / d / perPixel, size = d * perPixel * 2;
                for (const mesh of [item.parts.stars, item.parts.arms, item.parts.bar]) {
                    const count = mesh.userData.items.length || 1;
                    mesh.material.size = size;
                    mesh.material.opacity = Math.max(.04, Math.min(.6, 1.1 * radiusPx * radiusPx / count));
                }
                if (item.glow) item.glow.scale.set(item.radius * 1.6, item.radius * 1.6, 1);
            }
        }
        setScale(scale) {
            for (const [name, group] of Object.entries(this.groups)) group.visible = name === scale;
        }
        // Where the camera should look, in world units.
        center(scale, myr = 0) {
            if (scale !== 'local') return [0, 0, 0];
            const m31 = X.andromeda(myr).distanceKly / 10;
            return X.galaxyById.m31.direction.map(v => v * m31 * .5);
        }
        radius(scale, myr = 0) {
            if (scale !== 'local') return SCALES[scale].radius;
            return Math.max(30, X.andromeda(myr).distanceKly / 10 * .5 + 14);
        }
        update(scale, time, dt, rate) {
            if (scale === 'stars') this.updateStars(time, dt, rate);
            else if (scale === 'galaxy') this.updateGalaxy(time);
            else if (scale === 'local') {
                this.localSpin = (this.localSpin || 0) + dt * Math.min(rate, 4);
                this.updateLocalGroup(time, this.localSpin);
            }
        }
    }
    DeepSpace.SCALES = SCALES;
    DeepSpace.BINARY_DISPLAY_AU = BINARY_DISPLAY_AU;
    root.DeepSpace = DeepSpace;
})(globalThis);
