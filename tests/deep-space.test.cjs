const test = require('node:test');
const assert = require('node:assert/strict');
const X = require('../deep-data.js');
const D = require('../solar-data.js');

test('equatorial → galactic transform puts known objects at their catalogue coordinates', () => {
    const [l, b] = X.galacticLongitudeLatitude(266.405, -28.936);           // Sgr A*
    assert.ok((l < .2 || l > 359.8) && Math.abs(b) < .2, `Galactic centre at l=${l}, b=${b}`);
    const [lv, bv] = X.galacticLongitudeLatitude(279.2347, 38.7837);        // Vega
    assert.ok(Math.abs(lv - 67.45) < .1 && Math.abs(bv - 19.24) < .1);
    const [, bp] = X.galacticLongitudeLatitude(192.85948, 27.12825);        // North galactic pole
    assert.ok(bp > 89.99);
});

test('nearby stars sit at their measured distances', () => {
    const expected = {proxima: 4.2465, alfCenA: 4.395, barnard: 5.963, wolf359: 7.856, sirius: 8.601, epsEri: 10.50, tauCet: 11.91, vega: 25.04};
    for (const [id, ly] of Object.entries(expected)) assert.ok(Math.abs(X.starById[id].distance - ly) < .02, `${id} ${X.starById[id].distance}`);
});

test("space motions reproduce the published close approaches", () => {
    let barnard = [1e9, 0], cen = [1e9, 0];
    for (let y = 0; y < 60000; y += 50) {
        const db = X.distanceAt('barnard', y), dc = X.distanceAt('alfCenA', y);
        if (db < barnard[0]) barnard = [db, y];
        if (dc < cen[0]) cen = [dc, y];
    }
    assert.ok(Math.abs(barnard[0] - 3.75) < .1 && Math.abs(barnard[1] - 9800) < 600, `Barnard's Star ${barnard}`);
    assert.ok(Math.abs(cen[0] - 3.2) < .15 && Math.abs(cen[1] - 28000) < 1500, `α Cen ${cen}`);
    const speed = Math.hypot(...X.starById.barnard.velocity) / X.LY_PER_YEAR_PER_KMS;
    assert.ok(Math.abs(speed - 142.6) < 3, `Barnard's Star space velocity ${speed} km/s`);
});

test('binaries follow Kepler orbits around their barycentre', () => {
    const cen = X.BINARIES[0];
    const peri = X.binaryOffset(cen, cen.periastron).separationAU, apo = X.binaryOffset(cen, cen.periastron + cen.period / 2).separationAU;
    assert.ok(Math.abs(peri - cen.au * (1 - cen.e)) < 1e-6 && Math.abs(apo - cen.au * (1 + cen.e)) < 1e-6);
    const now = X.binaryOffset(cen, 2026.8), later = X.binaryOffset(cen, 2026.8 + cen.period);
    now.relative.forEach((v, i) => assert.ok(Math.abs(v - later.relative[i]) < 1e-6, 'periodic'));
    const ma = X.starById.alfCenA.mass, mb = X.starById.alfCenB.mass;
    now.a.forEach((v, i) => assert.ok(Math.abs(v * ma + now.b[i] * mb) < 1e-9, 'barycentre fixed'));
});

test('Milky Way: flat rotation curve, a 218-Myr solar orbit, pattern near corotation at the Sun', () => {
    const W = X.MILKY_WAY;
    assert.ok(Math.abs(W.sunRadius - 26.67) < .05, 'R0 = 8.178 kpc');
    assert.ok(Math.abs(X.rotationSpeed(W.sunRadius) - 230) < 1);
    assert.ok(Math.abs(X.rotationSpeed(45) - X.rotationSpeed(25)) < 2, 'flat outside the bulge');
    const period = X.solarGalacticPeriodMyr();
    assert.ok(period > 200 && period < 240, `${period} Myr`);
    assert.ok(X.angularSpeed(10) > X.angularSpeed(30), 'inner stars overtake outer ones');
    assert.ok(Math.abs(X.patternSpeedRadPerMyr() / X.angularSpeed(W.sunRadius) - 1) < .05);
});

test('Andromeda falls in under gravity: it speeds up and first meets us about 4.5 Gyr from now', () => {
    assert.ok(Math.abs(X.galaxyById.m31.distanceKly - 2495) < 5, '765 kpc');
    assert.ok(Math.abs(X.ANDROMEDA_CONTACT_MYR - 4500) < 50);
    const now = X.andromeda(0), later = X.andromeda(3000);
    assert.equal(Math.round(now.speedKms), -110);
    assert.ok(later.speedKms < now.speedKms && later.distanceKly < now.distanceKly, 'accelerating toward us');
    // Energy conservation of the two-body fall: v²/2 − GM/r stays constant.
    const GM = X.G_KLY_MYR * X.LOCAL_GROUP_MASS, energy = s => Math.pow(s.speedKms * X.KLY_PER_MYR_PER_KMS, 2) / 2 - GM / s.distanceKly;
    assert.ok(Math.abs(energy(later) / energy(now) - 1) < .01);
});

test('Local Group galaxies point the right way', () => {
    const lb = id => X.galacticLongitudeLatitude(X.galaxyById[id].ra, X.galaxyById[id].dec);
    const [l31, b31] = lb('m31'), [llmc, blmc] = lb('lmc');
    assert.ok(Math.abs(l31 - 121.17) < .1 && Math.abs(b31 + 21.57) < .1, 'M31 at l≈121°, b≈−22°');
    assert.ok(Math.abs(llmc - 280.47) < .3 && Math.abs(blmc + 32.89) < .3, 'LMC at l≈280°, b≈−33°');
    for (const galaxy of X.GALAXIES) assert.ok(Math.abs(Math.hypot(...galaxy.normal) - 1) < 1e-9);
});

test('dwarf planets use JPL elements and land where they really are', () => {
    const jd = D.toJulianTDB(Date.UTC(2026, 9, 21)), r = id => Math.hypot(...D.dwarfPosition(id, jd));
    assert.ok(r('ceres') > 2.5 && r('ceres') < 3.0);
    assert.ok(Math.abs(r('eris') - 95.4) < 1, 'Eris is near aphelion (~97.6 AU) in the 2020s');
    for (const dwarf of D.dwarfs) {
        const [a, e] = dwarf.elements, period = dwarf.elements[6];
        assert.ok(Math.abs(period / 365.25 - Math.pow(a, 1.5)) / Math.pow(a, 1.5) < .01, `${dwarf.id} obeys Kepler's third law`);
        assert.ok(r(dwarf.id) >= a * (1 - e) - 1e-6 && r(dwarf.id) <= a * (1 + e) + 1e-6);
    }
});

test('Voyagers leave at constant speed after 1990 and are where NASA reports them', () => {
    const at = (y, m) => D.voyagerPosition('voyager1', D.toJulianTDB(Date.UTC(y, m, 1)));
    assert.equal(D.voyagerPosition('voyager1', D.toJulianTDB(Date.UTC(1985, 0, 1))), null);
    const r2025 = Math.hypot(...at(2025, 0)), r2026 = Math.hypot(...at(2026, 0));
    assert.ok(r2025 > 163 && r2025 < 170, `Voyager 1 ${r2025} AU in 2025`);
    assert.ok(Math.abs(r2026 - r2025 - 3.57) < .05);
});
