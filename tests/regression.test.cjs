const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function environment() {
    class Vector {
        constructor(x = 0, y = 0, z = 0) { Object.assign(this, {x, y, z}); }
        set(x, y, z) { Object.assign(this, {x, y, z}); return this; }
        clone() { return new Vector(this.x, this.y, this.z); }
        copy(v) { return this.set(v.x, v.y, v.z); }
        addScaledVector(v, n) { this.x += v.x*n; this.y += v.y*n; this.z += v.z*n; return this; }
        length() { return Math.hypot(this.x, this.y, this.z); }
    }
    const tweens = [];
    class Tween {
        constructor(value) { this.value = value; }
        to(target) { this.target = target; return this; }
        easing() { return this; }
        onUpdate(callback) { this.update = callback; return this; }
        onComplete(callback) { this.complete = callback; return this; }
        start() { tweens.push(this); return this; }
        stop() { this.stopped = true; return this; }
    }
    const elements = new Map();
    function element(id) {
        if (!elements.has(id)) elements.set(id, {
            checked: false, style: {}, classList: {add() {}},
            listeners: {}, addEventListener(type, handler) { this.listeners[type] = handler; },
            pause() { this.paused = true; }, play() { this.paused = false; return Promise.resolve(); },
            load() {}, getAttribute(name) { return this[name] || null; }, readyState: 4,
        });
        return elements.get(id);
    }
    const events = {};
    const context = vm.createContext({
        console, setTimeout, clearTimeout, Float32Array, Math, Date,
        THREE: {Vector2: Vector, Vector3: Vector, Raycaster: class {
            constructor() { this.params = {Points:{}}; this.ray = {direction: new Vector(0,0,-1)}; }
            setFromCamera() {} intersectObjects(objects) { this.lastObjects = objects; return []; }
        }, MathUtils: {degToRad: value => value * Math.PI / 180}},
        TWEEN: {Tween, Easing: {Linear: {None: x=>x}, Cubic: {Out:x=>x}, Elastic: {Out:x=>x}}},
        document: {getElementById:element, querySelector:element},
        window: {innerWidth:1373, innerHeight:731, addEventListener(type, handler) { events[type] = handler; }},
        navigator: {mediaDevices: {getUserMedia: async () => { throw Object.assign(new Error(), {name:'NotAllowedError'}); }}},
        Hands: class {setOptions() {} onResults(callback) { this.results = callback; } send() {return Promise.resolve();}},
        requestAnimationFrame() { return 1; }, cancelAnimationFrame() {},
    });
    const run = code => vm.runInContext(code, context);
    run(fs.readFileSync(path.join(__dirname, '..', 'script.js'), 'utf8'));
    run(`camera = {fov:75, aspect:1373/731, position:new THREE.Vector3(0,2,12), lookAt(){}, updateMatrixWorld(){}};
        scene = {fog:{density:0.05}, remove(){}};
        particles = {geometry:{attributes:{position:{array:new Float32Array(PARTICLE_COUNT*3)},color:{array:new Float32Array(PARTICLE_COUNT*3)}}}, rotation:{x:0,y:0,z:0,set(x,y,z){Object.assign(this,{x,y,z});}}};
        for (const positions of [treePos,scatterPos,solarSystemPos,venusPos,earthPos,sunPos]) {
            positions.push(...new Array(PARTICLE_COUNT*3).fill(positions === venusPos ? 3 : 1));
        }
        christmasColors.fill(0.2); solarSystemColors.fill(0.6); venusColors.fill(0.8); earthColors.fill(0.9);
    `);
    const finish = () => {
        while (tweens.length) {
            const tween = tweens.shift();
            if (!tween.stopped) {
                Object.assign(tween.value, tween.target);
                tween.update?.(tween.value);
                tween.complete?.();
            }
        }
    };
    return {run, element, context, events, finish};
}

test('solar overview has an exit and restores the previous theme', () => {
    const e = environment();
    e.run("enterSolarSystem()"); e.finish();
    assert.equal(e.run('currentShape'), 'solar_system');
    assert.equal(e.element('solar-system-btn').textContent, '← 返回星云');
    assert.ok(e.run('camera.position.length()') > 50);
    e.run('enterSolarSystem()'); e.finish();
    assert.equal(e.run('currentShape'), 'scatter');
    assert.equal(e.run('currentTheme'), 'christmas');
    assert.ok(Math.abs(e.run('particles.geometry.attributes.color.array[0]') - 0.2) < 1e-6);
});

test('a new planet selection wins over an unfinished shape and colour transition', () => {
    const e = environment();
    e.run("explorePlanet('venus'); explorePlanet('earth')"); e.finish();
    assert.equal(e.run('currentShape'), 'earth');
    assert.equal(e.run('currentTheme'), 'earth');
    assert.ok(Math.abs(e.run('particles.geometry.attributes.color.array[0]') - 0.9) < 1e-6);
    assert.equal(e.run('isAnimating || isColorAnimating'), false);
});

test('returning during entry animation cannot leave the user stuck in solar mode', () => {
    const e = environment();
    e.run('enterSolarSystem(); returnToScatter()'); e.finish();
    assert.equal(e.run('currentShape'), 'scatter');
    assert.equal(e.run('currentTheme'), 'christmas');
});

test('solar camera contains its bounding sphere at desktop and phone aspect ratios', () => {
    const e = environment();
    for (const aspect of [1373/731,390/844,320/568,844/390]) {
        e.context.aspectUnderTest = aspect;
        const result = e.run(`camera.aspect = aspectUnderTest;
            (() => { const p = viewPosition('solar_system');
            const halfV = THREE.MathUtils.degToRad(camera.fov)/2;
            const halfH = Math.atan(Math.tan(halfV)*camera.aspect);
            return Math.hypot(p.x,p.y,p.z)*Math.sin(Math.min(halfV,halfH)); })()`);
        assert.ok(result > 33, `radius at aspect ${aspect}`);
    }
});

test('Venus fist uses the Venus shape and reports the right name', () => {
    const e = environment();
    e.run("currentTheme='venus'; initMediaPipe(); isCameraActive=true;");
    const lm = Array.from({length:21}, () => ({x:0.5,y:0.5}));
    for (const i of [8,12,16,20]) lm[i].y = 0.8;
    e.context.testLandmarks = lm;
    e.run('hands.results({multiHandLandmarks:[testLandmarks]})'); e.finish();
    assert.equal(e.run('currentShape'), 'venus');
    assert.match(e.element('status').innerText, /金星/);
});

test('camera off stops tracks and removes the video preview', async () => {
    const e = environment(); let stops = 0;
    const stream = {getTracks: () => [{stop:() => stops++}]};
    e.context.navigator.mediaDevices.getUserMedia = async () => stream;
    const toggle = e.element('camera-toggle'); toggle.checked = true;
    await e.run("toggleCamera(document.getElementById('camera-toggle'))");
    assert.equal(e.run('isCameraActive'), true);
    toggle.checked = false;
    await e.run("toggleCamera(document.getElementById('camera-toggle'))");
    assert.equal(stops, 1);
    assert.equal(e.element('input_video').srcObject, null);
    assert.equal(e.element('video-container').style.display, 'none');
});

test('camera permission denial restores the toggle and keeps the preview hidden', async () => {
    const e = environment(); e.element('camera-toggle').checked = true;
    await e.run("toggleCamera(document.getElementById('camera-toggle'))");
    assert.equal(e.element('camera-toggle').checked, false);
    assert.equal(e.run('isCameraActive'), false);
    assert.equal(e.element('video-container').style.display, 'none');
    assert.match(e.element('status').innerText, /权限/);
});

test('camera permission resolving after switch-off releases the late stream', async () => {
    const e = environment(); let resolve, stops = 0;
    e.context.navigator.mediaDevices.getUserMedia = () => new Promise(r=>resolve=r);
    e.element('camera-toggle').checked = true;
    const start = e.run("toggleCamera(document.getElementById('camera-toggle'))");
    e.element('camera-toggle').checked = false;
    e.run('stopCamera()');
    resolve({getTracks: () => [{stop:()=>stops++}]}); await start;
    assert.equal(stops, 1);
    assert.equal(e.run('isCameraActive'), false);
});

test('an old rejected music request does not disable the newer song', async () => {
    const e = environment(); let reject;
    e.element('music-toggle').checked = true;
    e.element('bgm').play = () => new Promise((_,r)=>reject=r);
    const first = e.run('playMusic()');
    e.element('bgm').play = () => Promise.resolve();
    e.run('nextSong()');
    reject(Object.assign(new Error(), {name:'AbortError'})); await first;
    assert.equal(e.element('music-toggle').checked, true);
    assert.match(e.element('bgm').src, /Gravity%20Echo/);
});

test('switching songs while music is off keeps playback paused', () => {
    const e = environment(); let plays = 0;
    e.element('bgm').play = () => {plays++; return Promise.resolve();};
    e.run('nextSong(); prevSong()');
    assert.equal(plays, 0);
    assert.equal(e.element('bgm').paused, true);
});

test('music failure resets the switch with an actionable status', async () => {
    const e = environment(); e.element('music-toggle').checked = true;
    e.element('bgm').play = () => Promise.reject(Object.assign(new Error(), {name:'NotAllowedError'}));
    await e.run('playMusic()');
    assert.equal(e.element('music-toggle').checked, false);
    assert.match(e.element('status').innerText, /重试/);
});

test('pointer cancellation releases drag state and cannot trigger a planet selection', () => {
    const e = environment(); const handlers = {}, captured = new Set();
    e.context.testCanvas = {style:{}, addEventListener:(t,h)=>handlers[t]=h,
        setPointerCapture:id=>captured.add(id), hasPointerCapture:id=>captured.has(id),
        releasePointerCapture:id=>captured.delete(id), getBoundingClientRect:()=>({left:0,top:0,width:390,height:844})};
    e.run('setupPointerControls(testCanvas)');
    handlers.pointerdown({pointerId:1,pointerType:'touch',clientX:100,clientY:200});
    handlers.pointermove({pointerId:1,clientX:130,clientY:240});
    assert.ok(e.run('particles.rotation.y') > 0);
    handlers.pointercancel({type:'pointercancel',pointerId:1});
    assert.equal(e.run('isMouseDragging'), false);
    assert.equal(e.run('currentShape'), 'scatter');
});

test('keyboard shortcuts leave focused form controls alone', () => {
    const e = environment(); e.run('appStarted=true');
    e.events.keydown({key:'Escape',target:{closest:()=>true}, preventDefault(){throw Error('intercepted control');}});
    assert.equal(e.run('currentShape'), 'scatter');
});

test('Escape returns from solar mode when an ordinary button retains focus', () => {
    const e = environment(); e.run('appStarted=true; enterSolarSystem()'); e.finish();
    e.events.keydown({key:'Escape',target:{closest:selector=>selector === 'button'},preventDefault(){}});
    e.finish();
    assert.equal(e.run('currentShape'), 'scatter');
});

test('Space on a button uses the native click without triggering a second shape change', () => {
    const e = environment(); e.run('appStarted=true');
    e.events.keydown({code:'Space',key:' ',target:{closest:selector=>selector === 'button'},preventDefault(){throw Error('intercepted button');}});
    assert.equal(e.run('currentShape'), 'scatter');
});
