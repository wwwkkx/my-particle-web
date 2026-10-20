/* Glowing particle solar system with Kepler motion; see SOLAR_MODEL.md. */
(function particleSolarController(root) {
    'use strict';
    const D=root.SolarData;
    // Particle templates from the original overview (source ranges), with display radii.
    const BASE={
        sun:{radius:2.8,start:0,end:3000,sourceRadius:2.5,center:[0,0,0]},
        mercury:{radius:.42,start:3000,end:3600,sourceRadius:.4,center:[4,0,0]},
        venus:{radius:.7,start:3600,end:4200,sourceRadius:.6,center:[6*Math.SQRT1_2,0,6*Math.SQRT1_2]},
        earth:{radius:.75,start:4200,end:5000,sourceRadius:.6,center:[0,0,8]},
        mars:{radius:.55,start:5000,end:5600,sourceRadius:.5,center:[-10*Math.SQRT1_2,0,10*Math.SQRT1_2]},
        jupiter:{radius:1.8,start:5600,end:7100,sourceRadius:1.8,center:[-14,0,0]},
        saturn:{radius:1.35,start:7100,end:8600,sourceRadius:1.5,center:[-18*Math.SQRT1_2,0,-18*Math.SQRT1_2]},
        uranus:{radius:1.05,start:8600,end:9400,sourceRadius:1,center:[0,0,-22]},
        neptune:{radius:1,start:9400,end:10200,sourceRadius:1,center:[26*Math.SQRT1_2,0,-26*Math.SQRT1_2]},
        pluto:{radius:.42,start:10200,end:10800,sourceRadius:.4,center:[30*Math.cos(.5),0,30*Math.sin(.5)]}
    };
    const RING_OUTER=3.5/1.5;              // Saturn's ring reaches 3.5 source units around a 1.5-unit globe
    const MOON_RADIUS={moon:.18,phobos:.08,deimos:.07,io:.18,europa:.16,ganymede:.22,callisto:.2,enceladus:.09,rhea:.13,titan:.22,miranda:.08,ariel:.11,umbriel:.11,titania:.13,oberon:.13,triton:.16,charon:.2};
    const FIRST_MOON_ORBIT={earth:1.2,mars:.72,jupiter:2.05,saturn:BASE.saturn.radius*RING_OUTER+.3,uranus:1.4,neptune:1.3,pluto:.7};
    const GAP=.3,SUN_CLEARANCE=.4,BELT_WIDTH=2.0,MOON_SPREAD=.25;

    // Lay the system out so nothing can ever touch: each orbit's perihelion clears the previous
    // orbit's aphelion plus both bodies' moon systems. Moon distances follow Kepler's third law
    // (a ∝ T^(2/3)) compressed to the power 0.25 so the outer moons stay near their planet.
    function layout() {
        const moons={},extent={};
        for(const id of Object.keys(BASE)) {
            if(id==='sun')continue;
            let reach=BASE[id].radius*(id==='saturn'?RING_OUTER:1);
            const list=D.moons.filter(moon=>moon.parent===id).sort((a,b)=>Math.abs(a.periodDays)-Math.abs(b.periodDays));
            for(const moon of list) {
                const orbit=FIRST_MOON_ORBIT[id]*Math.pow(Math.abs(moon.periodDays)/Math.abs(list[0].periodDays),MOON_SPREAD);
                moons[moon.id]={radius:MOON_RADIUS[moon.id],orbit};
                reach=Math.max(reach,orbit+MOON_RADIUS[moon.id]);
            }
            extent[id]=reach;
        }
        const display={sun:{...BASE.sun,orbit:0,extent:BASE.sun.radius}};
        let previous=BASE.sun.radius+SUN_CLEARANCE,belt=null;
        for(const id of Object.keys(BASE)) {
            if(id==='sun')continue;
            if(id==='jupiter'){belt={inner:previous+GAP,outer:previous+GAP+BELT_WIDTH};previous=belt.outer;}
            const e=D.orbitalElements(id,D.J2000).e,orbit=(previous+extent[id]+GAP)/(1-e);
            display[id]={...BASE[id],orbit,extent:extent[id]};
            previous=orbit*(1+e)+extent[id];
        }
        return {display,moons,belt,outer:previous};
    }
    const LAYOUT=layout();
    const DISPLAY=Object.freeze(LAYOUT.display);
    const MOON_DISPLAY=Object.freeze(LAYOUT.moons);

    const SPEED_LABELS=Object.freeze({0:'已暂停',1:'实时 1×',3600:'1 小时/秒',86400:'1 天/秒',604800:'7 天/秒',2592000:'30 天/秒'});
    const SPEED_BOOST=Object.freeze({0:0,1:1,3600:1.25,86400:1.5,604800:1.8,2592000:2.1});
    const DEFAULT_RATE=86400;
    const AUTO_ROTATE_SPEED=.035;  // radians of azimuth per second
    const MOON_RATE_CAP=200;       // degrees per second before a moon switches to a capped display speed
    const FACTS=Object.freeze({
        sun:'占太阳系总质量约 99.86%，光从这里到地球约需 8 分 20 秒。',
        mercury:'离太阳最近，轨道偏心率最大，近日点附近跑得最快。',
        venus:'自转方向与多数行星相反，自转一周比公转一周还长。',
        earth:'目前唯一已知存在生命的星球，月球让它的自转轴保持稳定。',
        mars:'拥有太阳系最高的火山奥林帕斯山，高约 22 km。',
        jupiter:'质量是其他行星总和的 2.5 倍，伽利略卫星的周期之比为 1 : 2 : 4。',
        saturn:'平均密度比水还低；光环内圈比外圈转得快。',
        uranus:'自转轴倾斜约 98°，几乎是“躺着”绕太阳公转。',
        neptune:'太阳系风速最快的行星；海卫一逆行公转。',
        pluto:'与海王星 3 : 2 轨道共振；冥卫一和它互相潮汐锁定。'
    });

    function seeded(seed) {
        let t=seed>>>0;
        return ()=>{t+=0x6D2B79F5;let r=Math.imul(t^t>>>15,1|t);r^=r+Math.imul(r^r>>>7,61|r);return((r^r>>>14)>>>0)/4294967296;};
    }
    const hex=value=>[parseInt(value.slice(1,3),16)/255,parseInt(value.slice(3,5),16)/255,parseInt(value.slice(5,7),16)/255];
    // Weighted palettes in the spirit of the sun's particles: bright, saturated, with white sparks.
    function palette(entries) {
        const list=entries.map(([color,weight])=>[hex(color),weight]),total=list.reduce((sum,[,w])=>sum+w,0);
        return random=>{let pick=random()*total;for(const [color,w] of list){if((pick-=w)<=0)return color;}return list[list.length-1][0];};
    }
    const PALETTES={
        mercury:palette([['#e8e2d8',3],['#b5aa9c',3],['#8a7f72',2],['#ffffff',2]]),
        venus:palette([['#fff4cf',3],['#ffd98a',3],['#f0b45a',2],['#ffffff',2]]),
        earth:palette([['#1e6bff',3],['#3fa9ff',3],['#7fe3ff',1],['#3ddc84',1.6],['#ffffff',1.6]]),
        mars:palette([['#ff5a2e',3],['#ff8c55',3],['#d0402a',2],['#ffd2b5',1]]),
        jupiterLight:palette([['#fff3dc',3],['#f3d9ae',3],['#ffffff',1]]),
        jupiterDark:palette([['#e0a468',3],['#c27a44',3],['#9a5a32',1]]),
        jupiterSpot:palette([['#ff5e3a',3],['#ff8a5c',2]]),
        saturnLight:palette([['#fff3cc',3],['#f2dca0',3],['#ffffff',1]]),
        saturnDark:palette([['#e8c784',3],['#cfa866',2]]),
        saturnRing:palette([['#f0e2c4',3],['#d6c197',3],['#b39b70',2],['#ffffff',1]]),
        uranus:palette([['#a8f6ff',3],['#6fd8ea',3],['#d6fdff',2],['#ffffff',1]]),
        neptune:palette([['#4f7dff',3],['#2c56e6',3],['#86a9ff',2],['#ffffff',1]]),
        pluto:palette([['#f3dfcd',3],['#c8a489',3],['#fff4e8',2],['#a07c66',1]])
    };
    function spot(lat,lon,lat0,lon0,size,stretch=1) {
        const dLon=Math.atan2(Math.sin(lon-lon0),Math.cos(lon-lon0))*Math.cos(lat0)/stretch;
        return Math.hypot(dLon,lat-lat0)<size;
    }
    // Colour for a surface particle. Banded giants keep their bands and Jupiter its red spot,
    // which also makes their spin easy to follow; everything else glows like the sun.
    function surfaceColor(id,lat,lon,random) {
        if(id==='jupiter') {
            if(spot(lat,lon,-.38,0,.24,1.6))return PALETTES.jupiterSpot(random);
            return (Math.sin(lat*10+Math.sin(lon*3)*.15)>0?PALETTES.jupiterLight:PALETTES.jupiterDark)(random);
        }
        if(id==='saturn')return (Math.sin(lat*8)>-.2?PALETTES.saturnLight:PALETTES.saturnDark)(random);
        return PALETTES[id](random);
    }
    const particleSize=radius=>.1+.045*radius;

    class SolarScene {
        constructor(THREE,scene,camera,canvas,onFocus,source) {
            Object.assign(this,{THREE,scene,camera,canvas,onFocus});
            this.clock=new D.Clock();
            this.group=new THREE.Group();
            this.group.visible=false;
            scene.add(this.group);
            this.meshes=new Map();
            this.orbits=new Map();
            this.moonSystems=new Map();
            this.spinPhase=new Map();
            this.moonPhase=new Map();
            this.layers={orbits:true,moons:true,small:true};
            this.target=new THREE.Vector3();
            this.focusId=null;
            this.active=false;
            this.mode='overview';
            this.azimuth=-.35;
            this.polar=Math.acos(.65);
            this.distance=75;
            this.autoRotate=true;
            this.dragging=false;
            this.spinUp=1;
            this.projected=[];
            this.texture=source.material.map;
            for(const body of D.bodies) {
                const mesh=this.particleBody(body,source);
                this.paintSurface(body.id,mesh);
                this.meshes.set(body.id,mesh);
                this.group.add(mesh);
                this.spinPhase.set(body.id,D.spinAngle(body.id,D.J2000));
                if(body.id!=='sun') {
                    const geometry=new THREE.BufferGeometry();
                    geometry.setAttribute('position',new THREE.BufferAttribute(new Float32Array(257*3),3));
                    const line=new THREE.Line(geometry,new THREE.LineBasicMaterial({color:body.color,transparent:true,opacity:.12}));
                    line.frustumCulled=false;
                    this.orbits.set(body.id,line);
                    this.group.add(line);
                }
            }
            const dustPosition=[],dustColor=[];
            for(let i=11500;i<15000;i++) {
                // The background star dust, pushed outside the planets so it never sits on an orbit.
                const p=source.positions.slice(i*3,i*3+3),r=Math.hypot(...p)||1,s=(LAYOUT.outer+20+r*1.6)/r;
                dustPosition.push(p[0]*s,p[1]*s,p[2]*s);
                dustColor.push(.55,.65,.85);
            }
            this.group.add(this.points(dustPosition,dustColor,{size:.5,opacity:.4}));
            this.createSunGlow();
            this.createHalos();
            this.createMoons();
            this.createBelts();
            this.createComet();
            this.createDwarfs();
            this.createHeliosphere();
            this.scale='solar';
            this.deep=root.DeepSpace?new root.DeepSpace(THREE,scene,this.texture):null;
            this.deepTime={stars:0,galaxy:0,local:0};
            this.deepRate=this.deep?Object.fromEntries(Object.entries(root.DeepSpace.SCALES).map(([k,v])=>[k,v.rate])):{};
            this.createInterface();
        }
        points(positions,colors,{size=.12,opacity=.9}={}) {
            const T=this.THREE,geometry=new T.BufferGeometry();
            geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));
            geometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));
            const points=new T.Points(geometry,new T.PointsMaterial({
                size,map:this.texture,vertexColors:true,transparent:true,opacity,
                blending:T.AdditiveBlending,depthWrite:false
            }));
            points.frustumCulled=false;
            return points;
        }
        particleBody(body,source) {
            const T=this.THREE,display=DISPLAY[body.id],positions=[],colors=[];
            const scale=display.radius/display.sourceRadius;
            for(let i=display.start;i<display.end;i++) {
                let x=source.positions[i*3]-display.center[0];
                let y=source.positions[i*3+1]-display.center[1];
                const z=source.positions[i*3+2]-display.center[2];
                if(body.id==='saturn') {
                    // Undo the old baked tilt, then apply the astronomical spin/pole basis per frame.
                    const angle=27*D.DEG;
                    const localX=x*Math.cos(angle)+y*Math.sin(angle);
                    y=-x*Math.sin(angle)+y*Math.cos(angle);
                    x=localX;
                }
                positions.push(x*scale,y*scale,z*scale);
                colors.push(...source.colors.slice(i*3,i*3+3));
            }
            const geometry=new T.BufferGeometry();
            geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));
            geometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));
            geometry.computeBoundingSphere();
            const size=body.id==='sun'?.22:particleSize(display.radius);
            // Additive particles brighten where they overlap; scale opacity so dense small bodies don't blow out.
            const coverage=(display.end-display.start)*size*size*.8/(4*Math.PI*display.radius*display.radius);
            const material=new T.PointsMaterial({
                size,map:source.material.map,vertexColors:true,
                blending:T.AdditiveBlending,transparent:true,depthWrite:false,
                opacity:body.id==='sun'?.95:Math.max(.35,Math.min(.95,1.3/Math.max(coverage,.1)))
            });
            const points=new T.Points(geometry,material);
            points.frustumCulled=false;
            points.userData.bodyId=body.id;
            points.userData.baseSize=size;
            points.userData.radius=body.id==='saturn'?display.radius*RING_OUTER:display.radius;
            return points;
        }
        paintSurface(id,mesh) {
            if(id==='sun')return;
            const radius=DISPLAY[id].radius,position=mesh.geometry.attributes.position.array,color=mesh.geometry.attributes.color.array;
            const random=seeded([...id].reduce((sum,ch)=>sum*31+ch.charCodeAt(0),7));
            for(let i=0;i<position.length;i+=3) {
                const x=position[i],y=position[i+1],z=position[i+2],r=Math.hypot(x,y,z);
                if(id==='saturn'&&r>radius*1.15) {
                    // Ring particle; the Cassini division (117,600–122,200 km) stays dark.
                    const km=74500+(r/(radius/1.5)-2)/1.5*62300;
                    color.set(km>117600&&km<122200?[0,0,0]:PALETTES.saturnRing(random),i);
                    continue;
                }
                if(!r)continue;
                color.set(surfaceColor(id,Math.asin(y/r),Math.atan2(z,x),random),i);
            }
            mesh.geometry.attributes.color.needsUpdate=true;
        }
        // Visible spin speed in degrees per second. Order and direction follow the real rotation;
        // the true rates are either imperceptible (real time) or strobe at high simulation speed.
        static displaySpinRate(id,rate) {
            const body=D.byId[id];
            if(!body||!rate)return 0;
            const fast=Math.log10(870.536/1.4),value=Math.log10(Math.abs(body.spinRate)/1.4);
            const base=Math.max(6,Math.min(24,6+18*value/fast));
            return Math.sign(body.spinRate)*base*(SPEED_BOOST[rate]||1);
        }
        createSunGlow() {
            const T=this.THREE;
            if(typeof document==='undefined'||!T.Sprite)return;
            const canvas=document.createElement('canvas');canvas.width=canvas.height=128;
            const ctx=canvas.getContext('2d'),g=ctx.createRadialGradient(64,64,0,64,64,64);
            g.addColorStop(0,'rgba(255,240,200,0.9)');g.addColorStop(.18,'rgba(255,190,90,0.45)');
            g.addColorStop(.45,'rgba(255,120,40,0.12)');g.addColorStop(1,'rgba(255,90,20,0)');
            ctx.fillStyle=g;ctx.fillRect(0,0,128,128);
            this.sunGlow=new T.Sprite(new T.SpriteMaterial({map:new T.CanvasTexture(canvas),blending:T.AdditiveBlending,transparent:true,depthWrite:false,opacity:.75}));
            this.sunGlow.scale.set(15,15,1);
            this.group.add(this.sunGlow);
        }
        // A soft halo in each planet's colour: a glowing gem from afar, a faint atmosphere up close.
        createHalos() {
            const T=this.THREE;
            if(typeof document==='undefined'||!T.Sprite)return;
            const canvas=document.createElement('canvas');canvas.width=canvas.height=128;
            const ctx=canvas.getContext('2d'),g=ctx.createRadialGradient(64,64,0,64,64,64);
            g.addColorStop(0,'rgba(255,255,255,0.85)');g.addColorStop(.22,'rgba(255,255,255,0.35)');
            g.addColorStop(.5,'rgba(255,255,255,0.08)');g.addColorStop(1,'rgba(255,255,255,0)');
            ctx.fillStyle=g;ctx.fillRect(0,0,128,128);
            const texture=new T.CanvasTexture(canvas);
            for(const body of D.bodies) {
                if(body.id==='sun')continue;
                const halo=new T.Sprite(new T.SpriteMaterial({map:texture,color:body.color,blending:T.AdditiveBlending,transparent:true,depthWrite:false,opacity:.5}));
                this.meshes.get(body.id).add(halo);
                this.meshes.get(body.id).userData.halo=halo;
            }
        }
        createMoons() {
            const T=this.THREE;
            this.moonGroup=new T.Group();
            this.group.add(this.moonGroup);
            for(const moon of D.moons) {
                const display=MOON_DISPLAY[moon.id],random=seeded(moon.id.length*97+(moon.radiusKm|0));
                const count=Math.round(Math.max(60,Math.min(260,display.radius*900)));
                const positions=[],colors=[],white=[1,1,1];
                for(let i=0;i<count;i++) {
                    const z=random()*2-1,a=random()*Math.PI*2,s=Math.sqrt(1-z*z),r=display.radius*(.9+random()*.1);
                    positions.push(s*Math.cos(a)*r,z*r,s*Math.sin(a)*r);
                    const pick=random();
                    colors.push(...(pick>.8?white:moon.color.map(v=>Math.min(1,v*(pick>.45?1.1:.75)))));
                }
                const size=particleSize(display.radius)*.9;
                const coverage=count*size*size*.8/(4*Math.PI*display.radius*display.radius);
                const mesh=this.points(positions,colors,{size,opacity:Math.max(.3,Math.min(.9,1.2/coverage))});
                mesh.userData.baseSize=size;
                const pivot=new T.Group(),ring=new T.BufferGeometry(),ringPoints=new Float32Array(97*3);
                for(let i=0;i<=96;i++){const t=i/96*Math.PI*2;ringPoints.set([Math.cos(t)*display.orbit,0,-Math.sin(t)*display.orbit],i*3);}
                ring.setAttribute('position',new T.BufferAttribute(ringPoints,3));
                const orbit=new T.Line(ring,new T.LineBasicMaterial({color:0xbfc8d8,transparent:true,opacity:.1}));
                orbit.frustumCulled=false;
                pivot.add(orbit);pivot.add(mesh);this.moonGroup.add(pivot);
                if(moon.plane==='ecliptic')pivot.rotation.x=5.145*D.DEG;
                this.moonSystems.set(moon.id,{moon,display,mesh,pivot,orbit});
                this.moonPhase.set(moon.id,D.moonLongitude(moon.id,D.J2000));
            }
        }
        // Real distances in AU mapped onto the display scale by interpolating between planet orbits.
        static auToDisplay(au) {
            const table=SolarScene.AU_TABLE;
            if(au<=0)return 0;
            for(let i=1;i<table.length;i++)if(au<=table[i][0]){const [a0,d0]=table[i-1],[a1,d1]=table[i];return d0+(d1-d0)*(au-a0)/(a1-a0);}
            const [a1,d1]=table[table.length-1],[a0,d0]=table[table.length-2];
            return d1+(au-a1)*(d1-d0)/(a1-a0);
        }
        // Every belt particle is its own small Kepler orbit: inner ones overtake outer ones (n ∝ a^-1.5).
        createBelts() {
            const random=seeded(2026);
            const belt=(count,auMin,auMax,toDisplay,thickness,tint,spread,size,opacity)=>{
                const orbits=new Float32Array(count*5),colors=[];
                for(let i=0;i<count;i++) {
                    const au=auMin+(auMax-auMin)*Math.pow(random(),.8);
                    orbits.set([toDisplay(au),360/(Math.pow(au,1.5)*365.25)*D.DEG,random()*Math.PI*2,
                        Math.sin((random()-.5)*2*spread*D.DEG),(random()-.5)*thickness],i*5);
                    const pick=random();colors.push(...(pick>.85?[1,1,1]:tint.map(v=>v*(.45+pick*.6))));
                }
                const mesh=this.points(new Array(count*3).fill(0),colors,{size,opacity});
                mesh.userData.orbits=orbits;
                this.group.add(mesh);
                return mesh;
            };
            const {inner,outer}=LAYOUT.belt;
            this.asteroids=belt(2600,2.1,3.3,au=>inner+(au-2.1)/1.2*(outer-inner),.25,[.95,.84,.68],9,.16,.75);
            this.kuiper=belt(3200,32,48,au=>SolarScene.auToDisplay(au),.9,[.62,.75,1],12,.22,.5);
        }
        createComet() {
            const T=this.THREE,random=seeded(1986),c=D.halley;
            this.comet=new T.Group();this.group.add(this.comet);
            this.cometHead=this.points([0,0,0,0,0,0],[1,1,1,.7,.9,1],{size:.45,opacity:1});
            this.comet.add(this.cometHead);
            const tailCount=480,positions=new Float32Array(tailCount*3),colors=[];
            this.tailSeeds=[];
            for(let i=0;i<tailCount;i++) {
                const ion=i%3===0,t=Math.pow(random(),ion?.9:1.3);
                this.tailSeeds.push({ion,t,a:random()*Math.PI*2,s:random()});
                const fade=1-t*.8;colors.push(...(ion?[.45*fade,.7*fade,1*fade]:[1*fade,.86*fade,.62*fade]));
            }
            const geometry=new T.BufferGeometry();
            geometry.setAttribute('position',new T.BufferAttribute(positions,3));
            geometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));
            this.cometTail=new T.Points(geometry,new T.PointsMaterial({size:.14,map:this.texture,vertexColors:true,transparent:true,opacity:.85,blending:T.AdditiveBlending,depthWrite:false}));
            this.cometTail.frustumCulled=false;
            this.group.add(this.cometTail);
            const orbit={a:c.a,e:c.e,I:c.inclination,node:c.node,peri:c.node+c.argPeri},path=new Float32Array(361*3);
            for(let i=0;i<=360;i++){const p=D.pointAtEccentricAnomaly(orbit,i/360*Math.PI*2),w=D.toWorld(p),r=Math.hypot(...w),s=SolarScene.auToDisplay(r)/r;path.set(w.map(v=>v*s),i*3);}
            const pathGeometry=new T.BufferGeometry();pathGeometry.setAttribute('position',new T.BufferAttribute(path,3));
            this.cometOrbit=new T.Line(pathGeometry,new T.LineBasicMaterial({color:0x9fd4ff,transparent:true,opacity:.08}));
            this.cometOrbit.frustumCulled=false;this.group.add(this.cometOrbit);
        }
        // Visible spin for any body from its true rate (°/day), ordered like the real rates.
        static spinFromRate(degPerDay,rate) {
            if(!rate)return 0;
            const fast=Math.log10(870.536/1.4),value=Math.log10(Math.abs(degPerDay)/1.4);
            return Math.sign(degPerDay)*Math.max(6,Math.min(24,6+18*value/fast))*(SPEED_BOOST[rate]||1);
        }
        // Map a heliocentric ecliptic vector (AU) to the display: Ceres lives inside the asteroid belt band,
        // everything else follows the planet-anchored distance scale.
        static helioToDisplay(vector,belt=false) {
            const w=D.toWorld(vector),r=Math.hypot(...w)||1;
            const {inner,outer}=LAYOUT.belt;
            const d=belt?inner+Math.max(0,Math.min(1,(r-2.1)/1.2))*(outer-inner):SolarScene.auToDisplay(r);
            return w.map(v=>v*d/r);
        }
        createDwarfs() {
            const T=this.THREE;
            this.dwarfs=new Map();
            for(const dwarf of D.dwarfs) {
                const radius=dwarf.id==='ceres'?.26:dwarf.id==='eris'?.34:.3,random=seeded(dwarf.id.length*131);
                const base=hex(dwarf.color),positions=[],colors=[],count=260;
                for(let i=0;i<count;i++) {
                    const z=random()*2-1,a=random()*Math.PI*2,s=Math.sqrt(1-z*z),r=radius*(.92+random()*.08);
                    positions.push(s*Math.cos(a)*r,z*r,s*Math.sin(a)*r);
                    const pick=random();colors.push(...(pick>.78?[1,1,1]:base.map(v=>v*(pick>.4?1:.7))));
                }
                const size=particleSize(radius);
                const mesh=this.points(positions,colors,{size,opacity:.8});
                mesh.userData.baseSize=size;
                // Haumea: a triaxial ellipsoid (≈ 1 : 0.8 : 0.51, short axis = spin axis) with a ring.
                if(dwarf.shape)mesh.scale.set(dwarf.shape[0],dwarf.shape[2],dwarf.shape[1]);
                if(dwarf.id==='haumea') {
                    const ring=[],ringColors=[];
                    for(let i=0;i<360;i++){const a=random()*Math.PI*2,r=radius*2.9*(.97+random()*.06);ring.push(Math.cos(a)*r,0,Math.sin(a)*r);ringColors.push(.8,.82,.9);}
                    const ringMesh=this.points(ring,ringColors,{size:size*.7,opacity:.6});
                    mesh.add(ringMesh);
                }
                const [a,e,I,node,arg]=dwarf.elements,path=new Float32Array(361*3);
                for(let i=0;i<=360;i++)path.set(SolarScene.helioToDisplay(D.pointAtEccentricAnomaly({a,e,I,node,peri:node+arg},i/360*Math.PI*2),dwarf.id==='ceres'),i*3);
                const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.BufferAttribute(path,3));
                const orbit=new T.Line(geometry,new T.LineBasicMaterial({color:new T.Color(...base),transparent:true,opacity:.08}));
                orbit.frustumCulled=false;
                this.group.add(mesh);this.group.add(orbit);
                this.dwarfs.set(dwarf.id,{dwarf,mesh,orbit,radius,phase:0});
            }
        }
        // The heliosphere: termination shock ≈ 94 AU, heliopause ≈ 121 AU (Voyager 1), its nose facing the
        // interstellar wind (from ecliptic λ ≈ 255.4°, β ≈ 5.2°) and a longer tail downwind.
        createHeliosphere() {
            const T=this.THREE,random=seeded(121);
            const lam=255.4*D.DEG,bet=5.2*D.DEG,nose=D.toWorld([Math.cos(bet)*Math.cos(lam),Math.cos(bet)*Math.sin(lam),Math.sin(bet)]);
            const shell=(au,count,tint,stretch)=>{
                const positions=[],colors=[],R0=SolarScene.auToDisplay(au);
                for(let i=0;i<count;i++) {
                    const z=random()*2-1,a=random()*Math.PI*2,s=Math.sqrt(1-z*z),u=[s*Math.cos(a),z,s*Math.sin(a)];
                    const cos=u[0]*nose[0]+u[1]*nose[1]+u[2]*nose[2],r=R0*(1+stretch*(1-cos)/2)*(.97+random()*.06);
                    positions.push(u[0]*r,u[1]*r,u[2]*r);
                    const shade=.35+random()*.65;colors.push(...tint.map(v=>v*shade));
                }
                return this.points(positions,colors,{size:2.2,opacity:.28});
            };
            this.heliosphere=new T.Group();
            this.heliosphere.add(shell(94,4000,[.45,.6,1],.6));
            this.heliosphere.add(shell(121.6,7000,[.55,.75,1],.9));
            this.group.add(this.heliosphere);
            this.voyagers=new Map();
            for(const probe of D.voyagers) {
                const mesh=this.points([0,0,0,0,0,0],[1,1,1,.7,.9,1],{size:1.2,opacity:1});
                const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.BufferAttribute(new Float32Array(6),3));
                const trail=new T.Line(geometry,new T.LineBasicMaterial({color:0xcfe6ff,transparent:true,opacity:.25}));
                trail.frustumCulled=false;
                this.group.add(mesh);this.group.add(trail);
                this.voyagers.set(probe.id,{probe,mesh,trail});
            }
        }
        updateOuterBodies(jd,dt,rate) {
            for(const item of this.dwarfs.values()) {
                item.mesh.position.fromArray(SolarScene.helioToDisplay(D.dwarfPosition(item.dwarf.id,jd),item.dwarf.id==='ceres'));
                item.phase+=SolarScene.spinFromRate(360*24/item.dwarf.rotationHours,rate)*dt*D.DEG;
                item.mesh.rotation.y=item.phase;
            }
            for(const {probe,mesh,trail} of this.voyagers.values()) {
                const p=D.voyagerPosition(probe.id,jd);
                mesh.visible=trail.visible=!!p&&this.layers.small;
                if(!p)continue;
                const head=SolarScene.helioToDisplay(p),start=SolarScene.helioToDisplay(D.voyagerPosition(probe.id,probe.from));
                mesh.position.fromArray(head);
                trail.geometry.attributes.position.array.set([...start,...head]);
                trail.geometry.attributes.position.needsUpdate=true;
            }
        }
        // Heliocentric Kepler position, scaled so the orbit keeps its true shape and eccentricity.
        displayPosition(id,jd) {
            if(id==='sun')return [0,0,0];
            const scale=DISPLAY[id].orbit/D.orbitalElements(id,jd).a;
            return D.toWorld(D.position(id,jd)).map(value=>value*scale);
        }
        createInterface() {
            this.rotateButton=document.createElement('button');
            this.rotateButton.id='solar-rotate';
            this.rotateButton.className='glass';
            this.rotateButton.type='button';
            this.rotateButton.hidden=true;
            this.rotateButton.addEventListener('click',()=>this.setRotation(!this.autoRotate));
            document.body.appendChild(this.rotateButton);
            this.hud=document.createElement('details');
            this.hud.id='solar-hud';this.hud.className='solar-hud glass';this.hud.hidden=true;
            const speeds=D.RATES.map(rate=>`<option value="${rate}">${({0:'暂停自转 / 公转',1:'实时 · 1×',3600:'1 小时 / 秒',86400:'1 天 / 秒',604800:'7 天 / 秒',2592000:'30 天 / 秒'})[rate]}</option>`).join('');
            this.hud.innerHTML=`<summary><span class="solar-eyebrow">实时轨道</span><strong id="solar-view-name">粒子太阳系</strong><span class="solar-clock" id="solar-clock"></span><span class="solar-expand">视角、时间与资料 <span aria-hidden="true">⌄</span></span></summary>
                <div class="solar-settings">
                    <div class="solar-view-buttons solar-scales" role="group" aria-label="尺度"><button type="button" data-scale="solar" aria-pressed="true">太阳系</button><button type="button" data-scale="stars" aria-pressed="false">近邻恒星</button><button type="button" data-scale="galaxy" aria-pressed="false">银河系</button><button type="button" data-scale="local" aria-pressed="false">本星系群</button></div>
                    <div class="deep-only" hidden>
                        <label class="solar-field">时间倍率<select id="deep-speed" aria-label="时间倍率"></select></label>
                        <div class="solar-view-buttons"><button type="button" id="deep-reset">回到现在</button></div>
                    </div>
                    <div class="solar-only">
                    <div class="solar-view-buttons"><button type="button" data-view="overview">太阳系全景</button><button type="button" data-view="inner">内太阳系</button></div>
                    <label class="solar-field">模拟速度<select id="solar-speed" aria-label="模拟速度">${speeds}</select></label>
                    <label class="solar-field">日期与时间（UTC）<input id="solar-date" type="datetime-local" step="1" min="1972-01-01T00:00:00" max="2050-01-01T00:00:00"></label>
                    <div class="solar-view-buttons"><button type="button" id="solar-apply-date">应用日期</button><button type="button" id="solar-now">回到此刻 · 1×</button></div>
                    <div class="solar-view-buttons"><button type="button" id="solar-pause">暂停运动</button></div>
                    <div class="solar-field" id="solar-layer-label">显示内容</div>
                    <div class="solar-toggles" role="group" aria-labelledby="solar-layer-label">
                        <button type="button" data-layer="orbits" aria-pressed="true">轨道</button><button type="button" data-layer="moons" aria-pressed="true">卫星</button><button type="button" data-layer="small" aria-pressed="true">小天体</button>
                    </div>
                    </div>
                    <p id="solar-error" class="solar-error" role="alert"></p>
                    <dl id="solar-facts"></dl>
                    <p id="solar-fact" class="solar-fact"></p>
                    <p class="solar-note">行星和彗星按开普勒定律沿椭圆轨道运行，离太阳越近跑得越快；卫星按真实周期绕转，距离按开普勒第三定律的比例压缩显示；小行星带和柯伊伯带里每颗粒子都按自己的开普勒速度公转，内圈比外圈快。为了看得清，星球大小和间距使用展示比例并保证互不重叠；自转轴倾角和方向是真实的，转速为展示速度。拖动旋转视角，松手后自动回到默认视角；点击星球近看。</p>
                    <details class="solar-sources"><summary>数据来源与精度</summary><p>NASA/JPL 近似轨道、NAIF 自转模型、JPL 卫星参数，哈雷彗星采用 JPL 小天体数据库的轨道根数（近日点 1986-02-09，下次回归 2061 年）。地球轨道采用地月质心，冥王星采用 2026-10-20 的 Horizons 瞬时轨道近似。未模拟完整多体摄动，不是精密实时星历。时间范围 1972–2049，采用截至 2017 年的闰秒表。</p><p>月球使用真实平黄经，其他卫星的起始位置为示意；周期极短的卫星在高倍速下会改用展示速度。粒子颜色为艺术表现。</p><p><a href="https://ssd.jpl.nasa.gov/planets/approx_pos.html" target="_blank" rel="noopener">JPL 轨道</a> · <a href="https://ssd.jpl.nasa.gov/planets/phys_par.html" target="_blank" rel="noopener">物理参数</a> · <a href="https://ssd.jpl.nasa.gov/sats/elem/" target="_blank" rel="noopener">卫星参数</a> · <a href="SOLAR_MODEL.md" target="_blank" rel="noopener">模型说明</a></p></details>
                </div>`;
            document.body.appendChild(this.hud);
            this.clockText=this.hud.querySelector('#solar-clock');
            this.dateInput=this.hud.querySelector('#solar-date');
            this.speedInput=this.hud.querySelector('#solar-speed');
            this.pauseButton=this.hud.querySelector('#solar-pause');
            this.facts=this.hud.querySelector('#solar-facts');
            this.factText=this.hud.querySelector('#solar-fact');
            this.speedInput.value=String(DEFAULT_RATE);
            this.speedInput.addEventListener('change',()=>{this.clock.setRate(Number(this.speedInput.value));this.refreshHud(true);});
            this.dateInput.addEventListener('focus',()=>{this.dateEditing=true;});
            const applyDate=()=>{
                try {
                    if(!this.dateInput.value||!this.dateInput.checkValidity())throw new Error('请选择 1972–2049 年的有效 UTC 日期。');
                    this.clock.setTime(Date.parse(this.dateInput.value+'Z'));
                    this.dateEditing=false;
                    this.orbitMonth=null;
                    this.resize();
                    this.refreshHud(true);
                    this.hud.querySelector('#solar-error').textContent='';
                }catch(error){this.hud.querySelector('#solar-error').textContent=error.message;}
            };
            this.hud.querySelector('#solar-apply-date').addEventListener('click',applyDate);
            this.dateInput.addEventListener('change',applyDate);
            this.dateInput.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();applyDate();}});
            this.hud.querySelector('#solar-now').addEventListener('click',()=>{
                this.dateEditing=false;this.hud.querySelector('#solar-error').textContent='';
                this.clock.realtime();this.resize();this.refreshHud(true);
            });
            this.pauseButton.addEventListener('click',()=>{this.clock.setRate(this.clock.rate?0:DEFAULT_RATE);this.refreshHud(true);});
            for(const button of this.hud.querySelectorAll('[data-view]'))button.addEventListener('click',()=>this.overview(button.dataset.view==='inner'));
            for(const button of this.hud.querySelectorAll('[data-layer]'))button.addEventListener('click',()=>this.setLayer(button.dataset.layer,!this.layers[button.dataset.layer]));
            this.deepSpeed=this.hud.querySelector('#deep-speed');
            for(const button of this.hud.querySelectorAll('[data-scale]'))button.addEventListener('click',()=>this.setScale(button.dataset.scale));
            this.deepSpeed.addEventListener('change',()=>{this.deepRate[this.scale]=Number(this.deepSpeed.value);this.refreshHud(true);});
            this.hud.querySelector('#deep-reset').addEventListener('click',()=>{this.deepTime[this.scale]=0;if(this.scale==='local')this.resize();this.refreshHud(true);});
        }
        // Switch between the solar system and the larger scales; each keeps its own clock.
        setScale(scale) {
            if(!['solar','stars','galaxy','local'].includes(scale)||!this.deep&&scale!=='solar')return;
            this.scale=scale;
            const solar=scale==='solar';
            this.group.visible=this.active&&solar;
            if(this.deep)this.deep.setScale(solar?null:scale);
            for(const button of this.hud.querySelectorAll('[data-scale]'))button.setAttribute('aria-pressed',String(button.dataset.scale===scale));
            this.hud.querySelector('.solar-only').hidden=!solar;
            this.hud.querySelector('.deep-only').hidden=solar;
            this.rotateButton.hidden=!this.active;
            if(!solar) {
                if(this.focusId){this.focusId=null;this.onFocus(null);}
                const spec=root.DeepSpace.SCALES[scale];
                this.deepSpeed.innerHTML=spec.rates.map(([value,label])=>`<option value="${value}">${label}</option>`).join('');
                this.deepSpeed.value=String(this.deepRate[scale]);
                this.mode=scale;this.azimuth=-.35;this.polar=this.defaultPolar();this.resize();
                this.refreshHud(true);
            } else this.overview();
        }
        setLayer(name,enabled) {
            if(!(name in this.layers))return;
            this.layers[name]=enabled;
            const button=this.hud&&this.hud.querySelector(`[data-layer="${name}"]`);
            if(button)button.setAttribute('aria-pressed',String(enabled));
            this.applyLayers();
        }
        applyLayers() {
            const overview=!this.focusId,L=this.layers;
            for(const line of this.orbits.values())line.visible=L.orbits&&overview;
            if(this.moonGroup)this.moonGroup.visible=L.moons;
            for(const {orbit} of this.moonSystems.values())orbit.visible=L.orbits;
            for(const item of [this.asteroids,this.kuiper,this.comet,this.cometTail])if(item)item.visible=L.small;
            if(this.cometOrbit)this.cometOrbit.visible=L.small&&L.orbits&&overview;
            if(this.dwarfs)for(const {mesh,orbit} of this.dwarfs.values()){mesh.visible=L.small;orbit.visible=L.small&&L.orbits&&overview;}
            if(this.heliosphere)this.heliosphere.visible=L.small;
        }
        activate() {
            this.savedFog=this.scene.fog;this.savedNear=this.camera.near;this.savedFar=this.camera.far;
            this.savedView=this.camera.view&&this.camera.view.enabled?{...this.camera.view}:null;
            this.scene.fog=null;this.active=true;this.group.visible=true;
            this.hud.hidden=false;this.hud.open=false;this.rotateButton.hidden=false;
            this.viewWidth=null;this.viewHeight=null;this.dateEditing=false;this.hud.scrollTop=0;
            document.body.classList.add('solar-active');
            this.clock.realtime();this.clock.setRate(DEFAULT_RATE);
            this.cameraWall=Date.now();this.dragging=false;this.spinUp=1;
            this.setRotation(true);this.scale='solar';this.setScale('solar');this.applyLayers();this.update();
        }
        deactivate() {
            this.active=false;this.group.visible=false;this.hud.hidden=true;this.rotateButton.hidden=true;this.dragging=false;
            if(this.deep)this.deep.setScale(null);
            this.scene.fog=this.savedFog;this.camera.near=this.savedNear;this.camera.far=this.savedFar;
            if(this.savedView) {
                const v=this.savedView;this.camera.setViewOffset(v.fullWidth,v.fullHeight,v.offsetX,v.offsetY,v.width,v.height);
            } else this.camera.clearViewOffset();
            this.camera.updateProjectionMatrix();
            delete this.canvas.dataset.solarBodies;
            document.body.classList.remove('solar-active');
        }
        setRotation(enabled) {
            this.autoRotate=enabled;
            if(enabled)this.spinUp=this.dragging?0:1;
            this.rotateButton.textContent=enabled?'暂停视角旋转':'恢复视角旋转';
            this.rotateButton.setAttribute('aria-pressed',String(enabled));
        }
        defaultPolar(){if(this.scale==='galaxy')return .62;if(this.scale==='local')return 1.05;return this.focusId?1.05:Math.acos(.65);}
        overview(inner=false) {
            this.mode=inner?'inner':'overview';this.focusId=null;
            this.azimuth=-.35;this.polar=this.defaultPolar();
            this.applyLayers();
            this.resize();this.refreshHud(true);this.onFocus(null);
        }
        focus(id) {
            if(!D.byId[id])return;
            if(this.scale&&this.scale!=='solar')this.setScale('solar');
            this.mode='body';this.focusId=id;
            this.azimuth=.3;this.polar=this.defaultPolar();
            this.applyLayers();
            this.resize();this.refreshHud(true);this.onFocus(id);this.update();
        }
        halfFov(){return Math.min(this.camera.fov*Math.PI/360,Math.atan(Math.tan(this.camera.fov*Math.PI/360)*this.camera.aspect));}
        viewRadius() {
            if(this.mode==='inner')return LAYOUT.belt.outer+1;
            const jd=D.toJulianTDB(this.clock.value());
            return Math.max(30,...D.bodies.map(body=>Math.hypot(...this.displayPosition(body.id,jd))+DISPLAY[body.id].extent));
        }
        resize() {
            if(this.scale&&this.scale!=='solar'&&this.deep) {
                this.distance=this.deep.radius(this.scale,this.deepTime[this.scale])/Math.sin(this.halfFov());
                return;
            }
            const radius=this.focusId?DISPLAY[this.focusId].extent*1.25:this.viewRadius()*1.02;
            this.distance=radius/Math.sin(this.halfFov());
        }
        // Dragging only borrows the view: rotation is switched off solely by the rotate button.
        beginDrag() { this.dragging=true; }
        endDrag() { this.dragging=false; if(this.autoRotate)this.spinUp=0; }
        orbit(dx,dy) {
            this.azimuth-=dx*.005;this.polar=Math.max(.03,Math.min(Math.PI-.03,this.polar+dy*.005));
        }
        zoom(amount) {
            if(this.scale&&this.scale!=='solar'&&this.deep) {
                const r=this.deep.radius(this.scale,this.deepTime[this.scale]);
                this.distance=Math.min(r*8,Math.max(r*.08,this.distance*Math.exp(-amount*.07)));
                return;
            }
            const radius=this.focusId?this.meshes.get(this.focusId).userData.radius:2.8;
            this.distance=Math.min(1600,Math.max(radius*1.15,this.distance*Math.exp(-amount*.07)));
        }
        // Ease back to the default tilt after a drag, then ramp the rotation back up.
        stepCamera(dt) {
            if(!this.autoRotate||this.dragging)return;
            this.polar+=(this.defaultPolar()-this.polar)*(1-Math.exp(-dt*2.4));
            this.spinUp=Math.min(1,(this.spinUp??1)+dt/1.4);
            const ease=this.spinUp*this.spinUp*(3-2*this.spinUp);
            this.azimuth+=dt*AUTO_ROTATE_SPEED*ease;
        }
        updateDeep(wall) {
            const T=this.THREE,scale=this.scale,rate=this.deepRate[scale];
            const dt=this.cameraWall?Math.min(.1,Math.max(0,(wall-this.cameraWall)/1000)):0;
            this.stepCamera(dt);this.cameraWall=wall;
            let time=this.deepTime[scale]+rate*dt;
            if(scale==='local')time=Math.min(time,root.DeepData.ANDROMEDA_CONTACT_MYR);
            this.deepTime[scale]=time;
            this.deep.update(scale,time,dt,rate);
            this.target.fromArray(this.deep.center(scale,time));
            const sp=Math.sin(this.polar);
            this.camera.position.set(this.target.x+this.distance*sp*Math.sin(this.azimuth),this.target.y+this.distance*Math.cos(this.polar),this.target.z+this.distance*sp*Math.cos(this.azimuth));
            const width=this.canvas.clientWidth,height=this.canvas.clientHeight;
            if(this.viewWidth!==width||this.viewHeight!==height){this.viewWidth=width;this.viewHeight=height;this.camera.setViewOffset(width,height,0,width<=900?60:38,width,height);}
            if(this.camera.near!==.005||this.camera.far!==6000){this.camera.near=.005;this.camera.far=6000;this.camera.updateProjectionMatrix();}
            this.camera.lookAt(this.target);this.camera.updateMatrixWorld(true);
            this.projected=[];
            if(!this.hudAt||wall-this.hudAt>200){this.refreshHud(false);this.hudAt=wall;this.hud.dataset.focus=scale;this.hud.dataset.rotate=String(this.autoRotate);}
        }
        update(wall=Date.now()) {
            if(this.scale&&this.scale!=='solar'&&this.deep)return this.updateDeep(wall);
            const utc=this.clock.value(wall),jd=D.toJulianTDB(utc),T=this.THREE;
            if((utc===D.MAX_UTC||utc===D.MIN_UTC)&&this.clock.rate)this.clock.setRate(0,wall);
            const dt=this.cameraWall?Math.min(.1,Math.max(0,(wall-this.cameraWall)/1000)):0;
            this.stepCamera(dt);
            this.cameraWall=wall;
            const month=Math.floor(jd/30),rate=this.clock.rate;
            for(const body of D.bodies) {
                const mesh=this.meshes.get(body.id);
                mesh.position.fromArray(this.displayPosition(body.id,jd));
                const phase=this.spinPhase.get(body.id)+SolarScene.displaySpinRate(body.id,rate)*dt*D.DEG;
                this.spinPhase.set(body.id,phase);
                const axes=D.orientation(body.id,jd,phase);
                const basis=new T.Matrix4().makeBasis(new T.Vector3().fromArray(axes.x),new T.Vector3().fromArray(axes.north),new T.Vector3().fromArray(axes.z));
                mesh.quaternion.setFromRotationMatrix(basis);
                if(body.id!=='sun'&&this.orbitMonth!==month) {
                    const orbit=D.orbitalElements(body.id,jd),scale=DISPLAY[body.id].orbit/orbit.a;
                    const array=this.orbits.get(body.id).geometry.attributes.position.array;
                    for(let i=0;i<=256;i++)array.set(D.toWorld(D.pointAtEccentricAnomaly(orbit,i/256*Math.PI*2)).map(value=>value*scale),i*3);
                    this.orbits.get(body.id).geometry.attributes.position.needsUpdate=true;
                }
            }
            this.orbitMonth=month;
            this.updateMoons(jd,dt,rate);
            this.updateSmallBodies(jd);
            this.updateOuterBodies(jd,dt,rate);
            this.target.copy(this.focusId?this.meshes.get(this.focusId).position:new T.Vector3());
            const sp=Math.sin(this.polar);
            this.camera.position.set(this.target.x+this.distance*sp*Math.sin(this.azimuth),this.target.y+this.distance*Math.cos(this.polar),this.target.z+this.distance*sp*Math.cos(this.azimuth));
            const width=this.canvas.clientWidth,height=this.canvas.clientHeight;
            if(this.viewWidth!==width||this.viewHeight!==height) {
                this.viewWidth=width;this.viewHeight=height;
                // Lift the scene clear of the bottom toolbar and the collapsed mobile panel.
                this.camera.setViewOffset(width,height,0,width<=900?60:38,width,height);
            }
            if(this.camera.near!==.01||this.camera.far!==6000){this.camera.near=.01;this.camera.far=6000;this.camera.updateProjectionMatrix();}
            this.camera.lookAt(this.target);this.camera.updateMatrixWorld(true);
            this.keepParticlesVisible(height);
            this.projected=D.bodies.map(body=>{
                const mesh=this.meshes.get(body.id),p=mesh.position.clone().project(this.camera);
                const radius=mesh.userData.radius/mesh.position.distanceTo(this.camera.position)*height/(2*Math.tan(this.camera.fov*Math.PI/360));
                return {id:body.id,x:(p.x+1)*width/2,y:(1-p.y)*height/2,z:p.z,radius,points:mesh.geometry.attributes.position.count,
                    position:mesh.position.toArray(),spin:this.spinPhase.get(body.id),kind:mesh.type};
            });
            if(!this.hudAt||wall-this.hudAt>200) {
                this.refreshHud(false,utc);this.hudAt=wall;
                this.canvas.dataset.solarBodies=JSON.stringify(this.projected);
                this.hud.dataset.utc=new Date(utc).toISOString();
                this.hud.dataset.rate=String(this.clock.rate);
                this.hud.dataset.focus=this.focusId||this.mode;
                this.hud.dataset.azimuth=String(this.azimuth);
                this.hud.dataset.distance=String(this.distance);
                this.hud.dataset.rotate=String(this.autoRotate);
            }
        }
        // Far away, tiny particles fade to nothing; grow them so each glows at least ~1.8 px wide.
        keepParticlesVisible(height) {
            if(!height)return;
            const perPixel=2*Math.tan(this.camera.fov*Math.PI/360)/height,camera=this.camera.position;
            // A particle's light spreads over its area, so dim it by (base/size)² as it grows:
            // colours stay saturated instead of the overlap adding up to white.
            const fit=(mesh,distance,pixels)=>{
                const base=mesh.userData.baseSize,size=Math.max(base,distance*perPixel*pixels);
                if(mesh.userData.baseOpacity===undefined)mesh.userData.baseOpacity=mesh.material.opacity;
                mesh.material.size=size;
                mesh.material.opacity=Math.max(.06,mesh.userData.baseOpacity*Math.pow(base/size,2));
            };
            for(const [id,mesh] of this.meshes) {
                if(id==='sun')continue;
                const distance=mesh.position.distanceTo(camera);
                fit(mesh,distance,1.8);
                const halo=mesh.userData.halo;
                if(halo) {
                    // At least ~18 px across so every planet reads in the overview; ~3.4 radii up close.
                    const size=Math.max(DISPLAY[id].radius*3.4,distance*perPixel*18);
                    halo.scale.set(size,size,1);
                    halo.material.opacity=size>DISPLAY[id].radius*3.5?.75:.32;
                }
            }
            const world=new this.THREE.Vector3();
            for(const {mesh} of this.moonSystems.values()) {
                mesh.getWorldPosition(world);
                fit(mesh,world.distanceTo(camera),1.5);
            }
        }
        updateMoons(jd,dt,rate) {
            if(!this.moonSystems.size)return;
            const T=this.THREE;
            for(const [id,system] of this.moonSystems) {
                const {moon,display,mesh,pivot}=system,parent=this.meshes.get(moon.parent);
                pivot.position.copy(parent.position);
                if(moon.plane==='equator') {
                    const axes=D.orientation(moon.parent,jd,0);
                    pivot.quaternion.setFromRotationMatrix(new T.Matrix4().makeBasis(new T.Vector3().fromArray(axes.x),new T.Vector3().fromArray(axes.north),new T.Vector3().fromArray(axes.z)));
                }
                // True phase while it is watchable; very fast moons switch to a capped display speed.
                const wallRate=360/moon.periodDays*rate/86400;
                let phase=this.moonPhase.get(id);
                if(Math.abs(wallRate)<=MOON_RATE_CAP)phase=D.moonLongitude(id,jd);
                else phase+=Math.sign(wallRate)*MOON_RATE_CAP*dt*D.DEG;
                this.moonPhase.set(id,phase);
                mesh.position.set(Math.cos(phase)*display.orbit,0,-Math.sin(phase)*display.orbit);
                mesh.rotation.y=phase+Math.PI; // tidally locked: the same face looks at the planet
            }
        }
        updateBelt(mesh,days) {
            if(!mesh)return;
            const orbits=mesh.userData.orbits,array=mesh.geometry.attributes.position.array;
            for(let i=0,j=0;i<orbits.length;i+=5,j+=3) {
                const r=orbits[i],angle=orbits[i+2]+orbits[i+1]*days;
                array[j]=r*Math.cos(angle);array[j+1]=r*orbits[i+3]+orbits[i+4];array[j+2]=-r*Math.sin(angle);
            }
            mesh.geometry.attributes.position.needsUpdate=true;
        }
        updateSmallBodies(jd) {
            const days=jd-D.J2000;
            this.updateBelt(this.asteroids,days);
            this.updateBelt(this.kuiper,days);
            if(!this.comet)return;
            const helio=D.cometPosition(jd),w=D.toWorld(helio),r=Math.hypot(...w),s=SolarScene.auToDisplay(r)/r;
            const head=w.map(v=>v*s);this.comet.position.fromArray(head);
            this.cometAU=r;
            const next=D.toWorld(D.cometPosition(jd+2)),ns=SolarScene.auToDisplay(Math.hypot(...next))/Math.hypot(...next);
            const velocity=next.map((v,i)=>v*ns-head[i]),vl=Math.hypot(...velocity)||1;
            const away=head.map(v=>v/(Math.hypot(...head)||1));
            // Tail length grows as the comet nears the sun (sunlight and solar wind fall off as 1/r²).
            const length=Math.min(12,3.5/Math.max(.3,r*r)+.4/Math.max(.3,r));
            const ref=Math.abs(away[1])<.9?[0,1,0]:[1,0,0];
            const p1=[away[1]*ref[2]-away[2]*ref[1],away[2]*ref[0]-away[0]*ref[2],away[0]*ref[1]-away[1]*ref[0]],l1=Math.hypot(...p1);
            p1.forEach((v,i)=>p1[i]=v/l1);
            const p2=[away[1]*p1[2]-away[2]*p1[1],away[2]*p1[0]-away[0]*p1[2],away[0]*p1[1]-away[1]*p1[0]];
            const array=this.cometTail.geometry.attributes.position.array;
            this.tailSeeds.forEach((seed,i)=>{
                const along=seed.t*length,width=(seed.ion?.05:.22)*along*seed.s;
                const lag=seed.ion?0:-.35*along*seed.t;
                for(let k=0;k<3;k++)array[i*3+k]=head[k]+away[k]*along+velocity[k]/vl*lag+(p1[k]*Math.cos(seed.a)+p2[k]*Math.sin(seed.a))*width;
            });
            this.cometTail.geometry.attributes.position.needsUpdate=true;
            this.cometTail.material.opacity=Math.min(.9,length/3);
        }
        pick(ndc) {
            if(this.scale&&this.scale!=='solar')return null;
            const x=(ndc.x+1)*this.canvas.clientWidth/2,y=(1-ndc.y)*this.canvas.clientHeight/2;
            return this.projected.filter(p=>p.z>=-1&&p.z<=1).map(p=>({...p,hit:Math.hypot(x-p.x,y-p.y)}))
                .filter(p=>p.hit<Math.max(12,p.radius)).sort((a,b)=>a.hit-b.hit)[0]?.id||null;
        }
        refreshHud(force=false,utc=this.clock.value()) {
            if(this.scale&&this.scale!=='solar'&&this.deep)return this.refreshDeepHud(force);
            const date=new Date(utc),body=D.byId[this.focusId],rate=this.clock.rate,jd=D.toJulianTDB(utc);
            this.clockText.textContent=date.toISOString().slice(0,19).replace('T',' ')+' UTC · '+(SPEED_LABELS[rate]||'');
            if(!this.dateEditing&&document.activeElement!==this.dateInput)this.dateInput.value=date.toISOString().slice(0,19);
            this.speedInput.value=String(rate);this.pauseButton.textContent=rate?'暂停自转 / 公转':'继续运动 · 1 天/秒';
            if(force) {
                this.hud.querySelector('#solar-view-name').textContent=body?body.name:this.mode==='inner'?'内太阳系':'粒子太阳系';
                for(const button of this.hud.querySelectorAll('[data-view]'))button.setAttribute('aria-pressed',String(button.dataset.view===this.mode));
            }
            if(body) {
                const days=360/Math.abs(body.spinRate),retro=SolarScene.isRetrograde(body.id);
                const period=days<2?(days*24).toFixed(2)+' 小时':days.toFixed(2)+' 天';
                const moons=D.moons.filter(moon=>moon.parent===body.id).map(moon=>moon.name).join('、');
                let rows=`<dt>平均半径</dt><dd>${body.radiusKm.toLocaleString('zh-CN')} km</dd>`;
                if(body.id!=='sun') {
                    const orbit=D.orbitalElements(body.id,jd),r=Math.hypot(...D.position(body.id,jd));
                    // Vis-viva: v² = GM(2/r − 1/a), with GM☉ in AU³/day² (Gaussian gravitational constant).
                    const speed=Math.sqrt(2.9591220828e-4*(2/r-1/orbit.a))*D.AU_KM/86400;
                    rows+=`<dt>距太阳</dt><dd>${r.toFixed(3)} AU</dd><dt>公转速度</dt><dd>${speed.toFixed(2)} km/s</dd><dt>轨道偏心率</dt><dd>${orbit.e.toFixed(4)}</dd>`;
                }
                rows+=`<dt>自转周期</dt><dd>${period}${retro?' · 逆向':''}</dd><dt>${body.id==='sun'?'自转轴与黄道':'自转轴倾角'}</dt><dd>${D.obliquity(body.id,jd).toFixed(1)}°</dd>`;
                if(body.periodYears)rows+=`<dt>公转周期</dt><dd>${body.periodYears<2?(body.periodYears*365.25).toFixed(1)+' 天':body.periodYears.toFixed(2)+' 年'}</dd>`;
                if(moons)rows+=`<dt>卫星</dt><dd>${moons}</dd>`;
                this.facts.innerHTML=rows;
                if(this.factText)this.factText.textContent=FACTS[body.id]||'';
            } else {
                const comet=this.cometAU?this.cometAU.toFixed(1)+' AU':'—';
                this.facts.innerHTML=`<dt>行星</dt><dd>8 颗 + 冥王星</dd><dt>卫星</dt><dd>${D.moons.length} 颗主要卫星</dd><dt>小天体</dt><dd>小行星带 · 柯伊伯带</dd><dt>哈雷彗星距太阳</dt><dd>${comet}</dd>`;
                if(this.factText)this.factText.textContent='把日期改到 1986 年 2 月、速度调到 1 天/秒，可以看到哈雷彗星掠过太阳、拖出彗尾。';
            }
        }
        refreshDeepHud(force) {
            const X=root.DeepData,scale=this.scale,t=this.deepTime[scale],spec=root.DeepSpace.SCALES[scale],rate=this.deepRate[scale];
            const rateLabel=(spec.rates.find(([value])=>value===rate)||[,''])[1];
            const years=scale==='stars'?t:t*1e6;
            const when=years<1?'现在':years<1e4?`${Math.round(years).toLocaleString('zh-CN')} 年后`:years<1e8?`${(years/1e4).toFixed(years<1e5?1:0)} 万年后`:`${(years/1e8).toFixed(1)} 亿年后`;
            this.clockText.textContent=`${when} · ${rateLabel}`;
            if(force)this.hud.querySelector('#solar-view-name').textContent=spec.name;
            let rows='',fact='';
            if(scale==='stars') {
                const b=X.binaryOffset(X.BINARIES[0],2026.8+t);
                rows=`<dt>比邻星距离</dt><dd>${X.distanceAt('proxima',t).toFixed(3)} 光年</dd><dt>南门二距离</dt><dd>${X.distanceAt('alfCenA',t).toFixed(3)} 光年</dd><dt>南门二 A–B 间距</dt><dd>${b.separationAU.toFixed(1)} AU · 周期 79.9 年</dd><dt>巴纳德星距离</dt><dd>${X.distanceAt('barnard',t).toFixed(3)} 光年</dd><dt>天狼星距离</dt><dd>${X.distanceAt('sirius',t).toFixed(3)} 光年</dd>`;
                fact='恒星按实测的自行和视向速度运动：巴纳德星正以约 110 km/s 靠近，约 9800 年后最近（3.75 光年）；南门二约 2.8 万年后最近（约 3.2 光年）。双星按真实周期绕共同质心转动，间距放大约 760 倍显示。太阳外面是奥尔特云。';
            } else if(scale==='galaxy') {
                const W=X.MILKY_WAY,period=X.solarGalacticPeriodMyr(),turned=(t/period*360)%360;
                rows=`<dt>太阳距银心</dt><dd>${(W.sunRadius/10).toFixed(2)} 万光年</dd><dt>太阳公转速度</dt><dd>${X.rotationSpeed(W.sunRadius).toFixed(0)} km/s</dd><dt>绕银心一周</dt><dd>${(period/100).toFixed(2)} 亿年</dd><dt>本次已转过</dt><dd>${turned.toFixed(1)}°</dd><dt>旋臂图样速度</dt><dd>${W.patternSpeed} km/s/kpc</dd>`;
                fact='恒星按平坦的自转曲线绕银心运动（Ω = v / r，内圈转得更快）；旋臂是密度波，以图样速度整体转动，恒星会穿过旋臂；中央的棒以更快的图样速度转动。黄色亮点是太阳。';
            } else {
                const m31=X.andromeda(t),left=X.ANDROMEDA_CONTACT_MYR-t;
                rows=`<dt>仙女座距离</dt><dd>${(m31.distanceKly/10).toFixed(0)} 万光年</dd><dt>接近速度</dt><dd>${Math.abs(m31.speedKms).toFixed(0)} km/s</dd><dt>预计首次相遇</dt><dd>${left>1?(left/100).toFixed(1)+' 亿年后':'正在相遇'}</dd><dt>大麦哲伦云</dt><dd>16.2 万光年</dd><dt>三角座星系</dt><dd>274 万光年</dd>`;
                fact='仙女座在引力作用下加速向银河系落来（两体径向下落，越近越快）。点质量模型取 1.1×10¹² 太阳质量，使首次相遇约在 45 亿年后，与常引用的预测一致；2025 年基于 Gaia 的研究认为，100 亿年内真正合并的概率约为一半。星系自转在此视图中以展示速度显示。';
            }
            this.facts.innerHTML=rows;
            if(this.factText)this.factText.textContent=fact;
        }
        // Venus and Uranus spin backwards; Pluto's positive pole points south of the ecliptic.
        static isRetrograde(id) { return id!=='sun'&&D.obliquity(id,D.J2000)>90; }
    }
    SolarScene.DISPLAY=DISPLAY;
    SolarScene.MOON_DISPLAY=MOON_DISPLAY;
    SolarScene.LAYOUT=LAYOUT;
    SolarScene.DEFAULT_RATE=DEFAULT_RATE;
    SolarScene.AU_TABLE=Object.freeze([[0,0],...D.bodies.filter(body=>body.id!=='sun').map(body=>[D.orbitalElements(body.id,D.J2000).a,DISPLAY[body.id].orbit])]);
    root.SolarScene=SolarScene;
})(globalThis);
