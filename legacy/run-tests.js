const Core = require('./configurator-core.js');

const T = {
    suites: [], currentSuite: null,
    suite(name, fn) { const s = {name,tests:[],pass:0,fail:0}; T.suites.push(s); T.currentSuite = s; fn(); T.currentSuite = null; },
    test(name, fn) { const t = {name,passed:false,error:null}; try { fn(); t.passed=true; T.currentSuite.pass++; } catch(e) { t.error=e.message||String(e); T.currentSuite.fail++; } T.currentSuite.tests.push(t); },
    eq(a,b,m) { if(a!==b) throw new Error(`${m||'eq'}: expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); },
    deepEq(a,b,m) { const x=JSON.stringify(a),y=JSON.stringify(b); if(x!==y) throw new Error(`${m||'deepEq'}: expected ${y}, got ${x}`); },
    ok(v,m) { if(!v) throw new Error(`${m||'ok'}: expected truthy, got ${JSON.stringify(v)}`); },
    throws(fn,m) { try{fn();throw new Error(`${m||'throws'}: expected exception`);}catch(e){if(e.message&&e.message.includes('expected exception'))throw e;} },
    approx(a,b,e,m) { if(e===undefined)e=0.001; if(Math.abs(a-b)>e) throw new Error(`${m||'approx'}: expected ~${b}, got ${a}`); },
    contains(s,sub,m) { if(typeof s!=='string'||!s.includes(sub)) throw new Error(`${m||'contains'}: '${sub}' not found`); },
    notContains(s,sub,m) { if(typeof s==='string'&&s.includes(sub)) throw new Error(`${m||'notContains'}: '${sub}' unexpectedly found`); }
};

/**
 * v4 Kite app with cumulative rules and palette.
 */
function makeKiteApp() {
    const app = Core.createDefaultApp();
    app.meta.name='kite-test'; app.meta.label='Kite 4-369 (Test)'; app.meta.suffix='-Kite-Test'; app.meta.footnote='Test config for Kite notation';
    app.engine.falseHollow = true;
    app.defs['kite-up'] = { type:'notehead', path:'M 0 0.6667 L 0.6667 0.3333 L 0 -0.6667 L -0.6667 0.3333 Z', hollowPath:'M 0.3333 0.3333 L 0 -0.3333 L -0.3333 0.3333 Z', lilypondPath:null, lilypondHollow:null, naturalHeight:1.333, naturalWidth:1.333, semitoneHeight:1.333, anchors:{stemUp:{x:0,y:0.66},stemDown:{x:0,y:-0.66}}, overlapPercent:25, isFalseHollow:false };
    app.defs['kite-down'] = { type:'notehead', path:'M 0 -0.6667 L 0.6667 -0.3333 L 0 0.6667 L -0.6667 -0.3333 Z', hollowPath:'M -0.3333 -0.3333 L 0.3333 -0.3333 L 0 0.3333 Z', lilypondPath:null, lilypondHollow:null, naturalHeight:1.333, naturalWidth:1.333, semitoneHeight:1.333, anchors:{stemUp:{x:0,y:-0.66},stemDown:{x:0,y:0.66}}, overlapPercent:25, isFalseHollow:false };
    app.noteheadPalette = { mode:'standard', selected:'custom', presetKey:'dark2-3', customColors:['#7d3fff','#dc4538','#0f9e59'] };
    app.noteheadRules = [
        // Shape rules
        { ruleType:'shape', shape:'kite-up', pitchClasses:[0,2,4,6,8,10], durations:'all', keys:'all' },
        { ruleType:'shape', shape:'kite-down', pitchClasses:[1,3,5,7,9,11], durations:'all', keys:'all' },
        // Hollow rules
        { ruleType:'hollow', hollow:true, pitchClasses:[1,3,5,7,9,11], durations:'all', keys:'all' },
        // Color rules
        { ruleType:'color', color:'#7d3fff', pitchClasses:[0,3,6,9], durations:'all', keys:'all' },
        { ruleType:'color', color:'#dc4538', pitchClasses:[1,4,7,10], durations:'all', keys:'all' },
        { ruleType:'color', color:'#0f9e59', pitchClasses:[2,5,8,11], durations:'all', keys:'all' }
    ];
    app.staffRules = [{ type:'staff', style:'staff', override:null, pitchClasses:[0,3,6,9], keys:'all' }];
    return app;
}

/**
 * v3 Kite app for migration testing — uses old monolithic rules + colors dict.
 */
function makeKiteAppV3() {
    return {
        meta: { version:'3.0', name:'kite-test', label:'Kite Test', suffix:'-Kite-Test', footnote:'Test' },
        layout: { pxPerSemi: 20 },
        notehead: { heightInSemitones: 4.0, verticalOffset: 0 },
        engine: { ...Core.ENGINE_DEFAULTS, falseHollow: true },
        defs: {
            'kite-up': { type:'notehead', path:'M 0 0.6667 L 0.6667 0.3333 L 0 -0.6667 L -0.6667 0.3333 Z', hollowPath:'M 0.3333 0.3333 L 0 -0.3333 L -0.3333 0.3333 Z', lilypondPath:null, lilypondHollow:null, naturalHeight:1.333, naturalWidth:1.333, semitoneHeight:1.333, anchors:{stemUp:{x:0,y:0.66},stemDown:{x:0,y:-0.66}}, overlapPercent:25, isFalseHollow:false },
            'kite-down': { type:'notehead', path:'M 0 -0.6667 L 0.6667 -0.3333 L 0 0.6667 L -0.6667 -0.3333 Z', hollowPath:'M -0.3333 -0.3333 L 0.3333 -0.3333 L 0 0.3333 Z', lilypondPath:null, lilypondHollow:null, naturalHeight:1.333, naturalWidth:1.333, semitoneHeight:1.333, anchors:{stemUp:{x:0,y:-0.66},stemDown:{x:0,y:0.66}}, overlapPercent:25, isFalseHollow:false }
        },
        colors: { 'color-primary':'#7d3fff', 'color-secondary':'#dc4538', 'color-tertiary':'#0f9e59' },
        styles: { 'staff':{color:'#000000',thickness:1,dash:null}, 'ledger':{color:'#000000',thickness:1,dash:null} },
        noteheadRules: [
            { shape:'kite-up', color:'color-primary', hollow:false, pitchClasses:[0,6], durations:'all', keys:'all' },
            { shape:'kite-down', color:'color-secondary', hollow:true, pitchClasses:[1,7], durations:'all', keys:'all' },
            { shape:'kite-up', color:'color-tertiary', hollow:false, pitchClasses:[2,8], durations:'all', keys:'all' },
            { shape:'kite-down', color:'color-primary', hollow:true, pitchClasses:[3,9], durations:'all', keys:'all' },
            { shape:'kite-up', color:'color-secondary', hollow:false, pitchClasses:[4,10], durations:'all', keys:'all' },
            { shape:'kite-down', color:'color-tertiary', hollow:true, pitchClasses:[5,11], durations:'all', keys:'all' }
        ],
        staffRules: [{ type:'staff', style:'staff', override:null, pitchClasses:[0,3,6,9], keys:'all' }]
    };
}

// === ALL SUITES ===

T.suite('Utilities', () => {
    T.test('roundTo', () => { T.eq(Core.roundTo(1.23456,2),1.23); T.eq(Core.roundTo(1.23456,4),1.2346); T.eq(Core.roundTo(1.5,0),2); });
    T.test('gcd', () => { T.eq(Core.gcd([6,4]),2); T.eq(Core.gcd([3,3,3,3]),3); T.eq(Core.gcd([12,8,4]),4); T.eq(Core.gcd([5,3]),1); });
    T.test('posMod', () => { T.eq(Core.posMod(5,12),5); T.eq(Core.posMod(-1,12),11); T.eq(Core.posMod(-13,12),11); T.eq(Core.posMod(12,12),0); });
    T.test('fmtNum', () => { T.eq(Core.fmtNum(3),'3'); T.eq(Core.fmtNum(3.0),'3'); T.eq(Core.fmtNum(0.5),'0.5'); T.eq(Core.fmtNum(-0.5),'-0.5'); });
    T.test('fmtRational', () => { T.eq(Core.fmtRational(1.75),'7/4'); T.eq(Core.fmtRational(1.5),'3/2'); T.eq(Core.fmtRational(2),'2'); T.eq(Core.fmtRational(1.234),'1.234'); });
    T.test('fmtPair', () => { T.eq(Core.fmtPair({x:0,y:0.9}),'0 . 0.9'); T.eq(Core.fmtPair({x:-0.365,y:0.9}),'-0.365 . 0.9'); });
    T.test('escSchemeString', () => { T.eq(Core.escSchemeString('hello "world"'), 'hello \\"world\\"'); });
    T.test('toSchemeSymbol', () => { T.eq(Core.toSchemeSymbol('Kite Up'),'kite-up'); T.eq(Core.toSchemeSymbol('my-shape_v2'),'my-shape-v2'); T.eq(Core.toSchemeSymbol('  Hello World  '),'hello-world'); T.eq(Core.toSchemeSymbol('UPPER'),'upper'); });
    T.test('hollowNameFor/attachmentNameFor', () => { T.eq(Core.hollowNameFor('kite-up'),'kite-up-cutout'); T.eq(Core.attachmentNameFor('kite-up'),'kite-up-attach'); });
    T.test('computeDefaultStemThickness: notehead limited', () => { T.approx(Core.computeDefaultStemThickness(90,20),5.2,0.01); });
    T.test('computeDefaultStemThickness: semitone limited', () => { T.approx(Core.computeDefaultStemThickness(10,20),1.111,0.01); });
    T.test('computeDefaultStaffLineThickness', () => { T.approx(Core.computeDefaultStaffLineThickness(5.2),3.95,0.01); });
});

T.suite('SVG Path Parsing', () => {
    T.test('simple M L Z', () => { const c=Core.parseSvgPath('M 0 0.6667 L 0.6667 0.3333 Z'); T.eq(c.length,3); T.eq(c[0].cmd,'M'); T.deepEq(c[0].args,[0,0.6667]); });
    T.test('curve', () => { const c=Core.parseSvgPath('M 0 0 C 1 2 3 4 5 6 Z'); T.eq(c[1].cmd,'C'); T.deepEq(c[1].args,[1,2,3,4,5,6]); });
    T.test('H and V', () => { const c=Core.parseSvgPath('M 0 0 H 5 V 3'); T.eq(c[1].cmd,'H'); T.eq(c[2].cmd,'V'); });
    T.test('comma-separated', () => { const c=Core.parseSvgPath('M0,0.6667 L0.6667,0.3333 Z'); T.deepEq(c[0].args,[0,0.6667]); });
    T.test('empty/null', () => { T.deepEq(Core.parseSvgPath(''),[]); T.deepEq(Core.parseSvgPath(null),[]); });
});

T.suite('SVG to LilyPond Path Conversion', () => {
    T.test('simple diamond', () => { const ly=Core.svgPathToLilypond('M 0 0.6667 L 0.6667 0.3333 L 0 -0.6667 L -0.6667 0.3333 Z'); T.contains(ly,'(moveto 0 0.6667)'); T.contains(ly,'(closepath)'); });
    T.test('H and V converted', () => { const ly=Core.svgPathToLilypond('M 0 0 H 5 V 3 Z'); T.contains(ly,'(lineto 5 0)'); T.contains(ly,'(lineto 5 3)'); });
    T.test('curve', () => { T.contains(Core.svgPathToLilypond('M 0 0 C 0.1 0.2 0.3 0.4 0.5 0.6 Z'),'(curveto 0.1 0.2 0.3 0.4 0.5 0.6)'); });
    T.test('precision', () => { T.contains(Core.svgPathToLilypond('M 0.123456789 0.987654321 Z',2),'(moveto 0.12 0.99)'); });
    T.test('negative zero', () => { T.contains(Core.svgPathToLilypond('M -0.00001 0 Z',3),'(moveto 0 0)'); });
    T.test('svgPathToCommands', () => { T.deepEq(Core.svgPathToCommands('M 0 1 L 2 3 Z'),[['moveto',0,1],['lineto',2,3],['closepath']]); });
});

T.suite('Anchor / Stem Attachment Math', () => {
    T.test('deriveMinimAnchors: 0% overlap', () => {
        const r=Core.deriveMinimAnchors({x:0,y:0.9},{x:0,y:-0.9},0,1.333);
        T.approx(r.minimUp.x,1.333,0.001); T.eq(r.minimUp.y,0.9);
        T.approx(r.minimDown.x,0,0.001); T.eq(r.minimDown.y,-0.9);
    });
    T.test('deriveMinimAnchors: 100% overlap', () => {
        const r=Core.deriveMinimAnchors({x:0,y:0.9},{x:0,y:-0.9},100,1.333);
        T.approx(r.minimUp.x,0,0.001); T.approx(r.minimDown.x,0,0.001);
    });
    T.test('deriveMinimAnchors: 50% overlap', () => {
        const r=Core.deriveMinimAnchors({x:0,y:0.9},{x:0,y:-0.9},50,1.333);
        T.approx(r.minimUp.x,0.6665,0.01); T.approx(r.minimDown.x,0,0.001);
    });
    T.test('buildAttachmentPoints: uses shape overlapPercent', () => {
        const def={anchors:{stemUp:{x:0,y:0.9},stemDown:{x:0,y:-0.9}},naturalHeight:1.333,overlapPercent:75};
        const pts=Core.buildAttachmentPoints(def);
        T.approx(pts.minimUp.x,0.3333,0.01); T.approx(pts.minimDown.x,0,0.001);
    });
    T.test('buildAttachmentPoints: defaults to 25%', () => {
        const def={anchors:{stemUp:{x:0,y:0.9},stemDown:{x:0,y:-0.9}},naturalHeight:1.333};
        const pts=Core.buildAttachmentPoints(def);
        T.approx(pts.minimUp.x,0.9998,0.01);
    });
    T.test('buildAttachmentPoints: null for stemless shape', () => {
        const def={anchors:null, naturalHeight:272.4, semitoneHeight:2.724};
        const pts=Core.buildAttachmentPoints(def);
        T.eq(pts, null);
    });
    T.test('buildShapeDef: stemless when both rects null', () => {
        const def = Core.buildShapeDef({
            name: 'semibreve', noteheadPath: 'M 0 0 Z', hollowPath: 'M 1 1 Z',
            lilypondNotehead: "'(test)", lilypondHollow: "'(test2)",
            semitoneHeight: 2.724, stemUpRect: null, stemDownRect: null,
            viewBoxWidth: 476.698, viewBoxHeight: 272.4, isFalseHollow: false
        });
        T.eq(def.anchors, null);
        T.eq(def.semitoneHeight, 2.724);
        T.ok(def.hollowPath !== null);
    });
    T.test('buildShapeDef: has anchors when stem rects present', () => {
        const def = Core.buildShapeDef({
            name: 'crotchet', noteheadPath: 'M 0 0 Z', hollowPath: null,
            lilypondNotehead: null, lilypondHollow: null,
            semitoneHeight: 2.724,
            stemUpRect: {x:140, y:-200, width:17, height:160},
            stemDownRect: {x:-157, y:40, width:17, height:160},
            viewBoxWidth: 344.9, viewBoxHeight: 272.4, isFalseHollow: false
        });
        T.ok(def.anchors !== null);
        T.ok(typeof def.anchors.stemUp.x === 'number');
        T.ok(typeof def.anchors.stemDown.x === 'number');
    });
});

T.suite('Staff Derivation', () => {
    T.test('getStaffPitchClasses', () => { const r=[{type:'staff',pitchClasses:[0,3,6,9]},{type:'ledger',pitchClasses:[1]}]; T.deepEq(Core.getStaffPitchClasses(r,'staff'),[0,3,6,9]); });
    T.test('Kite 4-369', () => { T.eq(Core.deriveSemitonesPerStaffSpace([{type:'staff',pitchClasses:[0,3,6,9]}]),3); });
    T.test('standard 5-line', () => { T.eq(Core.deriveSemitonesPerStaffSpace([{type:'staff',pitchClasses:[0,2,4,7,9,11]}]),1); });
    T.test('2 semi/space', () => { T.eq(Core.deriveSemitonesPerStaffSpace([{type:'staff',pitchClasses:[0,2,4,6,8,10]}]),2); });
    T.test('4-8 config (Clairnote)', () => { T.eq(Core.deriveSemitonesPerStaffSpace([{type:'staff',pitchClasses:[4,8]}]),4); });
    T.test('<2 staff lines', () => { T.eq(Core.deriveSemitonesPerStaffSpace([{type:'staff',pitchClasses:[0]}]),1); });
    T.test('positions Kite', () => { T.deepEq(Core.deriveStaffLinePositions([{type:'staff',pitchClasses:[0,3,6,9]}],3),[-6,-4,-2,2,4,6]); });
    T.test('custom linesPerSide', () => { T.deepEq(Core.deriveStaffLinePositions([{type:'staff',pitchClasses:[0,3,6,9]}],3,4),[-8,-6,-4,-2,2,4,6,8]); });
    T.test('ledger auto', () => { T.deepEq(Core.deriveLedgerPositions([],3),[]); });
});

T.suite('Validation', () => {
    T.test('valid Kite', () => { const v=Core.validateForExport(makeKiteApp()); T.ok(v.valid, v.errors.join('; ')); });
    T.test('no rules', () => { const v=Core.validateForExport(Core.createDefaultApp()); T.ok(!v.valid); T.ok(v.errors.some(e=>e.includes('No notehead rules'))); });
    T.test('uncovered PC (shape rules only)', () => {
        const a=makeKiteApp();
        a.noteheadRules = [{ ruleType:'shape', shape:'kite-up', pitchClasses:[0,1,2,3,4,5,6,7,8,9,10], durations:'all', keys:'all' }];
        T.ok(!Core.validateForExport(a).valid);
    });
    T.test('bad suffix', () => { const a=makeKiteApp(); a.meta.suffix='NoHyphen'; T.ok(!Core.validateForExport(a).valid); });
    T.test('empty suffix ok', () => { const a=makeKiteApp(); a.meta.suffix=''; T.ok(Core.validateForExport(a).valid); });
    T.test('bad hex in color rule', () => {
        const a=makeKiteApp();
        a.noteheadRules.push({ ruleType:'color', color:'nope', pitchClasses:[0], durations:'all', keys:'all' });
        T.ok(!Core.validateForExport(a).valid);
    });
    T.test('unknown shape ref', () => {
        const a=makeKiteApp();
        a.noteheadRules.push({ ruleType:'shape', shape:'nonexistent', pitchClasses:[0], durations:'all', keys:'all' });
        T.ok(!Core.validateForExport(a).valid);
    });
    T.test('<2 staff lines', () => { const a=makeKiteApp(); a.staffRules=[{type:'staff',style:'staff',override:null,pitchClasses:[0],keys:'all'}]; T.ok(!Core.validateForExport(a).valid); });
    T.test('hollow without hollowPath warns', () => {
        const a=makeKiteApp();
        // kite-up has no hollowPath by default in our test? Let's force it:
        delete a.defs['kite-up'].hollowPath;
        // Add a hollow rule that applies to PCs assigned to kite-up
        a.noteheadRules.push({ ruleType:'hollow', hollow:true, pitchClasses:[0], durations:'all', keys:'all' });
        const v = Core.validateForExport(a);
        T.ok(v.warnings.some(w=>w.includes('hollow')));
    });
    T.test('non-palette color warns', () => {
        const a=makeKiteApp();
        a.noteheadRules.push({ ruleType:'color', color:'#ff00ff', pitchClasses:[0], durations:'all', keys:'all' });
        T.ok(Core.validateForExport(a).warnings.some(w=>w.includes('not in the active palette')));
    });
});

T.suite('Data Model', () => {
    T.test('createDefaultApp version', () => { T.eq(Core.createDefaultApp().meta.version, Core.VERSION); });
    T.test('createDefaultApp has rules', () => { const a=Core.createDefaultApp(); T.ok(Array.isArray(a.noteheadRules)); T.ok(Array.isArray(a.staffRules)); });
    T.test('createDefaultApp no mapChrom', () => { const a=Core.createDefaultApp(); T.ok(!('mapChrom' in a)); T.ok(!('mapStaff' in a)); });
    T.test('createDefaultApp has noteheadPalette', () => { const a=Core.createDefaultApp(); T.ok(a.noteheadPalette); T.eq(a.noteheadPalette.mode,'standard'); T.ok(!('colors' in a)); });
    T.test('createDefaultApp engine defaults', () => { const a=Core.createDefaultApp(); T.eq(a.engine.falseHollow,false); T.eq(a.engine.multinotePadding,-0.5); T.eq(a.engine.defaultMagnify,1.75); T.eq(a.engine.stemThickness,null); });
    T.test('migrateApp v1→v4', () => { const m=Core.migrateApp({meta:{version:'1.0',name:'T'},mapChrom:[],mapStaff:[],defs:{}}); T.eq(m.meta.version,Core.VERSION); T.ok(m.engine); T.ok(Array.isArray(m.noteheadRules)); T.ok(!('mapChrom' in m)); T.ok(!('colors' in m)); T.ok(m.noteheadPalette); });
    T.test('migrateApp v2→v4 converts rules', () => {
        const v2={meta:{version:'2.0'},engine:{},mapChrom:Array.from({length:12},()=>({shape:'s',color:'c',hollow:false})),mapStaff:Array.from({length:12},(_,i)=>({type:i%3===0?'staff':'none',style:'staff',override:null})),defs:{s:{path:'M 0 0',anchors:{},overlapPercent:25}},colors:{c:'#ff0000'}};
        const m=Core.migrateApp(v2); T.eq(m.meta.version,Core.VERSION); T.ok(Array.isArray(m.noteheadRules)); T.ok(!('mapChrom' in m)); T.ok(!('colors' in m));
    });
    T.test('migrateApp v3→v4 cumulative rules', () => {
        const v3 = makeKiteAppV3();
        const m = Core.migrateApp(v3);
        T.eq(m.meta.version, Core.VERSION);
        T.ok(!('colors' in m));
        T.ok(m.noteheadPalette);
        // Should have cumulative rules with ruleType
        T.ok(m.noteheadRules.every(r => r.ruleType !== undefined));
        // Should have shape, hollow, and color rules
        T.ok(m.noteheadRules.some(r => r.ruleType === 'shape'));
        T.ok(m.noteheadRules.some(r => r.ruleType === 'hollow'));
        T.ok(m.noteheadRules.some(r => r.ruleType === 'color'));
    });
    T.test('migrateApp v3→v4 resolves color refs to hex', () => {
        const v3 = makeKiteAppV3();
        const m = Core.migrateApp(v3);
        const colorRules = m.noteheadRules.filter(r => r.ruleType === 'color');
        // All color rules should now have hex values, not named refs
        T.ok(colorRules.every(r => r.color.startsWith('#')));
    });
    T.test('migrateApp v3→v4 palette from colors', () => {
        const v3 = makeKiteAppV3();
        const m = Core.migrateApp(v3);
        T.eq(m.noteheadPalette.selected, 'custom');
        // Should have the 3 non-black colors from the old dict
        T.eq(m.noteheadPalette.customColors.length, 3);
    });
    T.test('migrateApp adds shape fields', () => { const m=Core.migrateApp({meta:{version:'2.0'},engine:{},mapChrom:[],mapStaff:[],defs:{s:{path:'M 0 0',naturalHeight:1.5,anchors:{},overlapPercent:25}},colors:{}}); T.eq(m.defs.s.lilypondPath,null); T.eq(m.defs.s.semitoneHeight,1.5); });
    T.test('migrateApp sets overlapPercent 25 default', () => { const m=Core.migrateApp({meta:{version:'1.0',name:'T'},mapChrom:[],mapStaff:[],defs:{'s':{path:'M 0 0',anchors:{}}}}); T.eq(m.defs['s'].overlapPercent,25); });
    T.test('migrateApp strips defaultOverlapPercent and backfills', () => { const m=Core.migrateApp({meta:{version:'1.0',name:'T'},mapChrom:[],mapStaff:[],defs:{'s':{path:'M 0 0',anchors:{}}},engine:{defaultOverlapPercent:60}}); T.eq(m.engine.defaultOverlapPercent,undefined); T.eq(m.defs['s'].overlapPercent,60); });
    T.test('migrateApp adds stemThickness', () => { const m=Core.migrateApp({meta:{version:'1.0',name:'T'},mapChrom:[],mapStaff:[],defs:{}}); T.eq(m.engine.stemThickness,null); });
    T.test('migrateApp v4 is idempotent', () => {
        const a = makeKiteApp();
        const m = Core.migrateApp(JSON.parse(JSON.stringify(a)));
        T.eq(m.meta.version, Core.VERSION);
        T.eq(m.noteheadRules.length, a.noteheadRules.length);
    });
});

T.suite('JSON Serialization', () => {
    T.test('serializeApp valid JSON', () => { T.eq(JSON.parse(Core.serializeApp(makeKiteApp())).meta.version, Core.VERSION); });
    T.test('round-trip', () => { const a=makeKiteApp(); const r=Core.deserializeApp(Core.serializeApp(a)); T.eq(r.meta.label,a.meta.label); T.ok(Array.isArray(r.noteheadRules)); T.eq(r.noteheadRules[0].ruleType,'shape'); });
    T.test('migrates v3', () => {
        const v3 = makeKiteAppV3();
        const a = Core.deserializeApp(JSON.stringify(v3));
        T.eq(a.meta.version, Core.VERSION);
        T.ok(Array.isArray(a.noteheadRules));
        T.ok(a.noteheadRules[0].ruleType !== undefined);
        T.ok(!('colors' in a));
    });
    T.test('invalid JSON throws', () => { T.throws(()=>Core.deserializeApp('not json')); });
});

T.suite('.ly Export — Section A', () => {
    T.test('contains path definitions', () => { const a=Core.generateSectionA(makeKiteApp()); T.contains(a,'cnb:register-path!'); T.contains(a,"'kite-up"); T.contains(a,'moveto'); });
    T.test('contains hollow registrations', () => { const a=Core.generateSectionA(makeKiteApp()); T.contains(a,'cnb:register-hollow!'); T.contains(a,'cutout'); });
    T.test('contains attachment registrations', () => { const a=Core.generateSectionA(makeKiteApp()); T.contains(a,'cnb:register-attachment!'); T.contains(a,'crotchet-up'); T.contains(a,'minim-up'); });
    T.test('conditional color block', () => {
        const a=Core.generateSectionA(makeKiteApp());
        T.contains(a,'cnb:use-accessible-colors');
        T.contains(a,'cnb:register-color!');
        T.contains(a,'Accessible (colorblind-safe) palette');
        T.contains(a,'Primary palette');
    });
    T.test('color block has both branches', () => {
        const a=Core.generateSectionA(makeKiteApp());
        T.contains(a,'#7d3fff');  // Primary hex
        T.contains(a,'(begin');
    });
    T.test('symbol names from nearestColorName', () => {
        const a=Core.generateSectionA(makeKiteApp());
        // #7d3fff should get a nearestColorName-derived symbol
        const sym = Core.colorToSchemeSymbol('#7d3fff');
        T.contains(a, sym);
    });
    T.test('skips hollows when none', () => { const a=makeKiteApp(); Object.values(a.defs).forEach(d=>d.hollowPath=null); T.notContains(Core.generateSectionA(a),'cnb:register-hollow!'); });
    T.test('uses lilypondPath when available', () => { const a=makeKiteApp(); a.defs['kite-up'].lilypondPath="'((moveto 0.8 0) (closepath))"; T.contains(Core.generateSectionA(a),'(moveto 0.8 0)'); });
    T.test('uses lilypondHollow when available', () => { const a=makeKiteApp(); a.defs['kite-down'].lilypondHollow="'((moveto 0.5 0) (closepath))"; T.contains(Core.generateSectionA(a),'(moveto 0.5 0)'); });
    T.test('monochrome: registers black outside conditional', () => {
        const a=makeKiteApp();
        // Remove all color rules → only black used
        a.noteheadRules = a.noteheadRules.filter(r => r.ruleType !== 'color');
        const sect = Core.generateSectionA(a);
        T.contains(sect, "black-000000");
    });
    T.test('stemless shape: skips attachment registration', () => {
        const a=makeKiteApp();
        // Make kite-up stemless
        a.defs['kite-up'].anchors = null;
        const sect = Core.generateSectionA(a);
        T.contains(sect, 'stemless');
        // kite-down should still have attachment
        T.contains(sect, 'kite-down-attach');
    });
});

T.suite('.ly Export — Section B', () => {
    T.test('NO procedure model flag', () => { T.notContains(Core.generateSectionB(makeKiteApp()),'cnb:use-procedure-model'); });
    T.test('staff geometry', () => { const b=Core.generateSectionB(makeKiteApp()); T.contains(b,'cnb:semitones-per-staff-space'); T.contains(b,'cnb:staff-line-positions'); });
    T.test('Kite positions', () => { T.contains(Core.generateSectionB(makeKiteApp()),"'(-6 -4 -2 2 4 6)"); });
    T.test('emits false-hollow when changed', () => { const a=makeKiteApp(); a.engine.falseHollow=true; T.contains(Core.generateSectionB(a),'cnb:false-hollow #t'); });
    T.test('omits false-hollow when default', () => { const a=makeKiteApp(); a.engine.falseHollow=false; T.notContains(Core.generateSectionB(a),'cnb:false-hollow'); });
    T.test('emits magnify as rational', () => { const a=makeKiteApp(); a.engine.defaultMagnify=2.0; T.contains(Core.generateSectionB(a),'cnb:default-magnify 2'); });
    T.test('metadata', () => { const b=Core.generateSectionB(makeKiteApp()); T.contains(b,'cnb:file-suffix'); T.contains(b,'cnb:notation-label'); });
    T.test('emits stemThickness when set', () => { const a=makeKiteApp(); a.engine.stemThickness=3.5; T.contains(Core.generateSectionB(a),'cnb:stem-thickness 3.5'); });
    T.test('omits stemThickness when null', () => { const a=makeKiteApp(); a.engine.stemThickness=null; T.notContains(Core.generateSectionB(a),'cnb:stem-thickness'); });
});

T.suite('.ly Export — Section C', () => {
    T.test('procedure wrapper with let/pc', () => {
        const c=Core.generateSectionC(makeKiteApp());
        T.contains(c,'cnb:get-notehead-config');
        T.contains(c,'lambda (semitone duration key)');
        T.contains(c,'(let ((pc (modulo semitone 12)))');
        T.contains(c,'cond');
    });
    T.test('uses memv pc for grouped PCs', () => { T.contains(Core.generateSectionC(makeKiteApp()),"memv pc '("); });
    T.test('5 alist fields', () => { const c=Core.generateSectionC(makeKiteApp()); ['shape','color','hollow','attachment','off-key-mark'].forEach(f=>T.contains(c,f)); });
    T.test('fallback else', () => { T.contains(Core.generateSectionC(makeKiteApp()),'(else'); });
    T.test('scheme symbols', () => { const c=Core.generateSectionC(makeKiteApp()); T.contains(c,'kite-up'); T.contains(c,'kite-down'); });
    T.test('color symbols from hex', () => {
        const c=Core.generateSectionC(makeKiteApp());
        const sym = Core.colorToSchemeSymbol('#7d3fff');
        T.contains(c, sym);
    });
    T.test('cumulative comment', () => { T.contains(Core.generateSectionC(makeKiteApp()),'cumulative rules'); });
    T.test('buildPitchClassCondition: all', () => { T.eq(Core.buildPitchClassCondition('all'),'#t'); });
    T.test('buildPitchClassCondition: single (default var)', () => { T.eq(Core.buildPitchClassCondition([7]),'(= semitone 7)'); });
    T.test('buildPitchClassCondition: multi (default var)', () => { T.eq(Core.buildPitchClassCondition([0,4,8]),"(memv semitone '(0 4 8))"); });
    T.test('buildPitchClassCondition: custom var', () => { T.eq(Core.buildPitchClassCondition([0,4,8],'pc'),"(memv pc '(0 4 8))"); });
    T.test('buildPitchClassCondition: single custom var', () => { T.eq(Core.buildPitchClassCondition([7],'pc'),'(= pc 7)'); });
    T.test('buildRuleComment: all', () => { T.eq(Core.buildRuleComment({pitchClasses:'all'}),'All pitch classes'); });
    T.test('stemless shape: attachment is #f', () => {
        const a=makeKiteApp();
        a.defs['kite-up'].anchors = null;
        const c=Core.generateSectionC(a);
        // kite-up entries should have #f attachment
        T.contains(c, "(attachment . #f)");
        // kite-down entries should still have named attachment
        T.contains(c, "kite-down-attach");
    });
});

T.suite('.ly Export — Full File', () => {
    T.test('header with version', () => { const ly=Core.generateLy(makeKiteApp()); T.contains(ly,'version "2.24.2"'); T.contains(ly,'include "ChromaticNotationBase.ly"'); });
    T.test('all three sections', () => { const ly=Core.generateLy(makeKiteApp()); T.contains(ly,'SECTION A'); T.contains(ly,'SECTION B'); T.contains(ly,'SECTION C'); });
    T.test('generated-by', () => { T.contains(Core.generateLy(makeKiteApp()),'Generated by Chromatic Configurator'); });
    T.test('ordering A < B < C', () => { const ly=Core.generateLy(makeKiteApp()); T.ok(ly.indexOf('SECTION A')<ly.indexOf('SECTION B')); T.ok(ly.indexOf('SECTION B')<ly.indexOf('SECTION C')); });
    T.test('header has palette info', () => { const ly=Core.generateLy(makeKiteApp()); T.contains(ly,'Color palette:'); T.contains(ly,'cnb:use-accessible-colors'); });
});

T.suite('Color Presets', () => {
    T.test('Rich Tricolor has 3', () => { T.eq(Object.keys(Core.COLOR_PRESETS['Rich Tricolor']).length,3); });
    T.test('CNB 12-Semitone has 12', () => { T.eq(Object.keys(Core.COLOR_PRESETS['CNB 12-Semitone']).length,12); });
    T.test('All presets valid hex', () => { for(const[n,c]of Object.entries(Core.COLOR_PRESETS)) for(const[k,h]of Object.entries(c)) T.ok(/^#[0-9a-fA-F]{6}$/.test(h),n+'.'+k+'='+h); });
});

// === BAKER PIPELINE TESTS ===

T.suite('Baker Path Parser', () => {
    T.test('simple M L Z', () => {
        const c = Core.bakerParsePath('M 0 10 L 5 15 Z');
        T.eq(c.length, 3);
        T.eq(c[0].t, 'M'); T.deepEq(c[0].args, [0, 10]);
        T.eq(c[1].t, 'L'); T.deepEq(c[1].args, [5, 15]);
        T.eq(c[2].t, 'Z');
    });
    T.test('comma-separated', () => {
        const c = Core.bakerParsePath('M0,10 L5,15 Z');
        T.deepEq(c[0].args, [0, 10]);
    });
    T.test('scientific notation', () => {
        const c = Core.bakerParsePath('M 1.5e2 -3.2e-1');
        T.approx(c[0].args[0], 150, 0.001);
        T.approx(c[0].args[1], -0.32, 0.001);
    });
    T.test('negative numbers without separator', () => {
        const c = Core.bakerParsePath('M 10-5 L 3-7');
        T.deepEq(c[0].args, [10, -5]);
        T.deepEq(c[1].args, [3, -7]);
    });
    T.test('lowercase (relative) commands parsed', () => {
        const c = Core.bakerParsePath('m 10 10 l 5 5 z');
        T.eq(c[0].t, 'm'); T.eq(c[1].t, 'l'); T.eq(c[2].t, 'z');
    });
    T.test('arc command with all flags', () => {
        const c = Core.bakerParsePath('A 25 25 0 1 0 50 50');
        T.eq(c[0].t, 'A');
        T.eq(c[0].args.length, 7);
        T.deepEq(c[0].args, [25, 25, 0, 1, 0, 50, 50]);
    });
    T.test('empty/null returns empty', () => {
        T.deepEq(Core.bakerParsePath(''), []);
        T.deepEq(Core.bakerParsePath(null), []);
    });
    T.test('H V S Q T commands', () => {
        const c = Core.bakerParsePath('M 0 0 H 10 V 20 S 5 6 7 8 Q 1 2 3 4 T 9 10');
        T.eq(c.length, 6);
        T.eq(c[1].t, 'H'); T.eq(c[2].t, 'V');
        T.eq(c[3].t, 'S'); T.eq(c[4].t, 'Q'); T.eq(c[5].t, 'T');
    });
    T.test('implicit L after M (multiple coord pairs)', () => {
        const c = Core.bakerParsePath('M 0 0 10 10 20 20');
        T.eq(c[0].args.length, 6); // M captures all args, normalizeCommands splits them
    });
});

T.suite('Arc-to-Cubic Conversion', () => {
    T.test('degenerate: same start/end returns empty', () => {
        T.deepEq(Core.arcToCubic(10, 10, 5, 5, 0, false, false, 10, 10), []);
    });
    T.test('degenerate: zero radius returns L', () => {
        const r = Core.arcToCubic(0, 0, 0, 5, 0, false, true, 10, 0);
        T.eq(r.length, 1); T.eq(r[0].t, 'L');
    });
    T.test('quarter circle produces 1 segment', () => {
        // Quarter circle: 90° arc
        const r = Core.arcToCubic(10, 0, 10, 10, 0, false, true, 0, 10);
        T.eq(r.length, 1); T.eq(r[0].t, 'C');
        // Endpoint should be at (0, 10)
        T.approx(r[0].args[4], 0, 0.01);
        T.approx(r[0].args[5], 10, 0.01);
    });
    T.test('semicircle produces 2 segments', () => {
        const r = Core.arcToCubic(-10, 0, 10, 10, 0, false, true, 10, 0);
        T.eq(r.length, 2);
        // Final endpoint should be (10, 0)
        T.approx(r[1].args[4], 10, 0.01);
        T.approx(r[1].args[5], 0, 0.01);
    });
    T.test('full circle (via two arcs) produces 4 segments', () => {
        // Two half-arcs make a full circle
        const half1 = Core.arcToCubic(-10, 0, 10, 10, 0, true, false, 10, 0);
        const half2 = Core.arcToCubic(10, 0, 10, 10, 0, true, false, -10, 0);
        T.ok(half1.length + half2.length === 4, 'full circle = 4 segments');
    });
    T.test('out-of-range radii corrected', () => {
        // Radii too small should be scaled up automatically
        const r = Core.arcToCubic(0, 0, 1, 1, 0, false, true, 100, 0);
        T.ok(r.length >= 1);
        T.approx(r[r.length - 1].args[4], 100, 0.01);
    });
});

T.suite('Normalize Commands', () => {
    T.test('relative m l to absolute M L', () => {
        const cmds = Core.bakerParsePath('m 10 20 l 5 5 l -3 2');
        const n = Core.normalizeCommands(cmds);
        T.eq(n[0].t, 'M'); T.deepEq(n[0].args, [10, 20]);
        T.eq(n[1].t, 'L'); T.deepEq(n[1].args, [15, 25]);
        T.eq(n[2].t, 'L'); T.deepEq(n[2].args, [12, 27]);
    });
    T.test('H and V to L', () => {
        const cmds = Core.bakerParsePath('M 0 0 H 10 V 20');
        const n = Core.normalizeCommands(cmds);
        T.eq(n[1].t, 'L'); T.deepEq(n[1].args, [10, 0]);
        T.eq(n[2].t, 'L'); T.deepEq(n[2].args, [10, 20]);
    });
    T.test('relative h v', () => {
        const cmds = Core.bakerParsePath('M 5 5 h 10 v 20');
        const n = Core.normalizeCommands(cmds);
        T.deepEq(n[1].args, [15, 5]);
        T.deepEq(n[2].args, [15, 25]);
    });
    T.test('A command normalized to C', () => {
        const cmds = Core.bakerParsePath('M -10 0 A 10 10 0 1 0 10 0');
        const n = Core.normalizeCommands(cmds);
        T.eq(n[0].t, 'M');
        T.ok(n.length > 1);
        // All non-M commands should be C (arc→cubic)
        n.slice(1).forEach(c => T.eq(c.t, 'C'));
        // Last endpoint should be at (10, 0)
        const last = n[n.length - 1];
        T.approx(last.args[4], 10, 0.01);
        T.approx(last.args[5], 0, 0.01);
    });
    T.test('S (smooth cubic) expanded', () => {
        const cmds = Core.bakerParsePath('M 0 0 C 10 0 20 10 20 20 S 30 40 20 40');
        const n = Core.normalizeCommands(cmds);
        T.eq(n.length, 3); // M, C, C (S→C)
        T.eq(n[2].t, 'C');
        // Reflected control point: 2*(20,20) - (20,10) = (20, 30)
        T.approx(n[2].args[0], 20, 0.01);
        T.approx(n[2].args[1], 30, 0.01);
    });
    T.test('Q (quadratic) to cubic', () => {
        const cmds = Core.bakerParsePath('M 0 0 Q 50 100 100 0');
        const n = Core.normalizeCommands(cmds);
        T.eq(n.length, 2); // M, C
        T.eq(n[1].t, 'C');
        // Quadratic→cubic: CP1 = P0 + 2/3*(Q-P0) = (0+33.33, 0+66.67) ≈ (33.33, 66.67)
        T.approx(n[1].args[0], 33.333, 0.1);
        T.approx(n[1].args[1], 66.667, 0.1);
        // Endpoint preserved
        T.approx(n[1].args[4], 100, 0.01);
        T.approx(n[1].args[5], 0, 0.01);
    });
    T.test('T (smooth quadratic) reflected', () => {
        const cmds = Core.bakerParsePath('M 0 0 Q 25 50 50 0 T 100 0');
        const n = Core.normalizeCommands(cmds);
        T.eq(n.length, 3); // M, C, C
        T.eq(n[2].t, 'C');
        // Endpoint of T segment
        T.approx(n[2].args[4], 100, 0.01);
        T.approx(n[2].args[5], 0, 0.01);
    });
    T.test('Z preserved', () => {
        const cmds = Core.bakerParsePath('M 0 0 L 10 0 L 10 10 Z');
        const n = Core.normalizeCommands(cmds);
        T.eq(n[n.length - 1].t, 'Z');
    });
    T.test('implicit L after M', () => {
        const cmds = Core.bakerParsePath('M 0 0 10 10 20 20');
        const n = Core.normalizeCommands(cmds);
        T.eq(n.length, 3); // M, L, L
        T.eq(n[0].t, 'M'); T.eq(n[1].t, 'L'); T.eq(n[2].t, 'L');
        T.deepEq(n[2].args, [20, 20]);
    });
    T.test('mixed relative/absolute', () => {
        const cmds = Core.bakerParsePath('M 100 100 l 10 0 L 200 200 l -5 -5');
        const n = Core.normalizeCommands(cmds);
        T.deepEq(n[0].args, [100, 100]);
        T.deepEq(n[1].args, [110, 100]);
        T.deepEq(n[2].args, [200, 200]);
        T.deepEq(n[3].args, [195, 195]);
    });
});

T.suite('Apply Matrix', () => {
    T.test('identity matrix', () => {
        const cmds = [{ t: 'M', args: [10, 20] }, { t: 'L', args: [30, 40] }];
        const r = Core.applyMatrix(cmds, { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 });
        T.deepEq(r[0].args, [10, 20]);
        T.deepEq(r[1].args, [30, 40]);
    });
    T.test('translation', () => {
        const cmds = [{ t: 'M', args: [0, 0] }, { t: 'L', args: [10, 10] }];
        const r = Core.applyMatrix(cmds, { a: 1, b: 0, c: 0, d: 1, e: 5, f: -3 });
        T.deepEq(r[0].args, [5, -3]);
        T.deepEq(r[1].args, [15, 7]);
    });
    T.test('scale 2x', () => {
        const cmds = [{ t: 'M', args: [1, 2] }, { t: 'L', args: [3, 4] }];
        const r = Core.applyMatrix(cmds, { a: 2, b: 0, c: 0, d: 2, e: 0, f: 0 });
        T.deepEq(r[0].args, [2, 4]);
        T.deepEq(r[1].args, [6, 8]);
    });
    T.test('90° rotation', () => {
        // Rotate 90° CCW: (x,y) → (-y, x)
        const cmds = [{ t: 'M', args: [1, 0] }];
        const r = Core.applyMatrix(cmds, { a: 0, b: 1, c: -1, d: 0, e: 0, f: 0 });
        T.approx(r[0].args[0], 0, 0.001);
        T.approx(r[0].args[1], 1, 0.001);
    });
    T.test('transforms C control points', () => {
        const cmds = [{ t: 'C', args: [1, 2, 3, 4, 5, 6] }];
        const r = Core.applyMatrix(cmds, { a: 1, b: 0, c: 0, d: 1, e: 10, f: 20 });
        T.deepEq(r[0].args, [11, 22, 13, 24, 15, 26]);
    });
    T.test('Z unchanged', () => {
        const cmds = [{ t: 'Z', args: [] }];
        const r = Core.applyMatrix(cmds, { a: 2, b: 0, c: 0, d: 2, e: 0, f: 0 });
        T.eq(r[0].t, 'Z');
        T.eq(r[0].args.length, 0);
    });
});

T.suite('Path BBox', () => {
    T.test('triangle bbox', () => {
        const cmds = [
            { t: 'M', args: [0, 0] },
            { t: 'L', args: [10, 0] },
            { t: 'L', args: [5, 10] },
            { t: 'Z', args: [] }
        ];
        const bb = Core.pathBBox(cmds);
        T.eq(bb.minX, 0); T.eq(bb.maxX, 10);
        T.eq(bb.minY, 0); T.eq(bb.maxY, 10);
        T.eq(bb.width, 10); T.eq(bb.height, 10);
    });
    T.test('negative coords', () => {
        const cmds = [
            { t: 'M', args: [-5, -3] },
            { t: 'L', args: [5, 3] }
        ];
        const bb = Core.pathBBox(cmds);
        T.eq(bb.minX, -5); T.eq(bb.maxX, 5);
        T.eq(bb.width, 10); T.eq(bb.height, 6);
    });
    T.test('empty commands', () => {
        const bb = Core.pathBBox([]);
        T.eq(bb.width, 0); T.eq(bb.height, 0);
    });
    T.test('includes C control points', () => {
        const cmds = [
            { t: 'M', args: [0, 0] },
            { t: 'C', args: [0, 50, 100, 50, 100, 0] }
        ];
        const bb = Core.pathBBox(cmds);
        T.eq(bb.maxY, 50); // Control points extend bbox
    });
});

T.suite('Translate & Stringify Path', () => {
    T.test('translate moves all points', () => {
        const cmds = [
            { t: 'M', args: [0, 0] },
            { t: 'L', args: [10, 10] }
        ];
        const r = Core.bakerTranslatePath(cmds, 5, -3);
        T.deepEq(r[0].args, [5, -3]);
        T.deepEq(r[1].args, [15, 7]);
    });
    T.test('stringify basic', () => {
        const cmds = [
            { t: 'M', args: [0, 0] },
            { t: 'L', args: [10.1234, 20.5678] },
            { t: 'Z', args: [] }
        ];
        const s = Core.stringifyPath(cmds, 2);
        T.contains(s, 'M 0 0');
        T.contains(s, 'L 10.12 20.57');
        T.contains(s, 'Z');
    });
    T.test('stringify rounds correctly', () => {
        const cmds = [{ t: 'M', args: [1.23456789, -0.0001] }];
        T.contains(Core.stringifyPath(cmds, 3), 'M 1.235 0');
    });
});

T.suite('Center Path', () => {
    T.test('centers a square at origin', () => {
        const cmds = [
            { t: 'M', args: [10, 10] },
            { t: 'L', args: [20, 10] },
            { t: 'L', args: [20, 20] },
            { t: 'L', args: [10, 20] },
            { t: 'Z', args: [] }
        ];
        const r = Core.centerPath(cmds);
        const bb = Core.pathBBox(r.cmds);
        T.approx(bb.minX + bb.width / 2, 0, 0.001);
        T.approx(bb.minY + bb.height / 2, 0, 0.001);
    });
    T.test('returns offset', () => {
        const cmds = [
            { t: 'M', args: [10, 20] },
            { t: 'L', args: [30, 40] }
        ];
        const r = Core.centerPath(cmds);
        T.approx(r.offset.x, -20, 0.001);
        T.approx(r.offset.y, -30, 0.001);
    });
    T.test('already centered stays centered', () => {
        const cmds = [
            { t: 'M', args: [-5, -5] },
            { t: 'L', args: [5, 5] }
        ];
        const r = Core.centerPath(cmds);
        T.approx(r.offset.x, 0, 0.001);
        T.approx(r.offset.y, 0, 0.001);
    });
});

T.suite('Bake Path (full pipeline)', () => {
    T.test('diamond path centered', () => {
        const r = Core.bakePath('M 100 100 L 110 105 L 100 110 L 90 105 Z');
        const bb = r.bbox;
        T.approx(bb.minX + bb.width / 2, 0, 0.001);
        T.approx(bb.minY + bb.height / 2, 0, 0.001);
    });
    T.test('returns height', () => {
        const r = Core.bakePath('M 0 0 L 20 0 L 20 10 L 0 10 Z');
        T.approx(r.height, 10, 0.001);
    });
    T.test('shouldCenter=false keeps original coords', () => {
        const r = Core.bakePath('M 10 20 L 30 40', false);
        T.contains(r.path, '10');
        T.contains(r.path, '20');
    });
    T.test('normalizes relative commands', () => {
        const r = Core.bakePath('m 0 0 l 10 0 l 0 10 l -10 0 z', true);
        // Should produce a 10x10 square centered at origin
        T.approx(r.bbox.width, 10, 0.001);
        T.approx(r.bbox.height, 10, 0.001);
    });
    T.test('normalizes arcs', () => {
        // Circle via arcs: should produce C commands, centered
        const r = Core.bakePath('M -5 0 A 5 5 0 1 0 5 0 A 5 5 0 1 0 -5 0 Z', true);
        T.ok(r.path.includes('C'), 'arcs converted to cubics');
        T.ok(!r.path.includes('A'), 'no A commands remain');
    });
});

T.suite('Shape Element Converters', () => {
    T.test('circleToCommands', () => {
        const cmds = Core.circleToCommands(10, 20, 5);
        T.eq(cmds[0].t, 'M');
        T.deepEq(cmds[0].args, [5, 20]); // cx-r, cy
        T.eq(cmds[1].t, 'A');
        T.eq(cmds[cmds.length - 1].t, 'Z');
    });
    T.test('circle normalizes to cubics', () => {
        const cmds = Core.circleToCommands(0, 0, 10);
        const n = Core.normalizeCommands(cmds);
        n.forEach(c => T.ok(c.t === 'M' || c.t === 'C' || c.t === 'Z', 'only M/C/Z after normalize'));
    });
    T.test('circle bbox is correct after normalize', () => {
        const cmds = Core.circleToCommands(0, 0, 10);
        const n = Core.normalizeCommands(cmds);
        const bb = Core.pathBBox(n);
        T.approx(bb.minX, -10, 0.5);
        T.approx(bb.maxX, 10, 0.5);
        T.approx(bb.minY, -10, 0.5);
        T.approx(bb.maxY, 10, 0.5);
    });
    T.test('rectToCommands', () => {
        const cmds = Core.rectToCommands(5, 10, 20, 30);
        T.eq(cmds.length, 5); // M, L, L, L, Z
        T.deepEq(cmds[0].args, [5, 10]);
        T.deepEq(cmds[1].args, [25, 10]);
        T.deepEq(cmds[2].args, [25, 40]);
        T.deepEq(cmds[3].args, [5, 40]);
    });
    T.test('polygonToCommands closed', () => {
        const cmds = Core.polygonToCommands([0, 0, 10, 0, 5, 10], true);
        T.eq(cmds.length, 4); // M, L, L, Z
        T.eq(cmds[0].t, 'M');
        T.eq(cmds[3].t, 'Z');
    });
    T.test('polygonToCommands open (polyline)', () => {
        const cmds = Core.polygonToCommands([0, 0, 10, 0, 5, 10], false);
        T.eq(cmds.length, 3); // M, L, L — no Z
        T.ok(cmds.every(c => c.t !== 'Z'));
    });
    T.test('empty polygon', () => {
        T.deepEq(Core.polygonToCommands([]), []);
        T.deepEq(Core.polygonToCommands(null), []);
    });
});

T.suite('Canonicalize ID', () => {
    T.test('notehead variants', () => {
        T.eq(Core.canonicalizeId('notehead').canonical, 'notehead');
        T.eq(Core.canonicalizeId('Notehead').canonical, 'notehead');
        T.eq(Core.canonicalizeId('note-head').canonical, 'notehead');
        T.eq(Core.canonicalizeId('note_head').canonical, 'notehead');
        T.eq(Core.canonicalizeId('NOTE HEAD').canonical, 'notehead');
        T.eq(Core.canonicalizeId('notehead-main').canonical, 'notehead');
        T.eq(Core.canonicalizeId('notehead_main').canonical, 'notehead');
    });
    T.test('hollow variants', () => {
        T.eq(Core.canonicalizeId('hollow').canonical, 'hollow');
        T.eq(Core.canonicalizeId('Hollow').canonical, 'hollow');
        T.eq(Core.canonicalizeId('hollow-cutout').canonical, 'hollow');
        T.eq(Core.canonicalizeId('hollow_cutout').canonical, 'hollow');
    });
    T.test('false-hollow detected', () => {
        const r = Core.canonicalizeId('false-hollow');
        T.eq(r.canonical, 'hollow');
        T.eq(r.isFalseHollow, true);
    });
    T.test('false_hollow variants', () => {
        T.eq(Core.canonicalizeId('false_hollow').isFalseHollow, true);
        T.eq(Core.canonicalizeId('False Hollow').isFalseHollow, true);
        T.eq(Core.canonicalizeId('FALSE-HOLLOW').isFalseHollow, true);
    });
    T.test('regular hollow is not false-hollow', () => {
        T.eq(Core.canonicalizeId('hollow').isFalseHollow, false);
        T.eq(Core.canonicalizeId('hollow-cutout').isFalseHollow, false);
    });
    T.test('stem-up variants', () => {
        T.eq(Core.canonicalizeId('stem-up').canonical, 'stem-up');
        T.eq(Core.canonicalizeId('stem_up').canonical, 'stem-up');
        T.eq(Core.canonicalizeId('stemup').canonical, 'stem-up');
        T.eq(Core.canonicalizeId('up-stem').canonical, 'stem-up');
        T.eq(Core.canonicalizeId('up_stem').canonical, 'stem-up');
        T.eq(Core.canonicalizeId('upstem').canonical, 'stem-up');
        T.eq(Core.canonicalizeId('STEM UP').canonical, 'stem-up');
        T.eq(Core.canonicalizeId('Up Stem').canonical, 'stem-up');
    });
    T.test('stem-down variants', () => {
        T.eq(Core.canonicalizeId('stem-down').canonical, 'stem-down');
        T.eq(Core.canonicalizeId('stem_down').canonical, 'stem-down');
        T.eq(Core.canonicalizeId('stemdown').canonical, 'stem-down');
        T.eq(Core.canonicalizeId('down-stem').canonical, 'stem-down');
        T.eq(Core.canonicalizeId('down_stem').canonical, 'stem-down');
        T.eq(Core.canonicalizeId('downstem').canonical, 'stem-down');
    });
    T.test('unknown IDs return null', () => {
        T.eq(Core.canonicalizeId('background'), null);
        T.eq(Core.canonicalizeId('layer-1'), null);
        T.eq(Core.canonicalizeId('path123'), null);
    });
    T.test('no false positives', () => {
        T.eq(Core.canonicalizeId('stemware'), null);
        T.eq(Core.canonicalizeId('hollowed-out'), null);
        T.eq(Core.canonicalizeId('notes'), null);
        T.eq(Core.canonicalizeId('upbeat'), null);
        T.eq(Core.canonicalizeId('download'), null);
    });
    T.test('null/empty input', () => {
        T.eq(Core.canonicalizeId(null), null);
        T.eq(Core.canonicalizeId(''), null);
        T.eq(Core.canonicalizeId(123), null);
    });
});

T.suite('Bézier Extrema', () => {
    T.test('cubicExtremaT: straight line has no interior extrema', () => {
        // Line from x=0 to x=10, control points on line
        T.deepEq(Core.cubicExtremaT(0, 3.33, 6.67, 10), []);
    });
    T.test('cubicExtremaT: S-curve has one extremum', () => {
        // Control points that create an x-overshoot
        const ts = Core.cubicExtremaT(0, 15, -5, 10);
        T.ok(ts.length >= 1, 'at least one extremum');
        ts.forEach(t => { T.ok(t > 0 && t < 1, 't in (0,1)'); });
    });
    T.test('cubicAt: evaluate at endpoints', () => {
        T.approx(Core.cubicAt(0, 1, 2, 3, 0), 0, 0.001);
        T.approx(Core.cubicAt(0, 1, 2, 3, 1), 3, 0.001);
    });
    T.test('cubicAt: evaluate at midpoint of line', () => {
        // For a "linear" cubic (control points equally spaced), midpoint = 1.5
        T.approx(Core.cubicAt(0, 1, 2, 3, 0.5), 1.5, 0.001);
    });
    T.test('findPathExtremePoints: diamond', () => {
        const cmds = Core.normalizeCommands(Core.bakerParsePath('M 0 0.6667 L 0.6667 0 L 0 -0.6667 L -0.6667 0 Z'));
        const ext = Core.findPathExtremePoints(cmds);
        T.approx(ext.left.x, -0.6667, 0.001);
        T.approx(ext.left.y, 0, 0.001);
        T.approx(ext.right.x, 0.6667, 0.001);
        T.approx(ext.right.y, 0, 0.001);
    });
    T.test('findPathExtremePoints: oval (cubic curves)', () => {
        // A horizontal oval: leftmost/rightmost at y=0, not at corners
        const cmds = Core.normalizeCommands(Core.circleToCommands(0, 0, 10));
        const ext = Core.findPathExtremePoints(cmds);
        T.approx(ext.left.x, -10, 0.5);
        T.approx(ext.left.y, 0, 0.5);
        T.approx(ext.right.x, 10, 0.5);
        T.approx(ext.right.y, 0, 0.5);
    });
    T.test('findPathExtremePoints: rectangle', () => {
        const cmds = Core.normalizeCommands(Core.bakerParsePath('M -5 -3 L 5 -3 L 5 3 L -5 3 Z'));
        const ext = Core.findPathExtremePoints(cmds);
        T.approx(ext.left.x, -5, 0.001);
        T.approx(ext.right.x, 5, 0.001);
    });
});

T.suite('Default Stem Anchors', () => {
    T.test('diamond: stems at left/right vertices', () => {
        const cmds = Core.normalizeCommands(Core.bakerParsePath('M 0 0.6667 L 0.6667 0 L 0 -0.6667 L -0.6667 0 Z'));
        const anchors = Core.computeDefaultStemAnchors(cmds, 0.1);
        // stem-down left: x = -0.6667 + 0.05
        T.approx(anchors.stemDown.x, -0.6167, 0.01);
        T.approx(anchors.stemDown.y, 0, 0.01);
        // stem-up right: x = 0.6667 - 0.05
        T.approx(anchors.stemUp.x, 0.6167, 0.01);
        T.approx(anchors.stemUp.y, 0, 0.01);
    });
    T.test('circle: stems at left/right edges, y≈0', () => {
        const cmds = Core.normalizeCommands(Core.circleToCommands(0, 0, 1));
        const anchors = Core.computeDefaultStemAnchors(cmds, 0.1);
        T.approx(anchors.stemDown.x, -0.95, 0.05);
        T.approx(anchors.stemDown.y, 0, 0.1);
        T.approx(anchors.stemUp.x, 0.95, 0.05);
        T.approx(anchors.stemUp.y, 0, 0.1);
    });
    T.test('zero stem width', () => {
        const cmds = Core.normalizeCommands(Core.bakerParsePath('M 0 0.5 L 0.5 0 L 0 -0.5 L -0.5 0 Z'));
        const anchors = Core.computeDefaultStemAnchors(cmds, 0);
        T.approx(anchors.stemDown.x, -0.5, 0.001);
        T.approx(anchors.stemUp.x, 0.5, 0.001);
    });
    T.test('rectangle: stems at left/right edges', () => {
        const cmds = Core.normalizeCommands(Core.bakerParsePath('M -5 -3 L 5 -3 L 5 3 L -5 3 Z'));
        const anchors = Core.computeDefaultStemAnchors(cmds, 1);
        T.approx(anchors.stemDown.x, -4.5, 0.01);
        T.approx(anchors.stemUp.x, 4.5, 0.01);
    });
});

T.suite('Round-trip: parse → normalize → stringify → parse', () => {
    T.test('diamond round-trip preserves shape', () => {
        const original = 'M 0 0.667 L 0.667 0 L 0 -0.667 L -0.667 0 Z';
        const r = Core.bakePath(original, false, 3);
        const reparsed = Core.normalizeCommands(Core.bakerParsePath(r.path));
        T.eq(reparsed.length, 5); // M L L L Z
    });
    T.test('relative → absolute → stringify → reparse stays absolute', () => {
        const r = Core.bakePath('m 0 0 l 10 0 l 0 10 l -10 0 z', false, 3);
        T.ok(!r.path.includes('m '), 'no relative m');
        T.ok(!r.path.includes(' l ') && !r.path.startsWith('l '), 'no relative l');
    });
});

// ========================================================================
//  SVG IMPORT HELPERS
// ========================================================================

T.suite('computeStemAnchorsFromRects', () => {
    T.test('kite-up stem rects (raw SVG coords)', () => {
        // stem-up: bottom edge y = -516.669 + 350 = -166.669, center x = 0.0
        const stemUp = { x: -22.22222137451172, y: -516.6693115234375, width: 44.44444274902344, height: 350 };
        // stem-down: top edge y = 188.886, center x = 0.0
        const stemDown = { x: -22.22222137451172, y: 188.8862152099609, width: 44.44444274902344, height: 350 };
        const result = Core.computeStemAnchorsFromRects(stemUp, stemDown);
        T.approx(result.stemUp.x, 0.0, 0.001, 'stemUp.x');
        T.approx(result.stemUp.y, -166.6693, 0.01, 'stemUp.y');
        T.approx(result.stemDown.x, 0.0, 0.001, 'stemDown.x');
        T.approx(result.stemDown.y, 188.8862, 0.01, 'stemDown.y');
    });

    T.test('kite-down stem rects', () => {
        const stemUp = { x: -22.22222137451172, y: -538.8882446289062, width: 44.44444274902344, height: 350 };
        const stemDown = { x: -22.22222137451172, y: 166.6673278808594, width: 44.44444274902344, height: 350 };
        const result = Core.computeStemAnchorsFromRects(stemUp, stemDown);
        T.approx(result.stemUp.x, 0.0, 0.001, 'stemUp.x');
        T.approx(result.stemUp.y, -188.8882, 0.01, 'stemUp.y');
        T.approx(result.stemDown.x, 0.0, 0.001, 'stemDown.x');
        T.approx(result.stemDown.y, 166.6673, 0.01, 'stemDown.y');
    });

    T.test('diamond-up stem rects (off-center stems)', () => {
        const stemUp = { x: 116.66689166666663, y: -349.9995875, width: 33.333333333333336, height: 350.0 };
        const stemDown = { x: -150.000225, y: 0.00018749999999867484, width: 33.333333333333336, height: 350.0 };
        const result = Core.computeStemAnchorsFromRects(stemUp, stemDown);
        T.approx(result.stemUp.x, 133.334, 0.01, 'stemUp.x');
        T.approx(result.stemUp.y, 0.0, 0.01, 'stemUp.y');
        T.approx(result.stemDown.x, -133.334, 0.01, 'stemDown.x');
        T.approx(result.stemDown.y, 0.0, 0.01, 'stemDown.y');
    });

    T.test('standard-notehead stem rects (tilted ellipse)', () => {
        const stemUp = { x: 104.37632498419464, y: -381.5697002608674, width: 22.22222222222222, height: 350.0 };
        const stemDown = { x: -126.59725174896637, y: 31.57288710135107, width: 22.22222222222222, height: 350.0 };
        const result = Core.computeStemAnchorsFromRects(stemUp, stemDown);
        T.approx(result.stemUp.x, 115.487, 0.01, 'stemUp.x');
        T.approx(result.stemUp.y, -31.570, 0.01, 'stemUp.y');
        T.approx(result.stemDown.x, -115.486, 0.01, 'stemDown.x');
        T.approx(result.stemDown.y, 31.573, 0.01, 'stemDown.y');
    });

    T.test('null stem rects default to (0,0)', () => {
        const result = Core.computeStemAnchorsFromRects(null, null);
        T.eq(result.stemUp.x, 0);
        T.eq(result.stemUp.y, 0);
        T.eq(result.stemDown.x, 0);
        T.eq(result.stemDown.y, 0);
    });

    T.test('only stem-up present', () => {
        const stemUp = { x: -22.222, y: -516.669, width: 44.444, height: 350 };
        const result = Core.computeStemAnchorsFromRects(stemUp, null);
        T.approx(result.stemUp.x, 0.0, 0.01);
        T.approx(result.stemUp.y, -166.669, 0.01);
        T.eq(result.stemDown.x, 0);
        T.eq(result.stemDown.y, 0);
    });
});

T.suite('buildShapeDef', () => {
    T.test('kite-up full shape def', () => {
        const def = Core.buildShapeDef({
            name: 'kite-up',
            noteheadPath: 'M 0.0 199.999 L 200.0 99.984 L 0.0 -200.001 L -200.0 99.984 Z',
            hollowPath: 'M 99.985 99.984 L 0.0 -99.986 L -99.985 99.984 Z',
            lilypondNotehead: "'(\n    (moveto 0.0 -2.0)\n    (lineto 2.0 -0.9998)\n    (lineto 0.0 2.0)\n    (lineto -2.0 -0.9998)\n    (closepath))",
            lilypondHollow: "'(\n    (moveto 0.9999 -0.9998)\n    (lineto 0.0 0.9999)\n    (lineto -0.9999 -0.9998)\n    (closepath))",
            semitoneHeight: 4.0,
            stemUpRect: { x: -22.222, y: -516.669, width: 44.444, height: 350 },
            stemDownRect: { x: -22.222, y: 188.886, width: 44.444, height: 350 },
            viewBoxWidth: 400,
            viewBoxHeight: 400,
            isFalseHollow: false
        });
        T.eq(def.type, 'notehead');
        T.eq(def.semitoneHeight, 4.0);
        T.eq(def.naturalHeight, 400);
        T.eq(def.naturalWidth, 400);
        T.ok(def.lilypondPath.includes('moveto'));
        T.ok(def.lilypondHollow.includes('moveto'));
        T.ok(def.path.includes('M 0.0'));
        T.ok(def.hollowPath.includes('M 99.985'));
        // Anchors in raw SVG coords
        T.approx(def.anchors.stemUp.x, 0.0, 0.01);
        T.approx(def.anchors.stemUp.y, -166.669, 0.01);
        T.approx(def.anchors.stemDown.y, 188.886, 0.01);
        T.eq(def.overlapPercent, 25);
        T.eq(def.isFalseHollow, false);
    });

    T.test('standard-notehead with curved path', () => {
        const def = Core.buildShapeDef({
            name: 'standard-notehead',
            noteheadPath: 'M 120.102 -59.892 C 142.154 -15.665 ...',
            hollowPath: 'M 100.083 -49.91 C 114.113 -23.731 ...',
            lilypondNotehead: "'(\n    (moveto 1.201 0.5989)\n    ...)",
            lilypondHollow: "'(\n    (moveto 1.0008 0.4991)\n    ...)",
            semitoneHeight: 2.0,
            stemUpRect: { x: 104.376, y: -381.570, width: 22.222, height: 350 },
            stemDownRect: { x: -126.597, y: 31.573, width: 22.222, height: 350 },
            viewBoxWidth: 253.196,
            viewBoxHeight: 200,
            isFalseHollow: false
        });
        T.eq(def.semitoneHeight, 2.0);
        T.eq(def.naturalHeight, 200);
        T.approx(def.naturalWidth, 253.196, 0.01);
        // Anchors in raw SVG coords
        T.approx(def.anchors.stemUp.x, 115.487, 0.01);
        T.approx(def.anchors.stemUp.y, -31.570, 0.01);
    });

    T.test('shape with no hollow', () => {
        const def = Core.buildShapeDef({
            name: 'test',
            noteheadPath: 'M 0 0 L 1 0 Z',
            hollowPath: null,
            lilypondNotehead: null,
            lilypondHollow: null,
            semitoneHeight: 3.0,
            stemUpRect: null,
            stemDownRect: null,
            viewBoxWidth: 300,
            viewBoxHeight: 300,
            isFalseHollow: false
        });
        T.eq(def.hollowPath, null);
        T.eq(def.lilypondPath, null);
        T.eq(def.lilypondHollow, null);
        T.eq(def.naturalHeight, 300);
        T.eq(def.naturalWidth, 300);
        T.eq(def.anchors, null);  // stemless — no stem rects
    });

    T.test('semitoneHeight falls back to viewBoxHeight / 100', () => {
        const def = Core.buildShapeDef({
            name: 'test',
            noteheadPath: 'M 0 0 Z',
            hollowPath: null,
            lilypondNotehead: null,
            lilypondHollow: null,
            semitoneHeight: null,
            stemUpRect: null,
            stemDownRect: null,
            viewBoxWidth: 400,
            viewBoxHeight: 300,
            isFalseHollow: false
        });
        T.eq(def.semitoneHeight, 3.0);
        T.eq(def.naturalHeight, 300);
        T.eq(def.naturalWidth, 400);
    });

    T.test('false-hollow flag preserved', () => {
        const def = Core.buildShapeDef({
            name: 'test',
            noteheadPath: 'M 0 0 Z',
            hollowPath: 'M 0 0 Z',
            lilypondNotehead: null,
            lilypondHollow: null,
            semitoneHeight: 2.0,
            stemUpRect: null,
            stemDownRect: null,
            viewBoxWidth: 200,
            viewBoxHeight: 200,
            isFalseHollow: true,
            type: 'notehead'
        });
        T.eq(def.isFalseHollow, true);
    });

    T.test('custom type preserved', () => {
        const def = Core.buildShapeDef({
            name: 'treble-clef',
            noteheadPath: 'M 0 0 Z',
            hollowPath: null,
            lilypondNotehead: null,
            lilypondHollow: null,
            semitoneHeight: null,
            stemUpRect: null,
            stemDownRect: null,
            viewBoxWidth: 200,
            viewBoxHeight: 500,
            isFalseHollow: false,
            type: 'clef'
        });
        T.eq(def.type, 'clef');
        T.eq(def.naturalHeight, 500);
    });
});

T.suite('End-to-end: SVG import → .ly export anchor conversion', () => {
    T.test('standard-notehead: raw SVG anchors → LilyPond coords via buildAttachmentPoints', () => {
        const def = Core.buildShapeDef({
            name: 'standard-notehead',
            noteheadPath: 'M 120 -60 C 142 -16 106 47 40 80 Z',
            hollowPath: null,
            lilypondNotehead: "'((moveto 1.2 0.6)(closepath))",
            lilypondHollow: null,
            semitoneHeight: 2.0,
            stemUpRect: { x: 104.376, y: -381.570, width: 22.222, height: 350 },
            stemDownRect: { x: -126.597, y: 31.573, width: 22.222, height: 350 },
            viewBoxWidth: 253.196,
            viewBoxHeight: 200,
            isFalseHollow: false
        });
        // coordScale = 200 / 2.0 = 100, so ÷100 and Y-invert
        const pts = Core.buildAttachmentPoints(def);
        T.approx(pts.crotchetUp.x, 1.1549, 0.001, 'ly stemUp.x');
        T.approx(pts.crotchetUp.y, 0.3157, 0.001, 'ly stemUp.y (Y-inverted)');
        T.approx(pts.crotchetDown.x, -1.1549, 0.001, 'ly stemDown.x');
        T.approx(pts.crotchetDown.y, -0.3157, 0.001, 'ly stemDown.y (Y-inverted)');
    });

    T.test('kite-up: centered stems → LilyPond coords', () => {
        const def = Core.buildShapeDef({
            name: 'kite-up',
            noteheadPath: 'M 0.0 199.999 L 200.0 99.984 L 0.0 -200.001 L -200.0 99.984 Z',
            hollowPath: null,
            lilypondNotehead: "'((moveto 0 -2)(closepath))",
            lilypondHollow: null,
            semitoneHeight: 4.0,
            stemUpRect: { x: -22.222, y: -516.669, width: 44.444, height: 350 },
            stemDownRect: { x: -22.222, y: 188.886, width: 44.444, height: 350 },
            viewBoxWidth: 400,
            viewBoxHeight: 400,
            isFalseHollow: false
        });
        // coordScale = 400 / 4.0 = 100
        const pts = Core.buildAttachmentPoints(def);
        T.approx(pts.crotchetUp.x, 0.0, 0.001, 'ly stemUp.x');
        T.approx(pts.crotchetUp.y, 1.6667, 0.01, 'ly stemUp.y');
        T.approx(pts.crotchetDown.x, 0.0, 0.001, 'ly stemDown.x');
        T.approx(pts.crotchetDown.y, -1.8889, 0.01, 'ly stemDown.y');
    });

    T.test('legacy STANDARD_OVAL: scale=1, Y-invert only', () => {
        // Legacy shapes have naturalHeight ≈ semitoneHeight, so coordScale ≈ 1
        const def = {
            type: 'notehead',
            path: 'M 0.707 -0.401 Z',
            hollowPath: null,
            naturalHeight: 1.333,
            naturalWidth: 1.684,
            semitoneHeight: 1.333,
            anchors: { stemUp: { x: 0.673, y: -0.387 }, stemDown: { x: -0.745, y: 0.323 } },
            lilypondPath: null,
            lilypondHollow: null,
            overlapPercent: 25,
            isFalseHollow: false
        };
        const pts = Core.buildAttachmentPoints(def);
        // coordScale = 1.333/1.333 = 1.0
        // Y-invert: -(-0.387) = 0.387, -(0.323) = -0.323
        T.approx(pts.crotchetUp.x, 0.673, 0.001);
        T.approx(pts.crotchetUp.y, 0.387, 0.001, 'Y-inverted');
        T.approx(pts.crotchetDown.x, -0.745, 0.001);
        T.approx(pts.crotchetDown.y, -0.323, 0.001, 'Y-inverted');
    });
});

T.suite('parseRectAttrs', () => {
    T.test('parses string attributes', () => {
        const r = Core.parseRectAttrs({ x: '-22.222', y: '188.886', width: '44.444', height: '350' });
        T.approx(r.x, -22.222, 0.001);
        T.approx(r.y, 188.886, 0.001);
        T.approx(r.width, 44.444, 0.001);
        T.eq(r.height, 350);
    });

    T.test('handles missing/null values as 0', () => {
        const r = Core.parseRectAttrs({ x: null, y: undefined, width: '', height: 'abc' });
        T.eq(r.x, 0);
        T.eq(r.y, 0);
        T.eq(r.width, 0);
        T.eq(r.height, 0);
    });
});

T.suite('shapeNameFromFilename', () => {
    T.test('strips .svg extension', () => {
        T.eq(Core.shapeNameFromFilename('kite-up.svg'), 'kite-up');
    });
    T.test('strips path', () => {
        T.eq(Core.shapeNameFromFilename('/home/user/shapes/diamond-down.svg'), 'diamond-down');
    });
    T.test('strips windows path', () => {
        T.eq(Core.shapeNameFromFilename('C:\\Users\\test\\kite-up.svg'), 'kite-up');
    });
    T.test('handles other extensions', () => {
        T.eq(Core.shapeNameFromFilename('shape.SVG'), 'shape');
    });
    T.test('handles no extension', () => {
        T.eq(Core.shapeNameFromFilename('myshape'), 'myshape');
    });
    T.test('handles empty/null', () => {
        T.eq(Core.shapeNameFromFilename(''), 'shape');
        T.eq(Core.shapeNameFromFilename(null), 'shape');
    });
});

T.suite('Migration: type field backfill', () => {
    T.test('v2 shapes get type=notehead after migration', () => {
        const app = {
            meta: { version: '2.0', name: 'test', label: 'Test', suffix: '', footnote: '' },
            layout: { pxPerSemi: 20 },
            notehead: { heightInSemitones: 4, verticalOffset: 0 },
            engine: { ...Core.ENGINE_DEFAULTS },
            defs: {
                'kite-up': { path: 'M 0 0 Z', hollowPath: null, naturalHeight: 1.333, anchors: { stemUp: {x:0,y:0}, stemDown: {x:0,y:0} }, overlapPercent: 25 }
            },
            colors: {},
            styles: { staff: { color:'#000',thickness:1,dash:null } },
            mapChrom: Array(12).fill({ shape:'kite-up', color:'color-primary', hollow:false }),
            mapStaff: Array(12).fill({ type:'none', style:'staff', override:null })
        };
        const migrated = Core.migrateApp(app);
        T.eq(migrated.defs['kite-up'].type, 'notehead');
        T.eq(migrated.defs['kite-up'].isFalseHollow, false);
    });

    T.test('already v3 shapes without type get backfilled', () => {
        const app = Core.createDefaultApp();
        app.defs['test'] = { path: 'M 0 0 Z', hollowPath: null, naturalHeight: 1.0, anchors: { stemUp: {x:0,y:0}, stemDown: {x:0,y:0} }, overlapPercent: 25 };
        // Force a re-migration by pretending it's v2
        app.meta.version = '2.0';
        app.noteheadRules = [{ shape:'test', color:'', hollow:false, pitchClasses:'all', durations:'all', keys:'all' }];
        app.staffRules = [];
        const migrated = Core.migrateApp(app);
        T.eq(migrated.defs['test'].type, 'notehead');
    });
});


// === NEW v4.0 SUITES ===

T.suite('Cumulative Rule Resolution', () => {
    const defs = {
        'shape-a': { path:'M 0 0' },
        'shape-b': { path:'M 1 1' }
    };

    T.test('defaults: first shape, solid, black', () => {
        const configs = Core.resolveAllNoteheadConfigs([], defs);
        T.eq(configs[0].shape, 'shape-a');
        T.eq(configs[0].hollow, false);
        T.eq(configs[0].color, '#000000');
    });

    T.test('single shape rule covers all', () => {
        const rules = [{ ruleType:'shape', shape:'shape-b', pitchClasses:'all', durations:'all', keys:'all' }];
        const configs = Core.resolveAllNoteheadConfigs(rules, defs);
        for (let i=0; i<12; i++) T.eq(configs[i].shape, 'shape-b');
    });

    T.test('last-match-wins for shape', () => {
        const rules = [
            { ruleType:'shape', shape:'shape-a', pitchClasses:'all', durations:'all', keys:'all' },
            { ruleType:'shape', shape:'shape-b', pitchClasses:[0,1], durations:'all', keys:'all' }
        ];
        const configs = Core.resolveAllNoteheadConfigs(rules, defs);
        T.eq(configs[0].shape, 'shape-b');
        T.eq(configs[1].shape, 'shape-b');
        T.eq(configs[2].shape, 'shape-a');
    });

    T.test('last-match-wins for color', () => {
        const rules = [
            { ruleType:'color', color:'#ff0000', pitchClasses:'all', durations:'all', keys:'all' },
            { ruleType:'color', color:'#00ff00', pitchClasses:[5], durations:'all', keys:'all' }
        ];
        const configs = Core.resolveAllNoteheadConfigs(rules, defs);
        T.eq(configs[0].color, '#ff0000');
        T.eq(configs[5].color, '#00ff00');
    });

    T.test('hollow rule sets hollow independently', () => {
        const rules = [
            { ruleType:'shape', shape:'shape-a', pitchClasses:'all', durations:'all', keys:'all' },
            { ruleType:'hollow', hollow:true, pitchClasses:[3,6,9], durations:'all', keys:'all' }
        ];
        const configs = Core.resolveAllNoteheadConfigs(rules, defs);
        T.eq(configs[0].hollow, false);
        T.eq(configs[3].hollow, true);
        T.eq(configs[6].hollow, true);
        T.eq(configs[4].hollow, false);
    });

    T.test('independent layering: shape + hollow + color', () => {
        const rules = [
            { ruleType:'shape', shape:'shape-a', pitchClasses:'all', durations:'all', keys:'all' },
            { ruleType:'shape', shape:'shape-b', pitchClasses:[0,4,8], durations:'all', keys:'all' },
            { ruleType:'hollow', hollow:true, pitchClasses:[1,3,5,7,9,11], durations:'all', keys:'all' },
            { ruleType:'color', color:'#ff0000', pitchClasses:[0,2,4], durations:'all', keys:'all' }
        ];
        const configs = Core.resolveAllNoteheadConfigs(rules, defs);
        // PC 0: shape-b, solid, red
        T.eq(configs[0].shape, 'shape-b'); T.eq(configs[0].hollow, false); T.eq(configs[0].color, '#ff0000');
        // PC 1: shape-a, hollow, black
        T.eq(configs[1].shape, 'shape-a'); T.eq(configs[1].hollow, true); T.eq(configs[1].color, '#000000');
        // PC 2: shape-a, solid, red
        T.eq(configs[2].shape, 'shape-a'); T.eq(configs[2].hollow, false); T.eq(configs[2].color, '#ff0000');
    });

    T.test('returns exactly 12 entries', () => {
        const configs = Core.resolveAllNoteheadConfigs([], defs);
        T.eq(configs.length, 12);
    });

    T.test('out-of-range PCs ignored', () => {
        const rules = [{ ruleType:'shape', shape:'shape-b', pitchClasses:[13, -1, 0], durations:'all', keys:'all' }];
        const configs = Core.resolveAllNoteheadConfigs(rules, defs);
        T.eq(configs[0].shape, 'shape-b');
        T.eq(configs[1].shape, 'shape-a'); // unaffected
    });
});

T.suite('Group Resolved Configs', () => {
    T.test('identical configs grouped', () => {
        const configs = Array.from({length:12}, () => ({shape:'s', hollow:false, color:'#000'}));
        const groups = Core.groupResolvedConfigs(configs);
        T.eq(groups.length, 1);
        T.eq(groups[0].pitchClasses.length, 12);
    });

    T.test('different configs separate', () => {
        const configs = Array.from({length:12}, (_, i) => ({
            shape: i < 6 ? 'a' : 'b', hollow: false, color: '#000'
        }));
        const groups = Core.groupResolvedConfigs(configs);
        T.eq(groups.length, 2);
    });

    T.test('groups sorted by first PC', () => {
        const configs = [];
        for (let i=0; i<12; i++) {
            configs.push({shape: i%2===0 ? 'a' : 'b', hollow: false, color: '#000'});
        }
        const groups = Core.groupResolvedConfigs(configs);
        T.ok(groups[0].pitchClasses[0] < groups[1].pitchClasses[0]);
    });
});

T.suite('Color Name Pipeline', () => {
    T.test('colorToSchemeSymbol basic', () => {
        const sym = Core.colorToSchemeSymbol('#000000');
        T.eq(sym, 'black-000000');
    });

    T.test('colorToSchemeSymbol uses nearestColorName', () => {
        const sym = Core.colorToSchemeSymbol('#ff0000');
        T.ok(sym.includes('ff0000'));
        // Should be something like 'red-ff0000'
        T.ok(sym.length > 7);
    });

    T.test('colorToSchemeSymbol null/undefined', () => {
        T.eq(Core.colorToSchemeSymbol(null), 'black-000000');
        T.eq(Core.colorToSchemeSymbol(undefined), 'black-000000');
    });

    T.test('colorToSchemeSymbol lowercase hex suffix', () => {
        const sym = Core.colorToSchemeSymbol('#1B9E77');
        T.ok(sym.includes('1b9e77'));
    });
});

T.suite('Palette Helpers', () => {
    T.test('getActivePaletteColors preset', () => {
        const pal = { mode:'standard', selected:'preset', presetKey:'dark2-3', customColors:[] };
        const colors = Core.getActivePaletteColors(pal);
        T.eq(colors.length, 3);
        T.ok(colors[0].startsWith('#'));
    });

    T.test('getActivePaletteColors custom', () => {
        const pal = { mode:'standard', selected:'custom', presetKey:'dark2-3', customColors:['#ff0000','#00ff00'] };
        const colors = Core.getActivePaletteColors(pal);
        T.eq(colors.length, 2);
        T.eq(colors[0], '#ff0000');
    });

    T.test('getActivePaletteColors null', () => {
        T.deepEq(Core.getActivePaletteColors(null), []);
    });

    T.test('getCBSafeAlternatives returns matches', () => {
        const alts = Core.getCBSafeAlternatives(['#1b9e77', '#d95f02']);
        T.eq(alts.length, 2);
        T.ok(alts[0].cbSafe);
        T.ok(alts[0].cbSafe.hex.startsWith('#'));
    });

    T.test('DEFAULT_NOTEHEAD_PALETTE is valid', () => {
        T.eq(Core.DEFAULT_NOTEHEAD_PALETTE.mode, 'standard');
        T.eq(Core.DEFAULT_NOTEHEAD_PALETTE.selected, 'preset');
    });

    T.test('PALETTE_PRESET_KEYS has expected entries', () => {
        T.ok(Core.PALETTE_PRESET_KEYS['dark2-3']);
        T.ok(Core.PALETTE_PRESET_KEYS['dark2-7']);
        T.ok(Core.PALETTE_PRESET_KEYS['cbsafe-7']);
    });
});

T.suite('Migration Helpers', () => {
    T.test('migrateMonolithicToCumulative basic', () => {
        const old = [
            { shape:'s1', color:'c1', hollow:false, pitchClasses:[0,1], durations:'all', keys:'all' },
            { shape:'s2', color:'c2', hollow:true, pitchClasses:[2,3], durations:'all', keys:'all' }
        ];
        const newRules = Core.migrateMonolithicToCumulative(old);
        // First rule: shape + color (no hollow since false)
        T.ok(newRules.some(r => r.ruleType === 'shape' && r.shape === 's1'));
        T.ok(newRules.some(r => r.ruleType === 'color' && r.color === 'c1'));
        // Second rule: shape + hollow + color
        T.ok(newRules.some(r => r.ruleType === 'hollow' && JSON.stringify(r.pitchClasses) === '[2,3]'));
    });

    T.test('migrateMonolithicToCumulative preserves pitch classes', () => {
        const old = [{ shape:'s1', color:'c1', hollow:false, pitchClasses:'all', durations:'all', keys:'all' }];
        const newRules = Core.migrateMonolithicToCumulative(old);
        const shapeRule = newRules.find(r => r.ruleType === 'shape');
        T.eq(shapeRule.pitchClasses, 'all');
    });

    T.test('migrateColorsToPalette with colors', () => {
        const colors = { 'primary':'#ff0000', 'secondary':'#00ff00', 'bg':'#000000' };
        const pal = Core.migrateColorsToPalette(colors);
        T.eq(pal.selected, 'custom');
        // Black should be filtered out
        T.eq(pal.customColors.length, 2);
        T.ok(pal.customColors.includes('#ff0000'));
    });

    T.test('migrateColorsToPalette all black returns default', () => {
        const colors = { 'primary':'#000000' };
        const pal = Core.migrateColorsToPalette(colors);
        T.eq(pal.selected, 'preset'); // default preset, not custom
    });

    T.test('migrateColorsToPalette empty returns default', () => {
        const pal = Core.migrateColorsToPalette({});
        T.eq(pal.selected, 'preset');
    });

    T.test('resolveColorRefsInRules converts named to hex', () => {
        const rules = [
            { ruleType:'color', color:'primary', pitchClasses:[0] },
            { ruleType:'color', color:'#ff0000', pitchClasses:[1] }
        ];
        const colors = { 'primary':'#0000ff' };
        Core.resolveColorRefsInRules(rules, colors);
        T.eq(rules[0].color, '#0000ff');
        T.eq(rules[1].color, '#ff0000'); // already hex, unchanged
    });

    T.test('getUsedShapes with cumulative rules', () => {
        const app = Core.createDefaultApp();
        app.noteheadRules = [
            { ruleType:'shape', shape:'a', pitchClasses:'all', durations:'all', keys:'all' },
            { ruleType:'shape', shape:'b', pitchClasses:[0], durations:'all', keys:'all' },
            { ruleType:'hollow', hollow:true, pitchClasses:[0], durations:'all', keys:'all' },
            { ruleType:'color', color:'#ff0000', pitchClasses:[0], durations:'all', keys:'all' }
        ];
        const used = Core.getUsedShapes(app);
        T.deepEq(used, ['a', 'b']);
    });
});

// Report
let totalPass=0,totalFail=0;
for(const s of T.suites){
    const icon=s.fail>0?'✗':'✓';
    console.log(`${icon} ${s.name}: ${s.pass}/${s.pass+s.fail}`);
    if(s.fail>0) for(const t of s.tests) if(!t.passed) console.log(`    FAIL: ${t.name} — ${t.error}`);
    totalPass+=s.pass; totalFail+=s.fail;
}
console.log(`\n${totalPass}/${totalPass+totalFail} passed` + (totalFail>0?` — ${totalFail} FAILED`:' ✓'));
