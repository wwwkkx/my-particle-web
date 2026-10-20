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
    class SolarScene {
        constructor(THREE,scene,camera,canvas,onFocus,source) {
            Object.assign(this,{THREE,scene,camera,canvas,onFocus});
            this.clock=new D.Clock();
            this.group=new THREE.Group();
            this.group.visible=false;
            scene.add(this.group);
            this.meshes=new Map();
            this.orbits=new Map();
            this.target=new THREE.Vector3();
            this.focusId=null;
            this.active=false;
            this.mode='overview';
            this.azimuth=-.35;
            this.polar=Math.acos(.65);
            this.distance=75;
            this.autoRotate=true;
            this.projected=[];
            for(const body of D.bodies) {
                const mesh=this.particleBody(body,source);
                this.meshes.set(body.id,mesh);
                this.group.add(mesh);
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
            const dustGeometry=new THREE.BufferGeometry();
            dustGeometry.setAttribute('position',new THREE.Float32BufferAttribute(dustPosition,3));
            dustGeometry.setAttribute('color',new THREE.Float32BufferAttribute(dustColor,3));
            const dust=new THREE.Points(dustGeometry,new THREE.PointsMaterial({
                size:.11,map:source.material.map,vertexColors:true,transparent:true,
                opacity:.32,blending:THREE.AdditiveBlending,depthWrite:false
            }));
            this.group.add(dust);
            this.createInterface();
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
            this.hud.innerHTML=`<summary><span class="solar-eyebrow">实时轨道</span><strong id="solar-view-name">粒子太阳系</strong><span class="solar-clock" id="solar-clock"></span><span class="solar-expand">视角与时间 <span aria-hidden="true">⌄</span></span></summary>
                <div class="solar-settings">
                    <div class="solar-view-buttons"><button type="button" data-view="overview">太阳系全景</button><button type="button" data-view="inner">内太阳系</button></div>
                    <label class="solar-field">模拟速度<select id="solar-speed" aria-label="模拟速度"><option value="0">暂停自转 / 公转</option><option value="1">实时 · 1×</option><option value="3600">1 小时 / 秒</option><option value="86400">1 天 / 秒</option><option value="2592000">30 天 / 秒</option></select></label>
                    <label class="solar-field">日期与时间（UTC）<input id="solar-date" type="datetime-local" step="1" min="1972-01-01T00:00:00" max="2050-01-01T00:00:00"></label>
                    <div class="solar-view-buttons"><button type="button" id="solar-apply-date">应用日期</button><button type="button" id="solar-now">回到此刻 · 1×</button></div>
                    <div class="solar-view-buttons"><button type="button" id="solar-pause">暂停运动</button></div>
                    <p id="solar-error" class="solar-error" role="alert"></p>
                    <dl id="solar-facts"></dl>
                    <p class="solar-note">拖动旋转视角，滚轮 / 双指缩放，点击粒子星球近看。为看清星球，大小和间距使用展示比例；自转与公转继续按天文参数计算。视角旋转可用左上角按钮单独控制。</p>
                    <details class="solar-sources"><summary>数据来源与精度</summary><p>NASA/JPL 近似轨道、NAIF 自转模型。地球轨道采用地月质心，冥王星采用 2026-10-20 的 Horizons 瞬时轨道近似。未模拟完整多体摄动，不是精密实时星历。时间范围 1972–2049，采用截至 2017 年的闰秒表。</p><p>粒子颜色和土星环沿用原有艺术造型。显示中的半径与轨道距离经过调整，下面的物理参数保留实际单位。</p><p><a href="https://ssd.jpl.nasa.gov/planets/approx_pos.html" target="_blank" rel="noopener">JPL 轨道</a> · <a href="https://ssd.jpl.nasa.gov/planets/phys_par.html" target="_blank" rel="noopener">物理参数</a> · <a href="SOLAR_MODEL.md" target="_blank" rel="noopener">模型说明</a></p></details>
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
            this.pauseButton.addEventListener('click',()=>{this.clock.setRate(this.clock.rate?0:1);this.refreshHud(true);});
            for(const button of this.hud.querySelectorAll('[data-view]'))button.addEventListener('click',()=>this.overview(button.dataset.view==='inner'));
        }
        activate() {
            this.savedFog=this.scene.fog;this.savedNear=this.camera.near;this.savedFar=this.camera.far;
            this.savedView=this.camera.view&&this.camera.view.enabled?{...this.camera.view}:null;
            this.scene.fog=null;this.active=true;this.group.visible=true;
            this.hud.hidden=false;this.hud.open=false;this.rotateButton.hidden=false;
            this.viewWidth=null;this.viewHeight=null;this.dateEditing=false;this.hud.scrollTop=0;
            document.body.classList.add('solar-active');
            this.clock.realtime();this.cameraWall=Date.now();this.setRotation(true);this.overview();this.update();
        }
        deactivate() {
            this.active=false;this.group.visible=false;this.hud.hidden=true;this.rotateButton.hidden=true;
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
            this.rotateButton.textContent=enabled?'暂停视角旋转':'恢复视角旋转';
            this.rotateButton.setAttribute('aria-pressed',String(enabled));
        }
        overview(inner=false) {
            this.mode=inner?'inner':'overview';this.focusId=null;
            this.azimuth=-.35;this.polar=Math.acos(.65);
            for(const line of this.orbits.values())line.visible=true;
            this.resize();this.refreshHud(true);this.onFocus(null);
        }
        focus(id) {
            if(!D.byId[id])return;
            this.mode='body';this.focusId=id;
            this.azimuth=.3;this.polar=1.05;
            for(const line of this.orbits.values())line.visible=false;
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
        orbit(dx,dy) {
            this.azimuth-=dx*.005;this.polar=Math.max(.03,Math.min(Math.PI-.03,this.polar+dy*.005));
            this.setRotation(false);
        }
        zoom(amount) {
            const radius=this.focusId?this.meshes.get(this.focusId).userData.radius:2.8;
            this.distance=Math.min(500,Math.max(radius*1.15,this.distance*Math.exp(-amount*.07)));
        }
        update(wall=Date.now()) {
            const utc=this.clock.value(wall),jd=D.toJulianTDB(utc);
            if((utc===D.MAX_UTC||utc===D.MIN_UTC)&&this.clock.rate)this.clock.setRate(0,wall);
            if(this.autoRotate&&this.cameraWall)this.azimuth+=Math.min(.1,Math.max(0,(wall-this.cameraWall)/1000))*.035;
            this.cameraWall=wall;
            const month=Math.floor(jd/30);
            for(const body of D.bodies) {
                const mesh=this.meshes.get(body.id);
                mesh.position.fromArray(this.displayPosition(body.id,jd));
                const axes=D.orientation(body.id,jd);
                const basis=new this.THREE.Matrix4().makeBasis(new this.THREE.Vector3().fromArray(axes.x),new this.THREE.Vector3().fromArray(axes.north),new this.THREE.Vector3().fromArray(axes.z));
                mesh.quaternion.setFromRotationMatrix(basis);
                if(body.id!=='sun'&&this.orbitMonth!==month) {
                    const orbit=D.orbitalElements(body.id,jd),scale=DISPLAY[body.id].orbit/orbit.a;
                    const array=this.orbits.get(body.id).geometry.attributes.position.array;
                    for(let i=0;i<=256;i++)array.set(D.toWorld(D.pointAtEccentricAnomaly(orbit,i/256*Math.PI*2)).map(value=>value*scale),i*3);
                    this.orbits.get(body.id).geometry.attributes.position.needsUpdate=true;
                }
            }
            this.orbitMonth=month;
            this.target.copy(this.focusId?this.meshes.get(this.focusId).position:new this.THREE.Vector3());
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
                    position:mesh.position.toArray(),spin:D.spinAngle(body.id,jd),kind:mesh.type};
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
        pick(ndc) {
            const x=(ndc.x+1)*this.canvas.clientWidth/2,y=(1-ndc.y)*this.canvas.clientHeight/2;
            return this.projected.filter(p=>p.z>=-1&&p.z<=1).map(p=>({...p,hit:Math.hypot(x-p.x,y-p.y)}))
                .filter(p=>p.hit<Math.max(12,p.radius)).sort((a,b)=>a.hit-b.hit)[0]?.id||null;
        }
        refreshHud(force=false,utc=this.clock.value()) {
            const date=new Date(utc),body=D.byId[this.focusId],rate=this.clock.rate;
            const rateText=({0:'已暂停',1:'实时 1×',3600:'1 小时/秒',86400:'1 天/秒',2592000:'30 天/秒'})[rate];
            this.clockText.textContent=date.toISOString().slice(0,19).replace('T',' ')+' UTC · '+rateText;
            if(!this.dateEditing&&document.activeElement!==this.dateInput)this.dateInput.value=date.toISOString().slice(0,19);
            this.speedInput.value=String(rate);this.pauseButton.textContent=rate?'暂停自转 / 公转':'继续运动 · 1×';
            if(force) {
                this.hud.querySelector('#solar-view-name').textContent=body?'粒子近景':this.mode==='inner'?'内太阳系':'粒子太阳系';
                for(const button of this.hud.querySelectorAll('[data-view]'))button.setAttribute('aria-pressed',String(button.dataset.view===this.mode));
            }
            if(body) {
                const distance=Math.hypot(...D.position(body.id,D.toJulianTDB(utc))),days=360/Math.abs(body.spinRate);
                this.facts.innerHTML=`<dt>实际平均半径</dt><dd>${body.radiusKm.toLocaleString('zh-CN')} km</dd><dt>实际日心距离</dt><dd>${distance.toFixed(6)} AU</dd><dt>恒星自转周期</dt><dd>${days<2?(days*24).toFixed(3)+' 小时':days.toFixed(3)+' 天'}</dd><dt>公转周期（参考）</dt><dd>${body.periodYears?body.periodYears.toFixed(3)+' 年':'—'}</dd>`;
            }else this.facts.innerHTML='<dt>画面</dt><dd>粒子态 · 展示比例</dd><dt>运动</dt><dd>共享天文时间轴</dd>';
        }
    }
    SolarScene.DISPLAY=DISPLAY;
    root.SolarScene=SolarScene;
})(globalThis);
