const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

test('every script is deferred and core libraries are self-hosted', () => {
    const scripts = [...html.matchAll(/<script\b([^>]*)>/g)].map(match => match[1]);
    assert.ok(scripts.length >= 5);
    for (const attributes of scripts) assert.match(attributes, /\bdefer\b/, attributes);
    assert.doesNotMatch(html, /mediapipe/i, 'gesture library must not load with the page');
    assert.doesNotMatch(html, /cdn\.jsdelivr|cdnjs/, 'three.js and tween.js are served from vendor/');
    for (const file of ['vendor/three.min.js', 'vendor/tween.umd.js']) assert.ok(fs.existsSync(path.join(root, file)), file);
});

test('share metadata and icons are present', () => {
    for (const pattern of [/name="description"/, /rel="canonical"/, /property="og:image"/, /rel="apple-touch-icon"/, /rel="manifest"/]) {
        assert.match(html, pattern);
    }
    for (const file of ['og-image.png', 'favicon.svg', 'favicon-32.png', 'apple-touch-icon.png', 'site.webmanifest', 'robots.txt', 'sitemap.xml']) {
        assert.ok(fs.existsSync(path.join(root, file)), file);
    }
});

test('background music points at compressed files that exist', () => {
    const script = fs.readFileSync(path.join(root, 'script.js'), 'utf8');
    const list = script.match(/const songList = \[([\s\S]*?)\];/)[1];
    const songs = [...list.matchAll(/'([^']+)'/g)].map(match => match[1]);
    assert.equal(songs.length, 5);
    for (const song of songs) {
        assert.match(song, /\.m4a$/);
        const size = fs.statSync(path.join(root, 'music', song)).size;
        assert.ok(size < 10 * 1024 * 1024, `${song} is ${size} bytes`);
    }
});

test('gesture library is injected once, on demand', async () => {
    const appended = [];
    const context = vm.createContext({
        Promise, Error,
        document: {
            createElement: () => ({}),
            head: { appendChild(node) { appended.push(node); } },
        },
    });
    const script = fs.readFileSync(path.join(root, 'script.js'), 'utf8');
    const start = script.indexOf('const MEDIAPIPE_HANDS_BASE');
    const end = script.indexOf('function initMediaPipe');
    vm.runInContext(script.slice(start, end), context);
    const first = vm.runInContext('loadHandsLibrary()', context);
    const second = vm.runInContext('loadHandsLibrary()', context);
    assert.equal(appended.length, 1);
    assert.match(appended[0].src, /@mediapipe\/hands@[\d.]+\/hands\.js$/);
    context.Hands = function Hands() {};
    appended[0].onload();
    await Promise.all([first, second]);
});
