/* Physical units are AU and days. Sources, approximations and frame conventions: SOLAR_MODEL.md. */
(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    else root.SolarData = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';
    const AU_KM = 149597870.7;
    const DAY_MS = 86400000;
    const J2000 = 2451545.0;
    const DEG = Math.PI / 180;
    const MIN_UTC = Date.UTC(1972, 0, 1);
    const MAX_UTC = Date.UTC(2050, 0, 1);
    // [a, e, I, L, longitude of perihelion, longitude of ascending node].
    // NASA/JPL approximate positions, Table 1; rates are per Julian century.
    const elements = {
        mercury: [[.38709927,.20563593,7.00497902,252.25032350,77.45779628,48.33076593],[.00000037,.00001906,-.00594749,149472.67411175,.16047689,-.12534081]],
        venus: [[.72333566,.00677672,3.39467605,181.97909950,131.60246718,76.67984255],[.00000390,-.00004107,-.00078890,58517.81538729,.00268329,-.27769418]],
        earth: [[1.00000261,.01671123,-.00001531,100.46457166,102.93768193,0],[.00000562,-.00004392,-.01294668,35999.37244981,.32327364,0]],
        mars: [[1.52371034,.09339410,1.84969142,-4.55343205,-23.94362959,49.55953891],[.00001847,.00007882,-.00813131,19140.30268499,.44441088,-.29257343]],
        jupiter: [[5.202887,.04838624,1.30439695,34.39644051,14.72847983,100.47390909],[-.00011607,-.00013253,-.00183714,3034.74612775,.21252668,.20469106]],
        saturn: [[9.53667594,.05386179,2.48599187,49.95424423,92.59887831,113.66242448],[-.00125060,-.00050991,.00193609,1222.49362201,-.41897216,-.28867794]],
        uranus: [[19.18916464,.04725744,.77263783,313.23810451,170.95427630,74.01692503],[-.00196176,-.00004397,-.00242939,428.48202785,.40805281,.04240589]],
        neptune: [[30.06992276,.00859048,1.77004347,-55.12002969,44.96476227,131.78422574],[.00026291,.00005105,.00035372,218.45945325,-.32241464,-.00508664]]
    };
    // Mean volume-equivalent radii and descriptive periods: JPL physical parameters.
    // Pole RA, DEC and W: linear NAIF PCK constants. Mars/Neptune use the documented 2009 models.
    const bodies = [
        {id:'sun',name:'太阳',radiusKm:695700,color:'#ffc55c',pole:[286.13,63.87,0,0],prime:84.176,spinRate:14.18440,periodYears:null},
        {id:'mercury',name:'水星',radiusKm:2439.4,color:'#a69e92',pole:[281.0103,61.4155,-.0328,-.0049],prime:329.5988,spinRate:6.1385108,periodYears:.2408467},
        {id:'venus',name:'金星',radiusKm:6051.8,color:'#d7b985',pole:[272.76,67.16,0,0],prime:160.20,spinRate:-1.4813688,periodYears:.61519726},
        {id:'earth',name:'地球',radiusKm:6371.0084,color:'#3d8dc2',pole:[0,90,-.641,-.557],prime:190.147,spinRate:360.9856235,periodYears:1.0000174},
        {id:'mars',name:'火星',radiusKm:3389.5,color:'#cd7759',pole:[317.68143,52.88650,-.1061,-.0609],prime:176.63,spinRate:350.89198226,periodYears:1.8808476},
        {id:'jupiter',name:'木星',radiusKm:69911,color:'#c5a27e',pole:[268.056595,64.495303,-.006499,.002413],prime:284.95,spinRate:870.536,periodYears:11.862615},
        {id:'saturn',name:'土星',radiusKm:58232,color:'#d2be8d',pole:[40.589,83.537,-.036,-.004],prime:38.90,spinRate:810.7939024,periodYears:29.447498},
        {id:'uranus',name:'天王星',radiusKm:25362,color:'#8ec6cd',pole:[257.311,-15.175,0,0],prime:203.81,spinRate:-501.1600928,periodYears:84.016846},
        {id:'neptune',name:'海王星',radiusKm:24622,color:'#5a7dbc',pole:[299.36,43.46,0,0],prime:253.18,spinRate:536.3128492,periodYears:164.79132},
        {id:'pluto',name:'冥王星',radiusKm:1188.3,color:'#bda99d',pole:[132.993,-6.163,0,0],prime:302.695,spinRate:56.3625225,periodYears:247.92065,dwarf:true}
    ].map(body => Object.freeze({...body,radiusAU:body.radiusKm/AU_KM}));
    const byId = Object.freeze(Object.fromEntries(bodies.map(body=>[body.id,body])));
    // Horizons DE441, Pluto SYSTEM BARYCENTER (9), Sun-centered J2000 ecliptic,
    // epoch 2461333.5 TDB (2026-10-20). Single-epoch osculating Kepler approximation.
    const pluto = {epoch:2461333.5,a:39.34504251306874,e:.2480170330450182,
        inclination:17.17471151136688,node:110.3352478699668,
        perihelion:110.3352478699668+113.0512600654169,
        anomaly:54.44450967564260,motion:.003993641228347447};
    const leapDates = ['1972-01-01','1972-07-01','1973-01-01','1974-01-01','1975-01-01','1976-01-01','1977-01-01','1978-01-01','1979-01-01','1980-01-01','1981-07-01','1982-07-01','1983-07-01','1985-07-01','1988-01-01','1990-01-01','1991-01-01','1992-07-01','1993-07-01','1994-07-01','1996-01-01','1997-07-01','1999-01-01','2006-01-01','2009-01-01','2012-07-01','2015-07-01','2017-01-01'].map(date=>Date.parse(date+'T00:00:00Z'));

    function wrapDegrees(value) { return ((value % 360) + 360) % 360; }
    function toJulianTDB(utcMs) {
        if (!Number.isFinite(utcMs)) throw new TypeError('Invalid UTC time');
        let taiMinusUtc = 10;
        for (let i=0;i<leapDates.length && utcMs>=leapDates[i];i++) taiMinusUtc=10+i;
        const seconds = utcMs / 1000 + (2440587.5-J2000)*86400 + taiMinusUtc+32.184;
        const mean = 6.239996 + 1.99096871e-7*seconds;
        const periodic = .001657*Math.sin(mean+.01671*Math.sin(mean));
        return utcMs/DAY_MS+2440587.5+(taiMinusUtc+32.184+periodic)/86400;
    }
    function solveKepler(meanRadians,eccentricity) {
        if (!Number.isFinite(meanRadians) || !(eccentricity>=0 && eccentricity<1)) throw new RangeError('Invalid elliptical orbit');
        const mean = ((meanRadians+Math.PI)%(2*Math.PI)+2*Math.PI)%(2*Math.PI)-Math.PI;
        // Danby's starting value keeps Newton's method stable for comet-like eccentricities.
        let eccentric = eccentricity<.8 ? mean : mean+.85*eccentricity*Math.sign(Math.sin(mean)||1);
        for (let i=0;i<60;i++) {
            const delta=(eccentric-eccentricity*Math.sin(eccentric)-mean)/(1-eccentricity*Math.cos(eccentric));
            eccentric-=delta;
            if (Math.abs(delta)<1e-13) return eccentric;
        }
        throw new Error('Kepler solver did not converge');
    }
    function orbitalElements(id,jd) {
        if (!Number.isFinite(jd)) throw new TypeError('Invalid Julian date');
        if (id==='pluto') return {a:pluto.a,e:pluto.e,I:pluto.inclination,L:pluto.perihelion+pluto.anomaly+pluto.motion*(jd-pluto.epoch),peri:pluto.perihelion,node:pluto.node};
        if (!elements[id]) throw new RangeError('Unknown orbit: '+id);
        const t=(jd-J2000)/36525;
        const [a,e,I,L,peri,node]=elements[id][0].map((value,i)=>value+elements[id][1][i]*t);
        return {a,e,I,L,peri,node};
    }
    function pointAtEccentricAnomaly(orbit,E) {
        const x=orbit.a*(Math.cos(E)-orbit.e),y=orbit.a*Math.sqrt(1-orbit.e**2)*Math.sin(E);
        const w=(orbit.peri-orbit.node)*DEG,n=orbit.node*DEG,i=orbit.I*DEG;
        const cW=Math.cos(w),sW=Math.sin(w),cN=Math.cos(n),sN=Math.sin(n),cI=Math.cos(i),sI=Math.sin(i);
        return [ (cW*cN-sW*sN*cI)*x+(-sW*cN-cW*sN*cI)*y,
            (cW*sN+sW*cN*cI)*x+(-sW*sN+cW*cN*cI)*y,
            sW*sI*x+cW*sI*y ];
    }
    function position(id,jd) {
        if (id==='sun') return [0,0,0];
        const orbit=orbitalElements(id,jd);
        const mean=(wrapDegrees(orbit.L-orbit.peri))*DEG;
        return pointAtEccentricAnomaly(orbit,solveKepler(mean,orbit.e));
    }
    // Right-handed rotation: ecliptic X,Y,Z -> renderer X,Z,-Y; NEVER rescale an individual axis.
    function toWorld(vector) { return [vector[0],vector[2],-vector[1]]; }
    function equatorialToWorld(vector) {
        const eps=23.43928*DEG;
        return toWorld([vector[0],Math.cos(eps)*vector[1]+Math.sin(eps)*vector[2],-Math.sin(eps)*vector[1]+Math.cos(eps)*vector[2]]);
    }
    function spinAngle(id,jd) {
        const body=byId[id];
        if (!body) throw new RangeError('Unknown body: '+id);
        return wrapDegrees(body.prime+body.spinRate*(jd-J2000))*DEG;
    }
    // spinOverride (radians) keeps the true pole but lets the renderer choose a visible spin phase.
    function orientation(id,jd,spinOverride) {
        const body=byId[id],t=(jd-J2000)/36525;
        let ra=(body.pole[0]+body.pole[2]*t)*DEG,dec=(body.pole[1]+body.pole[3]*t)*DEG;
        const w=Number.isFinite(spinOverride)?spinOverride:spinAngle(id,jd);
        const u=[-Math.sin(ra),Math.cos(ra),0];
        const v=[-Math.sin(dec)*Math.cos(ra),-Math.sin(dec)*Math.sin(ra),Math.cos(dec)];
        const north=[Math.cos(dec)*Math.cos(ra),Math.cos(dec)*Math.sin(ra),Math.sin(dec)];
        const x=u.map((value,i)=>value*Math.cos(w)+v[i]*Math.sin(w));
        const z=u.map((value,i)=>value*Math.sin(w)-v[i]*Math.cos(w));
        return {x:equatorialToWorld(x),north:equatorialToWorld(north),z:equatorialToWorld(z)};
    }
    // Axial tilt: angle between the spin vector and the body's own orbit normal, in degrees.
    // The pole sign follows spinRate, so retrograde rotators read above 90° (Venus ≈ 177°, Uranus ≈ 98°).
    function obliquity(id,jd) {
        const body=byId[id],north=orientation(id,jd,0).north,sign=Math.sign(body.spinRate);
        if (id==='sun') return 7.25;
        const orbit=orbitalElements(id,jd),i=orbit.I*DEG,node=orbit.node*DEG;
        const normal=toWorld([Math.sin(i)*Math.sin(node),-Math.sin(i)*Math.cos(node),Math.cos(i)]);
        const dot=sign*(north[0]*normal[0]+north[1]*normal[1]+north[2]*normal[2]);
        return Math.acos(Math.max(-1,Math.min(1,dot)))/DEG;
    }

    // Major moons. Periods are sidereal (days, negative = retrograde): JPL satellite parameters.
    // The Moon's phase uses its J2000 mean longitude; the others share an approximate reference.
    const moons = [
        {id:'moon',name:'月球',parent:'earth',radiusKm:1737.4,periodDays:27.321661,plane:'ecliptic',longitude0:218.3165,color:[.82,.82,.8]},
        {id:'phobos',name:'火卫一',parent:'mars',radiusKm:11.1,periodDays:.31891,plane:'equator',longitude0:0,color:[.62,.55,.5]},
        {id:'deimos',name:'火卫二',parent:'mars',radiusKm:6.2,periodDays:1.26244,plane:'equator',longitude0:120,color:[.7,.62,.55]},
        {id:'io',name:'木卫一',parent:'jupiter',radiusKm:1821.6,periodDays:1.769138,plane:'equator',longitude0:106.07719,color:[.98,.86,.42]},
        {id:'europa',name:'木卫二',parent:'jupiter',radiusKm:1560.8,periodDays:3.551181,plane:'equator',longitude0:175.73161,color:[.9,.86,.76]},
        {id:'ganymede',name:'木卫三',parent:'jupiter',radiusKm:2634.1,periodDays:7.154553,plane:'equator',longitude0:120.55883,color:[.7,.66,.6]},
        {id:'callisto',name:'木卫四',parent:'jupiter',radiusKm:2410.3,periodDays:16.689018,plane:'equator',longitude0:84.44459,color:[.5,.46,.42]},
        {id:'titan',name:'土卫六',parent:'saturn',radiusKm:2574.7,periodDays:15.945421,plane:'equator',longitude0:0,color:[.92,.7,.36]},
        {id:'triton',name:'海卫一',parent:'neptune',radiusKm:1353.4,periodDays:-5.876854,plane:'equator',longitude0:0,color:[.86,.8,.78]},
        {id:'charon',name:'冥卫一',parent:'pluto',radiusKm:606,periodDays:6.387230,plane:'equator',longitude0:0,color:[.68,.66,.66]}
    ].map(moon=>Object.freeze(moon));
    function moonLongitude(id,jd) {
        const moon=moons.find(item=>item.id===id);
        if (!moon) throw new RangeError('Unknown moon: '+id);
        return wrapDegrees(moon.longitude0+360/moon.periodDays*(jd-J2000))*DEG;
    }

    // 1P/Halley osculating elements (JPL SBDB, epoch 1994): perihelion 1986-02-09, next 2061.
    const halley = Object.freeze({a:17.834144,e:.96714291,inclination:162.26269,node:58.42008,argPeri:111.33249,perihelionJD:2446467.395});
    function cometPosition(jd) {
        const c=halley,periodDays=365.25*Math.pow(c.a,1.5);
        const mean=wrapDegrees(360*(jd-c.perihelionJD)/periodDays)*DEG;
        const orbit={a:c.a,e:c.e,I:c.inclination,node:c.node,peri:c.node+c.argPeri};
        return pointAtEccentricAnomaly(orbit,solveKepler(mean,c.e));
    }
    const RATES = Object.freeze([0,1,3600,86400,604800,2592000]);
    class Clock {
        constructor(wallMs=Date.now()) { this.epoch=Math.min(MAX_UTC,Math.max(MIN_UTC,wallMs));this.wall=wallMs;this.rate=1; }
        value(wallMs=Date.now()) { return Math.min(MAX_UTC,Math.max(MIN_UTC,this.epoch+(wallMs-this.wall)*this.rate)); }
        setRate(rate,wallMs=Date.now()) { if(!RATES.includes(rate)) throw new RangeError('Invalid time rate');this.epoch=this.value(wallMs);this.wall=wallMs;this.rate=rate; }
        setTime(utcMs,wallMs=Date.now()) { if(!Number.isFinite(utcMs)||utcMs<MIN_UTC||utcMs>MAX_UTC)throw new RangeError('日期须在 1972-01-01 至 2050-01-01 之间');this.epoch=utcMs;this.wall=wallMs; }
        realtime(wallMs=Date.now()) { this.setTime(wallMs,wallMs);this.rate=1; }
    }
    return Object.freeze({AU_KM,DAY_MS,J2000,DEG,MIN_UTC,MAX_UTC,RATES,bodies,byId,pluto,moons,halley,wrapDegrees,toJulianTDB,solveKepler,orbitalElements,pointAtEccentricAnomaly,position,toWorld,orientation,obliquity,spinAngle,moonLongitude,cometPosition,Clock});
});
