const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'misfit.html'), 'utf8');
const source = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)]
    .find(match => match[1].trim())[1];

// Exercise the application's actual numerical routines without running the browser UI.
function loadNumerics() {
    const elements = new Map();
    const element = id => {
        if (!elements.has(id)) elements.set(id, { value: '', checked: false });
        return elements.get(id);
    };
    const start = source.indexOf('const controls =');
    const end = source.indexOf('const controlsPanel =');
    assert.ok(start >= 0 && end > start, 'numerical section must exist');
    const exports = `globalThis.numerics = {
        controls, getWorkingData, getConstraints, getParameterMapping, generateHKL,
        refreshReflectionPositions, invDSq, reflectionFamilyKey, calculateNetPattern,
        leBailIntensityExtraction, calculateStatistics, covarianceFromJtJ,
        rollingBallBackground, refineParametersLM, refineParametersSA,
        setScan(data, background) {
            fullExperimentalData = data;
            calculatedBackground = background;
            controls.tthMinSlider.value = String(data.tth[0]);
            controls.tthMaxSlider.value = String(data.tth[data.tth.length - 1]);
        }
    };`;
    const context = vm.createContext({ document: { getElementById: element }, console });
    vm.runInContext(source.slice(start, end) + exports, context);
    const api = context.numerics;
    api.controls.wavelength.value = '1.540598';
    api.controls.profileMode.value = 'tch';
    return { api, element };
}

function params(overrides = {}) {
    return {
        phase1: { system: 'tetragonal', centering: 'P', a: 4, c: 4 },
        phase2: { system: 'cubic', centering: 'P', a: 1 },
        lambda: 1.540598, zeroShift: 0,
        GU: 0, GV: 0, GW: 16, GP: 0, LX: 0, LY: 0, eta: 0,
        shft: 0, trns: 0, ...overrides
    };
}

const noFlags = () => ({ phase1: {}, phase2: {} });
const axis = (start, end, step) => Array.from(
    { length: Math.round((end - start) / step) + 1 }, (_, i) => start + i * step);
const near = (actual, expected, tolerance = 1e-8) => assert.ok(
    Math.abs(actual - expected) <= tolerance * Math.max(1, Math.abs(expected)),
    `expected ${actual} to be within ${tolerance} of ${expected}`);

function reflections(api, p, maxTth) {
    return [1, 2].flatMap(i => {
        const ph = p[`phase${i}`];
        return Array.from(api.generateHKL(maxTth, ph, ph.system, ph.centering, `P${i}`));
    }).sort((a, b) => a.tth - b.tth);
}

function bundledScan() {
    const xml = fs.readFileSync(path.join(root, '798-Ca3Co4O9(Bi)-850C.xrdml'), 'utf8');
    const intensity = xml.match(/<intensities\b[^>]*>([^<]+)</)[1].trim().split(/\s+/).map(Number);
    const positions = xml.match(/<positions axis="2Theta"[^>]*>([\s\S]*?)<\/positions>/)[1];
    const start = Number(positions.match(/<startPosition>([^<]+)/)[1]);
    const end = Number(positions.match(/<endPosition>([^<]+)/)[1]);
    return { intensity, tth: intensity.map((_, i) => start + i * (end - start) / (intensity.length - 1)) };
}

test('inline application JavaScript parses', () => {
    assert.doesNotThrow(() => new vm.Script(source));
});

test('coincident tetragonal families retain independent position derivatives', () => {
    const { api } = loadNumerics();
    const p = params();
    const base = reflections(api, p, 25);
    assert.equal(base.length, 2);
    near(base[0].tth, base[1].tth);
    const trial = { ...p, phase1: { ...p.phase1, c: 4.001 } };
    const moved = Array.from(api.refreshReflectionPositions(base, trial)).sort((a, b) => a.tth - b.tth);
    const rebuilt = reflections(api, trial, 25);
    assert.equal(moved.length, rebuilt.length);
    moved.forEach((peak, i) => near(peak.tth, rebuilt[i].tth));
    assert.ok(Math.abs(moved[0].tth - moved[1].tth) > 0.005);
});

test('metric families stay coincident under independent cell perturbations in all six systems', () => {
    const { api } = loadNumerics();
    const cells = [
        { system: 'cubic', a: 4 },
        { system: 'tetragonal', a: 4, c: 4 },
        { system: 'orthorhombic', a: 4, b: 4, c: 4 },
        { system: 'hexagonal', a: 4, c: 6 },
        { system: 'monoclinic', a: 4, b: 4, c: 6, beta: 90 },
        { system: 'rhombohedral', a: 4, alpha: 90 }
    ];
    for (const cell of cells) {
        const grouped = api.generateHKL(60, cell, cell.system, 'P', 'P1');
        const perturbed = Object.fromEntries(Object.entries(cell).map(([key, value], i) =>
            [key, typeof value === 'number' ? value + 0.001 * (i + 1) : value]));
        const uniqueKeys = new Set();
        for (const peak of grouped) {
            const key = api.reflectionFamilyKey(peak.h, peak.k, peak.l, cell.system);
            assert.ok(!uniqueKeys.has(key));
            uniqueKeys.add(key);
            const expected = api.invDSq(peak.h, peak.k, peak.l, perturbed, cell.system);
            for (const member of peak.hkl_list) {
                const [h, k, l] = member.slice(1, -1).split(',').map(Number);
                near(api.invDSq(h, k, l, perturbed, cell.system), expected, 1e-12);
            }
        }
    }
});

test('LM refines c from an accidentally cubic tetragonal starting metric', async () => {
    const { api } = loadNumerics();
    const initial = params(), target = params({ phase1: { ...initial.phase1, c: 4.001 } });
    const tth = axis(20, 25, 0.01), peaks = reflections(api, target, 25);
    peaks.forEach(p => { p.intensity = 100; });
    const data = { tth, intensity: Array.from(api.calculateNetPattern(tth, peaks, target)) };
    const fit = await api.refineParametersLM(initial, { phase1: { c: true }, phase2: {} }, {},
        50, null, data, data.intensity);
    near(fit.params.phase1.c, target.phase1.c, 1e-8);
    assert.ok(fit.JtJ[0][0] > 0);
    assert.ok(fit.ss_res < 1e-12);
    assert.equal(fit.converged, true);
});

test('LM does not label an unsuccessful descent as convergence', async () => {
    const { api } = loadNumerics();
    const initial = params(), target = params({ phase1: { ...initial.phase1, c: 4.02 } });
    const tth = axis(20, 25, 0.01), peaks = reflections(api, target, 25);
    peaks.forEach(p => { p.intensity = 100; });
    const data = { tth, intensity: Array.from(api.calculateNetPattern(tth, peaks, target)) };
    const fit = await api.refineParametersLM(initial, { phase1: { c: true }, phase2: {} }, {},
        50, null, data, data.intensity);
    // A local optimizer need not escape this minimum, but must not silently stop at a bad step.
    assert.ok(fit.ss_res < 1e-8 || (!fit.converged && fit.stalled));
});

test('clipped peaks retain integrated intensities at either boundary and different channel spacings', () => {
    for (const mode of ['tch', 'empirical']) {
        for (const step of [0.01, 0.02]) {
            const { api } = loadNumerics();
            api.controls.profileMode.value = mode;
            const p = params({ LX: 2, eta: 0.35 });
            const tth = axis(20, 30, step);
            const expected = [100, 200, 50];
            const peaks = [20.02, 25, 29.98].map((t, i) => ({ tth: t, intensity: expected[i], phase: 'P1' }));
            const data = { tth, intensity: Array.from(api.calculateNetPattern(tth, peaks, p)) };
            const extracted = peaks.map(peak => ({ ...peak, intensity: 0 }));
            api.leBailIntensityExtraction(data, extracted, p);
            extracted.forEach((peak, i) => near(peak.intensity, expected[i], 1e-8));
            const calculated = api.calculateNetPattern(tth, extracted, p);
            const stats = api.calculateStatistics(data, calculated, tth.map(() => 0), noFlags());
            assert.ok(stats.rwp < 1e-8, `${mode}, step ${step}: Rwp = ${stats.rwp}`);
            near(stats.scaleFactor, 1);
        }
    }
});

test('empty sampled profiles do not produce nonfinite intensities', () => {
    const { api } = loadNumerics();
    const data = { tth: [20, 20.01], intensity: [0, 0] };
    const peaks = [{ tth: 40, intensity: 100 }, { tth: 20, intensity: 100 }];
    api.leBailIntensityExtraction(data, peaks, params());
    peaks.forEach(peak => assert.equal(peak.intensity, 0));
});

test('background-subtracted observations retain negative residuals', () => {
    const { api } = loadNumerics();
    api.setScan({ tth: [20, 21, 22], intensity: [10, 5, 12] }, [11, 4, 15]);
    assert.deepEqual(Array.from(api.getWorkingData(true).intensity), [-1, 1, -3]);
});

test('LM objective and reported chi-square agree on the bundled scan', async () => {
    const { api, element } = loadNumerics();
    const data = bundledScan(), background = api.rollingBallBackground(data.intensity, 30, 5);
    api.setScan(data, background);
    const initial = params({
        phase1: { system: 'monoclinic', centering: 'C', a: 4.83, b: 2.82, c: 10.84, beta: 98.1 },
        phase2: { system: 'orthorhombic', centering: 'C', a: 4.83, b: 4.565, c: 10.84 },
        GU: 2, GV: -1, GW: 1, LX: 12.8
    });
    const flags = { phase1: { a: true, b: true, c: true, beta: true }, phase2: { b: true }, zeroShift: true };
    element('constraint-a').checked = element('constraint-c').checked = true;
    const working = api.getWorkingData(true);
    assert.equal(working.intensity.filter(y => y < 0).length, 731);
    const fit = await api.refineParametersLM(initial, flags, api.getConstraints(), 2, null, working, data.intensity);
    const peaks = reflections(api, fit.params, data.tth.at(-1));
    api.leBailIntensityExtraction(working, peaks, fit.params);
    const calculated = api.calculateNetPattern(working.tth, peaks, fit.params);
    const stats = api.calculateStatistics(data, calculated, background, flags);
    near(stats.chi2 * (data.tth.length - fit.paramMapping.length), fit.ss_res, 1e-10);
});

test('SA uses the same signed residual objective as reported statistics', async () => {
    const { api } = loadNumerics();
    const p = params(), tth = axis(20, 25, 0.01), peaks = reflections(api, p, 25);
    peaks.forEach(peak => { peak.intensity = 100; });
    const net = Array.from(api.calculateNetPattern(tth, peaks, p));
    const background = tth.map(() => 10);
    const data = { tth, intensity: net.map((y, i) => y + background[i] + (i % 2 ? 2 : -2)) };
    api.setScan(data, background);
    const flags = { ...noFlags(), zeroShift: true }, working = api.getWorkingData(true);
    const extracted = reflections(api, p, 25);
    api.leBailIntensityExtraction(working, extracted, p);
    const calculated = api.calculateNetPattern(tth, extracted, p);
    const stats = api.calculateStatistics(data, calculated, background, flags);
    const fit = await api.refineParametersSA(p, flags, {}, 2, null);
    near(fit.saInitialCost, stats.chi2 * (tth.length - 1), 1e-10);
});

test('covariance flags every parameter in a dependency, including GU/GW/GP', () => {
    const { api } = loadNumerics();
    const pair = api.covarianceFromJtJ([[1, 1], [1, 1]], ['x', 'y']);
    assert.equal(pair.cov, null);
    assert.deepEqual(Array.from(pair.dropped, d => d.name).sort(), ['x', 'y']);
    const triple = api.covarianceFromJtJ([[1, 0, 1], [0, 1, 1], [1, 1, 2]], ['GU', 'GW', 'GP']);
    assert.equal(triple.cov, null);
    assert.deepEqual(Array.from(triple.dropped, d => d.name).sort(), ['GP', 'GU', 'GW']);
});

test('identifiable covariance retains uncertainty from correlated nuisance combinations', () => {
    const { api } = loadNumerics();
    const normal = [[1, 1, 0.5], [1, 1, 0.5], [0.5, 0.5, 1]];
    for (const order of [[0, 1, 2], [2, 0, 1], [1, 2, 0]]) {
        const scales = [1e-5, 3, 1e5];
        const matrix = order.map((i, ii) => order.map((j, jj) => normal[i][j] * scales[ii] * scales[jj]));
        const names = order.map(i => ['x', 'y', 'z'][i]);
        const result = api.covarianceFromJtJ(matrix, names), z = names.indexOf('z');
        assert.deepEqual(Array.from(result.dropped, d => d.name).sort(), ['x', 'y']);
        near(result.cov[z][z] * scales[z] ** 2, 4 / 3, 1e-10);
        result.cov.forEach((row, i) => { if (i !== z) assert.ok(Number.isNaN(row[i])); });
    }
});

test('dead parameters leave independent error estimates intact', () => {
    const { api } = loadNumerics();
    const result = api.covarianceFromJtJ([[0, 0], [0, 4]], ['dead', 'independent']);
    assert.deepEqual(Array.from(result.dropped, d => d.name), ['dead']);
    assert.ok(Number.isNaN(result.cov[0][0]));
    near(result.cov[1][1], 0.25);
});

test('full-rank covariance remains correct across different parameter scales', () => {
    const { api } = loadNumerics();
    const normal = [[4e-12, 1e-6], [1e-6, 1]];
    const result = api.covarianceFromJtJ(normal);
    assert.equal(result.dropped.length, 0);
    near(result.cov[0][0], 1 / 3e-12, 1e-10);
    near(result.cov[0][1], -1e-6 / 3e-12, 1e-10);
    near(result.cov[1][1], 4 / 3, 1e-10);
});

test('dense covariance inverts a normal matrix with several coupled parameters', () => {
    const { api } = loadNumerics(), n = 8;
    const design = Array.from({ length: 12 }, (_, i) => Array.from({ length: n }, (_, j) =>
        Math.sin((i + 1) * (j + 1)) + Math.cos((i + 2) * (j + 3))));
    const normal = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) =>
        design.reduce((sum, row) => sum + row[i] * row[j], i === j ? 0.1 : 0)));
    const result = api.covarianceFromJtJ(normal);
    assert.equal(result.dropped.length, 0);
    for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
            const product = normal[i].reduce((sum, v, k) => sum + v * result.cov[k][j], 0);
            near(product, i === j ? 1 : 0, 1e-10);
        }
    }
});
