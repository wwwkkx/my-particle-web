/* A camera can magnify a body; its physical geometry and orbital coordinates never change scale. */
(function (root) {
    'use strict';
    const D = root.SolarData;
    class SolarScene {
        constructor(THREE, scene, camera, canvas, onFocus) {
            Object.assign(this, {THREE, scene, camera, canvas, onFocus});
            this.clock = new D.Clock();
            this.group = new THREE.Group();
            this.group.visible = false;
            scene.add(this.group);
            this.meshes = new Map();
            this.orbits = new Map();
            this.focusId = null;
            this.active = false;
            this.mode = 'overview';
            this.target = new THREE.Vector3();
            this.azimuth = .25;
            this.polar = .55;
            this.distance = 100;
            this.projected = [];
            this.group.add(new THREE.AmbientLight(0xffffff, .38));
            this.group.add(new THREE.PointLight(0xffffff, 1.1, 0, 0));
            for (const body of D.bodies) {
                const options={map:this.surface(body)};
                const material = body.id==='sun' ? new THREE.MeshBasicMaterial(options) : new THREE.MeshPhongMaterial({...options,shininess:3});
                const mesh = new THREE.Mesh(new THREE.SphereGeometry(body.radiusAU, 64, 32), material);
                mesh.userData.bodyId = body.id;
                this.group.add(mesh);
                this.meshes.set(body.id, mesh);
                if (body.id !== 'sun') {
                    const geometry = new THREE.BufferGeometry();
                    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(257 * 3), 3));
                    const line = new THREE.Line(geometry, new THREE.LineBasicMaterial({color: body.color, transparent: true, opacity: .32}));
                    line.frustumCulled = false;
                    this.group.add(line);
                    this.orbits.set(body.id, line);
                }
            }
            // NASA main-ring radii measured from Saturn's center, including the Cassini gap.
            const saturn = this.meshes.get('saturn');
            for (const [inner, outer, opacity] of [[66900,74510,.13],[74658,91975,.32],[91975,117507,.78],[122340,136780,.62]]) {
                const ring = new THREE.Mesh(new THREE.RingGeometry(inner/D.AU_KM, outer/D.AU_KM, 160),
                    new THREE.MeshPhongMaterial({color: 0xcdb98e, side: THREE.DoubleSide, transparent: true, opacity}));
                ring.rotation.x = Math.PI/2;
                saturn.add(ring);
            }
            this.createInterface();
        }
        surface(body) {
            const canvas = document.createElement('canvas');
            canvas.width = 512; canvas.height = 256;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = body.color; ctx.fillRect(0,0,512,256);
            // Illustrative longitude/latitude markings, NOT an observed surface map.
            for (let y=0;y<256;y++) {
                const bands = ['jupiter','saturn','uranus','neptune'].includes(body.id);
                const brightness = (bands ? Math.sin(y*.22)+.45*Math.sin(y*.61) : Math.sin(y*.07))*.06;
                ctx.fillStyle = brightness > 0 ? `rgba(255,255,255,${brightness})` : `rgba(0,0,0,${-brightness})`;
                ctx.fillRect(0,y,512,1);
            }
            for (let x=0;x<512;x+=64) {
                ctx.fillStyle='rgba(255,255,255,.12)'; ctx.fillRect(x,0,1,256);
            }
            for (let y=32;y<256;y+=32) {
                ctx.fillStyle='rgba(255,255,255,.10)'; ctx.fillRect(0,y,512,1);
            }
            ctx.fillStyle='rgba(255,255,255,.6)'; ctx.fillRect(0,0,3,256);
            const texture = new this.THREE.CanvasTexture(canvas);
            return texture;
        }
        createInterface() {
            this.hud = document.createElement('details');
            this.hud.id='solar-hud'; this.hud.className='solar-hud glass'; this.hud.hidden=true;
            this.hud.innerHTML = `<summary><span class="solar-eyebrow">SOLAR SYSTEM · 真实比例</span><strong id="solar-view-name">太阳系全景</strong><span class="solar-clock" id="solar-clock"></span><span class="solar-model-caption">轨道近似 · 纹理示意 · 圆点为定位标记</span><span class="solar-expand">时间与数据 <span aria-hidden="true">⌄</span></span></summary>
                <div class="solar-settings">
                    <div class="solar-view-buttons"><button type="button" data-view="overview">全太阳系</button><button type="button" data-view="inner">内太阳系</button></div>
                    <label class="solar-field">模拟速度<select id="solar-speed" aria-label="模拟速度"><option value="0">暂停</option><option value="1">实时 · 1×</option><option value="3600">1 小时 / 秒</option><option value="86400">1 天 / 秒</option><option value="2592000">30 天 / 秒</option></select></label>
                    <label class="solar-field">日期与时间（UTC）<input id="solar-date" type="datetime-local" step="1" min="1972-01-01T00:00:00" max="2050-01-01T00:00:00"></label>
                    <div class="solar-view-buttons"><button type="button" id="solar-apply-date">应用日期</button></div>
                    <div class="solar-view-buttons"><button type="button" id="solar-now">回到此刻 · 1×</button><button type="button" id="solar-pause">暂停</button></div>
                    <p id="solar-error" class="solar-error" role="alert"></p>
                    <dl id="solar-facts"></dl>
                    <p class="solar-note">大小与距离使用同一比例。名称旁的圆点只是定位标记；表面纹理与照明为示意。点击名称跟随，拖动环绕，滚轮 / 双指缩放。</p>
                    <details class="solar-sources"><summary>数据来源与精度</summary><p>NASA/JPL 近似轨道与行星物理参数、NAIF 自转模型。八大行星为按日期计算的椭圆轨道；地球位置采用地月质心。冥王星为 2026-10-20 的 Horizons 瞬时轨道近似，远离该日期误差会增加。未模拟完整多体摄动、卫星及光行时，不是实时观测星历。</p><p>时间范围 1972–2049；UTC 转换采用截至 2017 年的闰秒表，未来闰秒尚未计入。太阳、气态行星显示标称自转周期，不模拟纬度差速。自转与公转始终共用同一时间倍率。</p><p><a href="https://ssd.jpl.nasa.gov/planets/approx_pos.html" target="_blank" rel="noopener">JPL 轨道</a> · <a href="https://ssd.jpl.nasa.gov/planets/phys_par.html" target="_blank" rel="noopener">物理参数</a> · <a href="https://naif.jpl.nasa.gov/pub/naif/generic_kernels/pck/pck00011.tpc" target="_blank" rel="noopener">NAIF 自转</a> · <a href="SOLAR_MODEL.md" target="_blank" rel="noopener">模型说明</a></p></details>
                </div>`;
            document.body.appendChild(this.hud);
            this.clockText=this.hud.querySelector('#solar-clock');
            this.dateInput=this.hud.querySelector('#solar-date');
            this.speedInput=this.hud.querySelector('#solar-speed');
            this.pauseButton=this.hud.querySelector('#solar-pause');
            this.facts=this.hud.querySelector('#solar-facts');
            this.speedInput.value='1';
            this.speedInput.addEventListener('change',()=>{this.clock.setRate(Number(this.speedInput.value));this.refreshHud(true);});
            this.dateInput.addEventListener('focus',()=>{this.dateEditing=true;});
            const applyDate=()=>{
                try {
                    if (!this.dateInput.checkValidity() || !this.dateInput.value) throw new Error('请选择 1972–2049 年的有效 UTC 日期。');
                    this.clock.setTime(Date.parse(this.dateInput.value+'Z'));
                    this.dateEditing=false;
                    this.refreshHud(true);
                    this.hud.querySelector('#solar-error').textContent='';
                } catch(error) { this.hud.querySelector('#solar-error').textContent=error.message; }
            };
            this.hud.querySelector('#solar-apply-date').addEventListener('click',applyDate);
            this.dateInput.addEventListener('change',applyDate);
            this.dateInput.addEventListener('keydown',event=>{
                if(event.key==='Enter') {event.preventDefault();applyDate();}
            });
            this.hud.querySelector('#solar-now').addEventListener('click',()=>{this.dateEditing=false;this.hud.querySelector('#solar-error').textContent='';this.clock.realtime();this.refreshHud(true);});
            this.pauseButton.addEventListener('click',()=>{this.clock.setRate(this.clock.rate ? 0 : 1);this.refreshHud(true);});
            for (const button of this.hud.querySelectorAll('[data-view]')) button.addEventListener('click',()=>this.overview(button.dataset.view==='inner'));
            this.labelLayer=document.createElement('div');
            this.labelLayer.id='solar-labels'; this.labelLayer.hidden=true;
            this.labelLayer.innerHTML='<svg aria-hidden="true"></svg>';
            document.body.appendChild(this.labelLayer);
            this.labels=new Map();
            for (const body of D.bodies) {
                const button=document.createElement('button');
                button.type='button'; button.className='solar-label'; button.dataset.body=body.id;
                button.textContent=body.name+(body.dwarf?' · 矮行星':'');
                button.setAttribute('aria-label','跟随'+body.name);
                button.addEventListener('click',()=>this.focus(body.id));
                this.labelLayer.appendChild(button);
                const line=document.createElementNS('http://www.w3.org/2000/svg','line');
                const dot=document.createElementNS('http://www.w3.org/2000/svg','circle');
                dot.setAttribute('r','2.5');
                this.labelLayer.querySelector('svg').append(line,dot);
                this.labels.set(body.id,{button,line,dot});
            }
        }
        activate() {
            this.savedFog=this.scene.fog;this.savedNear=this.camera.near;this.savedFar=this.camera.far;
            this.scene.fog=null;
            this.active=true;this.group.visible=true;this.hud.hidden=false;this.labelLayer.hidden=false;
            document.body.classList.add('solar-active');
            this.hud.open=window.innerWidth>900;
            this.clock.realtime();this.overview();
            this.update();
        }
        deactivate() {
            this.active=false;this.group.visible=false;this.hud.hidden=true;this.labelLayer.hidden=true;
            this.scene.fog=this.savedFog;this.camera.near=this.savedNear;this.camera.far=this.savedFar;
            this.camera.updateProjectionMatrix();
            document.body.classList.remove('solar-active');
        }
        overview(inner=false) {
            this.mode=inner?'inner':'overview';this.focusId=null;
            this.labelLayer.dataset.view=this.mode;
            for(const line of this.orbits.values())line.visible=true;
            this.azimuth=.25;this.polar=.55;
            this.resize(true);
            this.refreshHud(true);this.onFocus(null);
        }
        focus(id) {
            if (!D.byId[id]) return;
            this.mode='body';this.focusId=id;
            this.labelLayer.dataset.view='body';
            for(const line of this.orbits.values())line.visible=false;
            this.azimuth=.3;this.polar=1.05;
            // Camera distance depends on the viewport; physical radii remain unchanged.
            const halfFov=this.halfFov();
            this.distance=D.byId[id].radiusAU*(id==='saturn'?2.8:1.55)/Math.sin(halfFov);
            this.refreshHud(true);this.onFocus(id);this.update();
        }
        halfFov() {return Math.min(this.camera.fov*Math.PI/360,Math.atan(Math.tan(this.camera.fov*Math.PI/360)*this.camera.aspect));}
        resize(reset=false) {
            if (this.mode!=='body') {
                this.distance=(this.mode==='inner'?1.85:51)*1.12/Math.sin(this.halfFov());
            } else {
                this.distance=D.byId[this.focusId].radiusAU*(this.focusId==='saturn'?2.8:1.55)/Math.sin(this.halfFov());
            }
        }
        orbit(dx,dy) {this.azimuth-=dx*.005;this.polar=Math.max(.03,Math.min(Math.PI-.03,this.polar+dy*.005));}
        zoom(amount) {
            const radius=this.focusId?D.byId[this.focusId].radiusAU:0;
            this.distance=Math.min(800,Math.max(radius*1.1 || .002,this.distance*Math.exp(-amount*.07)));
        }
        update(wall=Date.now()) {
            const utc=this.clock.value(wall);
            if ((utc===D.MAX_UTC || utc===D.MIN_UTC) && this.clock.rate) this.clock.setRate(0,wall);
            const jd=D.toJulianTDB(utc);
            const month=Math.floor(jd/30);
            for (const body of D.bodies) {
                const mesh=this.meshes.get(body.id);
                mesh.position.fromArray(D.toWorld(D.position(body.id,jd)));
                const axis=D.orientation(body.id,jd);
                const basis=new this.THREE.Matrix4().makeBasis(new this.THREE.Vector3().fromArray(axis.x),new this.THREE.Vector3().fromArray(axis.north),new this.THREE.Vector3().fromArray(axis.z));
                mesh.quaternion.setFromRotationMatrix(basis);
                if (body.id!=='sun' && this.orbitMonth!==month) {
                    const orbit=D.orbitalElements(body.id,jd),array=this.orbits.get(body.id).geometry.attributes.position.array;
                    for(let i=0;i<=256;i++) array.set(D.toWorld(D.pointAtEccentricAnomaly(orbit,i/256*Math.PI*2)),i*3);
                    this.orbits.get(body.id).geometry.attributes.position.needsUpdate=true;
                }
            }
            this.orbitMonth=month;
            this.target.copy(this.focusId?this.meshes.get(this.focusId).position:new this.THREE.Vector3());
            const sp=Math.sin(this.polar);
            this.camera.position.set(this.target.x+this.distance*sp*Math.sin(this.azimuth),this.target.y+this.distance*Math.cos(this.polar),this.target.z+this.distance*sp*Math.cos(this.azimuth));
            const near=Math.max(1e-9,this.distance*.0001);
            if(this.camera.near!==near || this.camera.far!==1000) {this.camera.near=near;this.camera.far=1000;this.camera.updateProjectionMatrix();}
            this.camera.lookAt(this.target);this.camera.updateMatrixWorld(true);
            this.updateLabels();
            if(!this.hudAt || wall-this.hudAt>200) {this.refreshHud(false,utc);this.hudAt=wall;}
            this.hud.dataset.utc=new Date(utc).toISOString();
            this.hud.dataset.rate=String(this.clock.rate);
            this.hud.dataset.focus=this.focusId || this.mode;
            this.hud.dataset.jd=String(jd);
            this.hud.dataset.distance=String(this.distance);
        }
        updateLabels() {
            const width=this.canvas.clientWidth,height=this.canvas.clientHeight;
            const placed=[];
            const reserved=[this.hud,document.querySelector('.controls-container'),document.querySelector('.scene-controls'),document.querySelector('#solar-system-btn')]
                .filter(Boolean).map(element=>element.getBoundingClientRect()).map(rect=>({x:rect.left,y:rect.top,w:rect.width,h:rect.height}));
            const overlaps=(a,b)=>a.x<b.x+b.w+5&&a.x+a.w+5>b.x&&a.y<b.y+b.h+5&&a.y+a.h+5>b.y;
            this.projected=[];
            for (const body of D.bodies) {
                const label=this.labels.get(body.id),mesh=this.meshes.get(body.id);
                const screen=mesh.position.clone().project(this.camera);
                const show=(this.mode!=='body'||body.id===this.focusId)&&screen.z>=-1&&screen.z<=1&&Math.abs(screen.x)<.96&&Math.abs(screen.y)<.92;
                label.button.hidden=!show;label.line.style.display=label.dot.style.display=show?'':'none';
                if(!show)continue;
                const x=(screen.x+1)*width/2,y=(1-screen.y)*height/2;
                const w=body.id==='pluto'?112:64,h=30;
                const candidates=[];
                for(const dx of [12,-w-12,82,-w-82,152,-w-152]) for(let step=0;step<15;step++) {
                    const dy=step===0?0:(step%2?1:-1)*Math.ceil(step/2)*35;
                    const candidate={x:x+dx,y:y+dy-15,w,h};
                    if(candidate.x<4||candidate.x+w>width-4||candidate.y<4||candidate.y+h>height-4)continue;
                    if([...reserved,...placed].some(rect=>overlaps(candidate,rect)))continue;
                    candidates.push({...candidate,cost:dx*dx+dy*dy});
                }
                candidates.sort((a,b)=>a.cost-b.cost);
                const best=candidates[0];
                if(!best) {label.button.hidden=true;label.line.style.display=label.dot.style.display='none';continue;}
                const left=best.x,top=best.y;
                placed.push(best);
                label.button.style.left=left+'px';label.button.style.top=top+'px';
                label.button.setAttribute('aria-pressed',String(body.id===this.focusId));
                label.line.setAttribute('x1',x);label.line.setAttribute('y1',y);label.line.setAttribute('x2',left);label.line.setAttribute('y2',top+h/2);
                label.dot.setAttribute('cx',x);label.dot.setAttribute('cy',y);
                label.button.dataset.positionAu=mesh.position.toArray().join(',');
                label.button.dataset.radiusAu=String(body.radiusAU);
                label.button.dataset.spinRadians=String(D.spinAngle(body.id,D.toJulianTDB(this.clock.value())));
                this.projected.push({id:body.id,x,y});
            }
        }
        pick(ndc) {
            const x=(ndc.x+1)*this.canvas.clientWidth/2,y=(1-ndc.y)*this.canvas.clientHeight/2;
            return this.projected.map(p=>({...p,d:Math.hypot(x-p.x,y-p.y)})).filter(p=>p.d<12).sort((a,b)=>a.d-b.d)[0]?.id || null;
        }
        refreshHud(force=false,utc=this.clock.value()) {
            const date=new Date(utc),body=D.byId[this.focusId];
            const rate=this.clock.rate;
            const rateText=({0:'已暂停',1:'实时 1×',3600:'1 小时/秒',86400:'1 天/秒',2592000:'30 天/秒'})[rate];
            this.clockText.textContent=date.toISOString().slice(0,19).replace('T',' ')+' UTC · '+rateText;
            if(!this.dateEditing&&document.activeElement!==this.dateInput)this.dateInput.value=date.toISOString().slice(0,19);
            this.speedInput.value=String(rate);this.pauseButton.textContent=rate?'暂停':'继续 · 1×';
            if(force) {
                this.hud.querySelector('#solar-view-name').textContent=body?'跟随 · '+body.name+(body.dwarf?'（矮行星）':''):this.mode==='inner'?'内太阳系':'太阳系全景';
                for(const button of this.hud.querySelectorAll('[data-view]'))button.setAttribute('aria-pressed',String(button.dataset.view===this.mode));
            }
            if(body) {
                const distance=Math.hypot(...D.position(body.id,D.toJulianTDB(utc)));
                const spinDays=360/Math.abs(body.spinRate);
                const hours=spinDays*24;
                this.facts.innerHTML=`<dt>平均半径</dt><dd>${body.radiusKm.toLocaleString('zh-CN')} km</dd><dt>当前日心距离</dt><dd>${distance.toFixed(6)} AU</dd><dt>恒星自转周期</dt><dd>${hours<48?hours.toFixed(3)+' 小时':spinDays.toFixed(3)+' 天'}</dd><dt>公转周期（参考）</dt><dd>${body.periodYears?body.periodYears.toFixed(3)+' 年':'—'}</dd>`;
            } else this.facts.innerHTML='<dt>统一空间单位</dt><dd>1 AU ≈ 1.496 亿 km</dd><dt>可见天体</dt><dd>太阳、八大行星、冥王星</dd>';
        }
    }
    root.SolarScene=SolarScene;
})(globalThis);
