const test=require('node:test');
const assert=require('node:assert/strict');
const D=require('../solar-data.js');
const near=(actual,expected,tolerance=1e-10)=>assert.ok(Math.abs(actual-expected)<tolerance,`${actual} ≈ ${expected}`);

test('one spatial scale preserves independently published physical size ratios',()=>{
    near(D.byId.sun.radiusAU/D.byId.earth.radiusAU,695700/6371.0084);
    near(D.byId.jupiter.radiusAU/D.byId.earth.radiusAU,69911/6371.0084);
    near(D.orbitalElements('earth',D.J2000).a/D.byId.earth.radiusAU,149597870.7*1.00000261/6371.0084);
    assert.equal(D.bodies.filter(b=>b.periodYears&&!b.dwarf).length,8);
});
test('Kepler solver satisfies the equation across all supported orbital eccentricities',()=>{
    for(const e of [0,.0068,.0167,.0934,.2056,.2481])for(const degrees of [-180,-179,-45,0,.001,90,179.9,359.9,1440]) {
        const mean=degrees*D.DEG,E=D.solveKepler(mean,e);
        near(Math.sin(E-e*Math.sin(E)),Math.sin(mean));
        near(Math.cos(E-e*Math.sin(E)),Math.cos(mean));
    }
});
test('positions agree with independent JPL Horizons DE441 Earth-Moon barycenter vectors',()=>{
    // Horizons command=3, center=500@10, J2000 ecliptic, AU, TDB. Retrieval URL in SOLAR_MODEL.md.
    const samples=[
        [2451545.0,[-.1771587841839055,.9672193524609504,-.000001139275508446145]],
        [2461333.5,[.8932679672296114,.4404065955650375,-.00003231766259168711]]
    ];
    for(const [jd,expected] of samples) {
        const actual=D.position('earth',jd);
        const errorKm=Math.hypot(...actual.map((v,i)=>v-expected[i]))*D.AU_KM;
        assert.ok(errorKm<12000,`approximate-model error ${errorKm} km at JD ${jd}`);
    }
});
test('orbits have the published perihelion, aphelion and nonzero inclinations',()=>{
    for(const body of D.bodies.filter(b=>b.id!=='sun')) {
        const orbit=D.orbitalElements(body.id,2461333.5);
        near(Math.hypot(...D.pointAtEccentricAnomaly(orbit,0)),orbit.a*(1-orbit.e));
        near(Math.hypot(...D.pointAtEccentricAnomaly(orbit,Math.PI)),orbit.a*(1+orbit.e));
        for(const utc of [Date.UTC(1972,0,1),Date.UTC(2026,9,20),Date.UTC(2049,11,31)])assert.ok(D.position(body.id,D.toJulianTDB(utc)).every(Number.isFinite));
    }
    assert.ok(Math.abs(D.position('pluto',2461333.5)[2])>1);
});
test('spin basis is right-handed and preserves retrograde rotation and axis tilt',()=>{
    const dot=(a,b)=>a.reduce((sum,v,i)=>sum+v*b[i],0);
    const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
    for(const body of D.bodies) {
        const {x,north,z}=D.orientation(body.id,2461333.5);
        near(Math.hypot(...x),1);near(Math.hypot(...north),1);near(dot(x,north),0);
        near(dot(cross(x,north),z),1);
    }
    const earth=D.orientation('earth',D.J2000).north;
    near(Math.acos(earth[1])/D.DEG,23.43928,1e-5);
    assert.ok(D.byId.venus.spinRate<0);
    assert.ok(D.byId.uranus.spinRate<0);
    // Pluto's IAU pole is south of the ecliptic, so positive W is already retrograde.
    assert.ok(D.orientation('pluto',D.J2000).north[1]<0);
    for(const id of ['earth','venus','uranus','pluto']) {
        const delta=D.wrapDegrees((D.spinAngle(id,D.J2000+.001)-D.spinAngle(id,D.J2000))/D.DEG);
        near(delta,D.wrapDegrees(D.byId[id].spinRate*.001),1e-6);
    }
});
test('UTC converts to dynamical time with the known leap-second offset',()=>{
    const utc=Date.UTC(2017,0,2);
    const delta=(D.toJulianTDB(utc)-(utc/D.DAY_MS+2440587.5))*86400;
    near(delta,69.184,.002);
});
test('one wall-clock based simulation preserves time on pause, resume and speed changes',()=>{
    const wall=Date.UTC(2026,9,20),clock=new D.Clock(wall);
    near(clock.value(wall+5000),wall+5000,1);
    clock.setRate(86400,wall+5000);
    near(clock.value(wall+6000),wall+5000+D.DAY_MS,1);
    const paused=clock.value(wall+6000);clock.setRate(0,wall+6000);
    near(clock.value(wall+600000),paused,1);
    clock.setRate(1,wall+600000);
    near(clock.value(wall+601000),paused+1000,1);
    clock.realtime(wall+601000);near(clock.value(wall+601000),wall+601000,1);
    assert.equal(clock.rate,1);
    assert.throws(()=>clock.setTime(NaN));assert.throws(()=>clock.setTime(Date.UTC(2100,0,1)));
    clock.setTime(D.MAX_UTC-1000,wall);clock.setRate(2592000,wall);
    assert.equal(clock.value(wall+1000),D.MAX_UTC);
});
