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
            focus() { this.focused = true; }, contains(target) { return target === this; },
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
        document: {getElementById:element, querySelector:element, querySelectorAll:()=>[], addEventListener(type, handler) { events['document:' + type] = handler; }},
        window: {innerWidth:1373, innerHeight:731, addEventListener(type, handler) { events[type] = handler; }},
        navigator: {mediaDevices: {getUserMedia: async () => { throw Object.assign(new Error(), {name:'NotAllowedError'}); }}},
        Hands: class {setOptions() {} onResults(callback) { this.results = callback; } send() {return Promise.resolve();}},
        requestAnimationFrame() { return 1; }, cancelAnimationFrame() {},
        SolarScene: class {
            constructor(three, scene, camera, canvas, onFocus) {Object.assign(this,{camera,onFocus});}
            activate() {this.active=true;this.focusId=null;this.camera.position.set(0,75,90);this.onFocus(null);}
            deactivate() {this.active=false;}
            focus(id) {this.focusId=id;this.onFocus(id);}
            resize() {} pick() {return null;}
        },
    });
    const run = code => vm.runInContext(code, context);
    run(fs.readFileSync(path.join(__dirname, '..', 'solar-data.js'), 'utf8'));
    run(fs.readFileSync(path.join(__dirname, '..', 'script.js'), 'utf8'));
    run(`camera = {fov:75, aspect:1373/731, position:new THREE.Vector3(0,2,12), lookAt(){}, updateMatrixWorld(){}};
        scene = {fog:{density:0.05}, remove(){}};
        particles = {geometry:{attributes:{position:{array:new Float32Array(PARTICLE_COUNT*3)},color:{array:new Float32Array(PARTICLE_COUNT*3)}}}, rotation:{x:0,y:0,z:0,set(x,y,z){Object.assign(this,{x,y,z});}}};
        for (const positions of [treePos,scatterPos,solarSystemPos,venusPos,earthPos,sunPos]) {
            positions.push(...new Array(PARTICLE_COUNT*3).fill(positions === venusPos ? 3 : 1));
        }
        christmasColors.fill(0.2); solarSystemColors.fill(0.6); venusColors.fill(0.8); earthColors.fill(0.9);
        particles.geometry.attributes.color.array.set(christmasColors);
        renderer={domElement:{}};
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
    assert.equal(e.element('solar-system-btn').textContent, '返回星云');
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

test('particle overview and focused planet remain framed on desktop and phone', () => {
    const context=vm.createContext({SolarData:require('../solar-data.js')});
    vm.runInContext(fs.readFileSync(path.join(__dirname,'..','solar-scene.js'),'utf8'),context);
    for (const aspect of [1373/731,390/844,320/568,844/390]) {
        context.aspect=aspect;
        const radii=vm.runInContext(`(() => {
            const view=Object.create(SolarScene.prototype);view.camera={fov:75,aspect};view.mode='overview';view.clock=new SolarData.Clock(Date.UTC(2026,9,20));
            view.resize();const overview=view.distance*Math.sin(view.halfFov());
            view.mode='body';view.focusId='earth';view.resize();
            return [overview,view.distance*Math.sin(view.halfFov())/SolarScene.DISPLAY.earth.radius];
        })()`,context);
        assert.ok(radii[0]>30,`visible overview radius at aspect ${aspect}`);
        assert.ok(radii[1]>1.5,`focused radius at aspect ${aspect}`);
    }
});

test('physical planet selection follows in place and art selection exits cleanly',()=>{
    const e=environment();e.run("enterSolarSystem(); choosePlanet('earth')");e.finish();
    assert.equal(e.run('currentShape'),'solar_system');
    assert.equal(e.run('physicalSolar.focusId'),'earth');
    assert.equal(e.element('selected-planet-name').textContent,'地球');
    assert.equal(e.run('particles.visible'),false);
    assert.equal(e.element('camera-toggle').disabled,true);
    e.run("choosePlanet('black_hole')");e.finish();
    assert.equal(e.run('physicalSolar.active'),false);
    assert.equal(e.run('particles.visible'),true);
    assert.equal(e.element('camera-toggle').disabled,false);
    assert.equal(e.run('currentShape'),'black_hole');
});

test('restored solar bodies are colored particle clouds and Saturn rings are recentered before tilt',()=>{
    class Attribute {constructor(array,itemSize){this.array=Float32Array.from(array);this.count=this.array.length/itemSize;}}
    class Geometry {constructor(){this.attributes={};}setAttribute(name,value){this.attributes[name]=value;}computeBoundingSphere(){}}
    class Material {constructor(options){Object.assign(this,options);}}
    class Points {constructor(geometry,material){Object.assign(this,{geometry,material,type:'Points',userData:{}});}}
    const context=vm.createContext({SolarData:require('../solar-data.js')});
    vm.runInContext(fs.readFileSync(path.join(__dirname,'..','solar-scene.js'),'utf8'),context);
    const controller=Object.create(context.SolarScene.prototype);
    controller.THREE={BufferGeometry:Geometry,Float32BufferAttribute:Attribute,PointsMaterial:Material,Points,AdditiveBlending:2};
    const source={positions:new Float32Array(15000*3),colors:new Float32Array(15000*3),material:{map:{}}};
    source.positions[0]=2.5;source.colors.set([.1,.4,.8],0);
    const sun=controller.particleBody({id:'sun'},source);
    assert.equal(sun.type,'Points');assert.equal(sun.geometry.attributes.position.count,3000);
    assert.ok(Math.abs(sun.geometry.attributes.position.array[0]-2.8)<1e-6);
    assert.ok(Math.abs(sun.geometry.attributes.color.array[1]-.4)<1e-6);
    assert.equal(sun.material.map,source.material.map);
    const display=context.SolarScene.DISPLAY.saturn,angle=27*Math.PI/180;
    source.positions.set([display.center[0]+3.5*Math.cos(angle),3.5*Math.sin(angle),display.center[2]],display.start*3);
    const saturn=controller.particleBody({id:'saturn'},source),point=saturn.geometry.attributes.position.array;
    assert.equal(saturn.type,'Points');assert.equal(saturn.geometry.attributes.position.count,1500);
    assert.ok(Math.abs(point[0]-3.5/1.5*1.9)<1e-5);assert.ok(Math.abs(point[1])<1e-5);assert.ok(Math.abs(point[2])<1e-5);
});

test('dragging borrows the view without stopping rotation or altering the astronomical clock',()=>{
    const context=vm.createContext({SolarData:require('../solar-data.js')});
    vm.runInContext(fs.readFileSync(path.join(__dirname,'..','solar-scene.js'),'utf8'),context);
    const view=Object.create(context.SolarScene.prototype);
    view.azimuth=0;view.polar=.8;view.autoRotate=true;
    view.clock=new context.SolarData.Clock(Date.UTC(2026,9,20));
    view.rotateButton={setAttribute(){}};
    view.beginDrag();view.orbit(100,30);
    assert.equal(view.autoRotate,true);assert.equal(view.azimuth,-.5);assert.ok(view.polar>.8);
    assert.equal(view.clock.rate,1);
    view.setRotation(false);assert.equal(view.autoRotate,false);
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

test('selecting a planet closes the panel and restores the trigger focus', () => {
    const e = environment();
    e.element('planet-panel').open = true;
    e.run("choosePlanet('venus')"); e.finish();
    assert.equal(e.run('currentTheme'), 'venus');
    assert.equal(e.element('planet-panel').open, false);
    assert.equal(e.element('planet-picker-trigger').focused, true);
    assert.equal(e.element('selected-planet-name').textContent, '金星');
});

test('Escape dismisses an open picker without changing the scene', () => {
    const e = environment(); let stopped = false;
    e.run("explorePlanet('earth')"); e.finish();
    e.element('planet-panel').open = true;
    e.element('planet-panel').listeners.keydown({key:'Escape',preventDefault(){},stopPropagation(){stopped=true;}});
    assert.equal(stopped, true);
    assert.equal(e.run('currentShape'), 'earth');
    assert.equal(e.element('planet-panel').open, false);
});

test('clicking outside the picker dismisses it without stealing focus', () => {
    const e = environment(); e.element('planet-panel').open = true;
    e.events['document:click']({target:{}});
    assert.equal(e.element('planet-panel').open, false);
    assert.equal(e.element('planet-picker-trigger').focused, undefined);
});

test('the help control cannot overlap the open planet panel on small screens', () => {
    const e = environment();
    e.element('planet-panel').open = true;
    e.element('planet-panel').listeners.toggle();
    assert.equal(e.element('.help-control').hidden, true);
    e.element('planet-panel').open = false;
    e.element('planet-panel').listeners.toggle();
    assert.equal(e.element('.help-control').hidden, false);
});
