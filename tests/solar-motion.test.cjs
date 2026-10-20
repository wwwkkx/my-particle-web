const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const D = require('../solar-data.js');

function loadScene() {
    const context = vm.createContext({SolarData: D});
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'solar-scene.js'), 'utf8'), context);
    return context.SolarScene;
}
function cameraView(SolarScene, focusId = null) {
    const view = Object.create(SolarScene.prototype);
    Object.assign(view, {azimuth: 0, polar: Math.acos(.65), autoRotate: true, dragging: false, spinUp: 1, focusId,
        rotateButton: {setAttribute() {}, textContent: ''}});
    return view;
}
const step = (view, seconds) => { for (let t = 0; t < seconds; t += 1 / 60) view.stepCamera(1 / 60); };

test('after a drag the view eases back to the default tilt and keeps rotating', () => {
    const view = cameraView(loadScene());
    view.beginDrag(); view.orbit(-200, 160); view.endDrag();
    const draggedPolar = view.polar, draggedAzimuth = view.azimuth;
    assert.ok(Math.abs(draggedPolar - view.defaultPolar()) > .5);
    step(view, 3);
    assert.ok(Math.abs(view.polar - view.defaultPolar()) < .01, 'tilt restored');
    assert.ok(view.azimuth > draggedAzimuth + .03, 'rotation resumed');
});

test('rotation pauses while the pointer is down and only the button switches it off', () => {
    const view = cameraView(loadScene());
    view.beginDrag();
    const azimuth = view.azimuth;
    step(view, 1);
    assert.equal(view.azimuth, azimuth, 'no auto-rotation under the finger');
    view.endDrag();
    view.setRotation(false);
    view.orbit(0, 120);
    const polar = view.polar;
    step(view, 2);
    assert.equal(view.polar, polar, 'a manually stopped view stays where the user left it');
    assert.equal(view.autoRotate, false);
});

test('focused planets return to their own default tilt', () => {
    const view = cameraView(loadScene(), 'earth');
    view.beginDrag(); view.orbit(0, -150); view.endDrag();
    step(view, 3);
    assert.ok(Math.abs(view.polar - 1.05) < .01);
});

test('every body visibly spins, in its true direction and true order of speed', () => {
    const SolarScene = loadScene();
    for (const rate of [1, 3600, 86400, 604800, 2592000]) {
        const speeds = D.bodies.map(body => [body.id, SolarScene.displaySpinRate(body.id, rate)]);
        for (const [id, speed] of speeds) {
            assert.ok(Math.abs(speed) >= 6 && Math.abs(speed) <= 90, `${id} ${speed}°/s at rate ${rate}`);
            assert.equal(Math.sign(speed), Math.sign(D.byId[id].spinRate), `${id} direction`);
        }
        const byReal = [...D.bodies].sort((a, b) => Math.abs(a.spinRate) - Math.abs(b.spinRate));
        for (let i = 1; i < byReal.length; i++) {
            assert.ok(Math.abs(SolarScene.displaySpinRate(byReal[i].id, rate)) >= Math.abs(SolarScene.displaySpinRate(byReal[i - 1].id, rate)));
        }
    }
    for (const body of D.bodies) assert.equal(SolarScene.displaySpinRate(body.id, 0), 0, 'paused');
    assert.deepEqual(['venus', 'uranus', 'pluto'].map(id => SolarScene.isRetrograde(id)), [true, true, true]);
    assert.deepEqual(['earth', 'mars', 'jupiter'].map(id => SolarScene.isRetrograde(id)), [false, false, false]);
});

test('a spin override keeps the true pole and only turns the body about it', () => {
    const jd = D.toJulianTDB(Date.UTC(2026, 9, 20));
    for (const body of D.bodies) {
        const real = D.orientation(body.id, jd), turned = D.orientation(body.id, jd, 1.234);
        real.north.forEach((value, i) => assert.ok(Math.abs(value - turned.north[i]) < 1e-12));
        const dot = turned.x.reduce((sum, value, i) => sum + value * real.north[i], 0);
        assert.ok(Math.abs(dot) < 1e-12, 'spin axis stays perpendicular to the equator');
    }
});

test('axial tilts match published values', () => {
    const expected = {mercury: .03, venus: 177.36, earth: 23.44, mars: 25.19, jupiter: 3.13, saturn: 26.73, uranus: 97.77, neptune: 28.32};
    for (const [id, tilt] of Object.entries(expected)) {
        assert.ok(Math.abs(D.obliquity(id, D.J2000) - tilt) < .6, `${id} ${D.obliquity(id, D.J2000)} vs ${tilt}`);
    }
});

test("Halley's comet follows its real orbit", () => {
    const r = jd => Math.hypot(...D.cometPosition(jd));
    assert.ok(Math.abs(r(D.halley.perihelionJD) - .586) < .002, 'perihelion 0.586 AU on 1986-02-09');
    const period = 365.25 * Math.pow(D.halley.a, 1.5);
    assert.ok(Math.abs(period / 365.25 - 75.3) < .1);
    assert.ok(Math.abs(r(D.halley.perihelionJD + period / 2) - 35.08) < .05, 'aphelion');
    for (const year of [1972, 1986, 2000, 2026, 2049]) assert.ok(D.cometPosition(D.toJulianTDB(Date.UTC(year, 0, 1))).every(Number.isFinite));
});

test('moons follow real periods, Triton runs backwards, and the Moon uses its true mean longitude', () => {
    const jd = D.J2000 + 10;
    const advance = id => D.wrapDegrees((D.moonLongitude(id, jd + .01) - D.moonLongitude(id, jd)) / D.DEG);
    assert.ok(Math.abs(advance('moon') - 13.176358 * .01) < 1e-6);
    assert.ok(advance('triton') > 180, 'retrograde');
    assert.ok(Math.abs(D.moonLongitude('moon', D.J2000) / D.DEG - 218.3165) < 1e-9);
    assert.equal(new Set(D.moons.map(moon => moon.parent)).size, 6);
});

test('distance mapping passes through every planet orbit and stays monotonic', () => {
    const SolarScene = loadScene();
    for (const body of D.bodies.filter(body => body.id !== 'sun')) {
        const a = D.orbitalElements(body.id, D.J2000).a;
        assert.ok(Math.abs(SolarScene.auToDisplay(a) - SolarScene.DISPLAY[body.id].orbit) < 1e-9, body.id);
    }
    let last = -1;
    for (let au = 0; au < 60; au += .25) { const d = SolarScene.auToDisplay(au); assert.ok(d >= last); last = d; }
    const belt = [2.15, 3.35].map(au => SolarScene.auToDisplay(au));
    assert.ok(belt[0] > SolarScene.DISPLAY.mars.orbit && belt[1] < SolarScene.DISPLAY.jupiter.orbit, 'asteroid belt sits between Mars and Jupiter');
});

test('the simulation clock accepts the new 7-days-per-second speed and defaults to 1 day per second', () => {
    const clock = new D.Clock(Date.UTC(2026, 9, 20));
    clock.setRate(604800, Date.UTC(2026, 9, 20));
    assert.equal(clock.value(Date.UTC(2026, 9, 20) + 1000), Date.UTC(2026, 9, 27));
    assert.throws(() => clock.setRate(42));
    assert.equal(loadScene().DEFAULT_RATE, 86400);
});
