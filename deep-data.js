/* Stars, galaxies and their motions beyond the solar system. Units: light-years (ly), years, km/s.
   Catalogue values from SIMBAD (CDS, queried 2026-10-21); see SOLAR_MODEL.md. */
(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    else root.DeepData = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';
    const DEG = Math.PI / 180;
    const LY_PER_PC = 3.261563777;
    const PC_PER_YEAR_PER_KMS = 1.0227121650537077e-6;           // 1 km/s ≈ 1.0227 pc per Myr
    const LY_PER_YEAR_PER_KMS = PC_PER_YEAR_PER_KMS * LY_PER_PC;   // ≈ 3.336e-6 ly/yr
    const KLY_PER_MYR_PER_KMS = LY_PER_YEAR_PER_KMS * 1e3;         // ≈ 3.336e-3 kly/Myr
    const G_KLY_MYR = 4.30091e-6 * LY_PER_PC * Math.pow(KLY_PER_MYR_PER_KMS, 2); // kly³ / (M☉ Myr²)

    // ICRS (J2000) equatorial → galactic rotation (Hipparcos convention).
    const EQ_TO_GAL = [[-0.0548755604, -0.8734370902, -0.4838350155],
                       [ 0.4941094279, -0.4448296300,  0.7469822445],
                       [-0.8676661490, -0.1980763734,  0.4559837762]];
    const mul = (m, v) => m.map(row => row[0] * v[0] + row[1] * v[1] + row[2] * v[2]);
    function equatorialUnit(raDeg, decDeg) {
        const ra = raDeg * DEG, dec = decDeg * DEG;
        return [Math.cos(dec) * Math.cos(ra), Math.cos(dec) * Math.sin(ra), Math.sin(dec)];
    }
    const toGalactic = v => mul(EQ_TO_GAL, v);
    // Galactic (x toward the centre, y toward rotation, z north) → renderer (x, y up, z): right-handed.
    const galacticToWorld = v => [v[0], v[2], -v[1]];
    function galacticLongitudeLatitude(raDeg, decDeg) {
        const g = toGalactic(equatorialUnit(raDeg, decDeg));
        return [((Math.atan2(g[1], g[0]) / DEG) + 360) % 360, Math.asin(g[2]) / DEG];
    }

    // [id, name, RA°, Dec°, parallax mas, pmRA* mas/yr, pmDec mas/yr, radial velocity km/s, spectral type, L/L☉, M/M☉]
    // Luminosity and mass are standard literature values used only for size and binary barycentres.
    const STAR_ROWS = [
        ['sun','太阳',0,0,0,0,0,0,'G2V',1,1],
        ['alfCenA','南门二 A',219.902058,-60.833993,742.12,-3679.25,473.67,-21.4,'G2V',1.52,1.079],
        ['alfCenB','南门二 B',219.896096,-60.837528,742.12,-3614.39,802.98,-21.4,'K1V',.5,.909],
        ['proxima','比邻星',217.428942,-62.67949,768.0665,-3781.741,769.465,-20.578199,'M5.5Ve',.0017,.122],
        ['barnard','巴纳德星',269.452077,4.693365,546.9759,-801.551,10362.394,-110.11,'M4V',.0035,.144],
        ['wolf359','沃尔夫 359',164.120504,7.014723,415.1794,-3866.338,-2699.215,19.57,'M6V',.0011,.11],
        ['lalande21185','拉兰德 21185',165.834145,35.969882,392.7529,-580.057,-4776.589,-84.64,'M2V',.021,.39],
        ['sirius','天狼星 A',101.287155,-16.716116,379.21,-546.01,-1223.07,-5.5,'A1V',25.4,2.063],
        ['siriusB','天狼星 B',101.288767,-16.716868,379.21,-546.01,-1223.07,-5.5,'DA2',.056,1.018],
        ['uvCeti','鲸鱼座 UV',24.756824,-17.950278,373.8443,3178.694,584.061,22.01,'M6V',.00006,.1],
        ['blCeti','鲸鱼座 BL',24.755739,-17.950719,367.7119,3385.316,544.386,19.82,'M5.5V',.00009,.12],
        ['ross154','罗斯 154',282.455682,-23.836235,336.0266,639.368,-193.958,-10.494,'M3.5Ve',.0038,.18],
        ['ross248','罗斯 248',355.479318,44.17745,316.4812,112.527,-1591.65,-77.51,'M5V',.0018,.14],
        ['epsEri','天苑四',53.232685,-9.458261,310.5773,-974.758,20.876,16.376,'K2V',.34,.82],
        ['lacaille9352','拉卡伊 9352',346.466816,-35.853071,304.1354,6765.995,1330.285,8.82,'M2V',.036,.49],
        ['ross128','罗斯 128',176.934989,.804556,296.3053,607.299,-1223.028,-30.66,'M4V',.0036,.17],
        ['cyg61A','天鹅座 61 A',316.724748,38.749417,285.9949,4164.209,3249.614,-65.82,'K5V',.15,.7],
        ['cyg61B','天鹅座 61 B',316.730266,38.742044,285.9949,4164.209,3249.614,-65.82,'K7V',.085,.63],
        ['procyon','南河三 A',114.825498,5.224988,284.56,-714.59,-1036.8,-4.50528,'F5IV',6.9,1.499],
        ['procyonB','南河三 B',114.8245,5.224111,284.56,-714.59,-1036.8,-4.50528,'DQZ',.00049,.592],
        ['tauCet','天仓五',26.017013,-15.93748,273.8097,-1721.728,854.963,-16.597,'G8V',.52,.78],
        ['altair','河鼓二（牛郎星）',297.695827,8.868321,194.95,536.23,385.29,-26.6,'A7V',10.6,1.86],
        ['vega','织女一（织女星）',279.234735,38.783689,130.23,200.94,286.23,-13.5,'A0V',40.1,2.14],
        ['arcturus','大角星',213.9153,19.182409,88.83,-1093.39,-2000.06,-5.229,'K1.5III',170,1.08]
    ];
    // Binary pairs share the system's catalogue motion; separations in AU, periods in years.
    // Orbits: α Cen (Pourbaix & Boffin 2016), Sirius (Bond et al. 2017), Procyon (Bond et al. 2015), 61 Cyg (approx.).
    const BINARIES = [
        {a:'alfCenA',b:'alfCenB',period:79.91,e:.5208,au:23.52,inclination:79.32,node:205.07,argument:232.3,periastron:1955.66},
        {a:'sirius',b:'siriusB',period:50.13,e:.5916,au:19.8,inclination:136.3,node:45.4,argument:149.2,periastron:1994.57},
        {a:'procyon',b:'procyonB',period:40.84,e:.4,au:15.0,inclination:31.1,node:97.3,argument:89.2,periastron:1967.97},
        {a:'cyg61A',b:'cyg61B',period:678,e:.4,au:84,inclination:51,node:172,argument:149,periastron:1709}
    ];
    const STARS = STAR_ROWS.map(([id, name, ra, dec, plx, pmra, pmdec, rv, sp, lum, mass]) => {
        if (id === 'sun') return Object.freeze({id, name, sp, lum, mass, position: [0, 0, 0], velocity: [0, 0, 0], distance: 0});
        const distancePc = 1000 / plx, distance = distancePc * LY_PER_PC;
        const r = equatorialUnit(ra, dec), a = ra * DEG, d = dec * DEG;
        const east = [-Math.sin(a), Math.cos(a), 0], north = [-Math.sin(d) * Math.cos(a), -Math.sin(d) * Math.sin(a), Math.cos(d)];
        // Space velocity (km/s): radial part along the line of sight, tangential part 4.74·μ·d.
        const vt = 4.740470446 * distancePc / 1000;
        const vEq = r.map((value, i) => rv * value + vt * (pmra * east[i] + pmdec * north[i]));
        return Object.freeze({id, name, ra, dec, sp, lum, mass, distance,
            position: galacticToWorld(toGalactic(r.map(v => v * distance))),
            velocity: galacticToWorld(toGalactic(vEq)).map(v => v * LY_PER_YEAR_PER_KMS)});
    });
    const starById = Object.freeze(Object.fromEntries(STARS.map(star => [star.id, star])));

    function solveKepler(mean, e) {
        let E = e < .8 ? mean : Math.PI;
        for (let i = 0; i < 50; i++) { const d = (E - e * Math.sin(E) - mean) / (1 - e * Math.cos(E)); E -= d; if (Math.abs(d) < 1e-12) break; }
        return E;
    }
    // Relative orbit of a visual binary projected with its Campbell elements, then shared by
    // barycentre: each star moves opposite its partner in proportion to the other's mass.
    function binaryOffset(binary, year) {
        const mean = 2 * Math.PI * (((year - binary.periastron) / binary.period) % 1);
        const E = solveKepler(mean, binary.e), nu = 2 * Math.atan2(Math.sqrt(1 + binary.e) * Math.sin(E / 2), Math.sqrt(1 - binary.e) * Math.cos(E / 2));
        const r = binary.au * (1 - binary.e * Math.cos(E)), u = nu + binary.argument * DEG, node = binary.node * DEG, inc = binary.inclination * DEG;
        const north = r * (Math.cos(u) * Math.cos(node) - Math.sin(u) * Math.sin(node) * Math.cos(inc));
        const east = r * (Math.cos(u) * Math.sin(node) + Math.sin(u) * Math.cos(node) * Math.cos(inc));
        const along = r * Math.sin(u) * Math.sin(inc);
        const primary = starById[binary.a], ra = primary.ra * DEG, dec = primary.dec * DEG;
        const eV = [-Math.sin(ra), Math.cos(ra), 0], nV = [-Math.sin(dec) * Math.cos(ra), -Math.sin(dec) * Math.sin(ra), Math.cos(dec)], sV = equatorialUnit(primary.ra, primary.dec);
        const relative = galacticToWorld(toGalactic(sV.map((_, i) => north * nV[i] + east * eV[i] + along * sV[i])));
        const ma = primary.mass, mb = starById[binary.b].mass;
        return {relative, a: relative.map(v => -v * mb / (ma + mb)), b: relative.map(v => v * ma / (ma + mb)), separationAU: r};
    }
    // Straight-line space motion; accurate to a few percent over ±100,000 years for these stars.
    const starPosition = (id, years) => { const s = starById[id]; return s.position.map((v, i) => v + s.velocity[i] * years); };
    const distanceAt = (id, years) => Math.hypot(...starPosition(id, years));

    // Milky Way. R0 = 8.178 kpc (GRAVITY 2019); flat rotation curve ≈ 230 km/s outside the bulge.
    const MILKY_WAY = Object.freeze({sunRadius: 8.178 * LY_PER_PC, sunHeight: .0208 * LY_PER_PC, vFlat: 230, coreScale: 4.2,
        diskScale: 2.6 * LY_PER_PC, radius: 50, barHalfLength: 14.7, barAngle: 27, armPitch: 12, patternSpeed: 28});
    function rotationSpeed(rKly, vFlat = MILKY_WAY.vFlat, core = MILKY_WAY.coreScale) { return vFlat * Math.tanh(rKly / core); }
    // Angular speed in rad/Myr (kly units): Ω = v / r.
    function angularSpeed(rKly, vFlat, core) { return rotationSpeed(rKly, vFlat, core) * KLY_PER_MYR_PER_KMS / Math.max(rKly, 1e-3); }
    const solarGalacticPeriodMyr = () => 2 * Math.PI / angularSpeed(MILKY_WAY.sunRadius);
    const patternSpeedRadPerMyr = () => MILKY_WAY.patternSpeed * KLY_PER_MYR_PER_KMS / LY_PER_PC; // km/s/kpc → rad/Myr

    // Local Group. Distances: M31 765 kpc, M33 840 kpc, LMC 49.6 kpc, SMC 62 kpc.
    const GALAXIES = [
        {id:'milkyway',name:'银河系',ra:0,dec:0,distanceKly:0,radiusKly:50,inclination:0,pa:0,vRot:230},
        {id:'m31',name:'仙女座星系 M31',ra:10.684708,dec:41.26875,distanceKly:765*LY_PER_PC,radiusKly:110,inclination:77,pa:38,vRot:250,radialKms:-110},
        {id:'m33',name:'三角座星系 M33',ra:23.462042,dec:30.660175,distanceKly:840*LY_PER_PC,radiusKly:30,inclination:55,pa:22.5,vRot:120},
        {id:'lmc',name:'大麦哲伦云',ra:80.894,dec:-69.756,distanceKly:49.6*LY_PER_PC,radiusKly:14,inclination:35,pa:170,vRot:90},
        {id:'smc',name:'小麦哲伦云',ra:13.1867,dec:-72.8286,distanceKly:62*LY_PER_PC,radiusKly:9,inclination:65,pa:45,vRot:50}
    ].map(galaxy => {
        const dir = galaxy.distanceKly ? equatorialUnit(galaxy.ra, galaxy.dec) : [1, 0, 0];
        // Disk normal from inclination i and major-axis position angle: n = cos i·(−s) + sin i·(minor axis on the sky).
        const ra = galaxy.ra * DEG, dec = galaxy.dec * DEG;
        const eV = [-Math.sin(ra), Math.cos(ra), 0], nV = [-Math.sin(dec) * Math.cos(ra), -Math.sin(dec) * Math.sin(ra), Math.cos(dec)];
        const pa = galaxy.pa * DEG, inc = galaxy.inclination * DEG, minor = nV.map((v, i) => -Math.sin(pa) * v + Math.cos(pa) * eV[i]);
        const normalEq = dir.map((v, i) => -Math.cos(inc) * v + Math.sin(inc) * minor[i]);
        return Object.freeze({...galaxy,
            direction: galacticToWorld(toGalactic(dir)),
            normal: galaxy.id === 'milkyway' ? [0, 1, 0] : galacticToWorld(toGalactic(normalEq))});
    });
    const galaxyById = Object.freeze(Object.fromEntries(GALAXIES.map(galaxy => [galaxy.id, galaxy])));
    // Milky Way–Andromeda: radial two-body fall. M = 1.1×10¹² M☉ as a point mass reproduces the
    // widely quoted first close encounter about 4.5 Gyr from now.
    const LOCAL_GROUP_MASS = 1.1e12;
    const ANDROMEDA_TABLE = (() => {
        const table = [];
        // Velocity Verlet (symplectic): conserves the orbital energy; stored once per Myr.
        let r = galaxyById.m31.distanceKly, v = galaxyById.m31.radialKms * KLY_PER_MYR_PER_KMS;
        const dt = .1, GM = G_KLY_MYR * LOCAL_GROUP_MASS, steps = Math.round(1 / dt);
        let a = -GM / (r * r);
        for (let t = 0; t <= 6000 && r > 40; t++) {
            table.push([t, r, v / KLY_PER_MYR_PER_KMS]);
            for (let k = 0; k < steps && r > 40; k++) {
                r += v * dt + .5 * a * dt * dt;
                const next = -GM / (r * r);
                v += .5 * (a + next) * dt;
                a = next;
            }
        }
        return table;
    })();
    const ANDROMEDA_CONTACT_MYR = ANDROMEDA_TABLE[ANDROMEDA_TABLE.length - 1][0];
    function andromeda(timeMyr) {
        const i = Math.max(0, Math.min(ANDROMEDA_TABLE.length - 1, Math.floor(timeMyr)));
        const [, r, v] = ANDROMEDA_TABLE[i];
        return {distanceKly: r, speedKms: v};
    }

    return Object.freeze({DEG, LY_PER_PC, LY_PER_YEAR_PER_KMS, KLY_PER_MYR_PER_KMS, G_KLY_MYR, EQ_TO_GAL,
        equatorialUnit, toGalactic, galacticToWorld, galacticLongitudeLatitude,
        STARS, starById, BINARIES, binaryOffset, starPosition, distanceAt,
        MILKY_WAY, rotationSpeed, angularSpeed, solarGalacticPeriodMyr, patternSpeedRadPerMyr,
        GALAXIES, galaxyById, LOCAL_GROUP_MASS, ANDROMEDA_CONTACT_MYR, andromeda});
});
