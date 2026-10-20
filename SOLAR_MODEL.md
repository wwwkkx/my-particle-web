# Wspace solar-system model

All sphere radii, ring radii, camera positions and orbital coordinates use **one AU-based linear scale**. No per-planet or per-axis scaling, logarithmic distances, or frame-dependent angular increments are used. AU = 149,597,870.7 km. Mean spherical radii preserve volume-equivalent size ratios; oblateness is not modeled. Camera movement magnifies a selected planet without changing any geometry.

## Primary sources

- [NASA/JPL approximate planetary positions](https://ssd.jpl.nasa.gov/planets/approx_pos.html): Table 1's six elements and secular rates for the eight planets, J2000 ecliptic reference frame. Solve Kepler's equation at each simulated date; retain eccentricity, inclination, node and perihelion. Table 1 is a fitted approximation valid 1800–2050, not a numerical n-body integrator. Earth's orbit is the **Earth–Moon barycenter**, not the geocenter (offset can reach about 4,700 km). Typical tabulated distance errors range from thousands of km to about 1.5 million km for Saturn.
- [JPL planetary physical parameters](https://ssd.jpl.nasa.gov/planets/phys_par.html): mean radii, reference sidereal orbital periods. The displayed reference year is descriptive; animation uses the date-dependent elements, not a second independent orbital clock.
- [NAIF generic PCK pck00011.tpc](https://naif.jpl.nasa.gov/pub/naif/generic_kernels/pck/pck00011.tpc): pole right ascension/declination, prime meridian W and angular rate. Linear models only; Mars and Neptune use the 2009 models explicitly retained in the kernel comments. Periodic nutation/libration terms are omitted. Pole vectors are rotated from J2000 equatorial into J2000 ecliptic coordinates before rendering. Negative W rates for Venus and Uranus and Pluto's south-pointing IAU pole preserve their retrograde motion without double-negating Pluto. The nominal solid-body/system rotation does not model atmospheric winds or solar differential rotation.
- [IAU 2015 nominal constants](https://iauarchive.eso.org/static/resolutions/IAU2015_English.pdf): nominal solar radius 695,700 km.
- [NASA Saturn ring fact sheet](https://nssdc.gsfc.nasa.gov/planetary/factsheet/satringfact.html): D, C, B and A ring boundaries, including the Cassini gap, in Saturn's equatorial plane. Ring appearance is illustrative; ring-particle dynamics, F ring and diffuse outer rings are omitted.
- [NAIF leap-second kernel](https://naif.jpl.nasa.gov/pub/naif/generic_kernels/lsk/naif0012.tls): UTC → TAI → TT/TDB, including the small periodic TDB term. Dates are restricted to 1972-01-01 through 2050-01-01. Known leap seconds through 2017 are included; future leap seconds are not predicted.

### Pluto

Pluto is labeled a **dwarf planet**. JPL's current approximate-position table no longer includes it. Instead, use the heliocentric osculating elements for the Pluto system barycenter from [Horizons DE441 at JD 2461333.5 TDB (2026-10-20)](https://ssd.jpl.nasa.gov/api/horizons.api?format=text&COMMAND=%279%27&EPHEM_TYPE=ELEMENTS&CENTER=%27500%4010%27&START_TIME=%272026-10-20%27&STOP_TIME=%272026-10-21%27&STEP_SIZE=%271%20d%27&OUT_UNITS=AU-D):

| Element | Value |
|---|---:|
| Semimajor axis | 39.34504251306874 AU |
| Eccentricity | 0.2480170330450182 |
| Inclination | 17.17471151136688° |
| Ascending node | 110.3352478699668° |
| Argument of perihelion | 113.0512600654169° |
| Mean anomaly at epoch | 54.44450967564260° |
| Mean motion | 0.003993641228347447°/day |

Propagate the mean anomaly in this single-epoch Keplerian ellipse. Accuracy degrades away from the epoch because perturbations are not integrated. It represents the Pluto-system barycenter, not the instantaneous Pluto center. Do not interpret the scene as a precision ephemeris.

## Time, rendering and limitations

- Default time is the client's current UTC clock at **1×**, converted to TDB for the calculations. No live astronomy API or server credentials are needed. System clock errors affect the displayed epoch.
- One absolute wall-clock based simulation controls **both orbit and rotation**. Pause and speed changes preserve the current instant. Background-tab frame throttling does not slow the simulation. Acceleration is explicitly labeled: 1 hour, 1 day or 30 days per real second. High-speed spin may appear aliased between frames. At a date boundary the clock pauses.
- Screen-space dots, labels and connecting lines are UI locators, **not body geometry**. True-scale terrestrial planets are subpixel at the outer-system overview. Use the inner-system view or follow a planet to see it.
- Procedural surface colors, longitude/latitude markings and illumination are **illustrative**, not observed maps or photometrically correct rendering. The marked meridian shows modeled rotation without implying a geographic texture. All bodies are spheres. No moons, light-time, relativity, full precession/nutation or multi-body numerical perturbations are modeled.
- The original particle-art themes remain separate from the physical solar-system view. The physical view does not inherit particle breathing, artistic scene rotation, or morph scaling.

## Validation

Run `node --test tests/*.test.cjs`. Tests check physical ratios; Kepler residuals, perihelion and aphelion; axis handedness and retrograde signs; UTC offsets; pause/rate continuity; camera fitting; and mode transitions.

Independent reference vectors are from [Horizons command 3 (Earth–Moon barycenter), Sun-centered, J2000 ecliptic, AU, TDB](https://ssd.jpl.nasa.gov/api/horizons.api?format=text&COMMAND=%273%27&EPHEM_TYPE=VECTORS&CENTER=%27500%4010%27&TLIST=2451545.0%2C2461333.5&VEC_TABLE=1&OUT_UNITS=AU-D). Compare at J2000 and 2026-10-20 with a 12,000 km bound appropriate to this approximate model, rather than asserting fictitious ephemeris precision.
