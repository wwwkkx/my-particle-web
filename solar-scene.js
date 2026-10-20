/* Particle presentation with astronomical motion; see SOLAR_MODEL.md. */
(function particleSolarController(root) {
    'use strict';
    const D=root.SolarData;
    // Restore the original overview's particle templates; physical calculations stay in SolarData.
    const DISPLAY=Object.freeze({
        sun:{radius:2.8,orbit:0,start:0,end:3000,sourceRadius:2.5,center:[0,0,0]},
        mercury:{radius:.85,orbit:4,start:3000,end:3600,sourceRadius:.4,center:[4,0,0]},
        venus:{radius:1.1,orbit:6,start:3600,end:4200,sourceRadius:.6,center:[6*Math.SQRT1_2,0,6*Math.SQRT1_2]},
        earth:{radius:1.25,orbit:9,start:4200,end:5000,sourceRadius:.6,center:[0,0,8]},
        mars:{radius:1,orbit:12,start:5000,end:5600,sourceRadius:.5,center:[-10*Math.SQRT1_2,0,10*Math.SQRT1_2]},
        jupiter:{radius:2.4,orbit:16,start:5600,end:7100,sourceRadius:1.8,center:[-14,0,0]},
        saturn:{radius:1.9,orbit:20,start:7100,end:8600,sourceRadius:1.5,center:[-18*Math.SQRT1_2,0,-18*Math.SQRT1_2]},
        uranus:{radius:1.5,orbit:24,start:8600,end:9400,sourceRadius:1,center:[0,0,-22]},
        neptune:{radius:1.5,orbit:28,start:9400,end:10200,sourceRadius:1,center:[26*Math.SQRT1_2,0,-26*Math.SQRT1_2]},
        pluto:{radius:.9,orbit:32,start:10200,end:10800,sourceRadius:.4,center:[30*Math.cos(.5),0,30*Math.sin(.5)]}
    });
    // Display radius and distance from the parent planet's centre, in scene units.
    const MOON_DISPLAY=Object.freeze({
        moon:{radius:.34,orbit:2.6},phobos:{radius:.12,orbit:1.45},deimos:{radius:.1,orbit:1.9},
        io:{radius:.3,orbit:3.2},europa:{radius:.27,orbit:3.8},ganymede:{radius:.38,orbit:4.5},callisto:{radius:.35,orbit:5.3},
        titan:{radius:.36,orbit:5.4},triton:{radius:.28,orbit:2.6},charon:{radius:.46,orbit:1.9}
    });
    const SPEED_LABELS=Object.freeze({0:'已暂停',1:'实时 1×',3600:'1 小时/秒',86400:'1 天/秒',604800:'7 天/秒',2592000:'30 天/秒'});
    const SPEED_BOOST=Object.freeze({0:0,1:1,3600:1.25,86400:1.5,604800:1.8,2592000:2.1});
    const DEFAULT_RATE=86400;
    const AUTO_ROTATE_SPEED=.035;  // radians of azimuth per second
    const MOON_RATE_CAP=200;       // degrees per second before a moon switches to a capped display speed
    const FACTS=Object.freeze({
        sun:'占太阳系总质量约 99.86%，光从这里到地球约需 8 分 20 秒。',
        mercury:'离太阳最近，没有卫星；白天与夜晚温差约 600 °C。',
        venus:'自转方向与多数行星相反，自转一周比公转一周还长；表面约 465 °C。',
        earth:'目前唯一已知存在生命的星球，月球让它的自转轴保持稳定。',
        mars:'拥有太阳系最高的火山奥林帕斯山，高约 22 km。',
        jupiter:'大红斑是一场持续了数百年、比地球还大的风暴。',
        saturn:'平均密度比水还低；壮观的光环主要由冰块组成。',
        uranus:'自转轴倾斜约 98°，几乎是“躺着”绕太阳公转。',
        neptune:'太阳系风速最快的行星，风速可超过 2000 km/h。',
        pluto:'心形的汤博区由氮冰构成；2006 年被归类为矮行星。'
    });

    // Small deterministic noise on the unit sphere, so surface features are the same every visit.
    function seeded(seed) {
        let t=seed>>>0;
        return ()=>{t+=0x6D2B79F5;let r=Math.imul(t^t>>>15,1|t);r^=r+Math.imul(r^r>>>7,61|r);return((r^r>>>14)>>>0)/4294967296;};
    }
    function sphereNoise(seed,waves=7,frequency=3) {
        const random=seeded(seed),list=[];
        for(let i=0;i<waves;i++) {
            const z=random()*2-1,a=random()*Math.PI*2,s=Math.sqrt(1-z*z);
            list.push({d:[s*Math.cos(a),z,s*Math.sin(a)],f:frequency*(.6+random()*1.2),p:random()*Math.PI*2,w:1/(1+i*.35)});
        }
        const total=list.reduce((sum,item)=>sum+item.w,0);
        return n=>list.reduce((sum,{d,f,p,w})=>sum+w*Math.sin(f*(n[0]*d[0]+n[1]*d[1]+n[2]*d[2])*Math.PI+p),0)/total;
    }
    const mix=(a,b,t)=>a.map((value,i)=>value+(b[i]-value)*Math.max(0,Math.min(1,t)));
    function spot(lat,lon,lat0,lon0,size,stretch=1) {
        let dLon=Math.atan2(Math.sin(lon-lon0),Math.cos(lon-lon0))*Math.cos(lat0)/stretch;
        return Math.max(0,1-Math.hypot(dLon,lat-lat0)/size);
    }
    // Colour for a point on a body's surface. n is the local unit vector; local +y is the north pole.
    const SURFACES={
        sun:(n,lat,lon,q)=>{
            const g=q.a(n);let c=mix([1,.42,.06],[1,.86,.3],.5+g*.9);
            if(q.r()>.82)c=[1,.97,.88];
            const s=Math.max(spot(lat,lon,.28,.6,.16),spot(lat,lon,-.22,2.7,.12),spot(lat,lon,.18,4.4,.1));
            return mix(c,[.45,.12,.02],s*1.6);
        },
        mercury:(n,lat,lon,q)=>{const g=q.a(n),h=q.b(n);return mix([.72,.68,.64],[.32,.3,.29],.5-g*1.4).map(v=>v*(h>.55?1.25:1));},
        venus:(n,lat,lon,q)=>{const g=q.a(n);return mix([.98,.88,.58],[.78,.58,.3],.5+.5*Math.sin(lat*5+g*3+Math.cos(lon)*.8));},
        earth:(n,lat,lon,q)=>{
            const land=q.a(n),dry=q.b(n),cloud=q.c(n);
            let c=[.1,.38,.95];
            if(land>.12)c=Math.abs(lat)<.6&&dry>.25?[.82,.66,.38]:[.24,.62,.22];
            if(Math.abs(lat)>1.2)c=[.92,.96,1];
            if(cloud>.5)c=mix(c,[.97,.98,1],.85);
            return c;
        },
        mars:(n,lat,lon,q)=>{const g=q.a(n);let c=g>.2?[.48,.2,.12]:mix([.92,.42,.2],[.78,.32,.16],q.b(n)+.5);return Math.abs(lat)>1.25?[.95,.94,.92]:c;},
        jupiter:(n,lat,lon,q)=>{
            const band=Math.sin(lat*10+q.a(n)*.9);let c=mix([.97,.9,.74],[.74,.48,.3],.5+band*.6);
            c=mix(c,[.96,.36,.2],spot(lat,lon,-.38,0,.22,1.6)*2.2);
            return mix(c,[1,1,.98],Math.max(spot(lat,lon,-.62,2.2,.08),spot(lat,lon,-.62,2.6,.08))*2);
        },
        saturn:(n,lat,lon,q)=>{const c=mix([.97,.88,.62],[.82,.68,.42],.5+.5*Math.sin(lat*8+q.a(n)*.6));return mix(c,[1,.98,.92],spot(lat,lon,.7,1.2,.14,1.8)*2);},
        uranus:(n,lat,lon,q)=>{const c=mix([.6,.9,.95],[.45,.75,.85],.5+.4*Math.sin(lat*6+q.a(n)*.5));return mix(c,[.95,1,1],spot(lat,lon,.5,1,.14)*2);},
        neptune:(n,lat,lon,q)=>{
            let c=mix([.28,.48,.98],[.18,.34,.82],.5+.5*Math.sin(lat*6+q.a(n)));
            c=mix(c,[.08,.14,.42],spot(lat,lon,-.36,0,.2,1.5)*2);
            return mix(c,[.95,.97,1],Math.max(spot(lat,lon,-.7,.6,.12,2.5),spot(lat,lon,-.28,.5,.07,2))*2);
        },
        pluto:(n,lat,lon,q)=>{
            let c=mix([.84,.72,.6],[.62,.5,.4],q.a(n)+.5);
            if(Math.abs(lat)<.35&&Math.sin(lon-2)>.45)c=[.4,.24,.18];
            const heart=Math.max(spot(lat,lon,.3,Math.PI-.1,.32),spot(lat,lon,.12,Math.PI+.42,.26));
            return mix(c,[1,.97,.92],heart*2.4);
        }
    };

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
            this.layers={labels:true,orbits:true,moons:true,small:true};
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
                    const line=new THREE.Line(geometry,new THREE.LineBasicMaterial({color:body.color,transparent:true,opacity:.13}));
                    line.frustumCulled=false;
                    this.orbits.set(body.id,line);
                    this.group.add(line);
                }
            }
            const dustPosition=[],dustColor=[];
            for(let i=11500;i<15000;i++) {
                dustPosition.push(...source.positions.slice(i*3,i*3+3));
                dustColor.push(.55,.65,.85);
            }
            this.group.add(this.points(dustPosition,dustColor,{size:.11,opacity:.32}));
            this.createSunGlow();
            this.createMoons();
            this.createBelts();
            this.createComet();
            this.createInterface();
            this.createLabels();
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
            const material=new T.PointsMaterial({
                size:body.id==='sun'?.22:.18,map:source.material.map,vertexColors:true,
                blending:T.AdditiveBlending,transparent:true,opacity:.95,depthWrite:false
            });
            const points=new T.Points(geometry,material);
            points.frustumCulled=false;
            points.userData.bodyId=body.id;
            points.userData.radius=body.id==='saturn'?display.radius*3.5/1.5:display.radius;
            return points;
        }
        // Recolour the sphere particles with surface features so that rotation is visible.
        paintSurface(id,mesh) {
            const paint=SURFACES[id];
            if(!paint)return;
            const radius=DISPLAY[id].radius,position=mesh.geometry.attributes.position.array,color=mesh.geometry.attributes.color.array;
            let n=0;const seed=[...id].reduce((sum,ch)=>sum*31+ch.charCodeAt(0),7);
            const q={a:sphereNoise(seed,8,2.4),b:sphereNoise(seed+1,6,4),c:sphereNoise(seed+2,7,3.2),r:seeded(seed+3)};
            for(let i=0;i<position.length;i+=3) {
                const x=position[i],y=position[i+1],z=position[i+2],r=Math.hypot(x,y,z);
                if(id==='saturn'&&r>radius*1.15) {
                    // Ring particle: open the Cassini division (about 117,600–122,200 km).
                    const ringKm=74500+(r/(radius/1.5)-2)/1.5*62300;
                    if(ringKm>117600&&ringKm<122200)for(let k=0;k<3;k++)color[i+k]*=.12;
                    continue;
                }
                if(!r)continue;
                const u=[x/r,y/r,z/r],lat=Math.asin(u[1]),lon=Math.atan2(u[2],u[0]);
                color.set(paint(u,lat,lon,q),i);n++;
            }
            mesh.geometry.attributes.color.needsUpdate=true;
            mesh.userData.painted=n;
        }
        // Visible spin speed in degrees per second. Order and direction follow the real rotation;
        // the true rates are either imperceptible (real time) or strobe at high simulation speed.
        static displaySpinRate(id,rate) {
            const body=D.byId[id];
            if(!body||!rate)return 0;
            const fast=Math.log10(870.536/1.4),value=Math.log10(Math.abs(body.spinRate)/1.4);
            const base=Math.max(6,Math.min(30,8+22*value/fast));
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
            const texture=new T.CanvasTexture(canvas);
            this.glowTexture=texture;
            this.sunGlow=new T.Sprite(new T.SpriteMaterial({map:texture,blending:T.AdditiveBlending,transparent:true,depthWrite:false,opacity:.75}));
            this.sunGlow.scale.set(15,15,1);
            this.group.add(this.sunGlow);
        }
        createMoons() {
            const T=this.THREE;
            this.moonGroup=new T.Group();
            this.group.add(this.moonGroup);
            for(const moon of D.moons) {
                const display=MOON_DISPLAY[moon.id],random=seeded(moon.id.length*97+moon.radiusKm|0);
                const count=Math.round(Math.max(70,Math.min(320,display.radius*720)));
                const positions=[],colors=[],noise=sphereNoise(moon.id.charCodeAt(0)*13+count,6,3);
                for(let i=0;i<count;i++) {
                    const z=random()*2-1,a=random()*Math.PI*2,s=Math.sqrt(1-z*z),u=[s*Math.cos(a),z,s*Math.sin(a)];
                    positions.push(u[0]*display.radius,u[1]*display.radius,u[2]*display.radius);
                    let shade=.75+noise(u)*.35;
                    if(moon.id==='moon'&&u[0]>.15&&noise([u[2],u[1],u[0]])>.05)shade*=.55; // near-side maria
                    if(moon.id==='io'&&random()>.86)shade*=1.35;
                    colors.push(...moon.color.map(v=>Math.min(1,v*shade)));
                }
                const mesh=this.points(positions,colors,{size:display.radius<.15?.1:.14,opacity:.95});
                const pivot=new T.Group(),ring=new T.BufferGeometry(),ringPoints=new Float32Array(97*3);
                for(let i=0;i<=96;i++){const t=i/96*Math.PI*2;ringPoints.set([Math.cos(t)*display.orbit,0,-Math.sin(t)*display.orbit],i*3);}
                ring.setAttribute('position',new T.BufferAttribute(ringPoints,3));
                const orbit=new T.Line(ring,new T.LineBasicMaterial({color:0xbfc8d8,transparent:true,opacity:.12}));
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
            const [a,d]=table[table.length-1];
            return d+(au-a)*.4;
        }
        createBelts() {
            const random=seeded(2026);
            const belt=(count,inner,outer,thickness,tint,spread)=>{
                const positions=[],colors=[];
                for(let i=0;i<count;i++) {
                    const au=inner+(outer-inner)*Math.pow(random(),.8),r=SolarScene.auToDisplay(au),a=random()*Math.PI*2;
                    const inc=(random()-.5)*2*spread*D.DEG;
                    positions.push(r*Math.cos(a),r*Math.sin(inc)+(random()-.5)*thickness,-r*Math.sin(a));
                    const shade=.35+random()*.65;colors.push(...tint.map(v=>v*shade));
                }
                return [positions,colors];
            };
            const [aPos,aCol]=belt(2600,2.15,3.35,.18,[.78,.7,.6],9);
            this.asteroids=this.points(aPos,aCol,{size:.08,opacity:.6});
            const [kPos,kCol]=belt(2600,30.5,48,.6,[.55,.68,.95],12);
            this.kuiper=this.points(kPos,kCol,{size:.09,opacity:.35});
            this.group.add(this.asteroids);this.group.add(this.kuiper);
        }
        createComet() {
            const T=this.THREE,random=seeded(1986),c=D.halley;
            this.comet=new T.Group();this.group.add(this.comet);
            this.cometHead=this.points([0,0,0,0,0,0],[1,1,1,.7,.9,1],{size:.45,opacity:1});
            this.comet.add(this.cometHead);
            const tailCount=420,positions=new Float32Array(tailCount*3),colors=[];
            this.tailSeeds=[];
            for(let i=0;i<tailCount;i++) {
                const ion=i%3===0,t=Math.pow(random(),ion?.9:1.3);
                this.tailSeeds.push({ion,t,a:random()*Math.PI*2,s:random()});
                const fade=1-t*.8;colors.push(...(ion?[.45*fade,.7*fade,1*fade]:[1*fade,.86*fade,.62*fade]));
            }
            const geometry=new T.BufferGeometry();
            geometry.setAttribute('position',new T.BufferAttribute(positions,3));
            geometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));
            this.cometTail=new T.Points(geometry,new T.PointsMaterial({size:.12,map:this.texture,vertexColors:true,transparent:true,opacity:.85,blending:T.AdditiveBlending,depthWrite:false}));
            this.cometTail.frustumCulled=false;
            this.group.add(this.cometTail);
            const orbit={a:c.a,e:c.e,I:c.inclination,node:c.node,peri:c.node+c.argPeri},path=new Float32Array(361*3);
            for(let i=0;i<=360;i++){const p=D.pointAtEccentricAnomaly(orbit,i/360*Math.PI*2),w=D.toWorld(p),r=Math.hypot(...w),s=SolarScene.auToDisplay(r)/r;path.set(w.map(v=>v*s),i*3);}
            const pathGeometry=new T.BufferGeometry();pathGeometry.setAttribute('position',new T.BufferAttribute(path,3));
            this.cometOrbit=new T.Line(pathGeometry,new T.LineBasicMaterial({color:0x9fd4ff,transparent:true,opacity:.1}));
            this.cometOrbit.frustumCulled=false;this.group.add(this.cometOrbit);
        }
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
                    <div class="solar-view-buttons"><button type="button" data-view="overview">太阳系全景</button><button type="button" data-view="inner">内太阳系</button></div>
                    <label class="solar-field">模拟速度<select id="solar-speed" aria-label="模拟速度">${speeds}</select></label>
                    <label class="solar-field">日期与时间（UTC）<input id="solar-date" type="datetime-local" step="1" min="1972-01-01T00:00:00" max="2050-01-01T00:00:00"></label>
                    <div class="solar-view-buttons"><button type="button" id="solar-apply-date">应用日期</button><button type="button" id="solar-now">回到此刻 · 1×</button></div>
                    <div class="solar-view-buttons"><button type="button" id="solar-pause">暂停运动</button></div>
                    <div class="solar-field" id="solar-layer-label">显示内容</div>
                    <div class="solar-toggles" role="group" aria-labelledby="solar-layer-label">
                        <button type="button" data-layer="labels" aria-pressed="true">名称</button><button type="button" data-layer="orbits" aria-pressed="true">轨道</button><button type="button" data-layer="moons" aria-pressed="true">卫星</button><button type="button" data-layer="small" aria-pressed="true">小天体</button>
                    </div>
                    <p id="solar-error" class="solar-error" role="alert"></p>
                    <dl id="solar-facts"></dl>
                    <p id="solar-fact" class="solar-fact"></p>
                    <p class="solar-note">拖动旋转视角，松手后自动回到默认视角继续旋转；滚轮或双指缩放，点击星球或名称近看。为看清星球，大小和间距使用展示比例；公转按天文参数计算，自转轴倾角和方向是真实的，自转速度使用便于观察的展示速度（快慢顺序与真实一致）。</p>
                    <details class="solar-sources"><summary>数据来源与精度</summary><p>NASA/JPL 近似轨道、NAIF 自转模型、JPL 卫星参数，哈雷彗星采用 JPL 小天体数据库的轨道根数（近日点 1986-02-09，下次回归 2061 年）。地球轨道采用地月质心，冥王星采用 2026-10-20 的 Horizons 瞬时轨道近似。未模拟完整多体摄动，不是精密实时星历。时间范围 1972–2049，采用截至 2017 年的闰秒表。</p><p>卫星按真实周期公转，月球使用真实平黄经，其他卫星的起始位置为示意；周期极短的卫星在高倍速下会改用展示速度。小行星带和柯伊伯带的粒子为示意分布，按各自典型轨道周期整体运动。</p><p><a href="https://ssd.jpl.nasa.gov/planets/approx_pos.html" target="_blank" rel="noopener">JPL 轨道</a> · <a href="https://ssd.jpl.nasa.gov/planets/phys_par.html" target="_blank" rel="noopener">物理参数</a> · <a href="https://ssd.jpl.nasa.gov/sats/elem/" target="_blank" rel="noopener">卫星参数</a> · <a href="SOLAR_MODEL.md" target="_blank" rel="noopener">模型说明</a></p></details>
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
        }
        createLabels() {
            this.labelLayer=document.createElement('div');
            this.labelLayer.className='solar-labels';this.labelLayer.hidden=true;
            this.labelLayer.setAttribute('aria-label','天体名称');
            this.labels=new Map();
            const add=(id,text,kind,focusId)=>{
                const label=document.createElement(focusId?'button':'span');
                label.className='solar-label solar-label-'+kind;label.textContent=text;
                if(focusId){label.type='button';label.addEventListener('click',()=>this.focus(focusId));}
                this.labelLayer.appendChild(label);this.labels.set(id,{label,kind,visible:false});
            };
            for(const body of D.bodies)add(body.id,body.name,body.id==='sun'?'star':'planet',body.id);
            for(const moon of D.moons)add(moon.id,moon.name,'moon',null);
            add('halley','哈雷彗星','comet',null);
            document.body.appendChild(this.labelLayer);
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
            if(this.labelLayer)this.labelLayer.hidden=!this.active||!L.labels;
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
            this.setRotation(true);this.overview();this.applyLayers();this.update();
        }
        deactivate() {
            this.active=false;this.group.visible=false;this.hud.hidden=true;this.rotateButton.hidden=true;this.dragging=false;
            if(this.labelLayer)this.labelLayer.hidden=true;
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
        defaultPolar(){return this.focusId?1.05:Math.acos(.65);}
        overview(inner=false) {
            this.mode=inner?'inner':'overview';this.focusId=null;
            this.azimuth=-.35;this.polar=this.defaultPolar();
            this.applyLayers();
            this.resize();this.refreshHud(true);this.onFocus(null);
        }
        focus(id) {
            if(!D.byId[id])return;
            this.mode='body';this.focusId=id;
            this.azimuth=.3;this.polar=this.defaultPolar();
            this.applyLayers();
            this.resize();this.refreshHud(true);this.onFocus(id);this.update();
        }
        halfFov(){return Math.min(this.camera.fov*Math.PI/360,Math.atan(Math.tan(this.camera.fov*Math.PI/360)*this.camera.aspect));}
        viewRadius() {
            if(this.mode==='inner')return 14;
            const jd=D.toJulianTDB(this.clock.value());
            return Math.max(30,...D.bodies.map(body=>Math.hypot(...this.displayPosition(body.id,jd))+(body.id==='saturn'?4.5:DISPLAY[body.id].radius)));
        }
        resize() {
            const radius=this.focusId?DISPLAY[this.focusId].radius*(this.focusId==='saturn'?2.7:1.55):this.viewRadius()*1.04;
            this.distance=radius/Math.sin(this.halfFov());
        }
        // Dragging only borrows the view: rotation is switched off solely by the rotate button.
        beginDrag() { this.dragging=true; }
        endDrag() { this.dragging=false; if(this.autoRotate)this.spinUp=0; }
        orbit(dx,dy) {
            this.azimuth-=dx*.005;this.polar=Math.max(.03,Math.min(Math.PI-.03,this.polar+dy*.005));
        }
        zoom(amount) {
            const radius=this.focusId?this.meshes.get(this.focusId).userData.radius:2.8;
            this.distance=Math.min(500,Math.max(radius*1.15,this.distance*Math.exp(-amount*.07)));
        }
        // Advance the camera: ease back to the default tilt after a drag, then ramp rotation back up.
        stepCamera(dt) {
            if(!this.autoRotate||this.dragging)return;
            this.polar+=(this.defaultPolar()-this.polar)*(1-Math.exp(-dt*2.4));
            this.spinUp=Math.min(1,(this.spinUp??1)+dt/1.4);
            const ease=this.spinUp*this.spinUp*(3-2*this.spinUp);
            this.azimuth+=dt*AUTO_ROTATE_SPEED*ease;
        }
        update(wall=Date.now()) {
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
            this.target.copy(this.focusId?this.meshes.get(this.focusId).position:new T.Vector3());
            const sp=Math.sin(this.polar);
            this.camera.position.set(this.target.x+this.distance*sp*Math.sin(this.azimuth),this.target.y+this.distance*Math.cos(this.polar),this.target.z+this.distance*sp*Math.cos(this.azimuth));
            const width=this.canvas.clientWidth,height=this.canvas.clientHeight;
            if(this.viewWidth!==width||this.viewHeight!==height) {
                this.viewWidth=width;this.viewHeight=height;
                // Lift the scene clear of the bottom toolbar and the collapsed mobile panel.
                this.camera.setViewOffset(width,height,0,width<=900?60:38,width,height);
            }
            if(this.camera.near!==.01||this.camera.far!==1000){this.camera.near=.01;this.camera.far=1000;this.camera.updateProjectionMatrix();}
            this.camera.lookAt(this.target);this.camera.updateMatrixWorld(true);
            this.projected=D.bodies.map(body=>{
                const mesh=this.meshes.get(body.id),p=mesh.position.clone().project(this.camera);
                const radius=mesh.userData.radius/mesh.position.distanceTo(this.camera.position)*height/(2*Math.tan(this.camera.fov*Math.PI/360));
                return {id:body.id,x:(p.x+1)*width/2,y:(1-p.y)*height/2,z:p.z,radius,points:mesh.geometry.attributes.position.count,
                    position:mesh.position.toArray(),spin:this.spinPhase.get(body.id),kind:mesh.type};
            });
            this.updateLabels(width,height);
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
        updateSmallBodies(jd) {
            const days=jd-D.J2000;
            if(this.asteroids)this.asteroids.rotation.y=days*360/(4.6*365.25)*D.DEG;
            if(this.kuiper)this.kuiper.rotation.y=days*360/(290*365.25)*D.DEG;
            if(!this.comet)return;
            const helio=D.cometPosition(jd),w=D.toWorld(helio),r=Math.hypot(...w),s=SolarScene.auToDisplay(r)/r;
            const head=w.map(v=>v*s);this.comet.position.fromArray(head);
            this.cometAU=r;
            const next=D.toWorld(D.cometPosition(jd+2)),ns=SolarScene.auToDisplay(Math.hypot(...next))/Math.hypot(...next);
            const velocity=next.map((v,i)=>v*ns-head[i]),vl=Math.hypot(...velocity)||1;
            const away=head.map(v=>v/(Math.hypot(...head)||1));
            const length=Math.min(9,2.4/Math.max(.25,r));
            // Two perpendicular axes for the tail's width.
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
        updateLabels(width,height) {
            if(!this.labelLayer||this.labelLayer.hidden||!this.labels)return;
            const T=this.THREE,v=new T.Vector3(),scale=height/(2*Math.tan(this.camera.fov*Math.PI/360));
            const place=(id,position,radius,show)=>{
                const entry=this.labels.get(id);
                if(!entry)return;
                let visible=show;
                if(visible) {
                    v.copy(position).project(this.camera);
                    const x=(v.x+1)*width/2,y=(1-v.y)*height/2;
                    visible=v.z>-1&&v.z<1&&x>-40&&x<width+40&&y>-20&&y<height+20;
                    if(visible) {
                        const px=radius/Math.max(.001,position.distanceTo(this.camera.position))*scale;
                        entry.label.style.transform=`translate3d(${Math.round(x+Math.max(4,px)+6)}px,${Math.round(y)}px,0) translateY(-50%)`;
                    }
                }
                if(entry.visible!==visible){entry.visible=visible;entry.label.style.visibility=visible?'visible':'hidden';}
            };
            for(const body of D.bodies) {
                const mesh=this.meshes.get(body.id);
                place(body.id,mesh.position,mesh.userData.radius,!this.focusId||this.focusId===body.id);
            }
            const world=new T.Vector3();
            for(const [id,{moon,mesh,display}] of this.moonSystems) {
                const show=this.layers.moons&&(this.focusId===moon.parent||(this.mode==='inner'&&moon.parent==='earth'));
                if(show)mesh.getWorldPosition(world);
                place(id,world,display.radius,show);
            }
            if(this.comet)place('halley',this.comet.position,.3,this.layers.small&&!this.focusId);
        }
        pick(ndc) {
            const x=(ndc.x+1)*this.canvas.clientWidth/2,y=(1-ndc.y)*this.canvas.clientHeight/2;
            return this.projected.filter(p=>p.z>=-1&&p.z<=1).map(p=>({...p,hit:Math.hypot(x-p.x,y-p.y)}))
                .filter(p=>p.hit<Math.max(12,p.radius)).sort((a,b)=>a.hit-b.hit)[0]?.id||null;
        }
        refreshHud(force=false,utc=this.clock.value()) {
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
                if(body.id!=='sun')rows+=`<dt>距太阳</dt><dd>${Math.hypot(...D.position(body.id,jd)).toFixed(3)} AU</dd>`;
                rows+=`<dt>自转周期</dt><dd>${period}${retro?' · 逆向':''}</dd><dt>${body.id==='sun'?'自转轴与黄道':'自转轴倾角'}</dt><dd>${D.obliquity(body.id,jd).toFixed(1)}°</dd>`;
                if(body.periodYears)rows+=`<dt>公转周期</dt><dd>${body.periodYears<2?(body.periodYears*365.25).toFixed(1)+' 天':body.periodYears.toFixed(2)+' 年'}</dd>`;
                if(moons)rows+=`<dt>图中卫星</dt><dd>${moons}</dd>`;
                this.facts.innerHTML=rows;
                if(this.factText)this.factText.textContent=FACTS[body.id]||'';
            } else {
                const comet=this.cometAU?this.cometAU.toFixed(1)+' AU':'—';
                this.facts.innerHTML=`<dt>行星</dt><dd>8 颗 + 冥王星</dd><dt>卫星</dt><dd>${D.moons.length} 颗主要卫星</dd><dt>小天体</dt><dd>小行星带 · 柯伊伯带</dd><dt>哈雷彗星距太阳</dt><dd>${comet}</dd>`;
                if(this.factText)this.factText.textContent='点击行星或名称近看。把日期改到 1986 年 2 月、速度调到 1 天/秒，可以看到哈雷彗星掠过太阳、拖出彗尾。';
            }
        }
        // Venus and Uranus spin backwards; Pluto's positive pole points south of the ecliptic.
        static isRetrograde(id) { return id!=='sun'&&D.obliquity(id,D.J2000)>90; }
    }
    SolarScene.DISPLAY=DISPLAY;
    SolarScene.MOON_DISPLAY=MOON_DISPLAY;
    SolarScene.DEFAULT_RATE=DEFAULT_RATE;
    SolarScene.AU_TABLE=Object.freeze([[0,0],...D.bodies.filter(body=>body.id!=='sun').map(body=>[D.orbitalElements(body.id,D.J2000).a,DISPLAY[body.id].orbit])]);
    root.SolarScene=SolarScene;
})(globalThis);
